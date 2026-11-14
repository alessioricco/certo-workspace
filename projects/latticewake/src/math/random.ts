export const RULES_VERSION = 'm5-signature-1';

export function parseSeed(value: string | null): number | undefined {
  if (value === null) return undefined;
  if (!/^(?:[0-9]{1,10}|0x[0-9a-f]{1,8})$/i.test(value) || Number(value) > 0xffffffff) {
    throw new RangeError('Seed must be a decimal or hexadecimal uint32.');
  }
  return Number(value);
}

export class Xorshift32 {
  private state: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Invalid uint32 seed.');
    this.state = seed || 0x6d2b79f5;
  }

  nextUint32(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state;
  }
}
