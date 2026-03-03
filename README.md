# beamHO-bench

Interactive 3D Spatial Visualization — 以國立臺北大學校園為場景的 3D 互動式空間視覺化平台。

---

## 目錄 / Table of Contents

- [繁體中文](#繁體中文)
- [中文文件中心（推薦）](#中文文件中心推薦)
- [English](#english)

---

# 繁體中文

## 簡介

beamHO-bench 是一個基於 Three.js 的 3D 互動場景視覺化專案，以國立臺北大學（NTPU）校園為場景，搭配 UAV（無人機）模型，提供即時的 3D 場景瀏覽與互動控制。

技術架構採用 **React + TypeScript + Vite**，透過 **React Three Fiber** 將 Three.js 整合進 React 生態系，實現宣告式的 3D 場景管理。

## 中文文件中心（推薦）

若你要快速掌握整體系統，建議先看這裡：

1. `docs/zh-TW/README.md`（文件總索引）
2. `docs/zh-TW/01-overview.md`（專案全貌與模擬模式）
3. `docs/zh-TW/02-simcore-architecture.md`（SimCore 與換手架構）
4. `docs/zh-TW/03-real-trace-and-tle.md`（TLE/real-trace/每日更新流程）
5. `docs/zh-TW/04-testing-and-validation.md`（測試、驗證、CI、artifact）
6. `docs/zh-TW/05-development-guidelines.md`（開發流程、拆分與架構檢視規範）

## SDD 開發現況（2026-03-03）

目前已進入 SDD 實作階段，已完成：

1. 初始基線 commit：`a3adad6`（current root commit）
2. M0/M1/M2 核心能力：
   - Case9 解析軌道、multi-beam、baseline 執行、KPI 累積與匯出
   - source trace 匯出（參數來源可追溯）
3. M3 核心能力：
   - `cho`、`mc-ho` full-fidelity baseline（預設）+ simplified 模式（明確非預設）
   - multi-baseline batch comparison runner（可匯出 comparison summary + per-baseline timeseries）
   - HUD `ComparisonChart`（可視化各 baseline KPI 對照）
   - baseline comparison 匯出可附帶 small-scale comparison template（固定 seed/tick/model sweep 的重現模板）
4. M4 初版能力：
   - `starlink-like`、`oneweb-like` real-trace mode（TLE/OMM + `satellite.js` SGP4）
   - 保留 Kepler fallback（單顆衛星傳播失敗時不會中斷整體模擬）
   - real-trace multi-baseline comparison smoke（`max-rsrp`/`max-elevation`/`max-remaining-time`）納入驗證
   - source-trace 與 manifest（含 `tle_snapshot_utc`）在 paper-baseline/real-trace 均有整合測試覆蓋
5. 論文與標準持續採 metadata 鎖定（可公開追溯）：
   - `papers/sdd-required/papers-index.md`
   - `papers/sdd-required/papers-lock.json`
   - `papers/standards/standards-index.md`
   - `papers/standards/standards-lock.json`
6. 每個開發階段均執行 stage gate（`validate:stage`），避免重構回歸與追溯缺口
7. pending closure packages（D1~D5）已完成並 closure-tracked：
   - `sdd/pending/beamHO-bench-gap-closure-sdd.md`
   - `sdd/completed/beamHO-bench-gap-closure-closure.md`
   - `sdd/pending/beamHO-bench-small-scale-validation-sdd.md`
   - `sdd/completed/beamHO-bench-small-scale-validation-closure.md`
8. 最新驗證套件（`validate:val-suite`）為 58 case，blocking/non-blocking checks 全數通過，並含 cross-mode + baseline-parameter-envelope + repro-bundle contract guard
9. SDD 完成狀態索引：`sdd/completed/beamHO-bench-implementation-status.md`
10. SDD 文件已分層：`sdd/completed/`（已實作）、`sdd/pending/`（closure-tracked pending package）、`sdd/backlog/`（長期議題）

## 研究來源與版權規則（必讀）

為避免公開 repo 的版權風險，專案採以下規則：

1. 不將第三方全文檔納入版控：publisher PDF、3GPP ZIP/DOC/DOCX 一律不 commit。
2. 只在 repo 保存追溯 metadata：`sourceId`、`DOI/官方 URL`、`SHA256`、版本檔名。
3. 程式碼關鍵邏輯必須註解來源 `sourceId`（論文或標準）。
4. 實驗輸出必須包含 `source-trace.json`，可回查本次參數對應來源。
5. `.gitignore` 已預設攔截 `papers/` 下全文二進位檔，只保留 `md/json/yaml/txt/bib` 類型。

## 新增論文或標準文件流程

每次新增來源請照這個流程：

1. 下載檔案到本機工作區（可不在 git 追蹤範圍內）。
2. 計算雜湊：`sha256sum <file>`
3. 更新對應 lock/index：
   - 論文：`papers/sdd-required/papers-lock.json` + `papers/sdd-required/papers-index.md`
   - 標準：`papers/standards/standards-lock.json` + `papers/standards/standards-index.md`
4. 在追溯系統新增 `sourceId`：
   - `src/config/references/paper-sources.json`
   - `src/config/paper-profiles/*.sources.json`
5. 在關鍵程式邏輯補來源註解（`Source: <sourceId>`）。
6. 確認全文檔未被追蹤：`git status` 不應出現 PDF/ZIP/DOC/DOCX。

## 快速開始

### 環境需求

- **Git LFS** — 本專案使用 Git LFS 管理 3D 模型檔案（`.glb`），必須先安裝才能正確 clone
- **Node.js** >= 18
- **npm** >= 9

### 安裝 Git LFS

3D 模型檔案（共約 17.7 MB）透過 Git LFS 儲存，未安裝 LFS 直接 clone 只會拿到 pointer 檔案，場景將無法載入。

```bash
# macOS
brew install git-lfs

# Ubuntu / Debian
sudo apt install git-lfs

# Windows（已內建於 Git for Windows，若未啟用則執行）
git lfs install
```

安裝後執行一次 `git lfs install` 啟用，之後 clone 即會自動下載 LFS 檔案：

```bash
git clone <repo-url>
```

若已經 clone 但缺少 LFS 檔案，可補拉：

```bash
git lfs pull
```

### 安裝與執行

```bash
# 1. 安裝依賴
npm install

# 2. 啟動開發伺服器（預設 http://localhost:3000）
npm run dev

# 3. 建置生產版本
npm run build

# 4. 預覽生產版本
npm run preview
```

開發伺服器啟動後會自動開啟瀏覽器，伺服器綁定 `0.0.0.0:3000`，同網路的裝置也可透過區域 IP 存取。

### 可用指令

| 指令 | 說明 |
|---|---|
| `npm run dev` | 啟動 Vite 開發伺服器（HMR 熱更新） |
| `npm run build` | TypeScript 型別檢查 + Vite 生產建置 |
| `npm run preview` | 本地預覽 `dist/` 建置產物 |
| `npm run lint` | 執行 TypeScript 型別檢查（不輸出檔案） |
| `npm run test:sim` | 執行 SimCore 正式測試層（Unit + Integration），並輸出 `dist/sim-test-summary.json` |
| `npm run sync:tle-fixtures` | 從 `../tle_data` 同步最新 Starlink/OneWeb 軌道元素 sample |
| `npm run bench:cross-mode` | 執行 cross-mode reproducible benchmark pack（`case9-default` + `starlink-like` + `oneweb-like`），輸出 `dist/cross-mode-benchmark` 預設 artifact |
| `npm run bundle:repro-v1` | 匯出 Repro Bundle v1（整合 cross-mode + baseline-parameter-envelope）到 `dist/repro-bundle-v1` |
| `npm run validate:rigor` | 執行學術追溯驗證（source map、ASSUME、Provenance、FR018 覆蓋） |
| `npm run validate:structure` | 結構驗證（單檔行數門檻與 scenario helper 去重回歸） |
| `npm run validate:repo-policy` | 驗證 FR-024 版控政策（`papers/` 僅允許 metadata 類型且 `.gitignore` 規則完整） |
| `npm run validate:val-suite` | 執行核心 `VAL-*` 套件並做 check gate（含 `runtime-parameter-audit` blocking 檢查），並輸出 `dist/validation-suite.json/csv`、`dist/validation-gate-summary.json`、`dist/runtime-parameter-audit-summary.json` |
| `npm run validate:stage` | 階段驗證一鍵執行（lint + build + test:sim + validate:rigor + validate:structure + validate:repo-policy + validate:val-suite） |

#### Cross-mode benchmark workflow

```bash
npm run bench:cross-mode
```

若需自訂輸出目錄：

```bash
npm run bench:cross-mode -- --out_dir dist/my-cross-mode
```

預設會輸出：
1. `cross-mode-plan_<tupleDigest>.json`
2. `cross-mode-run_<artifactDigest>.json`
3. `cross-mode-summary_<artifactDigest>.json`

#### Repro bundle v1 workflow

```bash
npm run bundle:repro-v1
```

若需自訂輸出目錄：

```bash
npm run bundle:repro-v1 -- --out_dir dist/my-repro-bundle
```

預設會輸出：
1. `repro-bundle-v1_<artifactDigest>.json`
2. `repro-bundle-v1-manifest_<artifactDigest>.json`
3. `cross-mode-run_<artifactDigest>.json`
4. `baseline-parameter-envelope_<tupleDigest>.json`

### 模組檔案行數政策（`validate:structure`）

`validate:structure` 對 `src/sim`、`src/hooks`、`src/config/paper-profiles` 採用以下規則：

1. `<= 500` 行：正常（不警告）
2. `501-650` 行：警告（建議拆分，但不阻擋階段驗證）
3. `> 650` 行：失敗（必須拆分）

此政策目標是避免過早拆分，同時確保 SimCore 主要模組長期可維護。

### Real-trace 資料同步

若你每天更新了 `tle_data/`，在啟動模擬前請先執行：

```bash
npm run sync:tle-fixtures
```

這會更新：

- `src/data/tle/starlink-sample.json`
- `src/data/tle/oneweb-sample.json`

### Real-trace 傳播器模式

- 預設模式：`kepler-fallback`（以 TLE mean elements 做決定性傳播）
- 可設定：`VITE_ORBIT_PROPAGATOR=sgp4`
  - 使用 `satellite.js` 的 true SGP4 傳播（以 fixture 內 OMM 欄位建構）
  - 若個別衛星傳播失敗，該顆會自動回退到 `kepler-fallback`（不中斷整體實驗）

## 專案結構

```
beamHO-bench/
├── index.html                  # HTML 入口，載入 /src/main.tsx
├── package.json                # 專案設定與依賴管理
├── tsconfig.json               # TypeScript 設定（noEmit，僅型別檢查）
├── vite.config.ts              # Vite 建置設定（alias、dev server、sourcemap）
│
├── public/                     # 靜態資源（Vite 直接複製到 dist/）
│   ├── models/
│   │   └── uav.glb             # UAV 無人機 3D 模型（9.9 MB）
│   └── scenes/
│       └── NTPU.glb            # 國立臺北大學校園 3D 場景模型（7.8 MB）
│
├── src/
│   ├── main.tsx                # 應用程式入口：掛載 React 到 DOM
│   ├── App.tsx                 # 根元件（未來擴充 routing / provider 的掛載點）
│   │
│   ├── config/
│   │   └── ntpu.config.ts      # 集中管理場景設定（觀測站座標、模型路徑、相機參數）
│   │
│   ├── styles/
│   │   └── main.scss           # 全域樣式（CSS reset、全螢幕佈局）
│   │
│   └── components/
│       ├── scene/              # 3D 場景元件
│       │   ├── MainScene.tsx   # 主場景容器：Canvas、相機、燈光、場景組合
│       │   ├── NTPUScene.tsx   # NTPU 校園模型載入與材質處理
│       │   └── UAV.tsx         # UAV 無人機模型載入
│       │
│       └── ui/                 # UI 元件
│           └── Starfield.tsx   # CSS 星空背景動畫
│
└── dist/                       # 建置輸出（.gitignore 忽略）
```

## 技術架構

### 渲染管線

```
index.html
  → src/main.tsx          React 掛載點
    → App.tsx             根元件
      → MainScene.tsx     Canvas + 相機 + 燈光 + 場景組合
        ├── Starfield     CSS 星空背景（純 CSS animation，零 JS 開銷）
        ├── NTPUScene     校園 3D 模型（GLB → MeshStandardMaterial）
        └── UAV           無人機 3D 模型（GLB + SkeletonUtils clone）
```

### 核心技術棧

| 技術 | 版本 | 用途 |
|---|---|---|
| **React** | 19.2 | UI 框架 |
| **TypeScript** | 5.9 | 型別安全 |
| **Vite** | 7.1 | 開發伺服器與建置工具 |
| **Three.js** | 0.180 | WebGL 3D 渲染引擎 |
| **React Three Fiber** | 9.4 | Three.js 的 React 宣告式封裝 |
| **Drei** | 10.7 | R3F 常用工具集（OrbitControls、PerspectiveCamera、useGLTF 等） |
| **Sass** | 1.93 | CSS 預處理器 |

### Three.js 如何運作

本專案透過 **React Three Fiber (R3F)** 將 Three.js 整合進 React：

1. **Canvas** (`MainScene.tsx`) — R3F 的 `<Canvas>` 元件建立 WebGL 渲染器，設定 ACES Filmic 色調映射、抗鋸齒、陰影等。

2. **相機** — 使用 Drei 的 `<PerspectiveCamera>`，初始位置從上方俯瞰（Y=400, Z=500），FOV 60 度，可視範圍 0.1 ~ 10000。

3. **軌道控制** — `<OrbitControls>` 提供滑鼠拖曳旋轉、滾輪縮放、阻尼效果，限制仰角不超過水平面。

4. **燈光系統**：
   - `hemisphereLight` — 天空/地面環境光
   - `ambientLight` — 全域環境補光
   - `directionalLight` — 主方向光（正上方），啟用 4096x4096 陰影貼圖

5. **模型載入** — 使用 Drei 的 `useGLTF` hook 載入 `.glb` 模型，搭配 `<Suspense>` 處理非同步載入狀態。

### 3D 模型

#### 校園場景 — `public/scenes/NTPU.glb`（7.8 MB）

- 國立臺北大學三峽校區的 3D 場景模型
- 載入後自動將 `MeshBasicMaterial` 轉換為 `MeshStandardMaterial`，使其能接受光照與陰影
- 透過 `useGLTF.preload()` 預載入，減少初次渲染延遲
- 設定由 `ntpu.config.ts` 集中管理（路徑、位置、縮放、旋轉）

#### UAV 無人機 — `public/models/uav.glb`（9.9 MB）

- 無人機 3D 模型，使用 `SkeletonUtils.clone()` 處理骨骼動畫的正確複製
- 自帶 `pointLight` 模擬機身燈光
- 同樣透過 `useGLTF.preload()` 預載入

### 設定檔 — `ntpu.config.ts`

所有場景相關參數集中在 `src/config/ntpu.config.ts`：

```typescript
{
  observer: { name, latitude, longitude, altitude },  // 觀測站地理座標
  scene:    { modelPath, position, scale, rotation },  // 校園模型設定
  uav:      { modelPath },                             // UAV 模型路徑
  camera:   { initialPosition, fov, near, far },       // 相機參數
}
```

修改此檔即可調整場景行為，不需要改動元件程式碼。

### 星空背景 — `Starfield.tsx`

- 生成 180 顆隨機分布的星星
- 使用純 **CSS `@keyframes` animation** 處理閃爍效果
- 不使用任何 JS 計時器或 React state 更新，零效能開銷
- 置於 Canvas 後方，透過 `pointer-events: none` 不影響 3D 互動

## 互動操作

| 操作 | 說明 |
|---|---|
| 滑鼠左鍵拖曳 | 旋轉場景 |
| 滑鼠右鍵拖曳 | 平移場景 |
| 滾輪 | 縮放（距離限制 10 ~ 2000） |

## 開發注意事項

- `tsconfig.json` 設定 `"noEmit": true`，TypeScript 僅做型別檢查，實際轉譯由 Vite 處理
- `vite.config.ts` 設定 `@` 別名指向 `src/`，import 時可用 `@/config/...` 等路徑
- `.glb` 模型放在 `public/` 目錄下，Vite 會在建置時直接複製，不經過打包處理

---

# English

## Introduction

beamHO-bench is a Three.js-based interactive 3D spatial visualization project featuring the National Taipei University (NTPU) campus as its scene, along with a UAV (drone) model for real-time 3D scene exploration and interactive controls.

The tech stack uses **React + TypeScript + Vite**, with **React Three Fiber** integrating Three.js into the React ecosystem for declarative 3D scene management.

## SDD Implementation Status (2026-03-03)

Current implementation progress:

1. Initial baseline commit: `a3adad6` (current root commit)
2. M0/M1/M2 core capabilities are running:
   - case9 analytic orbit, multi-beam rendering, baseline execution, KPI accumulation/export
   - source trace export for parameter provenance
3. M3 core capabilities are running:
   - full-fidelity `cho` and `mc-ho` as default baselines, with explicit non-default simplified mode
   - multi-baseline batch comparison runner (comparison summary + per-baseline timeseries export)
   - HUD `ComparisonChart` for visual baseline KPI comparison
   - baseline comparison export includes a reproducible small-scale comparison template (fixed seed/tick/model sweep tuples)
4. M4 initial capability is running:
   - `starlink-like` and `oneweb-like` real-trace mode via TLE/OMM + `satellite.js` SGP4
   - Kepler fallback is still kept for per-satellite robustness
   - real-trace multi-baseline comparison smoke (`max-rsrp`/`max-elevation`/`max-remaining-time`) is included in validation
   - source-trace and manifest (with `tle_snapshot_utc`) are covered by integration tests in both paper-baseline and real-trace modes
5. Papers/standards remain tracked via public-safe metadata locks:
   - `papers/sdd-required/papers-index.md`
   - `papers/sdd-required/papers-lock.json`
   - `papers/standards/standards-index.md`
   - `papers/standards/standards-lock.json`
6. pending closure packages (D1~D5) are implemented and closure-tracked:
   - `sdd/pending/beamHO-bench-gap-closure-sdd.md`
   - `sdd/completed/beamHO-bench-gap-closure-closure.md`
   - `sdd/pending/beamHO-bench-small-scale-validation-sdd.md`
   - `sdd/completed/beamHO-bench-small-scale-validation-closure.md`
7. Latest validation suite (`validate:val-suite`) runs 58 cases with all blocking/non-blocking checks passing, including cross-mode, baseline-parameter-envelope, and repro-bundle contract guards
8. SDD completion status index: `sdd/completed/beamHO-bench-implementation-status.md`
9. SDD documents are now split into `sdd/completed/` (implemented), `sdd/pending/` (closure-tracked pending package), and `sdd/backlog/` (long-term backlog)

## Research Source and Copyright Policy

To keep the public repository legally safe:

1. Do not commit third-party full-text binaries: publisher PDFs and 3GPP ZIP/DOC/DOCX.
2. Keep only traceability metadata in git: `sourceId`, `DOI/official URL`, `SHA256`, version filename.
3. Add `sourceId` provenance comments in key implementation logic.
4. Ensure each run exports `source-trace.json` for auditability.
5. `.gitignore` already blocks full-text binaries under `papers/`, while allowing metadata files (`md/json/yaml/txt/bib`).

## Adding New Papers/Standards

Use this workflow every time:

1. Download files locally (outside tracked artifacts if needed).
2. Compute checksum: `sha256sum <file>`
3. Update lock and index files:
   - papers: `papers/sdd-required/papers-lock.json` and `papers/sdd-required/papers-index.md`
   - standards: `papers/standards/standards-lock.json` and `papers/standards/standards-index.md`
4. Register source IDs in:
   - `src/config/references/paper-sources.json`
   - `src/config/paper-profiles/*.sources.json`
5. Annotate key code sections with `Source: <sourceId>`.
6. Verify no full-text binaries are tracked: `git status` should not show PDF/ZIP/DOC/DOCX changes.

## Quick Start

### Prerequisites

- **Git LFS** — This project uses Git LFS to manage 3D model files (`.glb`). It must be installed before cloning.
- **Node.js** >= 18
- **npm** >= 9

### Installing Git LFS

The 3D model files (~17.7 MB total) are stored via Git LFS. Without LFS installed, cloning will only download pointer files and the 3D scene will fail to load.

```bash
# macOS
brew install git-lfs

# Ubuntu / Debian
sudo apt install git-lfs

# Windows (bundled with Git for Windows; if not enabled, run:)
git lfs install
```

After installation, run `git lfs install` once to activate, then clone as usual:

```bash
git clone <repo-url>
```

If you already cloned without LFS, pull the missing files:

```bash
git lfs pull
```

### Installation & Running

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (default: http://localhost:3000)
npm run dev

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview
```

The dev server auto-opens the browser and binds to `0.0.0.0:3000`, making it accessible from other devices on the same network.

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server (HMR enabled) |
| `npm run build` | TypeScript type check + Vite production build |
| `npm run preview` | Preview the `dist/` build output locally |
| `npm run lint` | Run TypeScript type checking (no file output) |
| `npm run test:sim` | Run formal SimCore test layer (Unit + Integration), and write `dist/sim-test-summary.json` |
| `npm run sync:tle-fixtures` | Sync latest Starlink/OneWeb orbit-element samples from `../tle_data` |
| `npm run bench:cross-mode` | Run the cross-mode reproducible benchmark pack (`case9-default` + `starlink-like` + `oneweb-like`) and write default artifacts under `dist/cross-mode-benchmark` |
| `npm run bundle:repro-v1` | Export Repro Bundle v1 (cross-mode + baseline-parameter-envelope) under `dist/repro-bundle-v1` |
| `npm run validate:rigor` | Run academic-rigor checks (source map, ASSUME, Provenance, FR018 coverage) |
| `npm run validate:structure` | Structure checks (file-size thresholds and scenario-helper de-dup guard) |
| `npm run validate:repo-policy` | Validate FR-024 repository policy (`papers/` tracks metadata-only files and `.gitignore` policy is intact) |
| `npm run validate:val-suite` | Run core `VAL-*` suite with check gating (including blocking `runtime-parameter-audit`), and write `dist/validation-suite.json/csv`, `dist/validation-gate-summary.json`, and `dist/runtime-parameter-audit-summary.json` |
| `npm run validate:stage` | One-shot stage gate (lint + build + test:sim + validate:rigor + validate:structure + validate:repo-policy + validate:val-suite) |

#### Cross-mode benchmark workflow

```bash
npm run bench:cross-mode
```

Custom output directory:

```bash
npm run bench:cross-mode -- --out_dir dist/my-cross-mode
```

Default outputs:
1. `cross-mode-plan_<tupleDigest>.json`
2. `cross-mode-run_<artifactDigest>.json`
3. `cross-mode-summary_<artifactDigest>.json`

#### Repro bundle v1 workflow

```bash
npm run bundle:repro-v1
```

Custom output directory:

```bash
npm run bundle:repro-v1 -- --out_dir dist/my-repro-bundle
```

Default outputs:
1. `repro-bundle-v1_<artifactDigest>.json`
2. `repro-bundle-v1-manifest_<artifactDigest>.json`
3. `cross-mode-run_<artifactDigest>.json`
4. `baseline-parameter-envelope_<tupleDigest>.json`

### Module Line-Count Policy (`validate:structure`)

`validate:structure` applies this policy to `src/sim`, `src/hooks`, and `src/config/paper-profiles`:

1. `<= 500` lines: OK (no warning)
2. `501-650` lines: warning (split recommended, but stage gate still passes)
3. `> 650` lines: failure (split required)

This keeps modules maintainable without forcing premature splitting.

### Real-trace Data Sync

If `tle_data/` is updated, run this before simulation:

```bash
npm run sync:tle-fixtures
```

This refreshes:

- `src/data/tle/starlink-sample.json`
- `src/data/tle/oneweb-sample.json`

### Real-trace Propagator Mode

- Default: `kepler-fallback` (deterministic propagation over TLE mean elements)
- Optional: `VITE_ORBIT_PROPAGATOR=sgp4`
  - Enables true SGP4 propagation via `satellite.js` over fixture OMM fields
  - If propagation fails for a specific satellite, that satellite falls back to `kepler-fallback`

## Project Structure

```
beamHO-bench/
├── index.html                  # HTML entry, loads /src/main.tsx
├── package.json                # Project config & dependency management
├── tsconfig.json               # TypeScript config (noEmit, type-check only)
├── vite.config.ts              # Vite build config (alias, dev server, sourcemap)
│
├── public/                     # Static assets (copied directly to dist/ by Vite)
│   ├── models/
│   │   └── uav.glb             # UAV drone 3D model (9.9 MB)
│   └── scenes/
│       └── NTPU.glb            # NTPU campus 3D scene model (7.8 MB)
│
├── src/
│   ├── main.tsx                # App entry: mounts React to DOM
│   ├── App.tsx                 # Root component (future mount point for routing/providers)
│   │
│   ├── config/
│   │   └── ntpu.config.ts      # Centralized scene config (coordinates, model paths, camera)
│   │
│   ├── styles/
│   │   └── main.scss           # Global styles (CSS reset, fullscreen layout)
│   │
│   └── components/
│       ├── scene/              # 3D scene components
│       │   ├── MainScene.tsx   # Main scene container: Canvas, camera, lights, composition
│       │   ├── NTPUScene.tsx   # NTPU campus model loading & material processing
│       │   └── UAV.tsx         # UAV drone model loading
│       │
│       └── ui/                 # UI components
│           └── Starfield.tsx   # CSS starfield background animation
│
└── dist/                       # Build output (gitignored)
```

## Technical Architecture

### Rendering Pipeline

```
index.html
  → src/main.tsx          React mount point
    → App.tsx             Root component
      → MainScene.tsx     Canvas + camera + lights + scene composition
        ├── Starfield     CSS starfield background (pure CSS animation, zero JS overhead)
        ├── NTPUScene     Campus 3D model (GLB → MeshStandardMaterial)
        └── UAV           Drone 3D model (GLB + SkeletonUtils clone)
```

### Core Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **React** | 19.2 | UI framework |
| **TypeScript** | 5.9 | Type safety |
| **Vite** | 7.1 | Dev server & build tool |
| **Three.js** | 0.180 | WebGL 3D rendering engine |
| **React Three Fiber** | 9.4 | Declarative React wrapper for Three.js |
| **Drei** | 10.7 | R3F utility collection (OrbitControls, PerspectiveCamera, useGLTF, etc.) |
| **Sass** | 1.93 | CSS preprocessor |

### How Three.js Works in This Project

This project integrates Three.js into React via **React Three Fiber (R3F)**:

1. **Canvas** (`MainScene.tsx`) — R3F's `<Canvas>` component creates a WebGL renderer with ACES Filmic tone mapping, anti-aliasing, and shadow support.

2. **Camera** — Drei's `<PerspectiveCamera>` starts with an overhead view (Y=400, Z=500), 60-degree FOV, with a visible range of 0.1 to 10,000 units.

3. **Orbit Controls** — `<OrbitControls>` provides mouse-drag rotation, scroll zoom, and damping effects, with the polar angle clamped to prevent looking below the horizon.

4. **Lighting System**:
   - `hemisphereLight` — Sky/ground ambient lighting
   - `ambientLight` — Global ambient fill light
   - `directionalLight` — Main directional light (directly above), with 4096x4096 shadow maps

5. **Model Loading** — Drei's `useGLTF` hook loads `.glb` models, paired with `<Suspense>` for async loading states.

### 3D Models

#### Campus Scene — `public/scenes/NTPU.glb` (7.8 MB)

- 3D scene model of the National Taipei University Sanxia campus
- Automatically converts `MeshBasicMaterial` to `MeshStandardMaterial` on load, enabling proper lighting and shadows
- Pre-loaded via `useGLTF.preload()` to reduce initial render delay
- Configuration managed centrally in `ntpu.config.ts` (path, position, scale, rotation)

#### UAV Drone — `public/models/uav.glb` (9.9 MB)

- Drone 3D model, cloned using `SkeletonUtils.clone()` for correct skeleton/bone animation handling
- Includes a `pointLight` to simulate onboard lighting
- Also pre-loaded via `useGLTF.preload()`

### Configuration — `ntpu.config.ts`

All scene-related parameters are centralized in `src/config/ntpu.config.ts`:

```typescript
{
  observer: { name, latitude, longitude, altitude },  // Observer geographic coordinates
  scene:    { modelPath, position, scale, rotation },  // Campus model settings
  uav:      { modelPath },                             // UAV model path
  camera:   { initialPosition, fov, near, far },       // Camera parameters
}
```

Modify this file to adjust scene behavior without changing component code.

### Starfield Background — `Starfield.tsx`

- Generates 180 randomly distributed stars
- Uses pure **CSS `@keyframes` animation** for twinkling effects
- No JS timers or React state updates — zero performance overhead
- Positioned behind the Canvas with `pointer-events: none` to avoid interfering with 3D interactions

## Controls

| Input | Action |
|---|---|
| Left-click drag | Rotate the scene |
| Right-click drag | Pan the scene |
| Scroll wheel | Zoom in/out (distance clamped to 10–2000) |

## Development Notes

- `tsconfig.json` sets `"noEmit": true` — TypeScript only type-checks; actual transpilation is handled by Vite
- `vite.config.ts` configures the `@` alias to point to `src/`, allowing imports like `@/config/...`
- `.glb` models are placed in `public/` — Vite copies them directly to the build output without bundling
