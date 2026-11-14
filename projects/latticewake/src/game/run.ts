import { t } from '../ui/strings';
import type { Actions } from '../input/actions';
import { at } from '../math/indexed';
import { sweptCircleTime } from '../math/collision';
import { HitEvents } from './events';
import { MeridianEngine } from './boss';
import { EchoLattice } from './echo';
import { DropPool, PowerUps } from './powerups';
import { AttackDirector } from './attacks';
import { HOSTILE_RADIUS, HostilePool } from './hostiles';
import { FormationSession } from './session';
import { createStage, validateStage, type StageConfig } from './stages';
import { PLAYER_RADIUS } from './tuning';
import { Vitals } from './vitals';

export class RunSession {
  private readonly base = new FormationSession();
  readonly range = this.base.range;
  readonly formation = this.base.formation;
  readonly particles = this.base.particles;
  readonly hostiles = new HostilePool();
  readonly attacks = new AttackDirector();
  readonly vitals = new Vitals();
  readonly echo = new EchoLattice();
  readonly powers = new PowerUps();
  readonly drops = new DropPool();
  readonly boss = new MeridianEngine();
  readonly events = new HitEvents();
  bonusInterlude = false;
  private readonly actions: Actions = { moveX: 0, fire: false, capture: false };
  stage = 1;
  config: StageConfig = createStage(1);
  stageTick = 0;
  tally = 0;
  lastTally = '';
  private accountedScore = 0;

  get complete(): boolean { return this.vitals.lives === 0; }
  get score(): number { return this.vitals.score; }
  get lives(): number { return this.vitals.lives; }
  get playerVisible(): boolean { return this.vitals.respawn === 0 && !this.complete; }
  get bonusRemaining(): number { return Math.max(0, this.config.duration - this.stageTick); }

  reset(seed: number): void {
    this.base.reset(seed);
    this.events.reset();
    this.hostiles.reset();
    this.vitals.reset();
    this.echo.reset(); this.powers.reset(); this.drops.reset();
    this.bonusInterlude = false;
    this.stage = 1;
    this.lastTally = '';
    this.beginStage();
  }

  step(actions: Readonly<Actions>): void {
    this.events.begin();
    if (this.complete) return;
    const respawned = this.vitals.step();
    if (respawned) {
      this.range.player.reset();
      this.range.cooldown = 0;
      this.hostiles.clearNear(this.range.player.x, this.range.player.y, 96);
    }
    const playing = this.vitals.respawn === 0 && this.tally === 0;
    this.actions.moveX = playing ? actions.moveX : 0;
    this.actions.fire = playing && actions.fire;
    this.actions.capture = false;
    const activations = this.echo.activations;
    this.echo.step(playing && actions.capture, this.playerVisible);
    if (this.playerVisible) this.powers.step();
    this.range.step(this.actions, true);
    if (activations !== this.echo.activations) this.feedback('open', 0, this.range.player.x, this.range.player.y);
    this.particles.step();
    if (this.tally > 0) {
      if (--this.tally === 0) {
        if (this.config.kind === 'boss' && this.stage % 4 === 0) this.bonusInterlude = true;
        else { this.stage++; this.bonusInterlude = false; }
        this.beginStage();
      }
      return;
    }
    this.stageTick++;
    this.hostiles.step();
    this.drops.step();
    this.boss.step();
    this.formation.advance(this.stageTick);
    const attacking = playing && this.config.kind === 'combat';
    this.attacks.step(this.formation, this.stageTick, this.range.player.x, this.config, this.stage, attacking);
    if (playing && this.echo.intercept(this.hostiles, this.range.player)) this.feedback('capture', 0, this.range.player.x, this.range.player.y);
    if (playing && !respawned && this.vitals.invulnerable === 0 && this.config.kind !== 'bonus') this.resolveDamage();
    if (this.config.kind === 'boss') {
      const defeated = this.boss.defeated;
      this.boss.resolve(this.range.bullets, this.hostiles, this.events, this.range.ticks);
      if (!defeated && this.boss.defeated) this.vitals.award(this.boss.points);
    } else this.formation.resolve(this.range.bullets);
    this.vitals.award(this.formation.score - this.accountedScore);
    this.accountedScore = this.formation.score;
    for (let index = 0; index < this.formation.events.count; index++) {
      const event = at(this.formation.events.slots, index);
      this.feedback(event.kind, event.id, event.x, event.y);
      if (event.kind === 'destroy') {
        this.particles.burst(event.x, event.y);
        for (const enemy of this.formation.enemies.slots) {
          if (enemy.id !== event.id) continue;
          for (const drop of this.config.drops) if (enemy.slot === drop.slot) this.drops.spawn(drop.kind, event.x, event.y);
        }
      }
    }
    const collected = this.drops.collected;
    this.drops.resolve(this.range.player, this.powers, playing && this.playerVisible);
    if (this.drops.collected !== collected) this.feedback('pickup', this.drops.collected, this.range.player.x, this.range.player.y);
    if (this.config.kind === 'bonus' ? this.bonusRemaining === 0 : this.config.kind === 'boss' ? this.boss.defeated : this.formation.cleared) {
      this.finishStage();
      return;
    }
    this.hostiles.expire();
    this.range.bullets.expireOffscreen();
    if (this.actions.fire && this.playerVisible && this.range.cooldown === 0
      && (this.config.kind === 'boss' || !this.formation.cleared)
      && this.powers.volley(this.range.bullets, this.range.player, this.echo)) {
      this.range.cooldown = this.powers.overclock > 0 ? 6 : 9;
      this.range.shotsFired++;
      this.feedback('shot', this.range.shotsFired, this.range.player.x, this.range.player.y - 20);
    }
    this.attacks.fire(this.formation, this.hostiles, this.config, attacking && this.playerVisible);
    this.boss.fire(this.hostiles, this.config.hostileCap, playing && this.playerVisible);
  }

