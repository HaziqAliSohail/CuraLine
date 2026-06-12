from clients.llmclient import LLMClient
from settings import settings

# Determine primary/fallback provider order based on settings
_primary = settings.llm_primary.lower()

if _primary == "anthropic":
    llm_client = LLMClient(
        primary_api_key=settings.anthropic_api_key,
        primary_model=settings.anthropic_model,
        primary_provider="anthropic",
        fallback_api_key=settings.openai_api_key,
        fallback_model=settings.openai_model,
        fallback_provider="openai",
        max_tokens=settings.llm_max_tokens,
    )
else:
    # Default: OpenAI primary, Anthropic fallback
    llm_client = LLMClient(
        primary_api_key=settings.openai_api_key,
        primary_model=settings.openai_model,
        primary_provider="openai",
        fallback_api_key=settings.anthropic_api_key,
        fallback_model=settings.anthropic_model,
        fallback_provider="anthropic",
        max_tokens=settings.llm_max_tokens,
    )
