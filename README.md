
# RPG Monster Factory

這個 repository 有兩種執行模式。

## A. GitHub Pages 靜態 Demo

可用功能：

- 匯入多個怪物 JSON
- 顯示怪物清單
- 上傳角色預覽圖到瀏覽器
- 上傳橫向 Sprite Sheet
- 在瀏覽器自動切割 Frames
- 點擊單幀即可下載

不能用的功能：

- Google Drive 私密寫入
- AI API 生圖
- FastAPI
- 伺服器端永久儲存

### 發布步驟

1. 將整個專案 push 到 GitHub。
2. 進入 Repository 的 `Settings → Pages`。
3. `Source` 選擇 `GitHub Actions`。
4. push 到 `main` 後，`.github/workflows/pages.yml` 會自動發布。
5. 網址通常是：

```text
https://你的帳號.github.io/你的repository名稱/
```

根目錄的 `index.html` 就是 GitHub Pages 首頁。

## B. 完整 FastAPI 版

完整版本需要 Docker、Cloud Run、Render、Railway 或自己的主機，因為 GitHub Pages 無法執行 Python。

本機執行：

```bash
cp .env.example .env
docker compose up --build
```

瀏覽：

```text
http://localhost:8000
```

完整版本支援：

- Google Drive inbox 同步
- 後端 JSON 匯入
- 圖片與 manifest 永久儲存
- Sprite Sheet 伺服器端拆幀
- 後續接 OpenAI Images、ComfyUI 或 FLUX

## 目錄

```text
index.html                       GitHub Pages 靜態版
app/                             FastAPI 完整版
data/inbox/                      範例怪物 JSON
.github/workflows/pages.yml      GitHub Pages 部署
.github/workflows/test.yml       Python 測試
.github/workflows/deploy-cloud-run.yml  Cloud Run 部署
```

---

# RPG Monster Factory

可放上 GitHub、可連接 Google Drive 的 RPG 怪物素材製作 MVP。

## 已包含

- 批量讀取怪物 JSON
- Web 管理介面
- Google Drive `inbox` 同步
- 怪物角色預覽圖上傳與核准
- 各動作 Sprite Sheet 上傳
- 橫向 Sprite Sheet 自動切幀
- Manifest 狀態追蹤
- Docker
- GitHub Actions 基本測試
- Cloud Run 部署範例

> 這個版本先把「素材流程」做好。AI 圖片生成服務保留成可插拔介面，
> 你可以接 OpenAI Images、ComfyUI、FLUX 或其他供應商。

## 1. 本機啟動

```bash
cp .env.example .env
docker compose up --build
```

瀏覽：

```text
http://localhost:8000
```

不使用 Docker：

```bash
python -m venv .venv
source .venv/bin/activate
# Windows:
# .venv\Scripts\activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 2. 匯入 JSON

把 JSON 放進：

```text
data/inbox/
```

然後在 Web 介面按「匯入本機 JSON」。

也可以：

```bash
python scripts/import_local_json.py
```

## 3. Google Drive 設定

建立 Google Cloud Service Account，啟用 Google Drive API，並把 Drive 專案資料夾分享給該 Service Account。

`.env`：

```env
GOOGLE_DRIVE_ROOT_FOLDER_ID=你的根資料夾ID
GOOGLE_SERVICE_ACCOUNT_FILE=/run/secrets/google-service-account.json
```

Google Drive 建議結構：

```text
RPG-Monster-Factory/
├── inbox/
├── monsters/
└── exports/
```

按 Web 介面的「同步 Google Drive」即可把 Drive `inbox` 內的 JSON 匯入。

## 4. 操作流程

1. 匯入怪物 JSON
2. 開啟怪物頁
3. 上傳角色預覽圖
4. 核准角色
5. 上傳 `idle / attack / hit / die` sprite sheet
6. 按「切割 Frames」
7. 在 `data/monsters/<怪物>/frames/` 取得拆幀
8. manifest.json 會記錄進度

## 5. API

```text
GET  /api/monsters
POST /api/import/local
POST /api/import/gdrive
GET  /api/monsters/{slug}
POST /api/monsters/{slug}/reference/upload
POST /api/monsters/{slug}/reference/approve
POST /api/monsters/{slug}/actions/{action}/sheet
POST /api/monsters/{slug}/actions/{action}/split
```

## 6. GitHub

```bash
git init
git add .
git commit -m "Initial RPG Monster Factory MVP"
git branch -M main
git remote add origin <YOUR_REPOSITORY_URL>
git push -u origin main
```

## 7. 安全

不要提交：

- `.env`
- Service Account JSON
- API keys
- 大量生成圖片

這些已列入 `.gitignore`。
