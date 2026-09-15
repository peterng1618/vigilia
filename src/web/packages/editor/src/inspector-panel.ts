import type { Globals } from '@vigilia/renderer-core';
import { buttonStyle, inputStyle, scrollAreaStyle, sectionHeadingStyle } from './button.js';
import type { FieldChange } from './inspector/apply.js';
import {
  globalOptions,
  type FieldDescriptor,
  type InspectorSection,
} from './inspector/model.js';

/** Descriptor-driven inspector UI. Emits edits; document rules live in model/apply. */

export interface InspectorPanel {
  readonly root: HTMLElement;
  render(sections: readonly InspectorSection[], globals: Globals): void;
  dispose(): void;
}

export interface InspectorCallbacks {
  readonly onChange: (key: string, change: FieldChange) => void;
}

/** UI-local token-picker state. Do not commit a ref until a token is chosen. */
interface PendingRefs {
  has(key: string): boolean;
  begin(key: string): void;
  end(key: string): void;
  cancel(key: string): void;
}

export function createInspector(host: HTMLElement, callbacks: InspectorCallbacks): InspectorPanel {
  const root = document.createElement('div');
  root.dataset['vigiliaInspector'] = 'root';
  root.style.cssText = [
    'width:100%',
    'flex:1',
    scrollAreaStyle(),
    'background:var(--vigilia-panel-bg)',
    'padding:14px 6px 36px 14px',
    'font:12px/1.5 system-ui,sans-serif',
    'color:var(--vigilia-text)',
  ].join(';');

  host.append(root);

  const pendingKeys = new Set<string>();
  let last: { sections: readonly InspectorSection[]; globals: Globals } | undefined;

  const draw = (sections: readonly InspectorSection[], globals: Globals): void => {
    // Rebuild only when selection/document content changes; rebuilding loses focus.
    root.textContent = '';

    if (sections.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'Nothing selected.';
      empty.style.cssText = 'color:var(--vigilia-muted);margin:8px 0';
      root.append(empty);
      return;
    }

    for (const section of sections) {
      root.append(renderSection(section, globals, callbacks, pending));
    }
  };

  const pending: PendingRefs = {
    has: (key) => pendingKeys.has(key),

    begin(key) {
      pendingKeys.add(key);

      // No document change occurs when opening the picker, so redraw locally.
      if (last !== undefined) {
        draw(last.sections, last.globals);
      }
    },

    end(key) {
      pendingKeys.delete(key);
    },

    cancel(key) {
      if (!pendingKeys.delete(key) || last === undefined) {
        return;
      }

      draw(last.sections, last.globals);
    },
  };

  return {
    root,

    render(sections: readonly InspectorSection[], globals: Globals): void {
      const keys = new Set(sections.flatMap((section) => section.fields.map((f) => f.key)));

      // Pending state belongs only to currently rendered fields.
      for (const key of pendingKeys) {
        if (!keys.has(key)) {
          pendingKeys.delete(key);
        }
      }

      last = { sections, globals };
      draw(sections, globals);
    },

    dispose(): void {
      root.remove();
    },
  };
}

function renderSection(
  section: InspectorSection,
  globals: Globals,
  callbacks: InspectorCallbacks,
  pending: PendingRefs,
): HTMLElement {
  const wrapper = document.createElement('section');
  wrapper.dataset['vigiliaSection'] = section.title;
  wrapper.style.cssText = 'margin-bottom:22px';

  const heading = document.createElement('h2');
  heading.textContent = section.title;
  heading.style.cssText = sectionHeadingStyle();

  wrapper.append(heading);

  for (const field of section.fields) {
    wrapper.append(renderField(field, globals, callbacks, pending));
  }

  return wrapper;
}

function renderField(
  field: FieldDescriptor,
  globals: Globals,
  callbacks: InspectorCallbacks,
  pending: PendingRefs,
): HTMLElement {
  const row = document.createElement('div');
  row.dataset['vigiliaField'] = field.key;
  row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:7px 0;min-height:28px;min-width:0';

  const label = document.createElement('label');
  label.textContent = field.label;
  label.style.cssText = 'flex:0 0 92px;min-width:0;color:var(--vigilia-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  row.append(label);

  // References show both token identity and resolved value.
  if (field.source === 'ref' && field.globalGroup !== undefined) {
    row.append(referencePicker(field, globals, callbacks, pending));
    row.append(modeButton('make local', field, callbacks, 'literal', pending));
    return row;
  }

  if (field.globalGroup !== undefined && pending.has(field.key)) {
    row.append(referencePicker(field, globals, callbacks, pending));
    row.append(modeButton('make local', field, callbacks, 'literal', pending));
    return row;
  }

  row.append(valueInput(field, callbacks));

  if (field.globalGroup !== undefined && !field.readOnly) {
    const options = globalOptions(globals, field.globalGroup);

    if (options.length > 0) {
      row.append(modeButton('use global', field, callbacks, 'ref', pending));
    }
  }

  return row;
}

