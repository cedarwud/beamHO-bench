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
