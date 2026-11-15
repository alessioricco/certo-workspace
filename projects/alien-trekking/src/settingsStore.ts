import { parseSettings, type Settings } from './engine/settings';

const KEY = 'alien-trekking:settings';

export function loadSettings(): Settings {
  return parseSettings(localStorage.getItem(KEY));
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
