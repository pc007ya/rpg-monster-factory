import json
import re
import shutil
from pathlib import Path
from typing import Any

from app.config import settings
from app.models import Monster


def slugify(name: str) -> str:
    value = re.sub(r'[\\/:*?"<>|]+', "-", name.strip())
    return value or "monster"


class LocalStorage:
    def __init__(self) -> None:
        self.data_dir = settings.data_dir
        self.inbox_dir = self.data_dir / "inbox"
        self.monsters_dir = self.data_dir / "monsters"

    def monster_dir(self, slug: str) -> Path:
        return self.monsters_dir / slug

    def import_json_file(self, source: Path) -> dict[str, Any]:
        raw = json.loads(source.read_text(encoding="utf-8"))
        monster = Monster.model_validate(raw)
        slug = slugify(monster.name)
        target = self.monster_dir(slug)
        (target / "reference").mkdir(parents=True, exist_ok=True)
        (target / "sheets").mkdir(parents=True, exist_ok=True)
        (target / "frames").mkdir(parents=True, exist_ok=True)

        monster_path = target / "monster.json"
        monster_path.write_text(
            json.dumps(monster.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        manifest_path = target / "manifest.json"
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        else:
            manifest = {
                "slug": slug,
                "name": monster.name,
                "status": "imported",
                "reference": {
                    "status": "pending",
                    "file": None,
                    "version": 0,
                },
                "actions": {},
            }

        requested = {item.slot: item.frames for item in monster.sprite_request.actions}
        for action, frames in requested.items():
            manifest["actions"].setdefault(
                action,
                {
                    "status": "pending",
                    "frames": frames,
                    "sheet": None,
                    "split_files": [],
                },
            )
            manifest["actions"][action]["frames"] = frames

        self.save_manifest(slug, manifest)
        return manifest

    def import_inbox(self) -> list[dict[str, Any]]:
        imported = []
        for source in sorted(self.inbox_dir.glob("*.json")):
            imported.append(self.import_json_file(source))
        return imported

    def list_monsters(self) -> list[dict[str, Any]]:
        results = []
        for path in sorted(self.monsters_dir.iterdir() if self.monsters_dir.exists() else []):
            if not path.is_dir():
                continue
            manifest = path / "manifest.json"
            monster = path / "monster.json"
            if manifest.exists() and monster.exists():
                results.append({
                    "manifest": json.loads(manifest.read_text(encoding="utf-8")),
                    "monster": json.loads(monster.read_text(encoding="utf-8")),
                })
        return results

    def load_monster(self, slug: str) -> dict[str, Any]:
        target = self.monster_dir(slug)
        monster_path = target / "monster.json"
        manifest_path = target / "manifest.json"
        if not monster_path.exists() or not manifest_path.exists():
            raise FileNotFoundError(slug)
        return {
            "monster": json.loads(monster_path.read_text(encoding="utf-8")),
            "manifest": json.loads(manifest_path.read_text(encoding="utf-8")),
        }

    def save_manifest(self, slug: str, manifest: dict[str, Any]) -> None:
        path = self.monster_dir(slug) / "manifest.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def save_upload(self, slug: str, subdir: str, filename: str, content: bytes) -> Path:
        safe_name = Path(filename).name
        destination = self.monster_dir(slug) / subdir / safe_name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
        return destination


storage = LocalStorage()
