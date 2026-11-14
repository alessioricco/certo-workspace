import type { EnemyKind } from './enemies';
import { POWER_KINDS, type PowerKind } from './powerups';

export interface StageDrop { readonly slot: number; readonly kind: PowerKind }

export interface StageConfig {
  readonly kind: 'combat' | 'bonus' | 'boss';
  readonly seedOffset: number;
  readonly layout: readonly EnemyKind[];
  readonly pathIds: readonly number[];
  readonly entryTicks: number;
  readonly entrySpacing: number;
  readonly warningTicks: number;
  readonly diveCadence: number;
  readonly maxDivers: number;
  readonly hostileCap: number;
  readonly shotInterval: number;
  readonly shotSpeed: number;
  readonly attackKinds: readonly EnemyKind[];
  readonly duration: number;
  readonly drops: readonly StageDrop[];
}

const KINDS: readonly EnemyKind[] = ['shardlet', 'spindle', 'bellframe'];
const LAYOUT = Array.from({ length: 24 }, (_, index) => KINDS[(index + Math.floor(index / 6)) % 3] as EnemyKind);

export function validateStage(stage: StageConfig): void {
  const integer = (value: number, min: number, max: number): boolean => Number.isInteger(value) && value >= min && value <= max;
  if (!stage || (stage.kind !== 'combat' && stage.kind !== 'bonus' && stage.kind !== 'boss')
    || !integer(stage.seedOffset, 0, 0xffffffff)
    || !Array.isArray(stage.layout) || stage.layout.length < (stage.kind === 'boss' ? 0 : 1) || stage.layout.length > 24
    || stage.layout.some(kind => !KINDS.includes(kind))
    || KINDS.some(kind => stage.layout.filter(value => value === kind).length > 16)
    || !Array.isArray(stage.pathIds) || stage.pathIds.length !== 2 || stage.pathIds.some(id => id !== 0 && id !== 1)
    || !integer(stage.entryTicks, 60, 240) || !integer(stage.entrySpacing, 1, 30)
    || !integer(stage.warningTicks, 24, 120) || !integer(stage.diveCadence, 60, 600)
    || !integer(stage.maxDivers, 0, 6) || !integer(stage.hostileCap, 0, 128)
    || !integer(stage.shotInterval, 30, 600) || !integer(stage.shotSpeed, 60, 240)
    || !Array.isArray(stage.attackKinds) || stage.attackKinds.some(kind => !KINDS.includes(kind))
    || !integer(stage.duration, 0, 3600) || !Array.isArray(stage.drops) || stage.drops.length > 12
    || stage.drops.some(drop => !drop || !integer(drop.slot, 0, stage.layout.length - 1) || !POWER_KINDS.includes(drop.kind))
    || stage.drops.some((drop, index) => stage.drops.findIndex(other => other.slot === drop.slot) !== index)
    || (stage.kind !== 'combat' && stage.drops.length !== 0)
    || (stage.kind === 'boss' && (stage.layout.length !== 0 || stage.duration !== 0 || stage.maxDivers !== 0 || stage.hostileCap < 3 || stage.attackKinds.length !== 0))
    || (stage.kind === 'bonus' && (stage.layout.length !== 20 || stage.maxDivers !== 0
      || stage.hostileCap !== 0 || stage.attackKinds.length !== 0 || stage.duration < 600))
    || (stage.kind === 'combat' && (stage.duration !== 0 || stage.maxDivers < 1 || stage.hostileCap < 1))) {
    throw new RangeError('Invalid stage configuration.');
  }
}

export function difficulty(stage: number): number {
  if (!Number.isSafeInteger(stage) || stage < 1) throw new RangeError('Invalid stage number.');
  return Math.min(1 + 0.08 * (stage - 1), 2.2);
}

export function createStage(number: number, deferredBonus = false): StageConfig {
  const scale = difficulty(number);
  if (deferredBonus && number % 20 !== 0) throw new RangeError('Invalid deferred bonus.');
  const boss = number % 5 === 0 && !deferredBonus;
  const bonus = !boss && number % 4 === 0;
  const stage: StageConfig = {
    kind: boss ? 'boss' : bonus ? 'bonus' : 'combat', seedOffset: Math.imul(number - 1, 0x9e3779b9) >>> 0,
    layout: boss ? [] : bonus ? Array.from({ length: 20 }, (_, i) => KINDS[i % 3] as EnemyKind) : LAYOUT,
    pathIds: [0, 1], entryTicks: 120, entrySpacing: 6, warningTicks: 36,
    diveCadence: Math.max(90, Math.round(240 / scale)),
    maxDivers: bonus || boss ? 0 : Math.min(number, 6), hostileCap: bonus ? 0 : Math.min(12 + number * 4, 128),
    shotInterval: Math.max(30, Math.round(150 / scale)), shotSpeed: 150,
    attackKinds: bonus || boss ? [] : KINDS.slice(0, Math.min(number, 3)),
    duration: bonus ? 1200 : 0, drops: bonus || boss ? [] : [
      { slot: 2, kind: 'ward' }, { slot: 11, kind: 'fan' }, { slot: 18, kind: 'overclock' },
    ],
  };
  validateStage(stage);
  return stage;
}
