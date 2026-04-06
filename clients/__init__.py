from clients.llmclient import LLMClient
from settings import settings

llm_client = LLMClient(api_key=settings.openai_api_key, model_name=settings.openai_model)
