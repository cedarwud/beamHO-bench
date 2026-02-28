# TLE Fixtures

This folder contains sampled orbit-element fixtures generated from local `tle_data`.

## Files
- `starlink-sample.json`
- `oneweb-sample.json`

## Regeneration
Run:

```bash
npm run sync:tle-fixtures
```

Optional environment variables:
- `TLE_SOURCE_ROOT` (default: `../tle_data`)
- `TLE_MAX_STARLINK` (default: `320`)
- `TLE_MAX_ONEWEB` (default: `180`)

## Notes
- Fixtures are sampled subsets for frontend runtime performance.
- They are used by `src/sim/orbit/sgp4.ts` as current real-trace input data.
