# Paper Profiles

This folder defines reproducible scenario profiles for `beamHO-bench`.

## Files
- `paper-profile.schema.json`: JSON schema for profile validation.
- `case9-default.json`: synthetic 3GPP case-9 style baseline profile.
- `starlink-like.json`: real-trace profile using Starlink TLE files.
- `oneweb-like.json`: real-trace profile using OneWeb TLE files.
- `case9-default.sources.json`: parameter-to-source mapping for traceability.
- `starlink-like.sources.json`: parameter-to-source mapping for traceability.
- `oneweb-like.sources.json`: parameter-to-source mapping for traceability.
- `loader.ts`: canonical profile loader, deep merge, schema and source-map validation.

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

const profile = loadPaperProfile('case9-default', {
  handover: { params: { a4ThresholdDbm: -101 } },
});

const sourceMap = loadProfileSourceMap('case9-default');
```

## Notes
- `case9-default` is the default first implementation target.
- `starlink-like` and `oneweb-like` are for SGP4/TLE real-trace mode.
- Keep KPI definitions unchanged across profiles to ensure fair comparisons.
- Source catalog is defined at `src/config/references/paper-sources.json`.
