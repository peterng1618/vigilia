import {
  ChartColumn,
  Eye,
  EyeOff,
  Folder,
  Image as ImageIcon,
  Lock,
  type LucideIcon,
  Square,
  Type as TypeIcon,
  Unlock,
} from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useSyncExternalStore } from "react";
import { uiCopy } from "../ui-copy.js";
import type { EditorShellBridge } from "./bridge.js";
import type { LayerKind, LayerRow } from "./layer-tree.js";

const KIND_ICONS: Readonly<Record<LayerKind, LucideIcon>> = {
  text: TypeIcon,
  shape: Square,
  chart: ChartColumn,
  group: Folder,
  image: ImageIcon,
};

/** Selection is external mutable state and Fabric owns it, so the projection is
 * cached rather than rebuilt per `getSnapshot`: React compares snapshots with
 * `Object.is`, and a fresh array each call re-renders forever. */
class LayerStore {
  #bridge: EditorShellBridge | undefined;
  readonly #listeners = new Set<() => void>();
  #rows: readonly LayerRow[] = [];
  #unsubscribe: (() => void) | undefined;

  set(bridge: EditorShellBridge | undefined): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#bridge = bridge;
    if (bridge !== undefined) {
      this.#rows = bridge.layers();
      this.#unsubscribe = bridge.subscribe(() => {
        this.#rows = bridge.layers();
        this.#publish();
      });
    } else {
      this.#rows = [];
    }
    this.#publish();
  }

  /** Run a bridge command and re-read the projection it changed. The bridge also
   * notifies, but a command that ever stopped notifying would otherwise leave
   * the panel showing state it had just changed. */
  mutate(action: () => void): void {
    action();
    if (this.#bridge !== undefined) this.#rows = this.#bridge.layers();
    this.#publish();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly get = (): readonly LayerRow[] => this.#rows;

  #publish(): void {
    for (const listener of this.#listeners) listener();
  }
}

/** One dense row per layer: type icon, name, and the two state icons. */
export function LayerPanel({
  bridge,
}: {
  readonly bridge: EditorShellBridge | undefined;
}): React.JSX.Element {
  const ref = useRef<LayerStore | null>(null);
  if (ref.current === null) ref.current = new LayerStore();
  const store = ref.current;
  const rows = useSyncExternalStore(store.subscribe, store.get, store.get);
  useEffect(() => store.set(bridge), [store, bridge]);

  const [editing, setEditing] = useState<string | undefined>(undefined);
  const cancelled = useRef(false);

  const commit = (id: string, name: string): void => {
    setEditing(undefined);
    store.mutate(() => bridge?.renameLayer(id, name));
  };

  return (
    <section data-vigilia-panel="layers">
      <h2>{uiCopy.panels.layers}</h2>
      <div role="tree" aria-label={uiCopy.panels.layers}>
        {rows.map((row) => {
          const Icon = KIND_ICONS[row.kind];
          const twisty = row.collapsed ? uiCopy.panels.expand : uiCopy.panels.collapse;
          return (
            <div
              key={row.id}
              className="vigilia-layer-row"
              data-vigilia-layer={row.id}
              data-selected={row.selected}
              role="treeitem"
              aria-selected={row.selected}
              aria-level={row.depth + 1}
              title={row.id}
              style={
                {
                  "--layer-depth": String(row.depth),
                  paddingLeft: "calc(6px + var(--layer-depth) * 13px)",
                } as CSSProperties
              }
              onClick={() => store.mutate(() => bridge?.selectLayer(row.id))}
              onDoubleClick={() => {
                cancelled.current = false;
                setEditing(row.id);
              }}
            >
              {row.hasChildren ? (
                <button
                  type="button"
                  aria-label={`${twisty} ${row.name}`}
                  aria-expanded={!row.collapsed}
                  onClick={(event) => {
                    event.stopPropagation();
                    store.mutate(() => bridge?.setCollapsed(row.id, !row.collapsed));
                  }}
                >
                  {row.collapsed ? "▸" : "▾"}
                </button>
              ) : (
                <span aria-hidden className="vigilia-layer-twisty" />
              )}
              <Icon aria-hidden size={13} strokeWidth={1.75} />
              {editing === row.id ? (
                <input
                  // biome-ignore lint/a11y/noAutofocus: the field only exists because the author double-clicked the row.
                  autoFocus
                  className="vigilia-layer-rename"
                  aria-label={`${uiCopy.panels.rename} ${row.name}`}
                  defaultValue={row.name}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={(event) => {
                    if (cancelled.current) {
                      cancelled.current = false;
                      return;
                    }
                    commit(row.id, event.currentTarget.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commit(row.id, event.currentTarget.value);
                    else if (event.key === "Escape") {
                      cancelled.current = true;
                      setEditing(undefined);
                    }
                  }}
                />
              ) : (
                <span className="vigilia-layer-name">{row.name}</span>
              )}
              <button
                type="button"
                aria-label={row.visible ? uiCopy.panels.hide : uiCopy.panels.show}
                aria-pressed={row.visible}
                onClick={(event) => {
                  event.stopPropagation();
                  store.mutate(() => bridge?.setLayerVisible(row.id, !row.visible));
                }}
              >
                {row.visible ? (
                  <Eye aria-hidden size={13} strokeWidth={1.75} />
                ) : (
                  <EyeOff aria-hidden size={13} strokeWidth={1.75} />
                )}
              </button>
              <button
                type="button"
                aria-label={row.locked ? uiCopy.actions.unlock : uiCopy.actions.lock}
                aria-pressed={row.locked}
                onClick={(event) => {
                  event.stopPropagation();
                  store.mutate(() => bridge?.setLayerLocked(row.id, !row.locked));
                }}
              >
                {row.locked ? (
                  <Lock aria-hidden size={13} strokeWidth={1.75} />
                ) : (
                  <Unlock aria-hidden size={13} strokeWidth={1.75} />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
