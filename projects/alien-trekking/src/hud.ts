import { element, setText } from './dom';
import { SAMPLER_COOLDOWN_S } from './engine/sampler';
import { COMFORT_MAX_K, COMFORT_MIN_K, HEALTH_MAX, OXYGEN_MAX, type Vitals } from './engine/survival';

export interface HudReadout {
  vitals: Vitals;
  temperatureK: number;
  breathable: boolean;
  sheltered: boolean;
  samplerCooldownS: number;
}

interface Readout {
  row: HTMLElement;
  value: HTMLElement;
}

interface Gauge extends Readout {
  fill: HTMLElement;
}

function readout(label: string, className: string): Readout {
  const value = element('span', undefined, 'value');
  const row = element('div', undefined, `line ${className}`);
  row.append(element('span', label), value);
  return { row, value };
}

function gauge(label: string, className: string): Gauge {
  const { row, value } = readout(label, `gauge ${className}`);
  const fill = element('span', undefined, 'fill');
  const bar = element('span', undefined, 'bar');
  bar.append(fill);
  row.append(bar);
  return { row, value, fill };
}

function climate(temperatureK: number): string {
  if (temperatureK < COMFORT_MIN_K) return 'too cold';
  if (temperatureK > COMFORT_MAX_K) return 'too hot';
  return 'comfortable';
}

/** The vitals on screen: health, oxygen, outside temperature and the sampler's recharge. */
export class Hud {
  readonly element: HTMLElement;
  private readonly health = gauge('Health', 'health');
  private readonly oxygen = gauge('Oxygen', 'oxygen');
  private readonly temperature = readout('Temperature', 'temperature');
  private readonly sampler = readout('Sampler', 'sampler');

  constructor() {
    this.element = element('section', undefined, 'hud');
    this.element.append(
      this.health.row,
      this.oxygen.row,
      this.temperature.row,
      this.sampler.row,
    );
  }

  update(state: HudReadout): void {
    const { vitals } = state;
    setText(this.health.value, `${Math.ceil(vitals.health)} of ${HEALTH_MAX}`);
    this.health.fill.style.width = `${(vitals.health / HEALTH_MAX) * 100}%`;

    if (state.breathable) {
      setText(this.oxygen.value, 'breathable air');
      this.oxygen.fill.style.width = '100%';
    } else {
      setText(this.oxygen.value, `${Math.ceil(vitals.oxygen)}%`);
      this.oxygen.fill.style.width = `${(vitals.oxygen / OXYGEN_MAX) * 100}%`;
    }

    const where = state.sheltered ? 'sheltered' : climate(state.temperatureK);
    setText(this.temperature.value, `${state.temperatureK.toFixed(1)} K · ${where}`);

    setText(
      this.sampler.value,
      state.samplerCooldownS > 0
        ? `recharging, ${Math.ceil(state.samplerCooldownS)} of ${SAMPLER_COOLDOWN_S} s`
        : 'ready',
    );
  }
}
