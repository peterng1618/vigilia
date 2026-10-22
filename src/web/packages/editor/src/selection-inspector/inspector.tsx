import { createElement, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { Glyph, KIND_GLYPHS } from "../editor-shell/icons.js";
import { uiCopy } from "../ui-copy.js";
import type { SelectionEdits, SelectionView } from "./view.js";

/**
 * The column's React root and the store the projection is published to.
 *
 * `index.ts` projects a `SelectionView` from Fabric on demand and publishes it
 * here; React subscribes and re-renders. Nothing but the serializable view and
 * the imperative edit port crosses this line — no Fabric object, no DOM node
 * (ADR-0039).
 */

interface PublishedSelection {
  readonly view: SelectionView;
  readonly edits: SelectionEdits;
}

interface InspectorStore {
  subscribe(listener: () => void): () => void;
  snapshot(): PublishedSelection | undefined;
  publish(next: PublishedSelection): void;
}

function createStore(): InspectorStore {
  let current: PublishedSelection | undefined;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => current,
    publish(next) {
      current = next;
      for (const listener of listeners) listener();
    },
  };
}

/**
 * The subject block and the empty state — the two things the column says before
 * it says anything about fields. The kind's glyph leads the name at `--text-md`,
 * in the chrome's one icon vocabulary, and the line under them carries the key a
 * binding reads at `--text-xs` in `--muted`. The block is closed by a hairline
 * edge rather than a chrome label (DESIGN.md §7.4), and that edge is the column's
 * *one* boundary below the header: the first section draws none of its own
 * (`vg-466`).
 */
function Inspector({
  store,
}: {
  readonly store: InspectorStore;
}): React.JSX.Element | null {
  const published = useSyncExternalStore(store.subscribe, store.snapshot);
  if (published === undefined) return null;

  const { view } = published;
  if (view.subject === undefined) {
    return (
      <p className="m-0 text-sm text-muted" data-yunari-nothing-selected="">
        {uiCopy.inspectorFields.nothingSelected}
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-[var(--space-4)] border-b border-edge pb-[var(--space-8)]">
        {/* The mark and the name on one line, as the pane title draws its own
            (`pane.tsx`): the glyph inherits `--muted` from the row and the name
            takes `--text` for itself. A kind with no layer kind — a
            multi-selection — draws no mark rather than a second table's guess
            at one. */}
        <div className="flex items-center gap-[var(--space-8)] text-muted">
          {view.subject.kind === "activeSelection" ? null : (
            <Glyph icon={KIND_GLYPHS[view.subject.kind]} size={14} />
          )}
          <span
            className="text-md font-semibold text-text"
            data-yunari-subject-name=""
          >
            {view.subject.name}
          </span>
        </div>
        {view.subject.key === undefined ? null : (
          <span className="text-xs text-muted">{view.subject.key}</span>
        )}
      </div>
      {view.locked ? (
        <p
          className="m-0 mt-[var(--space-12)] text-sm text-muted"
          data-yunari-locked=""
        >
          {uiCopy.inspectorFields.locked}
        </p>
      ) : null}
    </div>
  );
}

export function createInspectorRoot(host: HTMLElement): {
  readonly publish: (view: SelectionView, edits: SelectionEdits) => void;
  readonly destroy: () => void;
} {
  const store = createStore();
  const root: Root = createRoot(host);
  // Mounted through `flushSync` as well as published through it: a caller that
  // reads the column straight after building it must see the store's first
  // value, not the empty frame before React's first commit lands.
  flushSync(() => {
    root.render(createElement(Inspector, { store }));
  });

  return {
    publish(view, edits) {
      // Flushed synchronously: a caller that reads the column straight after a
      // selection change sees it, exactly as the imperative surface did before
      // the projection existed.
      flushSync(() => store.publish({ view, edits }));
    },
    destroy() {
      root.unmount();
    },
  };
}
