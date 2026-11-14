import { GamepadInput } from './input/gamepad';
import { ActionMixer } from './input/mixer';
import { TouchInput } from './input/touch';
import type { MetaUI } from './ui/meta';
import type { DiagnosticsUI } from './ui/diagnostics';
import type { CrashContext } from './platform/diagnostics';
import { t } from './ui/strings';
import { GameAudio } from './audio/audio';
import type { PresentationChange, PresentationUI } from './ui/presentation';
import { FixedLoop } from './engine/loop';
import { loadResources } from './engine/resources';
import { StateMachine } from './engine/state';
import { RunSession } from './game/run';
import type { Scene } from './engine/state';
import type { Actions } from './input/actions';
import { Keyboard } from './input/keyboard';
import { parseSeed, RULES_VERSION } from './math/random';
import { createAtlas, createGrid, createScanlines, RangeRenderer } from './render/testbed';
import { calculateViewport } from './render/viewport';
import { acceptsGameplayKey } from './ui/testbed';
import type { Command, TestbedUI } from './ui/testbed';

const PAD_MENU_COMMANDS = ['back', 'next', 'previous', 'increase', 'decrease', 'confirm'] as const;
const MAX_FRAME_FAILURES = 3;

export class App {
  private readonly state = new StateMachine();
  private failures = 0;
  private readonly keyboard = new Keyboard(window, acceptsGameplayKey, moveX => this.mixer.activate(0, moveX));
  private readonly abort = new AbortController();
  private readonly loop = new FixedLoop(() => this.update(), alpha => this.render(alpha));
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private renderer: RangeRenderer | undefined;
  private observer: ResizeObserver | undefined;
  private frameId: number | undefined;
  private started = false;
  private readonly session = new RunSession();
  private readonly audio = new GameAudio();
  private readonly range = this.session.range;
  private seedOverride: number | undefined;
  private fps = 0;
  private fpsFrames = 0;
  private fpsSince: number | undefined;
  private lastDiagnostics = -Infinity;
  private readonly actions: Actions = { moveX: 0, fire: false, capture: false };
  private capturePresses = 0;
  private readonly gamepad = new GamepadInput();
  private readonly mixer = new ActionMixer();
  private readonly touch: TouchInput;
  private readonly keyboardActions: Actions = { moveX: 0, fire: false, capture: false };
  private readonly touchActions: Actions = { moveX: 0, fire: false, capture: false };
  private readonly padActions: Actions = { moveX: 0, fire: false, capture: false };
  private padIndex: number | undefined;
  private padAvailable = true;
  private readonly readPads = () => {
    if (!navigator.getGamepads) throw new Error('Gamepad API unavailable');
    return navigator.getGamepads();
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: HTMLElement,
    private readonly ui: TestbedUI,
    private readonly presentation: PresentationUI,
    private readonly meta: MetaUI,
    private readonly diagnostics: DiagnosticsUI,
  ) {
    this.touch = new TouchInput(host.parentElement ?? host, moveX => this.mixer.activate(1, moveX));
    try {
      this.seedOverride = parseSeed(new URLSearchParams(window.location.search).get('seed'));
    } catch {
      this.ui.notice(t('invalid_seed'));
    }
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const assets = await loadResources({ grid: createGrid, atlas: createAtlas, scanlines: createScanlines }, this.abort.signal);
    this.renderer = new RangeRenderer(this.canvas, assets);
    this.resize();
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(this.host);
    window.addEventListener('resize', this.resize);
    window.addEventListener('blur', this.suspend);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.keyboard.start();
    this.touch.start();
    this.meta.start(this.applySettings, () => this.command('pause'));
    this.diagnostics.start();
    window.addEventListener('error', this.onError);
    window.addEventListener('unhandledrejection', this.onRejection);
    this.applySettings();
    this.ui.start(this.command);
    this.presentation.start(this.configurePresentation);
    this.presentation.update(this.audio);
    this.transition('menu');
    this.frameId = requestAnimationFrame(this.frame);
  }

  suspend = (): void => {
    this.audio.suspend();
    this.clearInput();
    this.actions.moveX = 0;
    this.actions.fire = false;
    this.actions.capture = false;
    this.loop.reset();
    if (this.state.scene === 'play') this.transition('pause');
  };

