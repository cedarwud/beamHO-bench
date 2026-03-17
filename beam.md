# Beam / Observer-Sky 現況與待修正項

> 本文件記錄 beamHO-bench 的波束與 observer-sky 相關能力現狀、live frontend 缺口、以及後續研究候選方向。
> 每項描述均經原始碼驗證；預設值以 profile JSON 為準。

---

## 1. 已落地能力

v1 M0–M4 + v2 scope 均已完成（見 `sdd/completed/beamHO-bench-implementation-status.md`）。最新測試結果（`dist/sim-test-summary.json`, 2026-03-15）：93 total / 87 passed / 6 failed。失敗項為 5 個 observer-sky 視覺驗收測試（與 §2 的 frontend wiring gap 相關）+ 1 個 research-parameter catalog 測試（獨立問題，與 observer-sky 無關）。以下按模組分列。

### 1.1 Sim Core

| 模組 | 檔案路徑 | 說明 |
|------|----------|------|
| Sim Engine | `src/sim/engine.ts` | Tick loop + subscription，驅動所有模擬步進 |
| Scenario (case9) | `src/sim/scenarios/case9-analytic.ts` | Walker-circular / linear-drift 軌道，`buildBeamsForSatellite()` 產生 beam，輸出 `SatelliteStateFrame`（含 `runtimeSatellites` + `observerSkyPhysicalSatellites`） |
| Beam Layout | `src/sim/scenarios/common/beam-layout.ts` | Hex ring 佈局（axial coords → world [x,z]）、overlap ratio、回傳 `BeamState[]` |

### 1.2 Channel / SINR

| 模組 | 檔案路徑 | 說明 |
|------|----------|------|
| Link Budget | `src/sim/channel/link-budget.ts` | EIRP − PL − SystemLoss + AntennaGain + Fading → SINR；frequency reuse 干擾加總；Shannon / MCS throughput。**不讀 `profile.beam.gainModel`**（gainModel 僅影響視覺化，見 §1.6） |
| Large-scale | `src/sim/channel/large-scale.ts` | FSPL、slant range、beam containment、RSRP |
| Small-scale | `src/sim/channel/small-scale.ts` | Shadowed Rician / LoS-NLoS fading（starlink-like / oneweb-like 使用 `shadowed-rician`） |

**SINR 公式依據（A4EVENT eq. 1–9）**：

| Eq. | 公式 | 說明 | 來源 |
|-----|------|------|------|
| 1 | `SINR[dB] = −10·log₁₀(10^(−0.1·SNR) + 10^(−0.1·SIR))` | SINR 合成 | PAP-2022-A4EVENT-CORE |
| 2 | `SNR[dB] = EIRP − PL − k + G/T − 10·log₁₀(BW/KFR)` | 信噪比 | PAP-2022-A4EVENT-CORE |
| 3 | `FSPL(d, f_c) = 32.45 + 20·log₁₀(f_c) + 20·log₁₀(d)` | 自由空間路損 | PAP-2022-A4EVENT-CORE |
| 4 | `d = √(R_E²·sin²α + h₀² + 2h₀R_E) − R_E·sinα` | 斜距 | PAP-2022-A4EVENT-CORE |
| 5 | `M_n + Off > ζ` | A4 觸發條件 | PAP-2022-A4EVENT-CORE |
| 6 | `G(θ) = 4\|J₁(ka·sinθ)/(ka·sinθ)\|²` | Bessel J₁ 天線增益 | PAP-2022-A4EVENT-CORE |
| 7–9 | L3 IIR filter, TTT, RLF detection | 換手程序 | PAP-2022-A4EVENT-CORE, PAP-2025-TIMERCHO-CORE |

### 1.3 Handover Baselines

| 模組 | 檔案路徑 | 說明 |
|------|----------|------|
| Baselines | `src/sim/handover/baselines.ts` | 7 種：max-rsrp, max-elevation, max-remaining-time, a3, a4, cho, mc-ho |
| State Machine | `src/sim/handover/state-machine.ts` | 3-state（3GPP TS38.331），RLF Qout/Qin 偵測，L3 IIR filter |

### 1.4 Beam Scheduler（已實作）

| 模組 | 檔案路徑 | 說明 |
|------|----------|------|
| Window Engine | `src/sim/scheduler/window-engine.ts` (249 行) | 確定性 window-based 排程：FNV-1a hash 產生 beam activation score，按 `activeWindowFraction` 決定啟用比例。Provenance: PAP-2025-DAPS-CORE, ASSUME-BEAM-SCHEDULER-WINDOW-CONFIG |
| Coupled Resolver | `src/sim/scheduler/coupled-resolver.ts` (232 行) | 4 道 rejection gate：`blocked-by-schedule-inactive-beam`、`blocked-by-schedule-overlap-constraint`、`blocked-by-schedule-capacity`、`blocked-by-schedule-fairness-guard`。Provenance: PAP-2025-DAPS-CORE, PAP-2024-MCCHO-CORE |
| Types | `src/sim/scheduler/types.ts` | `BeamSchedulerMode = 'uncoupled' \| 'coupled'`、`BeamSchedulerSnapshot`、`BeamScheduleState` |

