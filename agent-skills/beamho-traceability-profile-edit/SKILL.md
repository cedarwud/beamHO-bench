---
name: beamho-traceability-profile-edit
description: Use when editing beamHO-bench paper profiles, source maps, assumption-backed research parameters, or paper-source registries so schema, profile JSON, sources JSON, and validation coverage stay traceable and synchronized.
---

# beamHO Traceability And Profile Edit

Use this skill for `beamHO-bench/` when the task changes profile values, adds a new research parameter, edits `ASSUME-*` entries, or touches source-trace mappings.

## Read First

Read these first:
1. `AGENTS.md`
2. `PROJECT_CONSTRAINTS.md`
3. `src/config/paper-profiles/paper-profile.schema.json`
4. the target profile JSON and matching `.sources.json`
5. `src/config/references/paper-sources.json`
6. if research-parameter UI/runtime is affected:
   - `src/config/research-parameters/catalog.ts`
   - `src/config/research-parameters/consistency.ts`
7. if lifecycle or closure state changes:
   - `sdd/completed/beamHO-bench-implementation-status.md`
   - `sdd/pending/README.md`

## Primary Edit Surfaces

These files usually move together:
1. `src/config/paper-profiles/<profile>.json`
2. `src/config/paper-profiles/<profile>.sources.json`
3. `src/config/references/paper-sources.json`
4. `src/config/paper-profiles/paper-profile.schema.json`
5. `src/config/research-parameters/catalog.ts`
6. `src/config/research-parameters/consistency.ts`

Do not change only one of these when the data contract clearly spans more than one surface.

## Traceability Rules

1. Every new `sourceId` referenced by a profile, parameter catalog entry, or source map must exist in `src/config/references/paper-sources.json`.
2. Every new `ASSUME-*` must:
   - be added to `paper-sources.json`
   - have a clear locator / note
   - be used only where the project intentionally falls back to an assumption
3. If a profile field value changes and its justification changes, update the matching `.sources.json`.
4. If a new profile field is introduced:
   - update `paper-profile.schema.json`
   - update any affected types / loader logic if needed
   - update matching `.sources.json` entries
5. If a research-parameter option changes runtime behavior:
   - keep `catalog.ts` and `consistency.ts` aligned
   - do not leave hidden coupling undocumented

## Change Workflow

1. Start from the target profile or source-trace path.
2. Identify whether the change is:
   - value-only
   - new traceability source
   - new schema field
   - new research parameter or coupling rule
3. Apply the smallest synchronized change set across all impacted files.
4. Check for missing `sourceIds`, stale `.sources.json` paths, or schema drift before validating.

## Validation

These changes are stage-gate-sensitive. Prefer running:
1. `npm run lint`
2. `npm run test:sim`
3. `npm run build`
4. `npm run validate:stage`

At minimum, do not skip stage validation when changing:
1. profile JSON structure or values
2. source maps
3. `paper-sources.json`
4. `catalog.ts`
5. `consistency.ts`

## Reporting

Always report:
1. which profile or traceability surfaces changed
2. whether a new `ASSUME-*` or `sourceId` was introduced
3. what schema or consistency rules changed
4. what validation ran
