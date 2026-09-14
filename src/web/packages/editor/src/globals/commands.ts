import {
  GLOBAL_GROUPS,
  STABLE_ID_PATTERN,
  type GlobalEntry,
  type GlobalGroupName,
  type GlobalRef,
  type StyleMap,
  type StyleValue,
  type ThemeDocument,
  type ThemeNode,
} from '@vigilia/renderer-core';
import { nodeLabel } from '../node-label.js';

/**
 * Editing the theme's globals (§73, §75).
 *
 * Pure, like every other command module: document in, document out, untouched
 * branches shared by reference.
 *
 * ## The part that is easy to get wrong
 *
 * A global is referenced from **five** places, not one:
 *
 * | Site | |
 * |---|---|
 * | `artboard.background` | |
 * | `artboard.barColor` | |
 * | `node.style[property]` | every node, recursively |
 * | `node.content.runs[].style[property]` | text runs (§89) |
 * | `node.content.monochrome` | image recolouring (§111) |
 *
 * Miss one and every operation here is subtly wrong in the same direction: a
 * reference count reads low, a rekey leaves a dangling reference behind, and a
 * delete silently breaks an element that looked fine. The list was taken from
 * the schema (`$defs/styleValue` and `$defs/styleMap` call sites) rather than
 * from memory, and {@link visitStyleValues} is the single walk all of them use —
 * so a sixth site means changing one function.
 *
 * ## Keys versus names
 *
 * A reference is `group.key`. The display `name` is separate precisely so
 * renaming is safe (§75), so {@link renameGlobal} touches no references at all.
 * Changing the **key** is a different operation — {@link rekeyGlobal} — and it
 * rewrites every reference.
 */

/** Where one reference to a global lives. */
export interface GlobalReference {
  /** Node id, or undefined for an artboard-level reference. */
  readonly nodeId?: string;
  /** A human-readable location, for telling an author what a change affects. */
  readonly where: string;
}

export interface GlobalUsage {
  readonly group: GlobalGroupName;
  readonly key: string;
  readonly entry: GlobalEntry;
  readonly references: readonly GlobalReference[];
}

export function isValidGlobalKey(key: string): boolean {
  return STABLE_ID_PATTERN.test(key);
}

/**
 * An unused key in a group, derived from `base`.
 *
 * Adding a token needs a key before the author has typed anything, and a
 * generated one keeps "add" a single click instead of a modal form. The author
 * renames it afterwards, which {@link rekeyGlobal} makes safe.
 */
