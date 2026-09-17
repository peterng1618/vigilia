import type {
  ChartContent,
  StyleMap,
  ThemeDocument,
  ThemeNode,
  Transform,
} from '@vigilia/renderer-core';

/** Pure immutable document edits with structural sharing. */

/** Replace authored chart settings without admitting runtime engine state. */
export function updateChartSettings(
  document: ThemeDocument,
  nodeId: string,
  settings: ChartContent['settings'],
): ThemeDocument {
  return {
    ...document,
    nodes: mapNodes(document.nodes, (node) =>
      node.id === nodeId && node.type === 'chart'
        ? { ...node, content: { ...node.content, settings } as ChartContent }
        : node,
    ),
  };
}

export function updateTransforms(
  document: ThemeDocument,
  transforms: ReadonlyMap<string, Transform>,
): ThemeDocument {
  if (transforms.size === 0) {
    return document;
  }

  return {
    ...document,
    nodes: mapNodes(document.nodes, (node) => {
      const transform = transforms.get(node.id);
      return transform === undefined ? node : { ...node, transform: quantise(transform) };
    }),
  };
}

/** Quantise position/size/rotation to whole units; scales remain fractional. */
function quantise(transform: Transform): Transform {
  const round = (value: number): number => {
    const rounded = Math.round(value);

    return rounded === 0 ? 0 : rounded;
  };

  return {
    ...transform,
    ...(transform.x === undefined ? {} : { x: round(transform.x) }),
    ...(transform.y === undefined ? {} : { y: round(transform.y) }),
    ...(transform.width === undefined ? {} : { width: round(transform.width) }),
    ...(transform.height === undefined ? {} : { height: round(transform.height) }),
    ...(transform.rotation === undefined ? {} : { rotation: round(transform.rotation) }),
  };
}

/** Merge style changes; `undefined` removes the property and restores its default. */
export function updateStyle(
  document: ThemeDocument,
  nodeId: string,
  changes: Readonly<Record<string, StyleMap[string] | undefined>>,
): ThemeDocument {
  return {
    ...document,
    nodes: mapNodes(document.nodes, (node) => {
      if (node.id !== nodeId) {
        return node;
      }

      const style: Record<string, StyleMap[string]> = { ...node.style };

      for (const [property, value] of Object.entries(changes)) {
        if (value === undefined) {
          delete style[property];
        } else {
          style[property] = value;
        }
      }

      return Object.keys(style).length === 0
        ? omitStyle(node)
        : { ...node, style };
    }),
  };
}

export function renameNode(
  document: ThemeDocument,
  nodeId: string,
  name: string,
): ThemeDocument {
  return {
    ...document,
    nodes: mapNodes(document.nodes, (node) =>
      node.id === nodeId ? { ...node, name } : node,
    ),
  };
}

export function setNodeFlags(
  document: ThemeDocument,
  nodeId: string,
  flags: { readonly visible?: boolean; readonly locked?: boolean },
): ThemeDocument {
  return {
    ...document,
    nodes: mapNodes(document.nodes, (node) =>
      node.id === nodeId ? { ...node, ...flags } : node,
    ),
  };
}

/** Removing a group removes its subtree; children are not promoted implicitly. */
export function deleteNodes(
  document: ThemeDocument,
  ids: ReadonlySet<string>,
): ThemeDocument {
  if (ids.size === 0) {
    return document;
  }

  const filter = (nodes: readonly ThemeNode[]): ThemeNode[] =>
    nodes
      .filter((node) => !ids.has(node.id))
      .map((node) =>
        node.type === 'group' ? { ...node, children: filter(node.children) } : node,
      );

  return { ...document, nodes: filter(document.nodes) };
}

/** Insert into a group or root. Omitted index appends at the top of paint order. */
export function insertNodes(
  document: ThemeDocument,
  nodes: readonly ThemeNode[],
  parentId?: string,
  index?: number,
): ThemeDocument {
  if (nodes.length === 0) {
    return document;
  }

  if (parentId === undefined) {
    return { ...document, nodes: spliceInto(document.nodes, nodes, index) };
  }

  return {
    ...document,
    nodes: mapNodes(document.nodes, (node) =>
      node.id === parentId && node.type === 'group'
        ? { ...node, children: spliceInto(node.children, nodes, index) }
        : node,
    ),
  };
}

export type ReorderTarget = 'front' | 'back' | 'forward' | 'backward';

/** Reorder only among siblings; changing parent would also change coordinate space. */
export function reorderNode(
  document: ThemeDocument,
  nodeId: string,
  target: ReorderTarget,
): ThemeDocument {
  const reorder = (nodes: readonly ThemeNode[]): ThemeNode[] | undefined => {
    const index = nodes.findIndex((node) => node.id === nodeId);

    if (index !== -1) {
      const next = [...nodes];
      const [node] = next.splice(index, 1);

      if (node === undefined) {
        return undefined;
      }

      const destination = {
        front: nodes.length - 1,
        back: 0,
        forward: Math.min(index + 1, nodes.length - 1),
        backward: Math.max(index - 1, 0),
      }[target];

      next.splice(destination, 0, node);
      return next;
    }

    let changed = false;
    const mapped = nodes.map((node) => {
      if (node.type !== 'group' || changed) {
        return node;
      }

      const children = reorder(node.children);

      if (children === undefined) {
        return node;
      }

      changed = true;
      return { ...node, children };
    });

    return changed ? mapped : undefined;
  };

  const nodes = reorder(document.nodes);

  return nodes === undefined ? document : { ...document, nodes };
}

export function findNode(
  nodes: readonly ThemeNode[],
  id: string,
): ThemeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    if (node.type === 'group') {
      const found = findNode(node.children, id);
      if (found !== undefined) {
        return found;
      }
    }
  }

  return undefined;
}

export function collectIds(nodes: readonly ThemeNode[]): Set<string> {
  const ids = new Set<string>();

  const walk = (list: readonly ThemeNode[]): void => {
    for (const node of list) {
      ids.add(node.id);
      if (node.type === 'group') {
        walk(node.children);
      }
    }
  };

  walk(nodes);

  return ids;
}

/** Preserve array identity when no descendant changes. */
function mapNodes(
  nodes: readonly ThemeNode[],
  change: (node: ThemeNode) => ThemeNode,
): readonly ThemeNode[] {
  let changed = false;

  const mapped = nodes.map((node) => {
    const updated = change(node);

    if (updated.type === 'group') {
      const children = mapNodes(updated.children, change);

      if (children !== updated.children) {
        changed = true;
        return { ...updated, children };
      }
    }

    if (updated !== node) {
      changed = true;
    }

    return updated;
  });

  return changed ? mapped : nodes;
}

function spliceInto(
  existing: readonly ThemeNode[],
  inserted: readonly ThemeNode[],
  index?: number,
): ThemeNode[] {
  const at = index === undefined ? existing.length : Math.max(0, Math.min(index, existing.length));
  const next = [...existing];
  next.splice(at, 0, ...inserted);
  return next;
}

/** Drop `style` entirely rather than persisting an empty map. */
function omitStyle(node: ThemeNode): ThemeNode {
  const { style: _style, ...rest } = node as ThemeNode & { style?: StyleMap };
  return rest as ThemeNode;
}