**整合路徑**（`baselines.ts`）：
1. `evaluateLinksForUe()` → 全量 link 評估
2. `filterLinksByScheduler()` → coupled mode 下只保留 `activeBeamKeys` 中的 beam
3. `resolveCoupledHandoverConflicts()` → 對 HO proposal 依序檢查 schedule/overlap/capacity/fairness，rejected 的 UE 留在原 serving beam

### 1.5 KPI

| 模組 | 檔案路徑 | 說明 |
|------|----------|------|
| Accumulator | `src/sim/kpi/accumulator.ts` | throughput, handoverRate, avgDlSinr, jainFairness, HOF, RLF |

### 1.6 視覺化元件（已實作，部分未串接）

| 元件 | 檔案路徑 | 狀態 | 說明 |
|------|----------|------|------|
| Display Pipeline | `src/viz/satellite/display-pipeline.ts` (142 行) | ✅ 已實作 + 單元測試 | `buildObserverSkyDisplayPipeline()` → candidate selection + continuity + arc projection → `renderPositionsById: Map<satId, [x,y,z]>` |
| Observer Sky Projection | `src/viz/satellite/observer-sky-projection.ts` | ✅ | Dome projection（azimuth/elevation → [x,y,z]） |
| View Composition | `src/viz/satellite/view-composition.ts` | ✅ | 多種觀測視角配置（primary / campus） |
| BeamFootprint | `src/components/sim/BeamFootprint.tsx` (48 行) | ✅ 已實作 | 接受 `satellites` + `gainModel`，使用 `beam.centerWorld`（**地面世界座標**）+ `rotation=[-π/2, 0, 0]` 繪製地面覆蓋圈 |
| beam-footprint-gain | `src/components/sim/beam-footprint-gain.ts` | ✅ | `resolveBeamFootprintBands(gainModel, visible)` → flat 2-band / bessel-j1 5-band / bessel-j1-j3 6-band。**純視覺用途，不影響 SINR** |
| ConnectionLines | `src/components/sim/ConnectionLines.tsx` (136 行) | ✅ 已實作 | serving（cyan）/ secondary（light cyan）/ prepared（orange）三種連線繪製 |
| KpiHUD | `src/components/sim/KpiHUD.tsx` | ✅ | 即時 KPI 顯示 |
| TimelineControls | `src/components/sim/TimelineControls.tsx` | ✅ | Play/pause/step/reset/scrub |
| ResearchParameterPanel | `src/components/sim/ResearchParameterPanel.tsx` | ✅ | 衛星/波束/通道參數編輯器 |

### 1.7 狀態管理

| Hook | 檔案路徑 | 說明 |
|------|----------|------|
| useSimulation | `src/hooks/useSimulation.ts` | SimEngine 生命週期、snapshot 訂閱、history（每 4 tick，max 600）、匯出 KPI / baseline comparison / run bundle |

### 1.8 Profile 預設值（從 JSON 讀取）

| 參數 | starlink-like | oneweb-like |
|------|---------------|-------------|
| beamsPerSatellite | 16 | 19 |
| layout | hex-16 | hex-19 |
| footprintDiameterKm | 50 | 50 |
| beamwidth3dBDeg | 4.4 | 4.4 |
| overlapRatio | 0.2 | 0.25 |
| gainModel | bessel-j1 | bessel-j1 |
| frequencyReuse | FR1 | FR1 |
| scheduler.mode | uncoupled | uncoupled |
| scheduler.maxActiveBeamsPerSatellite | 8 | 10 |
| scheduler.maxUsersPerActiveBeam | 14 | 12 |
| scheduler.fairnessTargetJain | 0.70 | 0.72 |
| constellation.altitudeKm | 550 | 1200 |
| channel.smallScaleModel | shadowed-rician | shadowed-rician |

> 來源：`src/config/paper-profiles/{starlink-like,oneweb-like}.json`

---

## 2. Live Frontend 缺口（Observer-Sky Wiring Gap）

後端 sim core / scheduler / coupling 均已落地且通過測試。前端缺口集中在 **observer-sky live 前端未將既有 display pipeline 和 snapshot 正式接上**，這是目前 6 個失敗測試中 5 個的根本原因（另 1 個為 research-parameter catalog 獨立問題）。對應 pending SDD：`sdd/pending/beamHO-bench-observer-sky-pass-conversion-sdd.md`。

### 2.1 SatelliteSkyLayer 獨立動畫（未同步 snapshot）

