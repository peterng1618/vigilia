import type { Globals } from '@vigilia/renderer-core';
import { buttonStyle, inputStyle, scrollAreaStyle, sectionHeadingStyle } from './button.js';
import type { FieldChange } from './inspector-apply.js';
import {
  globalOptions,
  type FieldDescriptor,
  type InspectorSection,
} from './inspector-model.js';

/**
 * The inspector panel: descriptors in, edits out.
 *
 * Knows nothing about the document. It receives {@link InspectorSection}s,
 * renders a row per field, and reports `(key, change)` when the author changes
 * something. Every rule about what a field means lives in
 * `inspector-model.ts` and `inspector-apply.ts`, both of which are pure.
 *
 * ## Edits land on `change`, not on every keystroke
 *
 * A `change` event fires on blur or Enter for text and number inputs, and
 * immediately for checkboxes and selects. So one field edit is one undo entry,
 * which is what §67 asks for. Reporting on `input` instead would put an entry
 * in history for every digit typed — the same mistake as recording a drag per
 * pointer move, and it would also re-render the scene mid-number, so typing
 * "100" would briefly apply 1 and then 10.
 *
 * ## §75 is a per-row mode switch
 *
 * A style row that can reference a token gets a small button: **use global**
 * when it holds a literal, **make local** when it holds a reference. That is
 * the explicit choice §75 requires, and the row always says which state it is
 * in rather than showing a bare value whose origin is ambiguous.
 *
 * Switching *to* a global is a two-step choice, and the intermediate step is
 * held here rather than in the document — see {@link PendingRefs}.
 */

export interface InspectorPanel {
  readonly root: HTMLElement;
  render(sections: readonly InspectorSection[], globals: Globals): void;
  dispose(): void;
}

export interface InspectorCallbacks {
  /** The author changed a field. */
  readonly onChange: (key: string, change: FieldChange) => void;
}

/**
 * Rows switched to "use global" whose token has not been chosen yet.
 *
 * Deliberately UI-local. The obvious implementation is to write
 * `{ ref: 'palette.' }` immediately and let the row re-render as a picker — but
 * that puts a **dangling reference** in the document and an undo entry in the
 * history for a choice the author has not finished making, and an interrupted
 * click leaves the theme referring to a token that does not exist. §75's
 * conversion is not complete until a token is picked, so nothing is committed
 * until then.
 *
 * Cleared when the selection changes, because a pending row belongs to the node
 * it was opened on.
 */
interface PendingRefs {
  has(key: string): boolean;
  /** Open the picker for a row, without touching the document. */
  begin(key: string): void;
  /** A token was chosen: the resulting document change redraws the panel. */
  end(key: string): void;
  /** Backed out without choosing: nothing changed, so redraw explicitly. */
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
      // Rebuilt wholesale on every render. A diffing panel would keep focus
      // through a re-render, which matters — but the scene re-renders on a 1 Hz
      // data tick, and rebuilding then would steal focus mid-typing. Guarded
      // instead by only re-rendering the panel when the selection or document
      // changes, which the caller decides.
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

      // Redrawn from the last input rather than waiting for a document change,
      // because there is no document change — that is the whole point.
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

      // A pending row belongs to the node it was opened on. Anything that is no
      // longer on screen is abandoned.
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

  // A reference shows the token it points at, and the value it resolves to, so
  // the author can see both what they picked and what it looks like.
  if (field.source === 'ref' && field.globalGroup !== undefined) {
    row.append(referencePicker(field, globals, callbacks, pending));
    row.append(modeButton('make local', field, callbacks, 'literal', pending));
    return row;
  }

  // Switched to a global, token not chosen yet: a picker with nothing selected,
  // and the same button to back out. No document change has happened.
  if (field.globalGroup !== undefined && pending.has(field.key)) {
    row.append(referencePicker(field, globals, callbacks, pending));
    row.append(modeButton('make local', field, callbacks, 'literal', pending));
    return row;
  }

  row.append(valueInput(field, callbacks));

  if (field.globalGroup !== undefined && !field.readOnly) {
    const options = globalOptions(globals, field.globalGroup);

    // No button when the document defines no tokens of that kind: offering
    // "use global" that opens an empty list is worse than not offering it.
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
    // `indeterminate` is exactly the right affordance for a mixed boolean: the
    // author can see it is neither, and clicking sets all of them.
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

  // Mixed shows as an empty field with a placeholder rather than one node's
  // value, which would look like agreement that is not there.
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
    // A number input reports `.value` as the empty string for ANY content it
    // cannot parse, so a half-typed `1e` is indistinguishable from a cleared
    // field by value alone — and treating it as empty committed a zero, which
    // made elements vanish and rendered text at 0px. `validity.badInput` is
    // the one signal that separates the two: garbage is refused here, while a
    // genuinely empty field still means "clear this property".
    if (field.kind === 'number' && input.validity.badInput) {
      // Snap back to what the document holds, so the rejected text does not
      // sit on screen looking accepted.
      input.value = field.value === undefined ? '' : String(field.value);
      return;
    }

    callbacks.onChange(field.key, { kind: 'literal', value: input.value });
  });

  group.append(input);

  if (field.kind === 'colour' && field.readOnly !== true) {
    // A native colour well beside the text field. Both edit the same property:
    // the text field accepts any CSS colour the theme may contain, and the well
    // is for picking. `input[type=color]` only understands `#rrggbb`, so it
    // cannot be the only control without narrowing what a theme can express.
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

  // Nothing chosen yet: an explicit prompt, not the first token pre-selected.
  // A pre-selected token would mean clicking "use global" and clicking away
  // silently picked one.
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

  // A reference to a token that no longer exists still has to be shown, or the
  // author cannot see what is broken — the picker would silently jump to the
  // first token and an edit would "fix" it without anyone noticing.
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

  // The resolved swatch, so a token name is not the only thing on screen.
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
      // "Make local" freezes the token's CURRENT value into the element, which
      // is what §75's conversion means — and what an author expects: the
      // element keeps looking the same and stops following the token.
      //
      // When the row was only *pending* a token there is nothing to freeze and
      // nothing was ever committed, so backing out is a redraw, not an edit.
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

    // "Use global" only opens the picker. Committing a ref here — even a
    // placeholder one — would write a dangling reference and an undo entry for
    // an unfinished choice.
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

/**
 * A `#rrggbb` value for the native colour well.
 *
 * Anything else — a named colour, `rgba()`, a value with alpha — has no
 * representation in `input[type=color]`, so the well falls back to black rather
 * than showing a wrong colour. The text field beside it still shows the real
 * value, which is why the well is never the only control.
 */
function toHexOrDefault(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
}

/** Escapes a value for use in an attribute selector. */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}
