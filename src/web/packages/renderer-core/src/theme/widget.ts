import {
  type Binding,
  type Globals,
  STABLE_ID_PATTERN,
  type StyleMap,
  type StyleValue,
  type TextRun,
  type ThemeNode,
  type WidgetProvenance,
} from "./document.js";

/** Inserts a reusable subtree as a copy with fresh IDs and explicit global mapping. */

export interface WidgetIssue {
  readonly code: "unmapped-global" | "id-collision" | "invalid-id";
  readonly detail: string;
}

export interface InstantiateWidgetOptions {
  /** Caller-provided deterministic prefix for generated IDs. */
  readonly idPrefix: string;
  readonly existingIds?: Iterable<string>;
  readonly provenance?: WidgetProvenance;
  readonly globalRefMapping?: Readonly<Record<string, string>>;
  /** Unmapped widget globals may be inlined as literals when supplied. */
  readonly widgetGlobals?: Globals;
  readonly offset?: { readonly x: number; readonly y: number };
}

export interface InstantiateWidgetResult {
  readonly nodes: readonly ThemeNode[];
  /** Old ID to new ID, for nodes and bindings. */
  readonly idMap: ReadonlyMap<string, string>;
  readonly issues: readonly WidgetIssue[];
}

const MAX_ID_LENGTH = 64;

/** Embeds a copy. Issues are returned so recoverable mapping problems remain inspectable. */
export function instantiateWidget(
  nodes: readonly ThemeNode[],
  options: InstantiateWidgetOptions,
): InstantiateWidgetResult {
  const issues: WidgetIssue[] = [];
  const taken = new Set(options.existingIds ?? []);
  const idMap = new Map<string, string>();

  // Allocate all IDs first so references can point forward or backward safely.
  collectIds(nodes, options.idPrefix, taken, idMap, issues);

  const copied = nodes.map((node) =>
    copyNode(node, options, idMap, issues, true),
  );

  return { nodes: copied, idMap, issues };
}

function collectIds(
  nodes: readonly ThemeNode[],
  prefix: string,
  taken: Set<string>,
  idMap: Map<string, string>,
  issues: WidgetIssue[],
): void {
  for (const node of nodes) {
    allocate(node.id, prefix, taken, idMap, issues);

    for (const binding of node.bindings ?? []) {
      allocate(binding.id, prefix, taken, idMap, issues);
    }

    if (node.type === "group") {
      collectIds(node.children, prefix, taken, idMap, issues);
    }
  }
}

/** Allocates a readable stable ID, truncating before any collision suffix. */
function allocate(
  original: string,
  prefix: string,
  taken: Set<string>,
  idMap: Map<string, string>,
  issues: WidgetIssue[],
): void {
  if (idMap.has(original)) {
    issues.push({
      code: "id-collision",
      detail: `The widget declares "${original}" more than once. Its copies will share one id.`,
    });
    return;
  }

  const sanitized = sanitizeId(`${prefix}-${original}`);

  if (sanitized === "") {
    issues.push({
      code: "invalid-id",
      detail: `Could not derive a valid id from prefix "${prefix}" and "${original}".`,
    });
    idMap.set(original, original);
    return;
  }

  let candidate = sanitized;
  let counter = 2;

  while (taken.has(candidate)) {
    const suffix = `-${counter}`;
    candidate = `${sanitized.slice(0, MAX_ID_LENGTH - suffix.length)}${suffix}`;
    counter += 1;
  }

  taken.add(candidate);
  idMap.set(original, candidate);
}

function sanitizeId(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, MAX_ID_LENGTH);
  return STABLE_ID_PATTERN.test(cleaned) ? cleaned : "";
}