**位置**：`SatelliteSkyLayer.tsx` → 內部 `SatelliteFleet` 元件

`SatelliteFleet` 維護自己的 `simTimeRef`，在 `useFrame()` 中用 hardcoded 軌道參數（`BASE_PASS_DURATIONS`, `PEAK_ELEVATIONS`）獨立動畫。**完全忽略**透過 props 傳入的 `satellites`（`MainScene.tsx:354` 傳 `displayedSnapshot.satellites`）。

**後果**：畫面衛星位置 ≠ 模擬引擎衛星位置；換手事件在視覺上不可見。

**修正方向**：SatelliteFleet 改讀 display pipeline 輸出的投影位置，移除獨立 `useFrame` 動畫。

### 2.2 Display Pipeline 未被呼叫

**位置**：`MainScene.tsx:352–367`

MainScene 傳 `displayedSnapshot.satellites`（`SatelliteState[]`）給 SatelliteSkyLayer，但**未傳** `displayedSnapshot.observerSkyPhysicalSatellites`（`SatelliteGeometryState[]`），也未呼叫 `buildObserverSkyDisplayPipeline()`。

**後果**：`renderPositionsById`（衛星在 observer-sky 3D 場景中的投影座標）永遠不存在。

**修正方向**：
1. MainScene 傳 `observerSkyPhysicalSatellites` 給 SatelliteSkyLayer
2. SatelliteSkyLayer 呼叫 `buildObserverSkyDisplayPipeline()` 取得 `frame.renderPositionsById`

### 2.3 ConnectionLines 收到空 Map

**位置**：`SatelliteSkyLayer.tsx:310`

```tsx
<ConnectionLines satelliteRenderPositions={new Map()} />
```

因為 display pipeline 未啟用，硬編碼空 Map。

**後果**：serving / secondary / prepared 連線完全不顯示。

**修正方向**：傳入 `pipeline.frame.renderPositionsById`。

### 2.4 BeamFootprint 未掛載

`BeamFootprint.tsx` 已實作但未出現在任何元件樹中。

**注意座標系**：BeamFootprint 使用 `beam.centerWorld`（地面世界座標），`rotation=[-π/2, 0, 0]` 將圓形貼地。這是**地面覆蓋圈**，不應改成跟 observer-sky projection 走（否則會把地面 footprint 畫到天空 dome 上）。掛載時需決定：
- 若場景座標系與 `centerWorld` 一致 → 直接掛載
- 若場景使用 observer-sky dome → 需要獨立的地面 footprint layer 或座標轉換

---

## 3. 後續研究候選方向

以下項目尚未實作，列為候選實驗設定。預設值與目前 repo 不同的地方均已標明。

### 3.1 更高 beam 數量配置

目前 starlink-like 使用 16 beams (hex-16)。論文中常見更高配置：
- 19 beams/satellite（center + ring-1×6 + ring-2×12）→ 已有 oneweb-like profile 使用
- 61 beams（19 operating + 2 interference tiers）→ 需新增 profile

**來源**：
- 19 beams + 50 km cells → PAP-2025-TIMERCHO-CORE
- 19 + 2-tier interference = 61 → PAP-2022-A4EVENT-CORE
- Inter-beam spacing: `ABS = √3 × sin(HPBW/2)` → PAP-2025-TIMERCHO-CORE

### 3.2 bessel-j1-j3 Gain Model

目前所有 profile 預設 `bessel-j1`。J₁+J₃ 形式可作為候選實驗配置。注意兩篇文獻使用不同的 normalization：

**MADRL 形式**（PAP-2024-MADRL-CORE, catalog:81,124）：
```
G(θ) = Gmax·[J₁(μ)/(2μ) + 36·J₃(μ)/μ³]²
where μ = 2.07123·sin(θ) / sin(θ₃dB)
Gmax = K_G / L (adaptive to FSL)
```

**BHFREQREUSE 形式**（external candidate, catalog:88,109）：
```
G(θ) = η·[2·J₁(α)/α + 36·J₃(α)/α³]²
where α = θ / θ₃dB
η = 0.7 (aperture efficiency)
```

兩者的 J₁+J₃ 結構相同，但 peak gain normalization 不同（MADRL 用 adaptive Gmax，BHFREQREUSE 用固定 η）。實作時需選定一種 normalization 並登錄為 ASSUME-*。

**注意**：目前 `gainModel` **僅影響 BeamFootprint 視覺化 band**（`beam-footprint-gain.ts`），不影響 `link-budget.ts` 的 SINR 計算。若要讓 J₁+J₃ 影響物理層，需修改 link-budget.ts 使其讀取 `profile.beam.gainModel` 並切換天線增益計算。

**來源**：
- J₁+J₃ with Gmax normalization → PAP-2024-MADRL-CORE（已登錄）
- J₁+J₃ with η normalization → PAP-2026-BHFREQREUSE（**external candidate，未登錄於 repo paper-sources.json**）

