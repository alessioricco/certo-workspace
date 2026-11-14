import { t } from './strings';
import type { Scene } from '../engine/state';

export function acceptsGameplayKey(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || document.querySelector('dialog[open]')) return false;
  const element = event.target;
  if (!(element instanceof Element)) return true;
  if (element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return false;
  return !((event.code === 'Enter' || event.code === 'Space') && element.closest('button, a, summary'));
}


export type Command = 'primary' | 'pause' | 'menu' | 'end' | 'debug';

export interface Diagnostics {
  readonly captureCooldown: number;
  readonly captureField: number;
  readonly drones: readonly number[];
  readonly captures: number;
  readonly ward: number;
  readonly fan: number;
  readonly overclock: number;
  readonly drops: number;
  readonly pickups: number;
  readonly boss: boolean;
  readonly bossPhase: number;
  readonly bossWarning: number;
  readonly bossHP: string;
  readonly stage: number;
  readonly stageTick: number;
  readonly lives: number;
  readonly respawn: number;
  readonly invulnerable: number;
  readonly bonus: boolean;
  readonly bonusRemaining: number;
  readonly tally: number;
  readonly lastTally: string;
  readonly targets: number;
  readonly divers: number;
  readonly launches: number;
  readonly hostiles: number;
  readonly peakHostiles: number;
  readonly deferredShots: number;
  readonly hostileShots: number;
  readonly fps: number;
  readonly ticks: number;
  readonly alpha: number;
  readonly droppedMs: number;
  readonly seed: number;
  readonly rules: string;
  readonly moveX: number;
  readonly fire: boolean;
  readonly capture: boolean;
  readonly capturePresses: number;
  readonly entities: number;
  readonly bullets: number;
  readonly shots: number;
  readonly peakBullets: number;
  readonly deniedVolleys: number;
  readonly playerX: number;
  readonly velocityX: number;
  readonly cooldown: number;
  readonly enemies: number;
  readonly score: number;
  readonly kills: number;
  readonly hits: number;
  readonly damaged: number;
  readonly particles: number;
  readonly droppedParticles: number;
  readonly droppedEvents: number;
}

export class TestbedUI {
  private readonly panel: HTMLElement;
  private readonly heading: HTMLElement;
  private readonly primary: HTMLButtonElement;
  private readonly menu: HTMLButtonElement;
  private readonly toolbar: HTMLElement;
  private readonly debug: HTMLElement;
  private readonly debugToggle: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly stats: HTMLElement;
  private announcedStage = '';
  private handler: ((command: Command) => void) | undefined;

  constructor(
    private readonly host: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly onSceneChange: (scene: Scene) => void = () => {},
  ) {
    const get = <T extends HTMLElement>(selector: string): T => {
      const element = host.querySelector<T>(selector);
      if (!element) throw new Error(`Missing testbed element: ${selector}`);
      return element;
    };
    this.panel = get('#scene-panel');
    this.heading = get('#scene-heading');
    this.primary = get('#primary');
    this.menu = get('#menu');
    this.toolbar = get('#play-controls');
    this.debug = get('#debug');
    this.debugToggle = get('#debug-toggle');
    this.status = get('#status');
    this.stats = get('#range-stats');
  }

  start(handler: (command: Command) => void): void {
    this.handler = handler;
    this.host.addEventListener('click', this.onClick);
    this.debugToggle.hidden = false;
  }

  scene(scene: Scene, defeated = false): void {
    this.host.dataset.scene = scene;
    this.onSceneChange(scene);
    this.panel.hidden = scene === 'play' || scene === 'boot';
    this.toolbar.hidden = scene !== 'play';
    this.menu.hidden = scene !== 'pause' && scene !== 'gameover';
    this.heading.textContent = scene === 'pause' ? t('pause_heading') : scene === 'gameover' ? defeated ? t('gameover_heading') : t('ended_heading') : t('title_heading');
    this.primary.textContent = scene === 'pause' ? t('resume') : scene === 'gameover' ? t('restart') : t('start');
    this.status.textContent = scene === 'play' ? t('live') : scene === 'pause'
      ? t('paused') : scene === 'gameover'
        ? defeated ? t('lost') : t('ended') : t('menu_ready');
    const description = this.host.querySelector<HTMLElement>('#scene-description');
    if (description) description.textContent = scene === 'gameover'
      ? t('end_description')
      : t('run_description');
    if (scene === 'play') this.canvas.focus({ preventScroll: true });
    else if (scene !== 'boot') this.primary.focus({ preventScroll: true });
  }

