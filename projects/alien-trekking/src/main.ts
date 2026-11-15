import { element } from './dom';
import { resolveAssets } from './engine/assets';
import { createEcosystem, type Ecosystem } from './engine/ecosystem';
import { localTemperatureK } from './engine/habitat';
import { LANDER, atLander } from './engine/lander';
import { landmarksInReach, planLandmarks } from './engine/landmarks';
import type { Level } from './engine/level';
import { loadLevelAt, loadLevelIndex, resolveLevelUrl } from './engine/levelLoader';
import { moonView, planMoons } from './engine/moons';
import { evaluateObjectives, isAwayFromLander, objectivesComplete } from './engine/objectives';
import {
  createPlayer,
  EYE_HEIGHT_M,
  IDLE_INTENT,
  lookDirection,
  MAX_STEP_S,
  stepPlayer,
  type Ground,
  type PlayerIntent,
} from './engine/player';
import { markReturned, reachLandmark, recordSpecies, type Progress } from './engine/progress';
import { buildSurveyReport } from './engine/report';
import { createSampler, fireSampler, STUN_SECONDS, stepSampler, stunCreature } from './engine/sampler';
import type { ScanTarget } from './engine/scanner';
import type { PredatorEvent } from './engine/predators';
import { skyState, worldHours, type SkyState, type SkyWorld, type Vec3 } from './engine/sky';
import { terrainHeight } from './engine/terrain';
import { freshVitals, isDown, stepVitals, takeDamage, type Vitals } from './engine/survival';
import { computeWorldFacts } from './engine/worldFacts';
import { createFooting, footstepLoudness, stepFooting, type Footing } from './engine/footing';
import { mixSeed, mulberry32 } from './engine/random';
import type { Settings } from './engine/settings';
import {
  CALL_MEAN_INTERVAL_S,
  callLevel,
  callPitchHz,
  nearestCaller,
  stepCallTimer,
  windCutoffHz,
  windLevel,
  type CallTimer,
} from './engine/soundscape';
import { Hud } from './hud';
import { ObjectivesHud } from './objectivesHud';
import { briefingPanel, errorPanel, pageHeader, reportPanel, surveyLog, titlePage } from './pages';
import { loadProgress, saveProgress } from './progressStore';
import { settingsPanel } from './settingsPanel';
import { loadSettings, saveSettings } from './settingsStore';
import { WorldSound } from './sound';
import { BUILD_BUDGET_MS, BuildBudget } from './render/budget';
import { loadAssets, type LoadedAssets } from './render/assets';
import { createLandmarks } from './render/landmarks';
import { createLander } from './render/lander';
import { LifeRenderer } from './render/life';
import { SkyRenderer } from './render/sky';
import { TerrainStreamer } from './render/terrain';
import { createView, placeCamera, resizeView } from './render/view';

type Action = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'run';

const CALL_SALT = 0x510e527f;

const ACTIONS: Record<string, Action> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};

const LOOK_RADIANS_PER_PIXEL = 0.002;
const PITCH_LIMIT_RAD = Math.PI / 2 - 0.01;
const NOTICE_MS = 2000;
const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

const held = new Set<Action>();
const look = { yaw: 0, pitch: 0 };
let settings: Settings = loadSettings();
let paused = false;

function applySettings(next: Settings): void {
  settings = next;
  saveSettings(next);
}

/** A world loaded and ready to play: its generated life, its assets and the player's progress in it. */
interface Session {
  level: Level;
  ecosystem: Ecosystem;
  assets: LoadedAssets;
  progress: Progress;
}

function readIntent(): PlayerIntent {
  return {
    forward: (held.has('forward') ? 1 : 0) - (held.has('back') ? 1 : 0),
    strafe: (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
    yaw: look.yaw,
    running: held.has('run'),
    jump: held.has('jump'),
  };
}

function listenForInput(canvas: HTMLCanvasElement): void {
  window.addEventListener('keydown', (event) => {
    const action = ACTIONS[event.code];
    if (!action || document.pointerLockElement !== canvas || paused) return;
    event.preventDefault();
    held.add(action);
  });
  window.addEventListener('keyup', (event) => {
    const action = ACTIONS[event.code];
    if (action) held.delete(action);
  });
  window.addEventListener('blur', () => held.clear());
  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== canvas || paused) return;
    const radiansPerPixel = LOOK_RADIANS_PER_PIXEL * settings.lookSensitivity;
    look.yaw -= event.movementX * radiansPerPixel;
    look.pitch = Math.max(
      -PITCH_LIMIT_RAD,
      Math.min(PITCH_LIMIT_RAD, look.pitch - event.movementY * radiansPerPixel),
    );
  });
}

