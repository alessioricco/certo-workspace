import { element } from './dom';
import type { ObjectiveStatus } from './engine/objectives';

/** The world's objectives, and any asset notes, on screen during play. */
export class ObjectivesHud {
  readonly element = element('section', undefined, 'objectives');

  update(statuses: readonly ObjectiveStatus[], notes: readonly string[]): void {
    const children: HTMLElement[] = [element('h2', 'Objectives')];
    if (statuses.length === 0) {
      children.push(element('p', 'This world has no objectives.'));
    } else {
      const list = element('ul');
      for (const status of statuses) {
        list.append(element('li', `${status.done ? '✓' : '○'} ${status.label}`, status.done ? 'done' : undefined));
      }
      children.push(list);
    }
    if (notes.length > 0) {
      const list = element('ul', undefined, 'notes');
      for (const note of notes) list.append(element('li', note));
      children.push(list);
    }
    this.element.replaceChildren(...children);
  }
}
