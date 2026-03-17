# Claude Code Instructions

## Mandatory Constraints
All development must follow `PROJECT_CONSTRAINTS.md`. Key rules:

### File Size Limits
- **≤ 500 lines**: OK
- **501–650 lines**: Warning — consider splitting
- **> 650 lines**: Must split by responsibility boundary
- Enforced by `scripts/validate-module-structure.mjs`
- Applies to all `.ts`/`.tsx` under: `src/sim`, `src/hooks`, `src/config`, `src/components`, `src/viz`

### Validation Gate
All changes must pass: `npm run lint && npm run test:sim && npm run build`

### Provenance
- Modules must include provenance comments (SDD references + `ASSUME-*` tags)
- No hidden constants affecting KPI paths
- New `ASSUME-*` must be registered in source catalog with rationale

### Traceability
- View-only layers must not write back to simulation/handover contracts
- Profile parameters must map to source documents

### Academic Rigor
- Default research path must be `full fidelity`
- Physical parameters must have paper or standard source; stop and ask if no source exists
- SINR baseline: A4EVENT (PAP-2022-A4EVENT-CORE) equations (1)–(9), 100% from 3GPP/ITU standards

### Parameter Integrity（參數正確性檢查流程）
新增或修改任何 profile / scenario / 腳本中的物理參數時，必須依序完成：

1. **公式驗算** — 派生物理量（速度、覆蓋直徑、週期）不得手寫近似值，必須用公式從基礎參數推導（見 PROJECT_CONSTRAINTS §2.6）
2. **跨星座獨立檢查** — Starlink (550 km) 和 OneWeb (1200 km) 的派生值必然不同；不得複製貼上同一數值（§2.9）
3. **單一來源一致性** — 同一參數（如最低仰角、觀測站座標）在 profile JSON、scenario-defaults.ts、scripts/ 中只能有一個定義來源（§2.7）。修改時必須搜尋所有引用處同步更新
4. **物理 vs 視覺分離** — 純視覺常數（投影曲線、穹頂半徑、不透明度）必須標註 `VISUAL-ONLY`，不得影響模擬邏輯（§2.8）
5. **ASSUME 登錄** — 無論文來源的參數必須標記 `ASSUME-*` 並在 paper-sources.json 登錄 rationale（§8）

### Documentation Accuracy (Write-time Verification)
When writing or updating documentation that describes the repo's current state:

1. **Read before claim** — Every factual statement about code (default values, whether a module exists, what a function reads, coordinate systems) must be verified by reading the actual source file. Agent summaries and plan transcripts are not sufficient; you must `Read` the file yourself or have an agent quote the specific lines.

2. **Profile defaults from JSON** — Never state default parameter values (beams count, gain model, overlap ratio, scheduler mode) without reading the active profile JSON (`src/config/paper-profiles/*.json`). Do not assume values from paper formulas are the repo defaults.

3. **Scope separation: catalog vs repo sources** — The 50-paper catalog (`/home/u24/papers/catalog/`) is a research library. The repo's own paper index (`papers/sdd-required/papers-index.md`) and source registry (`src/config/references/paper-sources.json`) are a strict subset. When citing a paper as a dependency, confirm it exists in the repo's registry. If it only exists in the catalog, label it as "external / not yet registered" and do not cite it as if the repo already depends on it.

4. **Implementation status from code, not memory** — Before writing "not yet implemented" or "interface only", search for actual implementation files (`Glob` + `Read`). The codebase may have grown since last session.

5. **Coordinate system verification** — Before writing how a component should be wired (e.g., which position data to pass), read the component's source to confirm what coordinate system it uses (ground-world vs observer-sky-projection vs ECEF).