function skyWorld(level: Level): SkyWorld {
  return {
    starClass: level.star.class,
    dayLengthHours: level.planet.dayLengthHours,
    pressureAtm: level.planet.atmosphere.pressureAtm,
  };
}

function describeSky(state: SkyState, dayLengthHours: number): string {
  const elevation = Math.round(state.starElevationDeg);
  const hour = state.timeOfDayHours.toFixed(1);
  return `${state.phase} · star ${elevation}° · hour ${hour} of ${dayLengthHours}`;
}

/** The hour the game starts at, from `?hour=`, or mid-morning. */
function parseStartHour(param: string | null, dayLengthHours: number): number {
  const hour = Number(param);
  return param !== null && Number.isFinite(hour) ? hour : dayLengthHours / 8;
}

function startGame(
  { level, ecosystem, assets, progress: saved }: Session,
  canvas: HTMLCanvasElement,
  startHours: number,
  sound: WorldSound,
): void {
  const facts = computeWorldFacts(level);
  const ground: Ground = {
    gravityMS2: facts.gravityMS2,
    heightAt: (x, z) => terrainHeight(x, z, level.seed),
  };
  const breathable = facts.air === 'breathable';
  const view = createView(canvas);
  const terrain = new TerrainStreamer(view.scene, level.seed);
  const life = new LifeRenderer(view.scene, ecosystem, assets.species);
  createLander(view.scene, level.seed, assets.lander);
  const landmarks = planLandmarks(level);
  createLandmarks(view.scene, landmarks, level.seed);
  const moons = planMoons(level.seed);
  const sky = new SkyRenderer(view.scene, level.seed, moons.length);
  const world = skyWorld(level);
  const clock = element('div', undefined, 'clock');
  const hint = element('div', undefined, 'hint');
  const survey = element('section', undefined, 'survey');
  survey.hidden = true;
  const reportBox = element('section', undefined, 'report');
  reportBox.hidden = true;
  const objectivesHud = new ObjectivesHud();
  const hud = new Hud();
  document.body.append(clock, hint, survey, reportBox, objectivesHud.element, hud.element);
  window.addEventListener('resize', () => resizeView(view));
  listenForInput(canvas);

  let progress = saved;
  let statuses = evaluateObjectives(level.objectives, progress);
  objectivesHud.update(statuses, assets.notes);
  survey.replaceChildren(...surveyLog(progress.species));
  let wandered = false;
  let body = createPlayer(LANDER.x, LANDER.z, ground);
  let vitals: Vitals = freshVitals();
  let sampler = createSampler();
  let footing: Footing = createFooting();
  let sounding = false;
  const callRandom = mulberry32(mixSeed(level.seed, CALL_SALT));
  let callTimer: CallTimer = { remainingS: CALL_MEAN_INTERVAL_S };
  let last = performance.now();
  let elapsedS = 0;
  let clockText = '';
  let hintText = '';
  let notice = { text: '', untilMs: 0 };
  document.addEventListener('pointerlockchange', () => {
    held.clear();
    if (!sounding) return;
    if (document.pointerLockElement === canvas && !paused) sound.resume();
    else sound.pause();
  });

  const say = (text: string): void => {
    notice = { text, untilMs: performance.now() + NOTICE_MS };
  };
  const showReport = (): void => {
    reportBox.replaceChildren(reportPanel(buildSurveyReport(level, progress)));
    reportBox.hidden = false;
  };
  const commit = (next: Progress): void => {
    const wasComplete = objectivesComplete(statuses);
    progress = next;
    saveProgress(level.id, progress);
    survey.replaceChildren(...surveyLog(progress.species));
    statuses = evaluateObjectives(level.objectives, progress);
    objectivesHud.update(statuses, assets.notes);
    if (!wasComplete && objectivesComplete(statuses)) {
      showReport();
      say('Every objective is done: your survey report is open. Press R to close it.');
    }
  };
  const eye = (): Vec3 => [body.x, body.y + EYE_HEIGHT_M, body.z];
  const aimForward = (): Vec3 => lookDirection(look.yaw, look.pitch);
  const aimedTarget = (): ScanTarget | undefined => life.aimTarget(eye(), aimForward());
  const scanAimed = (): void => {
    const target = aimedTarget();
    if (!target) return;
    const species = life.speciesOf(target.speciesId);
    if (progress.species.some((entry) => entry.id === species.id)) {
      say(`${species.name} is already in the survey log`);
      return;
    }
    say(`Logged ${species.name}`);
    sound.scanChirp();
    commit(recordSpecies(progress, species));
  };
  const stunAimed = (): void => {
    const target = aimedTarget();
    if (!target?.creature) return;
    const shot = fireSampler(sampler);
    sampler = shot.sampler;
    const { name } = life.speciesOf(target.speciesId);
    if (!shot.fired) {
      say(`Sampler recharging, ${Math.ceil(sampler.cooldownS)} s`);
      return;
    }
    sound.samplerShot();
    stunCreature(target.creature);
    say(`Stunned ${name} for ${STUN_SECONDS} s`);
  };
  const react = (event: PredatorEvent): void => {
    const { name } = life.speciesOf(event.speciesId);
    if (event.kind === 'warn') {
      sound.warningCall();
      say(`${name} warns you: back out of its territory`);
      return;
    }
    vitals = takeDamage(vitals, event.damage);
    say(`${name} strikes you!`);
  };
  window.addEventListener('mousedown', (event) => {
    if (document.pointerLockElement !== canvas || paused) return;
    if (event.button === RIGHT_BUTTON) scanAimed();
    if (event.button === LEFT_BUTTON) stunAimed();
  });
  window.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('keydown', (event) => {
    if (document.pointerLockElement !== canvas) return;
    if (event.code === 'Tab') {
      event.preventDefault();
      if (!event.repeat) survey.hidden = !survey.hidden;
    } else if (event.code === 'KeyR' && !event.repeat) {
      if (reportBox.hidden) showReport();
      else reportBox.hidden = true;
    } else if (event.code === 'KeyP' && !event.repeat) {
      paused = !paused;
      if (paused) {
        held.clear();
        sound.pause();
      } else {
        sound.resume();
      }
    } else if (event.code === 'KeyM' && !event.repeat) {
      say(sound.toggleMute() ? 'Sound muted' : 'Sound on');
    }
  });

  const frame = (now: number): void => {
    const active = document.pointerLockElement === canvas && !paused;
    const dt = active ? Math.min((now - last) / 1000, MAX_STEP_S) : 0;
    last = now;
    const budget = new BuildBudget(BUILD_BUDGET_MS);
    if (active && !sounding) {
      sounding = true;
      sound.start();
    }
    const intent = active ? readIntent() : { ...IDLE_INTENT, yaw: look.yaw };
    const previous = body;
    if (active) body = stepPlayer(body, intent, dt, ground);
    const stride = Math.hypot(body.x - previous.x, body.z - previous.z);
    const moving = body.grounded && stride > 0;
    const step = stepFooting(footing, moving, intent.running, facts.gravityMS2, dt);
    footing = step.footing;
    if (step.footfall) sound.footstep(footstepLoudness(facts.gravityMS2));
    placeCamera(view.camera, body, look.yaw, look.pitch, step.bobM);

    if (active) {
      if (isAwayFromLander(body)) wandered = true;
      if (wandered && atLander(body) && !progress.returned) {
        say('Back at the lander: trek complete.');
        commit(markReturned(progress));
      }
      for (const name of landmarksInReach(landmarks, body)) {
        if (progress.landmarks.includes(name)) continue;
        say(`You reached ${name}`);
        commit(reachLandmark(progress, name));
      }
    }

    elapsedS += dt;
    const hours = worldHours(startHours, elapsedS);
    const state = skyState(world, hours);
    sky.update(state, moons.map((moon) => moonView(moon, world, hours)), view.camera.position);
    const text = describeSky(state, world.dayLengthHours);
    if (text !== clockText) {
      clockText = text;
      clock.textContent = text;
    }

    terrain.update(body.x, body.z, settings.drawDistanceChunks, budget);
    const running = intent.running && stride > 0;
    const events = life.update(terrain.detailedCoords(), { x: body.x, z: body.z, running }, dt, budget, active);
    const temperatureK = localTemperatureK(facts.surfaceTemperatureK, ground.heightAt(body.x, body.z));
    if (active) {
      const calling = stepCallTimer(callTimer, dt, callRandom);
      callTimer = calling.timer;
      if (calling.due) {
        const heard = nearestCaller(life.callers(), body);
        if (heard) sound.call(callPitchHz(heard.caller.bodyLengthM), callLevel(heard.distanceM));
      }
      sampler = stepSampler(sampler, dt);
      vitals = stepVitals(vitals, { breathable, sheltered: atLander(body), running, temperatureK }, dt);
      for (const event of events) react(event);
      if (isDown(vitals)) {
        body = createPlayer(LANDER.x, LANDER.z, ground);
        wandered = false;
        vitals = freshVitals();
        say('You woke at the lander. Your survey log is safe.');
      }
    }
    hud.update({
      vitals,
      temperatureK,
      breathable,
      sheltered: atLander(body),
      samplerCooldownS: sampler.cooldownS,
    });

    const aimed = active ? aimedTarget() : undefined;
    const hintNow = paused
      ? 'Paused · press P to resume'
      : now < notice.untilMs
        ? notice.text
        : aimed
          ? `Right-click to scan ${life.speciesOf(aimed.speciesId).kind}${aimed.creature ? ', left-click to stun' : ''}`
          : '';
    if (hintNow !== hintText) {
      hintText = hintNow;
      hint.textContent = hintNow;
    }

    life.cull(view.camera);
    view.renderer.render(view.scene, view.camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function showWorldList(app: HTMLElement): Promise<void> {
  const index = await loadLevelIndex();
  if (!index.ok) {
    app.replaceChildren(pageHeader(false), errorPanel(index.errors));
    return;
  }
  const progress = new Map(index.value.map((entry) => [entry.id, loadProgress(entry.id)]));
  app.replaceChildren(pageHeader(false), titlePage(index.value, progress), settingsPanel(settings, applySettings));
}

async function openWorld(app: HTMLElement, canvas: HTMLCanvasElement, requested: string): Promise<void> {
  app.replaceChildren(pageHeader(true), element('section', 'Loading the world…', 'panel'));
  const url = await resolveLevelUrl(requested);
  if (!url.ok) {
    app.replaceChildren(pageHeader(true), errorPanel(url.errors));
    return;
  }
  const loaded = await loadLevelAt(url.value);
  if (!loaded.ok) {
    app.replaceChildren(pageHeader(true), errorPanel(loaded.errors));
    return;
  }
  const level = loaded.value;
  const ecosystem = createEcosystem(level);
  const levelUrl = new URL(url.value, window.location.href).href;
  const assets = await loadAssets(resolveAssets(level.assets, levelUrl), ecosystem);
  const progress = loadProgress(level.id);
  const report = buildSurveyReport(level, progress);
  const { pressureAtm } = level.planet.atmosphere;
  const sound = new WorldSound(level.seed, windLevel(pressureAtm), windCutoffHz(pressureAtm), settings.volume);
  app.replaceChildren(
    pageHeader(true),
    briefingPanel(level, report, assets.notes, canvas),
    settingsPanel(settings, (next) => {
      applySettings(next);
      sound.setVolume(next.volume);
    }),
  );
  const hour = new URLSearchParams(window.location.search).get('hour');
  startGame(
    { level, ecosystem, assets, progress },
    canvas,
    parseStartHour(hour, level.planet.dayLengthHours),
    sound,
  );
}

async function main(app: HTMLElement, canvas: HTMLCanvasElement): Promise<void> {
  const requested = new URLSearchParams(window.location.search).get('level');
  if (requested === null) await showWorldList(app);
  else await openWorld(app, canvas, requested);
}

const app = document.getElementById('app');
if (!app) throw new Error('index.html has no #app element');
const canvas = document.getElementById('world');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('index.html has no #world canvas');
void main(app, canvas);
