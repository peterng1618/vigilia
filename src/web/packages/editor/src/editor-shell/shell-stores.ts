import { useSyncExternalStore } from "react";
import type { EditorShellBridge, EditorShellSnapshot } from "./bridge.js";

/** The shell snapshot as external mutable state — the selection, which Fabric
 * owns, and the document's identity, which the session does — so every reader
 * shares one subscription and a late-set bridge still propagates. */
export class SelectionStore {
  #bridge: EditorShellBridge | undefined;
  readonly #listeners = new Set<() => void>();
  #snapshot: EditorShellSnapshot = {
    selectedCount: 0,
    locked: false,
    activeKind: "none",
    documentName: undefined,
    selectionPresetId: undefined,
  };
  #unsubscribe: (() => void) | undefined;

  set(bridge: EditorShellBridge | undefined): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#bridge = bridge;
    if (bridge !== undefined) {
      this.#snapshot = bridge.snapshot();
      this.#unsubscribe = bridge.subscribe(() => {
        this.#snapshot = bridge.snapshot();
        for (const listener of this.#listeners) listener();
      });
    } else {
      this.#snapshot = {
        selectedCount: 0,
        locked: false,
        activeKind: "none",
        documentName: undefined,
        selectionPresetId: undefined,
      };
    }
    for (const listener of this.#listeners) listener();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly get = (): EditorShellSnapshot => this.#snapshot;

  get bridge(): EditorShellBridge | undefined {
    return this.#bridge;
  }
}

export function useSelection(store: SelectionStore): EditorShellSnapshot {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Whether the `?` sheet is open, as external state.
 *
 * The dispatcher lives in `EditorSession`, which never sees React, so the
 * gesture has to reach the chrome through a subscription rather than a prop —
 * the same shape `SelectionStore` has, for the same reason.
 */
export class SheetStore {
  #open = false;
  readonly #listeners = new Set<() => void>();
  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  readonly get = (): boolean => this.#open;
  set(open: boolean): void {
    if (this.#open === open) return;
    this.#open = open;
    for (const listener of this.#listeners) listener();
  }
}

export function useSheet(store: SheetStore): boolean {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Whether the publish surface is open, as external state.
 *
 * The header's chord is dispatched by `EditorSession`, which never sees React,
 * so it reaches the popover the same way `?` reaches the sheet: a store the
 * component subscribes to. It holds the popover's open flag, so the chord and
 * the control's own press drive one surface rather than two.
 */
export class PublishSurfaceStore {
  #open = false;
  readonly #listeners = new Set<() => void>();
  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  readonly get = (): boolean => this.#open;
  set(open: boolean): void {
    if (this.#open === open) return;
    this.#open = open;
    for (const listener of this.#listeners) listener();
  }
}
