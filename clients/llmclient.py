import logging

from clients.mapper import LLM_MAPPER


class LLMClient:

    def __init__(self, api_key, model_name="gpt-4o", llm_name="openai"):
        self.api_key = api_key
        self.model_name = model_name
        self.client = LLM_MAPPER[llm_name](api_key=api_key)

    def query(self, message):
        try:
            response = self.client.responses.create(
                model=self.model_name,
                input=message
            )
            return response.output_text

        except Exception as a:
            return a.message


