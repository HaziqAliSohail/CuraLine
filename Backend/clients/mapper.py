from openai import OpenAI
from anthropic import Anthropic

LLM_MAPPER = {
    "openai": OpenAI,
    "anthropic": Anthropic,
}