function copyNode(
  node: ThemeNode,
  options: InstantiateWidgetOptions,
  idMap: ReadonlyMap<string, string>,
  issues: WidgetIssue[],
  isRoot: boolean,
): ThemeNode {
  const base = {
    ...node,
    id: idMap.get(node.id) ?? node.id,
    ...(node.transform === undefined && !isRoot
      ? {}
      : { transform: offsetTransform(node, options, isRoot) }),
    ...(node.style === undefined
      ? {}
      : { style: remapStyleMap(node.style, options, issues) }),
    ...(node.bindings === undefined
      ? {}
      : {
          bindings: node.bindings.map((binding) => copyBinding(binding, idMap)),
        }),
    // Provenance belongs on inserted roots, not every descendant.
    ...(isRoot && options.provenance !== undefined
      ? { provenance: options.provenance }
      : {}),
  };

  switch (node.type) {
    case "group":
      return {
        ...base,
        type: "group",
        children: node.children.map((child) =>
          copyNode(child, options, idMap, issues, false),
        ),
      };

    case "text":
      return {
        ...base,
        type: "text",
        content: {
          ...node.content,
          runs: node.content.runs.map((run) =>
            copyRun(run, options, idMap, issues),
          ),
        },
      };

    case "image":
      return {
        ...base,
        type: "image",
        content: {
          ...node.content,
          ...(node.content.monochrome === undefined
            ? {}
            : {
                monochrome: remapStyleValue(
                  node.content.monochrome,
                  options,
                  issues,
                ),
              }),
        },
      };

    default:
      return base as ThemeNode;
  }
}

function offsetTransform(
  node: ThemeNode,
  options: InstantiateWidgetOptions,
  isRoot: boolean,
): NonNullable<ThemeNode["transform"]> {
  const transform = node.transform ?? {};

  // Child coordinates are group-local, so only inserted roots receive the placement offset.
  if (!isRoot || options.offset === undefined) {
    return transform;
  }

  return {
    ...transform,
    x: (transform.x ?? 0) + options.offset.x,
    y: (transform.y ?? 0) + options.offset.y,
  };
}

/** Freshens binding identity while preserving its semantic key. */
function copyBinding(
  binding: Binding,
  idMap: ReadonlyMap<string, string>,
): Binding {
  return { ...binding, id: idMap.get(binding.id) ?? binding.id };
}

function copyRun(
  run: TextRun,
  options: InstantiateWidgetOptions,
  idMap: ReadonlyMap<string, string>,
  issues: WidgetIssue[],
): TextRun {
  const style =
    run.style === undefined
      ? undefined
      : remapStyleMap(run.style, options, issues);

  if (run.kind === "literal") {
    return { ...run, ...(style === undefined ? {} : { style }) };
  }

  return {
    ...run,
    bindingId: idMap.get(run.bindingId) ?? run.bindingId,
    ...(style === undefined ? {} : { style }),
  };
}

function remapStyleMap(
  style: StyleMap,
  options: InstantiateWidgetOptions,
  issues: WidgetIssue[],
): StyleMap {
  const result: Record<string, StyleValue> = {};

  for (const [property, value] of Object.entries(style)) {
    result[property] = remapStyleValue(value, options, issues);
  }

  return result;
}

/** Explicit mapping wins; otherwise inline supplied widget globals or report the unresolved ref. */
function remapStyleValue(
  value: StyleValue,
  options: InstantiateWidgetOptions,
  issues: WidgetIssue[],
): StyleValue {
  if (!("ref" in value) || value.ref === undefined) {
    return value;
  }

  const mapped = options.globalRefMapping?.[value.ref];

  if (mapped !== undefined) {
    return { ref: mapped as typeof value.ref };
  }

  const literal = lookupGlobal(options.widgetGlobals, value.ref);

  if (literal !== undefined) {
    return { value: literal };
  }

  issues.push({
    code: "unmapped-global",
    detail:
      `The widget references "${value.ref}", which is not mapped to a global in this document. ` +
      "Map it explicitly or supply the widget's globals so it can be made a local literal — " +
      "a same-named global here may mean something else entirely.",
  });

  return value;
}

function lookupGlobal(globals: Globals | undefined, ref: string): unknown {
  if (globals === undefined) {
    return undefined;
  }

  const [group, ...rest] = ref.split(".");
  const entryId = rest.join(".");

  if (group === undefined || entryId === "") {
    return undefined;
  }

  return globals[group as keyof Globals]?.[entryId]?.value;
}
