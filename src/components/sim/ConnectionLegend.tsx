import { useMemo } from 'react';
import type { UEState } from '@/sim/types';

export interface LinkVisibility {
  serving: boolean;
  secondary: boolean;
  prepared: boolean;
}

export interface ConnectionLegendProps {
  ues: UEState[];
  visibility: LinkVisibility;
  onChange: (next: LinkVisibility) => void;
}

interface LinkCounts {
  serving: number;
  secondary: number;
  prepared: number;
}

function computeLinkCounts(ues: UEState[]): LinkCounts {
  let serving = 0;
  let secondary = 0;
  let prepared = 0;

  for (const ue of ues) {
    if (ue.servingSatId !== null && ue.servingBeamId !== null) {
      serving += 1;
    }

    if (
      ue.secondarySatId !== null &&
      ue.secondaryBeamId !== null &&
      (ue.secondarySatId !== ue.servingSatId || ue.secondaryBeamId !== ue.servingBeamId)
    ) {
      secondary += 1;
    }

    if (
      ue.choPreparedSatId !== null &&
      ue.choPreparedBeamId !== null &&
      (ue.choPreparedSatId !== ue.servingSatId || ue.choPreparedBeamId !== ue.servingBeamId) &&
      (ue.choPreparedSatId !== ue.secondarySatId ||
        ue.choPreparedBeamId !== ue.secondaryBeamId)
    ) {
      prepared += 1;
    }
  }

  return { serving, secondary, prepared };
}

export function ConnectionLegend({ ues, visibility, onChange }: ConnectionLegendProps) {
  const counts = useMemo(() => computeLinkCounts(ues), [ues]);

  return (
    <div className="sim-link-legend">
      <label className="sim-link-legend__item">
        <input
          type="checkbox"
          checked={visibility.serving}
          onChange={(event) =>
            onChange({
              ...visibility,
              serving: event.target.checked,
            })
          }
        />
        <span className="sim-link-legend__swatch sim-link-legend__swatch--serving" />
        serving ({counts.serving})
      </label>
      <label className="sim-link-legend__item">
        <input
          type="checkbox"
          checked={visibility.secondary}
          onChange={(event) =>
            onChange({
              ...visibility,
              secondary: event.target.checked,
            })
          }
        />
        <span className="sim-link-legend__swatch sim-link-legend__swatch--secondary" />
        secondary ({counts.secondary})
      </label>
      <label className="sim-link-legend__item">
        <input
          type="checkbox"
          checked={visibility.prepared}
          onChange={(event) =>
            onChange({
              ...visibility,
              prepared: event.target.checked,
            })
          }
        />
        <span className="sim-link-legend__swatch sim-link-legend__swatch--prepared" />
        prepared ({counts.prepared})
      </label>
    </div>
  );
}
