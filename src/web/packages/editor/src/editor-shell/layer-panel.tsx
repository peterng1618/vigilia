import {
  ChartLine,
  ChartPie,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Gauge,
  type LucideIcon,
  Lock,
  ChartColumn,
  Unlock,
} from "lucide-react";
import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { useSyncExternalStore } from "react";
import { actionEnabled, OBJECT_ACTIONS } from "../object-actions.js";
import { uiCopy } from "../ui-copy.js";
import type { EditorShellBridge } from "./bridge.js";
import type { LayerMark, LayerRow } from "./layer-tree.js";

/**
 * A chart's family mark, one icon per family the document can name.
 *
 * The old column said "chart" to every chart, which is the word a card of eight
 * charts repeats eight times and the one thing an author scanning for the ring
 * cannot use. `ChartColumn` is the fallback for a family this build does not
 * know, so the row still says what it is rather than what it is not.
 */
const CHART_ICONS: Readonly<Record<string, LucideIcon>> = {
  gauge: Gauge,
  line: ChartLine,
  bar: ChartColumn,
  pie: ChartPie,
};
const CHART_FALLBACK: LucideIcon = ChartColumn;

/** The twisty is a control like any other, so it is an icon and not a glyph:
 * `▸`/`▾` were announced as words of their own and could not inherit a shell
 * colour the way every icon beside them does (§35). The open/closed state
 * stays on `aria-expanded`, and each chevron points the way the press goes. */
const TWISTY_ICONS: Readonly<Record<"collapsed" | "expanded", LucideIcon>> = {
  collapsed: ChevronRight,
  expanded: ChevronDown,
};

/** Locked is a filled lock, unlocked an outline one: at 13px the outlines differ
 * only by a gap in the shackle. `fill` is part of `LucideProps` and overrides
 * Lucide's own `fill="none"`, so the weight changes without a second glyph. */
const LOCK_STATES: Readonly<
  Record<"locked" | "unlocked", { readonly icon: LucideIcon; readonly fill?: string }>
> = {
  locked: { icon: Lock, fill: "currentColor" },
  unlocked: { icon: Unlock },
};

/** `exactOptionalPropertyTypes` is on, so the absent fill is spread in rather
 * than passed as `undefined` — that would type-check but defeat the default. */
function LockStateIcon({ locked }: { readonly locked: boolean }): React.JSX.Element {
  const state = LOCK_STATES[locked ? "locked" : "unlocked"];
  const Icon = state.icon;
  return (
    <Icon
      aria-hidden
      size={13}
      strokeWidth={1.75}
      {...(state.fill === undefined ? {} : { fill: state.fill })}
    />
  );
}

/**
 * The kind, drawn as the thing rather than as a mark for the thing.
 *
 * A text row says its own words in its own face, so one glance answers both
 * "what is it" and "what does it say"; a chart names its family; a shape shows
 * the paint it fills with; an image shows its own picture. A group shows
 * nothing here — the twisty is its mark, and a bold name below says "this holds
 * others" without a second symbol repeating it.
 *
 * A row whose runs are all value runs therefore shows nothing here: it has no
 * words of its own, and the bound column beside this one says what it reads.
 *
 * Every arm sits in one fixed-width slot, which is what lines the names up. A
 * group still takes the slot rather than collapsing it, so an eight-card
 * document has its rows in one column rather than two ragged ones.
 *
 * `data-vigilia-layer-mark` names which arm drew, so a browser case can measure
 * the treatment rather than infer it from the icon's class.
 */
function KindMark({ mark }: { readonly mark: LayerMark }): React.JSX.Element {
  return (
    <span className="vigilia-layer-mark">
      {treatment(mark)}
    </span>
  );
}

