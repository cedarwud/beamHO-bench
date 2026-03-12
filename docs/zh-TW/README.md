# beamHO-bench 中文文件中心

這份索引用於快速定位「目前專案整體系統」的完整說明。

## 建議閱讀順序

1. `01-overview.md`
2. `02-simcore-architecture.md`
3. `03-real-trace-and-tle.md`
4. `04-testing-and-validation.md`
5. `05-development-guidelines.md`
6. `06-research-parameter-governance.md`
7. `07-observer-sky-visual-acceptance.md`

## 文件地圖

1. `01-overview.md`  
說明專案目標、v1 範圍、系統分層、主要資料夾與常用指令。

2. `02-simcore-architecture.md`  
說明 SimCore 的模組邊界、handover baseline、KPI 與輸出 artifact。

3. `03-real-trace-and-tle.md`  
說明 `tle_data`、每日更新、`sync:tle-fixtures`、real-trace 執行路徑。

4. `04-testing-and-validation.md`  
說明測試命令、驗證關卡、CI 產物、目前覆蓋範圍與缺口。

5. `05-development-guidelines.md`  
說明日常開發規範、有意義拆分、架構巡檢、追溯與版權限制。

6. `06-research-parameter-governance.md`  
說明「研究參數」與「畫面控制」的邊界、參數分組、離散範圍與來源依據。

7. `07-observer-sky-visual-acceptance.md`  
定義 observer-sky 前台畫面最終要長什麼樣，供後續 SDD 與實作驗收使用。

## 與 SDD 的關係

1. 已完成 SDD：`sdd/completed/`
2. 本期待開發/closure-tracked SDD：`sdd/pending/`
3. 長期 backlog：`sdd/backlog/`
4. 實作完成度總覽：`sdd/completed/beamHO-bench-implementation-status.md`
5. TODO gap closure closure report：`sdd/completed/beamHO-bench-gap-closure-closure.md`
