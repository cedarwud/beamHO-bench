#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const PROFILE_IDS = ['case9-default', 'starlink-like', 'oneweb-like'];
const REQUIRED_LAYER_D_ROLE_IDS = ['morl', 'c-ucgm', 'ldaps-daps'];

const REQUIRED_SOURCE_PATHS = [
  'channel.sfClSource',
  'channel.smallScaleModel',
  'channel.throughputModel.model',
  'channel.throughputModel.mcsTable',
  'channel.smallScaleParams.shadowedRician.kFactorMinDb',
  'channel.smallScaleParams.shadowedRician.kFactorMaxDb',
  'channel.smallScaleParams.shadowedRician.shadowingStdDevDb',
  'channel.smallScaleParams.shadowedRician.multipathStdDevDb',
  'channel.smallScaleParams.loo.shadowingStdDevDb',
  'channel.smallScaleParams.loo.rayleighScaleDb',
  'channel.noiseFigureDb',
  'channel.systemLossDb',
  'handover.algorithmFidelity',
  'handover.params.a4ThresholdDbm',
  'handover.params.homDb',
  'handover.params.timerAlphaOptions',
  'scheduler.mode',
  'scheduler.windowPeriodSec',
  'scheduler.activeWindowFraction',
  'scheduler.minActiveBeamsPerSatellite',
  'scheduler.maxActiveBeamsPerSatellite',
  'scheduler.frequencyBlockCount',
  'scheduler.maxUsersPerActiveBeam',
  'scheduler.fairnessTargetJain',
  'rlfStateMachine.qOutDb',
  'rlfStateMachine.qInDb',
  'rlfStateMachine.t310Ms',
  'rlfStateMachine.n310',
  'rlfStateMachine.n311',
  'rlfStateMachine.l3FilterK',
  'rlfStateMachine.harqMaxRetx',
  'rlfStateMachine.rlcMaxRetx',
  'rlfStateMachine.preambleMsg3MaxRetx',
  'rlfStateMachine.raResponseTimerSubframes',
  'rlfStateMachine.contentionResolutionTimerSubframes',
];

const CRITICAL_PROVENANCE_FILES = [
  'src/sim/channel/large-scale.ts',
  'src/sim/channel/link-budget.ts',
  'src/sim/channel/small-scale.ts',
  'src/sim/handover/baselines.ts',
  'src/sim/handover/state-machine.ts',
  'src/sim/orbit/sgp4.ts',
  'src/sim/scenarios/case9-analytic.ts',
  'src/sim/scenarios/real-trace.ts',
  'src/sim/kpi/accumulator.ts',
  'src/sim/kpi/reporter.ts',
  'src/sim/policy/types.ts',
  'src/sim/policy/noop-plugin.ts',
  'src/sim/policy/runtime-adapter.ts',
  'src/sim/policy/runtime-session.ts',
  'src/sim/scheduler/types.ts',
  'src/sim/scheduler/window-engine.ts',
  'src/sim/scheduler/coupled-resolver.ts',
  'src/sim/reporting/source-trace.ts',
  'src/sim/reporting/manifest.ts',
  'src/sim/engine.ts',
  'src/sim/bench/validation-suite.ts',
  'src/sim/bench/rerun-contract.ts',
  'src/sim/bench/cli-rerun-contract.ts',
  'src/sim/types.ts',
  'src/sim/util/rng.ts',
  'src/config/paper-profiles/loader.ts',
  'src/config/paper-profiles/types.ts',
  'src/config/references/layer-d-role-mapping.ts',
  'src/config/ntpu.config.ts',
];

const RLF_REQUIRED_REFERENCES = [
  'cfg.qOutDb',
  'cfg.qInDb',
  'cfg.t310Ms',
  'cfg.n310',
  'cfg.n311',
  'cfg.l3FilterK',
  'cfg.harqMaxRetx',
  'cfg.rlcMaxRetx',
  'cfg.preambleMsg3MaxRetx',
  'cfg.raResponseTimerSubframes',
  'cfg.contentionResolutionTimerSubframes',
];

const LINK_BUDGET_REQUIRED_REFERENCES = [
  'profile.channel.carrierFrequencyGHz',
  'profile.channel.bandwidthMHz',
  'profile.channel.noiseTemperatureK',
  'profile.channel.noiseFigureDb',
  'profile.channel.systemLossDb',
  'profile.channel.throughputModel.model',
  'profile.channel.throughputModel.mcsTable',
  'profile.beam.eirpDensityDbwPerMHz',
];

