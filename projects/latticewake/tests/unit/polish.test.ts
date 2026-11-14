import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AudioDispatch, eventSound } from '../../src/audio/dispatch';
import { GameAudio } from '../../src/audio/audio';
import { bassNote, EIGHTH_SECONDS, leadNote, MUSIC_STEPS, PATCH_SECONDS, SFX, synthesize, synthesizeNote } from '../../src/audio/patches';
import type { Sound } from '../../src/audio/patches';
import { HitEvents, EVENT_CAPACITY } from '../../src/game/events';
import { RunSession } from '../../src/game/run';
import { Feedback } from '../../src/render/feedback';

const IDLE = { moveX: 0, fire: false, capture: false };

describe('original PCM and score', () => {
  it.each(SFX)('bakes bounded click-safe deterministic %s samples', sound => {
    const samples = synthesize(sound, 24000, 42);
    expect(samples.length).toBe(Math.ceil(PATCH_SECONDS[sound] * 24000));
    expect(samples).toEqual(synthesize(sound, 24000, 42));
    expect(Math.abs(samples[0] ?? 1)).toBe(0);
    expect(Math.abs(samples[samples.length - 1] ?? 1)).toBeLessThan(0.00001);
    let energy = 0;
    for (const sample of samples) { expect(Number.isFinite(sample)).toBe(true); expect(Math.abs(sample)).toBeLessThanOrEqual(0.35); energy += sample * sample; }
    expect(energy).toBeGreaterThan(0.01);
    if (sound === 'hit' || sound === 'destroy' || sound === 'damage') expect(samples).not.toEqual(synthesize(sound, 24000, 43));
  });
  it('loops sixteen original bars at 110 BPM with bounded lead/bass samples', () => {
    expect(MUSIC_STEPS).toBe(16 * 8); expect(EIGHTH_SECONDS).toBe(60 / 110 / 2);
    let notes = 0;
    for (let step = 0; step < MUSIC_STEPS; step++) {
      expect(leadNote(step)).toBe(leadNote(step + MUSIC_STEPS));
      expect(bassNote(step)).toBe(bassNote(step + MUSIC_STEPS));
      if (leadNote(step) >= 0) notes++;
      expect(step % 4 === 0 || bassNote(step) === -1).toBe(true);
    }
    expect(notes).toBeGreaterThan(50);
    for (const bass of [false, true]) {
      const samples = synthesizeNote(bass ? 40 : 73, 24000, bass);
      expect(samples.length).toBe(bass ? 21600 : 9600);
      expect(Math.abs(samples[0] ?? 1)).toBe(0);
      expect(Math.max(...samples)).toBeLessThan(0.25);
      expect(Math.max(...samples)).toBeGreaterThan(0.01);
    }
  });
});

