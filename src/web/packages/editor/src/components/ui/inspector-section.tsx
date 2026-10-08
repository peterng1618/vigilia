import type * as React from "react";
import { useState } from "react";

/**
 * One region of a panel: a disclosure whose header is a button, and a body of
 * rows (bible §5.7).
 *
 * The header is the button rather than a div that contains one, so its
 * `aria-expanded` reaches the thing that was clicked, and collapsing hides the
 * body instead of unmounting it — a section that lost its state on a collapse,
 * or on a publication that redrew the panel, would take a half-typed draft with
 * it (§5, "stable identity keeps work in place").
 *
 * A read-only section says so in its header, in words: bible §5.1 makes
 * "this cannot be edited" a property of the section rather than something a
 * reader infers from the absence of a well.
 */
export function InspectorSection(props: {
  readonly id: string;
  readonly title: string;
  readonly readOnly?: boolean;
  readonly defaultOpen?: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const { id, title, readOnly, defaultOpen = true, children } = props;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-t border-edge py-[var(--space-12)]">
      <h2 className="m-0">
        <button
          type="button"
          id={`${id}-header`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center gap-[var(--space-6)] border-0 bg-transparent text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="text-2xs font-semibold tracking-[0.11em] text-muted uppercase">
            {title}
          </span>
          {readOnly === true ? (
            <span className="text-2xs text-muted">Read-only</span>
          ) : null}
          <span aria-hidden className="ml-auto text-faint">
            {open ? "▾" : "▸"}
          </span>
        </button>
      </h2>
      <div
        id={`${id}-panel`}
        hidden={!open}
        className="flex flex-col gap-[var(--space-6)] pt-[var(--space-8)]"
      >
        {children}
      </div>
    </section>
  );
}