const SMALL_SCALE_REQUIRED_REFERENCES = [
  'profile.channel.smallScaleModel',
  'profile.channel.smallScaleParams?.shadowedRician',
  'profile.channel.smallScaleParams?.loo',
];

const SCHEDULER_REQUIRED_REFERENCES = [
  'profile.scheduler.mode',
  'profile.scheduler.windowPeriodSec',
  'profile.scheduler.activeWindowFraction',
  'profile.scheduler.minActiveBeamsPerSatellite',
  'profile.scheduler.maxActiveBeamsPerSatellite',
  'profile.scheduler.frequencyBlockCount',
  'profile.scheduler.maxUsersPerActiveBeam',
  'profile.scheduler.fairnessTargetJain',
];

const LINK_BUDGET_FORBIDDEN_PATTERNS = [
  /SYSTEM_LOSS_DB/,
  /WORLD_PER_KM/,
  /noiseFigureDb\s*=\s*\d/,
  /systemLossDb\s*=\s*\d/,
];

async function readJson(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const content = await readFile(absolutePath, 'utf8');
  return JSON.parse(content);
}

async function readText(relativePath) {
  return readFile(path.join(ROOT, relativePath), 'utf8');
}

async function listFilesRecursively(relativeDir) {
  const absoluteDir = path.join(ROOT, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativeEntryPath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFilesRecursively(relativeEntryPath);
      files.push(...nested);
      continue;
    }

    files.push(relativeEntryPath);
  }

  return files;
}

function hasPath(obj, dottedPath) {
  const segments = dottedPath.split('.');
  let cursor = obj;

  for (const segment of segments) {
    if (cursor === null || typeof cursor !== 'object' || !(segment in cursor)) {
      return false;
    }
    cursor = cursor[segment];
  }

  return true;
}

function pushError(errors, message) {
  errors.push(`ERROR: ${message}`);
}

function pushWarning(warnings, message) {
  warnings.push(`WARN: ${message}`);
}

function validateSourceCatalog(sourceCatalog, errors) {
  if (!Array.isArray(sourceCatalog.entries) || sourceCatalog.entries.length === 0) {
    pushError(errors, 'Source catalog must contain at least one entry.');
    return new Map();
  }

  const byId = new Map();
  for (const entry of sourceCatalog.entries) {
    if (!entry || typeof entry !== 'object') {
      pushError(errors, 'Source catalog entry must be an object.');
      continue;
    }

    if (!entry.sourceId || typeof entry.sourceId !== 'string') {
      pushError(errors, 'Source catalog entry is missing sourceId.');
      continue;
    }

    if (byId.has(entry.sourceId)) {
      pushError(errors, `Duplicate sourceId '${entry.sourceId}' in source catalog.`);
      continue;
    }

    byId.set(entry.sourceId, entry);
  }

  return byId;
}

function validateLayerDRoleMapping(layerDRoleMapping, sourceCatalogById, errors) {
  if (!layerDRoleMapping || typeof layerDRoleMapping !== 'object') {
    pushError(errors, 'layer-d-role-mapping.json is missing or invalid.');
    return;
  }

  const entries = layerDRoleMapping.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    pushError(errors, 'layer-d-role-mapping.json must include non-empty entries array.');
    return;
  }

  const seenRoles = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      pushError(errors, 'layer-d-role-mapping.json entry must be an object.');
      continue;
    }

    if (!entry.roleId || typeof entry.roleId !== 'string') {
      pushError(errors, 'layer-d-role-mapping.json entry missing roleId.');
      continue;
    }

    if (seenRoles.has(entry.roleId)) {
      pushError(
        errors,
        `layer-d-role-mapping.json contains duplicate roleId '${entry.roleId}'.`,
      );
    }
    seenRoles.add(entry.roleId);

    if (!Array.isArray(entry.sourceIds) || entry.sourceIds.length === 0) {
      pushError(
        errors,
        `layer-d-role-mapping.json role '${entry.roleId}' must include at least one sourceId.`,
      );
      continue;
    }

    if (!entry.sourceIds.some((sourceId) => sourceId.startsWith('PAP-'))) {
      pushError(
        errors,
        `layer-d-role-mapping.json role '${entry.roleId}' must include at least one PAP-* sourceId.`,
      );
    }

    for (const sourceId of entry.sourceIds) {
      if (!sourceCatalogById.has(sourceId)) {
        pushError(
          errors,
          `layer-d-role-mapping.json role '${entry.roleId}' references unknown sourceId '${sourceId}'.`,
        );
      }
    }
  }

  for (const roleId of REQUIRED_LAYER_D_ROLE_IDS) {
    if (!seenRoles.has(roleId)) {
      pushError(errors, `layer-d-role-mapping.json missing required role '${roleId}'.`);
    }
  }
}

