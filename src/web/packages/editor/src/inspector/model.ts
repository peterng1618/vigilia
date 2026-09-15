import {
  allowsStyleProperty,
  anyHasCapability,
  settingsFieldsFor,
  transformPropertiesFor,
  type ChartFamily,
  GLOBAL_GROUPS,
  type GlobalGroupName,
  type Globals,
  type StyleValue,
  type ThemeDocument,
  type ThemeNode,
} from '@vigilia/renderer-core';
import { findNode } from '../commands.js';

/** Pure selection → inspector descriptors. Keep unset distinct from mixed (§75). */

export type FieldKind = 'number' | 'text' | 'colour' | 'boolean' | 'select';
export type FieldSource = 'ref' | 'literal' | 'unset';

export interface FieldOption {
  readonly value: string;
  readonly label: string;
}

export interface FieldDescriptor {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly value: unknown;
  readonly source?: FieldSource;
  readonly ref?: string;
  readonly globalGroup?: GlobalGroupName;
  readonly options?: readonly FieldOption[];
  readonly min?: number;
  readonly max?: number;
  /** `'any'` avoids browser stepMismatch for unrestricted precision. */
  readonly step?: number | 'any';
  readonly mixed?: boolean;
  readonly readOnly?: boolean;
}

export interface InspectorSection {
  readonly title: string;
  readonly fields: readonly FieldDescriptor[];
}

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

/** Renderer style vocabulary paired with editor control metadata. */
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

/** Shared by descriptor generation and edit parsing so field type/range cannot drift. */
export function styleFieldFor(property: string): StyleFieldDefinition | undefined {
  return STYLE_FIELDS_BY_PROPERTY.get(property);
}

/** Parse and clamp numeric input; refuse blank/invalid values instead of coercing them to zero. */
export function parseNumeric(
  raw: unknown,
  range: { readonly min?: number; readonly max?: number } = {},
): number | undefined {
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

function clamp(
  value: number,
  range: { readonly min?: number; readonly max?: number },
): number {
  const lower = range.min === undefined ? value : Math.max(range.min, value);

  return range.max === undefined ? lower : Math.min(range.max, lower);
}

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
  const types = nodes.map((node) => node.type);

  return [
    identitySection(nodes, readOnly),
    ...(anyHasCapability(types, 'position') ? [transformSection(nodes, readOnly)] : []),
    styleSection(nodes, document_.globals ?? {}, readOnly),
    ...chartSettingsSections(nodes, readOnly),
    ...(anyHasCapability(types, 'bindings') ? bindingSections(nodes, readOnly) : []),
  ].filter((section) => section.fields.length > 0);
}

function identitySection(nodes: readonly ThemeNode[], readOnly: boolean): InspectorSection {
  const single = nodes.length === 1 ? nodes[0] : undefined;

  return {
    title: nodes.length === 1 ? 'Element' : `${nodes.length} elements`,
    fields: [
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

function transformSection(
  nodes: readonly ThemeNode[],
  readOnly: boolean,
): InspectorSection {
  const read = (node: ThemeNode, property: 'x' | 'y' | 'width' | 'height' | 'rotation'): number =>
    node.transform?.[property] ?? 0;

  const offered = new Set(nodes.flatMap((node) => transformPropertiesFor(node.type)));

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
      field('x', 'X', (node) => read(node, 'x')),
      field('y', 'Y', (node) => read(node, 'y')),
      field('width', 'Width', (node) => read(node, 'width'), { min: 0 }),
      field('height', 'Height', (node) => read(node, 'height'), { min: 0 }),
      field('rotation', 'Rotation', (node) => read(node, 'rotation'), {
        min: -360,
        max: 360,
      }),
    ].filter((descriptor) => offered.has(descriptor.key.slice('transform.'.length))),
  };
}

function styleSection(
  nodes: readonly ThemeNode[],
  globals: Globals,
  readOnly: boolean,
): InspectorSection {
  const fields: FieldDescriptor[] = [];

  for (const definition of STYLE_FIELDS) {
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

/** Show chart settings only when every selected chart has the same family. */
function chartSettingsSections(
  nodes: readonly ThemeNode[],
  readOnly: boolean,
): InspectorSection[] {
  if (nodes.length === 0 || !nodes.every((node) => node.type === 'chart')) {
    return [];
  }

  const charts = nodes.filter(
    (node): node is Extract<ThemeNode, { type: 'chart' }> => node.type === 'chart',
  );
  const family = charts[0]!.content.family;

  if (!charts.every((node) => node.content.family === family)) {
    return [];
  }

  return [{
    title: `${chartFamilyLabel(family)} settings`,
    fields: settingsFieldsFor(family).map((definition) => {
      const values = charts.map(
        (node) =>
          (node.content.settings as unknown as Record<string, unknown>)[definition.property],
      );
      const shared = commonValues(values);

      return {
        key: `chart.${family}.${definition.property}`,
        label: definition.label,
        kind: definition.kind,
        value: shared.value,
        ...(definition.options === undefined ? {} : { options: definition.options }),
        ...(definition.min === undefined ? {} : { min: definition.min }),
        ...(definition.max === undefined ? {} : { max: definition.max }),
        ...(definition.step === undefined ? {} : { step: definition.step }),
        ...(shared.mixed === true ? { mixed: true } : {}),
        readOnly,
      };
    }),
  }];
}

function chartFamilyLabel(family: ChartFamily): string {
  return family[0]!.toUpperCase() + family.slice(1);
}

function commonValues(values: readonly unknown[]): { value: unknown; mixed?: true } {
  const first = values[0];

  return values.every((value) => Object.is(value, first))
    ? { value: first }
    : { value: undefined, mixed: true };
}

/** Binding ids are node-local; mixed selections therefore expose no binding rows. */
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

/** Resolve refs for the preview while `source` still tells the UI they are global. */
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

export function globalOptions(globals: Globals, group: GlobalGroupName): FieldOption[] {
  return Object.entries(globals[group] ?? {}).map(([id, entry]) => ({
    value: `${group}.${id}`,
    label: entry.name,
  }));
}
