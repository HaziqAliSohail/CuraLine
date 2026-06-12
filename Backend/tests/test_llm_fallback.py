"""
Tests for the dual-provider LLM client with automatic fallback.
"""
import json
import pytest
from unittest.mock import MagicMock, patch, PropertyMock


class TestLLMClientFallback:
    """Test that the LLM client falls back from primary to secondary provider."""

    def test_primary_succeeds_no_fallback(self):
        """When primary succeeds, fallback should not be called."""
        from clients.llmclient import LLMClient, _OpenAIAdapter, _AnthropicAdapter

        client = LLMClient.__new__(LLMClient)

        primary = MagicMock(spec=_OpenAIAdapter)
        primary.provider = "openai"
        primary.query.return_value = "Primary response"

        fallback = MagicMock(spec=_AnthropicAdapter)
        fallback.provider = "anthropic"

        client._adapters = [primary, fallback]

        result = client.query("Hello")
        assert result == "Primary response"
        primary.query.assert_called_once()
        fallback.query.assert_not_called()

    def test_primary_fails_fallback_succeeds(self):
        """When primary fails, fallback should be tried."""
        from clients.llmclient import LLMClient, _OpenAIAdapter, _AnthropicAdapter

        client = LLMClient.__new__(LLMClient)

        primary = MagicMock(spec=_OpenAIAdapter)
        primary.provider = "openai"
        primary.query.side_effect = Exception("OpenAI down")

        fallback = MagicMock(spec=_AnthropicAdapter)
        fallback.provider = "anthropic"
        fallback.query.return_value = "Fallback response"

        client._adapters = [primary, fallback]

        result = client.query("Hello")
        assert result == "Fallback response"
        primary.query.assert_called_once()
        fallback.query.assert_called_once()

    def test_both_providers_fail(self):
        """When both providers fail, return the last error message."""
        from clients.llmclient import LLMClient, _OpenAIAdapter, _AnthropicAdapter

        client = LLMClient.__new__(LLMClient)

        primary = MagicMock(spec=_OpenAIAdapter)
        primary.provider = "openai"
        primary.query.side_effect = Exception("OpenAI down")

        fallback = MagicMock(spec=_AnthropicAdapter)
        fallback.provider = "anthropic"
        fallback.query.side_effect = Exception("Anthropic down")

        client._adapters = [primary, fallback]

        result = client.query("Hello")
        assert "Anthropic down" in result

    def test_no_adapters_configured(self):
        """When no adapters are configured, return a helpful message."""
        from clients.llmclient import LLMClient

        client = LLMClient.__new__(LLMClient)
        client._adapters = []

        result = client.query("Hello")
        assert "not configured" in result.lower()

    def test_structured_primary_succeeds(self):
        """Structured query returns JSON from primary."""
        from clients.llmclient import LLMClient, _OpenAIAdapter

        client = LLMClient.__new__(LLMClient)

        primary = MagicMock(spec=_OpenAIAdapter)
        primary.provider = "openai"
        primary.query_structured.return_value = {"severity_score": 3}

        client._adapters = [primary]

        result = client.query_structured([{"role": "user", "content": "Test"}])
        assert result == {"severity_score": 3}

    def test_structured_fallback_on_failure(self):
        """Structured query falls back when primary raises."""
        from clients.llmclient import LLMClient, _OpenAIAdapter, _AnthropicAdapter

        client = LLMClient.__new__(LLMClient)

        primary = MagicMock(spec=_OpenAIAdapter)
        primary.provider = "openai"
        primary.query_structured.side_effect = Exception("rate limited")

        fallback = MagicMock(spec=_AnthropicAdapter)
        fallback.provider = "anthropic"
        fallback.query_structured.return_value = {"severity_score": 4}

        client._adapters = [primary, fallback]

        result = client.query_structured([{"role": "user", "content": "Test"}])
        assert result == {"severity_score": 4}

    def test_structured_all_fail_returns_error_dict(self):
        """Structured query returns an error dict when all providers fail."""
        from clients.llmclient import LLMClient, _OpenAIAdapter

        client = LLMClient.__new__(LLMClient)

        primary = MagicMock(spec=_OpenAIAdapter)
        primary.provider = "openai"
        primary.query_structured.side_effect = Exception("boom")

        client._adapters = [primary]

        result = client.query_structured([{"role": "user", "content": "Test"}])
        assert "error" in result

    def test_structured_no_adapters(self):
        """Structured query with no adapters returns error dict."""
        from clients.llmclient import LLMClient

        client = LLMClient.__new__(LLMClient)
        client._adapters = []

        result = client.query_structured([{"role": "user", "content": "Test"}])
        assert "error" in result


