# 3GPP Standards Index for beamHO-bench

Last updated: 2026-03-01

This index maps downloaded 3GPP standards to `beamHO-bench` modules and profile parameter paths, so code comments and experiment artifacts can be traced to a concrete standard source.

Compliance note:
1. Third-party full-text standard files (`.zip/.doc/.docx`) are intentionally git-ignored.
2. Public traceability is provided by `standards-lock.json` (official URL + SHA256), not by redistributing the full files.

---

## 1. Local Standard Files

| Standard | Source ID | ZIP | Extracted file | Official archive URL |
|---|---|---|---|---|
| TR 38.811 | `STD-3GPP-TR38.811-6.6.2-1` | `38811-f40.zip` | `38811-f40/38811-f40.doc` | `https://www.3gpp.org/ftp/Specs/archive/38_series/38.811/38811-f40.zip` |
| TR 38.821 | `STD-3GPP-TR38.821-NTN` | `38821-g20.zip` | `38821-g20/38821-g20.doc` | `https://www.3gpp.org/ftp/Specs/archive/38_series/38.821/38821-g20.zip` |
| TS 38.331 | `STD-3GPP-TS38.331-RRC` | `38331-j10.zip` | `38331-j10/38331-j10.docx` | `https://www.3gpp.org/ftp/Specs/archive/38_series/38.331/38331-j10.zip` |
| TS 38.321 | `STD-3GPP-TS38.321-MAC` | `38321-j10.zip` | `38321-j10/38321-j10.docx` | `https://www.3gpp.org/ftp/Specs/archive/38_series/38.321/38321-j10.zip` |
| TS 38.322 | `STD-3GPP-TS38.322-RLC` | `38322-j10.zip` | `38322-j10/38322-j10.docx` | `https://www.3gpp.org/ftp/Specs/archive/38_series/38.322/38322-j10.zip` |

Version lock and official URLs:
1. `papers/standards/standards-lock.json`

---

## 2. Traceability Mapping

## 2.1 TR 38.811 (NTN Channel/Propagation Baseline)

- Source ID: `STD-3GPP-TR38.811-6.6.2-1`
- Main SDD module:
1. `src/sim/channel/large-scale.ts`
- Profile parameter paths:
1. `channel.largeScaleModel`
2. `channel.sfClSource`
3. `constellation.minElevationDeg` (service visibility threshold usage)

Comment template:

```ts
// Source: STD-3GPP-TR38.811-6.6.2-1
// Applied to SF/CL lookup and elevation-dependent large-scale NTN loss.
```

## 2.2 TR 38.821 (NTN Study Procedures and Design Constraints)

- Source ID: `STD-3GPP-TR38.821-NTN`
- Main SDD modules:
1. `src/sim/handover/cho.ts`
2. `src/sim/handover/mc-ho.ts`
- Profile parameter paths:
1. procedure-level reference only (no fixed numeric key pinned to TR 38.821 in v1)

Comment template:

```ts
// Source: STD-3GPP-TR38.821-NTN
// Applied as NTN procedure-level reference for CHO/MC flow design.
```

## 2.3 TS 38.331 (RRC Events and RLF State Controls)

- Source ID: `STD-3GPP-TS38.331-RRC`
- Main SDD modules:
1. `src/sim/handover/events.ts`
2. `src/sim/handover/state-machine.ts`
- Profile parameter paths:
1. `handover.params.a3OffsetDb`
2. `handover.params.a3TttMs`
3. `handover.params.a4ThresholdDbm`
4. `handover.params.homDb`
5. `rlfStateMachine.qOutDb`
6. `rlfStateMachine.qInDb`
7. `rlfStateMachine.t310Ms`
8. `rlfStateMachine.n310`
9. `rlfStateMachine.n311`
10. `rlfStateMachine.l3FilterK`

Comment template:

```ts
// Source: STD-3GPP-TS38.331-RRC
// Applied to A3/A4 trigger conditions and RLF-related RRC timers/counters.
```

## 2.4 TS 38.321 (MAC Retransmission and Random Access Timers)

- Source ID: `STD-3GPP-TS38.321-MAC`
- Main SDD module:
1. `src/sim/handover/state-machine.ts`
- Profile parameter paths:
1. `rlfStateMachine.harqMaxRetx`
2. `rlfStateMachine.preambleMsg3MaxRetx`
3. `rlfStateMachine.raResponseTimerSubframes`
4. `rlfStateMachine.contentionResolutionTimerSubframes`

Comment template:

```ts
// Source: STD-3GPP-TS38.321-MAC
// Applied to HARQ/RA retry limits and MAC-layer timers during HO completion.
```

## 2.5 TS 38.322 (RLC Retransmission Behavior)

- Source ID: `STD-3GPP-TS38.322-RLC`
- Main SDD module:
1. `src/sim/handover/state-machine.ts`
- Profile parameter path:
1. `rlfStateMachine.rlcMaxRetx`

Comment template:

```ts
// Source: STD-3GPP-TS38.322-RLC
// Applied to RLC retransmission bound in HOF/RLF evaluation flow.
```

---

## 3. Implementation Checklist

1. Add these source IDs to `src/config/references/paper-sources.json`.
2. Add matching path mappings to `src/config/paper-profiles/*.sources.json`.
3. Add provenance comments in key modules listed above.
4. Export the resolved mapping in run artifact `source-trace.json`.
