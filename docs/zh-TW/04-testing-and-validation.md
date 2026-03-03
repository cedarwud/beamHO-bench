# 04. 測試、驗證與 CI

## 1. 測試層級

目前測試重點在 SimCore 與研究驗證層：

1. Unit + Integration（`test:sim`）
2. Validation suite（`validate:val-suite`）
3. Academic rigor / structure / repo policy gate
4. 全關卡整合（`validate:stage`）

## 2. 常用命令

1. `npm run test:sim`  
執行 SimCore 測試並輸出 `dist/sim-test-summary.json`。

2. `npm run validate:val-suite`  
執行 `VAL-*` 套件並輸出 validation artifact。

3. `npm run bench:cross-mode`  
執行 cross-mode reproducible benchmark pack（`case9-default` + `starlink-like` + `oneweb-like`），預設輸出到 `dist/cross-mode-benchmark/`。

4. `npm run validate:stage`  
一鍵跑完整 gate（lint/build/test/validate 系列）。

## 3. 主要 artifact

1. `dist/sim-test-summary.json`
2. `dist/validation-suite.json`
3. `dist/validation-suite.csv`
4. `dist/validation-gate-summary.json`
5. `dist/runtime-parameter-audit-summary.json`
6. `dist/cross-mode-benchmark/cross-mode-plan_<tupleDigest>.json`
7. `dist/cross-mode-benchmark/cross-mode-run_<artifactDigest>.json`
8. `dist/cross-mode-benchmark/cross-mode-summary_<artifactDigest>.json`
9. （UI comparison 匯出）`small-scale-template_<profile>_seed-<seed>_ticks-<tick>.json`

這些輸出也是 CI artifact 與論文附錄可引用來源。

## 4. CI 行為

GitHub Actions 會執行 stage gate，並上傳上述驗證產物。  
若 gate 失敗，通常代表：

1. 型別或建置回歸
2. baseline/驗證趨勢回歸
3. traceability 或 repo policy 違規

## 5. 目前覆蓋範圍與缺口

已覆蓋：

1. SimCore deterministic/replay
2. real-trace smoke 與多 baseline smoke
3. source-trace/manifest/runtime-audit 相關關卡

尚未完整覆蓋（可做下一步）：

1. React 元件測試
2. Browser E2E smoke（例如 Playwright）
3. 壓力/效能測試（大規模 UE、長時間模擬）

## 6. 什麼情況一定要跑 stage gate

1. 調整 KPI 計算邏輯
2. 調整 handover/state machine 邏輯
3. 調整 profile/schema/source map
4. 調整 real-trace/TLE 讀取或傳播流程
5. 大型重構或檔案拆分後
