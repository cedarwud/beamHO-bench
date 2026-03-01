# 03. real-trace 與 TLE 資料流程

## 1. 這個流程解決什麼問題

`real-trace` 需要真實星座資料，而不是手寫假軌道。  
目前流程把資料分成兩層：

1. `tle_data/`：原始資料收集層（可日更）
2. `beamHO-bench/src/data/tle/`：模擬用 fixture 層（前端友善、可重現）

## 2. 資料流（建議記住）

1. `tle_data/scripts/daily_tle_download_enhanced.sh`  
下載 Starlink/OneWeb 最新 TLE/JSON。

2. `tle_data/scripts/tle_cron_scheduler.sh`  
安裝與管理 cron 排程。

3. `beamHO-bench/scripts/sync-tle-fixtures.mjs`  
從 `../tle_data/*/json` 取最新檔，抽樣後輸出 fixture。

4. `src/sim/orbit/catalog.ts` + `src/sim/scenarios/real-trace.ts`  
讀 fixture 後做傳播並輸入模擬。

## 3. 每日更新操作

1. 確認 `tle_data` 已更新（手動或 cron）。
2. 在 `beamHO-bench` 執行 `npm run sync:tle-fixtures`。
3. 確認 `src/data/tle/starlink-sample.json`、`oneweb-sample.json` 已更新。
4. 跑 `npm run test:sim` 或 `npm run validate:stage` 做 smoke 驗證。

## 4. 傳播器模式

1. 預設：Kepler fallback（決定性、快速）
2. 設定 `VITE_ORBIT_PROPAGATOR=sgp4`：啟用 `satellite.js` true SGP4
3. SGP4 單顆失敗時，保留 per-satellite fallback，不中斷整體模擬

## 5. 常見問題

1. 問：`tle_data` 與 `sync:tle-fixtures` 會不會重複？  
答：不會。前者是資料來源層，後者是模擬輸入轉換層。

2. 問：cron 更新後為什麼模擬沒變？  
答：因為還沒執行 `npm run sync:tle-fixtures` 重建 fixture。

3. 問：可以只用 fixture 不用 `tle_data` 嗎？  
答：可以跑，但資料不會自動日更，也不符合「真實資料持續更新」流程。
