import { GLOBAL_GROUPS, type GlobalGroupName } from '@vigilia/renderer-core';
import { buttonStyle, inputStyle, scrollAreaStyle, sectionHeadingStyle } from './button.js';
import type { GlobalUsage } from './globals/commands.js';
import type { GlobalAction } from './globals/domain/global-action.js';
import { GLOBAL_GROUP_META } from './globals/domain/groups.js';

/**
 * The theme's globals, as an editable list (§73, §75).
 *
 * Document-level rather than selection-level, which is why it is a sibling of
 * the inspector rather than a section inside it: the inspector says "nothing
 * selected" when nothing is, and the palette is still worth looking at then.
 *
 * Renders {@link GlobalUsage} and emits {@link GlobalAction}. Decides nothing —
 * `globals-commands.ts` holds every rule, and is pure.
 *
 * ## Why each row shows a use count
 *
 * Changing a token changes every element that follows it, and an author cannot
 * see that from the row. "6 uses" is the blast radius, in the place where the
 * decision is made. It is also what makes deleting comprehensible: the button
 * says what it is about to inline.
 */

/** What the author did. */
export interface GlobalsPanel {
  readonly root: HTMLElement;
  render(usage: readonly GlobalUsage[]): void;
  dispose(): void;
}

export interface GlobalsCallbacks {
  readonly onAction: (action: GlobalAction) => void;
}

/** Group labels and what a new token in each one starts as. */
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
        // Every group is shown, including empty ones: the way to discover that
        // a theme can have spacing tokens is to see the empty Spacing section
        // with an add button, not to read the schema.
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

  // The KEY, not the display name, in the first column. References are
  // `group.key`, so the key is what an author needs to recognise a token in a
  // ref picker — showing only the pretty name hides the thing that matters.
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
    // Same split as the inspector: a text field takes any CSS colour a theme
    // may hold, the well is for picking. `input[type=color]` only understands
    // `#rrggbb`, so it cannot be the only control.
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

/** What a new token in a group starts as. */