function validateProfilesAndSourceMaps(sourceCatalogById, profiles, sourceMaps, errors, warnings) {
  for (const profileId of PROFILE_IDS) {
    const profile = profiles[profileId];
    const sourceMap = sourceMaps[profileId];

    if (!profile || typeof profile !== 'object') {
      pushError(errors, `Missing or invalid profile '${profileId}.json'.`);
      continue;
    }

    if (!sourceMap || typeof sourceMap !== 'object') {
      pushError(errors, `Missing or invalid source map '${profileId}.sources.json'.`);
      continue;
    }

    if (sourceMap.profileId !== profileId) {
      pushError(errors, `'${profileId}.sources.json' has mismatched profileId.`);
    }

    for (const profilePath of REQUIRED_SOURCE_PATHS) {
      const mappings = sourceMap.sources?.[profilePath];
      if (!Array.isArray(mappings) || mappings.length === 0) {
        pushError(
          errors,
          `'${profileId}.sources.json' missing required source mapping for '${profilePath}'.`,
        );
      }
    }

    for (const profilePath of REQUIRED_SOURCE_PATHS) {
      if (!hasPath(profile, profilePath)) {
        pushError(errors, `'${profileId}.json' missing required profile path '${profilePath}'.`);
      }
    }

    if (!['full', 'simplified'].includes(profile.handover?.algorithmFidelity)) {
      pushError(
        errors,
        `'${profileId}.json' has invalid handover.algorithmFidelity (must be full or simplified).`,
      );
    }

    if (profile.handover?.algorithmFidelity !== 'full') {
      pushWarning(
        warnings,
        `'${profileId}.json' benchmark default is '${profile.handover?.algorithmFidelity}', not 'full'.`,
      );
    }

    const sourceEntries = sourceMap.sources ?? {};
    for (const [parameterPath, sourceIds] of Object.entries(sourceEntries)) {
      if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
        pushError(
          errors,
          `'${profileId}.sources.json' path '${parameterPath}' must map to a non-empty array.`,
        );
        continue;
      }

      for (const sourceId of sourceIds) {
        const entry = sourceCatalogById.get(sourceId);
        if (!entry) {
          pushError(
            errors,
            `'${profileId}.sources.json' path '${parameterPath}' references unknown sourceId '${sourceId}'.`,
          );
          continue;
        }

        if (sourceId.startsWith('ASSUME-') && entry.type !== 'assumption') {
          pushError(
            errors,
            `sourceId '${sourceId}' must be typed as 'assumption' in source catalog.`,
          );
        }
      }
    }
  }
}

async function validateProvenanceCoverage(sourceCatalogById, errors) {
  for (const filePath of CRITICAL_PROVENANCE_FILES) {
    const content = await readText(filePath);
    if (!content.includes('Provenance:')) {
      pushError(errors, `'${filePath}' is missing a file-level Provenance header.`);
    }
  }

  const allTsFiles = (await listFilesRecursively('src')).filter((filePath) =>
    filePath.endsWith('.ts') || filePath.endsWith('.tsx'),
  );

  for (const filePath of allTsFiles) {
    const content = await readText(filePath);
    const regex = /Source:\s*([A-Z0-9.-]+)/g;
    const matches = [...content.matchAll(regex)];
    for (const match of matches) {
      const sourceId = match[1];
      if (!sourceCatalogById.has(sourceId)) {
        pushError(
          errors,
          `'${filePath}' references unknown sourceId '${sourceId}' in Source comment.`,
        );
      }
    }
  }
}

