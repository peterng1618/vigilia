import {
  allowsStyleProperty,
  anyHasCapability,
  GLOBAL_GROUPS,
  type GlobalGroupName,
  type Globals,
  type StyleValue,
  type ThemeDocument,
  type ThemeNode,
} from '@vigilia/renderer-core';
import { findNode } from './commands.js';

/**
 * What the inspector shows, as data.
 *
 * The panel is generated from these descriptors rather than hand-written per
 * node type, for the reason every other layer here is split this way: the
 * decisions — which fields apply, what the current value is, whether it came
 * from a global, what is mixed across a selection — are the part that can be
 * wrong, and they are testable in Node. The DOM layer turns a descriptor into a
 * row and an edit back into a change.
 *
 * ## §75 is the reason this is not just a list of values
 *
 * "Every compatible property is EITHER a global reference OR its own literal —
 * never both, and never a bare value whose origin is ambiguous. Inspectors
 * surface this choice explicitly with 'use global' / 'make local'."
 *
 * So every style field carries a **source**: `ref`, `literal`, or `unset`. A row
 * showing `#00b8d9` without saying where it came from is precisely what §75
 * forbids, because the author cannot tell whether editing it will change one
 * element or every element using that token.
 *
 * ## Mixed values
 *
 * A multi-selection shows a field once, marked `mixed` when the selected nodes
 * disagree. Mixed is not the same as unset: unset means "no value, the renderer
 * default applies", mixed means "several values, and typing here replaces all
 * of them". Collapsing the two would make an edit silently overwrite values the
 * author never saw.
 */

export type FieldKind = 'number' | 'text' | 'colour' | 'boolean' | 'select';

/** Where a style property's current value came from (§75). */
export type FieldSource = 'ref' | 'literal' | 'unset';

export interface FieldOption {
  readonly value: string;
  readonly label: string;
}

export interface FieldDescriptor {
  /** Addresses the property for {@link applyFieldChange}. */
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  /** Current value, or undefined when unset or mixed. */
  readonly value: unknown;
  /** Style properties only. */
  readonly source?: FieldSource;
  /** The global being referenced, when `source` is `ref`. */
  readonly ref?: string;
  /** Globals group this property may reference, for the "use global" picker. */
  readonly globalGroup?: GlobalGroupName;
  /** Choices for a `select`. */
  readonly options?: readonly FieldOption[];
  readonly min?: number;
  readonly max?: number;
  /**
   * Spinner/arrow increment. `'any'` means the control accepts any precision,
   * which is what a geometry field needs: a fixed `step` of 1 made every
   * fractional value a `stepMismatch`, so the input sat permanently `:invalid`
   * and the arrows could only move in whole units.
   */
  readonly step?: number | 'any';
  /** The selected nodes disagree. Distinct from unset — see the module note. */
  readonly mixed?: boolean;
  /** §61: a locked node's fields are shown but not editable. */
  readonly readOnly?: boolean;
}

export interface InspectorSection {
  readonly title: string;
  readonly fields: readonly FieldDescriptor[];
}

/** One style property's type and range. */
export interface StyleFieldDefinition {
  readonly property: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly globalGroup?: GlobalGroupName;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly options?: readonly FieldOption[];
}

