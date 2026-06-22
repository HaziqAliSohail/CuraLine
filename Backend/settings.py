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
    # Augment the urgent-care KB with embedding (semantic) matching for phrasings
    # keywords miss. Off by default; needs openai_api_key. Keyword match always
    # runs first, so this only ADDS recall, never reduces it.
    semantic_guidance: bool = False
    # Hard cap on output tokens per LLM call (cost control)
    llm_max_tokens: int = 512

    # ── Email (SMTP) - leave smtp_host empty to disable sending (emails are
    # logged instead, so dev works without a mail server) ──
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    email_from: str = "CuraLine <no-reply@curaline.com>"
    # Public base URL of the frontend - used to build invite/deep links in emails
    frontend_base_url: str = "http://localhost:3001"

    secret_key: str = "changeme-use-a-strong-secret-in-production"
    algorithm: str = "HS256"
    # Short-lived access token; clients silently renew via the refresh token
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # Comma-separated list of allowed CORS origins
    # e.g. "https://app.curaline.com,http://localhost:5173"
    allowed_origins: str = "http://localhost:3000,http://localhost:5173"

    # Travel / lock-in window (minutes). An appointment starting within this
    # window of "now" is considered locked in - the patient may already be
    # travelling, so severity swaps must never bump them, and a freed slot this
    # soon is never offered to someone who would have to travel to reach it.
    reschedule_lock_minutes: int = 120

    # Set to True to use a local SQLite file instead of PostgreSQL (dev only)
    use_sqlite: bool = False

    # Connection pool sizing (per web worker process). Keep
    # (db_pool_size + db_max_overflow) * num_workers < Postgres max_connections.
    db_pool_size: int = 10
    db_max_overflow: int = 10

    # Expose interactive API docs (/docs, /redoc, /openapi.json).
    # Disable in production to avoid publishing the full API surface.
    enable_docs: bool = False

    # Loguru "diagnose" dumps local variable VALUES into exception tracebacks,
    # which can spill PII/PHI into logs. Keep False in production; turn on only
    # for local debugging.
    log_diagnose: bool = False

    # ── Telehealth video (Daily.co) — empty key = feature off (sandbox) ──
    daily_api_key: str = ""

    # ── SMS reminders (Twilio) — empty creds = feature off ──
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    # ── Payments (Stripe) — empty key = feature off. default_copay_cents is the
    # placeholder amount until real per-plan pricing is wired. ──
    stripe_secret_key: str = ""
    default_copay_cents: int = 2500

    # ── PHI encryption at rest ──
    # Fernet key (generate: python -c "from cryptography.fernet import Fernet;
    # print(Fernet.generate_key().decode())"). Empty = columns stored as
    # plaintext (dev only). Set this in production to encrypt PHI at rest.
    phi_encryption_key: str = ""
    # Strip PHI from finished visits older than this many days (0 = keep forever).
    phi_retention_days: int = 0

    # ── Product analytics (PostHog) — leave key empty to log events locally ──
    posthog_api_key: str = ""
    posthog_host: str = "https://us.i.posthog.com"

    # ── Error monitoring (Sentry) — leave DSN empty to disable entirely ──
    sentry_dsn: str = ""
    environment: str = "production"

    # ── US insurance eligibility (real-time 270/271 via a clearinghouse) ──
    # provider: "" (sandbox/mock, default), or a real adapter e.g. "stedi".
    # api_key: the clearinghouse key. With no key the system runs in sandbox
    # mode so the flow is fully demoable without a paid account.
    eligibility_provider: str = ""
    eligibility_api_key: str = ""
    # Stedi adapter config (used when eligibility_provider == "stedi").
    eligibility_api_url: str = "https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3"
    eligibility_provider_npi: str = ""
    eligibility_org_name: str = "CuraLine"
    # Optional JSON map of carrier name -> clearinghouse payer ID, e.g.
    # '{"Blue Cross Blue Shield of Texas":"84980"}'. Extends the built-in defaults.
    eligibility_payer_map: str = ""

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
        # CORS runs with allow_credentials=True; a wildcard origin would let any
        # site make credentialed requests. Refuse it explicitly.
        if "*" in self.allowed_origins_list:
            raise ValueError(
                "ALLOWED_ORIGINS must list explicit origins (no '*') because "
                "credentialed CORS is enabled."
            )


settings = Settings()
