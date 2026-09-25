import { ActiveSelection, type FabricObject } from "fabric/es";

/** Scene objects that are decoration rather than alignable content. The
 * artboard plate spans the whole artboard, so its centre would otherwise snap
 * every centred object; see new-fabric-theme.ts's `backgroundOnly`. */
export const IGNORED_IDS: readonly string[] = ["scene"];

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
