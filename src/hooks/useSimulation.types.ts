import type { CanonicalProfileId, DeepPartial } from '@/config/paper-profiles/loader';
import type { PaperProfile } from '@/config/paper-profiles/types';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import type { RuntimeParameterAuditSnapshot } from '@/sim/audit/runtime-parameter-audit';
import type {
  KpiResultArtifact,
} from '@/sim/kpi/reporter';
import type { RunManifest } from '@/sim/reporting/manifest';
import type { SourceTraceArtifact } from '@/sim/reporting/source-trace';
import type { BaselineBatchResult } from '@/sim/bench/runner';
import type { ValidationGateSummary, ValidationSuiteResult } from '@/sim/bench/validation-suite';
import type { SimSnapshot } from '@/sim/types';

export interface UseSimulationOptions {
  profileId?: CanonicalProfileId;
  runtimeOverrides?: DeepPartial<PaperProfile>;
  baseline?: RuntimeBaseline;
  seed?: number;
  autoStart?: boolean;
  playbackRate?: number;
}

export interface KpiExportArtifact {
  resultArtifact: KpiResultArtifact;
  timeseriesCsv: string;
}

export interface BaselineComparisonExportArtifact {
  batch: BaselineBatchResult;
}

export interface ValidationSuiteExportArtifact {
  suite: ValidationSuiteResult;
  gateSummary: ValidationGateSummary;
}

export interface RunBundleExportArtifact {
  manifest: RunManifest;
  sourceTrace: SourceTraceArtifact;
  resultArtifact: KpiResultArtifact;
  resolvedProfile: PaperProfile;
  timeseriesCsv: string;
  validationGateSummary: ValidationGateSummary;
  runtimeParameterAudit: RuntimeParameterAuditSnapshot | null;
}

export interface UseSimulationResult {
  profile: PaperProfile;
  snapshot: SimSnapshot;
  baseline: RuntimeBaseline;
  isRunning: boolean;
  playbackRate: number;
  sourceTraceFileName: string;
  kpiResultFileName: string;
  kpiTimeseriesFileName: string;
  start: () => void;
  stop: () => void;
  step: () => void;
  reset: () => void;
  setPlaybackRate: (value: number) => void;
  exportSourceTrace: () => Promise<SourceTraceArtifact>;
  exportKpiReport: () => KpiExportArtifact;
  exportBaselineComparison: () => BaselineComparisonExportArtifact;
  exportValidationSuite: () => ValidationSuiteExportArtifact;
  exportRunBundle: () => Promise<RunBundleExportArtifact>;
}

export const RUNTIME_BASELINES: RuntimeBaseline[] = [
  'max-rsrp',
  'max-elevation',
  'max-remaining-time',
  'a3',
  'a4',
  'cho',
  'mc-ho',
];

const RUNTIME_BASELINE_SET = new Set<RuntimeBaseline>(RUNTIME_BASELINES);

export function isRuntimeBaseline(value: string): value is RuntimeBaseline {
  return RUNTIME_BASELINE_SET.has(value as RuntimeBaseline);
}
