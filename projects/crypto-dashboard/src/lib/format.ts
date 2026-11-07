export const DASH = '—';
export function formatPrice(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return DASH;
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: value >= 1 ? 2 : 4, maximumFractionDigits: value >= 1 ? 2 : value >= 0.01 ? 4 : 8 }).format(value);
}
export function formatCompact(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return DASH;
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}
export function formatChange(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return DASH;
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}
export function formatTime(value?: number): string {
  if (!value || !Number.isFinite(value)) return DASH;
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(value);
}
export function isFresh(time: number | undefined, now: number, maxAge = 60_000): boolean {
  return time !== undefined && now - time <= maxAge && time <= now + 5000;
}
export function changeClass(value?: number): string {
  return value === undefined || value === 0 ? 'text-muted' : value > 0 ? 'text-positive' : 'text-negative';
}
