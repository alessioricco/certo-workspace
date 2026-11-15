import { mixSeed, mulberry32 } from './engine/random';

const NOISE_SECONDS = 2;
const WIND_GUST_HZ = 0.07;
const WIND_GUST_DEPTH = 0.3;
const NOISE_SALT = 0x3c6ef372;

interface Output {
  context: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
}

interface Tone {
  type: OscillatorType;
  fromHz: number;
  toHz: number;
  seconds: number;
  peak: number;
}

interface Burst {
  filter: BiquadFilterType;
  cutoffHz: number;
  seconds: number;
  peak: number;
}

/**
 * The sound of the world, through Web Audio. The wind is a loop of filtered noise whose
 * level and cutoff come from the atmosphere; footsteps, calls, the scanner and the
 * sampler are short sounds. The audio context is created on first use.
 */
export class WorldSound {
  private output?: Output;
  private muted = false;
  private readonly random: () => number;

  constructor(
    private readonly seed: number,
    private readonly windLevel: number,
    private readonly windCutoffHz: number,
    private volume: number,
  ) {
    this.random = mulberry32(mixSeed(seed, NOISE_SALT));
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.applyVolume();
  }

  /** Mutes or unmutes everything; returns whether the sound is now muted. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyVolume();
    return this.muted;
  }

  /** Starts the wind and the audio context; called once the player is exploring, after a click. */
  start(): void {
    void this.open().context.resume();
  }

  pause(): void {
    void this.output?.context.suspend();
  }

  resume(): void {
    void this.output?.context.resume();
  }

  footstep(loudness: number): void {
    this.burst({ filter: 'lowpass', cutoffHz: 420, seconds: 0.09, peak: 0.5 * loudness });
  }

  samplerShot(): void {
    this.burst({ filter: 'highpass', cutoffHz: 1800, seconds: 0.12, peak: 0.35 });
  }

  /** An animal's call, rising and falling around its pitch, at a level from 0 to 1. */
  call(pitchHz: number, level: number): void {
    this.tone({ type: 'triangle', fromHz: pitchHz, toHz: pitchHz * 0.8, seconds: 0.7, peak: 0.12 * level });
  }

  /** The low, falling call a predator makes when it warns an intruder. */
  warningCall(): void {
    this.tone({ type: 'sawtooth', fromHz: 220, toHz: 110, seconds: 0.8, peak: 0.15 });
  }

  /** A short rising chirp, when the scanner identifies a species. */
  scanChirp(): void {
    this.tone({ type: 'sine', fromHz: 900, toHz: 1400, seconds: 0.15, peak: 0.08 });
  }

  private open(): Output {
    if (this.output) return this.output;
    const context = new AudioContext();
    const master = context.createGain();
    master.connect(context.destination);
    const noise = noiseBuffer(context, mulberry32(this.seed));
    this.output = { context, master, noise };
    this.applyVolume();
    this.startWind(this.output);
    return this.output;
  }

  private applyVolume(): void {
    if (this.output) this.output.master.gain.value = this.muted ? 0 : this.volume;
  }

  private startWind({ context, master, noise }: Output): void {
    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.windCutoffHz;
    const level = context.createGain();
    level.gain.value = this.windLevel;
    const gust = context.createOscillator();
    gust.frequency.value = WIND_GUST_HZ;
    const gustDepth = context.createGain();
    gustDepth.gain.value = this.windLevel * WIND_GUST_DEPTH;
    gust.connect(gustDepth).connect(level.gain);
    source.connect(filter).connect(level).connect(master);
    source.start();
    gust.start();
  }

  private burst({ filter, cutoffHz, seconds, peak }: Burst): void {
    const { context, master, noise } = this.open();
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noise;
    const shape = context.createBiquadFilter();
    shape.type = filter;
    shape.frequency.value = cutoffHz;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(peak, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    source.connect(shape).connect(envelope).connect(master);
    source.start(now, this.random() * (NOISE_SECONDS - seconds));
    source.stop(now + seconds);
  }

  private tone({ type, fromHz, toHz, seconds, peak }: Tone): void {
    const { context, master } = this.open();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(fromHz, now);
    oscillator.frequency.linearRampToValueAtTime(toHz, now + seconds);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    oscillator.connect(gain).connect(master);
    oscillator.start(now);
    oscillator.stop(now + seconds);
  }
}

function noiseBuffer(context: AudioContext, random: () => number): AudioBuffer {
  const length = Math.round(context.sampleRate * NOISE_SECONDS);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) samples[i] = random() * 2 - 1;
  return buffer;
}
