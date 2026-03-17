# Project Constraints (from prior discussions)

這份文件是「開發時必須遵守」的簡化版約束清單。

## 1. 專案定位

1. 目標是 `LEO satellite multi-beam handover` 的研究型模擬器，不是只做 3D 視覺展示。
2. 以網站技術實作（JS/TS/Python 架構），不依賴現成衛星模擬器黑盒。
3. 先做「學術共通基線環境」，再做特定論文情境與自研演算法比較。

## 2. 學術與模型要求

1. 優先使用學界常見、可重現的參數與流程，不先綁死單一論文私有設定。
2. 預設研究路徑必須是 `full fidelity`；`simplified` 只能作為明確標示的非預設工程模式。
3. 不可使用來路不明的簡化數據或演算法；若採用假設，必須有合理來源與理由。
4. 預設觀測站座標採用 40°N, 116°E（北京區域），為 50 篇論文庫中最常用的模擬位置（5+ 篇採用）。3D 場景的 NTPU 建築 GLB 模型保留不變（純視覺裝飾）。
5. 前端視覺化層的物理參數（如過境時間、軌道面方向、高度縮放）也必須有論文或軌道力學公式依據，不得自行設計無依據的數值。若論文中找不到相關依據，必須停止開發並告知使用者。
6. **派生物理量必須附公式驗算**：從 profile 基礎參數（高度、傾角、波束寬度等）推導的衍生值（軌道速度、覆蓋直徑、軌道週期等）必須在程式中以公式計算或在註解中附上驗算，不得手動填寫近似值。標準公式：
   - 軌道速度：`v = √(μ / (R_E + h))`，μ = 398600.4418 km³/s²
   - 波束覆蓋直徑：`D = 2h · tan(θ_3dB / 2)`
   - 軌道週期：`T = 2π · √((R_E + h)³ / μ)`
7. **同一參數單一來源（Single Source of Truth）**：同一物理參數（如最低仰角門檻、觀測站座標）在 profile JSON、scenario-defaults、腳本中只能有一個定義來源，其餘位置必須引用該來源，不得各自硬寫不同值。
8. **物理參數 vs 純視覺參數必須明確分離**：
   - 影響模擬計算（SINR、handover 決策、KPI）的參數屬於**物理參數**，必須有論文/標準來源。
   - 僅影響 3D 渲染外觀（投影曲線、不透明度、穹頂半徑、相機位置）的參數屬於**視覺參數**，必須在程式中標註 `VISUAL-ONLY`，且不得被模擬邏輯引用。
   - 若某個常數同時影響物理和視覺，必須將物理部分抽出為獨立的有來源參數。
9. **Profile 參數必須按星座獨立驗證**：不同星座（Starlink、OneWeb）的 profile 參數不得複製貼上，每個值都必須針對該星座的高度、傾角獨立驗算。例如 550 km 和 1200 km 的覆蓋直徑、軌道速度、可見衛星數必然不同。

## 3. 資料與場景要求

1. 必須支援 `paper-baseline`（解析軌道）與 `real-trace`（TLE）雙模式。
2. `real-trace` 需可用 Starlink/OneWeb TLE 資料（含每日更新流程）。
3. 3D 場景需呈現衛星移動、UE 連線、multi-beam handover 核心狀態，而非僅裝飾性動畫。

## 4. 可追溯性（Traceability）

1. 關鍵程式邏輯要在程式內註解來源（`sourceId`，可對應論文/標準）。
2. Profile 參數需可映射到來源文件，並可在實驗輸出中追溯（如 `source-trace`）。
3. 不可有影響 KPI 的隱藏常數或未記錄參數覆寫。

## 5. 版權與版控政策

1. 不提交第三方全文檔到公開版控（論文 PDF、3GPP ZIP/DOC/DOCX 等）。
2. 只提交可公開追溯的 metadata（來源 ID、URL、版本、checksum）。
3. `.gitignore` 必須持續維持此政策，避免誤上傳大檔與有版權風險檔案。