  dispose(): void {
    this.abort.abort();
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
    this.observer?.disconnect();
    this.observer = undefined;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('blur', this.suspend);
    window.removeEventListener('error', this.onError);
    window.removeEventListener('unhandledrejection', this.onRejection);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.keyboard.dispose();
    this.touch.dispose();
    this.meta.dispose();
    this.diagnostics.dispose();
    this.ui.dispose();
    this.presentation.dispose();
    this.audio.dispose();
    this.renderer = undefined;
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) this.suspend();
  };

  private transition(scene: Scene): void {
    if (!this.state.transition(scene)) return;
    this.clearInput();
    this.actions.moveX = 0;
    this.actions.fire = false;
    this.actions.capture = false;
    this.loop.reset();
    this.lastDiagnostics = -Infinity;
    this.audio.setPlaying(scene === 'play');
    this.ui.scene(scene, this.session.complete);
    this.meta.scene(scene, scene === 'gameover' ? {
      alias: 'PILOT', score: this.session.score, stage: this.session.stage,
      seed: this.range.seed, rules: RULES_VERSION,
    } : undefined, this.session.complete);
    this.render(0);
  }

  private readonly configurePresentation = (change: PresentationChange): void => {
    if (change.kind === 'enable') void this.audio.enable().then(() => this.presentation.update(this.audio));
    else if (change.kind === 'level') { this.audio.setLevel(change.bus, change.value); this.meta.settings[change.bus] = change.value; }
    else if (change.kind === 'mute') { this.audio.setMuted(change.value); this.meta.settings.muted = change.value; }
    else if (this.renderer) {
      this.renderer.feedback.settings[change.effect] = change.value;
      this.meta.settings.effects[change.effect] = change.value;
      this.resize();
    }
    if (change.kind !== 'enable') this.meta.saveSettings();
    this.presentation.update(this.audio);
  };

  private readonly applySettings = (): void => {
    const settings = this.meta.settings;
    this.audio.setLevel('master', settings.master); this.audio.setLevel('music', settings.music); this.audio.setLevel('sfx', settings.sfx);
    this.audio.setMuted(settings.muted);
    if (this.renderer) {
      Object.assign(this.renderer.feedback.settings, settings.effects);
      this.renderer.setPalette(settings.palette);
    }
    this.touch.clear(); this.resize();
  };

  private clearInput(): void {
    this.keyboard.clear(); this.touch.clear(); this.gamepad.clear(); this.mixer.clear();
  }

  private readonly command = (command: Command): void => {
    if (command === 'debug') {
      this.ui.toggleDebug();
      this.lastDiagnostics = -Infinity;
    } else if (command === 'primary') {
      if (this.state.scene === 'pause') { this.audio.resumeFromGesture(); this.transition('play'); }
      else if (this.state.scene === 'menu' || this.state.scene === 'gameover') {
        const seed = this.seedOverride ?? crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
        this.session.reset(seed);
        this.renderer?.reset(seed);
        this.audio.reset(seed);
        this.audio.resumeFromGesture();
        this.capturePresses = 0;
        this.transition('play');
      }
    } else if (command === 'pause') {
      if (this.state.scene === 'play') this.transition('pause');
      else if (this.state.scene === 'pause') { this.audio.resumeFromGesture(); this.transition('play'); }
    } else if (command === 'end') this.transition('gameover');
    else this.transition('menu');
  };

  private readonly frame = (timestamp: number): void => {
    this.frameId = requestAnimationFrame(this.frame);
    try {
      this.advance(timestamp);
      this.failures = 0;
    } catch (error) {
      this.failures++;
      this.diagnostics.record(error, this.crashContext());
      if (this.failures > MAX_FRAME_FAILURES) this.halt();
      else this.recover();
    }
  };

  private readonly onError = (event: ErrorEvent): void => {
    this.diagnostics.record(event.error ?? event.message, this.crashContext());
  };

  private readonly onRejection = (event: PromiseRejectionEvent): void => {
    this.diagnostics.record(event.reason, this.crashContext());
  };

  private crashContext(): CrashContext {
    return { scene: this.state.scene, stage: this.session.stage, rules: RULES_VERSION };
  }

  private recover(): void {
    this.loop.reset();
    this.transition(this.state.scene === 'play' ? 'pause' : 'menu');
    this.ui.notice(t('crash_recovered'));
  }

  private halt(): void {
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
    this.ui.notice(t('crash_stopped'));
  }

  private advance(timestamp: number): void {
    const disconnected = this.gamepad.poll(this.readPads);
    this.mixer.activate(2, this.gamepad.actions.moveX);
    if (disconnected) this.suspend();
    if (this.padIndex !== this.gamepad.index || this.padAvailable !== this.gamepad.available) {
      this.padIndex = this.gamepad.index; this.padAvailable = this.gamepad.available;
      this.meta.controller(this.padIndex !== undefined, disconnected, this.padAvailable);
    }
    if (this.gamepad.consume('pause') && !this.meta.modal) this.command('pause');
    for (const command of PAD_MENU_COMMANDS) {
      const pressed = this.gamepad.consume(command);
      if (pressed && (this.state.scene !== 'play' || this.meta.modal || command === 'back')) this.meta.navigate(command);
    }
    if (this.keyboard.consume('debug')) this.command('debug');
    if (this.keyboard.consume('pause')) this.command('pause');
    if (this.keyboard.consume('confirm')) this.command('primary');
    if (this.keyboard.consume('end')) this.command('end');
    if (this.state.scene !== 'play') this.loop.reset();
    this.loop.frame(timestamp);
    this.audio.frame();
    this.fpsFrames++;
    this.fpsSince ??= timestamp;
    if (timestamp - this.fpsSince >= 500) {
      this.fps = this.fpsFrames * 1000 / (timestamp - this.fpsSince);
      this.fpsFrames = 0;
      this.fpsSince = timestamp;
    }
    if (timestamp - this.lastDiagnostics >= 250) {
      this.ui.diagnostics({
        captureCooldown: this.session.echo.cooldown, captureField: this.session.echo.field,
        drones: this.session.echo.drones, captures: this.session.echo.captures,
        ward: this.session.powers.ward, fan: this.session.powers.fan, overclock: this.session.powers.overclock,
        drops: this.session.drops.count, pickups: this.session.drops.collected,
        boss: this.session.boss.active, bossPhase: this.session.boss.phase,
        bossWarning: this.session.boss.warning, bossHP: this.session.boss.parts.map(part => part.hp).join('/'),
        stage: this.session.stage, stageTick: this.session.stageTick, lives: this.session.lives,
        respawn: this.session.vitals.respawn, invulnerable: this.session.vitals.invulnerable,
        bonus: this.session.config.kind === 'bonus', bonusRemaining: this.session.bonusRemaining,
        tally: this.session.tally, lastTally: this.session.lastTally,
        targets: this.session.config.layout.length, divers: this.session.attacks.active,
        launches: this.session.attacks.launches, hostiles: this.session.hostiles.count,
        peakHostiles: this.session.hostiles.peak, deferredShots: this.session.hostiles.deferred,
        hostileShots: this.session.hostiles.fired,
        fps: this.fps, ticks: this.range.ticks, alpha: this.loop.alpha,
        droppedMs: this.loop.droppedMs, seed: this.range.seed, rules: RULES_VERSION,
        moveX: this.actions.moveX, fire: this.actions.fire, capture: this.actions.capture,
        capturePresses: this.capturePresses,
        entities: Number(this.session.playerVisible) + this.session.echo.count + this.session.drops.count + this.session.boss.count + this.range.bullets.count + this.session.hostiles.count + this.session.formation.enemies.count, bullets: this.range.bullets.count,
        enemies: this.session.formation.enemies.count, score: this.session.score,
        kills: this.session.formation.kills, hits: this.session.formation.hits,
        damaged: this.session.formation.damaged, particles: this.session.particles.count,
        droppedParticles: this.session.particles.dropped, droppedEvents: this.session.formation.events.dropped,
        shots: this.range.shotsFired, peakBullets: this.range.bullets.peak,
        deniedVolleys: this.range.bullets.deniedVolleys, playerX: this.range.player.x,
        velocityX: this.range.player.velocityX, cooldown: this.range.cooldown,
      });
      this.presentation.update(this.audio);
      this.lastDiagnostics = timestamp;
    }
  }

  private update(): void {
    if (this.state.scene !== 'play') return;
    this.keyboard.sample(this.keyboardActions);
    this.touch.state.sample(this.touchActions);
    this.gamepad.sample(this.padActions);
    this.mixer.combine(this.actions, this.keyboardActions, this.touchActions, this.padActions, this.meta.settings.autofire);
    this.session.step(this.actions);
    this.audio.consume(this.session.events);
    this.renderer?.feedback.consume(this.session.events);
    if (this.session.complete) this.transition('gameover');
    if (this.actions.capture) this.capturePresses++;
  }

  private render(alpha: number): void {
    this.renderer?.draw(this.session, alpha, this.state.scene === 'play', this.motion.matches || this.meta.settings.motion === 'reduced');
  }

  private readonly resize = (): void => {
    const { width, height } = this.host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const viewport = calculateViewport(width, height, this.renderer?.feedback.settings.low ? Math.min(1.25, window.devicePixelRatio) : window.devicePixelRatio);
    this.canvas.style.width = `${viewport.width}px`;
    this.canvas.style.height = `${viewport.height}px`;
    this.canvas.width = viewport.pixelWidth;
    this.canvas.height = viewport.pixelHeight;
    this.render(this.loop.alpha);
  };
}
