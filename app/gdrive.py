import io
import json
from pathlib import Path
from typing import Any

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from app.config import settings


SCOPES = ["https://www.googleapis.com/auth/drive"]


class GoogleDriveClient:
    def __init__(self) -> None:
        credentials = self._credentials()
        self.service = build(
            "drive",
            "v3",
            credentials=credentials,
            cache_discovery=False,
        )

    def _credentials(self):
        if settings.google_service_account_json:
            info = json.loads(settings.google_service_account_json)
            return service_account.Credentials.from_service_account_info(
                info,
                scopes=SCOPES,
            )

        if settings.google_service_account_file:
            path = Path(settings.google_service_account_file)
            if not path.exists():
                raise RuntimeError(f"找不到 Service Account 檔案：{path}")
            return service_account.Credentials.from_service_account_file(
                str(path),
                scopes=SCOPES,
            )

        raise RuntimeError("尚未設定 Google Service Account")

    def find_folder(self, parent_id: str, name: str) -> str | None:
        escaped = name.replace("'", "\\'")
        query = (
            f"'{parent_id}' in parents and "
            f"name = '{escaped}' and "
            "mimeType = 'application/vnd.google-apps.folder' and "
            "trashed = false"
        )
        result = self.service.files().list(
            q=query,
            fields="files(id,name)",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        ).execute()
        files = result.get("files", [])
        return files[0]["id"] if files else None

    def list_json_files(self, folder_id: str) -> list[dict[str, Any]]:
        query = (
            f"'{folder_id}' in parents and "
            "mimeType = 'application/json' and trashed = false"
        )
        result = self.service.files().list(
            q=query,
            fields="files(id,name,modifiedTime)",
            orderBy="modifiedTime desc",
            pageSize=1000,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        ).execute()
        return result.get("files", [])

    def download_bytes(self, file_id: str) -> bytes:
        request = self.service.files().get_media(
            fileId=file_id,
            supportsAllDrives=True,
        )
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        finished = False
        while not finished:
            _, finished = downloader.next_chunk()
        return buffer.getvalue()


def sync_drive_inbox(local_inbox: Path) -> list[Path]:
    root_id = settings.google_drive_root_folder_id
    if not root_id:
        raise RuntimeError("尚未設定 GOOGLE_DRIVE_ROOT_FOLDER_ID")

    client = GoogleDriveClient()
    inbox_id = client.find_folder(root_id, "inbox")
    if not inbox_id:
        raise RuntimeError("Google Drive 根目錄中找不到 inbox 資料夾")

    downloaded = []
    for item in client.list_json_files(inbox_id):
        target = local_inbox / Path(item["name"]).name
        target.write_bytes(client.download_bytes(item["id"]))
        downloaded.append(target)

    return downloaded
