import { type FabricObject, Group } from "fabric/es";

/** Scene objects that are decoration rather than alignable content. The
 * artboard plate spans the whole artboard, so it is "aligned" with every object
 * on the cross axis and its stroke edges sit half a pixel outside the true
 * artboard bounds, winning boundary snaps over the artboard's own source.
 * It is excluded by id — `background` is the plate's conventional id, which
 * the starter used to author and an author can still draw — not by
 * `selectable`, which would also drop locked neighbours. The starter no longer
 * authors one: its backdrop is packaged media mounted below the canvas
 * (`docs/decisions/0011`), so nothing on the canvas spans the artboard. */
export const IGNORED_IDS: readonly string[] = ["background"];

/** The objects one group holds; every other object holds none. The one reader
 * of the scene tree, shared by the exclusion walk and candidate collection. */
export const partsOf = (object: FabricObject): readonly FabricObject[] =>
  object instanceof Group ? object.getObjects() : [];

/** Adds every object below `object`, at any depth. */
function collectParts({
  object,
  into,
}: {
  object: FabricObject;
  into: Set<FabricObject>;
}): void {
  for (const part of partsOf(object)) {
    into.add(part);
    collectParts({ object: part, into });
  }
}

/** Collects the set of objects excluded from processing.
 *
 * The dragged object's own ancestors and its own parts are both excluded
 * (`vg-123`): a group's box is the box of the parts it holds, and a group
 * wrapped around a single part has exactly that part's box, so either end of
 * the tree hands the dragged object its own lines back as a candidate and pins
 * the drag wherever it starts. Neither end was reachable while the candidate
 * set was roots. */
export const collectExcludedObjects = ({
  activeObject,
}: {
  activeObject?: FabricObject | null;
}): Set<FabricObject> => {
  const excluded = new Set<FabricObject>();

  if (!activeObject) return excluded;

  excluded.add(activeObject);
  // Fabric keeps the owning group on `parent`, and a group can itself sit in
  // one, so the whole chain is walked rather than a single hop.
  for (
    let ancestor = activeObject.parent;
    ancestor !== undefined;
    ancestor = ancestor.parent
  ) {
    excluded.add(ancestor);
  }
  collectParts({ object: activeObject, into: excluded });

  return excluded;
};

/** Decides whether an object is excluded as a snap target. */
export const shouldIgnoreObject = ({
  object,
  excluded,
  ignoredIds = IGNORED_IDS,
}: {
  object: FabricObject;
  excluded: Set<FabricObject>;
  ignoredIds?: readonly string[];
}): boolean => {
  if (excluded.has(object)) return true;

  const { visible = true } = object;
  if (!visible) return true;

  const { id } = object as FabricObject & { id?: string };
  if (id && ignoredIds.includes(id)) return true;

  return false;
};
