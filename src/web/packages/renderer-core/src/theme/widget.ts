import {
  STABLE_ID_PATTERN,
  type Binding,
  type Globals,
  type StyleMap,
  type StyleValue,
  type TextRun,
  type ThemeNode,
  type WidgetProvenance,
} from './document.js';

/**
 * Inserting a widget: a reusable subtree embedded as a copy (§138).
 *
 * ## Why a copy, and what that costs
 *
 * §138 is explicit that V1 insertion "embeds a copy with fresh IDs and
 * provenance; no automatic library-update propagation". So this is a *fork*, not
 * a link: improving the library widget later does nothing to copies already
 * placed. The provenance stamp is what makes a future "update from library"
 * possible as an explicit action rather than a guess.
 *
 * ## The part that is easy to get wrong
 *
 * Fresh IDs are not just node IDs. A widget's text runs reference **binding
 * IDs**, and a binding ID must be document-unique — so both have to be renamed,
 * *consistently*, or a run silently loses its value. Renaming nodes and
 * forgetting runs is the defect this module exists to prevent, and it is why
 * every reference is rewritten through one ID map.
 *
 * What is deliberately **not** renamed: `semanticKey`. It is the whole point of
 * a binding (§93) — a widget bound to `cpu.load` must still be bound to
 * `cpu.load` after insertion, or the widget would arrive showing nothing.
 *
 * ## Globals are mapped explicitly, never merged by name
 *
 * §77: "import uses explicit mapping rather than silently merging same-name
 * globals". Two documents can both define `palette.accent` and mean different
 * colours, so a widget's `{ ref: 'palette.accent' }` must not quietly adopt the
 * destination's. An unmapped reference is reported; with the widget's own
 * globals available it can instead be converted to a local literal, which is the
 * same remedy §75 offers when a global is deleted.
 */

export interface WidgetIssue {
  readonly code: 'unmapped-global' | 'id-collision' | 'invalid-id';
  readonly detail: string;
}

export interface InstantiateWidgetOptions {
  /**
   * Prefix for generated IDs. The caller owns it — the editor would derive one
   * per insertion — which keeps this function deterministic and testable.
   */
  readonly idPrefix: string;
  /** IDs already in use in the destination document. */
  readonly existingIds?: Iterable<string>;
  /** Stamped on each inserted root. */
  readonly provenance?: WidgetProvenance;
  /**
   * Maps the widget's global references to the destination's, as
   * `'palette.accent' → 'palette.brand'`.
   */
  readonly globalRefMapping?: Readonly<Record<string, string>>;
  /**
   * The widget's own globals. When a reference is unmapped and these are
   * available, it becomes a local literal instead of an issue — the widget then
   * looks the way its author intended, at the cost of no longer following the
   * destination's tokens.
   */
  readonly widgetGlobals?: Globals;
  /** Added to each inserted root's transform, to place the copy. */
  readonly offset?: { readonly x: number; readonly y: number };
}

export interface InstantiateWidgetResult {
  readonly nodes: readonly ThemeNode[];
  /** Old ID → new ID, for nodes and bindings alike. */
  readonly idMap: ReadonlyMap<string, string>;
  readonly issues: readonly WidgetIssue[];
}

/** Longest a stable ID may be (§75's pattern). */
const MAX_ID_LENGTH = 64;

/**
 * Embeds a copy of `nodes` with fresh IDs.
 *
 * Returns issues rather than throwing: an insertion with an unmapped global is
 * still a usable insertion, and the editor should be able to show the author
 * what needs deciding instead of refusing the gesture.
 */
export function instantiateWidget(
  nodes: readonly ThemeNode[],
  options: InstantiateWidgetOptions,
): InstantiateWidgetResult {
  const issues: WidgetIssue[] = [];
  const taken = new Set(options.existingIds ?? []);
  const idMap = new Map<string, string>();

  // Two passes. Every ID in the subtree is allocated first, so a reference can
  // be rewritten without caring whether its target appears before or after it —
  // a text run may precede the binding it names in document order, and a
  // single-pass rewrite would then miss it.
  collectIds(nodes, options.idPrefix, taken, idMap, issues);

  const copied = nodes.map((node) => copyNode(node, options, idMap, issues, true));

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

    if (node.type === 'group') {
      collectIds(node.children, prefix, taken, idMap, issues);
    }
  }
}

/**
 * Allocates one fresh ID.
 *
 * `prefix-original` keeps the result readable, which matters when an author is
 * looking at a tree of them. It is then truncated to the 64-character limit and
 * de-duplicated with a numeric suffix — truncation is exactly what makes two
 * distinct source IDs able to collide, so the suffix is not theoretical.
 */
