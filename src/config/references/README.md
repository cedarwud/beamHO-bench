# Reference Catalog

This folder stores source metadata used for code and experiment traceability.

## Files
- `paper-sources.json`: source catalog used by `paper-profiles/loader.ts`.

## Policy
1. Keep only metadata in git (`sourceId`, URL/DOI, checksum, locator).
2. Do not commit third-party full-text binaries to public history.
3. Ensure every `sourceId` in `*.sources.json` exists in `paper-sources.json`.
