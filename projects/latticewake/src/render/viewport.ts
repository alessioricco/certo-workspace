export const LOGICAL_WIDTH = 360;
export const LOGICAL_HEIGHT = 640;
export const MAX_DPR = 2;

export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly dpr: number;
}

export function calculateViewport(width: number, height: number, devicePixelRatio: number): Viewport {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(devicePixelRatio)
    || width <= 0 || height <= 0 || devicePixelRatio <= 0) {
    throw new RangeError('Viewport dimensions and pixel ratio must be finite and positive.');
  }

  const scale = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);
  const fittedWidth = Math.min(width, LOGICAL_WIDTH * scale);
  const fittedHeight = Math.min(height, LOGICAL_HEIGHT * scale);
  const dpr = Math.min(MAX_DPR, Math.max(1, devicePixelRatio));
  return {
    width: fittedWidth,
    height: fittedHeight,
    pixelWidth: Math.max(1, Math.round(fittedWidth * dpr)),
    pixelHeight: Math.max(1, Math.round(fittedHeight * dpr)),
    dpr,
  };
}