class TestOpenAIAdapter:
    """Test the OpenAI adapter."""

    def test_query_formats_messages(self):
        """Verify the adapter builds the correct message list."""
        from clients.llmclient import _OpenAIAdapter

        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock()]
        mock_resp.choices[0].message.content = "Test response"
        mock_client.chat.completions.create.return_value = mock_resp

        adapter = _OpenAIAdapter(mock_client, "gpt-4o-mini", 512)
        result = adapter.query("Hello", system_prompt="Be helpful")

        assert result == "Test response"
        call_kwargs = mock_client.chat.completions.create.call_args
        messages = call_kwargs.kwargs["messages"]
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        assert call_kwargs.kwargs["max_tokens"] == 512

    def test_query_structured_returns_json(self):
        """Verify structured query returns parsed JSON."""
        from clients.llmclient import _OpenAIAdapter

        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock()]
        mock_resp.choices[0].message.content = '{"severity_score": 3}'
        mock_client.chat.completions.create.return_value = mock_resp

        adapter = _OpenAIAdapter(mock_client, "gpt-4o-mini", 512)
        result = adapter.query_structured(
            [{"role": "user", "content": "test"}],
            system_prompt="triage"
        )
        assert result == {"severity_score": 3}


class TestAnthropicAdapter:
    """Test the Anthropic adapter."""

    def test_query_filters_system_messages(self):
        """Anthropic adapter should strip inline system messages."""
        from clients.llmclient import _AnthropicAdapter

        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.content = [MagicMock()]
        mock_resp.content[0].text = "Claude response"
        mock_client.messages.create.return_value = mock_resp

        adapter = _AnthropicAdapter(mock_client, "claude-haiku-4-5-20251001", 512)

        messages = [
            {"role": "system", "content": "You are helpful"},
            {"role": "user", "content": "Hello"},
        ]
        result = adapter.query(messages, system_prompt="Be helpful")

        assert result == "Claude response"
        call_kwargs = mock_client.messages.create.call_args.kwargs
        # System messages should not be in the messages list
        user_msgs = call_kwargs["messages"]
        assert all(m["role"] != "system" for m in user_msgs)
        # System prompt should be passed via system= parameter
        assert call_kwargs["system"][0]["text"] == "Be helpful"
        assert call_kwargs["system"][0]["cache_control"] == {"type": "ephemeral"}

    def test_query_structured_prefills_json(self):
        """Anthropic structured query should prefill with '{' for JSON output."""
        from clients.llmclient import _AnthropicAdapter

        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.content = [MagicMock()]
        # Anthropic will respond with the rest of the JSON (without the prefilled '{')
        mock_resp.content[0].text = '"severity_score": 3}'
        mock_client.messages.create.return_value = mock_resp

        adapter = _AnthropicAdapter(mock_client, "claude-haiku-4-5-20251001", 512)
        result = adapter.query_structured(
            [{"role": "user", "content": "test"}],
            system_prompt="triage"
        )
        assert result == {"severity_score": 3}


class TestBuildAdapter:
    """Test the adapter builder."""

    def test_empty_api_key_returns_none(self):
        """Empty API key should return None (no adapter)."""
        from clients.llmclient import LLMClient
        result = LLMClient._build_adapter("", "model", "openai", {}, 512)
        assert result is None

    def test_whitespace_api_key_returns_none(self):
        """Whitespace-only API key should return None."""
        from clients.llmclient import LLMClient
        result = LLMClient._build_adapter("   ", "model", "openai", {}, 512)
        assert result is None

    def test_unknown_provider_returns_none(self):
        """Unknown provider should return None."""
        from clients.llmclient import LLMClient
        result = LLMClient._build_adapter("sk-test", "model", "google", {}, 512)
        assert result is None
