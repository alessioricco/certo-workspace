/** Time one frame may spend building chunks; the rest of the 16.7 ms at 60 fps is for drawing. */
export const BUILD_BUDGET_MS = 4;

/**
 * The time a single chunk may take to build, with its plants. A chunk must fit in
 * one frame's build budget, or it would be spread over several frames for nothing.
 */
export const CHUNK_BUILD_LIMIT_MS = BUILD_BUDGET_MS;

/**
 * Build time left in one frame. The first build of a frame always goes ahead, so
 * the streams keep making progress even when one build alone exceeds the budget.
 */
export class BuildBudget {
  private readonly deadlineMs: number;
  private started = 0;

  constructor(budgetMs: number) {
    this.deadlineMs = performance.now() + budgetMs;
  }

  /** Whether another chunk may start building in this frame; if so, it is counted. */
  tryStart(): boolean {
    if (this.started > 0 && performance.now() >= this.deadlineMs) return false;
    this.started++;
    return true;
  }
}
