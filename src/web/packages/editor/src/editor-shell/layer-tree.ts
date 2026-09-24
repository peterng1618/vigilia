import { VigiliaChart } from "@vigilia/scene-fabric";
import { type FabricObject, Group } from "fabric/es";

export type LayerKind = "text" | "shape" | "chart" | "group" | "image";

export interface LayerRow {
  readonly id: string;
  readonly name: string;
  readonly kind: LayerKind;
  readonly depth: number;
  readonly parentId: string | undefined;
  readonly hasChildren: boolean;
  /** Shut by the author, so the twisty can offer the other direction. */
  readonly collapsed: boolean;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly selected: boolean;
}

const ANONYMOUS_ID = "unidentified";

/** Ids for id-less objects still have to be distinct, so the first keeps the
 * plain fallback and the rest are suffixed by walk position. That makes the
 * scheme order-dependent: every walk here reverses the same way. */
function layerIds(): (object: FabricObject) => string {
  let count = 0;
  return (object) => {
    const raw = (object as { id?: string }).id;
    if (raw !== undefined) return raw;
    count += 1;
    return count === 1 ? ANONYMOUS_ID : `${ANONYMOUS_ID}#${count}`;
  };
}

/** Empty rows help nobody, so a nameless row falls back to its kind. */
const kindLabels: Readonly<Record<LayerKind, string>> = {
  text: "Text",
  shape: "Shape",
  chart: "Chart",
  group: "Group",
  image: "Image",
};

/** Fabric type tags are lowercase class names; the envelope keeps "VigiliaChart". */
function kindOf(object: FabricObject): LayerKind {
  if (object instanceof VigiliaChart) return "chart";
  if (object instanceof Group) return "group";
  const type = (object as { type?: string }).type;
  if (type === "textbox" || type === "i-text" || type === "text") return "text";
  if (type === "image") return "image";
  return "shape";
}

function nameOf(
  id: string,
  names: Readonly<Record<string, string>>,
  kind: LayerKind,
): string {
  const stored = names[id];
  if (stored !== undefined && stored.trim() !== "") return stored;
  if (id.trim() !== "") return id;
  return kindLabels[kind];
}

/** Projects Fabric's current hierarchy without maintaining a second scene tree. */
export function projectLayers({
  root,
  selected,
  names,
  collapsed,
}: {
  readonly root: readonly FabricObject[];
  readonly selected: readonly FabricObject[];
  readonly names: Readonly<Record<string, string>>;
  readonly collapsed: ReadonlySet<string>;
}): readonly LayerRow[] {
  const rows: LayerRow[] = [];
  const idOf = layerIds();
  const walk = (
    objects: readonly FabricObject[],
    depth: number,
    ancestors: readonly FabricObject[],
    parentId: string | undefined,
  ): void => {
    for (const object of [...objects].reverse()) {
      const id = idOf(object);
      const kind = kindOf(object);
      const path = [...ancestors, object];
      const isGroup = object instanceof Group;
      const isCollapsed = collapsed.has(id);
      rows.push({
        id,
        name: nameOf(id, names, kind),
        kind,
        depth,
        parentId,
        hasChildren: isGroup && object.getObjects().length > 0,
        collapsed: isCollapsed,
        visible: path.every((entry) => entry.visible),
        locked: path.some(
          (entry) => (entry as { locked?: boolean }).locked === true,
        ),
        selected: selected.includes(object),
      });
      if (isGroup && !isCollapsed)
        walk(object.getObjects(), depth + 1, path, id);
    }
  };
  walk(root, 0, [], undefined);
  return rows;
}

/** The object a row id names, in the same paint-order walk `projectLayers`
 * uses so the anonymous fallback ids resolve to the same objects the panel
 * rendered. */
export function findById(
  root: readonly FabricObject[],
  id: string,
): FabricObject | undefined {
  const idOf = layerIds();
  const search = (
    objects: readonly FabricObject[],
  ): FabricObject | undefined => {
    for (const object of [...objects].reverse()) {
      if (idOf(object) === id) return object;
      if (object instanceof Group) {
        const found = search(object.getObjects());
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  return search(root);
}

/** The owning Group of an id, or undefined for a top-level object. Read from
 * the tree rather than Fabric's `object.group`, which an active selection
 * temporarily repoints at the selection itself. */
export function ownerOf(
  root: readonly FabricObject[],
  id: string,
): Group | undefined {
  const path = pathTo(root, id);
  const parent = path[path.length - 2];
  return parent instanceof Group ? parent : undefined;
}

/** Every object from the root down to the id, root first. */
export function pathTo(
  root: readonly FabricObject[],
  id: string,
): readonly FabricObject[] {
  const idOf = layerIds();
  const search = (
    objects: readonly FabricObject[],
    path: readonly FabricObject[],
  ): readonly FabricObject[] | undefined => {
    for (const object of [...objects].reverse()) {
      const next = [...path, object];
      if (idOf(object) === id) return next;
      if (object instanceof Group) {
        const found = search(object.getObjects(), next);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  return search(root, []) ?? [];
}
