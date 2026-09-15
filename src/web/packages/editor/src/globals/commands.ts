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

/** Pure global-token edits. One walker owns every reference site (§73, §75). */

export interface GlobalReference {
  readonly nodeId?: string;
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

/** Generate a free valid key for one-click token creation. */
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

  return base;
}

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

/** Every document site that references one token. */
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

/** Refuse invalid/duplicate keys; adding must never overwrite an existing token. */
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

/** Display-name changes do not affect key-based references. */
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

/** Change the reference key everywhere while preserving group insertion order. */
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

/** Referenced tokens cannot be deleted until reassigned; literals are not a fallback. */
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

  if (referencesTo(document_, `${group}.${key}` as GlobalRef).length > 0) {
    return document_;
  }

  const { [key]: _removed, ...rest } = entries;

  return withGroup(document_, group, rest);
}

/** Replace a group; omit empty group/global objects from persisted state. */
function withGroup(
  document_: ThemeDocument,
  group: GlobalGroupName,
  entries: Record<string, GlobalEntry>,
): ThemeDocument {
  const globals = { ...document_.globals };

  if (Object.keys(entries).length === 0) {
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

interface StyleSite {
  readonly nodeId?: string;
  readonly where: string;
}

type StyleVisitor = (value: StyleValue, site: StyleSite) => StyleValue;

/** Read through the same walker used for rewrites so reference-site coverage cannot drift. */
function visitStyleValues(document_: ThemeDocument, visitor: StyleVisitor): void {
  mapStyleValues(document_, visitor);
}

/** Rewrite every style-value site, preserving identity for untouched branches. */
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
