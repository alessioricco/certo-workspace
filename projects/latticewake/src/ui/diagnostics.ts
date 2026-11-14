import { crashRecord, formatCrashReport } from '../platform/diagnostics';
import type { CrashContext } from '../platform/diagnostics';
import type { LocalMeta } from '../platform/storage';
import { t } from './strings';

const DOWNLOAD_NAME = 'latticewake-diagnostics.json';

export class DiagnosticsUI {
  constructor(private readonly host: HTMLElement, private readonly store: LocalMeta) {}

  start(): void {
    this.host.addEventListener('click', this.click);
    this.render();
  }

  record(error: unknown, context: CrashContext): void {
    this.store.addCrash(crashRecord(error, context, new Date()));
    this.render();
  }

  dispose(): void { this.host.removeEventListener('click', this.click); }

  private get<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.host.querySelector<T>(selector); if (!element) throw new Error(`Missing diagnostics UI: ${selector}`); return element;
  }

  private render(): void {
    const crashes = this.store.data.crashes;
    this.get<HTMLTextAreaElement>('#crash-report').value = crashes.length > 0 ? formatCrashReport(crashes) : '';
    this.get('#crash-count').textContent = t('crash_count', { count: crashes.length });
    this.get<HTMLButtonElement>('#crash-download').disabled = crashes.length === 0;
    this.get<HTMLButtonElement>('#crash-clear').disabled = crashes.length === 0;
  }

  private download(): void {
    const url = URL.createObjectURL(new Blob([formatCrashReport(this.store.data.crashes)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = DOWNLOAD_NAME; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private readonly click = (event: Event): void => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('#crash-clear')) { this.store.clearCrashes(); this.render(); }
    else if (event.target.closest('#crash-download')) this.download();
  };
}