/** Style properties the renderer understands, with how to edit each. */
const STYLE_FIELDS: readonly StyleFieldDefinition[] = [
  { property: 'fill', label: 'Fill', kind: 'colour', globalGroup: 'palette' },
  { property: 'color', label: 'Text colour', kind: 'colour', globalGroup: 'palette' },
  { property: 'opacity', label: 'Opacity', kind: 'number', min: 0, max: 1, step: 0.05 },
  { property: 'strokeColor', label: 'Outline', kind: 'colour', globalGroup: 'palette' },
  { property: 'strokeWidth', label: 'Outline width', kind: 'number', min: 0, step: 0.5 },
  {
    property: 'strokeDash',
    label: 'Outline style',
    kind: 'select',
    options: [
      { value: 'solid', label: 'Solid' },
      { value: 'dashed', label: 'Dashed' },
      { value: 'dotted', label: 'Dotted' },
    ],
  },
  { property: 'shadowColor', label: 'Shadow', kind: 'colour', globalGroup: 'palette' },
  { property: 'shadowBlur', label: 'Shadow blur', kind: 'number', min: 0 },
  { property: 'shadowOffsetX', label: 'Shadow x', kind: 'number' },
  { property: 'shadowOffsetY', label: 'Shadow y', kind: 'number' },
  { property: 'fontFamily', label: 'Font', kind: 'text', globalGroup: 'fonts' },
  { property: 'fontSize', label: 'Size', kind: 'number', min: 1, globalGroup: 'fontSizes' },
  { property: 'fontWeight', label: 'Weight', kind: 'number', min: 100, max: 900, step: 100 },
  { property: 'letterSpacing', label: 'Letter spacing', kind: 'number', step: 0.1 },
  { property: 'lineHeight', label: 'Line height', kind: 'number', min: 0.5, step: 0.05 },
  { property: 'tabularNumerals', label: 'Tabular figures', kind: 'boolean' },
];

const STYLE_FIELDS_BY_PROPERTY = new Map(
  STYLE_FIELDS.map((definition) => [definition.property, definition]),
);

/**
 * The definition for a style property, or `undefined` if the renderer has no
 * such property.
 *
 * Exported so that **applying** an edit consults the same declaration that
 * built the control. It previously did not, and half the Style panel was inert
 * as a result: the panel rendered a number input, this table declared
 * `min`/`max`, and the apply step stored `input.value` verbatim — a string.
 * `mount.ts`'s `asNumber` requires a real number, so opacity, outline width,
 * shadow blur, font size, letter spacing and line height all silently did
 * nothing while the field showed the typed value and the history recorded an
 * edit.
 */
export function styleFieldFor(property: string): StyleFieldDefinition | undefined {
  return STYLE_FIELDS_BY_PROPERTY.get(property);
}

/**
 * Parses what a numeric control hands back, or refuses it.
 *
 * **A number input's `.value` is the empty string whenever its content is not
 * a valid number** — including a half-typed `1e` — and `Number('') === 0`. So
 * the obvious `Number(raw)` turned a clumsy keystroke into a committed zero:
 * width 0 made an element vanish, and clearing a numeric global rendered the
 * title at `0px`. Refusing is the only safe reading of "not a number".
 *
 * @returns The clamped number, or `undefined` when the input is not a number
 *   and the edit should be refused rather than coerced.
 */
export function parseNumeric(
  raw: unknown,
  range: { readonly min?: number; readonly max?: number } = {},
): number | undefined {
  // `unknown` because a `FieldChange` carries whatever produced it: the DOM
  // sends a string, and callers in code send a number.
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? clamp(raw, range) : undefined;
  }

  if (typeof raw !== 'string' || raw.trim() === '') {
    return undefined;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return clamp(parsed, range);
}

/**
 * Clamped rather than refused: an author typing past a limit means the limit,
 * and spec 0006 promises an edit cannot produce a document that then fails to
 * save.
 */
function clamp(
  value: number,
  range: { readonly min?: number; readonly max?: number },
): number {
  const lower = range.min === undefined ? value : Math.max(range.min, value);

  return range.max === undefined ? lower : Math.min(range.max, lower);
}

/**
 * Describes the inspector for a selection.
 *
 * An empty selection returns no sections rather than an empty shell: a panel
 * full of disabled fields is noise, and "nothing selected" is a clearer state.
 */
