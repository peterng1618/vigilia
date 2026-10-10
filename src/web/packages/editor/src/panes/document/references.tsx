import type { FabricGlobals } from "@vigilia/renderer-core";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { InspectorSection } from "../../components/ui/inspector-section.js";
import { resolutionValue } from "../../selection-inspector/appearance.js";
import { documentReferences } from "../../selection-inspector/style.js";
import { uiCopy } from "../../ui-copy.js";

export interface DocumentReferencesOptions {
  /**
   * Read on demand rather than held: this panel is mounted for the whole
   * session and never writes, so pulling the current globals on each render
   * cannot show a stale copy.
   */
  readonly globals: () => FabricGlobals | undefined;
}

export interface DocumentReferencesPanel {
  readonly root: HTMLElement;
  /** Re-reads the document's globals; call when a theme edit changes them. */
  render(): void;
  destroy(): void;
}

/**
 * The document's own references, read-only: every palette token and type preset
 * an object can reference, resolved through the document's own globals.
 *
 * The walk is `selection-inspector/style.ts`'s and the sentence is
 * `appearance.ts`'s, so this renders their answer rather than adding a second
 * resolver. The mark is on the section's header by `InspectorSection`'s
 * `readOnly` — §5.4 and decision 0030 make "this cannot be edited" a statement,
 * not something a reader infers from an absent well — and it is on the header of
 * a section that opens **closed**, which is the whole point: the author is told
 * before they look.
 */
export function DocumentReferences(props: {
  readonly globals: FabricGlobals | undefined;
}): React.JSX.Element {
  return (
    // `data-vigilia-globals` wraps the section rather than its body: the body is
    // `hidden` while the section is closed, and the hook has to be visible then
    // too — `composition-panel.spec.ts` reads it with the section collapsed.
    <div data-vigilia-globals="">
      <InspectorSection
        id="style"
        title={uiCopy.inspectorFields.documentStyle}
        readOnly
        defaultOpen={false}
      >
        {documentReferences(props.globals).map((reference) => (
          <p
            key={reference.ref}
            data-vigilia-resolution={reference.label}
            className="text-xs text-muted"
          >
            {`${reference.label}: ${resolutionValue(reference.ref, reference.resolved)}`}
          </p>
        ))}
      </InspectorSection>
    </div>
  );
}

/**
 * The Document pane's References section, mounted under its own host.
 *
 * The factory keeps its signature and its `root`/`render` pair, so
 * `editor-session.ts` keeps its construction site; what changed is the
 * rendering, which is the React tree above. `data-vigilia-panel="style"` is this
 * panel's own name, as `selection-inspector/index.ts` writes `"selection"` —
 * `Pane` owns the *pane's* name, and a sub-panel names itself.
 */
export function createDocumentReferencesPanel(
  host: HTMLElement,
  options: DocumentReferencesOptions,
): DocumentReferencesPanel {
  const root = document.createElement("section");
  root.dataset["vigiliaPanel"] = "style";
  host.append(root);

  const reactRoot: Root = createRoot(root);
  const render = (): void => {
    // Flushed, so a caller that reads the pane straight after a theme edit sees
    // the new references rather than the frame before React commits — the
    // contract the imperative panel had.
    flushSync(() => {
      reactRoot.render(
        createElement(DocumentReferences, { globals: options.globals() }),
      );
    });
  };
  render();

  return {
    root,
    render,
    destroy() {
      // Unmount first, then remove: a React root subscribes, and removing its
      // container unsubscribes nothing, so the tree would outlive the pane for
      // the page's lifetime.
      reactRoot.unmount();
      root.remove();
    },
  };
}
