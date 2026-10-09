import type * as React from "react";
import { useId } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { InspectorSection } from "../components/ui/inspector-section.js";
import type { SelectionEdits, SelectionView } from "./view.js";

/**
 * The column's sections, as React.
 *
 * The sections come from the view and are rendered in the order it carries them:
 * this component sorts nothing, groups nothing and decides nothing about
 * emptiness. `perKindColumn` owns which questions a selection is asked and
 * `SETTINGS_SECTIONS` decides their order, so a column that re-ordered here
 * would be a second owner of Review Focus 2's rule — and this is the surface
 * that failure would show up in.
 *
 * The body is not rendered here yet. `data-vigilia-section-body` is the container
 * `index.ts` mounts each section's still-imperative fields into, and it empties
 * as Tasks 3–6 convert them. React renders the container empty and leaves what
 * `index.ts` puts inside it alone — React only moves the nodes it made.
 */
export function SelectionColumn(props: {
  readonly view: SelectionView;
  readonly edits: SelectionEdits;
}): React.JSX.Element {
  const { view } = props;
  // A column is one selection's, and two columns can be mounted at once (the
  // accessibility audit mounts two). `${id}-header` is document-global, so the
  // aria pair is scoped to this instance or the second column's `aria-controls`
  // resolves to the first column's panel.
  const idPrefix = useId();

  return (
    <>
      {view.sections.map((section) => (
        <InspectorSection
          key={section.id}
          id={section.id}
          idPrefix={idPrefix}
          title={section.title}
          readOnly={section.readOnly}
          defaultOpen={section.defaultOpen}
          count={section.count}
        >
          <div data-vigilia-section-body="" />
        </InspectorSection>
      ))}
    </>
  );
}

/**
 * The column's React root. `index.ts` publishes the projected view here and
 * mounts the imperative bodies into the containers this rendered, in that order.
 *
 * A publish is flushed synchronously, the same contract the subject's root keeps:
 * a caller that reads the column straight after a selection change sees it.
 */
export function createSelectionColumnRoot(host: HTMLElement): {
  readonly publish: (view: SelectionView, edits: SelectionEdits) => void;
  readonly destroy: () => void;
} {
  const root: Root = createRoot(host);

  return {
    publish(view, edits) {
      flushSync(() => {
        root.render(<SelectionColumn view={view} edits={edits} />);
      });
    },
    destroy() {
      root.unmount();
    },
  };
}
