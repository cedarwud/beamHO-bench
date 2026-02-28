import type { SimScenario, SimSnapshot, SimTickContext } from './types';

export interface SimEngineOptions {
  scenario: SimScenario;
  timeStepSec?: number;
}

type SnapshotListener = (snapshot: SimSnapshot) => void;

export class SimEngine {
  private readonly scenario: SimScenario;
  private readonly listeners = new Set<SnapshotListener>();
  private readonly tickContext: SimTickContext;
  private snapshot: SimSnapshot;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: SimEngineOptions) {
    this.scenario = options.scenario;
    this.tickContext = { timeStepSec: options.timeStepSec ?? 1 };
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

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.step();
    }, this.tickContext.timeStepSec * 1000);
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
}