export function describeSelection(
  document_: ThemeDocument,
  ids: readonly string[],
): InspectorSection[] {
  const nodes = ids
    .map((id) => findNode(document_.nodes, id))
    .filter((node): node is ThemeNode => node !== undefined);

  if (nodes.length === 0) {
    return [];
  }

  const readOnly = nodes.some((node) => node.locked === true);
  // Which rows exist is decided by the capability matrix in `renderer-core`,
  // not by ad-hoc type checks here. A group therefore shows identity and flags
  // and nothing else — it used to offer X/Y/width/height and fill, properties
  // that either did nothing or moved its outline without its contents.
  const types = nodes.map((node) => node.type);

  return [
    identitySection(nodes, readOnly),
    ...(anyHasCapability(types, 'transform') ? [transformSection(nodes, readOnly)] : []),
    styleSection(nodes, document_.globals ?? {}, readOnly),
    ...(anyHasCapability(types, 'bindings') ? bindingSections(nodes, readOnly) : []),
  ].filter((section) => section.fields.length > 0);
}

function identitySection(nodes: readonly ThemeNode[], readOnly: boolean): InspectorSection {
  const single = nodes.length === 1 ? nodes[0] : undefined;

  return {
    title: nodes.length === 1 ? 'Element' : `${nodes.length} elements`,
    fields: [
      // The id is shown and never editable: §75 has links depend on it, and
      // renaming is what the name field is for.
      ...(single === undefined
        ? []
        : [
            {
              key: 'id',
              label: 'ID',
              kind: 'text' as const,
              value: single.id,
              readOnly: true,
            },
            {
              key: 'type',
              label: 'Type',
              kind: 'text' as const,
              value: single.type,
              readOnly: true,
            },
          ]),
      {
        key: 'name',
        label: 'Name',
        kind: 'text',
        ...common(nodes, (node) => node.name ?? ''),
        readOnly,
      },
      {
        key: 'visible',
        label: 'Visible',
        kind: 'boolean',
        ...common(nodes, (node) => node.visible !== false),
        // Visibility stays editable on a locked node: §61 locks *transforms*,
        // and being unable to hide a locked element would be a trap.
      },
      {
        key: 'locked',
        label: 'Locked',
        kind: 'boolean',
        ...common(nodes, (node) => node.locked === true),
      },
    ],
  };
}

function transformSection(nodes: readonly ThemeNode[], readOnly: boolean): InspectorSection {
  const field = (
    key: string,
    label: string,
    read: (node: ThemeNode) => number,
    extra: { min?: number; max?: number; step?: number | 'any' } = {},
  ): FieldDescriptor => ({
    key: `transform.${key}`,
    label,
    kind: 'number',
    ...common(nodes, read),
    ...extra,
    readOnly,
  });

  return {
    title: 'Transform',
    fields: [
      // Whole units, by decision: geometry is integral, so `step` stays 1 and
      // `updateTransforms` rounds. A fraction typed here lands on the nearest
      // unit rather than being refused.
      field('x', 'X', (node) => node.transform?.x ?? 0),
      field('y', 'Y', (node) => node.transform?.y ?? 0),
      field('width', 'Width', (node) => node.transform?.width ?? 0, { min: 0 }),
      field('height', 'Height', (node) => node.transform?.height ?? 0, { min: 0 }),
      field('rotation', 'Rotation', (node) => node.transform?.rotation ?? 0, {
        min: -360,
        max: 360,
      }),
    ],
  };
}

