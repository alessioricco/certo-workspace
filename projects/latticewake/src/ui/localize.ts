import { isStringKey, t } from './strings';
export function localize(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n], [data-i18n-aria]')) {
    for (const [attribute, target] of [['data-i18n', 'text'], ['data-i18n-aria', 'aria-label']] as const) {
      const key = element.getAttribute(attribute);
      if (!key) continue;
      if (!isStringKey(key)) throw new Error(`Unknown string key: ${key}`);
      if (target === 'text') element.textContent = t(key);
      else element.setAttribute(target, t(key));
    }
  }
}
