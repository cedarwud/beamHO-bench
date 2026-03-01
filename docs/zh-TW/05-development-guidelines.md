# 05. 開發流程與規範

## 1. 先對齊哪份規格

1. 已完成範圍：`sdd/completed/`
2. 待開發範圍：`sdd/pending/`
3. 基本約束：`PROJECT_CONSTRAINTS.md`

原則是先對齊 SDD，再開發，不直接跳過規格。

## 2. 必守開發規則

1. 以學術共通基線為先，不先綁死特定論文私有場景。
2. 研究主路徑預設 `full fidelity`，`simplified` 必須明確標示。
3. KPI 相關參數不得使用隱藏硬編碼。
4. 關鍵公式與參數要可追溯到 `sourceId`。

## 3. 單檔過大與拆分規則

行數門檻：

1. `<= 500`：正常
2. `501-650`：警告
3. `> 650`：強制拆分

拆分必須是「有意義」而不是只切檔：

1. 依責任邊界拆分（types/helpers/runner/checks）
2. 保持清楚命名與資料流
3. 避免循環依賴與過度分散

## 4. 定期架構巡檢

至少每個 milestone 一次，或大型功能合併前後，檢查：

1. 模組分層是否仍清晰（sim/core/viz/config/reporting）
2. 是否出現責任重疊與耦合上升
3. 是否需要先重構再繼續堆功能

## 5. 追溯與版權規範

1. 程式關鍵邏輯加 `Source: <sourceId>` 註解
2. source map 與 source catalog 需一致
3. 不提交第三方全文檔（PDF/ZIP/DOC/DOCX）
4. 只提交 metadata（URL、checksum、sourceId）

## 6. 建議開發節奏

1. 修改前：確認 SDD 範圍與需求
2. 修改中：同步維持註解追溯
3. 修改後：先跑 `test:sim`，再跑 `validate:stage`
4. 合併前：確認 artifact 與文件同步更新
