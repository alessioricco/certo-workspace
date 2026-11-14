import './styles/main.css';
import type { App } from './app';
import { PresentationUI } from './ui/presentation';
import { localize } from './ui/localize';
import { DiagnosticsUI } from './ui/diagnostics';
import { MetaUI } from './ui/meta';
import { Shell } from './ui/shell';
import { PwaUpdates } from './platform/pwa';

function bootstrap(): () => void {
  localize(document);
  const canvas = document.querySelector<HTMLCanvasElement>('#playfield');
  const host = document.querySelector<HTMLElement>('#stage');
  const status = document.querySelector<HTMLElement>('#status');
  const panel = document.querySelector<HTMLElement>('#startup-panel');
  const retry = document.querySelector<HTMLButtonElement>('#retry');
  const root = document.querySelector<HTMLElement>('#app');
  if (!canvas || !host || !status || !panel || !retry || !root) throw new Error('Incomplete application shell.');

  const shell = new Shell({ canvas, status, panel, retry });
  const pwa = new PwaUpdates(root);
  pwa.start();
  let app: App | undefined;
  let disposed = false;
  let loading = false;

  const start = async (): Promise<void> => {
    if (loading || disposed) return;
    loading = true;
    app?.dispose();
    app = undefined;
    shell.loading();
    try {
      const [{ App }, { TestbedUI }] = await Promise.all([import('./app'), import('./ui/testbed')]);
      if (disposed) return;
      const meta = new MetaUI(root);
      app = new App(canvas, host, new TestbedUI(root, canvas, scene => pwa.scene(scene)), new PresentationUI(root), meta, new DiagnosticsUI(root, meta.store));
      await app.start();
      if (!disposed) shell.ready();
    } catch {
      app?.dispose();
      app = undefined;
      if (!disposed) shell.error();
    } finally {
      loading = false;
    }
  };

  const retryStart = (): void => { void start(); };
  const dispose = (): void => {
    disposed = true;
    app?.dispose();
    app = undefined;
    pwa.dispose();
    retry.removeEventListener('click', retryStart);
    window.removeEventListener('pagehide', onPageHide);
  };
  const onPageHide = (event: PageTransitionEvent): void => {
    app?.suspend();
    if (!event.persisted) dispose();
  };
  retry.addEventListener('click', retryStart);
  window.addEventListener('pagehide', onPageHide);
  void start();
  return dispose;
}

const dispose = bootstrap();
if (import.meta.hot) import.meta.hot.dispose(dispose);
