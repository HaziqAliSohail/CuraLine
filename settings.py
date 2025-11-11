from pydantic.v1 import BaseSettings


class Settings(BaseSettings):
    postgres_user: str = "admin"
    postgres_password: str = "admin"
    postgres_name: str = "appointment_management"
    postgres_port: str = "5432"
    postgres_host: str = "postgresdb"

    db_uri: str = f"postgresql://{postgres_user}:{postgres_password}@{postgres_host}:{postgres_port}/{postgres_name}"


settings = Settings()
