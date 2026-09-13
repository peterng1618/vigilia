import { NODE_TYPES, type NodeType } from './document.js';

/**
 * Which entity may carry which property — the capability matrix.
 *
 * This is the machine-readable form of
 * [spec 0011](../../../../../.agents/specs/0011-editor-property-model.md), and
 * the single owner of the style property vocabulary.
 *
 * ## Why this file exists
 *
 * "Which properties does a node type have" previously had five answers and no
 * owner: `scene/mount.ts` read style keys as strings, `scene/plan.ts` read two
 * more, `scene/fonts.ts` a third, the JSON schema described the list as **prose
 * inside a `description`** (its `styleMap` accepts any name), and the editor's
 * `STYLE_FIELDS` plus `TEXT_ONLY` declared it twice more. `validateStyleMap`
 * validates each *value's* shape and never looks at the property *name*.
 *
 * The consequence was silent: `{"strokewidth": {"value": 2}}` passes the
 * schema, passes validation with zero issues, and is dropped by the renderer. A
 * comment in `mount.ts` claimed the validator caught it. It did not.
 *
 * ## Two rules encoded here
 *
 * - **A group is an editor entity, not a drawable** (spec 0011 D2). It has
 *   children, visibility, lock and an order among its siblings — no geometry,
 *   no paint. Selecting one previously offered X/Y/width/height and fill,
 *   properties that either did nothing or did something surprising.
 * - **Colour and typography are theme-level** (D3, D4). An element references a
 *   palette entry or a type preset; it carries no literal colour and no
 *   individual font properties. `opacity` is the deliberate exception: it is a
 *   property of *this instance*, not a shared design token.
 *
 * Keyed by `NodeType` as a `Record`, so adding a node type is a compile error
 * until this table gains a row — the mechanism the rest of the format already
 * uses, and the reason this is a table rather than a comment.
 */

/** A property group, as the inspector presents it. */
export type CapabilityGroup =
  /** `id` (read-only) and `name`. Everything has these. */
  | 'identity'
  /** `visible` and `locked`. Everything has these. */
  | 'flags'
  /** `x` and `y`, in whole artboard units. */
  | 'position'
  /** `width` and `height`, in whole artboard units. */
  | 'size'
  /** `rotation`, in whole degrees. */
  | 'rotation'
  /** Element-level `opacity` — an instance property, never a token. */
  | 'opacity'
  /** `fill`, as a palette reference. */
  | 'fill'
  /** `strokeColor`, `strokeWidth`, `strokeDash`. */
  | 'stroke'
  /** `shadowColor`, `shadowBlur`, `shadowOffsetX`, `shadowOffsetY`. */
  | 'shadow'
  /** `cornerRadius`. */
  | 'cornerRadius'
  /** A type preset reference, plus text colour. */
  | 'typography'
  /** Text content and its runs. */
  | 'textContent'
  /** Image source and fit. */
  | 'image'
  /** Video source, fit, loop and mute. */
  | 'video'
  /** Semantic key bindings. */
  | 'bindings'
  /** The selected chart family's own settings. */
  | 'chartSettings';

/**
 * The matrix. One row per node type; see spec 0011 for the argument behind
 * each absence, because an absence is a decision.
 */
export const NODE_CAPABILITIES: Readonly<Record<NodeType, readonly CapabilityGroup[]>> = {
  // Position and rotation only, both DERIVED from its children rather than
  // stored — see `DERIVED_CAPABILITIES`.
  //
  // **No `size`.** Moving and rotating a group is something an author does;
  // resizing one is not (user, 2026-09-13). This is why `transform` had to be
  // split into three: as one capability it could not express "offers position
  // but not size", and the first attempt swung between offering a group
  // everything and offering it nothing.
  group: ['identity', 'flags', 'position', 'rotation'],
  rectangle: ['identity', 'flags', 'position', 'size', 'rotation', 'opacity', 'fill', 'stroke', 'shadow', 'cornerRadius'],
  // No corner radius: an ellipse has no corners to round.
  ellipse: ['identity', 'flags', 'position', 'size', 'rotation', 'opacity', 'fill', 'stroke', 'shadow'],
  // No `fill`: text has a colour, and the renderer maps `fill` to `color` in
  // text mode and then overwrites it — so offering both showed two rows for one
  // property and editing one appeared to do nothing.
  text: ['identity', 'flags', 'position', 'size', 'rotation', 'opacity', 'shadow', 'typography', 'textContent', 'bindings'],
  // A stroked path with no interior, so it has a stroke and no fill.
  line: ['identity', 'flags', 'position', 'size', 'rotation', 'opacity', 'stroke', 'shadow'],
  // No fill or stroke: tinting a bitmap is not something this format does, and
  // §170 forbids auto-inverting bitmap colours.
  image: ['identity', 'flags', 'position', 'size', 'rotation', 'opacity', 'image'],
  // Same reasoning as `image`, with playback rather than fit.
  video: ['identity', 'flags', 'position', 'size', 'rotation', 'opacity', 'video'],
  // Paint comes from the family's settings, not from element style — otherwise
  // a chart has two colour systems.
  chart: ['identity', 'flags', 'position', 'size', 'rotation', 'opacity', 'bindings', 'chartSettings'],
};

