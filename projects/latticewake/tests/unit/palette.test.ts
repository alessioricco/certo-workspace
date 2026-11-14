import { expect, it } from 'vitest';
import { recolorPixel } from '../../src/render/palette';

function mapped(hex: number, palette: 'color-safe' | 'contrast', alpha = 255): number[] {
  const pixels = Uint8ClampedArray.of(hex >> 16 & 255, hex >> 8 & 255, hex & 255, alpha);
  recolorPixel(pixels, 0, palette);
  return [...pixels];
}

it('keeps the dark navy field, grid and dim frame tones unchanged in color-safe mode', () => {
  expect(mapped(0x09131f, 'color-safe')).toEqual([9, 19, 31, 255]);
  expect(mapped(0x172c3b, 'color-safe')).toEqual([23, 44, 59, 255]);
  expect(mapped(0x243d50, 'color-safe')).toEqual([36, 61, 80, 255]);
});

it('maps lit allies, hostile amber and capture accents to distinct color-safe families', () => {
  expect(mapped(0x8ce6da, 'color-safe')).toEqual([86, 180, 233, 255]);
  expect(mapped(0xffd49b, 'color-safe')).toEqual([230, 159, 0, 255]);
  expect(mapped(0xf4b9ef, 'color-safe')).toEqual([204, 121, 167, 255]);
});

it('leaves ivory player tones untouched and preserves alpha in color-safe mode', () => {
  expect(mapped(0xf1faf6, 'color-safe')).toEqual([241, 250, 246, 255]);
  expect(mapped(0x8ce6da, 'color-safe', 80)).toEqual([86, 180, 233, 80]);
});

it('maps every pixel to black or white in high-contrast mode', () => {
  expect(mapped(0x09131f, 'contrast')).toEqual([0, 0, 0, 255]);
  expect(mapped(0x537d88, 'contrast')).toEqual([255, 255, 255, 255]);
});
