import { isCanonicalProfileId, type DeepPartial } from '@/config/paper-profiles/loader';
import type { PaperProfile } from '@/config/paper-profiles/types';
import { runRerunContract, type RerunContractInput, type RerunContractResult } from './rerun-contract';

/**
 * Provenance:
 * - sdd/pending/beamHO-bench-baseline-generalization-sdd.md
 *
 * Notes:
 * - CLI adapter for one-click rerun contract execution.
 */

declare const process: {
  argv: string[];
  exit: (code?: number) => never;
};

export interface RerunContractCliOutput {
  exitCode: number;
  result: RerunContractResult | null;
  error?: string;
}

function parseArgMap(argv: string[]): Map<string, string> {
  const map = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const eqIndex = token.indexOf('=');
    if (eqIndex >= 0) {
      const key = token.slice(2, eqIndex);
      const value = token.slice(eqIndex + 1);
      map.set(key, value);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      map.set(key, 'true');
      continue;
    }
    map.set(key, next);
    index += 1;
  }

  return map;
}

function requireStringArg(args: Map<string, string>, key: string): string {
  const value = args.get(key);
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required argument '--${key}'.`);
  }
  return value;
}

function parseRuntimeOverrides(raw: string | undefined): DeepPartial<PaperProfile> {
  if (!raw || raw.trim().length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as DeepPartial<PaperProfile>;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('runtime_overrides must be a JSON object.');
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `Invalid --runtime_overrides JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function parseRerunCliInput(argv: string[]): RerunContractInput {
  const args = parseArgMap(argv);

  const scenarioId = requireStringArg(args, 'scenario_id');
  const profileIdRaw = requireStringArg(args, 'profile_id');
  if (!isCanonicalProfileId(profileIdRaw)) {
    throw new Error(`Unknown profile_id '${profileIdRaw}'.`);
  }

  const seedRaw = requireStringArg(args, 'seed');
  const parsedSeed = Number(seedRaw);
  if (!Number.isFinite(parsedSeed)) {
    throw new Error(`Invalid seed '${seedRaw}'.`);
  }

  const baselineOrPolicy = requireStringArg(args, 'baseline_or_policy');
  const tickCountRaw = args.get('tick_count');
  const tickCount = tickCountRaw ? Number(tickCountRaw) : undefined;
  if (tickCountRaw && !Number.isFinite(tickCount as number)) {
    throw new Error(`Invalid tick_count '${tickCountRaw}'.`);
  }

  return {
    scenarioId,
    profileId: profileIdRaw,
    seed: Math.round(parsedSeed),
    baselineOrPolicy,
    runtimeOverrides: parseRuntimeOverrides(args.get('runtime_overrides')),
    tickCount,
  };
}

export async function runRerunContractCli(
  argv = process.argv.slice(2),
): Promise<RerunContractCliOutput> {
  try {
    const input = parseRerunCliInput(argv);
    const result = await runRerunContract(input);
    return {
      exitCode: 0,
      result,
    };
  } catch (error) {
    return {
      exitCode: 1,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runRerunContractCli().then((output) => {
    if (output.error) {
      console.error(`[rerun-contract] ${output.error}`);
    } else if (output.result) {
      console.log(
        `[rerun-contract] ok scenario=${output.result.scenarioId} profile=${output.result.profileId} seed=${output.result.seed} baseline_or_policy=${output.result.baselineOrPolicy}`,
      );
      console.log(
        `[rerun-contract] digest tuple=${output.result.digestSummary.tupleHashSha256} manifest=${output.result.digestSummary.manifestHashSha256}`,
      );
    }
    process.exit(output.exitCode);
  });
}
