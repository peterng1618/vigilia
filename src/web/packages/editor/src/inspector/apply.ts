import {
  settingsFieldsFor,
  type ChartFamily,
  type GlobalRef,
  type ThemeDocument,
  type ThemeNode,
  type Transform,
} from '@vigilia/renderer-core';
import { findNode, renameNode, setNodeFlags, updateStyle, updateTransforms } from '../commands.js';
import { normalizeDegrees } from '../transform-gesture.js';
// Applying an edit consults the same declaration that built the control, so a
// numeric field cannot be rendered as a number input and stored as a string.
import { parseNumeric, styleFieldFor } from './model.js';

/**
 * Turning an inspector edit into a document edit.
 *
 * The counterpart to `model.ts`: that produces field descriptors from
 * a document, this consumes a field key plus a new value and produces the next
 * document. Both are pure, so the whole panel is testable without a DOM.
 *
 * ## Why field keys are strings
 *
 * `'style.fill'`, `'transform.x'`, `'binding.b1.precision'`. A string key means
 * the DOM layer carries no knowledge of the document shape — it renders rows and
 * reports "this key changed" — and it means a new field is one entry in the
 * model plus one case here, rather than a change threaded through three layers.
 *
 * The cost is that an unknown key is a runtime possibility rather than a
 * compile error, which is why {@link applyFieldChange} returns the document
 * unchanged for one instead of throwing: a typo in a field key should not take
 * down the editor mid-edit.
 */

/** What the author did to a field. */
export type FieldChange =
  /** Typed a value, ticked a box, chose an option. */
  | { readonly kind: 'literal'; readonly value: unknown }
  /** Chose "use global" and picked a token (§75). */
  | { readonly kind: 'ref'; readonly ref: string }
  /** Chose "clear", returning the property to the renderer's default. */
  | { readonly kind: 'unset' };

/**
 * Applies a change to every selected node.
 *
 * @returns The next document, or the same one when nothing applied — so a
 *   caller can skip an undo entry by identity.
 */
export function applyFieldChange(
  document_: ThemeDocument,
  ids: readonly string[],
  key: string,
  change: FieldChange,
): ThemeDocument {
  const nodes = ids
    .map((id) => findNode(document_.nodes, id))
    .filter((node): node is ThemeNode => node !== undefined);

  if (nodes.length === 0) {
    return document_;
  }

  if (key === 'name') {
    if (change.kind !== 'literal' || typeof change.value !== 'string') {
      return document_;
    }

    return nodes.reduce((current, node) => renameNode(current, node.id, change.value as string), document_);
  }

  if (key === 'visible' || key === 'locked') {
    if (change.kind !== 'literal' || typeof change.value !== 'boolean') {
      return document_;
    }

    return nodes.reduce(
      (current, node) => setNodeFlags(current, node.id, { [key]: change.value as boolean }),
      document_,
    );
  }

  if (key.startsWith('transform.')) {
    return applyTransformField(document_, nodes, key.slice('transform.'.length), change);
  }

  if (key.startsWith('style.')) {
    return applyStyleField(document_, nodes, key.slice('style.'.length), change);
  }

  if (key.startsWith('chart.')) {
    return applyChartField(document_, nodes, key, change);
  }

  if (key.startsWith('binding.')) {
    return applyBindingField(document_, nodes, key, change);
  }

  // Unknown key — including `id` and `type`, which the model marks read-only.
  return document_;
}

function applyTransformField(
  document_: ThemeDocument,
  nodes: readonly ThemeNode[],
  property: string,
  change: FieldChange,
): ThemeDocument {
  if (change.kind !== 'literal') {
    return document_;
  }

  // `Number('')` is 0, and a number input reports the empty string for any
  // content it cannot parse — so the obvious `Number(change.value)` turned a
  // half-typed `1e` into a committed zero, which made the element vanish.
  const raw = parseNumeric(change.value);

  if (raw === undefined) {
    return document_;
  }

  // Clamped to what the schema allows, so typing 400 into rotation cannot
  // produce a document that fails to save. Width and height are clamped at 0
  // for the same reason; the gesture layer's 1 px floor is a usability choice
  // and does not belong here, where an author may legitimately want 0.
  const value =
    property === 'rotation'
      ? normalizeDegrees(raw)
      : property === 'width' || property === 'height'
        ? Math.max(0, raw)
        : raw;

  // A group is skipped rather than written to. The capability matrix means the
  // inspector never offers it a transform row, so this is defence against a
  // key arriving from somewhere else — writing geometry onto a group would put
  // a value in the document that the renderer ignores and nothing displays.
  const transforms = new Map<string, Transform>(
    nodes
      .filter((node) => node.type !== 'group')
      .map((node) => [node.id, { ...(node.transform ?? {}), [property]: value }]),
  );

  if (transforms.size === 0) {
    return document_;
  }

  return updateTransforms(document_, transforms);
}