function allocate(
  original: string,
  prefix: string,
  taken: Set<string>,
  idMap: Map<string, string>,
  issues: WidgetIssue[],
): void {
  if (idMap.has(original)) {
    // A duplicate inside the widget itself. The source document was invalid;
    // report it rather than silently merging two elements onto one ID.
    issues.push({
      code: 'id-collision',
      detail: `The widget declares "${original}" more than once. Its copies will share one id.`,
    });
    return;
  }

  const sanitized = sanitizeId(`${prefix}-${original}`);

  if (sanitized === '') {
    issues.push({
      code: 'invalid-id',
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

/** Trims to the stable-ID character set and length. */
function sanitizeId(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, MAX_ID_LENGTH);
  return STABLE_ID_PATTERN.test(cleaned) ? cleaned : '';
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
    ...(node.transform === undefined && !isRoot ? {} : { transform: offsetTransform(node, options, isRoot) }),
    ...(node.style === undefined
      ? {}
      : { style: remapStyleMap(node.style, options, issues) }),
    ...(node.bindings === undefined
      ? {}
      : { bindings: node.bindings.map((binding) => copyBinding(binding, idMap)) }),
    // §138: provenance on the roots only. Stamping every descendant would
    // triple the size of a deep widget to say the same thing.
    ...(isRoot && options.provenance !== undefined ? { provenance: options.provenance } : {}),
  };

  switch (node.type) {
    case 'group':
      return {
        ...base,
        type: 'group',
        children: node.children.map((child) => copyNode(child, options, idMap, issues, false)),
      };

    case 'text':
      return {
        ...base,
        type: 'text',
        content: {
          ...node.content,
          runs: node.content.runs.map((run) => copyRun(run, options, idMap, issues)),
        },
      };

    case 'image':
      return {
        ...base,
        type: 'image',
        content: {
          ...node.content,
          ...(node.content.monochrome === undefined
            ? {}
            : { monochrome: remapStyleValue(node.content.monochrome, options, issues) }),
        },
      };

    default:
      // Charts, shapes and video carry no IDs or references inside their
      // content, so the spread above is already a complete copy.
      return base as ThemeNode;
  }
}

function offsetTransform(
  node: ThemeNode,
  options: InstantiateWidgetOptions,
  isRoot: boolean,
): NonNullable<ThemeNode['transform']> {
  const transform = node.transform ?? {};

  // Only roots move. A child's coordinates are group-local (§57), so offsetting
  // them too would shift every descendant twice.
  if (!isRoot || options.offset === undefined) {
    return transform;
  }

  return {
    ...transform,
    x: (transform.x ?? 0) + options.offset.x,
    y: (transform.y ?? 0) + options.offset.y,
  };
}

/**
 * Copies a binding with a fresh ID.
 *
 * `semanticKey` is untouched on purpose — see the module comment.
 */
function copyBinding(binding: Binding, idMap: ReadonlyMap<string, string>): Binding {
  return { ...binding, id: idMap.get(binding.id) ?? binding.id };
}

function copyRun(
  run: TextRun,
  options: InstantiateWidgetOptions,
  idMap: ReadonlyMap<string, string>,
  issues: WidgetIssue[],
): TextRun {
  const style =
    run.style === undefined ? undefined : remapStyleMap(run.style, options, issues);

  if (run.kind === 'literal') {
    return { ...run, ...(style === undefined ? {} : { style }) };
  }

  return {
    ...run,
    // The reference that makes this module worth having: rename the binding and
    // forget this, and the run renders a placeholder for a sensor that is right
    // there.
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

/**
 * Rewrites one style value's global reference (§77).
 *
 * Order matters: an explicit mapping wins; then the widget's own literal, if its
 * globals came along; otherwise the reference is left as it is and reported.
 * Leaving it is the least-bad fallback — it may resolve correctly by coincidence
 * in the destination — but it is reported precisely because "by coincidence" is
 * not a design.
 */
function remapStyleValue(
  value: StyleValue,
  options: InstantiateWidgetOptions,
  issues: WidgetIssue[],
): StyleValue {
  if (!('ref' in value) || value.ref === undefined) {
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
    code: 'unmapped-global',
    detail:
      `The widget references "${value.ref}", which is not mapped to a global in this document. ` +
      'Map it explicitly or supply the widget\'s globals so it can be made a local literal — ' +
      'a same-named global here may mean something else entirely.',
  });

  return value;
}

function lookupGlobal(globals: Globals | undefined, ref: string): unknown {
  if (globals === undefined) {
    return undefined;
  }

  const [group, ...rest] = ref.split('.');
  const entryId = rest.join('.');

  if (group === undefined || entryId === '') {
    return undefined;
  }

  return globals[group as keyof Globals]?.[entryId]?.value;
}
