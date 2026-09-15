import { GLOBAL_GROUPS, type GlobalGroupName } from '@vigilia/renderer-core';
import { buttonStyle, inputStyle, scrollAreaStyle, sectionHeadingStyle } from './button.js';
import type { GlobalUsage } from './globals/commands.js';
import type { GlobalAction } from './globals/domain/global-action.js';
import { GLOBAL_GROUP_META } from './globals/domain/groups.js';

/** Document-level token UI. Renders usage and emits actions; pure commands own rules. */

export interface GlobalsPanel {
  readonly root: HTMLElement;
  render(usage: readonly GlobalUsage[]): void;
  dispose(): void;
}

export interface GlobalsCallbacks {
  readonly onAction: (action: GlobalAction) => void;
}

export function createGlobalsPanel(
  host: HTMLElement,
  callbacks: GlobalsCallbacks,
): GlobalsPanel {
  const root = document.createElement('div');
  root.dataset['vigiliaGlobals'] = 'root';
  root.style.cssText = [
    'flex:1',
    scrollAreaStyle(),
    'padding:10px 6px 36px 14px',
    'font:12px/1.5 system-ui,sans-serif',
    'color:var(--vigilia-text)',
  ].join(';');

  host.append(root);

  return {
    root,

    render(usage: readonly GlobalUsage[]): void {
      root.textContent = '';

      for (const group of GLOBAL_GROUPS) {
        // Show empty groups so authors can discover/create their token types.
        root.append(
          renderGroup(
            group,
            usage.filter((entry) => entry.group === group),
            callbacks,
          ),
        );
      }
    },

    dispose(): void {
      root.remove();
    },
  };
}

function renderGroup(
  group: GlobalGroupName,
  entries: readonly GlobalUsage[],
  callbacks: GlobalsCallbacks,
): HTMLElement {
  const meta = GLOBAL_GROUP_META[group];
  const section = document.createElement('section');
  section.dataset['vigiliaGlobalsGroup'] = group;
  section.style.cssText = 'margin-bottom:22px';

  const heading = document.createElement('div');
  heading.style.cssText = 'display:flex;align-items:center;gap:8px;margin:14px 2px 10px';

  const title = document.createElement('h2');
  title.textContent = meta.label;
  title.style.cssText = `${sectionHeadingStyle('0')};flex:1`;
  heading.append(title);

  const add = document.createElement('button');
  add.type = 'button';
  add.textContent = '+';
  add.title = `Add a ${meta.label.toLowerCase()} token`;
  add.dataset['vigiliaGlobalAdd'] = group;
  add.style.cssText = buttonStyle({ width: '22px', padding: '0' });
  add.addEventListener('click', () => callbacks.onAction({ kind: 'add', group }));
  heading.append(add);

  section.append(heading);

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'None yet.';
    empty.style.cssText = 'color:var(--vigilia-subdued);margin:2px 0 6px';
    section.append(empty);

    return section;
  }

  for (const entry of entries) {
    section.append(renderRow(entry, meta.kind, callbacks));
  }

  return section;
}

function renderRow(
  usage: GlobalUsage,
  kind: 'colour' | 'number' | 'text',
  callbacks: GlobalsCallbacks,
): HTMLElement {
  const { group, key, entry } = usage;
  const id = `${group}.${key}`;

  const row = document.createElement('div');
  row.dataset['vigiliaGlobal'] = id;
  row.style.cssText = [
    'display:grid',
    'grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto auto',
    'gap:6px',
    'align-items:center',
    'margin:7px 0',
    'min-width:0',
  ].join(';');

  // References use group.key, so key is the primary identity shown in the row.
  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.value = key;
  keyInput.dataset['vigiliaGlobalKey'] = id;
  keyInput.title = `${id} — editing this rewrites every reference`;
  keyInput.style.cssText = inputStyle('inherit');
  keyInput.addEventListener('change', () => {
    if (keyInput.value !== key) {
      callbacks.onAction({ kind: 'key', group, key, nextKey: keyInput.value });
    }
  });
  row.append(keyInput);

  const value = document.createElement('input');
  value.type = kind === 'number' ? 'number' : 'text';
  value.value = entry.value === undefined ? '' : String(entry.value);
  value.dataset['vigiliaGlobalValue'] = id;
  value.style.cssText = inputStyle('inherit');
  value.addEventListener('change', () => {
    callbacks.onAction({
      kind: 'value',
      group,
      key,
      value: kind === 'number' ? Number(value.value) : value.value,
    });
  });
  row.append(value);

  if (kind === 'colour') {
    // Text input accepts arbitrary CSS colours; the colour well only accepts #rrggbb.
    const well = document.createElement('input');
    well.type = 'color';
    well.dataset['vigiliaGlobalColour'] = id;

    if (typeof entry.value === 'string' && /^#[0-9a-f]{6}$/i.test(entry.value)) {
      well.value = entry.value;
    }

    well.style.cssText = 'width:22px;height:22px;padding:0;border:1px solid var(--vigilia-control-border);background:none';
    well.addEventListener('change', () => {
      callbacks.onAction({ kind: 'value', group, key, value: well.value });
    });
    row.append(well);
  } else {
    row.append(document.createElement('span'));
  }

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '×';
  remove.dataset['vigiliaGlobalDelete'] = id;
  remove.title =
    usage.references.length === 0
      ? 'Delete — unused'
      : `Delete — its value is copied into ${describeUses(usage.references.length)}`;
  remove.style.cssText = buttonStyle({ width: '22px', padding: '0' });
  remove.addEventListener('click', () => callbacks.onAction({ kind: 'delete', group, key }));
  row.append(remove);

  const meta = document.createElement('div');
  meta.style.cssText = 'grid-column:1 / -1;display:flex;gap:8px;align-items:center;margin:2px 0 10px';

  const name = document.createElement('input');
  name.type = 'text';
  name.value = entry.name;
  name.dataset['vigiliaGlobalName'] = id;
  name.title = 'Display name — references use the key, so this is always safe to change';
  name.placeholder = 'display name';
  name.style.cssText = inputStyle('inherit');
  name.addEventListener('change', () => {
    if (name.value !== entry.name) {
      callbacks.onAction({ kind: 'name', group, key, name: name.value });
    }
  });
  meta.append(name);

  const uses = document.createElement('span');
  uses.dataset['vigiliaGlobalUses'] = id;
  uses.textContent = describeUses(usage.references.length);
  uses.title = usage.references.map((reference) => reference.where).join('\n');
  uses.style.cssText = `flex:none;color:${usage.references.length === 0 ? 'var(--vigilia-subdued)' : 'var(--vigilia-muted)'}`;
  meta.append(uses);

  row.append(meta);

  return row;
}

function describeUses(count: number): string {
  return count === 1 ? '1 use' : `${count} uses`;
}
