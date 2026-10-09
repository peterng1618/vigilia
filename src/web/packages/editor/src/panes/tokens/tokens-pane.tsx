import { uiCopy } from "../../ui-copy.js";
import { PaintList, type PaintListProps } from "./paint-list.js";

/**
 * The Tokens pane's body: the paint library, under the pane's own chrome.
 *
 * **The pane's identity is not written here.** `Pane` is the one owner of
 * `data-vigilia-panel` (`editor-shell/pane.tsx:43`), and this renders inside it;
 * a second element under that name is a strict-mode failure for every locator
 * that browses by it.
 *
 * The heading is the library's own word and a plain `<h2>`: `panel-labels.spec.ts`
 * reads every `section h2` and matches the panel's name against it, and the
 * disclosure chrome's `▾` would arrive in that text beside the title.
 *
 * Task 6 mounts the preset library beside this one from the same pane host.
 */
export function TokensPane(props: PaintListProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <h2 className="text-xs font-semibold tracking-[0.11em] text-muted uppercase">
        {uiCopy.panels.palette}
      </h2>
      <PaintList {...props} />
    </div>
  );
}
