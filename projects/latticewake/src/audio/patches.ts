import { Xorshift32 } from '../math/random';

export const AUDIO_SALT = 0x85ebca6b;
export const SFX = ['shot', 'hit', 'destroy', 'capture', 'open', 'pickup', 'damage', 'ward', 'phase', 'clear'] as const;
export type Sound = typeof SFX[number];
export const PATCH_SECONDS: Readonly<Record<Sound, number>> = {
  shot: 0.09, hit: 0.12, destroy: 0.28, capture: 0.42, open: 0.18,
  pickup: 0.3, damage: 0.48, ward: 0.25, phase: 0.5, clear: 0.65,
};

export function synthesize(sound: Sound, sampleRate: number, seed: number): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(Math.ceil(PATCH_SECONDS[sound] * sampleRate));
  const random = new Xorshift32((seed ^ AUDIO_SALT) >>> 0);
  let filtered = 0;
  for (let index = 0; index < samples.length; index++) {
    const t = index / sampleRate;
    const progress = index / samples.length;
    const envelope = Math.min(1, t / 0.006) * (1 - progress) ** 2;
    const noise = random.nextUint32() / 0x80000000 - 1;
    filtered += (noise - filtered) * 0.16;
    let wave: number;
    if (sound === 'hit' || sound === 'destroy' || sound === 'damage') {
      const frequency = sound === 'hit' ? 360 : sound === 'destroy' ? 145 : 74;
      wave = filtered * 0.75 + Math.sin(2 * Math.PI * frequency * t * (1 - progress * 0.4)) * 0.25;
    } else {
      const frequency = sound === 'shot' ? 980 : sound === 'open' ? 330 : sound === 'ward' ? 220 : sound === 'phase' ? 165 : 440;
      const rise = sound === 'shot' ? -0.3 : 0.6;
      const phase = 2 * Math.PI * frequency * (t + rise * t * progress / 2);
      const triangle = 2 / Math.PI * Math.asin(Math.sin(phase));
      wave = triangle * 0.5 + Math.sin(phase * 1.25) * 0.25 + Math.sin(phase * 1.5) * 0.25;
    }
    samples[index] = wave * envelope * 0.35;
  }
  return samples;
}

// Sixteen original 4/4 bars, eight eighth-note positions per bar; -1 is a rest.
const LEAD: readonly (readonly number[])[] = [
  [69, -1, 76, 73, -1, 71, 64, -1], [68, -1, 71, -1, 76, 73, -1, 64],
  [66, -1, 73, 69, -1, 76, 71, -1], [68, -1, 64, -1, 71, -1, 73, -1],
  [69, -1, 73, 76, -1, 78, 71, -1], [68, -1, 76, -1, 73, 71, -1, 64],
  [66, -1, 69, 73, -1, 71, 76, -1], [68, -1, 71, -1, 64, -1, -1, -1],
  [73, -1, 76, 69, -1, 71, 78, -1], [71, -1, 68, -1, 73, 76, -1, 64],
  [69, -1, 66, 73, -1, 78, 76, -1], [68, -1, 73, -1, 71, -1, 64, -1],
  [76, -1, 73, 69, -1, 78, 71, -1], [73, -1, 68, -1, 76, 71, -1, 64],
  [69, -1, 73, 66, -1, 76, 71, -1], [68, -1, 71, -1, 64, -1, -1, -1],
];
const BASS: readonly number[] = [45, 40, 42, 40, 45, 40, 42, 40, 42, 40, 45, 40, 45, 40, 42, 40];
export const EIGHTH_SECONDS = 60 / 110 / 2;
export const MUSIC_STEPS = 128;
export function leadNote(step: number): number { return LEAD[Math.floor(step % MUSIC_STEPS / 8)]?.[step % 8] ?? -1; }
export function bassNote(step: number): number { return step % 4 === 0 ? BASS[Math.floor(step % MUSIC_STEPS / 8)] ?? -1 : -1; }
export function synthesizeNote(note: number, sampleRate: number, bass = false): Float32Array<ArrayBuffer> {
  const seconds = bass ? 0.9 : 0.4;
  const samples = new Float32Array(Math.ceil(seconds * sampleRate));
  const frequency = 440 * 2 ** ((note - 69) / 12);
  for (let index = 0; index < samples.length; index++) {
    const t = index / sampleRate;
    const envelope = Math.min(1, t / 0.015) * (1 - t / seconds) ** 2;
    samples[index] = (Math.sin(t * frequency * 2 * Math.PI) + 0.2 * Math.sin(t * frequency * 4 * Math.PI)) * envelope * (bass ? 0.2 : 0.12);
  }
  return samples;
}
