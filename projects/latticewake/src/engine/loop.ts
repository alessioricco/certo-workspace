export const STEP_MS = 1000 / 60;
const MAX_DELTA_MS = 250;
const MAX_STEPS = 5;
const EPSILON = 1e-7;

export class FixedLoop {
  private previous: number | undefined;
  private remainder = 0;
  private discarded = 0;

  constructor(
    private readonly update: (seconds: number) => void,
    private readonly render: (alpha: number) => void,
  ) {}

  get alpha(): number { return this.remainder / STEP_MS; }
  get droppedMs(): number { return this.discarded; }

  reset(): void {
    this.previous = undefined;
    this.remainder = 0;
  }

  frame(timestamp: number): void {
    if (!Number.isFinite(timestamp)) throw new RangeError('Clock must be finite.');
    if (this.previous !== undefined) {
      const elapsed = Math.max(0, timestamp - this.previous);
      this.discarded += Math.max(0, elapsed - MAX_DELTA_MS);
      this.remainder += Math.min(elapsed, MAX_DELTA_MS);
    }
    this.previous = Math.max(this.previous ?? timestamp, timestamp);
    let steps = 0;
    while (this.remainder + EPSILON >= STEP_MS && steps < MAX_STEPS) {
      this.remainder = Math.max(0, this.remainder - STEP_MS);
      this.update(1 / 60);
      steps++;
    }
    // Treat boundary roundoff as a whole tick, not a nearly-one interpolation alpha.
    const droppedSteps = Math.floor((this.remainder + EPSILON) / STEP_MS);
    this.discarded += droppedSteps * STEP_MS;
    this.remainder = Math.max(0, this.remainder - droppedSteps * STEP_MS);
    this.render(this.alpha);
  }
}
