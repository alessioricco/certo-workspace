import { RunSession } from '../../src/game/run';
import { RULES_VERSION } from '../../src/math/random';

export const CANONICAL_REPLAY_TICKS = 6000;
export const CANONICAL_REPLAY_SEED = 42;
export const CANONICAL_REPLAY_SHA256 = 'b5c17c9456011a15e29681ea592a27ab70d84f9187bb80325c7351471410e371';

export function canonicalReplay(): string {
  const run = new RunSession();
  run.reset(CANONICAL_REPLAY_SEED);
  for (let tick = 0; tick < CANONICAL_REPLAY_TICKS; tick++) {
    run.step({ moveX: tick % 160 < 80 ? 1 : -1, fire: true, capture: tick % 240 === 0 });
  }
  return JSON.stringify({ rules: RULES_VERSION, ticks: run.range.ticks, stage: run.stage, stageTick: run.stageTick,
    vitals: run.vitals, tally: run.tally, echo: run.echo, powers: run.powers, drops: run.drops,
    boss: run.boss, bullets: run.range.bullets, hostiles: run.hostiles, enemies: run.formation.enemies });
}
