import { createElement, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
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
 * it says anything about fields. The name leads at `--text-md`; the line under it
 * names the kind at `--text-xs` in `--muted`, in a block closed by a hairline
 * edge rather than a chrome label (bible §7.4).
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
      <p className="m-0 text-sm text-muted" data-vigilia-nothing-selected="">
        {uiCopy.inspectorFields.nothingSelected}
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-[var(--space-4)] border-b border-edge pb-[var(--space-8)]">
        <span className="text-md text-text">{view.subject.name}</span>
        <span className="text-xs text-muted">{view.subject.kindLine}</span>
      </div>
      {view.locked ? (
        <p className="m-0 mt-[var(--space-12)] text-sm text-muted">
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
