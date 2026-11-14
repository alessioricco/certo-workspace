import { t } from '../ui/strings';
import type { Scene } from '../engine/state';

export class PwaUpdates {
  private registration: ServiceWorkerRegistration | undefined;
  private sceneName: Scene = 'boot';
  private updating = false;
  private readonly button: HTMLButtonElement;
  private readonly status: HTMLElement;

  constructor(host: HTMLElement) {
    const button = host.querySelector<HTMLButtonElement>('#pwa-update');
    const status = host.querySelector<HTMLElement>('#pwa-status');
    if (!button || !status) throw new Error('Missing PWA update controls.');
    this.button = button;
    this.status = status;
  }

  start(): void {
    if (import.meta.env.DEV || !window.isSecureContext || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('controllerchange', this.onControllerChange);
    this.button.addEventListener('click', this.applyUpdate);
    this.status.textContent = t('pwa_installing');
    void this.register();
  }

  scene(scene: Scene): void {
    this.sceneName = scene;
    this.render();
  }

  dispose(): void {
    navigator.serviceWorker?.removeEventListener('controllerchange', this.onControllerChange);
    this.button.removeEventListener('click', this.applyUpdate);
    this.registration?.removeEventListener('updatefound', this.onUpdateFound);
  }

  private async register(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.register(new URL('./service-worker.js', document.baseURI), {
        scope: new URL('./', document.baseURI).pathname,
        updateViaCache: 'none',
      });
      this.registration = registration;
      registration.addEventListener('updatefound', this.onUpdateFound);
      if (registration.waiting) this.showUpdate();
      else if (registration.active) this.status.textContent = t('pwa_offline_ready');
      else this.status.textContent = t('pwa_installing');
      registration.installing?.addEventListener('statechange', this.onWorkerState);
      await registration.update();
      if (registration.waiting) this.showUpdate();
    } catch {
      this.status.textContent = t('pwa_unavailable');
    }
  }

  private readonly onUpdateFound = (): void => {
    this.registration?.installing?.addEventListener('statechange', this.onWorkerState);
  };

  private readonly onWorkerState = (): void => {
    if (this.registration?.waiting) this.showUpdate();
    else if (this.registration?.active) this.status.textContent = t('pwa_offline_ready');
  };

  private readonly onControllerChange = (): void => {
    if (this.updating) window.location.reload();
  };

  private readonly applyUpdate = (): void => {
    const waiting = this.registration?.waiting;
    if (!waiting || this.sceneName !== 'menu') return;
    this.updating = true;
    this.button.disabled = true;
    this.status.textContent = t('pwa_updating');
    waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  };

  private showUpdate(): void {
    this.status.textContent = t('pwa_update_available');
    this.render();
  }

  private render(): void {
    this.button.hidden = this.sceneName !== 'menu' || !this.registration?.waiting;
  }
}
