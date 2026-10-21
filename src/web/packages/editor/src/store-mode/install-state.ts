import type { StoreItem } from "./local-source.js";

/**
 * What the online half's action slot draws for one item.
 *
 * `none` means the item carries no catalogue facts — a library item, which
 * draws the local half's four actions instead — so it is not a state the online
 * slot ever draws.
 */
export type InstallState = "none" | "installed" | "update" | "install";

/**
 * The one owner of the install decision.
 *
 * **The comparison is against the item's own version, and an unknown is not an
 * equal.** A catalogue fact that says a copy is installed at `1.4.0` and an item
 * that reports no version of its own cannot be the same version, so the answer
 * is `update` rather than `installed` — the library copy cannot be shown to
 * match what the catalogue holds.
 */
export function installStateOf(item: StoreItem): InstallState {
  const catalogue = item.catalogue;
  if (catalogue === undefined) return "none";
  const installedVersion = catalogue.installedVersion;
  if (installedVersion === undefined) return "install";
  return installedVersion === item.version ? "installed" : "update";
}

/**
 * The catalogue's items, each carrying what this PC installed for it.
 *
 * **The version comes off the library item's origin record, not off the
 * document.** An origin says which catalogue version this copy was installed
 * from; the document's own version moves as the author edits it, so reading the
 * document would call an edited copy *Installed* against a catalogue that had
 * moved on. **No comparison happens here** — `installStateOf` owns it, and a
 * second one would be the two owners this file exists to prevent.
 *
 * No local match, or no local listing at all, leaves `installedVersion` absent:
 * `undefined` is the truth this PC installed nothing.
 */
export function withInstalledVersions(
  online: readonly StoreItem[],
  local: readonly StoreItem[] | undefined,
): readonly StoreItem[] {
  const installed = new Map<string, string>();
  for (const item of local ?? []) {
    const origin = item.origin;
    if (origin !== undefined) installed.set(origin.catalogueId, origin.version);
  }

  return online.map((item) => {
    const installedVersion = installed.get(item.id);
    if (installedVersion === undefined || item.catalogue === undefined) {
      return item;
    }
    return {
      ...item,
      catalogue: { ...item.catalogue, installedVersion },
    };
  });
}
