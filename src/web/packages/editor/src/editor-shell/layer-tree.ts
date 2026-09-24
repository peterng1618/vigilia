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
  readonly visible: boolean;
  readonly locked: boolean;
  readonly selected: boolean;
}

const ANONYMOUS_ID = "unidentified";

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
  // Id-less objects still need distinct row ids: later tasks select and reorder
  // by id, so two rows sharing "unidentified" would only be distinguishable by
  // index. The first keeps the plain fallback; the rest are suffixed by walk
  // position.
  let anonymousCount = 0;
  const idOf = (object: FabricObject): string => {
    const raw = (object as { id?: string }).id;
    if (raw !== undefined) return raw;
    anonymousCount += 1;
    return anonymousCount === 1
      ? ANONYMOUS_ID
      : `${ANONYMOUS_ID}#${anonymousCount}`;
  };
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
      rows.push({
        id,
        name: nameOf(id, names, kind),
        kind,
        depth,
        parentId,
        hasChildren: isGroup && object.getObjects().length > 0,
        visible: path.every((entry) => entry.visible),
        locked: path.some(
          (entry) => (entry as { locked?: boolean }).locked === true,
        ),
        selected: selected.includes(object),
      });
      if (isGroup && !collapsed.has(id))
        walk(object.getObjects(), depth + 1, path, id);
    }
  };
  walk(root, 0, [], undefined);
  return rows;
}
