"""
Dual-provider LLM client with automatic fallback.

Architecture:
  1. Try PRIMARY provider (e.g. OpenAI gpt-4o-mini)
  2. If primary fails → Try FALLBACK provider (e.g. Anthropic Claude)
  3. If both fail → return graceful error / raise

Supports:
  - OpenAI chat completions (with automatic server-side prompt caching)
  - Anthropic messages API (with explicit cache_control on system prompts)
  - Global max_tokens cap for cost control
"""

import json
from loguru import logger


# ---------------------------------------------------------------------------
# Provider adapters - normalize OpenAI and Anthropic behind a common interface
# ---------------------------------------------------------------------------

class _OpenAIAdapter:
    """Thin wrapper around the OpenAI client."""

    def __init__(self, client, model: str, max_tokens: int):
        self.client = client
        self.model = model
        self.max_tokens = max_tokens
        self.provider = "openai"

    def _call(self, messages: list, *, response_format=None) -> str:
        kwargs = dict(
            model=self.model,
            messages=messages,
            max_tokens=self.max_tokens,
        )
        if response_format:
            kwargs["response_format"] = response_format
        resp = self.client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content

    def query(self, message, system_prompt: str = None) -> str:
        msgs = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        if isinstance(message, list):
            msgs.extend(message)
        else:
            msgs.append({"role": "user", "content": message})
        return self._call(msgs)

    def query_structured(self, messages: list, system_prompt: str = None) -> dict:
        msgs = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        msgs.extend(messages)
        raw = self._call(msgs, response_format={"type": "json_object"})
        return json.loads(raw)


class _AnthropicAdapter:
    """Thin wrapper around the Anthropic client.

    Translates OpenAI-style message lists into Anthropic's ``system`` +
    ``messages`` shape and applies explicit prompt caching via
    ``cache_control``.
    """

    def __init__(self, client, model: str, max_tokens: int):
        self.client = client
        self.model = model
        self.max_tokens = max_tokens
        self.provider = "anthropic"

    def _call(self, user_messages: list, *, system_prompt: str = None, prefill: str = None) -> str:
        kwargs = dict(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=user_messages,
        )
        if system_prompt:
            # Explicit prompt caching for Anthropic
            kwargs["system"] = [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ]
        if prefill:
            # Force JSON output by pre-filling the assistant turn
            kwargs["messages"] = list(user_messages) + [
                {"role": "assistant", "content": prefill}
            ]
        resp = self.client.messages.create(**kwargs)
        text = resp.content[0].text
        if prefill:
            text = prefill + text
        return text

    def query(self, message, system_prompt: str = None) -> str:
        msgs = []
        if isinstance(message, list):
            # Filter out system messages - Anthropic doesn't accept them inline
            for m in message:
                if m["role"] != "system":
                    msgs.append({"role": m["role"], "content": m["content"]})
        else:
            msgs.append({"role": "user", "content": message})
        return self._call(msgs, system_prompt=system_prompt)

    def query_structured(self, messages: list, system_prompt: str = None) -> dict:
        # Filter out inline system messages
        user_msgs = [m for m in messages if m["role"] != "system"]
        raw = self._call(user_msgs, system_prompt=system_prompt, prefill="{")
        return json.loads(raw)


# ---------------------------------------------------------------------------
# Public client - dual-provider with fallback
# ---------------------------------------------------------------------------

class LLMClient:
    """Dual-provider LLM client with automatic fallback.

    Parameters
    ----------
    primary_api_key : str
        API key for the primary provider.
    primary_model : str
        Model identifier for the primary provider.
    primary_provider : str
        ``"openai"`` or ``"anthropic"``.
    fallback_api_key : str
        API key for the fallback provider (may be empty).
    fallback_model : str
        Model identifier for the fallback provider.
    fallback_provider : str
        ``"openai"`` or ``"anthropic"``.
    max_tokens : int
        Global cap on output tokens per call.
    """

    def __init__(
        self,
        *,
        primary_api_key: str = "",
        primary_model: str = "gpt-4o-mini",
        primary_provider: str = "openai",
        fallback_api_key: str = "",
        fallback_model: str = "claude-haiku-4-5-20251001",
        fallback_provider: str = "anthropic",
        max_tokens: int = 512,
    ):
        from clients.mapper import LLM_MAPPER

        self._adapters: list = []

        # Build primary adapter
        self._adapters.append(
            self._build_adapter(primary_api_key, primary_model, primary_provider, LLM_MAPPER, max_tokens)
        )
        # Build fallback adapter (may be None if no key)
        fb = self._build_adapter(fallback_api_key, fallback_model, fallback_provider, LLM_MAPPER, max_tokens)
        if fb is not None:
            self._adapters.append(fb)

        # Remove None entries (no-key providers)
        self._adapters = [a for a in self._adapters if a is not None]

        if not self._adapters:
            logger.warning("No LLM providers configured - all AI features will return fallback messages.")

    @staticmethod
    def _build_adapter(api_key: str, model: str, provider: str, mapper: dict, max_tokens: int):
        if not api_key or not api_key.strip():
            return None
        try:
            client_cls = mapper.get(provider)
            if client_cls is None:
                logger.error(f"Unknown LLM provider: {provider}")
                return None
            client = client_cls(api_key=api_key)
            if provider == "openai":
                return _OpenAIAdapter(client, model, max_tokens)
            else:
                return _AnthropicAdapter(client, model, max_tokens)
        except Exception as e:
            logger.error(f"Failed to initialize {provider} LLM client: {e}")
            return None

    # -- Public API (unchanged signatures for backward compat) --

    def query(self, message: str, system_prompt: str = None) -> str:
        if not self._adapters:
            return "LLM client is not configured. Please set an API key in your .env file."

        last_error = None
        for adapter in self._adapters:
            try:
                result = adapter.query(message, system_prompt=system_prompt)
                return result
            except Exception as e:
                logger.warning(f"{adapter.provider} query failed, trying next provider: {e}")
                last_error = e

        logger.error(f"All LLM providers failed. Last error: {last_error}")
        return str(last_error) if last_error else "All AI providers are currently unavailable."

    def query_structured(self, messages: list, system_prompt: str = None) -> dict:
        if not self._adapters:
            return {"error": "LLM client is not configured. Please set an API key in your .env file."}

        last_error = None
        for adapter in self._adapters:
            try:
                result = adapter.query_structured(messages, system_prompt=system_prompt)
                return result
            except Exception as e:
                logger.warning(f"{adapter.provider} structured query failed, trying next provider: {e}")
                last_error = e

        logger.error(f"All LLM providers failed. Last error: {last_error}")
        return {"error": str(last_error) if last_error else "All AI providers are currently unavailable."}
