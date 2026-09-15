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
import { parseNumeric, styleFieldFor } from './model.js';

/** Pure inspector field edit → immutable document edit. Unknown/read-only keys no-op. */

export type FieldChange =
  | { readonly kind: 'literal'; readonly value: unknown }
  | { readonly kind: 'ref'; readonly ref: string }
  | { readonly kind: 'unset' };

/** Return the same document when refused/no-op so caller can skip history. */
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

  const raw = parseNumeric(change.value);

  if (raw === undefined) {
    return document_;
  }

  const value =
    property === 'rotation'
      ? normalizeDegrees(raw)
      : property === 'width' || property === 'height'
        ? Math.max(0, raw)
        : raw;

  // Legacy groups do not own transform fields in this editor model.
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
      // Replace the whole style value so ref/literal cannot coexist (§75).
      return updateStyle(current, node.id, { [property]: { ref: change.ref as GlobalRef } });
    }

    if (change.value === '' || change.value === undefined) {
      return updateStyle(current, node.id, { [property]: undefined });
    }

    const definition = styleFieldFor(property);

    if (definition?.kind === 'number') {
      const parsed = parseNumeric(change.value, definition);

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

/** Bindings are addressed by id, never selection-relative index. */
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

/** Replace one node anywhere in the tree while sharing untouched branches. */
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
