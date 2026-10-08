import type * as React from "react";

/**
 * One pane's chrome, to bible §7.3: a title bar (glyph, title, then a count or
 * a single pane-level action), a body, and an optional footer toolbar.
 *
 * `id` is the pane's DOM name, and it is required: the pane is the one owner of
 * pane identity, so every pane carries `data-vigilia-panel` and no panel inside
 * one duplicates it. Two elements under one name is a strict-mode failure in
 * the specs that browse by it, which is what a second writer would buy.
 *
 * The body is a plain block and deliberately not a scroller. The scroll lives
 * on the column that owns it (`shell-layout`'s `aside.editor-shell-panel`),
 * because `choosePane` restores each pane's offset off that box and §7.7 forbids
 * a second scrollbar owner inside one pane.
 */
export function Pane(props: {
  readonly id: string;
  readonly title: string;
  readonly icon: React.ComponentType<{
    readonly size?: number;
    readonly strokeWidth?: number;
  }>;
  readonly count?: React.ReactNode;
  readonly footer?: React.ReactNode;
  /** Whether this slot's pane is showing. The shell keeps every pane mounted —
   *  the persistent hosts live inside them — so a pane that is not showing is
   *  `hidden`, not unmounted. */
  readonly hidden?: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const {
    id,
    title,
    icon: Icon,
    count,
    footer,
    hidden = false,
    children,
  } = props;
  return (
    <section
      data-vigilia-panel={id}
      className="editor-shell-pane"
      hidden={hidden}
    >
      <header className="editor-shell-pane-title">
        <Icon aria-hidden size={14} strokeWidth={1.7} />
        <h2 className="editor-shell-pane-name">{title}</h2>
        {count === undefined ? null : (
          <span className="editor-shell-pane-count">{count}</span>
        )}
      </header>
      <div className="editor-shell-pane-body">{children}</div>
      {footer === undefined ? null : footer}
    </section>
  );
}
