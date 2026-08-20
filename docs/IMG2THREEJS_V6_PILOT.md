# 蒼蘭訣 RPG — World Pipeline V6 Pilot

## 0. 定位

V6 不再只把 `img2threejs` 當作單一 3D 實驗，而是改成 **WorldClaw-style World Planning + img2threejs Asset Reconstruction + Godot Runtime** 的三段式世界建置管線。

第一個 Pilot：**第一章・司命殿**。

> WorldClaw 目前主要提供研究方法與架構方向，因此 V6 第一階段採用其 coarse-to-fine、structured world specification、region-aware terrain、instance-level asset、render-review agent 等思想，自行建立可落地到 Godot 的資料管線；之後若官方完整 inference/code/model 釋出，再替換 world-generation backend，不改 Godot handoff schema。

---

## 1. 核心目標

### 1.1 解決目前地圖問題

- 看起來可走，但實際 collision 不合理。
- 障礙、遮擋、可走區靠人工補丁，容易互相衝突。
- 草地遇敵區、任務區、NPC 區缺少統一 semantic region 定義。
- 大型背景圖很漂亮，但無法自然拆成可互動遊戲場景。
- 角色與地圖比例容易失真。
- 建築、樹、橋、門等物件不是 instance，難以重用、修改、做碰撞或互動。

### 1.2 V6 的結果必須是「能玩的世界資料」

不是只生成一張圖或一個可旋轉 3D demo，而是至少產生：

```text
CH1_WORLD_SIMING/
  world.json
  regions.json
  terrain.json
  assets.json
  navigation.json
  collision.json
  occlusion.json
  encounters.json
  interactions.json
  spawnpoints.json
  qa-report.json
```

並可轉進 Godot。

---

## 2. V6 總體架構

```text
Master Design / Chapter Design
        ↓
World Spec Agent
        ↓
Structured World Spec
        ↓
WorldClaw-style Planner
        ↓
Semantic Layout + Terrain + Regions
        ↓
Asset Resolver
   ┌───────────────┬────────────────┬──────────────────┐
   │ Existing      │ img2threejs    │ Hunyuan3D /     │
   │ game assets   │ reconstruction │ future backend   │
   └───────────────┴────────────────┴──────────────────┘
        ↓
Scene Assembly
        ↓
Navigation / Collision / Occlusion
        ↓
Encounter / Quest / NPC / Interaction Zones
        ↓
Godot Handoff
        ↓
Render QA Agent
        ↓
Playable Review
```

---

## 3. 分工原則

### WorldClaw-style Planner

負責：

- 世界區域規劃
- 空間關係
- terrain / elevation
- 道路 / 橋 / 水域
- 大型建築 placement
- semantic regions
- coarse-to-fine 世界拆解
- 全域一致性

### img2threejs

負責：

- 主建築 prototype
- 門、橋、祭壇、命簿架、燈籠等 props
- 可編輯 Three.js hierarchy
- pivot / socket / collider hints
- 參考圖 → 可版本控制的程序化幾何

### Existing 2D Pipeline

繼續負責：

- 角色立繪
- Overworld Sprite
- Battle Sprite
- Monster Sprite
- UI / icons / inventory art

### Godot

最終負責：

- Runtime scene
- NavigationRegion / NavigationMesh
- StaticBody / CollisionShape
- Occluder / transparency logic
- Character movement
- Encounter triggers
- Quest triggers
- NPC / shop / door interaction
- Save / Load state

---

## 4. 第一章 Pilot：司命殿世界規劃

世界 ID：

```text
CH1_WORLD_SIMING
```

### 4.1 第一版區域

```text
CH1_WORLD_SIMING
├─ R01_MAIN_HALL          主殿
├─ R02_FRONT_COURT        前庭
├─ R03_GARDEN_EAST        東側花園
├─ R04_POND               水池
├─ R05_STONE_BRIDGE       石橋
├─ R06_BOOK_ARCHIVE       命簿區
├─ R07_SPIRIT_GARDEN      靈草 / 草地遇敵區
├─ R08_TRAINING_AREA      教學 / 戰鬥觸發區
├─ R09_NPC_SERVICE        NPC / 商店 / 任務區
└─ R10_CHAPTER_EXIT       章節出口
```

### 4.2 空間關係

第一版關係：

```text
CHAPTER_ENTRY
   ↓
FRONT_COURT
   ↓
MAIN_HALL
   ├─ BOOK_ARCHIVE
   └─ NPC_SERVICE

FRONT_COURT
   ↓ east
GARDEN_EAST
   ├─ POND
   ├─ STONE_BRIDGE
   └─ SPIRIT_GARDEN

SPIRIT_GARDEN
   ↓
TRAINING_AREA
   ↓
CHAPTER_EXIT
```

