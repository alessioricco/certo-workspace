import { AudioDispatch } from './dispatch';
import { bassNote, EIGHTH_SECONDS, leadNote, MUSIC_STEPS, SFX, synthesize, synthesizeNote } from './patches';
import type { Sound } from './patches';
import type { HitEvents } from '../game/events';

export type AudioStatus = 'disabled' | 'enabling' | 'ready' | 'suspended' | 'unavailable';
export type Bus = 'master' | 'music' | 'sfx';
interface Voice { source: AudioBufferSourceNode | undefined; gain: GainNode; ended: (event: Event) => void }
export const SFX_VOICES = 24;
export const MUSIC_VOICES = 8;

export class GameAudio {
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private music: GainNode | undefined;
  private sfx: GainNode | undefined;
  private readonly effects = new Map<Sound, AudioBuffer>();
  private readonly notes = new Map<number, AudioBuffer>();
  private readonly voices: Voice[] = [];
  private readonly dispatch = new AudioDispatch();
  private readonly levels = { master: 0.6, music: 0.35, sfx: 0.65 };
  private seed = 0;
  private playing = false;
  private disposed = false;
  private needsGesture = false;
  private pending: Promise<void> | undefined;
  private nextNote = 0;
  private musicStep = 0;
  private muted = false;
  private lifecycle = 0;
  private suspension: ReturnType<typeof setTimeout> | undefined;
  private cancelActivation: (() => void) | undefined;
  status: AudioStatus = 'disabled';
  dropped = 0;
  peakSfx = 0;
  peakMusic = 0;

  constructor(private readonly createContext: () => AudioContext = () => new AudioContext()) {}

  get activeSfx(): number { return this.count(0, SFX_VOICES); }
  get activeMusic(): number { return this.count(SFX_VOICES, SFX_VOICES + MUSIC_VOICES); }
  get buffers(): number { return this.effects.size + this.notes.size; }
  get nodes(): number { return this.context ? 3 + this.voices.length + this.activeSfx + this.activeMusic : 0; }

  enable(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = this.unlock().finally(() => { this.pending = undefined; });
    return this.pending;
  }

