import { parseProgress, type Progress } from './engine/progress';

const KEY_PREFIX = 'alien-trekking:progress:';

export function loadProgress(levelId: string): Progress {
  return parseProgress(localStorage.getItem(KEY_PREFIX + levelId));
}

export function saveProgress(levelId: string, progress: Progress): void {
  localStorage.setItem(KEY_PREFIX + levelId, JSON.stringify(progress));
}
