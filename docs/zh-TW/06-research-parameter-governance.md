# 研究參數治理（Research Parameter Governance）

本文件定義「前台可調參數」的治理原則：只暴露會影響模擬結果（換手、SINR、吞吐、排程阻擋）的參數，並使用有論文/標準依據的離散層級。

## 1) 設計原則

1. 只納入 `research-critical` 參數，不納入純畫面控制。
2. 每個控制項都必須可映射到 `runtimeOverrides` 並進入核心運算路徑。
3. 參數使用「有意義層級」而非任意連續 slider。
4. 參數值由論文常見設定 + 既有假設治理（`ASSUME-*`）共同約束。

## 2) 不納入研究參數的項目

以下仍保留為 UI/播放控制，但不是研究參數：

1. `satellite render mode`（glb/primitive）
2. `link visibility`（serving/secondary/prepared 線顯示）
3. `playbackRate` / replay scrubber

## 3) 分組與範圍（v1）

### Orbit & Visibility

1. `constellation.altitudeKm`（僅 `paper-baseline`）
   - 層級：`550 / 600 / 1200 km`
   - 依據：`PAP-2022-SEAMLESSNTN-CORE`（550 km）、`PAP-2022-A4EVENT-CORE`（600 km）、`PAP-2024-MADRL-CORE`（1200 km）
2. `constellation.minElevationDeg`
   - 層級：`10 / 20 / 25 / 35 deg`
   - 依據：`PAP-2025-DAPS-CORE`（10°）、`PAP-2024-MADRL-CORE`（20°/25°）、`ASSUME-MIN-ELEVATION-SENSITIVITY-TIERS`（10/20/35）
3. `constellation.activeSatellitesInWindow`
   - 層級：`7 / 10 / 16`
   - 依據：`PAP-2022-SEAMLESSNTN-CORE`（16 beam constellation scenario）、`PAP-2024-MADRL-CORE`（高密度視窗）、`PAP-2025-DAPS-CORE`

### Beam Topology

1. `beam.beamsPerSatellite`（並自動對應 `beam.layout`）
   - 層級：`7 / 16 / 19 / 50`
   - 依據：`PAP-2022-A4EVENT-CORE`（19）、`PAP-2022-SEAMLESSNTN-CORE`（16）、`PAP-2024-MADRL-CORE`（50）
2. `beam.overlapRatio`
   - 層級：`10% / 20% / 25% / 30% / 40%`
   - 依據：`PAP-2024-MCCHO-CORE`（多組 overlap sweep）、`PAP-2025-TIMERCHO-CORE`
3. `beam.frequencyReuse`
   - 層級：`FR1 / reuse-4`
   - 依據：`PAP-2022-A4EVENT-CORE`（reuse option 1）、`PAP-2025-TIMERCHO-CORE`（FR1）、`ASSUME-FREQUENCY-REUSE-MODES`

### UE Load & Mobility

1. `ue.count`
   - 層級：`50 / 100 / 200 / 350`
   - 依據：`PAP-2022-SEAMLESSNTN-CORE`（100/350 UE case）、`PAP-2025-DAPS-CORE`、`ASSUME-UE-COUNT-TIERS`
2. `ue.speedKmph`
   - 層級：`0 / 3 / 30 / 60 km/h`
   - 依據：`ASSUME-UE-SPEED-TIERS`（標準化 mobility tier）、`PAP-2025-TIMERCHO-CORE`

### Handover Trigger

1. `handover.params.a3OffsetDb`: `0 / 2 / 4 dB`
2. `handover.params.a3TttMs`: `0 / 40 / 256 ms`
3. `handover.params.a4ThresholdDbm`: `-102 / -101 / -100 / -99 dBm`
4. `handover.params.homDb`: `0 / 2 / 4 dB`
5. `handover.params.mtsSec`: `0.5 / 1.0 / 1.5 s`
6. `handover.params.timerAlpha`: `0.8 / 0.85 / 0.9`

依據：`PAP-2022-A4EVENT-CORE`、`PAP-2025-TIMERCHO-CORE`、`STD-3GPP-TS38.331-RRC`

### Channel Realism

1. `channel.smallScaleModel`: `none / shadowed-rician / loo`
2. `channel.smallScaleParams.temporalCorrelation.enabled`: `off / on`
3. `channel.smallScaleParams.dopplerAware.enabled`: `off / on`

依據：`PAP-2024-MADRL-CORE` + `ASSUME-SMALL-SCALE-REALISM-OPTIONS`

### Scheduler Coupling

1. `scheduler.mode`: `uncoupled / coupled`

依據：`PAP-2025-DAPS-CORE` + `ASSUME-BEAM-SCHEDULER-WINDOW-CONFIG`

## 4) 實作位置

1. 參數目錄：`src/config/research-parameters/catalog.ts`
2. 前台面板：`src/components/sim/ResearchParameterPanel.tsx`
3. 主場景接線：`src/components/scene/MainScene.tsx`
4. 驗證：`src/sim/tests/integration-cases-research-parameters.ts`

## 5) 後續擴充規則

新增參數前，需同時滿足：

1. 參數在核心路徑有直接消費（不能只是 metadata）。
2. 具體可追溯來源（`PAP-*` / `STD-*` / 已登錄 `ASSUME-*`）。
3. 有明確離散層級或上下界，不接受「任意值」。
4. 至少一個測試證明調整後會改變模擬簽名或 KPI。