  private async unlock(): Promise<void> {
    this.status = 'enabling';
    clearTimeout(this.suspension);
    const lifecycle = ++this.lifecycle;
    try {
      if (this.context?.state === 'closed') this.release();
      if (!this.context) this.initialize();
      const context = this.context;
      if (!context) throw new Error('Audio unavailable');
      this.needsGesture = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([context.resume(), new Promise<never>((_, reject) => {
          this.cancelActivation = () => reject(new Error('Audio activation cancelled'));
          timeout = setTimeout(() => reject(new Error('Audio activation timed out')), 1500);
        })]);
      } finally { clearTimeout(timeout); this.cancelActivation = undefined; }
      if (this.disposed || lifecycle !== this.lifecycle) {
        if (context.state === 'running') await context.suspend();
        return;
      }
      if (context.state !== 'running') throw new Error('Audio activation denied');
      this.status = 'ready';
      if (this.effects.size === 0) this.prepare();
      this.nextNote = context.currentTime + 0.03;
    } catch {
      if (!this.disposed && lifecycle === this.lifecycle) this.fail();
    }
  }

  reset(seed: number): void {
    this.seed = seed;
    this.dispatch.reset();
    this.stopVoices();
    this.musicStep = this.dropped = this.peakMusic = this.peakSfx = 0;
    if (this.context && this.effects.size > 0) {
      try {
        this.effects.clear(); this.prepareEffects();
        this.nextNote = this.context.currentTime + 0.03;
      } catch { this.fail(); }
    }
  }

  setLevel(bus: Bus, value: number): void {
    if (!Number.isFinite(value)) return;
    this.levels[bus] = Math.min(1, Math.max(0, value));
    this.applyLevels();
  }
  setMuted(muted: boolean): void { this.muted = muted; this.applyLevels(); if (muted) this.stopVoices(); }
  setPlaying(playing: boolean): void {
    this.playing = playing;
    if (!playing) {
      this.lifecycle++;
      this.cancelActivation?.();
      if (this.status === 'enabling') { this.status = 'suspended'; this.needsGesture = true; }
      this.stopVoices();
      if (this.context?.state === 'running') {
        clearTimeout(this.suspension);
        this.suspension = setTimeout(() => {
          void this.context?.suspend().catch(() => { this.status = 'unavailable'; });
        }, 20);
      }
    }
  }
  suspend(): void {
    if (!this.context) return;
    this.needsGesture = true;
    this.setPlaying(false);
  }
  resumeFromGesture(): void {
    if (this.context && this.status !== 'unavailable') void this.enable();
  }
  consume(events: Readonly<HitEvents>): void { this.dispatch.consume(events, this.playSound); }

  frame(): void {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.playing || this.needsGesture || this.muted) return;
    if (this.nextNote < context.currentTime) this.nextNote = context.currentTime + 0.03;
    while (this.nextNote < context.currentTime + 0.12) {
      const lead = leadNote(this.musicStep); const bass = bassNote(this.musicStep);
      if (this.levels.music > 0) {
        if (lead >= 0) this.startVoice(this.notes.get(lead), true, this.nextNote);
        if (bass >= 0) this.startVoice(this.notes.get(bass), true, this.nextNote);
      }
      this.musicStep = (this.musicStep + 1) % MUSIC_STEPS;
      this.nextNote += EIGHTH_SECONDS;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.lifecycle++;
    this.release();
    this.status = 'disabled';
  }

  private release(): void {
    clearTimeout(this.suspension);
    this.cancelActivation?.();
    this.stopVoices(true);
    for (const voice of this.voices) voice.gain.disconnect();
    this.voices.length = 0;
    this.master?.disconnect(); this.music?.disconnect(); this.sfx?.disconnect();
    if (this.context) { this.context.onstatechange = null; void this.context.close().catch(() => undefined); }
    this.context = undefined; this.master = this.music = this.sfx = undefined;
    this.effects.clear(); this.notes.clear();
  }

  private fail(): void {
    this.release(); this.status = 'unavailable'; this.needsGesture = true;
  }

  private initialize(): void {
    const context = this.createContext();
    this.context = context;
    this.master = context.createGain(); this.music = context.createGain(); this.sfx = context.createGain();
    this.master.connect(context.destination); this.music.connect(this.master); this.sfx.connect(this.master);
    for (let index = 0; index < SFX_VOICES + MUSIC_VOICES; index++) {
      const gain = context.createGain(); gain.connect(index < SFX_VOICES ? this.sfx : this.music);
      const voice: Voice = { source: undefined, gain, ended: () => undefined };
      voice.ended = event => {
        if (event.target !== voice.source || !voice.source) return;
        voice.source.disconnect(); voice.source.onended = null; voice.source = undefined;
      };
      this.voices.push(voice);
    }
    context.onstatechange = () => {
      if (context.state === 'running') {
        if (this.needsGesture) { this.stopVoices(); void context.suspend().catch(() => undefined); }
        else this.status = 'ready';
      } else if (context.state === 'closed') { this.status = 'unavailable'; this.stopVoices(); }
      else {
        if (this.status !== 'unavailable') this.status = 'suspended';
        this.needsGesture = true; this.stopVoices(true);
      }
    };
    this.applyLevels();
  }

  private prepareEffects(): void {
    const context = this.context;
    if (!context) return;
    for (const sound of SFX) {
      const data = synthesize(sound, context.sampleRate, this.seed);
      const buffer = context.createBuffer(1, data.length, context.sampleRate);
      buffer.copyToChannel(data, 0); this.effects.set(sound, buffer);
    }
  }
  private prepare(): void {
    const context = this.context;
    if (!context) return;
    this.prepareEffects();
    for (let step = 0; step < MUSIC_STEPS; step++) {
      for (const note of [leadNote(step), bassNote(step)]) {
        if (note < 0 || this.notes.has(note)) continue;
        const data = synthesizeNote(note, context.sampleRate, note < 60);
        const buffer = context.createBuffer(1, data.length, context.sampleRate);
        buffer.copyToChannel(data, 0); this.notes.set(note, buffer);
      }
    }
  }
  private applyLevels(): void {
    const context = this.context;
    if (!context) return;
    for (const bus of ['master', 'music', 'sfx'] as const) {
      const node = this[bus];
      if (!node) continue;
      node.gain.cancelScheduledValues(context.currentTime);
      node.gain.setTargetAtTime(bus === 'master' && this.muted ? 0 : this.levels[bus], context.currentTime, 0.015);
    }
  }
  private readonly playSound = (sound: Sound): void => {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.playing || this.needsGesture || this.muted || this.levels.sfx === 0) return;
    this.startVoice(this.effects.get(sound), false, context.currentTime);
  };
  private startVoice(buffer: AudioBuffer | undefined, music: boolean, time: number): void {
    const context = this.context;
    if (!context || !buffer) return;
    const begin = music ? SFX_VOICES : 0; const end = music ? SFX_VOICES + MUSIC_VOICES : SFX_VOICES;
    try {
      for (let index = begin; index < end; index++) {
        const voice = this.voices[index];
        if (!voice || voice.source) continue;
        const source = context.createBufferSource(); source.buffer = buffer;
        voice.source = source; source.connect(voice.gain); source.onended = voice.ended;
        voice.gain.gain.cancelScheduledValues(context.currentTime);
        voice.gain.gain.setValueAtTime(0, time);
        voice.gain.gain.linearRampToValueAtTime(music ? 0.06 : 0.1, time + 0.006);
        voice.gain.gain.setTargetAtTime(0, time + buffer.duration * 0.7, 0.02);
        source.start(time); source.stop(time + buffer.duration);
        if (music) this.peakMusic = Math.max(this.peakMusic, this.activeMusic);
        else this.peakSfx = Math.max(this.peakSfx, this.activeSfx);
        return;
      }
      this.dropped++;
    } catch { this.fail(); }
  }
  private stopVoices(immediate = false): void {
    for (const voice of this.voices) {
      const source = voice.source;
      if (!source) continue;
      if (!immediate && this.context?.state === 'running') {
        const now = this.context.currentTime;
        const gain = voice.gain.gain;
        if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(now);
        else { gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now); }
        gain.linearRampToValueAtTime(0, now + 0.01);
        source.stop(now + 0.012);
      } else {
        source.onended = null;
        try { source.stop(); } catch { /* A failed start has no stoppable source. */ }
        source.disconnect(); voice.source = undefined;
      }
    }
  }
  private count(begin: number, end: number): number {
    let count = 0;
    for (let index = begin; index < end; index++) if (this.voices[index]?.source) count++;
    return count;
  }
}
