# beamHO-bench — Paper Traceability Specification

**Version:** 0.2.0  
**Date:** 2026-02-28  
**Status:** Draft

---

## 1. Purpose

This document defines how implementation details in `beamHO-bench` are traced back to papers or standards, so every key parameter and logic block can be audited later.

---

## 2. Traceability Units

Traceability is required for:
1. profile parameters used in channel, link budget, HO triggers, and RLF/HOF state machine
2. baseline algorithm logic (`max-rsrp`, `max-elevation`, `max-remaining-time`, `a3`, `a4`, `cho`, `mc-ho`)
3. KPI definitions and state classification logic
4. experiment-level assumptions that alter interpretation of results

---

## 3. Source Catalog

Create a central source catalog at:
1. `beamHO-bench/src/config/references/paper-sources.json`

Each catalog entry shall include:
1. `sourceId`
2. `type` (`standard` or `paper`)
3. `title`
4. `locator` (section/table/equation)
5. `year`
6. `canonicalUrl` (DOI URL or official standards archive URL)
7. `licenseNote` (short usage/redistribution note)
8. `note` (optional short context)
9. `artifactSha256` (optional local snapshot hash)

Recommended initial IDs:
1. `STD-3GPP-TR38.811-6.6.2-1`
2. `PAP-2022-A4EVENT-CORE`
3. `PAP-2024-MCCHO-CORE`
4. `PAP-2025-TIMERCHO-CORE`
5. `PAP-2022-SEAMLESSNTN-CORE`
6. `PAP-2024-MADRL-CORE`
7. `PAP-2025-DAPS-CORE`

---

## 4. Profile Sidecar Source Map

For each profile JSON, create a sidecar source map:
1. `case9-default.sources.json`
2. `starlink-like.sources.json`
3. `oneweb-like.sources.json`

Path:
1. `beamHO-bench/src/config/paper-profiles/`

Format:

```json
{
  "profileId": "case9-default",
  "sources": {
    "channel.sfClSource": [
      "STD-3GPP-TR38.811-6.6.2-1"
    ],
    "rlfStateMachine.qOutDb": [
      "PAP-2022-A4EVENT-CORE"
    ],
    "handover.params.timerAlphaOptions": [
      "PAP-2025-TIMERCHO-CORE"
    ]
  }
}
```

Rules:
1. every key affecting KPI outcomes must have at least one `sourceId`
2. if value is engineering assumption, set `sourceId` as `ASSUME-<topic>` and add rationale note in run manifest
3. every non-assumption `sourceId` must resolve to a `canonicalUrl`

---

## 5. Code Annotation Policy

## 5.1 Function/Block Annotations

For key logic blocks, add concise comments:

```ts
// Source: PAP-2022-A4EVENT-CORE
// Locator: Sec. 3 / A3-A4 trigger flow (implemented as threshold + TTT checks)
```

## 5.2 File-Level Provenance Header

For core modules (`events.ts`, `state-machine.ts`, `cho.ts`, `mc-ho.ts`, `large-scale.ts`):

```ts
/**
 * Provenance:
 * - STD-3GPP-TR38.811-6.6.2-1
 * - PAP-2022-A4EVENT-CORE
 * - PAP-2025-TIMERCHO-CORE
 */
```

## 5.3 Comment Quality Rules

1. comments must identify source IDs, not only paper names
2. comments must indicate what was adopted (parameter, formula, or procedure)
3. avoid long narrative comments; keep comments auditable and short

---

## 6. Runtime Trace Artifact

Each run shall emit:
1. `source-trace.json`

Required fields:
1. `scenario_id`
2. `profile_id`
3. `baseline`
4. `seed`
5. `profile_checksum_sha256`
6. `source_catalog_checksum_sha256`
7. `resolvedParameterSources` (path -> sourceId array)
8. `resolvedSourceLinks` (sourceId -> canonicalUrl)
9. `assumptions` (optional list)

Example:

```json
{
  "scenario_id": "VAL-A4-THRESH-SWEEP",
  "profile_id": "case9-default",
  "baseline": "a4",
  "seed": 42,
  "profile_checksum_sha256": "...",
  "source_catalog_checksum_sha256": "...",
  "resolvedParameterSources": {
    "rlfStateMachine.qOutDb": ["PAP-2022-A4EVENT-CORE"],
    "channel.sfClSource": ["STD-3GPP-TR38.811-6.6.2-1"]
  },
  "resolvedSourceLinks": {
    "PAP-2022-A4EVENT-CORE": "https://doi.org/10.1109/APWCS55727.2022.9906486",
    "STD-3GPP-TR38.811-6.6.2-1": "https://www.3gpp.org/ftp/Specs/archive/38_series/38.811/38811-f40.zip"
  },
  "assumptions": []
}
```

---

## 7. Minimum Mapping for Layer A

Minimum required mapping for the first reproducible stack:
1. A3/A4 trigger behavior -> `PAP-2022-A4EVENT-CORE`
2. MC + overlap-driven HO behavior -> `PAP-2024-MCCHO-CORE`
3. timer-based CHO parameters -> `PAP-2025-TIMERCHO-CORE`
4. large-scale NTN SF/CL lookup -> `STD-3GPP-TR38.811-6.6.2-1`
5. starlink-like expansion assumptions -> `PAP-2022-SEAMLESSNTN-CORE`

---

## 8. CI and Review Gate

Add a traceability check in CI:
1. fail if key parameter paths are missing source mappings
2. fail if source IDs used in comments are not present in source catalog
3. fail if run artifact lacks `source-trace.json`

Manual review checklist:
1. can reviewer locate paper/standard for every critical KPI-driving parameter
2. does implementation comment match source map and resolved config
3. are assumptions explicitly labeled and isolated from paper-derived values

---

## 9. Copyright-Safe Reference Management

Repository policy:
1. do not commit third-party full-text binaries (publisher PDFs, 3GPP ZIP/DOC/DOCX) to public git history
2. keep traceability via metadata only: `sourceId`, `canonicalUrl`, `artifactSha256`, version file name
3. store legal/public pointers in lock files:
   - `papers/sdd-required/papers-lock.json`
   - `papers/standards/standards-lock.json`

Operational workflow:
1. retrieve source documents from official URLs outside git history
2. verify local file hash against lock file
3. use only source IDs + locators in code comments and experiment artifacts
