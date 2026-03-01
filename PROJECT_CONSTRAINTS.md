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
4. `NTPU` 預設座標先固定，不在當前階段任意更動。

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
3. 單一檔案過大時必須進行「有意義拆分」，不是只切行數：
   - 依責任邊界拆分（例如：types/helpers/runner/checks 分離）
   - 拆分後命名與目錄要能反映模組責任
   - 不可製造循環依賴或把核心流程分散到難追蹤
4. 結構需可維護，避免單檔過大；目前規則為：
   - `<= 500` 行：正常
   - `501-650` 行：警告
   - `> 650` 行：必須拆分
5. 需定期檢視整體專案架構是否要調整（至少每個 milestone 一次，或大型功能合併前後）：
   - 檢查目錄分層是否仍清楚（sim/core/viz/config/reporting）
   - 檢查是否出現模組責任重疊或過度耦合
   - 若有結構性風險，先重構再繼續堆新功能

## 7. 驗證與輸出要求

1. 需可重現（同 profile + seed + overrides 產出一致）。
2. 需持續通過 stage gate（`validate:stage`）。
3. 關鍵輸出（如 `sim-test-summary`, `validation-suite`, `validation-gate-summary`）要可供 CI 與論文附錄引用。
