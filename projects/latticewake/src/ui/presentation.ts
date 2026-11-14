import { t } from './strings';
import type { AudioStatus, Bus, GameAudio } from '../audio/audio';
import type { EffectSettings } from '../render/feedback';

export type PresentationChange = { kind: 'enable' } | { kind: 'mute'; value: boolean }
  | { kind: 'level'; bus: Bus; value: number } | { kind: 'effect'; effect: keyof EffectSettings; value: boolean };

export class PresentationUI {
  private handler: ((change: PresentationChange) => void) | undefined;
  private status: AudioStatus | undefined;
  constructor(private readonly host: HTMLElement) {}
  start(handler: (change: PresentationChange) => void): void {
    this.handler = handler;
    this.host.addEventListener('click', this.click);
    this.host.addEventListener('input', this.input);
  }
  update(audio: GameAudio): void {
    const button = this.host.querySelector<HTMLButtonElement>('#audio-enable');
    if (button && this.status !== audio.status) {
      button.textContent = audio.status === 'ready' ? t('audio_ready_button') : audio.status === 'enabling' ? t('audio_enabling_button')
        : audio.status === 'suspended' ? t('audio_resume_button') : audio.status === 'unavailable' ? t('audio_retry_button') : t('audio_enable_button');
      button.disabled = audio.status === 'enabling';
      const status = this.host.querySelector('#audio-status');
      if (status) status.textContent = audio.status === 'unavailable' ? t('audio_unavailable')
        : audio.status === 'suspended' ? t('audio_suspended')
          : audio.status === 'ready' ? t('audio_ready') : t('audio_disabled');
      this.status = audio.status;
    }
    const meter = this.host.querySelector('#audio-meter');
    if (meter) meter.textContent = t('audio_meter', { status: audio.status, sfx: audio.activeSfx, music: audio.activeMusic, peakSfx: audio.peakSfx, peakMusic: audio.peakMusic, dropped: audio.dropped, nodes: audio.nodes, buffers: audio.buffers });
  }
  dispose(): void {
    this.host.removeEventListener('click', this.click);
    this.host.removeEventListener('input', this.input);
    this.handler = undefined;
  }
  private readonly click = (event: Event): void => {
    if (event.target instanceof Element && event.target.closest('#audio-enable')) this.handler?.({ kind: 'enable' });
  };
  private readonly input = (event: Event): void => {
    const element = event.target;
    if (!(element instanceof HTMLInputElement)) return;
    const bus = element.dataset.bus;
    if (bus === 'master' || bus === 'music' || bus === 'sfx') {
      this.handler?.({ kind: 'level', bus, value: element.valueAsNumber / 100 });
      const output = this.host.querySelector(`output[for="${element.id}"]`);
      if (output) output.textContent = `${element.value}%`;
    } else if (element.id === 'audio-mute') this.handler?.({ kind: 'mute', value: element.checked });
    else {
      const effect = element.dataset.effect;
      if (effect === 'low' || effect === 'particles' || effect === 'shake' || effect === 'glow' || effect === 'scanlines') {
        this.handler?.({ kind: 'effect', effect, value: element.checked });
      }
    }
  };
}