export function nextGlobalKey(document_: ThemeDocument, group: GlobalGroupName, base: string): string {
  const entries = document_.globals?.[group] ?? {};

  if (entries[base] === undefined && isValidGlobalKey(base)) {
    return base;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}`;

    if (entries[candidate] === undefined) {
      return candidate;
    }
  }

  // Unreachable for any real theme; returning the base rather than throwing
  // means the caller's add is refused instead of the editor falling over.
  return base;
}

/** Every global in the document, with where each one is used. */
export function collectGlobalUsage(document_: ThemeDocument): GlobalUsage[] {
  const usage: GlobalUsage[] = [];

  for (const group of GLOBAL_GROUPS) {
    const entries = document_.globals?.[group];

    if (entries === undefined) {
      continue;
    }

    for (const [key, entry] of Object.entries(entries)) {
      usage.push({
        group,
        key,
        entry,
        references: referencesTo(document_, `${group}.${key}` as GlobalRef),
      });
    }
  }

  return usage;
}

/** Every place one specific token is referenced. */
export function referencesTo(document_: ThemeDocument, ref: GlobalRef): GlobalReference[] {
  const found: GlobalReference[] = [];

  visitStyleValues(document_, (value, site) => {
    if (value.ref === ref) {
      found.push(site.nodeId === undefined ? { where: site.where } : { nodeId: site.nodeId, where: site.where });
    }

    return value;
  });

  return found;
}

/**
 * Adds a token.
 *
 * Refuses an invalid or duplicate key rather than overwriting: an add that
 * silently replaced an existing token would change every element referencing
 * it, which is a different operation with a different undo label.
 */
export function addGlobal(
  document_: ThemeDocument,
  group: GlobalGroupName,
  key: string,
  entry: GlobalEntry,
): ThemeDocument {
  if (!isValidGlobalKey(key) || document_.globals?.[group]?.[key] !== undefined) {
    return document_;
  }

  return withGroup(document_, group, { ...document_.globals?.[group], [key]: entry });
}

/** Changes a token's value. Every reference follows it — that is the point. */
export function setGlobalValue(
  document_: ThemeDocument,
  group: GlobalGroupName,
  key: string,
  value: unknown,
): ThemeDocument {
  const existing = document_.globals?.[group]?.[key];

  if (existing === undefined || existing.value === value) {
    return document_;
  }

  return withGroup(document_, group, {
    ...document_.globals?.[group],
    [key]: { ...existing, value },
  });
}

/** Changes a token's display name. References use the key, so none change. */
export function renameGlobal(
  document_: ThemeDocument,
  group: GlobalGroupName,
  key: string,
  name: string,
): ThemeDocument {
  const existing = document_.globals?.[group]?.[key];

  if (existing === undefined || name.length === 0 || existing.name === name) {
    return document_;
  }

  return withGroup(document_, group, {
    ...document_.globals?.[group],
    [key]: { ...existing, name },
  });
}

/**
 * Changes a token's key, rewriting every reference to it.
 *
 * Insertion order is preserved rather than moving the renamed token to the end,
 * because the panel lists tokens in document order and a rename that reorders
 * the list makes the row jump away from the cursor.
 */
export function rekeyGlobal(
  document_: ThemeDocument,
  group: GlobalGroupName,
  key: string,
  nextKey: string,
): ThemeDocument {
  const entries = document_.globals?.[group];
  const existing = entries?.[key];

  if (
    entries === undefined ||
    existing === undefined ||
    key === nextKey ||
    !isValidGlobalKey(nextKey) ||
    entries[nextKey] !== undefined
  ) {
    return document_;
  }

  const renamed = Object.fromEntries(
    Object.entries(entries).map(([current, entry]) =>
      current === key ? [nextKey, entry] : [current, entry],
    ),
  );

  const from = `${group}.${key}` as GlobalRef;
  const to = `${group}.${nextKey}` as GlobalRef;

  const rewritten = mapStyleValues(withGroup(document_, group, renamed), (value) =>
    value.ref === from ? { ref: to } : value,
  );

  return rewritten;
}

/**
 * Removes an **unreferenced** token, and refuses a referenced one.
 *
 * ## This behaviour changed, and the old reasoning is worth keeping
 *
 * It used to *inline* the token's resolved value into every reference, argued
 * as the only defensible option of three: refusing made removal "a manual hunt
 * through the document, and there is no UI that lists the sites", and deleting
 * without inlining writes a theme that renders wrong.
 *
 * Spec 0011 D3 removed the premise. Colour and typography are theme-level only,
 * so an element **cannot** hold a literal colour — inlining would now write
 * exactly the document the format forbids, silently, on every referencing node.
 * So: **deletion demands reassignment** (user, 2026-09-13).
 *
 * The old objection is also no longer true. `collectGlobalUsage` gives every
 * token its reference count and the globals panel shows it, so an author can
 * see what is blocking a deletion before attempting it.
 *
 * Refusing is the more honest failure too: inlining *looked* like nothing
 * happened, because the rendering is identical by design, while quietly
 * detaching every element from the token an author was reorganising.
 */
export function deleteGlobal(
  document_: ThemeDocument,
  group: GlobalGroupName,
  key: string,
): ThemeDocument {
  const entries = document_.globals?.[group];
  const existing = entries?.[key];

  if (entries === undefined || existing === undefined) {
    return document_;
  }

  // `referencesTo` rather than a local walk. A global is referenced from FIVE
  // sites — artboard background and bar colour, node styles, text run styles
  // and image monochrome — and `visitStyleValues` is the single walk that knows
  // all five. A second, narrower walk here would have missed run styles and
  // monochrome, allowing exactly the dangling reference this guard exists to
  // prevent.
  if (referencesTo(document_, `${group}.${key}` as GlobalRef).length > 0) {
    return document_;
  }

  const { [key]: _removed, ...rest } = entries;

  return withGroup(document_, group, rest);
}

/** Replaces one global group, dropping it entirely when it becomes empty. */
function withGroup(
  document_: ThemeDocument,
  group: GlobalGroupName,
  entries: Record<string, GlobalEntry>,
): ThemeDocument {
  const globals = { ...document_.globals };

  if (Object.keys(entries).length === 0) {
    // An empty object would serialise as `"palette": {}`, which is valid and
    // says nothing. Absence is the honest representation.
    delete globals[group];
  } else {
    globals[group] = entries;
  }

  if (Object.keys(globals).length === 0) {
    const { globals: _dropped, ...withoutGlobals } = document_;

    return withoutGlobals;
  }

  return { ...document_, globals };
}

/** One place a {@link StyleValue} lives. */
interface StyleSite {
  readonly nodeId?: string;
  readonly where: string;
}

type StyleVisitor = (value: StyleValue, site: StyleSite) => StyleValue;

/**
 * Reads every style value in the document.
 *
 * Implemented as a fold over {@link mapStyleValues} so there is one walk rather
 * than two that can disagree about where references live.
 */
function visitStyleValues(document_: ThemeDocument, visitor: StyleVisitor): void {
  mapStyleValues(document_, visitor);
}

/**
 * Rewrites every style value in the document.
 *
 * Returns the same document by reference when the visitor changed nothing, and
 * shares every untouched branch — so an undo entry for "delete one token" costs
 * the nodes that actually referenced it and nothing else.
 */
function mapStyleValues(document_: ThemeDocument, visitor: StyleVisitor): ThemeDocument {
  let changed = false;

  const visit = (value: StyleValue, site: StyleSite): StyleValue => {
    const next = visitor(value, site);

    if (next !== value) {
      changed = true;
    }

    return next;
  };

  const mapMap = (style: StyleMap | undefined, site: StyleSite): StyleMap | undefined => {
    if (style === undefined) {
      return undefined;
    }

    let dirty = false;
    const result: Record<string, StyleValue> = {};

    for (const [property, value] of Object.entries(style)) {
      const next = visit(value, { ...site, where: `${site.where} ${property}` });
      result[property] = next;

      if (next !== value) {
        dirty = true;
      }
    }

    return dirty ? result : style;
  };

  const mapNode = (node: ThemeNode): ThemeNode => {
    const label = nodeLabel(node);
    let next = node;

    const style = mapMap(node.style, { nodeId: node.id, where: label });

    if (style !== node.style) {
      next = { ...next, style } as ThemeNode;
    }

    if (next.type === 'text') {
      let runsDirty = false;
      const runs = next.content.runs.map((run, index) => {
        const runStyle = mapMap(run.style, {
          nodeId: node.id,
          where: `${label} run ${index + 1}`,
        });

        if (runStyle === run.style) {
          return run;
        }

        runsDirty = true;

        return { ...run, style: runStyle };
      });

      if (runsDirty) {
        next = { ...next, content: { ...next.content, runs } } as ThemeNode;
      }
    }

    if (next.type === 'image' && next.content.monochrome !== undefined) {
      const monochrome = visit(next.content.monochrome, {
        nodeId: node.id,
        where: `${label} monochrome`,
      });

      if (monochrome !== next.content.monochrome) {
        next = { ...next, content: { ...next.content, monochrome } } as ThemeNode;
      }
    }

    if (next.type === 'group') {
      const children = mapNodes(next.children);

      if (children !== next.children) {
        next = { ...next, children } as ThemeNode;
      }
    }

    return next;
  };

  const mapNodes = (nodes: readonly ThemeNode[]): readonly ThemeNode[] => {
    let dirty = false;

    const mapped = nodes.map((node) => {
      const next = mapNode(node);

      if (next !== node) {
        dirty = true;
      }

      return next;
    });

    return dirty ? mapped : nodes;
  };

  const artboard = { ...document_.artboard };
  let artboardDirty = false;

  if (document_.artboard.background !== undefined) {
    const next = visit(document_.artboard.background, { where: 'Artboard background' });

    if (next !== document_.artboard.background) {
      artboard.background = next;
      artboardDirty = true;
    }
  }

  if (document_.artboard.barColor !== undefined) {
    const next = visit(document_.artboard.barColor, { where: 'Artboard bars' });

    if (next !== document_.artboard.barColor) {
      artboard.barColor = next;
      artboardDirty = true;
    }
  }

  const nodes = mapNodes(document_.nodes);

  if (!changed) {
    return document_;
  }

  return {
    ...document_,
    ...(artboardDirty ? { artboard } : {}),
    ...(nodes === document_.nodes ? {} : { nodes }),
  };
}
