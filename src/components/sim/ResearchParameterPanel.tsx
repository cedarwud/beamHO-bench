import { useMemo, useState } from 'react';
import type { PaperProfile } from '@/config/paper-profiles/types';
import {
  type ResearchConsistencyIssue,
  type ResearchConsistencyMode,
  type ResearchParameterId,
  type ResearchParameterSelection,
  listResearchParameterGroups,
} from '@/config/research-parameters/catalog';
import type { ResearchParameterGroupId } from '@/config/research-parameters/types';
import type { RuntimeBaseline } from '@/sim/handover/baseline-types';

type PanelTab = 'satellite' | 'beam' | 'channel';

const TAB_GROUPS: Record<PanelTab, readonly ResearchParameterGroupId[]> = {
  satellite: ['orbit', 'ue', 'handover'],
  beam: ['beam', 'scheduler'],
  channel: ['linkbudget', 'channel'],
};

const COLLAPSED_BY_DEFAULT: ReadonlySet<ResearchParameterGroupId> = new Set([
  'handover',
  'orbit',
]);

const CORE_SCENARIO_PARAMETER_IDS: readonly ResearchParameterId[] = [
  'constellation.altitudeKm',
  'constellation.activeSatellitesInWindow',
  'constellation.minElevationDeg',
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

export type ResearchPanelTab = PanelTab;

export interface ResearchParameterPanelProps {
  profile: PaperProfile;
  baseline: RuntimeBaseline;
  selection: ResearchParameterSelection;
  consistencyMode: ResearchConsistencyMode;
  consistencyIssues: ResearchConsistencyIssue[];
  onSelectionChange: (parameterId: ResearchParameterId, value: string) => void;
  onConsistencyModeChange: (mode: ResearchConsistencyMode) => void;
  onReset: () => void;
  onTabChange?: (tab: PanelTab) => void;
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
  onTabChange,
}: ResearchParameterPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('satellite');

  const handleTabChange = (tab: PanelTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

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

  const tabGroups = useMemo(() => {
    const allowedGroupIds = new Set(TAB_GROUPS[activeTab]);
    return groups
      .filter(({ group }) => allowedGroupIds.has(group.id))
      .map(({ group, specs }) => ({
        group,
        specs: specs.filter((spec) => !coreParameterIds.has(spec.id)),
      }))
      .filter((entry) => entry.specs.length > 0);
  }, [activeTab, coreParameterIds, groups]);

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

  const tabs: { key: PanelTab; label: string }[] = [
    { key: 'satellite', label: 'Satellite' },
    { key: 'beam', label: 'Beam' },
    { key: 'channel', label: 'Channel' },
  ];

  return (
    <section className="sim-research-panel" aria-label="Research parameters">
      <div className="sim-research-panel__header">
        <div className="sim-research-panel__title">Research Parameters</div>
      </div>
      <nav className="sim-research-tabs" aria-label="Parameter category">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`sim-research-tab${activeTab === tab.key ? ' sim-research-tab--active' : ''}`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {activeTab === 'satellite' ? (
        <>
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
        </>
      ) : null}
      {tabGroups.map(({ group, specs }) => {
        const collapsed = COLLAPSED_BY_DEFAULT.has(group.id);
        return collapsed ? (
          <details key={group.id} className="sim-research-collapsible">
            <summary className="sim-research-collapsible__summary">
              <span className="sim-research-collapsible__arrow">&#9656;</span>
              <span>{group.label}</span>
              <span className="sim-research-collapsible__badge">{specs.length} params</span>
            </summary>
            <div className="sim-research-group__grid">
              {specs.map((spec) => renderParameterField(spec.id))}
            </div>
          </details>
        ) : (
          <section key={group.id} className="sim-research-section">
            <header className="sim-research-section__header">
              <h4>{group.label}</h4>
            </header>
            <div className="sim-research-group__grid">
              {specs.map((spec) => renderParameterField(spec.id))}
            </div>
          </section>
        );
      })}
    </section>
  );
}
