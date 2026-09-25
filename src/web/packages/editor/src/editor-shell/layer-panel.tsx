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
import { actionEnabled, OBJECT_ACTIONS } from "../object-actions.js";
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

/** Paired with `.vigilia-layer-row`'s height in `editor-shell.css`. */
const ROW_HEIGHT = 24;

/** The entered group and everything under it. The projection emits a parent
 * before its children, so one forward pass reaches any depth — and a row whose
 * group is not in the tree (a collapsed ancestor) is simply not marked. */
function contextRows(
  rows: readonly LayerRow[],
  entered: readonly string[],
): ReadonlySet<string> {
  const context = new Set(entered);
  for (const row of rows)
    if (row.parentId !== undefined && context.has(row.parentId))
      context.add(row.id);
  return context;
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
  // Read at render, not mirrored into state: the store re-reads the projection
  // and publishes on every selection change, so entering a group re-renders
  // here with the context the manager has already recorded.
  const context = contextRows(rows, bridge?.groupContext() ?? []);

  const [editing, setEditing] = useState<string | undefined>(undefined);
  const cancelled = useRef(false);

  // The drag's own state, not React's: a ref set mid-gesture lands without a
  // re-render, so a drop that follows within the same frame cannot see the
  // stale value a state update would leave behind.
  const drag = useRef<{ from: string; before: string | undefined } | undefined>(
    undefined,
  );
  // One line for the whole tree: the browser applies it to whatever element is
  // under the cursor, which is exactly the slot that would take the drop.
  const indicator = useRef<HTMLDivElement | null>(null);

  const commit = (id: string, name: string): void => {
    setEditing(undefined);
    store.mutate(() => bridge?.renameLayer(id, name));
  };

  return (
    <section data-vigilia-panel="layers">
      <h2>{uiCopy.panels.layers}</h2>
      <div role="tree" aria-label={uiCopy.panels.layers}>
        {rows.map((row, index) => {
          const Icon = KIND_ICONS[row.kind];
          const twisty = row.collapsed ? uiCopy.panels.expand : uiCopy.panels.collapse;
          return (
            <div
              // The row's own id is not unique once an object moves: a stale
              // projection can hold one id twice, and a duplicate key makes
              // React reuse the wrong row. Slot identity is what re-renders.
              key={`${row.id}#${index}`}
              className="vigilia-layer-row"
              data-vigilia-layer={row.id}
              data-selected={row.selected}
              // The entered group and its descendants are what a tree click can
              // reach on its own; everything else is dimmed to say so. With no
              // group entered there is no context to be outside of, so the
              // attribute is omitted rather than written false: React renders a
              // boolean `data-*` as the string "false", which is the value the
              // stylesheet rule dims on, and a tree greyed out on open would
              // claim every selectable top-level layer is unreachable.
              data-context={context.size > 0 ? context.has(row.id) : undefined}
              role="treeitem"
              aria-selected={row.selected}
              aria-level={row.depth + 1}
              // Roving tabindex would be the roving-focus ideal, but every row
              // here is cheap and the shell has no global key handler to own
              // the roving state, so all rows stay tabbable.
              tabIndex={0}
              title={row.id}
              // A row being renamed is a text field: its own drag gesture is
              // selecting text, not restacking the layer.
              draggable={editing !== row.id}
              onDragStart={(event) => {
                // Chrome will not start a drag without payload, and one of our
                // own rows is the only thing that may start one.
                event.dataTransfer.setData("application/x-vigilia-layer", row.id);
                drag.current = { from: row.id, before: undefined };
              }}
              // The row is the drop slot's height, so the browser pointing its
              // drop indicator at this row is the same thing as a pointer aimed
              // between this row and the one above it.
              onDragOver={(event) => {
                const active = drag.current;
                if (active === undefined) return;
                // A permanent marker reads as state, not as a target.
                event.preventDefault();
                if (active.before === row.id) return;
                // Not above ourselves: that is where the layer already is.
                const moved = row.id !== active.from;
                // Nothing marked outside one parent — the bridge would refuse
                // it, and a marker there would promise a drop that cannot land.
                active.before = moved && bridge?.sameLayerParent(active.from, row.id)
                  ? row.id
                  : undefined;
                const line = indicator.current;
                if (line === null || !moved) return;
                line.hidden = active.before === undefined;
                if (active.before === undefined) return;
                line.style.setProperty(
                  "--layer-dropline-top",
                  String(index * ROW_HEIGHT),
                );
                line.style.setProperty(
                  "--layer-dropline-left",
                  String(6 + row.depth * 13),
                );
              }}
              onDrop={(event) => {
                const active = drag.current;
                drag.current = undefined;
                if (indicator.current !== null) indicator.current.hidden = true;
                const before = active?.before;
                if (active === undefined || before === undefined) return;
                event.preventDefault();
                store.mutate(() => bridge?.reorderLayer(active.from, before));
              }}
              onDragEnd={() => {
                drag.current = undefined;
                if (indicator.current !== null) indicator.current.hidden = true;
              }}
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
              onKeyDown={(event) => {
                // Keys raised inside the row's own controls are theirs, not the
                // row's: without this the rename input's Enter would commit and
                // then reopen the field as the event bubbles out.
                if (event.target !== event.currentTarget) return;
                // No arrow-key focus movement: the window-level nudge handler
                // owns the arrow keys, and two owners for one key would nudge an
                // object and move focus on the same press.
                if (event.key === "F2" || event.key === "Enter") {
                  event.preventDefault();
                  cancelled.current = false;
                  setEditing(row.id);
                }
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
        <div
          ref={indicator}
          hidden
          aria-hidden
          data-vigilia-layer-dropline=""
          className="vigilia-layer-dropline"
        />
      </div>
      <footer data-vigilia-layer-actions>
        {OBJECT_ACTIONS.filter(
          (action) => bridge !== undefined && actionEnabled(bridge, action.id),
        ).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            onClick={() => bridge?.run(id)}
          >
            <Icon aria-hidden size={15} strokeWidth={1.75} />
          </button>
        ))}
      </footer>
    </section>
  );
}
