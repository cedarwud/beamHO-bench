# 02. SimCore 與系統架構

## 1. 設計原則

1. SimCore 與前端視覺層解耦。
2. 所有 KPI 相關參數必須可追溯到 profile/source map。
3. 比較實驗必須可重現（同 profile + seed + override -> 同結果）。

## 2. Config -> SimCore -> Viz 資料路徑

1. 載入 profile（`starlink-like` / `oneweb-like`）
2. 建立 scenario（paper-baseline 或 real-trace）
3. SimEngine 每 tick 產生 `SimSnapshot`
4. Viz 層顯示衛星、beam、UE、連線與 KPI

## 3. SimCore 關鍵模組

1. `src/sim/engine.ts`  
負責 tick orchestration 與快照生命週期。

2. `src/sim/scenarios/`  
`case9-analytic.ts` 與 `real-trace.ts` 實作不同場景。

3. `src/sim/orbit/`  
TLE catalog、傳播器、topocentric 幾何換算。

4. `src/sim/channel/`  
large-scale（FSPL + 3GPP SF/CL）與 small-scale plugin。

5. `src/sim/handover/`  
baseline 決策（max-RSRP/A3/A4/CHO/MC-HO）與 state machine。

6. `src/sim/kpi/`  
KPI 累積與輸出格式化。

7. `src/sim/bench/`  
validation suite、gate、比較批次執行（含 small-scale comparison template 匯出）。

## 4. Handover baseline

目前可用 baseline：

1. `max-rsrp`
2. `max-elevation`
3. `max-remaining-time`
4. `a3`
5. `a4`
6. `cho`
7. `mc-ho`

`cho` / `mc-ho` 支援 `full` 與 `simplified`，研究主路徑預設為 `full`。

## 5. KPI

主要 KPI：

1. throughput
2. handover-rate
3. RLF（state1/state2）
4. HOF（state2/state3）
5. UHO
6. HOPP
7. avg DL SINR
8. Jain fairness

## 6. 追溯與報表

主要輸出：

1. `result` / `timeseries`
2. `source-trace`
3. `manifest`
4. `validation-gate-summary`
5. `runtime-parameter-audit` 相關輸出

關鍵文件：

1. `sdd/completed/beamHO-bench-paper-traceability.md`
2. `sdd/completed/beamHO-bench-experiment-protocol.md`
3. `sdd/completed/beamHO-bench-validation-matrix.md`
