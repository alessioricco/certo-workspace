import { t } from './strings';
export interface ShellElements {
  readonly canvas: HTMLCanvasElement;
  readonly status: HTMLElement;
  readonly panel: HTMLElement;
  readonly retry: HTMLButtonElement;
}

export class Shell {
  constructor(private readonly elements: ShellElements) {}

  loading(): void {
    this.elements.canvas.hidden = true;
    this.elements.panel.hidden = false;
    this.elements.retry.hidden = true;
    this.elements.status.textContent = t('canvas_loading');
  }

  ready(): void {
    this.elements.canvas.hidden = false;
    this.elements.panel.hidden = true;
  }

  error(): void {
    this.elements.canvas.hidden = true;
    this.elements.panel.hidden = false;
    this.elements.retry.hidden = false;
    this.elements.status.textContent = t('canvas_error');
    this.elements.retry.focus();
  }
}
