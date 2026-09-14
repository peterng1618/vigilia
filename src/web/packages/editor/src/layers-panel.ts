import type { NodeType } from '@vigilia/renderer-core';
import { actionById, shortcutLabel, type ActionId } from './actions.js';
import { createButton, scrollAreaStyle, sectionHeadingStyle } from './button.js';
import type { LayerRow } from './layers-model.js';
import type { SelectionMode } from './selection/domain/selection-state.js';

/** What the author did in the layer panel. */
export type LayerPanelAction =
  | { readonly kind: 'select'; readonly id: string; readonly mode: SelectionMode }
  | { readonly kind: 'enter'; readonly id: string }
  | {
      readonly kind: 'action';
      readonly id: Extract<ActionId, 'layer.toggle-visibility' | 'layer.toggle-lock'>;
      readonly targetId: string;
    };

export interface LayersPanel {
  readonly root: HTMLElement;
  render(rows: readonly LayerRow[]): void;
  dispose(): void;
}

export interface LayersPanelCallbacks {
  readonly onAction: (action: LayerPanelAction) => void;
}

/**
 * Renders layer rows and emits intent. Document edits and selection transitions
 * remain in `main.ts`; this DOM layer decides nothing (spec 0012).
 */
export function createLayersPanel(
  host: HTMLElement,
  callbacks: LayersPanelCallbacks,
): LayersPanel {
  const root = document.createElement('section');
  root.dataset['vigiliaLayers'] = 'root';
  root.setAttribute('aria-label', 'Layers');
  root.style.cssText = [
    'height:240px',
    'min-height:120px',
    'display:flex',
    'flex-direction:column',
    'flex:none',
    'border-top:1px solid var(--vigilia-panel-border)',
    'background:var(--vigilia-panel-bg)',
    'font:12px/1.4 system-ui,sans-serif',
    'color:var(--vigilia-text)',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:8px',
    'padding:12px 8px 12px 14px',
    'border-bottom:1px solid var(--vigilia-panel-border)',
    'flex:none',
  ].join(';');

  const heading = document.createElement('h2');
  heading.textContent = 'Layers';
  heading.style.cssText = `${sectionHeadingStyle('0')};flex:1`;

  const forward = actionById('layer.reorder-forward')!;
  const backward = actionById('layer.reorder-backward')!;
  const shortcut = document.createElement('span');
  shortcut.textContent = `${shortcutLabel(backward.shortcut)}  ${shortcutLabel(forward.shortcut)}`;
  shortcut.title = `${backward.label} / ${forward.label}; add Shift for back / front`;
  shortcut.style.cssText = 'color:var(--vigilia-subdued);font:10px/1 ui-monospace,monospace';

  header.append(heading, shortcut);

  const list = document.createElement('div');
  list.dataset['vigiliaLayers'] = 'list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Document layers');
  list.setAttribute('aria-multiselectable', 'true');
  list.style.cssText = `${scrollAreaStyle()};flex:1;padding:8px 0 20px`;

  root.append(header, list);
  host.append(root);

  return {
    root,

    render(rows: readonly LayerRow[]): void {
      list.textContent = '';

      if (rows.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'No layers.';
        empty.style.cssText = 'color:var(--vigilia-muted);margin:8px 14px';
        list.append(empty);
        return;
      }

      for (const row of rows) {
        list.append(renderRow(row, callbacks));
      }
    },

    dispose(): void {
      root.remove();
    },
  };
}

function renderRow(row: LayerRow, callbacks: LayersPanelCallbacks): HTMLElement {
  const element = document.createElement('div');
  element.dataset['vigiliaLayer'] = row.id;
  element.setAttribute('role', 'option');
  element.setAttribute('aria-selected', String(row.selected));
  element.tabIndex = 0;
  element.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:8px',
    'height:32px',
    'min-width:0',
    `padding:0 8px 0 ${14 + row.depth * 14}px`,
    `background:${row.selected ? 'var(--vigilia-selection-bg)' : 'transparent'}`,
    `color:${row.visible ? 'var(--vigilia-text)' : 'var(--vigilia-subdued)'}`,
    'cursor:pointer',
    'outline:none',
  ].join(';');

  const icon = document.createElement('span');
  icon.textContent = row.isGroup ? '▾' : typeGlyph(row.type);
  icon.setAttribute('aria-hidden', 'true');
  icon.style.cssText = 'width:12px;flex:none;text-align:center;color:var(--vigilia-muted)';

  const name = document.createElement('span');
  name.textContent = row.name;
  name.title = `${row.name} (${row.type})`;
  name.style.cssText = [
    'flex:1',
    'min-width:0',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap',
  ].join(';');

  const visibilityAction = actionById('layer.toggle-visibility')!;
  const visibility = createButton({
    text: row.selfHidden ? '○' : '◉',
    title: `${visibilityAction.label}: ${row.name}${row.ancestorHidden ? ' (hidden by group)' : ''}`,
    dataset: { vigiliaLayerVisibility: row.id, vigiliaAction: visibilityAction.id },
    padding: '0',
    flex: '0 0 20px',
    onClick: () => callbacks.onAction({
      kind: 'action',
      id: 'layer.toggle-visibility',
      targetId: row.id,
    }),
  });
  visibility.setAttribute('aria-label', `${visibilityAction.label} for ${row.name}`);
  visibility.setAttribute('aria-pressed', String(!row.selfHidden));
  visibility.style.background = 'none';
  visibility.style.borderColor = 'transparent';

  const lockAction = actionById('layer.toggle-lock')!;
  const lock = createButton({
    text: row.selfLocked ? '◆' : '◇',
    title: `${lockAction.label}: ${row.name}${row.locked && !row.selfLocked ? ' (locked by group)' : ''}`,
    dataset: { vigiliaLayerLock: row.id, vigiliaAction: lockAction.id },
    padding: '0',
    flex: '0 0 20px',
    onClick: () => callbacks.onAction({
      kind: 'action',
      id: 'layer.toggle-lock',
      targetId: row.id,
    }),
  });
  lock.setAttribute('aria-label', `${lockAction.label} for ${row.name}`);
  lock.setAttribute('aria-pressed', String(row.selfLocked));
  lock.style.background = 'none';
  lock.style.borderColor = 'transparent';

  // Do not let a flag button also select the row. Both operations remain
  // separately reachable and separately undoable.
  visibility.addEventListener('click', (event) => event.stopPropagation());
  lock.addEventListener('click', (event) => event.stopPropagation());

  element.addEventListener('click', (event) => {
    callbacks.onAction({ kind: 'select', id: row.id, mode: selectionMode(event) });
  });

  element.addEventListener('dblclick', () => {
    if (row.isGroup) {
      callbacks.onAction({ kind: 'enter', id: row.id });
    }
  });

  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    callbacks.onAction({ kind: 'select', id: row.id, mode: selectionMode(event) });
  });

  element.append(icon, name, visibility, lock);
  return element;
}

function selectionMode(event: MouseEvent | KeyboardEvent): SelectionMode {
  if (event.ctrlKey || event.metaKey) {
    return 'toggle';
  }

  return event.shiftKey ? 'add' : 'replace';
}

const TYPE_GLYPHS: Readonly<Record<NodeType, string>> = {
  rectangle: '□',
  ellipse: '○',
  line: '╱',
  text: 'T',
  chart: '▥',
  image: '▧',
  video: '▷',
  group: '▾',
};

function typeGlyph(type: NodeType): string {
  return TYPE_GLYPHS[type];
}