玩家不能只靠背景圖自由穿越；每個 region 都要明確知道入口、出口、阻擋邊界、互動與遮擋規則。

---

## 5. `world.json`

建議 schema：

```json
{
  "worldId": "CH1_WORLD_SIMING",
  "chapter": 1,
  "name": "司命殿",
  "version": "6.0-pilot",
  "coordinateSystem": "godot-3d-y-up",
  "playerScaleMeters": 1.0,
  "regions": [
    "R01_MAIN_HALL",
    "R02_FRONT_COURT",
    "R03_GARDEN_EAST",
    "R04_POND",
    "R05_STONE_BRIDGE",
    "R06_BOOK_ARCHIVE",
    "R07_SPIRIT_GARDEN",
    "R08_TRAINING_AREA",
    "R09_NPC_SERVICE",
    "R10_CHAPTER_EXIT"
  ],
  "entryRegion": "R02_FRONT_COURT",
  "exitRegion": "R10_CHAPTER_EXIT"
}
```

---

## 6. `regions.json`

每一區至少有：

```json
{
  "regionId": "R07_SPIRIT_GARDEN",
  "type": "encounter_grass",
  "walkable": true,
  "outdoor": true,
  "elevationRange": [0.0, 1.5],
  "connectsTo": [
    "R03_GARDEN_EAST",
    "R08_TRAINING_AREA"
  ],
  "tags": [
    "grass",
    "encounter",
    "chapter1"
  ],
  "encounterProfile": "CH1_GRASS_A",
  "occlusionMode": "tree_canopy_fade"
}
```

Region types 第一版：

- `building`
- `courtyard`
- `garden`
- `water`
- `bridge`
- `archive`
- `encounter_grass`
- `battle_trigger`
- `npc_service`
- `chapter_exit`

---

## 7. Terrain Layer

### 7.1 不把整張場景圖當地形

V6 改為：

```text
semantic regions
      ↓
base elevation
      ↓
region-aware height field
      ↓
paths / stairs / bridges
      ↓
water mask
      ↓
walkability
```

### 7.2 `terrain.json`

最低資料：

```json
{
  "worldId": "CH1_WORLD_SIMING",
  "baseHeight": 0.0,
  "waterLevel": -0.25,
  "maxPlayableSlopeDeg": 28,
  "layers": [
    "ground",
    "stone_path",
    "grass",
    "water",
    "bridge",
    "stairs"
  ]
}
```

### 7.3 Terrain Gate

- 道路必須連通主要區域。
- 石橋兩端必須接地。
- 水池不可被 navmesh 覆蓋。
- 階梯坡度與玩家 controller 相容。
- 不可產生看似可走但實際被 invisible wall 擋住的主要路徑。

---

## 8. 三層地圖正式化

舊概念：

```text
可走 / 障礙 / 遮擋
```

V6 仍保留，但改為資料驅動。

### 8.1 Navigation

輸出：

```text
navigation.json
```

內容：

- walkable polygon / navmesh hints
- slope limits
- stairs / bridge traversal
- off-mesh links（若需要）
- blocked regions

### 8.2 Collision

輸出：

```text
collision.json
```

物件分類：

- solid_building
- wall
- tree_trunk
- rock
- railing
- water_boundary
- prop_collision
- invisible_safety_boundary

### 8.3 Occlusion

輸出：

```text
occlusion.json
```

模式：

- `none`
- `fade_when_player_behind`
- `roof_hide_when_inside`
- `tree_canopy_fade`
- `foreground_cutaway`

這一層專門解決人物走到樹後、屋簷後、門內、建築內時畫面被完全遮住的問題。

---

## 9. Encounter Layer

### 9.1 草地遇敵不再寫死在 Tile ID

改為 semantic region：

```json
{
  "encounterId": "CH1_GRASS_A",
  "regionId": "R07_SPIRIT_GARDEN",
  "enabled": true,
  "stepChance": 0.08,
  "cooldownSeconds": 6,
  "monsterPool": [
    "CH1_MON_FLOWER_DEMON",
    "CH1_MON_INK_SPIRIT",
    "CH1_MON_INK_BUTTERFLY"
  ]
}
```

實際怪物 ID 以目前正式怪物表為準，這裡只定義 pipeline 形式。

### 9.2 未來可擴充

- 時段
- 天氣
- 任務進度
- Boss cleared
- 玩家等級
- 特殊事件

---

## 10. Asset Registry

### 10.1 資產 ID

第一批：

