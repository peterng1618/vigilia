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
