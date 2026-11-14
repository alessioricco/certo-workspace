export type Palette = 'default' | 'color-safe' | 'contrast';
type RecoloredPalette = Exclude<Palette, 'default'>;

// Dark field, grid and dim frame tones keep their navy values; only lit sprites are remapped.
const FIELD_FLOOR = 96;

export function recolorPixel(pixels: Uint8ClampedArray, index: number, palette: RecoloredPalette): void {
  const r = pixels[index] ?? 0, g = pixels[index + 1] ?? 0, b = pixels[index + 2] ?? 0;
  if (palette === 'contrast') {
    const light = Math.max(r, g, b) >= 110 ? 255 : 0;
    pixels[index] = pixels[index + 1] = pixels[index + 2] = light;
    return;
  }
  if (Math.max(r, g, b) < FIELD_FLOOR) return;
  if (r > b * 1.25 && r > g * 1.05) {
    pixels[index] = 230; pixels[index + 1] = 159; pixels[index + 2] = 0;
  } else if (g > r * 1.25 && b > r * 1.25) {
    pixels[index] = 86; pixels[index + 1] = 180; pixels[index + 2] = 233;
  } else if (r > g * 1.05 && b > g * 1.25) {
    pixels[index] = 204; pixels[index + 1] = 121; pixels[index + 2] = 167;
  }
}

export function recolor(surface: HTMLCanvasElement, palette: Palette): void {
  if (palette === 'default') return;
  const context = surface.getContext('2d');
  if (!context) throw new Error('Palette context unavailable');
  const image = context.getImageData(0, 0, surface.width, surface.height);
  for (let index = 0; index < image.data.length; index += 4) recolorPixel(image.data, index, palette);
  context.putImageData(image, 0, 0);
}
