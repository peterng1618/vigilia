import type * as React from "react";
import { useState } from "react";
import { hitTargetClasses } from "./control-well.js";

/**
 * One region of a panel: a disclosure whose header is a button, and a body of
 * rows (bible §5).
 *
 * The header is the button rather than a div that contains one, so its
 * `aria-expanded` reaches the thing that was clicked (§5, "Section headers are
 * buttons exposing `aria-expanded`"), and collapsing hides the body instead of
 * unmounting it — a section that lost its state on a collapse, or on a
 * publication that redrew the panel, would take a half-typed draft with it
 * (§5, "stable identity keeps work in place").
 *
 * A read-only section says so in its header, in words: §5 rule 1 makes
 * "this cannot be edited" a property of the section rather than something a
 * reader infers from the absence of a well.
 *
 * The header is a target, so it carries §5's 24×24 through `hitTargetClasses`:
 * a 10px eyebrow on a 12px line is 18px of button.
 *
 * The count is optional and sits in the header rather than the body: a collapsed
 * section that stopped saying how much it holds would be hiding, and §7.4's rule
 * is that collapsing is ordering, not removal.
 */
export function InspectorSection(props: {
  readonly id: string;
  readonly title: string;
  readonly readOnly?: boolean;
  readonly defaultOpen?: boolean;
  readonly count?: number;
  /**
   * Scopes the header and panel ids so two sections with the same `id` in one
   * document do not collide. `id` names the section and is the locator hook, but
   * the aria pair has to be document-unique — two selection columns would
   * otherwise both mint `content-header`, and the second `aria-controls` would
   * resolve to the first column's panel. Empty by default, so a single surface
   * keeps the plain `${id}-header` ids.
   */
  readonly idPrefix?: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const {
    id,
    title,
    readOnly,
    defaultOpen = true,
    count,
    idPrefix = "",
    children,
  } = props;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      data-vigilia-section={id}
      className="border-t border-edge py-[var(--space-12)]"
    >
      <h2 className="m-0">
        <button
          type="button"
          id={`${idPrefix}${id}-header`}
          aria-expanded={open}
          aria-controls={`${idPrefix}${id}-panel`}
          onClick={() => setOpen((current) => !current)}
          className={`${hitTargetClasses} flex w-full items-center gap-[var(--space-6)] border-0 bg-transparent text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
        >
          <span className="text-2xs font-semibold tracking-[0.11em] text-muted uppercase">
            {title}
          </span>
          {count === undefined ? null : (
            <span
              data-vigilia-section-count=""
              className="text-2xs text-muted tabular-nums"
            >
              {count}
            </span>
          )}
          {readOnly === true ? (
            <span className="text-2xs text-muted">Read-only</span>
          ) : null}
          <span aria-hidden className="ml-auto text-faint">
            {open ? "▾" : "▸"}
          </span>
        </button>
      </h2>
      <div
        id={`${idPrefix}${id}-panel`}
        hidden={!open}
        className="flex flex-col gap-[var(--space-6)] pt-[var(--space-8)]"
      >
        {children}
      </div>
    </section>
  );
}
