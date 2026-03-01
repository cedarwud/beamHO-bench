import type { SimScenario, SimSnapshot, SimTickContext } from './types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-sdd.md
 *
 * Notes:
 * - Snapshot-driven tick loop is the canonical simulation execution model.
 */

export interface SimEngineOptions {
  scenario: SimScenario;
  timeStepSec?: number;
  playbackRate?: number;
}

type SnapshotListener = (snapshot: SimSnapshot) => void;

export class SimEngine {
  private readonly scenario: SimScenario;
  private readonly listeners = new Set<SnapshotListener>();
  private readonly tickContext: SimTickContext;
  private snapshot: SimSnapshot;
  private timer: ReturnType<typeof setInterval> | null = null;
  private playbackRate = 1;

  constructor(options: SimEngineOptions) {
    this.scenario = options.scenario;
    this.tickContext = { timeStepSec: options.timeStepSec ?? 1 };
    this.playbackRate = this.normalizePlaybackRate(options.playbackRate ?? 1);
    this.snapshot = this.scenario.createInitialSnapshot();
  }

  getSnapshot(): SimSnapshot {
    return this.snapshot;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }

  setPlaybackRate(nextRate: number): void {
    const normalized = this.normalizePlaybackRate(nextRate);
    if (normalized === this.playbackRate) {
      return;
    }

    this.playbackRate = normalized;

    if (this.timer) {
      this.stop();
      this.start();
    }
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.step();
    }, this.resolveIntervalMs());
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  step(): void {
    this.snapshot = this.scenario.nextSnapshot(this.snapshot, this.tickContext);
    this.emit();
  }

  reset(): void {
    this.stop();
    this.snapshot = this.scenario.createInitialSnapshot();
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  private normalizePlaybackRate(value: number): number {
    if (!Number.isFinite(value)) {
      return 1;
    }
    return Math.min(Math.max(value, 0.25), 8);
  }

  private resolveIntervalMs(): number {
    const baseMs = this.tickContext.timeStepSec * 1000;
    const scaledMs = baseMs / this.playbackRate;
    return Math.max(16, Math.round(scaledMs));
  }
}
