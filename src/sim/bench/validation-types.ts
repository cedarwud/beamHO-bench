import type { CanonicalProfileId, DeepPartial } from '@/config/paper-profiles/loader';
import type { PaperProfile } from '@/config/paper-profiles/types';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import type { BaselineBatchResult } from './runner';

export interface ValidationSuiteCaseDefinition {
  caseId: string;
  baselines: RuntimeBaseline[];
  tickCount: number;
  runtimeOverrides?: DeepPartial<PaperProfile>;
}

export type ValidationTrendMetric = 'handover-rate' | 'hopp' | 'failure-total';
export type ValidationTrendDirection = 'non-increasing' | 'non-decreasing';

export interface ValidationTrendPolicy {
  metric: ValidationTrendMetric;
  direction: ValidationTrendDirection;
  tolerance?: number;
}

export interface ValidationSuiteDefinition {
  validationId: string;
  profileId: CanonicalProfileId;
  requiresFullFidelity?: boolean;
  trendPolicy?: ValidationTrendPolicy;
  cases: ValidationSuiteCaseDefinition[];
}

export interface ValidationCheckResult {
  checkId: string;
  pass: boolean;
  detail: string;
  blocking?: boolean;
}

export interface ValidationSuiteCaseResult {
  validationId: string;
  caseId: string;
  profileId: CanonicalProfileId;
  seed: number;
  trendPolicy: ValidationTrendPolicy | null;
  runtimeOverrides: DeepPartial<PaperProfile>;
  checks: ValidationCheckResult[];
  batch: BaselineBatchResult;
}

export interface ValidationSuiteResult {
  generatedAtUtc: string;
  seed: number;
  results: ValidationSuiteCaseResult[];
  summaryCsv: string;
}

export interface ValidationSuiteOptions {
  seed?: number;
}

export interface ValidationGateFailure {
  validationId: string;
  caseId: string;
  failedChecks: string[];
}

export interface ValidationGateCheckStat {
  checkId: string;
  blocking: boolean;
  evaluatedCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number;
  coverageRate: number;
}

export interface ValidationGateSummary {
  generatedAtUtc: string;
  seed: number;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  warningCases: number;
  totalCheckEvaluations: number;
  passedCheckEvaluations: number;
  failedCheckEvaluations: number;
  failedBlockingCheckEvaluations: number;
  failedNonBlockingCheckEvaluations: number;
  overallCheckPassRate: number;
  pass: boolean;
  checkStats: ValidationGateCheckStat[];
  failures: ValidationGateFailure[];
  warnings: ValidationGateFailure[];
}
