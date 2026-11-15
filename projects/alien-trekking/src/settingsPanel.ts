import { element } from './dom';
import { CHUNK_SIZE_M } from './engine/chunks';
import { SETTING_RANGES, type Settings } from './engine/settings';

/**
 * Sliders for draw distance, mouse sensitivity and volume. Each change is passed on
 * at once; the caller saves it and applies it to the running world.
 */
export function settingsPanel(current: Settings, onChange: (next: Settings) => void): HTMLElement {
  let settings = current;
  const section = element('section', undefined, 'panel settings');
  section.append(element('h2', 'Settings'));

  const slider = (
    key: keyof Settings,
    label: string,
    step: number,
    format: (value: number) => string,
  ): HTMLElement => {
    const { min, max } = SETTING_RANGES[key];
    const output = element('span', format(settings[key]), 'value');
    const input = element('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(settings[key]);
    input.addEventListener('input', () => {
      settings = { ...settings, [key]: Number(input.value) };
      output.textContent = format(settings[key]);
      onChange(settings);
    });
    const row = element('label', undefined, 'setting');
    row.append(element('span', label), input, output);
    return row;
  };

  section.append(
    slider('drawDistanceChunks', 'Draw distance', 1, (chunks) => `${chunks} chunks (${chunks * CHUNK_SIZE_M} m)`),
    slider('lookSensitivity', 'Mouse sensitivity', 0.05, (value) => `×${value.toFixed(2)}`),
    slider('volume', 'Volume', 0.05, (value) => `${Math.round(value * 100)}%`),
  );
  return section;
}