  private feedback(kind: Parameters<HitEvents['push']>[0], id: number, x: number, y: number): void {
    this.events.push(kind, this.range.ticks, id, x, y);
  }

  private beginStage(): void {
    this.config = createStage(this.stage, this.bonusInterlude);
    validateStage(this.config);
    const seed = (this.range.seed + this.config.seedOffset) >>> 0;
    this.formation.reset(seed, this.config);
    this.attacks.reset(seed);
    this.feedback('phase', this.stage, 180, 145);
    this.boss.reset(this.config.kind === 'boss' ? this.stage : 0);
    this.drops.clear();
    this.echo.field = 0;
    this.hostiles.clear();
    this.range.bullets.clear();
    this.range.cooldown = 0;
    this.stageTick = this.tally = this.accountedScore = 0;
  }

  private finishStage(): void {
    const perfect = this.config.kind === 'bonus' && this.formation.cleared;
    if (perfect) this.vitals.award(3000);
    this.lastTally = this.config.kind === 'bonus'
      ? t('bonus_tally', { kills: this.formation.kills, result: t(perfect ? 'perfect' : 'safe_bonus') })
      : this.config.kind === 'boss' ? t('boss_tally', { points: this.boss.points })
        : t('stage_tally', { stage: this.stage, points: this.formation.score });
    this.feedback('clear', this.stage, 180, 145);
    this.tally = 150;
    this.drops.clear(); this.echo.field = 0;
    this.hostiles.clear();
    this.range.bullets.clear();
    this.range.player.velocityX = 0;
    for (let index = 0; index < this.formation.enemies.slots.length; index++) {
      const enemy = at(this.formation.enemies.slots, index);
      if (enemy.active) this.formation.enemies.release(index, enemy.generation);
    }
  }

  private resolveDamage(): void {
    const player = this.range.player;
    let time = Infinity;
    let id = Infinity;
    let bulletIndex = -1;
    for (let index = 0; index < this.hostiles.slots.length; index++) {
      const shot = at(this.hostiles.slots, index);
      if (!shot.active) continue;
      const impact = sweptCircleTime(shot.previousX, shot.previousY, shot.x, shot.y,
        player.previousX, player.y, player.x, player.y, PLAYER_RADIUS + HOSTILE_RADIUS);
      if (impact < time || (impact !== Infinity && impact === time && shot.id < id)) {
        time = impact; id = shot.id; bulletIndex = index;
      }
    }
    for (const enemy of this.formation.enemies.slots) {
      if (!enemy.active || enemy.state === 'queued') continue;
      const impact = sweptCircleTime(enemy.previousX, enemy.previousY, enemy.x, enemy.y,
        player.previousX, player.y, player.x, player.y, PLAYER_RADIUS + enemy.radius);
      // Hostile shots win equal-time ties; only one damage event can be applied.
      if (impact < time) { time = impact; bulletIndex = -1; }
    }
    if (time === Infinity) return;
    const marked = bulletIndex >= 0 && at(this.hostiles.slots, bulletIndex).marked;
    if (this.powers.absorb(marked)) {
      this.feedback('ward', 0, player.x, player.y);
      if (bulletIndex >= 0) this.hostiles.release(bulletIndex, at(this.hostiles.slots, bulletIndex).generation);
      return;
    }
    if (!this.vitals.hit()) return;
    this.feedback('damage', this.vitals.deaths, player.x, player.y);
    this.echo.clear(); this.powers.clear();
    if (bulletIndex >= 0) this.hostiles.release(bulletIndex, at(this.hostiles.slots, bulletIndex).generation);
    this.range.bullets.clear();
    this.range.player.velocityX = 0;
    this.particles.burst(player.x, player.y);
    if (this.complete) this.hostiles.clear();
  }
}
