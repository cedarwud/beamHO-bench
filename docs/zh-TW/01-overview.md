# 01. 專案總覽

## 1. 專案定位

`beamHO-bench` 是 LEO multi-beam handover 的研究型模擬平台，核心目標是：

1. 建立可重現學術 baseline 的模擬環境（不只是 3D 展示）。
2. 在相同情境下比較 baseline 與自研演算法。
3. 支援 `paper-baseline` 與 `real-trace` 兩種模式。

## 2. v1 範圍與現況

目前 v1 核心範圍（M0-M4）已落地，細節見：

1. `sdd/completed/beamHO-bench-implementation-status.md`
2. `sdd/completed/beamHO-bench-sdd.md`
3. `sdd/completed/beamHO-bench-requirements.md`

延後到下一階段（pending）：

1. RL plugin
2. Beam hopping + HO 聯合優化
3. LEO/MEO/GEO 多軌道統一排程

## 3. 系統分層

系統可分為三層：

1. Config 層  
Profile 載入、schema 驗證、來源映射（source map）。

2. SimCore 層  
軌道、波束、通道、handover、KPI、驗證與報表輸出。

3. Viz 層  
React + R3F，消費快照資料做 3D 呈現與互動。

## 4. 兩種模擬模式

1. `paper-baseline`  
解析軌道（case9 風格）用於基線驗證與快速重現。

2. `real-trace`  
使用 Starlink/OneWeb TLE 衍生資料，支援 `satellite.js` SGP4 與 Kepler fallback。

## 5. 主要目錄

1. `src/sim/`：純模擬核心（不依賴 React/Three）
2. `src/components/`、`src/hooks/`：前端與互動層
3. `src/config/`：profile、來源映射與參數類型
4. `src/data/tle/`：real-trace 使用的 fixture
5. `scripts/`：測試、驗證、資料同步腳本
6. `sdd/completed/`：已落地規格
7. `sdd/pending/`：待開發規格

## 6. 常用命令

1. `npm run dev`：本地開發
2. `npm run build`：建置
3. `npm run test:sim`：SimCore unit+integration 測試
4. `npm run validate:stage`：完整 stage gate
5. `npm run sync:tle-fixtures`：從 `../tle_data` 同步最新資料到 fixture

## 7. 建議先讀哪裡

1. 如果你要了解架構：`02-simcore-architecture.md`
2. 如果你要跑真實資料：`03-real-trace-and-tle.md`
3. 如果你要看驗證證據：`04-testing-and-validation.md`
4. 如果你要開始開發：`05-development-guidelines.md`
