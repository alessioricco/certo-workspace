import { element } from './dom';
import type { Level } from './engine/level';
import type { LevelIndexEntry } from './engine/levelLoader';
import { MAX_SCAN_COUNT, type ObjectiveStatus } from './engine/objectives';
import type { Progress } from './engine/progress';
import type { SurveyReport } from './engine/report';
import type { SpeciesInfo } from './engine/species';
import type { WorldFacts } from './engine/worldFacts';

export function pageHeader(linkBackToWorlds: boolean): HTMLElement {
  const header = element('header');
  header.append(element('h1', 'Alien Trekking'));
  if (linkBackToWorlds) {
    const nav = element('nav', undefined, 'levels');
    const link = element('a', 'All worlds');
    link.href = './';
    nav.append(link);
    header.append(nav);
  }
  return header;
}

function progressLine(progress: Progress | undefined): string {
  if (!progress || (progress.species.length === 0 && progress.landmarks.length === 0 && !progress.returned)) {
    return 'not started';
  }
  const returned = progress.returned ? ' · returned to the lander' : '';
  return `${progress.species.length} species logged · ${progress.landmarks.length} landmarks reached${returned}`;
}

/** The worlds to choose from, their saved progress, and a field for a world's URL or file name. */
export function titlePage(entries: readonly LevelIndexEntry[], progress: ReadonlyMap<string, Progress>): HTMLElement {
  const section = element('section', undefined, 'panel');
  section.append(element('h2', 'Choose a world'));

  const list = element('ul', undefined, 'worlds');
  for (const entry of entries) {
    const link = element('a', entry.id);
    link.href = `?level=${encodeURIComponent(entry.id)}`;
    const item = element('li');
    item.append(link, element('span', progressLine(progress.get(entry.id)), 'value'));
    list.append(item);
  }

  const input = element('input');
  input.type = 'text';
  input.name = 'level';
  input.placeholder = 'https://example.com/worlds/my-world.json';
  input.required = true;
  const label = element('label', 'Or open a world by URL, or a file name in levels/', 'open-world');
  label.append(input);
  const form = element('form');
  const open = element('button', 'Open world');
  open.type = 'submit';
  form.append(label, open);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    window.location.href = `?level=${encodeURIComponent(input.value.trim())}`;
  });

  section.append(list, form);
  return section;
}

/** Shown in place of a world when its file or the world list cannot be loaded. */
export function errorPanel(errors: readonly string[]): HTMLElement {
  const section = element('section', undefined, 'panel');
  section.append(element('h2', 'This level cannot be loaded', 'error'));
  const list = element('ul', undefined, 'errors');
  for (const error of errors) list.append(element('li', error));
  const back = element('a', 'Back to the worlds');
  back.href = './';
  section.append(list, back);
  return section;
}

function formatFacts(facts: WorldFacts): HTMLElement {
  const list = element('ul', undefined, 'facts');
  const row = (label: string, value: string): HTMLElement => {
    const item = element('li');
    item.append(element('span', label, 'label'), element('span', value, 'value'));
    return item;
  };
  list.append(
    row('Surface gravity', `${facts.gravityMS2.toFixed(2)} m/s²`),
    row('Escape velocity', `${facts.escapeVelocityKmS.toFixed(2)} km/s`),
    row('Surface temperature', `${facts.surfaceTemperatureK.toFixed(1)} K`),
    row(
      'Habitable zone',
      `${facts.habitableZone.inner.toFixed(2)} to ${facts.habitableZone.outer.toFixed(2)} AU`,
    ),
    row('In habitable zone', facts.inHabitableZone ? 'yes' : 'no'),
    row('Air', facts.air),
  );
  return list;
}

function objectiveList(statuses: readonly ObjectiveStatus[]): HTMLElement {
  if (statuses.length === 0) return element('p', 'This world has no objectives.');
  const list = element('ul', undefined, 'objectives-list');
  for (const status of statuses) {
    list.append(element('li', `${status.done ? '✓' : '○'} ${status.label}`, status.done ? 'done' : undefined));
  }
  return list;
}

/** The species the player has logged, one entry each. */
export function surveyLog(entries: readonly SpeciesInfo[]): HTMLElement[] {
  const heading = element('h2', `Survey log · ${entries.length} identified`);
  if (entries.length === 0) {
    return [heading, element('p', 'Nothing identified yet. Aim at a plant or animal and right-click to scan it.')];
  }
  return [
    heading,
    ...entries.map((entry) => {
      const item = element('section', undefined, 'entry');
      item.append(element('h3', `${entry.name} · ${entry.kind}`), element('p', entry.description));
      return item;
    }),
  ];
}

/** The survey report: the planet's facts, the objectives and the species found. */
export function reportPanel(report: SurveyReport): HTMLElement {
  const section = element('section', undefined, 'panel');
  section.append(
    element('h2', `Survey report · ${report.worldName}`),
    formatFacts(report.facts),
    element('h3', 'Objectives'),
    objectiveList(report.objectives),
    ...surveyLog(report.species),
  );
  return section;
}

/** The world's facts, its objectives and how far the survey has got, before the player starts. */
export function briefingPanel(
  level: Level,
  report: SurveyReport,
  notes: readonly string[],
  canvas: HTMLCanvasElement,
): HTMLElement {
  const section = element('section', undefined, 'panel');
  const start = element('button', 'Start exploring');
  const pointerError = element('p', '', 'error');
  start.addEventListener('click', () => {
    void Promise.resolve(canvas.requestPointerLock()).catch(() => {
      pointerError.textContent = 'Mouse capture was denied. Click Start exploring to try again.';
    });
  });
  section.append(
    element('h2', level.name),
    element('p', `Star class ${level.star.class} · seed ${level.seed}`),
    formatFacts(report.facts),
    element('h3', 'Objectives'),
    objectiveList(report.objectives),
    element('p', `${report.species.length} of ${MAX_SCAN_COUNT} species logged`),
  );
  if (notes.length > 0) {
    const list = element('ul', undefined, 'notes');
    for (const note of notes) list.append(element('li', note));
    section.append(element('h3', 'Assets'), list);
  }
  section.append(
    element(
      'p',
      'Move with W A S D (or arrow keys), look with the mouse, jump with Space, run with Shift. Right-click to scan life, left-click to stun a creature with the sampler, Tab for the survey log, R for the survey report, P to pause the world, M to mute, Esc to release the mouse.',
      'controls',
    ),
    start,
    pointerError,
  );
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (locked) pointerError.textContent = '';
    document.body.classList.toggle('playing', locked);
    start.textContent = locked ? 'Start exploring' : 'Continue exploring';
  });
  return section;
}
