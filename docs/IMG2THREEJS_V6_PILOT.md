# 蒼蘭訣 RPG — img2threejs V6 3D Pilot

## 目標

將 `img2threejs` 作為既有 2D Sprite / Monster pipeline 的 **3D 分支**，先驗證場景與道具，不取代目前 Sprite 規格。

第一個 Pilot：**第一章・司命殿場景**。

## 原則

- 既有 SPEC v1.0A、Character Master、Battle 2×3 規格保持不變。
- 2D Sprite 仍輸出完整 #00FF00 綠幕 sheet，anim.json 負責 frameCount / hitFrame。
- 3D 分支只處理場景、建築、props、武器法器、可選怪物原型。
- 第一階段不把正式主角人物 likeness 綁死在 img2threejs。
- 所有 3D 產物必須可版本控制、可回復、可人工覆寫。

## V6 Pipeline

```text
Master Design
  ├─ 2D Sprite Pipeline
  │   ├─ concept
  │   ├─ sprite sheet
  │   └─ anim.json
  │
  └─ 3D Reconstruction Pipeline
      ├─ reference image
      ├─ visual analysis / detail inventory
      ├─ object-sculpt-spec.json
      ├─ Three.js procedural reconstruction
      ├─ browser review
      ├─ quality gate
      ├─ screenshots / optional GLB handoff
      └─ Godot scene integration
```

## Pilot A：司命殿

### 輸入

建議至少準備：

1. 司命殿主視角概念圖
2. 建築正面或 3/4 視角
3. 若可取得：側面 / 背面補圖
4. 場景重要物件獨立圖：燈籠、命簿架、石燈、桌案、法陣、門、橋等

### Stage 1 — Intake

建立場景資產清單：

```text
CH1_SCENE_SIMING_HALL
CH1_PROP_LANTERN_01
CH1_PROP_BOOK_RACK_01
CH1_PROP_ALTAR_01
CH1_PROP_GATE_01
CH1_PROP_STONE_LAMP_01
```

每個資產記錄：

- assetId
- sourceImage
- objectType
- confidence
- approximateDimensions
- visibleSides
- hiddenGeometryAssumption
- materialNotes
- interactionNotes

### Stage 2 — Reconstruction

每個可重建物件生成：

```text
assets3d/<assetId>/
  reference/
  object-sculpt-spec.json
  createObject.ts
  review/
  metadata.json
```

Three.js 物件優先保留：

- pivot
- collider hints
- interaction socket
- door / lid / rotating part hierarchy
- material separation

### Stage 3 — Scene Assembly

輸出：

```text
scenes/ch1_siming_hall/
  scene.ts
  scene-layout.json
  navmesh-hints.json
  collision-hints.json
  occlusion-hints.json
```

對應既有地圖三層概念：

- walkable → navmesh / walkable polygons
- obstacle → collider layer
- occlusion → geometry / transparency / camera occlusion rules

### Stage 4 — Review

建立 comparison sheet：

```text
Reference | Render Front | Render 3/4 | Render Side | Top
```

Quality Gate：

- 主體輪廓接近參考圖
- 建築比例無明顯錯位
- 門窗 / 屋簷 / 台階位置合理
- 玩家可走區與障礙分離
- 無穿模到主要互動區
- 主要 props 可被獨立選取
- camera occlusion 不阻擋玩家

## Pilot B：道具

第二優先：

- 司命玉筆
- 命簿
- 石燈
- 寶箱
- 法陣祭壇

這些物件比人物更適合先驗證 reconstruction-by-code。

## Pilot C：Sprite 一致性實驗

3D 不直接取代 Sprite，而作為方向一致性約束：

```text
3D prototype
  ↓ fixed camera
front / back / left / right / 8-dir render
  ↓
2D cleanup / stylization
  ↓
existing sprite pipeline
```

驗證項目：

- 身高比例
- 武器長度
- 左右飾品
- 服裝輪廓
- 頭身比例
- 腳底錨點

## Repository State

新增建議狀態檔：

```text
.v6-assets/state.json
```

範例：

```json
{
  "pipelineVersion": "6.0-pilot",
  "chapter": 1,
  "assetId": "CH1_SCENE_SIMING_HALL",
  "stage": "intake",
  "status": "pending_reference",
  "lastValidatedStage": null,
  "qualityGate": {
    "passed": false,
    "score": null
  }
}
```

## 不做事項（第一階段）

- 不直接改掉既有 Sprite 規格。
- 不把 img2threejs 當 photogrammetry / 真實 mesh extraction。
- 不要求單張圖準確推回不可見背面。
- 不先做東方青蒼 / 小蘭花正式寫實 3D 臉部。
- 不在未通過 comparison gate 前送進 Godot 正式場景。

## 驗收條件

Pilot A 完成需同時符合：

1. 司命殿至少 1 個主建築 + 5 個 props 可在瀏覽器互動檢視。
2. 場景具可走 / 障礙 / 遮擋三類資料。
3. 主要物件具 assetId 與 metadata。
4. 至少提供 front / 3-4 / side / top 四種 review render。
5. comparison sheet 可人工核准或退回。
6. state.json 可記錄目前 stage，失敗後可續跑。
7. 不破壞現有 2D Monster / Sprite 流程。

## 下一步

1. 把司命殿目前核准概念圖放入 `assets3d/CH1_SCENE_SIMING_HALL/reference/`。
2. 安裝 / vendor `img2threejs` skill 給 Codex。
3. 建立第一份 `object-sculpt-spec.json`。
4. 生成 `createObject.ts` 與 browser preview。
5. 做第一版 comparison sheet。
6. 通過後再拆出 props 與 Godot collision / occlusion handoff。
