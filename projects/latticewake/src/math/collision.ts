export function sweptCircleTime(
  fromX: number, fromY: number, toX: number, toY: number,
  targetFromX: number, targetFromY: number, targetToX: number, targetToY: number,
  radius: number,
): number {
  const x = fromX - targetFromX;
  const y = fromY - targetFromY;
  const dx = toX - targetToX - x;
  const dy = toY - targetToY - y;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return Infinity;
  const b = 2 * (x * dx + y * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return Infinity;
  const time = (-b - Math.sqrt(discriminant)) / (2 * a);
  return time >= 0 && time <= 1 ? time : Infinity;
}