```text
CH1_BLD_SIMING_MAIN_HALL
CH1_PROP_LANTERN_01
CH1_PROP_BOOK_RACK_01
CH1_PROP_ALTAR_01
CH1_PROP_GATE_01
CH1_PROP_STONE_LAMP_01
CH1_PROP_STONE_BRIDGE_01
CH1_PROP_DESK_01
CH1_PROP_SCROLL_01
```

### 10.2 `assets.json`

每個 instance 必須保存：

- assetId
- source
- generator
- transform
- bounding box
- collider type
- pivot
- sockets
- interaction flags
- occlusion flags
- LOD hint
- material set
- confidence

### 10.3 generator 值

```text
existing
img2threejs
hunyuan3d
manual
procedural
future_worldclaw
```

這樣未來 WorldClaw/Hunyuan backend 換掉，scene schema 不需要改。

---

## 11. img2threejs 分支

每個需要重建的物件：

```text
assets3d/<assetId>/
  reference/
  object-sculpt-spec.json
  createObject.ts
  metadata.json
  review/
```

優先處理：

1. 主殿
2. 石橋
3. 命簿架
4. 祭壇
5. 石燈
6. 燈籠
7. 大門

第一階段不拿正式人物臉部當主要驗證目標。

---

## 12. Scene Assembly

建議輸出：

```text
worlds/ch1_siming/
  spec/
    world.json
    regions.json
    terrain.json
    assets.json
    navigation.json
    collision.json
    occlusion.json
    encounters.json
    interactions.json
    spawnpoints.json
  generated/
    scene-layout.json
    godot-import/
  review/
    top.png
    front.png
    3q.png
    side.png
    nav-overlay.png
    collision-overlay.png
    occlusion-overlay.png
    qa-report.json
```

---

## 13. Godot Handoff

### 13.1 目標節點架構

```text
CH1_WORLD_SIMING
├─ Terrain
├─ Navigation
├─ Buildings
├─ Props
├─ Collision
├─ Occlusion
├─ EncounterZones
├─ InteractionZones
├─ NPCSpawns
├─ MonsterSpawns
├─ QuestTriggers
└─ CameraHelpers
```

### 13.2 Importer

後續建立：

```text
tools/godot_world_importer/
```

工作：

```text
world json bundle
      ↓
validation
      ↓
Godot scene generation
      ↓
NavigationRegion
StaticBody
Area3D triggers
Occluders
Spawn markers
      ↓
.tscn
```

Importer 要優先資料驅動，避免 Godot 端人工重畫整張地圖。

---

## 14. Render QA Agent

V6 QA 不只比「漂亮不漂亮」。

### 14.1 Visual QA

- 建築是否符合 Master Design。
- 主要比例是否正確。
- 材質與色彩是否符合章節設定。
- props 是否浮空、穿模、插牆。
- 橋是否接地。

### 14.2 Gameplay QA

- Entry → Main Hall 是否可走。
- Main Hall → Garden 是否可走。
- 草地遇敵區是否有完整進出路徑。
- 玩家是否能卡進樹、欄杆、牆角。
- 重要 NPC 是否站在可達位置。
- 章節出口是否可到達。
- Camera 是否被屋頂 / 樹冠永久遮擋。

### 14.3 Overlay Review

每次生成都附：

```text
Beauty Render
Navmesh Overlay
Collision Overlay
Occlusion Overlay
Encounter Overlay
```

這比只看背景圖更容易抓錯誤。

---

## 15. State / Resume

延續 V6 state 概念，但提升到 world-level：

```text
.v6-world/state.json
```

範例：

```json
{
  "pipelineVersion": "6.0-pilot",
  "worldId": "CH1_WORLD_SIMING",
  "stage": "world_spec",
  "status": "in_progress",
  "lastValidatedStage": "chapter_design",
  "backend": {
    "worldPlanner": "worldclaw-style-local",
    "assetGenerator": "mixed",
    "runtime": "godot"
  },
  "qualityGate": {
    "visualPassed": false,
    "gameplayPassed": false,
    "score": null
  }
}
```

Stages：

```text
chapter_design
world_spec
semantic_layout
terrain
asset_resolution
scene_assembly
navigation
collision
occlusion
encounters
runtime_import
visual_qa
gameplay_qa
approved
```

---

## 16. Coarse-to-Fine 執行順序

### Phase A — World Skeleton

只做：

- regions
- adjacency
- scale
- terrain
- entry / exit

驗收：玩家可從入口走到出口。

### Phase B — Major Structures

加入：

- 主殿
- 水池
- 石橋
- 大門
- 主要道路

驗收：碰撞與遮擋正確。

### Phase C — Gameplay Regions

加入：

- 草地遇敵區
- NPC 區
- 任務觸發
- 教學 / 戰鬥區

驗收：實際可玩流程通過。

### Phase D — Props / Art Polish

