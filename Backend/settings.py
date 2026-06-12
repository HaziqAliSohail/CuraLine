from pydantic import ConfigDict
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
    openai_model: str = "gpt-4o-mini"

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"

    # Which provider to try first: "openai" or "anthropic"
    llm_primary: str = "openai"
    # Hard cap on output tokens per LLM call (cost control)
    llm_max_tokens: int = 512

    # ── Email (SMTP) — leave smtp_host empty to disable sending (emails are
    # logged instead, so dev works without a mail server) ──
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    email_from: str = "CuraLine <no-reply@curaline.com>"

    secret_key: str = "changeme-use-a-strong-secret-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # Comma-separated list of allowed CORS origins
    # e.g. "https://app.curaline.com,http://localhost:5173"
    allowed_origins: str = "http://localhost:3000,http://localhost:5173"

    # Set to True to use a local SQLite file instead of PostgreSQL (dev only)
    use_sqlite: bool = False

    # extra="ignore": .env may carry deploy-only keys (e.g. NGINX_CONF for
    # docker-compose) that are not application settings.
    model_config = ConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def db_uri(self) -> str:
        import os
        if os.environ.get("TESTING") == "True":
            return "sqlite:///:memory:"
        if self.use_sqlite:
            return "sqlite:///./curaline_dev.db"
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_name}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}"

    def validate_production_settings(self) -> None:
        """Raise at startup if unsafe defaults are detected in non-test environments."""
        import os
        if os.environ.get("TESTING") == "True":
            return
        if self.secret_key == "changeme-use-a-strong-secret-in-production":
            raise ValueError(
                "SECRET_KEY is still set to the default value. "
                "Set a strong SECRET_KEY in your .env file before running in production."
            )
        if not self.use_sqlite and self.postgres_password == "admin":
            from loguru import logger
            logger.warning(
                "POSTGRES_PASSWORD is using the default value 'admin'. "
                "Set a strong database password before exposing this deployment."
            )


settings = Settings()
