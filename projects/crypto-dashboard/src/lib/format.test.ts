import { describe, expect, it } from 'vitest';
import { changeClass, formatChange, formatCompact, formatPrice, formatTime, isFresh } from './format';

describe('market number formatting', () => {
  it('formats USDT prices with grouping and useful small-coin precision', () => {
    expect(formatPrice(76170.01)).toBe('76,170.01');
    expect(formatPrice(0.35291)).toBe('0.3529');
    expect(formatPrice(0.00000123)).toBe('0.00000123');
    expect(formatPrice(0)).toBe('0.0000');
  });
  it('never displays missing data as a zero price', () => {
    for (const value of [undefined, NaN, Infinity]) {
      expect(formatPrice(value)).toBe('—');
      expect(formatChange(value)).toBe('—');
      expect(formatCompact(value)).toBe('—');
    }
  });
  it('uses explicit signs for percentage gains and losses', () => {
    expect(formatChange(1.234)).toBe('+1.23%');
    expect(formatChange(-2.5)).toBe('-2.50%');
    expect(formatChange(0)).toBe('0.00%');
    expect(changeClass(0)).toBe('text-muted');
    expect(changeClass(-1)).toBe('text-negative');
    expect(changeClass(1)).toBe('text-positive');
  });
  it('abbreviates volume and uses UTC instead of the browser timezone', () => {
    expect(formatCompact(1_250_000_000)).toBe('1.25B');
    expect(formatTime(Date.UTC(2026, 10, 7, 8, 42, 3))).toBe('08:42:03');
    expect(formatTime()).toBe('—');
  });
  it('marks old or implausibly future-dated data as stale', () => {
    const now = 1_794_041_344_010;
    expect(isFresh(now - 59_999, now)).toBe(true);
    expect(isFresh(now - 60_001, now)).toBe(false);
    expect(isFresh(now + 6000, now)).toBe(false);
    expect(isFresh(undefined, now)).toBe(false);
    expect(isFresh(now - 16_000, now, 15_000)).toBe(false);
  });
});