function treatment(mark: LayerMark): React.JSX.Element | null {
  switch (mark.kind) {
    case "text":
      return (
        <span
          data-vigilia-layer-mark="text"
          className="vigilia-layer-sample"
          // The face is the object's own, not a panel default: a row that all
          // wore the shell's face would say nothing about the type it names.
          style={{
            fontFamily: mark.family,
            fontWeight: mark.weight,
          }}
          title={mark.text}
        >
          {mark.text}
        </span>
      );
    case "chart": {
      const Icon =
        mark.family === undefined
          ? CHART_FALLBACK
          : (CHART_ICONS[mark.family] ?? CHART_FALLBACK);
      return (
        <span data-vigilia-layer-mark="chart" className="vigilia-layer-icon">
          <Icon aria-hidden size={13} strokeWidth={1.75} />
        </span>
      );
    }
    case "shape":
      return (
        <span
          data-vigilia-layer-mark="shape"
          className="vigilia-layer-swatch"
          // A gradient or a pattern is a paint object, not a colour, and a 10px
          // swatch cannot show one honestly; the outline then stands alone.
          {...(mark.paint === undefined
            ? {}
            : { style: { background: mark.paint } })}
          aria-hidden
        />
      );
    case "image":
      return mark.src === undefined ? null : (
        <img
          data-vigilia-layer-mark="image"
          className="vigilia-layer-thumb"
          src={mark.src}
          alt=""
          aria-hidden
        />
      );
    case "group":
      return null;
  }
}

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
export /**
 * The keys a tree is defined by, on the row that declares the tree.
 *
 * The row said `role="treeitem"`, and a treeitem whose arrow keys do nothing is
 * a promise the panel does not keep — a screen reader announces a tree and then
 * none of it responds. The nudge handler owns the arrow keys on the canvas, but
 * it defers only for a TEXT ENTRY, and a row is a `div`, so an unmodified arrow
 * key reached the nudge and moved the selected object instead. Taking the keys
 * here and stopping propagation is what lets the list be a list: navigation
 * while focus is inside it, nudging while it is not.
 */
