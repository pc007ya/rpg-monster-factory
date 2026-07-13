from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "RPG Monster Factory"
    data_dir: Path = Path("./data")
    google_drive_root_folder_id: str = ""
    google_service_account_file: str = ""
    google_service_account_json: str = ""
    openai_api_key: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
(settings.data_dir / "inbox").mkdir(parents=True, exist_ok=True)
(settings.data_dir / "monsters").mkdir(parents=True, exist_ok=True)
