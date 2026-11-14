export const CRASH_LIMIT = 5;
const MESSAGE_LIMIT = 160;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export interface CrashRecord { at: string; scene: string; stage: number; rules: string; message: string }
export interface CrashContext { scene: string; stage: number; rules: string }

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

export function redactMessage(text: string): string {
  return text
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S*/gi, '[url]')
    .replace(/\b[A-Za-z]:\\(?:[^\\\s]+\\)*[^\\\s:]*/g, '[path]')
    .replace(/\/?(?:[\w.-]+\/)+[\w.-]*/g, '[path]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MESSAGE_LIMIT);
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return typeof error === 'string' ? error : 'Non-error value';
}

export function crashRecord(error: unknown, context: CrashContext, at: Date): CrashRecord {
  return { at: at.toISOString(), scene: context.scene, stage: context.stage, rules: context.rules, message: redactMessage(describeError(error)) };
}

export function appendCrash(records: readonly CrashRecord[], next: CrashRecord): CrashRecord[] {
  return [...records, next].slice(-CRASH_LIMIT);
}

export function validateCrash(value: unknown): CrashRecord | undefined {
  if (!record(value)) return;
  const { at, scene, stage, rules, message } = value;
  if (typeof at !== 'string' || !TIMESTAMP.test(at) || typeof scene !== 'string' || !/^[a-z]{3,8}$/.test(scene)
    || typeof stage !== 'number' || !Number.isSafeInteger(stage) || stage < 0 || stage > 999999
    || typeof rules !== 'string' || !/^[a-zA-Z0-9._-]{1,40}$/.test(rules) || typeof message !== 'string') return;
  return { at, scene, stage, rules, message: redactMessage(message) };
}

export function formatCrashReport(records: readonly CrashRecord[]): string {
  return JSON.stringify({ application: 'latticewake', crashes: records }, null, 2);
}
