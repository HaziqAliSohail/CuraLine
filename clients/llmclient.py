import json

from clients.mapper import LLM_MAPPER


class LLMClient:

    def __init__(self, api_key, model_name="gpt-4o", llm_name="openai"):
        self.api_key = api_key
        self.model_name = model_name
        self.client = LLM_MAPPER[llm_name](api_key=api_key)

    def query(self, message: str, system_prompt: str = None) -> str:
        try:
            input_messages = []
            if system_prompt:
                input_messages.append({"role": "system", "content": system_prompt})
            if isinstance(message, list):
                input_messages.extend(message)
            else:
                input_messages.append({"role": "user", "content": message})

            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=input_messages,
            )
            return response.choices[0].message.content

        except Exception as e:
            return str(e)

    def query_structured(self, messages: list, system_prompt: str = None) -> dict:
        try:
            input_messages = []
            if system_prompt:
                input_messages.append({"role": "system", "content": system_prompt})
            input_messages.extend(messages)

            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=input_messages,
                response_format={"type": "json_object"},
            )
            return json.loads(response.choices[0].message.content)

        except Exception as e:
            return {"error": str(e)}

