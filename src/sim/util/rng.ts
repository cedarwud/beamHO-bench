/**
 * Provenance:
 * - sdd/completed/beamHO-bench-experiment-protocol.md
 *
 * Notes:
 * - Deterministic RNG is required for repeatable seed-controlled experiments.
 */

export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    // xorshift32 for deterministic reproducibility.
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x100000000;
  }

  nextRange(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  pick<T>(values: readonly T[]): T {
    const index = Math.floor(this.next() * values.length);
    return values[index];
  }
}