## 6. 開發流程約束

1. 開發需持續對齊 SDD，不偏離成單一論文客製實作。
2. 每完成一個階段要主動做驗證，不等待額外提醒。
3. SDD 目錄責任需清楚分離：
   - `sdd/pending/`：`active pending`，本期 roadmap 明確納入實作範圍，需納入完成率與 gate。
   - `sdd/backlog/`：長期議題（如 multi-orbit），不納入本期完成率，不得以「未實作」視為違規。
4. pending SDD 完成後，必須同一階段完成文件生命週期收斂：
   - pending 文件狀態標註為 implemented/closure-tracked。
   - 至少有一份對應 `sdd/completed/*-closure.md` 並回鏈原 pending 條目。
   - roadmap/implementation status 需同步更新 phase 狀態。
5. 單一檔案過大時必須進行「有意義拆分」，不是只切行數：
   - 依責任邊界拆分（例如：types/helpers/runner/checks 分離）
   - 拆分後命名與目錄要能反映模組責任
   - 不可製造循環依賴或把核心流程分散到難追蹤
6. 結構需可維護，避免單檔過大；目前規則為：
   - `<= 500` 行：正常
   - `501-650` 行：警告
   - `> 650` 行：必須拆分
7. 需定期檢視整體專案架構是否要調整（至少每個 milestone 一次，或大型功能合併前後）：
   - 檢查目錄分層是否仍清楚（sim/core/viz/config/reporting）
   - 檢查是否出現模組責任重疊或過度耦合
   - 若有結構性風險，先重構再繼續堆新功能

## 7. 驗證與輸出要求

1. 需可重現（同 profile + seed + overrides 產出一致）。
2. 需持續通過 stage gate（`validate:stage`）。
3. 關鍵輸出（如 `sim-test-summary`, `validation-suite`, `validation-gate-summary`）要可供 CI 與論文附錄引用。
4. 關鍵輸出不只要「存在」，還需是當輪驗證新鮮產物：
   - `dist/sim-test-summary.json`
   - `dist/validation-suite.json`
   - `dist/validation-gate-summary.json`
   - 檔案修改時間需晚於當輪 `validate:stage` 開始時間。

## 8. 來源假設治理（ASSUME-*）

1. 任何新增 `ASSUME-*` 都必須在同一個變更集中同時完成：
   - source catalog 登錄（含 rationale）。
   - profile/source map 或 artifact traceability 路徑可追溯。
   - 至少一個 validation case 或檢查邏輯覆蓋新假設。
2. 不得以未登錄 `ASSUME-*` 或臨時常數直接進入 KPI 相關路徑。

## 9. 約束-執行對照（Constraint-to-Enforcement）

1. 每條硬性約束需有對應的自動化 gate、腳本或可稽核輸出；禁止只有口頭規範。
2. 目前基準對照如下：
   - 學術追溯、profile/source map、full-fidelity 預設、KPI 常數來源：`scripts/validate-academic-rigor.mjs`
   - 模組拆分與檔案大小門檻：`scripts/validate-module-structure.mjs`
   - 版權/.gitignore 與 deferred scope（RSMA/soft-HO/large-scale DRL）守門：`scripts/validate-repo-policy.mjs`
   - validation suite 完整性與 gate summary：`scripts/validate-validation-suite.mjs`
   - 階段整合 gate：`npm run validate:stage`
3. 新增硬性約束時，必須在同一階段補上對應 enforcement（腳本或可機器檢查的 artifact）。

## 10. 文件與驗證定義一致性

1. `sdd/completed/beamHO-bench-validation-matrix.md` 的必跑 validation IDs，必須可在 `src/sim/bench/validation-definitions.ts` 找到對應定義。
2. 若兩者不一致，視為流程違規，需先修正一致性再合併功能變更。
