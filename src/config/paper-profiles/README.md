# Paper Profiles

This folder defines reproducible scenario profiles for `beamHO-bench`.

## Files
- `paper-profile.schema.json`: JSON schema for profile validation.
- `case9-default.json`: synthetic 3GPP case-9 style baseline profile.
- `starlink-like.json`: real-trace profile using Starlink TLE files.
- `oneweb-like.json`: real-trace profile using OneWeb TLE files.

## Intended usage
1. Load one profile as the base scenario.
2. Apply experiment-specific overrides (`seed`, `ue.count`, `deployment`, etc.).
3. Persist run metadata using:
   - `scenario_id`
   - `random_seed`
   - `paper_profile`

## Notes
- `case9-default` is the default first implementation target.
- `starlink-like` and `oneweb-like` are for SGP4/TLE real-trace mode.
- Keep KPI definitions unchanged across profiles to ensure fair comparisons.