async function validateParameterConsumption(errors) {
  const stateMachine = await readText('src/sim/handover/state-machine.ts');
  for (const reference of RLF_REQUIRED_REFERENCES) {
    if (!stateMachine.includes(reference)) {
      pushError(
        errors,
        `state-machine.ts does not consume required RLF/HO parameter reference '${reference}'.`,
      );
    }
  }

  const linkBudget = await readText('src/sim/channel/link-budget.ts');
  for (const reference of LINK_BUDGET_REQUIRED_REFERENCES) {
    if (!linkBudget.includes(reference)) {
      pushError(
        errors,
        `link-budget.ts does not consume required channel/link reference '${reference}'.`,
      );
    }
  }

  for (const pattern of LINK_BUDGET_FORBIDDEN_PATTERNS) {
    if (pattern.test(linkBudget)) {
      pushError(
        errors,
        `link-budget.ts matches forbidden hardcoded pattern '${pattern}'.`,
      );
    }
  }

  const smallScale = await readText('src/sim/channel/small-scale.ts');
  for (const reference of SMALL_SCALE_REQUIRED_REFERENCES) {
    if (!smallScale.includes(reference)) {
      pushError(
        errors,
        `small-scale.ts does not consume required small-scale reference '${reference}'.`,
      );
    }
  }

  const scheduler = [
    await readText('src/sim/scheduler/window-engine.ts'),
    await readText('src/sim/scheduler/coupled-resolver.ts'),
  ].join('\n');
  for (const reference of SCHEDULER_REQUIRED_REFERENCES) {
    if (!scheduler.includes(reference)) {
      pushError(
        errors,
        `scheduler/window-engine.ts does not consume required scheduler reference '${reference}'.`,
      );
    }
  }
}

async function validateArtifactsContract(errors) {
  const sourceTrace = await readText('src/sim/reporting/source-trace.ts');
  const reporter = await readText('src/sim/kpi/reporter.ts');
  const manifest = await readText('src/sim/reporting/manifest.ts');

  const requiredSourceTraceTokens = [
    'algorithm_fidelity',
    'throughput_model',
    'small_scale_model',
    'small_scale_params',
    'resolvedAssumptionIds',
    'resolvedParameterSources',
    'resolvedSourceLinks',
    'policy_mode',
    'policy_runtime_config_hash',
    'policy_state_feature_sources',
    'policy_reward_source_ids',
    'scheduler_mode',
    'scheduler_state_hash',
    'scheduler_blocked_handover_count',
    'scheduler_blocked_reasons',
  ];

  for (const token of requiredSourceTraceTokens) {
    if (!sourceTrace.includes(token)) {
      pushError(errors, `source-trace.ts missing required artifact token '${token}'.`);
    }
  }

  const requiredReporterTokens = [
    'algorithmFidelity',
    'throughputModel',
    'smallScaleModel',
    'smallScaleParams',
    'resolvedAssumptionIds',
    'runtimeParameterAudit',
  ];
  for (const token of requiredReporterTokens) {
    if (!reporter.includes(token)) {
      pushError(errors, `kpi/reporter.ts missing required metadata token '${token}'.`);
    }
  }

  const requiredManifestTokens = [
    'scenario_id',
    'profile_id',
    'baseline',
    'seed',
    'profile_checksum_sha256',
    'source_catalog_checksum_sha256',
    'algorithm_fidelity',
    'throughput_model',
    'small_scale_model',
    'small_scale_params',
    'runtime_parameter_audit',
    'policy_mode',
    'policy_runtime_config_hash',
    'policy_decision_count',
    'policy_rejection_count',
    'scheduler_mode',
    'scheduler_window_id',
    'scheduler_utilization_ratio',
    'scheduler_state_hash',
    'scheduler_blocked_handover_count',
    'scheduler_blocked_reasons',
  ];
  for (const token of requiredManifestTokens) {
    if (!manifest.includes(token)) {
      pushError(errors, `reporting/manifest.ts missing required manifest token '${token}'.`);
    }
  }
}

async function main() {
  const errors = [];
  const warnings = [];

  const sourceCatalog = await readJson('src/config/references/paper-sources.json');
  const sourceCatalogById = validateSourceCatalog(sourceCatalog, errors);
  const layerDRoleMapping = await readJson('src/config/references/layer-d-role-mapping.json');
  validateLayerDRoleMapping(layerDRoleMapping, sourceCatalogById, errors);

  const profiles = {};
  const sourceMaps = {};

  for (const profileId of PROFILE_IDS) {
    profiles[profileId] = await readJson(`src/config/paper-profiles/${profileId}.json`);
    sourceMaps[profileId] = await readJson(
      `src/config/paper-profiles/${profileId}.sources.json`,
    );
  }

  validateProfilesAndSourceMaps(
    sourceCatalogById,
    profiles,
    sourceMaps,
    errors,
    warnings,
  );
  await validateProvenanceCoverage(sourceCatalogById, errors);
  await validateParameterConsumption(errors);
  await validateArtifactsContract(errors);

  if (warnings.length > 0) {
    console.log('Academic rigor warnings:');
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error('Academic rigor validation failed:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Academic rigor validation passed.');
}

main().catch((error) => {
  console.error(`Academic rigor validation crashed: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
