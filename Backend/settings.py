from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_user: str = "admin"
    postgres_password: str = "admin"
    postgres_name: str = "appointment_management"
    postgres_port: str = "5432"
    postgres_host: str = "postgresdb"

    redis_host: str = "redis"
    redis_port: str = "6379"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    secret_key: str = "changeme-use-a-strong-secret-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    @property
    def db_uri(self) -> str:
        return f"postgresql://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_name}"

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}"

    class Config:
        env_file = ".env"


settings = Settings()
