from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.gdrive import sync_drive_inbox
from app.sprite import split_horizontal_sheet
from app.storage import storage


app = FastAPI(title=settings.app_name)
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.mount("/assets", StaticFiles(directory=str(settings.data_dir)), name="assets")
templates = Jinja2Templates(directory="app/templates")


@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "app_name": settings.app_name,
            "items": storage.list_monsters(),
            "message": request.query_params.get("message", ""),
        },
    )


@app.get("/monsters/{slug}", response_class=HTMLResponse)
def monster_page(request: Request, slug: str):
    try:
        item = storage.load_monster(slug)
    except FileNotFoundError:
        raise HTTPException(404, "找不到怪物")
    return templates.TemplateResponse(
        request=request,
        name="monster.html",
        context={
            "app_name": settings.app_name,
            "slug": slug,
            **item,
            "message": request.query_params.get("message", ""),
        },
    )


@app.post("/api/import/local")
def import_local():
    imported = storage.import_inbox()
    return RedirectResponse(
        f"/?message=已匯入 {len(imported)} 個 JSON",
        status_code=303,
    )


@app.post("/api/import/gdrive")
def import_gdrive():
    try:
        downloaded = sync_drive_inbox(storage.inbox_dir)
        imported = storage.import_inbox()
    except Exception as exc:
        return RedirectResponse(
            f"/?message=Google Drive 同步失敗：{exc}",
            status_code=303,
        )
    return RedirectResponse(
        f"/?message=Drive 下載 {len(downloaded)} 個，匯入 {len(imported)} 個",
        status_code=303,
    )


@app.get("/api/monsters")
def list_monsters():
    return storage.list_monsters()


@app.get("/api/monsters/{slug}")
def get_monster(slug: str):
    try:
        return storage.load_monster(slug)
    except FileNotFoundError:
        raise HTTPException(404, "找不到怪物")


@app.post("/api/monsters/{slug}/reference/upload")
async def upload_reference(slug: str, image: UploadFile = File(...)):
    try:
        item = storage.load_monster(slug)
    except FileNotFoundError:
        raise HTTPException(404, "找不到怪物")

    if image.content_type not in {"image/png", "image/webp", "image/jpeg"}:
        raise HTTPException(400, "只接受 PNG、WEBP 或 JPEG")

    suffix = Path(image.filename or "reference.png").suffix.lower() or ".png"
    filename = f"preview{suffix}"
    content = await image.read()
    path = storage.save_upload(slug, "reference", filename, content)

    manifest = item["manifest"]
    manifest["reference"]["status"] = "review"
    manifest["reference"]["file"] = str(path.relative_to(settings.data_dir))
    manifest["reference"]["version"] = manifest["reference"].get("version", 0) + 1
    manifest["status"] = "preview_review"
    storage.save_manifest(slug, manifest)

    return RedirectResponse(
        f"/monsters/{slug}?message=角色預覽圖已上傳",
        status_code=303,
    )


@app.post("/api/monsters/{slug}/reference/approve")
def approve_reference(slug: str):
    try:
        item = storage.load_monster(slug)
    except FileNotFoundError:
        raise HTTPException(404, "找不到怪物")

    manifest = item["manifest"]
    if not manifest["reference"].get("file"):
        raise HTTPException(400, "尚未上傳角色預覽圖")

    manifest["reference"]["status"] = "approved"
    manifest["status"] = "reference_approved"
    storage.save_manifest(slug, manifest)
    return RedirectResponse(
        f"/monsters/{slug}?message=角色已核准，可以開始製作動作",
        status_code=303,
    )


@app.post("/api/monsters/{slug}/actions/{action}/sheet")
async def upload_sheet(
    slug: str,
    action: str,
    image: UploadFile = File(...),
):
    try:
        item = storage.load_monster(slug)
    except FileNotFoundError:
        raise HTTPException(404, "找不到怪物")

    manifest = item["manifest"]
    if action not in manifest["actions"]:
        raise HTTPException(400, "JSON 未定義此動作")

    if image.content_type not in {"image/png", "image/webp", "image/jpeg"}:
        raise HTTPException(400, "只接受 PNG、WEBP 或 JPEG")

    suffix = Path(image.filename or f"{action}.png").suffix.lower() or ".png"
    filename = f"{action}{suffix}"
    content = await image.read()
    path = storage.save_upload(slug, "sheets", filename, content)

    manifest["actions"][action]["sheet"] = str(path.relative_to(settings.data_dir))
    manifest["actions"][action]["status"] = "sheet_uploaded"
    manifest["status"] = "animation_review"
    storage.save_manifest(slug, manifest)

    return RedirectResponse(
        f"/monsters/{slug}?message={action} Sprite Sheet 已上傳",
        status_code=303,
    )


@app.post("/api/monsters/{slug}/actions/{action}/split")
def split_action(slug: str, action: str):
    try:
        item = storage.load_monster(slug)
    except FileNotFoundError:
        raise HTTPException(404, "找不到怪物")

    manifest = item["manifest"]
    action_info = manifest["actions"].get(action)
    if not action_info:
        raise HTTPException(400, "JSON 未定義此動作")
    if not action_info.get("sheet"):
        raise HTTPException(400, "尚未上傳 Sprite Sheet")

    source = settings.data_dir / action_info["sheet"]
    output_dir = storage.monster_dir(slug) / "frames" / action

    try:
        generated = split_horizontal_sheet(
            source_path=source,
            output_dir=output_dir,
            frame_count=int(action_info["frames"]),
            action=action,
        )
    except Exception as exc:
        raise HTTPException(400, str(exc))

    action_info["split_files"] = [
        str(path.relative_to(settings.data_dir)) for path in generated
    ]
    action_info["status"] = "split"

    if all(
        value.get("status") == "split"
        for value in manifest["actions"].values()
    ):
        manifest["status"] = "completed"

    storage.save_manifest(slug, manifest)

    return RedirectResponse(
        f"/monsters/{slug}?message={action} 已切成 {len(generated)} 幀",
        status_code=303,
    )


@app.get("/health")
def health():
    return {"status": "ok"}
