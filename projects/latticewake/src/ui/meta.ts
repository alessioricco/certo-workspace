import type { Scene } from '../engine/state';
import type { PadCommand } from '../input/gamepad';
import { LocalMeta } from '../platform/storage';
import type { LocalScore } from '../platform/storage';
import { t } from './strings';

export class MetaUI {
  readonly store = new LocalMeta();
  private pending: LocalScore | undefined;
  private change: (() => void) | undefined;
  private pause: (() => void) | undefined;
  private sceneName: Scene = 'boot';
  constructor(private readonly host: HTMLElement) {}
  get settings() { return this.store.data.settings; }
  get modal(): boolean { return Boolean(this.host.querySelector<HTMLDialogElement>('#tutorial')?.open); }
  start(change: () => void, pause: () => void): void {
    this.change = change; this.pause = pause;
    this.host.addEventListener('input', this.input);
    this.host.addEventListener('click', this.click);
    this.host.addEventListener('submit', this.submit);
    this.host.addEventListener('keydown', this.keydown);
    this.hydrate(); this.scores(); this.storageNotice();
  }
  saveSettings(): void { this.store.saveSettings(this.settings); this.storageNotice(); }
  scene(scene: Scene, result: LocalScore | undefined, eligible = false): void {
    this.sceneName = scene; this.pending = scene === 'gameover' && eligible ? result : undefined;
    const form = this.get<HTMLFormElement>('#score-entry'); form.hidden = !this.pending;
    this.get<HTMLButtonElement>('#score-save').disabled = false;
    this.get('#score-feedback').textContent = '';
    const summary = this.get('#run-summary'); summary.hidden = scene !== 'gameover';
    summary.textContent = result ? t('run_summary', { ...result }) : '';
    this.get('#touch-controls').hidden = scene !== 'play';
  }
  controller(connected: boolean, disconnected: boolean, available: boolean): void {
    this.get('#input-status').textContent = !available ? t('pad_unavailable') : disconnected ? t('pad_disconnected') : connected ? t('pad_connected') : '';
  }
  navigate(command: PadCommand): void {
    if (command === 'back') {
      if (this.modal) this.get<HTMLDialogElement>('#tutorial').close();
      else if (this.get<HTMLDetailsElement>('#presentation').open) {
        this.get<HTMLDetailsElement>('#presentation').open = false; this.get<HTMLElement>('#presentation summary').focus();
      } else if (this.sceneName === 'play') this.pause?.();
      else if (this.sceneName === 'pause' || this.sceneName === 'gameover') this.get<HTMLButtonElement>('#menu').click();
      return;
    }
    const root = this.modal ? this.get('#tutorial') : this.host;
    const items = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), summary, input, select')].filter(item => item.getClientRects().length > 0 && !item.closest('[hidden]'));
    const focused = document.activeElement;
    const index = items.indexOf(focused as HTMLElement);
    if (command === 'next' || command === 'previous') items[(index + (command === 'next' ? 1 : -1) + items.length) % items.length]?.focus();
    else if (command === 'confirm') {
      if (focused instanceof HTMLSelectElement) this.adjust(focused, 1);
      else if (focused instanceof HTMLElement && items.includes(focused)) focused.click();
    } else if ((command === 'increase' || command === 'decrease') && (focused instanceof HTMLInputElement || focused instanceof HTMLSelectElement)) this.adjust(focused, command === 'increase' ? 1 : -1);
  }
  dispose(): void {
    this.host.removeEventListener('input', this.input); this.host.removeEventListener('click', this.click);
    this.host.removeEventListener('submit', this.submit); this.host.removeEventListener('keydown', this.keydown);
    if (this.modal) this.get<HTMLDialogElement>('#tutorial').close();
    this.change = this.pause = undefined;
  }
  private get<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.host.querySelector<T>(selector); if (!element) throw new Error(`Missing meta UI: ${selector}`); return element;
  }
  private hydrate(): void {
    for (const input of this.host.querySelectorAll<HTMLInputElement>('input[data-bus]')) {
      const bus = input.dataset.bus;
      if (bus === 'master' || bus === 'music' || bus === 'sfx') {
        input.value = String(this.settings[bus] * 100);
        const output = this.host.querySelector(`output[for="${input.id}"]`); if (output) output.textContent = `${input.value}%`;
      }
    }
    this.get<HTMLInputElement>('#audio-mute').checked = this.settings.muted;
    for (const input of this.host.querySelectorAll<HTMLInputElement>('input[data-effect]')) {
      const effect = input.dataset.effect;
      if (effect === 'low' || effect === 'particles' || effect === 'shake' || effect === 'glow' || effect === 'scanlines') input.checked = this.settings.effects[effect];
    }
    this.get<HTMLSelectElement>('#palette').value = this.settings.palette;
    this.get<HTMLSelectElement>('#motion').value = this.settings.motion;
    this.get<HTMLSelectElement>('#touch-mode').value = this.settings.touch;
    this.get<HTMLInputElement>('#autofire').checked = this.settings.autofire;
    this.layout();
  }
  private layout(): void {
    this.host.dataset.palette = this.settings.palette;
    this.get('#drag-pad').hidden = this.settings.touch !== 'drag';
    this.get('#direction-buttons').hidden = this.settings.touch !== 'buttons';
  }
  private storageNotice(): void { this.get('#storage-status').textContent = this.store.memoryOnly ? t('storage_memory') : ''; }
  private scores(): void {
    const list = this.get('#score-list'); list.replaceChildren();
    for (const score of this.store.data.scores) {
      const item = document.createElement('li'); item.textContent = t('score_row', { ...score }); list.append(item);
    }
    this.get('#scores-empty').hidden = this.store.data.scores.length > 0;
  }
  private adjust(input: HTMLInputElement | HTMLSelectElement, direction: number): void {
    if (input instanceof HTMLSelectElement) input.selectedIndex = Math.max(0, Math.min(input.options.length - 1, input.selectedIndex + direction));
    else if (input.type === 'range') input.valueAsNumber = Math.max(Number(input.min), Math.min(Number(input.max), input.valueAsNumber + direction * 5));
    else return;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  private readonly input = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
    const key = input.dataset.setting;
    if (key === 'palette' && (input.value === 'default' || input.value === 'color-safe' || input.value === 'contrast')) this.settings.palette = input.value;
    else if (key === 'motion' && (input.value === 'system' || input.value === 'reduced')) this.settings.motion = input.value;
    else if (key === 'touch' && (input.value === 'drag' || input.value === 'buttons')) this.settings.touch = input.value;
    else if (key === 'autofire' && input instanceof HTMLInputElement) this.settings.autofire = input.checked;
    else return;
    this.saveSettings(); this.layout(); this.change?.();
  };
  private readonly click = (event: Event): void => {
    if (!(event.target instanceof Element) || !event.target.closest('#help-open')) return;
    if (this.sceneName === 'play') this.pause?.();
    this.get<HTMLDialogElement>('#tutorial').showModal();
  };
  private readonly submit = (event: SubmitEvent): void => {
    if (!(event.target instanceof Element) || event.target.id !== 'score-entry') return;
    event.preventDefault(); if (!this.pending) return;
    this.store.addScore({ ...this.pending, alias: this.get<HTMLInputElement>('#score-alias').value }); this.pending = undefined;
    this.get<HTMLButtonElement>('#score-save').disabled = true; this.get('#score-feedback').textContent = t('score_saved');
    this.scores(); this.storageNotice(); this.get<HTMLButtonElement>('#primary').focus();
  };
  private readonly keydown = (event: KeyboardEvent): void => {
    if (this.modal && event.code === 'Tab') {
      event.preventDefault(); this.get<HTMLButtonElement>('#help-close').focus();
    }
    if (event.code === 'Escape' && !this.modal && this.get<HTMLDetailsElement>('#presentation').open) {
      event.preventDefault(); event.stopPropagation(); this.get<HTMLDetailsElement>('#presentation').open = false;
      this.get<HTMLElement>('#presentation summary').focus();
    }
  };
}