describe('presentation event isolation', () => {
  it('dispatches each kind, deduplicates tick/entity/kind, rejects stale ticks and resets between runs', () => {
    const events = new HitEvents(); const dispatch = new AudioDispatch(); const played: Sound[] = [];
    const play = (sound: Sound): void => { played.push(sound); };
    for (const kind of [...SFX, 'boss-hit'] as const) events.push(kind, 7, 3, 0, 0);
    dispatch.consume(events, play); dispatch.consume(events, play);
    expect(played).toEqual([...SFX, 'hit']); expect(eventSound('boss-hit')).toBe('hit');
    events.begin(); events.push('hit', 6, 8, 0, 0); dispatch.consume(events, play);
    expect(played).toHaveLength(11);
    events.begin(); events.push('hit', 7, 4, 0, 0); dispatch.consume(events, play);
    expect(played).toHaveLength(12);
    dispatch.reset(); events.begin(); events.push('shot', 1, 1, 0, 0); dispatch.consume(events, play);
    expect(played.at(-1)).toBe('shot');
    for (let tick = 2; tick < 220; tick++) { events.begin(); events.push('shot', tick, tick, 0, 0); dispatch.consume(events, play); }
    expect(played).toHaveLength(231);
  });
  it('retains bounded storage and ignores overflow without changing gameplay', () => {
    const events = new HitEvents(); const slots = events.slots; const feedback = new Feedback(); const marks = feedback.marks;
    for (let index = 0; index < EVENT_CAPACITY + 5; index++) events.push('damage', 10, index, 180, 580);
    feedback.consume(events); expect(events.count).toBe(EVENT_CAPACITY); expect(events.dropped).toBe(5);
    expect(feedback.marks).toHaveLength(32); expect(feedback.shake(10, false)).toBe(2);
    expect(feedback.shake(10, true)).toBe(0); feedback.settings.low = true; expect(feedback.shake(10, false)).toBe(0);
    feedback.settings.low = false; feedback.settings.shake = false; expect(feedback.shake(10, false)).toBe(0);
    feedback.settings.shake = true; expect(feedback.shake(22, false)).toBe(0);
    feedback.reset(); events.reset(); expect(feedback.shakeUntil).toBe(0);
    expect(feedback.marks.every(mark => mark.until === 0)).toBe(true);
    expect(feedback.marks).toBe(marks); expect(events.slots).toBe(slots);
  });
  it('emits real shot, field, capture, ward, damage, pickup and boss events only on accepted actions', () => {
    const run = new RunSession(); run.reset(42);
    run.step({ ...IDLE, fire: true, capture: true });
    expect(run.events.slots.slice(0, run.events.count).map(event => event.kind)).toEqual(['open', 'shot']);
    run.hostiles.spawn(180, 550, 0, 0, 1, 128, true); run.step(IDLE);
    expect(run.events.slots[0]?.kind).toBe('capture');
    run.powers.collect('ward'); run.hostiles.spawn(180, 580, 0, 0, 1); run.step(IDLE);
    expect(run.events.slots[0]?.kind).toBe('ward');
    run.drops.spawn('fan', 180, 580); run.step(IDLE);
    expect(run.events.slots[0]?.kind).toBe('pickup');
    run.hostiles.spawn(180, 580, 0, 0, 1); run.step(IDLE);
    expect(run.events.slots[0]?.kind).toBe('damage'); run.step(IDLE); expect(run.events.count).toBe(0);
    run.reset(42); run.stage = 4; run.tally = 1; run.step(IDLE);
    expect(run.events.slots[0]).toMatchObject({ kind: 'phase', tick: 1, id: 5 });
    for (let tick = 0; tick < 60; tick++) run.step(IDLE);
    const part = run.boss.parts[0]; if (!part) throw new Error('Missing emitter');
    run.range.bullets.spawnVolley(part.x, part.y + 1, [0]); run.step(IDLE);
    expect(run.events.slots[0]).toMatchObject({ kind: 'boss-hit', id: 0 });
    expect(run.events.slots[0]?.tick).toBe(run.range.ticks);
  });
  it('keeps full rule checksums identical with effects off/on, dropped feedback, and enabled dispatch', () => {
    function replay(effects: boolean): string {
      const run = new RunSession(); run.reset(42); const feedback = new Feedback(); const dispatch = new AudioDispatch();
      const noSound = (): void => {};
      for (let tick = 0; tick < 3600; tick++) {
        run.step({ moveX: tick % 160 < 80 ? 1 : -1, fire: true, capture: tick % 240 === 0 });
        if (effects) {
          feedback.settings.low = tick % 2 === 0; feedback.settings.glow = tick % 3 === 0;
          feedback.settings.scanlines = tick % 4 === 0; feedback.consume(run.events); dispatch.consume(run.events, noSound);
          for (let index = 0; index < 200; index++) run.events.push('damage', run.range.ticks, index, 0, 0);
          feedback.shake(run.range.ticks, tick % 5 === 0);
        }
      }
      return createHash('sha256').update(JSON.stringify({ ticks: run.range.ticks, stage: run.stage, stageTick: run.stageTick,
        vitals: run.vitals, tally: run.tally, echo: run.echo, powers: run.powers, drops: run.drops,
        boss: run.boss, bullets: run.range.bullets, hostiles: run.hostiles, enemies: run.formation.enemies })).digest('hex');
    }
    expect(replay(true)).toBe(replay(false));
  });
  it('does not create an AudioContext before explicit activation and handles a missing native API silently', async () => {
    // Node has no AudioContext; this factory exercises the real feature-denial boundary.
    let calls = 0; const audio = new GameAudio(() => { calls++; throw new Error('Unsupported API'); });
    audio.reset(42); audio.setLevel('sfx', Number.NaN); audio.setLevel('music', -1); audio.setLevel('master', 2);
    audio.setMuted(true); audio.setPlaying(true); audio.frame(); audio.consume(new HitEvents()); audio.suspend();
    expect(calls).toBe(0); await audio.enable(); expect(audio.status).toBe('unavailable'); expect(calls).toBe(1);
    await audio.enable(); expect(calls).toBe(2); audio.dispose(); await audio.enable(); expect(calls).toBe(2);
    expect(audio.nodes).toBe(0); expect(audio.buffers).toBe(0);
  });
});