/**
 * Capabilities an entity presents but does not **store**.
 *
 * Editing one of these rewrites something else — a group's `x` applies a delta
 * to every child. The distinction matters to the apply layer, which must not
 * write a transform onto a node that has no business holding one, and to the
 * inspector, which may want to say so.
 */
export const DERIVED_CAPABILITIES: Readonly<
  Partial<Record<NodeType, readonly CapabilityGroup[]>>
> = {
  group: ['position', 'rotation'],
};

/** Whether `type` presents `group` as a derived value rather than a stored one. */
export function isDerivedCapability(type: NodeType, group: CapabilityGroup): boolean {
  return (DERIVED_CAPABILITIES[type] ?? []).includes(group);
}

/** Whether `type` carries the given property group. */
export function hasCapability(type: NodeType, group: CapabilityGroup): boolean {
  return NODE_CAPABILITIES[type].includes(group);
}

/**
 * Whether **any** of the selected types carries `group`.
 *
 * A multi-selection shows a row when at least one member can use it, and the
 * row is then applied only to the members that can — the alternative, hiding
 * everything not universally supported, makes a mixed selection look like it
 * has no properties at all.
 */
export function anyHasCapability(
  types: readonly NodeType[],
  group: CapabilityGroup,
): boolean {
  return types.some((type) => hasCapability(type, group));
}

/**
 * Which style properties each capability group owns.
 *
 * This is the style property **vocabulary** — the list `mount.ts` reads, the
 * schema describes in prose and the editor re-declared. Anything absent here is
 * not a style property, and a validator can finally say so.
 */
export const STYLE_PROPERTIES_BY_GROUP: Readonly<
  Partial<Record<CapabilityGroup, readonly string[]>>
> = {
  opacity: ['opacity'],
  fill: ['fill'],
  stroke: ['strokeColor', 'strokeWidth', 'strokeDash'],
  shadow: ['shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY'],
  // Retained during the transition to type presets (D4). `fontFamily`,
  // `fontSize`, `fontWeight`, `letterSpacing` and `lineHeight` become a single
  // preset reference; until that lands they are still what the renderer reads.
  typography: [
    'color',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'letterSpacing',
    'lineHeight',
    'tabularNumerals',
  ],
};

/**
 * Which transform fields each geometry capability covers.
 *
 * Declared here rather than in the inspector so "a group has x/y but not
 * width/height" is one fact in one place — the inspector reads it, and so can
 * the gesture layer when deciding whether to draw resize handles.
 */
export const TRANSFORM_PROPERTIES_BY_GROUP: Readonly<
  Partial<Record<CapabilityGroup, readonly string[]>>
> = {
  position: ['x', 'y'],
  size: ['width', 'height'],
  rotation: ['rotation'],
};

/** The transform fields `type` may present, in inspector order. */
export function transformPropertiesFor(type: NodeType): readonly string[] {
  const order: readonly CapabilityGroup[] = ['position', 'size', 'rotation'];

  return order
    .filter((group) => hasCapability(type, group))
    .flatMap((group) => TRANSFORM_PROPERTIES_BY_GROUP[group] ?? []);
}

/** Every style property the renderer understands, in no particular order. */
export const STYLE_PROPERTIES: readonly string[] = Object.values(
  STYLE_PROPERTIES_BY_GROUP,
).flatMap((properties) => properties ?? []);

const STYLE_PROPERTY_SET = new Set(STYLE_PROPERTIES);

/**
 * Whether `property` is a style property this build understands.
 *
 * The check that was missing: an unknown name could previously reach a saved
 * theme and be silently dropped at render time.
 */
export function isKnownStyleProperty(property: string): boolean {
  return STYLE_PROPERTY_SET.has(property);
}

/** Whether `type` may carry the style property `property`. */
export function allowsStyleProperty(type: NodeType, property: string): boolean {
  return NODE_CAPABILITIES[type].some((group) =>
    (STYLE_PROPERTIES_BY_GROUP[group] ?? []).includes(property),
  );
}

/** The style properties `type` may carry, for building an inspector. */
export function stylePropertiesFor(type: NodeType): readonly string[] {
  return NODE_CAPABILITIES[type].flatMap(
    (group) => STYLE_PROPERTIES_BY_GROUP[group] ?? [],
  );
}

/** Sanity: every declared node type has a row. Exported for the tests. */
export const CAPABILITY_TYPES: readonly NodeType[] = NODE_TYPES;
