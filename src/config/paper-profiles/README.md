# Paper Profiles

This folder defines reproducible scenario profiles for `beamHO-bench`.

## Files
- `paper-profile.schema.json`: JSON schema for profile validation.
- `starlink-like.json`: real-trace profile using Starlink TLE files.
- `oneweb-like.json`: real-trace profile using OneWeb TLE files.
- `starlink-like.sources.json`: parameter-to-source mapping for traceability.
- `oneweb-like.sources.json`: parameter-to-source mapping for traceability.
- `loader.ts`: canonical profile loader, deep merge, schema and source-map validation.

## Required traceability fields
- `channel.noiseFigureDb` and `channel.systemLossDb` must be present and mapped in `*.sources.json`.
- `channel.smallScaleModel` and `channel.smallScaleParams.*` must be present for deterministic fading plugins.
- `handover.algorithmFidelity` (`full` or `simplified`) must be present and exported in run metadata.
- Engineering assumptions must use `ASSUME-*` source IDs in `src/config/references/paper-sources.json`.

## Intended usage
1. Load one profile as the base scenario.
2. Apply experiment-specific overrides (`seed`, `ue.count`, `deployment`, etc.).
3. Persist run metadata using:
   - `scenario_id`
   - `random_seed`
   - `paper_profile`

Minimal example:

```ts
import { loadPaperProfile, loadProfileSourceMap } from '@/config/paper-profiles/loader';

const profile = loadPaperProfile('starlink-like', {
  handover: { params: { a4ThresholdDbm: -101 } },
});

const sourceMap = loadProfileSourceMap('starlink-like');
```

## Notes
- `starlink-like` is the default profile.
- `oneweb-like` is an alternative real-trace profile using OneWeb TLE files.
- Keep KPI definitions unchanged across profiles to ensure fair comparisons.
- Source catalog is defined at `src/config/references/paper-sources.json`.
