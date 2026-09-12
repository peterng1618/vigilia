import type {
  StyleMap,
  ThemeDocument,
  ThemeNode,
  Transform,
} from '@vigilia/renderer-core';

/**
 * Document edits, as pure functions.
 *
 * Every edit returns a **new** document and leaves the old one untouched, which
 * is what makes undo a matter of keeping the previous value rather than
 * computing an inverse. Inverse operations are where undo implementations go
 * wrong: "un-delete" has to restore a node *and* its position among its
 * siblings *and* anything that referenced it, and each of those is a separate
 * chance to be subtly wrong. Keeping whole documents costs memory and cannot be
 * subtly wrong.
 *
 * ## Structural sharing, not deep cloning
 *
 * Only the nodes on the path to a change are rebuilt; untouched subtrees are
 * reused by reference. A theme is bounded at 5000 nodes, so a naive deep clone
 * per keystroke would be affordable — but reference equality is what lets a UI
 * skip re-rendering a panel that did not change, and that matters more than the
 * allocation.
 */

/** Replaces the transforms of several nodes at once. */
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
      return transform === undefined ? node : { ...node, transform };
    }),
  };
}

/**
 * Merges style properties into a node, or removes them.
 *
 * A property set to `undefined` is **deleted** rather than stored, because
 * `{ ref: undefined }` is not a valid style value (§75 requires exactly one of
 * `ref` or `value`) and storing it would fail validation on save. This is how
 * an inspector expresses "back to the default".
 */
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

      // An empty style map is dropped so a saved document does not carry
      // `"style": {}` on every node an author touched and reverted.
      return Object.keys(style).length === 0
        ? omitStyle(node)
        : { ...node, style };
    }),
  };
}

/** Renames a node's display name. Its id never changes (§75). */
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

/** Sets visibility or lock state. */
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

/**
 * Removes nodes, wherever they are in the tree.
 *
 * Removing a group removes its children with it — they cannot exist without a
 * parent, and promoting them would silently change the design.
 */
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

/**
 * Inserts nodes into a parent at an index.
 *
 * @param parentId The group to insert into, or undefined for the document root.
 * @param index Where among the siblings, or undefined for last — which is
 *   **topmost**, because child order is paint order (§137). "Last" is what a
 *   paste or a new element should be: on top, where the author can see it.
 */
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

/** Where a node can be moved to in the stacking order. */
export type ReorderTarget = 'front' | 'back' | 'forward' | 'backward';

/**
 * Changes a node's position among its siblings (§137).
 *
 * Only among its **siblings**: moving a node between parents is a different
 * operation, because it changes the coordinate space the node's transform is
 * expressed in, and doing both at once would move the node on screen while
 * claiming to reorder it.
 */
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

    // Not at this level — recurse, and rebuild only the branch that changed.
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

/** Finds a node anywhere in the tree. */
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

/** Every node id in the document, for pruning a selection. */
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

/**
 * Rebuilds the tree, applying `change` to every node.
 *
 * Returns the original array when nothing changed, so reference equality
 * survives a no-op edit — which is what lets a UI skip re-rendering.
 */
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

/** Drops the `style` key entirely, which `delete` on a spread cannot express cleanly. */
function omitStyle(node: ThemeNode): ThemeNode {
  const { style: _style, ...rest } = node as ThemeNode & { style?: StyleMap };
  return rest as ThemeNode;
}