### 3.3 Coupled Scheduler Mode

目前所有 profile 預設 `scheduler.mode = "uncoupled"`。切換為 `"coupled"` 即可啟用已實作的 window-engine + coupled-resolver pipeline，不需新增程式碼。

候選實驗：
- 比較 uncoupled vs coupled 在不同 beam 數量下的 HOF / RLF / throughput 差異
- 調整 `fairnessTargetJain`、`maxUsersPerActiveBeam` 觀察敏感度

### 3.4 進階 Beam Hopping 排程

目前 window-engine 使用確定性 FNV-1a hash 排程。候選進階策略：
- **Traffic-driven**：依 beam 內 UE 數量 / queue 長度排序啟用
- **DRL-based**（PPO）：學習最佳啟用策略

**來源（adjacent literature，需 transfer justification）**：
- Beam activation matrix + PPO → PAP-2026-BHFREQREUSE（Ka-band, resource-allocation 問題設定）
- Conflict graph + WMIS scheduling → PAP-2024-BEAM-MGMT-SPECTRUM（Ka-band, spectrum-sharing 問題設定）

> 上述兩篇存在於研究論文庫（`/home/u24/papers/catalog/`）但**未登錄於** `paper-sources.json` 和 `papers-index.md`。兩篇均為 Ka-band resource-allocation / spectrum-sharing 場景，與目前 core S-band HO baseline 有明顯 domain gap。若正式採用需先補進 repo source registry，並提供從 Ka-band 到 S-band 的 transfer justification。

### 3.5 Beam Handover vs Satellite Handover 區分

目前 state machine 統一處理所有 handover。候選改進：
- Intra-satellite beam handover（同衛星不同 beam）→ **hypothesis: 可能省略 RRC reconfiguration delay**（需補標準依據或登錄為 ASSUME-INTRA-SAT-BEAM-HO-DELAY）
- Inter-satellite handover（傳統衛星換手）→ 完整 3-state 流程

**已有來源**：
- MC-HO overlap trigger → PAP-2024-MCCHO-CORE（UE must be in overlap area of both beams, catalog:86）
- Packet duplication / selection combining → PAP-2024-MCCHO-CORE（highest SINR link, catalog:113）
- Path switching via AMF bearer modification → PAP-2024-MCCHO-CORE

**待補來源**：
- 「Intra-satellite beam HO 省略 RRC delay」目前無論文或 3GPP 標準直接支撐此主張。MCCHO 支撐的是 overlap trigger、packet duplication、path switching，不能直接推導出 protocol timing 層的結論。依 PROJECT_CONSTRAINTS.md 規則，需補標準/論文依據，或降格為 ASSUME-* 並登錄理由。

---

## 4. 已登錄來源索引

### 4.1 Core Papers（repo paper-sources.json）

| 標記 | paperId | 提供的關鍵內容 |
|------|---------|---------------|
| A4EVENT | PAP-2022-A4EVENT-CORE | SINR eq. 1–9、Bessel J₁ 天線增益、A4 觸發條件、3GPP RLF 流程 |
| SEAMLESSNTN | PAP-2022-SEAMLESSNTN-CORE | CHO DP 演算法、service capability 公式、16 beams/sat 配置 |
| MADRL | PAP-2024-MADRL-CORE | Bessel J₁+J₃ 公式（μ = 2.07123 形式）、Loo channel model |
| MCCHO | PAP-2024-MCCHO-CORE | MC-HO overlap trigger、beam overlap 0–40%、coupled resolver provenance |
| DAPS | PAP-2025-DAPS-CORE | DAPS-enabled multistage handover、window-engine provenance |
| TIMERCHO | PAP-2025-TIMERCHO-CORE | 19 beams/sat、ABS formula、L3 IIR filter、geometry-assisted timer |

### 4.2 標準來源（repo paper-sources.json）

| 標記 | 標準 | 用途 |
|------|------|------|
| 3GPP TR 38.811 | NTN channel model | Path loss, shadow fading, clutter loss, elevation-dependent parameters |
| 3GPP TS 38.331 | RRC | State machine, A3/A4 event 定義, measurement report |
| 3GPP TS 38.321 | MAC | HARQ, RA timeout |

### 4.3 External Candidates（僅存在於研究論文庫，未登錄於 repo）

| paperId | 潛在用途 | 備註 |
|---------|----------|------|
| PAP-2026-BHFREQREUSE | Beam hopping activation matrix, PPO 排程, J₁+J₃ with η=0.7 | 存在於 `/home/u24/papers/catalog/`，需補進 paper-sources.json 才能正式引用 |
| PAP-2024-BEAM-MGMT-SPECTRUM | Conflict graph WMIS, Lyapunov objective, 200 ms slots | 同上 |
