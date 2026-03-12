import { useMemo } from 'react';
import type { PaperProfile } from '@/config/paper-profiles/types';
import {
  type ResearchConsistencyIssue,
  type ResearchConsistencyMode,
  type ResearchParameterId,
  type ResearchParameterSelection,
  listResearchParameterGroups,
} from '@/config/research-parameters/catalog';
import type { RuntimeBaseline } from '@/sim/handover/baseline-types';

const CORE_SCENARIO_PARAMETER_IDS: readonly ResearchParameterId[] = [
  'constellation.syntheticTrajectoryModel',
  'constellation.altitudeKm',
  'constellation.activeSatellitesInWindow',
  'handover.params.candidateSatelliteLimit',
  'constellation.minElevationDeg',
  'beam.overlapRatio',
  'ue.speedKmph',
];

const BASELINE_PARAMETER_IDS: Record<RuntimeBaseline, readonly ResearchParameterId[]> = {
  'max-rsrp': [],
  'max-elevation': [],
  'max-remaining-time': [],
  a3: [
    'handover.params.a3OffsetDb',
    'handover.params.a3TttMs',
    'handover.params.homDb',
  ],
  a4: [
    'handover.params.a4ThresholdDbm',
    'handover.params.a3TttMs',
    'handover.params.homDb',
  ],
  cho: [
    'handover.params.a3OffsetDb',
    'handover.params.a4ThresholdDbm',
    'handover.params.homDb',
    'handover.params.mtsSec',
    'handover.params.timerAlpha',
  ],
  'mc-ho': [
    'handover.params.a3OffsetDb',
    'handover.params.a4ThresholdDbm',
    'handover.params.homDb',
  ],
};

export interface ResearchParameterPanelProps {
  profile: PaperProfile;
  baseline: RuntimeBaseline;
  selection: ResearchParameterSelection;
  consistencyMode: ResearchConsistencyMode;
  consistencyIssues: ResearchConsistencyIssue[];
  onSelectionChange: (parameterId: ResearchParameterId, value: string) => void;
  onConsistencyModeChange: (mode: ResearchConsistencyMode) => void;
  onReset: () => void;
}

export function ResearchParameterPanel({
  profile,
  baseline,
  selection,
  consistencyMode,
  consistencyIssues,
  onSelectionChange,
  onConsistencyModeChange,
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
  const visibleSpecById = useMemo(
    () =>
      new Map(
        groups.flatMap(({ specs }) =>
          specs.map((spec) => [spec.id, spec] as const),
        ),
      ),
    [groups],
  );
  const baselineParameterIds = BASELINE_PARAMETER_IDS[baseline];
  const coreParameterIds = useMemo(
    () => new Set([...CORE_SCENARIO_PARAMETER_IDS, ...baselineParameterIds]),
    [baselineParameterIds],
  );
  const coreScenarioSpecs = useMemo(
    () =>
      CORE_SCENARIO_PARAMETER_IDS.map((parameterId) => visibleSpecById.get(parameterId)).filter(
        (spec): spec is NonNullable<typeof spec> => Boolean(spec),
      ),
    [visibleSpecById],
  );
  const coreBaselineSpecs = useMemo(
    () =>
      baselineParameterIds.map((parameterId) => visibleSpecById.get(parameterId)).filter(
        (spec): spec is NonNullable<typeof spec> => Boolean(spec),
      ),
    [baselineParameterIds, visibleSpecById],
  );
  const advancedGroups = useMemo(
    () =>
      groups
        .map(({ group, specs }) => ({
          group,
          specs: specs.filter((spec) => !coreParameterIds.has(spec.id)),
        }))
        .filter((entry) => entry.specs.length > 0),
    [coreParameterIds, groups],
  );
  const advancedCount = useMemo(
    () => advancedGroups.reduce((sum, entry) => sum + entry.specs.length, 0),
    [advancedGroups],
  );
  const advancedSummary = useMemo(() => {
    if (consistencyIssues.length > 0) {
      return `${advancedCount} params | ${consistencyIssues.length} issues`;
    }
    return `${advancedCount} params`;
  }, [advancedCount, consistencyIssues.length]);

  const renderParameterField = (parameterId: ResearchParameterId) => {
    const spec = visibleSpecById.get(parameterId);
    if (!spec) {
      return null;
    }

    const domId = `param-${spec.id.replace(/\./g, '-')}`;

    return (
      <label
        key={spec.id}
        className="sim-research-param sim-research-param--compact"
        htmlFor={domId}
      >
        <span className="sim-research-param__name">{spec.label}</span>
        <select
          id={domId}
          value={selection[spec.id]}
          onChange={(event) => onSelectionChange(spec.id, event.target.value)}
          aria-label={spec.label}
        >
          {spec.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <section className="sim-research-panel" aria-label="Research parameters">
      <div className="sim-research-panel__header">
        <div className="sim-research-panel__title">Research Parameters</div>
        <div className="sim-research-panel__toolbar">
          <button type="button" onClick={onReset}>
            Reset To Profile
          </button>
        </div>
      </div>
      <section className="sim-research-section">
        <header className="sim-research-section__header">
          <h4>Core Scenario Controls</h4>
        </header>
        <div className="sim-research-group__grid">
          {coreScenarioSpecs.map((spec) => renderParameterField(spec.id))}
        </div>
      </section>
      {coreBaselineSpecs.length > 0 ? (
        <section className="sim-research-section">
          <header className="sim-research-section__header">
            <h4>Baseline Trigger Controls</h4>
          </header>
          <div className="sim-research-group__grid">
            {coreBaselineSpecs.map((spec) => renderParameterField(spec.id))}
          </div>
        </section>
      ) : null}
      <details className="sim-research-advanced">
        <summary>
          Advanced & Diagnostics <span>({advancedSummary})</span>
        </summary>
        <div className="sim-research-advanced__body">
          <section className="sim-research-group">
            <header className="sim-research-group__header">
              <h4>Diagnostics</h4>
            </header>
            <div className="sim-research-group__grid">
              <label
                className="sim-research-param sim-research-param--compact"
                htmlFor="param-consistency-mode"
              >
                <span className="sim-research-param__name">Consistency Mode</span>
                <select
                  id="param-consistency-mode"
                  value={consistencyMode}
                  onChange={(event) =>
                    onConsistencyModeChange(event.target.value as ResearchConsistencyMode)
                  }
                  aria-label="Consistency Mode"
                >
                  <option value="strict">strict</option>
                  <option value="exploratory">exploratory</option>
                </select>
              </label>
            </div>
            {consistencyIssues.length > 0 ? (
              <section className="sim-research-consistency" aria-label="Consistency checks">
                <div className="sim-research-consistency__title">
                  Consistency Checks ({consistencyIssues.length})
                </div>
                <ul className="sim-research-consistency__list">
                  {consistencyIssues.map((issue, index) => (
                    <li
                      key={`${issue.ruleId}:${issue.messageCode}:${index}`}
                      className={`sim-research-consistency__item sim-research-consistency__item--${issue.severity}`}
                    >
                      [{issue.severity}] {issue.ruleId}: {issue.message}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </section>
          {advancedGroups.map(({ group, specs }) => (
            <section key={group.id} className="sim-research-group">
              <header className="sim-research-group__header">
                <h4>{group.label}</h4>
              </header>
              <div className="sim-research-group__grid">
                {specs.map((spec) => renderParameterField(spec.id))}
              </div>
            </section>
          ))}
        </div>
      </details>
    </section>
  );
}
