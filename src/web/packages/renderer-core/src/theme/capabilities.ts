import { NODE_TYPES, type NodeType } from "./document.js";

/** Single owner of node capabilities and the style-property vocabulary. */

export type CapabilityGroup =
  | "identity"
  | "flags"
  | "position"
  | "size"
  | "rotation"
  | "opacity"
  | "fill"
  | "stroke"
  | "shadow"
  | "cornerRadius"
  | "typography"
  | "textContent"
  | "image"
  | "video"
  | "bindings"
  | "chartSettings";

/** One row per node type. Groups are structural and own no drawable geometry or paint. */
export const NODE_CAPABILITIES: Readonly<
  Record<NodeType, readonly CapabilityGroup[]>
> = {
  group: ["identity", "flags"],
  rectangle: [
    "identity",
    "flags",
    "position",
    "size",
    "rotation",
    "opacity",
    "fill",
    "stroke",
    "shadow",
    "cornerRadius",
  ],
  ellipse: [
    "identity",
    "flags",
    "position",
    "size",
    "rotation",
    "opacity",
    "fill",
    "stroke",
    "shadow",
  ],
  text: [
    "identity",
    "flags",
    "position",
    "size",
    "rotation",
    "opacity",
    "shadow",
    "typography",
    "textContent",
    "bindings",
  ],
  line: [
    "identity",
    "flags",
    "position",
    "size",
    "rotation",
    "opacity",
    "stroke",
    "shadow",
  ],
  image: [
    "identity",
    "flags",
    "position",
    "size",
    "rotation",
    "opacity",
    "image",
  ],
  video: [
    "identity",
    "flags",
    "position",
    "size",
    "rotation",
    "opacity",
    "video",
  ],
  chart: [
    "identity",
    "flags",
    "position",
    "size",
    "rotation",
    "opacity",
    "bindings",
    "chartSettings",
  ],
};

/** Capabilities presented by an entity but stored elsewhere. Empty today. */
export const DERIVED_CAPABILITIES: Readonly<
  Partial<Record<NodeType, readonly CapabilityGroup[]>>
> = {};

export function isDerivedCapability(
  type: NodeType,
  group: CapabilityGroup,
): boolean {
  return (DERIVED_CAPABILITIES[type] ?? []).includes(group);
}

export function hasCapability(type: NodeType, group: CapabilityGroup): boolean {
  return NODE_CAPABILITIES[type].includes(group);
}

/** Multi-selection shows a capability when any selected type supports it. */
export function anyHasCapability(
  types: readonly NodeType[],
  group: CapabilityGroup,
): boolean {
  return types.some((type) => hasCapability(type, group));
}

/** Style-property vocabulary grouped by inspector capability. */
export const STYLE_PROPERTIES_BY_GROUP: Readonly<
  Partial<Record<CapabilityGroup, readonly string[]>>
> = {
  opacity: ["opacity"],
  fill: ["fill"],
  stroke: ["strokeColor", "strokeWidth", "strokeDash"],
  shadow: ["shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY"],
  // Transitional fields until typography moves fully to type presets.
  typography: [
    "color",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "tabularNumerals",
  ],
};

export const TRANSFORM_PROPERTIES_BY_GROUP: Readonly<
  Partial<Record<CapabilityGroup, readonly string[]>>
> = {
  position: ["x", "y"],
  size: ["width", "height"],
  rotation: ["rotation"],
};

export function transformPropertiesFor(type: NodeType): readonly string[] {
  const order: readonly CapabilityGroup[] = ["position", "size", "rotation"];

  return order
    .filter((group) => hasCapability(type, group))
    .flatMap((group) => TRANSFORM_PROPERTIES_BY_GROUP[group] ?? []);
}

export const STYLE_PROPERTIES: readonly string[] = Object.values(
  STYLE_PROPERTIES_BY_GROUP,
).flatMap((properties) => properties ?? []);

const STYLE_PROPERTY_SET = new Set(STYLE_PROPERTIES);

export function isKnownStyleProperty(property: string): boolean {
  return STYLE_PROPERTY_SET.has(property);
}

export function allowsStyleProperty(type: NodeType, property: string): boolean {
  return NODE_CAPABILITIES[type].some((group) =>
    (STYLE_PROPERTIES_BY_GROUP[group] ?? []).includes(property),
  );
}

export function stylePropertiesFor(type: NodeType): readonly string[] {
  return NODE_CAPABILITIES[type].flatMap(
    (group) => STYLE_PROPERTIES_BY_GROUP[group] ?? [],
  );
}

/** Mirrors NODE_TYPES for schema/capability completeness tests. */
export const CAPABILITY_TYPES: readonly NodeType[] = NODE_TYPES;