function styleSection(
  nodes: readonly ThemeNode[],
  globals: Globals,
  readOnly: boolean,
): InspectorSection {
  const fields: FieldDescriptor[] = [];

  for (const definition of STYLE_FIELDS) {
    // One question, one owner: may any selected type carry this property? The
    // old `TEXT_ONLY` set was a second declaration of the same fact, and a typo
    // in it showed typography rows on a rectangle.
    if (!nodes.some((node) => allowsStyleProperty(node.type, definition.property))) {
      continue;
    }

    const values = nodes.map((node) => node.style?.[definition.property]);
    const first = values[0];
    const mixed = values.some((value) => !sameStyleValue(value, first));

    const source: FieldSource =
      first === undefined ? 'unset' : 'ref' in first && first.ref !== undefined ? 'ref' : 'literal';

    fields.push({
      key: `style.${definition.property}`,
      label: definition.label,
      kind: definition.kind,
      value: mixed || first === undefined ? undefined : resolveForDisplay(first, globals),
      source: mixed ? 'unset' : source,
      ...(source === 'ref' && first !== undefined && 'ref' in first && first.ref !== undefined
        ? { ref: first.ref }
        : {}),
      ...(definition.globalGroup === undefined ? {} : { globalGroup: definition.globalGroup }),
      ...(definition.options === undefined ? {} : { options: definition.options }),
      ...(definition.min === undefined ? {} : { min: definition.min }),
      ...(definition.max === undefined ? {} : { max: definition.max }),
      ...(definition.step === undefined ? {} : { step: definition.step }),
      ...(mixed ? { mixed: true } : {}),
      readOnly,
    });
  }

  return { title: 'Style', fields };
}

/**
 * Binding rows, one section per binding.
 *
 * Single selection only. Bindings are per-node and identified by ids that are
 * unique across the document, so "the second binding" means nothing across a
 * multi-selection — editing by position would write one node's semantic key
 * into another's.
 */
function bindingSections(nodes: readonly ThemeNode[], readOnly: boolean): InspectorSection[] {
  if (nodes.length !== 1) {
    return [];
  }

  const node = nodes[0]!;

  return (node.bindings ?? []).map((binding, index) => ({
    title: `Binding ${index + 1}`,
    fields: [
      {
        key: `binding.${binding.id}.semanticKey`,
        label: 'Sensor',
        kind: 'text' as const,
        value: binding.semanticKey,
        readOnly,
      },
      {
        key: `binding.${binding.id}.precision`,
        label: 'Decimals',
        kind: 'number' as const,
        value: binding.precision,
        min: 0,
        max: 6,
        step: 1,
        readOnly,
      },
      {
        key: `binding.${binding.id}.unitDisplay`,
        label: 'Unit',
        kind: 'select' as const,
        value: binding.unitDisplay ?? 'short',
        options: [
          { value: 'none', label: 'Hidden' },
          { value: 'short', label: 'Symbol' },
          { value: 'long', label: 'Full name' },
        ],
        readOnly,
      },
    ],
  }));
}

/** A value shared by every node, or undefined and `mixed` when they disagree. */
function common<T>(
  nodes: readonly ThemeNode[],
  read: (node: ThemeNode) => T,
): { value: T | undefined; mixed?: true } {
  const values = nodes.map(read);
  const first = values[0];

  return values.every((value) => value === first)
    ? { value: first }
    : { value: undefined, mixed: true };
}

function sameStyleValue(a: StyleValue | undefined, b: StyleValue | undefined): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }

  if ('ref' in a && a.ref !== undefined) {
    return 'ref' in b && b.ref === a.ref;
  }

  return !('ref' in b && b.ref !== undefined) && a.value === b.value;
}

/**
 * The value to show in the field.
 *
 * A reference displays its **resolved** value, so an author sees the colour they
 * will get — with `source: 'ref'` telling the row to present it as a token
 * rather than an editable literal. Showing the ref string alone would make the
 * author open the globals panel to find out what colour it is.
 */
function resolveForDisplay(value: StyleValue, globals: Globals): unknown {
  if (!('ref' in value) || value.ref === undefined) {
    return value.value;
  }

  const [group, ...rest] = value.ref.split('.');
  const entryId = rest.join('.');

  if (group === undefined || !GLOBAL_GROUPS.includes(group as GlobalGroupName)) {
    return undefined;
  }

  return globals[group as GlobalGroupName]?.[entryId]?.value;
}

/** Globals available for a field's picker, as options. */
export function globalOptions(globals: Globals, group: GlobalGroupName): FieldOption[] {
  return Object.entries(globals[group] ?? {}).map(([id, entry]) => ({
    value: `${group}.${id}`,
    label: entry.name,
  }));
}