function moveFocus(
  event: React.KeyboardEvent<HTMLDivElement>,
  row: LayerRow,
  bridge: EditorShellBridge | undefined,
): boolean {
  const rows = [
    ...(event.currentTarget.closest("[role=\"tree\"]")?.querySelectorAll<HTMLElement>(
      "[role=\"treeitem\"]",
    ) ?? []),
  ];
  const at = rows.indexOf(event.currentTarget);
  if (at < 0) return false;
  const focus = (index: number): void => {
    const next = rows[index];
    if (next !== undefined) next.focus();
  };
  const expandable = row.hasChildren;

  switch (event.key) {
    case "ArrowDown":
      focus(at + 1);
      return true;
    case "ArrowUp":
      focus(at - 1);
      return true;
    case "Home":
      focus(0);
      return true;
    case "End":
      focus(rows.length - 1);
      return true;
    case "ArrowRight":
      // Expand a collapsed group, or step into an expanded one's first child.
      if (expandable && row.collapsed === true) {
        bridge?.setCollapsed(row.id, false);
        return true;
      }
      if (expandable && at + 1 < rows.length) focus(at + 1);
      return true;
    case "ArrowLeft": {
      if (expandable && row.collapsed === false) {
        bridge?.setCollapsed(row.id, true);
        return true;
      }
      // Otherwise step out to the parent, the level the row names.
      for (let i = at - 1; i >= 0; i -= 1) {
        const parent = rows[i];
        if (Number(parent?.getAttribute("aria-level") ?? 1) < row.depth + 1) {
          parent?.focus();
          return true;
        }
      }
      return true;
    }
    default:
      return false;
  }
}

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
  // Which row the pointer is over and which holds the keyboard, so the two
  // state icons can appear for a row the author is about to act on. Ids rather
  // than booleans: attention is one property the author has, so one field per
  // kind holds it, and the answer is an identity comparison per row rather than
  // a scan of a set that grew with the row count.
  //
  // **No row is memoized, so this does not re-render anything less.** Either
  // state change re-renders the panel and all its rows. What the id form buys
  // is only the size and lookup of the state — a `Set` of attended ids would
  // answer the same rows in the same pass.
  const [hovered, setHovered] = useState<string | undefined>(undefined);
  const [focused, setFocused] = useState<string | undefined>(undefined);

  // The drag's own state, not React's: a ref set mid-gesture lands without a
  // re-render, so a drop that follows within the same frame cannot see the
  // stale value a state update would leave behind.
  const drag = useRef<
    {
      from: string;
      before: string | undefined;
      marked: HTMLElement | undefined;
      source: HTMLElement | undefined;
    } | undefined
  >(undefined);
  // One line for the whole tree: the browser applies it to whatever element is
  // under the cursor, which is exactly the slot that would take the drop.
  const indicator = useRef<HTMLDivElement | null>(null);
  // The tree itself, so the stylesheet can tell "a drag is in flight" from
  // "this row is a target" — the two answer different questions.
  const tree = useRef<HTMLDivElement | null>(null);
  const ruleId = useId();

  /** The one row carrying `data-drop`, and the only one that may: two marked
   * rows would claim two slots, and the second would be a lie. Written to the
   * DOM for the same reason the drag state is a ref — a drop can follow the
   * last `dragover` inside one frame. */
  const mark = (
    row: HTMLElement | undefined,
    state: "slot" | "refused" | undefined,
  ): void => {
    const active = drag.current;
    if (active === undefined) return;
    active.marked?.removeAttribute("data-drop");
    active.marked = undefined;
    if (row !== undefined && state !== undefined) {
      row.setAttribute("data-drop", state);
      active.marked = row;
    }
  };

  /** Take the gesture's marks off the tree with the gesture, so nothing outlives
   * the drag that put it there. */
  const unmark = (): void => {
    mark(undefined, undefined);
    drag.current?.source?.removeAttribute("data-drag-source");
    drag.current = undefined;
    tree.current?.removeAttribute("data-dragging");
    if (indicator.current !== null) indicator.current.hidden = true;
  };

  const commit = (id: string, name: string): void => {
    setEditing(undefined);
    store.mutate(() => bridge?.renameLayer(id, name));
  };

  return (
    <section data-vigilia-panel="layers">
      <h2>{uiCopy.panels.layers}</h2>
      {/* The rule, stated where the author reads the panel rather than only in
        * a cursor they may never look at. `aria-describedby` is the same string
        * reached without a pointer, so it is not two copies of the rule. */}
      <p id={ruleId} data-vigilia-layer-rule className="vigilia-layer-rule">
        {uiCopy.panels.reorderRule}
      </p>
      <div
        ref={tree}
        role="tree"
        aria-label={uiCopy.panels.layers}
        aria-describedby={ruleId}
      >
        {rows.map((row, index) => {
          const Twisty = TWISTY_ICONS[row.collapsed ? "collapsed" : "expanded"];
          const twisty = row.collapsed ? uiCopy.panels.expand : uiCopy.panels.collapse;
          // The two state icons appear only where they say something: a pointer
          // or the keyboard is on the row, the row is selected, or the state
          // itself is not the default. 104 icons reading "visible, unlocked"
          // was noise that grew with the row count, which is exactly the case a
          // card-heavy panel hides. Two flags that are both true carry no
          // information, so a default row carries neither.
          const attended = hovered === row.id || focused === row.id;
          const showLock = attended || row.selected || row.locked;
          const showVisibility = attended || row.selected || !row.visible;
          return (
            <div
              // The row's own id is not unique once an object moves: a stale
              // projection can hold one id twice, and a duplicate key makes
              // React reuse the wrong row. Slot identity is what re-renders.
              key={`${row.id}#${index}`}
              className="vigilia-layer-row"
              data-vigilia-layer={row.id}
              data-selected={row.selected}
              // A hidden layer is hidden on the canvas too, and the row said
              // so only in its tooltip — one measurable difference between a
              // row you hid and a row you never touched.
              data-hidden={!row.visible}
              // The entered group and its descendants are what a tree click can
              // reach on its own; everything else is dimmed to say so. With no
              // group entered there is no context to be outside of, so the
              // attribute is omitted rather than written false: React renders a
              // boolean `data-*` as the string "false", which is the value the
              // stylesheet rule dims on, and a tree greyed out on open would
              // claim every selectable top-level layer is unreachable.
              data-context={context.size > 0 ? context.has(row.id) : undefined}
              // A group is a container, and a bold name says so without a mark
              // repeating it. The stylesheet dims on this rather than on a
              // class, so the state survives the row's own class list changing.
              data-kind={row.kind}
              role="treeitem"
              aria-selected={row.selected}
              aria-level={row.depth + 1}
              // Roving tabindex would be the roving-focus ideal, but every row
              // here is cheap and the shell has no global key handler to own
              // the roving state, so all rows stay tabbable.
              tabIndex={0}
              // What the row says, not the key behind it: a tooltip that
              // printed a raw uuid told the author nothing the row did not.
              title={row.name}
              onMouseEnter={() => setHovered(row.id)}
              // `mouseleave` rather than `mouseout`: it fires once on leaving
              // the row, not again for every descendant the pointer crosses on
              // the way to the row's own buttons.
              onMouseLeave={() => setHovered(undefined)}
              // Focus counts as attention for the same reason hover does — a
              // keyboard author must reach the same controls a pointer reaches.
              // React's focus/blur bubble, so this also covers the buttons the
              // row renders once it has focus.
              onFocus={() => setFocused(row.id)}
              onBlur={(event) => {
                // Moving focus to one of the row's own controls is not leaving
                // it; only focus that leaves the row entirely stands down.
                if (event.currentTarget.contains(event.relatedTarget as Node | null))
                  return;
                setFocused(undefined);
              }}
              // A row being renamed is a text field: its own drag gesture is
              // selecting text, not restacking the layer.
              draggable={editing !== row.id}
              onDragStart={(event) => {
                // Chrome will not start a drag without payload, and one of our
                // own rows is the only thing that may start one.
                event.dataTransfer.setData("application/x-vigilia-layer", row.id);
                drag.current = {
                  from: row.id,
                  before: undefined,
                  marked: undefined,
                  source: event.currentTarget,
                };
                // The whole tree knows a gesture is in flight, so the stylesheet
                // can hold the slot apart from everything it is not.
                tree.current?.setAttribute("data-dragging", row.id);
                // What the author picked up, so the list shows the gesture is
                // holding a specific row rather than the whole tree.
                event.currentTarget.setAttribute("data-drag-source", "");
              }}
              // The row is the drop slot's height, so the browser pointing its
              // drop indicator at this row is the same thing as a pointer aimed
              // between this row and the one above it.
              onDragOver={(event) => {
                const active = drag.current;
                if (active === undefined) return;
                if (active.before === row.id) return;
                // Not above ourselves: that is where the layer already is, which
                // is a third answer and neither a slot nor a refusal.
                const moved = row.id !== active.from;
                // Nothing marked outside one parent — the bridge would refuse
                // it, and a marker there would promise a drop that cannot land.
                const lands =
                  moved && bridge?.sameLayerParent(active.from, row.id) === true;
                active.before = lands ? row.id : undefined;

                if (lands) {
                  // A permanent marker reads as state, not as a target.
                  event.preventDefault();
                  mark(event.currentTarget, "slot");
                } else {
                  // vg-099: the refusal used to be swallowed whole — cancelled
                  // or not made no difference to anything an author could see.
                  // Not cancelling is deliberate: the browser then shows its own
                  // no-drop cursor here, which is one more surface saying no
                  // rather than the panel saying it alone.
                  mark(moved ? event.currentTarget : undefined, "refused");
                }

                // The line follows the row's answer rather than the other way
                // round: it is the panel's promise of a landing slot, so it has
                // to be taken away wherever there is no slot. Carried over from
                // the pointer's previous row, it would offer the drop the row
                // under the cursor has just refused.
                const line = indicator.current;
                if (line === null) return;
                if (!lands) {
                  line.hidden = true;
                  return;
                }
                line.hidden = false;
                // The `px` is load-bearing and was missing: `top: 48` is an
                // invalid length, so the declaration is dropped and the line
                // falls back to `auto`, which sizes it to zero. Measured on
                // canvas — the line had never drawn at all, on any drop, and
                // the only thing marking a valid slot was the row itself.
                line.style.setProperty(
                  "--layer-dropline-top",
                  `${index * ROW_HEIGHT}px`,
                );
                line.style.setProperty(
                  "--layer-dropline-left",
                  `${6 + row.depth * 13}px`,
                );
              }}
              onDrop={(event) => {
                const active = drag.current;
                const before = active?.before;
                unmark();
                if (active === undefined || before === undefined) return;
                event.preventDefault();
                store.mutate(() => bridge?.reorderLayer(active.from, before));
              }}
              onDragEnd={unmark}
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
                  return;
                }
                // Selecting is the other half of the keys vg-067 added, and a
                // treeitem you can walk to but not pick is half a tree. Enter
                // is already rename's, so selection takes the key a list has
                // always used for it.
                if (event.key === " " || event.key === "Spacebar") {
                  event.preventDefault();
                  store.mutate(() => bridge?.selectLayer(row.id));
                  return;
                }
                if (moveFocus(event, row, bridge)) {
                  // The nudge handler defers only for a text entry, and a row is
                  // a `div`, so without this an arrow key navigates the list
                  // AND nudges the selection.
                  event.stopPropagation();
                  event.preventDefault();
                  return;
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
                  <Twisty aria-hidden size={13} strokeWidth={1.75} />
                </button>
              ) : (
                <span aria-hidden className="vigilia-layer-twisty" />
              )}
              <KindMark mark={row.mark} />
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
              {/* What the row reads, taken from the document's own binding — and
                  nothing at all where it reads nothing.

                  That absence is the plain statement. A word repeated down this
                  column on every row that has nothing to say carries no
                  information, and it is paid for out of the layer *name*, which
                  is the one thing a layer list has to keep readable — which is
                  the density §173 asks for. A row that reads nothing says so by
                  carrying nothing, and never by claiming a key it does not have.

                  This is also the only place a row states a key. A treeitem's
                  accessible name is the concatenation of its own columns, so the
                  `@key` the specimen used to carry as well said every binding in
                  the panel twice over — which is why the projection no longer
                  prints one where this column will. */}
              {row.bound.length === 0 ? null : (
                <span
                  className="vigilia-layer-bound"
                  title={row.bound.join(uiCopy.panels.boundSeparator)}
                >
                  {row.bound.join(uiCopy.panels.boundSeparator)}
                </span>
              )}
              {/* The controls. The slot itself is always present so the icons
                  land in the same place on every row; the room they need
                  beside the key is held open by the stylesheet only on rows
                  that actually draw them, because holding it open everywhere
                  cost the *name* 50px on all sixty rows. */}
              <span className="vigilia-layer-state">
                {showVisibility ? (
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
                ) : null}
                {showLock ? (
                  <button
                    type="button"
                    aria-label={row.locked ? uiCopy.actions.unlock : uiCopy.actions.lock}
                    aria-pressed={row.locked}
                    onClick={(event) => {
                      event.stopPropagation();
                      store.mutate(() => bridge?.setLayerLocked(row.id, !row.locked));
                    }}
                  >
                    <LockStateIcon locked={row.locked} />
                  </button>
                ) : null}
              </span>
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
