from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "mysql+pymysql://library:library@localhost:3306/library"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    b2_key_id: str = ""
    b2_app_key: str = ""
    b2_bucket_name: str = ""
    b2_endpoint: str = ""

    admin_username: str = "admin"
    admin_password: str = "admin"

    openlibrary_base_url: str = "https://openlibrary.org"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