加入：

- 燈籠
- 石燈
- 命簿架
- 花草
- 桌案
- 法陣

驗收：畫面接近 Master Design。

### Phase E — QA / Optimization

- LOD
- draw calls
- collider simplification
- occlusion tuning
- navigation cleanup
- mobile performance check

---

## 17. 第一章實際遊玩驗收路徑

Pilot 必須至少走通：

```text
出生點
↓
司命殿前庭
↓
司命 NPC / 任務
↓
花園
↓
草地遇敵
↓
戰鬥
↓
回主殿 / 互動
↓
章節出口
```

這條路徑未通過，不視為「地圖完成」。

---

## 18. 不破壞既有規格

V6 不改以下正式規則：

- SPEC v1.0A ID 不任意更動。
- 2D Sprite 綠幕交付規格保留。
- `anim.json` 仍是動畫 frame / hitFrame 唯一正式來源。
- Character Master / Battle 2×3 規格保留。
- World V6 是新增的世界資料層，不取代角色素材規格。

---

## 19. WorldClaw 導入策略

### 現在

採用其方法：

- structured world planning
- semantic regions
- coarse-to-fine
- terrain-aware asset placement
- editable instance assets
- render-based correction

### 官方 backend 可用後

增加 adapter：

```text
adapters/worldclaw/
  prompt_adapter.py
  scene_adapter.py
  asset_adapter.py
  terrain_adapter.py
  godot_export_adapter.py
```

WorldClaw 只替換：

```text
World Planner / Terrain / Asset Composition backend
```

不改：

```text
world.json
regions.json
navigation.json
collision.json
occlusion.json
encounters.json
Godot importer
```

---

## 20. Sprint 規劃

### Sprint V6.1 — World Spec

交付：

- `world.json`
- `regions.json`
- `terrain.json`
- 第一版 top-down semantic layout

Acceptance：

- 10 個 region ID 固定。
- Entry / Exit 連通。
- 主路徑沒有 dead-end。

### Sprint V6.2 — Navigation / Collision Prototype

交付：

- `navigation.json`
- `collision.json`
- Godot greybox

Acceptance：

- 玩家可完整走通第一章主路徑。
- 不可穿牆 / 穿水 / 穿主要 props。

### Sprint V6.3 — Major 3D Assets

交付：

- 主殿
- 石橋
- 大門
- 水池邊界
- 第一批 props

Acceptance：

- 所有 major asset 有 assetId。
- collider / pivot / transform 可重建。

### Sprint V6.4 — Occlusion / Encounter / Interaction

交付：

- `occlusion.json`
- `encounters.json`
- `interactions.json`

Acceptance：

- 玩家被建築或樹遮住時有合理處理。
- 草地 encounter 可以正常觸發。
- NPC / 門 / 任務區可互動。

### Sprint V6.5 — Art + QA

交付：

- comparison sheets
- overlay renders
- `qa-report.json`
- playable demo build

Acceptance：

- Visual QA pass。
- Gameplay QA pass。
- 第一章主路徑可完成。

---

## 21. 第一批檔案 TODO

下一步直接建立：

```text
worlds/ch1_siming/spec/world.json
worlds/ch1_siming/spec/regions.json
worlds/ch1_siming/spec/terrain.json
worlds/ch1_siming/spec/assets.json
worlds/ch1_siming/spec/navigation.json
worlds/ch1_siming/spec/collision.json
worlds/ch1_siming/spec/occlusion.json
worlds/ch1_siming/spec/encounters.json
worlds/ch1_siming/spec/interactions.json
worlds/ch1_siming/spec/spawnpoints.json
.v6-world/state.json
```

接著才把核准的司命殿概念圖加入：

```text
assets3d/CH1_BLD_SIMING_MAIN_HALL/reference/
```

並開始第一個 img2threejs reconstruction。

---

## 22. V6 Pilot 最終驗收

必須同時達成：

1. 第一章世界不是單張背景，而是 10 個 semantic regions 組成。
2. Entry → 主殿 → 花園 → 遇敵區 → Exit 可走通。
3. Navigation / Collision / Occlusion 三層資料彼此獨立。
4. 草地 encounter 不依賴硬編碼 Tile ID。
5. 至少 1 個主建築 + 5 個 props 是獨立 asset instance。
6. scene 可重新由 JSON bundle 生成，而不是只能人工維護。
7. Godot 可 import 並產生可玩 greybox。
8. Visual QA 與 Gameplay QA 都有 report。
9. pipeline 中斷後可由 state.json 續跑。
10. 不破壞既有 2D Sprite / Monster / anim.json 規格。

完成這 10 項後，才把 V6 World Pipeline 擴展到第二章水雲天。