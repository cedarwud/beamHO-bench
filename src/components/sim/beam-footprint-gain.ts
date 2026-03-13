import type { GainModel } from '@/config/paper-profiles/types';

export interface BeamFootprintBand {
  innerRadiusRatio: number;
  outerRadiusRatio: number;
  opacity: number;
}

const FLAT_BANDS: BeamFootprintBand[] = [
  {
    innerRadiusRatio: 0,
    outerRadiusRatio: 0.96,
    opacity: 0.18,
  },
  {
    innerRadiusRatio: 0.96,
    outerRadiusRatio: 1,
    opacity: 0.34,
  },
];

const BESSEL_J1_BANDS: BeamFootprintBand[] = [
  {
    innerRadiusRatio: 0,
    outerRadiusRatio: 0.28,
    opacity: 0.4,
  },
  {
    innerRadiusRatio: 0.28,
    outerRadiusRatio: 0.52,
    opacity: 0.25,
  },
  {
    innerRadiusRatio: 0.52,
    outerRadiusRatio: 0.74,
    opacity: 0.14,
  },
  {
    innerRadiusRatio: 0.74,
    outerRadiusRatio: 0.9,
    opacity: 0.08,
  },
  {
    innerRadiusRatio: 0.9,
    outerRadiusRatio: 1,
    opacity: 0.2,
  },
];

const BESSEL_J1_J3_BANDS: BeamFootprintBand[] = [
  {
    innerRadiusRatio: 0,
    outerRadiusRatio: 0.24,
    opacity: 0.44,
  },
  {
    innerRadiusRatio: 0.24,
    outerRadiusRatio: 0.42,
    opacity: 0.28,
  },
  {
    innerRadiusRatio: 0.42,
    outerRadiusRatio: 0.58,
    opacity: 0.19,
  },
  {
    innerRadiusRatio: 0.58,
    outerRadiusRatio: 0.72,
    opacity: 0.13,
  },
  {
    innerRadiusRatio: 0.72,
    outerRadiusRatio: 0.86,
    opacity: 0.09,
  },
  {
    innerRadiusRatio: 0.86,
    outerRadiusRatio: 1,
    opacity: 0.17,
  },
];

function scaleOpacity(baseOpacity: number, visible: boolean): number {
  const scaled = visible ? baseOpacity : baseOpacity * 0.5;
  return Number(scaled.toFixed(4));
}

export function resolveBeamFootprintBands(
  gainModel: GainModel,
  visible: boolean,
): BeamFootprintBand[] {
  // Source: sdd/completed/implemented-specs/beamHO-bench-gap-closure-sdd.md §3.2
  // Visualization-only intensity profile switches by profile.beam.gainModel.
  const template =
    gainModel === 'bessel-j1'
      ? BESSEL_J1_BANDS
      : gainModel === 'bessel-j1-j3'
        ? BESSEL_J1_J3_BANDS
        : FLAT_BANDS;

  return template.map((band) => ({
    ...band,
    opacity: scaleOpacity(band.opacity, visible),
  }));
}
