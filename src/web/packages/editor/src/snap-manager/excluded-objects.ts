import { ActiveSelection, type FabricObject } from "fabric/es";

/** Scene objects that are decoration rather than alignable content. The
 * artboard plate spans the whole artboard, so it is "aligned" with every object
 * on the cross axis and its stroke edges sit half a pixel outside the true
 * artboard bounds, winning boundary snaps over the artboard's own source.
 * It is excluded by id — `background` is the plate's real id in
 * new-fabric-theme.ts — not by `selectable`, which would also drop locked
 * neighbours. */
export const IGNORED_IDS: readonly string[] = ["background"];

/** Collects the set of objects excluded from processing. */
export const collectExcludedObjects = ({
  activeObject,
}: {
  activeObject?: FabricObject | null;
}): Set<FabricObject> => {
  const excluded = new Set<FabricObject>();

  if (!activeObject) return excluded;

  excluded.add(activeObject);

  if (activeObject instanceof ActiveSelection) {
    activeObject.getObjects().forEach((object) => excluded.add(object));
  }

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
