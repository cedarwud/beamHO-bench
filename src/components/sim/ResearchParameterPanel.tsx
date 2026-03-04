import { useMemo } from 'react';
import type { PaperProfile } from '@/config/paper-profiles/types';
import {
  type ResearchParameterId,
  type ResearchParameterSelection,
  listResearchParameterGroups,
} from '@/config/research-parameters/catalog';

export interface ResearchParameterPanelProps {
  profile: PaperProfile;
  selection: ResearchParameterSelection;
  onSelectionChange: (parameterId: ResearchParameterId, value: string) => void;
  onReset: () => void;
}

export function ResearchParameterPanel({
  profile,
  selection,
  onSelectionChange,
  onReset,
}: ResearchParameterPanelProps) {
  const groups = useMemo(
    () =>
      listResearchParameterGroups({
        profile,
        selection,
      }),
    [profile, selection],
  );

  return (
    <section className="sim-research-panel" aria-label="Research parameters">
      <div className="sim-research-panel__header">
        <div className="sim-research-panel__title">Research Parameters</div>
        <button type="button" onClick={onReset}>
          Reset To Profile
        </button>
      </div>
      <div className="sim-research-panel__meta">
        只顯示會影響換手/鏈路/排程結果的參數。
      </div>
      {groups.map(({ group, specs }) => (
        <section key={group.id} className="sim-research-group">
          <header className="sim-research-group__header">
            <h4>{group.label}</h4>
            <p>{group.description}</p>
          </header>
          <div className="sim-research-group__grid">
            {specs.map((spec) => {
              const domId = `param-${spec.id.replace(/\./g, '-')}`;
              return (
                <label key={spec.id} className="sim-research-param" htmlFor={domId}>
                  <span className="sim-research-param__name">{spec.label}</span>
                  <select
                    id={domId}
                    value={selection[spec.id]}
                    onChange={(event) => onSelectionChange(spec.id, event.target.value)}
                  >
                    {spec.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="sim-research-param__desc">{spec.description}</span>
                  <span className="sim-research-param__sources">
                    source: {spec.sourceIds.join(', ')}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}