function applyStyleField(
  document_: ThemeDocument,
  nodes: readonly ThemeNode[],
  property: string,
  change: FieldChange,
): ThemeDocument {
  return nodes.reduce((current, node) => {
    if (change.kind === 'unset') {
      return updateStyle(current, node.id, { [property]: undefined });
    }

    if (change.kind === 'ref') {
      // §75: a reference REPLACES any literal. `updateStyle` overwrites the
      // property wholesale rather than merging, so `{ ref, value }` — which the
      // validator rejects — cannot be produced here.
      return updateStyle(current, node.id, { [property]: { ref: change.ref as GlobalRef } });
    }

    // An empty string means "cleared" for a text or colour field. Storing it
    // would emit `fill: ""`, which the renderer treats as absent anyway — so
    // the document may as well say so.
    if (change.value === '' || change.value === undefined) {
      return updateStyle(current, node.id, { [property]: undefined });
    }

    const definition = styleFieldFor(property);

    // Numeric properties must be stored as NUMBERS. Storing the control's
    // string put `{"value":"0.25"}` in the document, and `mount.ts`'s
    // `asNumber` requires `typeof === 'number'` — so opacity, outline width,
    // shadow blur, font size, letter spacing and line height all silently did
    // nothing while the field showed the typed value and the history recorded
    // an edit. Outline was worse: a failed width parse discarded the colour
    // too, leaving `border: 0px none`.
    if (definition?.kind === 'number') {
      const parsed = parseNumeric(change.value, definition);

      // Refused rather than coerced: see `parseNumeric`.
      if (parsed === undefined) {
        return current;
      }

      return updateStyle(current, node.id, { [property]: { value: parsed } });
    }

    return updateStyle(current, node.id, { [property]: { value: change.value } });
  }, document_);
}

function applyChartField(
  document_: ThemeDocument,
  nodes: readonly ThemeNode[],
  key: string,
  change: FieldChange,
): ThemeDocument {
  const [, familyValue, property] = key.split('.');

  if (!isChartFamily(familyValue) || property === undefined || change.kind !== 'literal') {
    return document_;
  }

  const definition = settingsFieldsFor(familyValue).find((field) => field.property === property);

  if (definition === undefined) {
    return document_;
  }

  let value: unknown;

  if (definition.kind === 'number') {
    value = parseNumeric(change.value, definition);
    if (value === undefined) {
      return document_;
    }
  } else if (definition.kind === 'boolean') {
    if (typeof change.value !== 'boolean') {
      return document_;
    }
    value = change.value;
  } else {
    if (
      typeof change.value !== 'string' ||
      !definition.options?.some((option) => option.value === change.value)
    ) {
      return document_;
    }
    value = change.value;
  }

  let changed = false;
  const nextNodes = nodes.reduce((current, node) => {
    if (node.type !== 'chart' || node.content.family !== familyValue) {
      return current;
    }

    const settings: Record<string, unknown> = { ...node.content.settings };
    const previous = settings[property];

    settings[property] = value;

    if (Object.is(previous, value)) {
      return current;
    }

    changed = true;
    return replaceNode(current, node.id, () => ({
      ...node,
      content: { ...node.content, settings },
    }) as unknown as ThemeNode);
  }, document_.nodes);

  return changed ? { ...document_, nodes: nextNodes } : document_;
}

function isChartFamily(value: string | undefined): value is ChartFamily {
  return value === 'gauge' || value === 'line' || value === 'bar' || value === 'pie';
}

/**
 * Applies a binding field, addressed by the binding's own id.
 *
 * By id rather than by index, because binding ids are document-unique: an index
 * would mean "the second binding of whichever node", and across a selection
 * that writes one node's sensor into another's.
 */
function applyBindingField(
  document_: ThemeDocument,
  nodes: readonly ThemeNode[],
  key: string,
  change: FieldChange,
): ThemeDocument {
  const [, bindingId, property] = key.split('.');

  if (bindingId === undefined || property === undefined || change.kind !== 'literal') {
    return document_;
  }

  const owner = nodes.find((node) => node.bindings?.some((binding) => binding.id === bindingId));

  if (owner === undefined) {
    return document_;
  }

  const bindings = (owner.bindings ?? []).map((binding) => {
    if (binding.id !== bindingId) {
      return binding;
    }

    if (property === 'semanticKey') {
      // §93: this is the whole point of a binding, so an empty key would leave
      // a binding that can never resolve. Refused rather than stored.
      return typeof change.value === 'string' && change.value.length > 0
        ? { ...binding, semanticKey: change.value }
        : binding;
    }

    if (property === 'precision') {
      if (change.value === '' || change.value === undefined) {
        const { precision: _precision, ...rest } = binding;
        return rest;
      }

      const precision = Number(change.value);

      return Number.isInteger(precision) && precision >= 0 && precision <= 6
        ? { ...binding, precision }
        : binding;
    }

    if (property === 'unitDisplay') {
      // Narrowed through a type guard rather than inline comparisons: with
      // `change.value` typed `unknown`, the three-way `||` widened back to
      // `string` and the result no longer satisfied `Binding`.
      return isUnitDisplay(change.value) ? { ...binding, unitDisplay: change.value } : binding;
    }

    return binding;
  });

  return {
    ...document_,
    nodes: replaceNode(document_.nodes, owner.id, (node) => ({ ...node, bindings })),
  };
}

function isUnitDisplay(value: unknown): value is 'none' | 'short' | 'long' {
  return value === 'none' || value === 'short' || value === 'long';
}

/** Replaces one node anywhere in the tree, sharing untouched branches. */
function replaceNode(
  nodes: readonly ThemeNode[],
  id: string,
  change: (node: ThemeNode) => ThemeNode,
): readonly ThemeNode[] {
  let changed = false;

  const mapped = nodes.map((node) => {
    if (node.id === id) {
      changed = true;
      return change(node);
    }

    if (node.type === 'group') {
      const children = replaceNode(node.children, id, change);

      if (children !== node.children) {
        changed = true;
        return { ...node, children };
      }
    }

    return node;
  });

  return changed ? mapped : nodes;
}

/** A label for the undo entry an inspector edit produces. */
export function labelForField(key: string): string {
  if (key.startsWith('style.')) {
    return `Set ${key.slice('style.'.length)}`;
  }
  if (key.startsWith('transform.')) {
    return `Set ${key.slice('transform.'.length)}`;
  }
  if (key.startsWith('binding.')) {
    return 'Edit binding';
  }
  if (key.startsWith('chart.')) {
    return `Set ${key.split('.').at(-1)}`;
  }

  return `Set ${key}`;
}