  notice(message: string): void {
    const note = this.host.querySelector<HTMLElement>('#seed-note');
    if (note) note.textContent = message;
  }

  toggleDebug(): void {
    this.debug.hidden = !this.debug.hidden;
    this.debugToggle.setAttribute('aria-pressed', String(!this.debug.hidden));
  }

  diagnostics(data: Diagnostics): void {
    const phase = data.tally > 0 ? t('phase_tally', { tally: data.lastTally })
      : data.respawn > 0 ? t('phase_respawn', { seconds: (data.respawn / 60).toFixed(1) })
        : data.bonus ? t('phase_bonus', { seconds: (data.bonusRemaining / 60).toFixed(1) })
          : data.boss ? t('phase_boss', { phase: data.bossPhase, instruction: t(data.bossWarning > 0 ? 'boss_warning' : 'boss_break') })
            : t(data.invulnerable > 0 ? 'protected' : 'dodge');
    this.stats.textContent = t('hud', { stage: data.stage, lives: data.lives, score: data.score, kills: data.kills,
      targets: data.targets, shots: data.shots, bullets: data.bullets, phase,
      echo: data.captureCooldown === 0 ? t('ready') : (data.captureCooldown / 60).toFixed(1) + 's',
      drone0: (data.drones[0] ?? 0) > 0 ? ((data.drones[0] ?? 0) / 60).toFixed(1) : '0',
      drone1: ((data.drones[1] ?? 0) / 60).toFixed(1), ward: (data.ward / 60).toFixed(1), fan: (data.fan / 60).toFixed(1), overclock: (data.overclock / 60).toFixed(1) });
    const stageKey = `${data.stage}/${Number(data.bonus)}/${Number(data.boss)}`;
    if (this.host.dataset.scene === 'play' && this.announcedStage !== stageKey) {
      this.announcedStage = stageKey;
      this.status.textContent = t('stage_announcement', { stage: data.stage, kind: t(data.boss ? 'kind_boss' : data.bonus ? 'kind_bonus' : 'kind_wave') });
    }
    if (this.debug.hidden) return;
    this.debug.textContent = t('diagnostics', { 
      stage: data.stage, stageTick: data.stageTick, lives: data.lives, respawn: data.respawn,
      invulnerable: data.invulnerable, tally: data.tally, divers: data.divers, launches: data.launches,
      hostiles: data.hostiles, peakHostiles: data.peakHostiles, deferredShots: data.deferredShots, hostileShots: data.hostileShots,
      fps: data.fps.toFixed(1), entities: data.entities, ticks: data.ticks, alpha: data.alpha.toFixed(2),
      droppedMs: data.droppedMs.toFixed(1), seed: data.seed, rules: data.rules, moveX: data.moveX,
      fire: Number(data.fire), capture: Number(data.capture), capturePresses: data.capturePresses, captureField: data.captureField,
      captureCooldown: data.captureCooldown, captures: data.captures, drone0: data.drones[0] ?? 0, drone1: data.drones[1] ?? 0,
      ward: data.ward, fan: data.fan, overclock: data.overclock, drops: data.drops,
      pickups: data.pickups, boss: Number(data.boss), bossPhase: data.bossPhase, bossWarning: data.bossWarning,
      bossHP: data.bossHP, playerX: data.playerX.toFixed(2), velocityX: data.velocityX.toFixed(2), shots: data.shots,
      bullets: data.bullets, peakBullets: data.peakBullets, cooldown: data.cooldown, deniedVolleys: data.deniedVolleys,
      enemies: data.enemies, score: data.score, kills: data.kills, targets: data.targets,
      hits: data.hits, damaged: data.damaged, particles: data.particles, droppedParticles: data.droppedParticles,
      droppedEvents: data.droppedEvents
     });
  }

  dispose(): void {
    this.host.removeEventListener('click', this.onClick);
    this.handler = undefined;
    this.panel.hidden = true;
    this.toolbar.hidden = true;
    this.debug.hidden = true;
    this.debugToggle.hidden = true;
    this.debugToggle.setAttribute('aria-pressed', 'false');
  }

  private readonly onClick = (event: Event): void => {
    if (!(event.target instanceof Element)) return;
    const command = event.target.closest<HTMLButtonElement>('button[data-command]')?.dataset.command;
    if (command === 'primary' || command === 'pause' || command === 'menu' || command === 'end' || command === 'debug') {
      this.handler?.(command);
    }
  };
}