function valueInput(field: FieldDescriptor, callbacks: InspectorCallbacks): HTMLElement {
  if (field.kind === 'boolean') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = field.value === true;
    input.indeterminate = field.mixed === true;
    input.disabled = field.readOnly === true;
    input.dataset['vigiliaInput'] = field.key;
    input.addEventListener('change', () => {
      callbacks.onChange(field.key, { kind: 'literal', value: input.checked });
    });
    return input;
  }

  if (field.kind === 'select') {
    const select = document.createElement('select');
    select.disabled = field.readOnly === true;
    select.dataset['vigiliaInput'] = field.key;
    select.style.cssText = inputStyle();

    if (field.mixed === true) {
      const mixed = document.createElement('option');
      mixed.value = '';
      mixed.textContent = '—';
      select.append(mixed);
    }

    for (const option of field.options ?? []) {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      select.append(element);
    }

    select.value = field.mixed === true ? '' : String(field.value ?? '');
    select.addEventListener('change', () => {
      callbacks.onChange(field.key, { kind: 'literal', value: select.value });
    });

    return select;
  }

  const group = document.createElement('div');
  group.style.cssText = 'flex:1;display:flex;gap:6px;align-items:center;min-width:0';

  const input = document.createElement('input');
  input.type = field.kind === 'number' ? 'number' : 'text';
  input.dataset['vigiliaInput'] = field.key;
  input.disabled = field.readOnly === true;
  input.style.cssText = inputStyle();

  if (field.kind === 'number') {
    if (field.min !== undefined) {
      input.min = String(field.min);
    }
    if (field.max !== undefined) {
      input.max = String(field.max);
    }
    input.step = String(field.step ?? 1);
  }

  if (field.mixed === true) {
    input.value = '';
    input.placeholder = 'mixed';
  } else {
    input.value = field.value === undefined ? '' : String(field.value);
    if (field.source === 'unset') {
      input.placeholder = 'default';
    }
  }

  input.addEventListener('change', () => {
    // Number inputs use '' for bad input; badInput distinguishes it from a deliberate clear.
    if (field.kind === 'number' && input.validity.badInput) {
      input.value = field.value === undefined ? '' : String(field.value);
      return;
    }

    callbacks.onChange(field.key, { kind: 'literal', value: input.value });
  });

  group.append(input);

  if (field.kind === 'colour' && field.readOnly !== true) {
    // Native colour inputs only cover #rrggbb; the text field retains the full CSS value.
    const well = document.createElement('input');
    well.type = 'color';
    well.dataset['vigiliaColour'] = field.key;
    well.value = toHexOrDefault(field.value);
    well.style.cssText = 'width:26px;height:22px;flex:none;padding:0;border:1px solid var(--vigilia-control-border);background:none';
    well.addEventListener('change', () => {
      callbacks.onChange(field.key, { kind: 'literal', value: well.value });
    });
    group.append(well);
  }

  if (field.source === 'literal' && field.readOnly !== true) {
    group.append(clearButton(field, callbacks));
  }

  return group;
}

function referencePicker(
  field: FieldDescriptor,
  globals: Globals,
  callbacks: InspectorCallbacks,
  pending: PendingRefs,
): HTMLElement {
  const group = document.createElement('div');
  group.style.cssText = 'flex:1;display:flex;gap:6px;align-items:center;min-width:0';

  const select = document.createElement('select');
  select.dataset['vigiliaRef'] = field.key;
  select.disabled = field.readOnly === true;
  select.style.cssText = inputStyle();

  // Pending refs start unselected; opening the picker must not choose a token.
  if (field.source !== 'ref') {
    const prompt = document.createElement('option');
    prompt.value = '';
    prompt.textContent = 'choose a token…';
    select.append(prompt);
  }

  for (const option of globalOptions(globals, field.globalGroup!)) {
    const element = document.createElement('option');
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  }

  // Keep dangling refs visible instead of silently selecting another token.
  if (field.ref !== undefined && !select.querySelector(`option[value="${cssEscape(field.ref)}"]`)) {
    const missing = document.createElement('option');
    missing.value = field.ref;
    missing.textContent = `${field.ref} (missing)`;
    select.prepend(missing);
  }

  select.value = field.ref ?? '';
  select.addEventListener('change', () => {
    if (select.value === '') {
      return;
    }

    pending.end(field.key);
    callbacks.onChange(field.key, { kind: 'ref', ref: select.value });
  });

  group.append(select);

  if (field.kind === 'colour' && typeof field.value === 'string') {
    const swatch = document.createElement('span');
    swatch.style.cssText = [
      'width:20px',
      'height:20px',
      'flex:none',
      'border:1px solid var(--vigilia-control-border)',
      `background:${field.value}`,
    ].join(';');
    group.append(swatch);
  }

  return group;
}

function modeButton(
  text: string,
  field: FieldDescriptor,
  callbacks: InspectorCallbacks,
  target: 'ref' | 'literal',
  pending: PendingRefs,
): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text === 'use global' ? '⇱' : '⇲';
  button.title = text;
  button.dataset['vigiliaMode'] = `${target}:${field.key}`;
  button.disabled = field.readOnly === true;
  button.style.cssText = buttonStyle({ width: '22px', padding: '0' });

  button.addEventListener('click', () => {
    if (target === 'literal') {
      // Making local freezes the token's current resolved value.
      if (field.source === 'ref') {
        callbacks.onChange(field.key, {
          kind: 'literal',
          value: field.value === undefined ? '' : field.value,
        });
      } else {
        pending.cancel(field.key);
      }

      return;
    }

    // Opening the token picker is UI state, not a document edit.
    pending.begin(field.key);
  });

  return button;
}

function clearButton(field: FieldDescriptor, callbacks: InspectorCallbacks): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '×';
  button.title = 'Clear — back to the default';
  button.dataset['vigiliaClear'] = field.key;
  button.style.cssText = buttonStyle({ width: '20px', padding: '0', variant: 'ghost' });

  button.addEventListener('click', () => {
    callbacks.onChange(field.key, { kind: 'unset' });
  });

  return button;
}

/** Returns a native-colour-compatible value; other CSS formats fall back to black. */
function toHexOrDefault(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}
