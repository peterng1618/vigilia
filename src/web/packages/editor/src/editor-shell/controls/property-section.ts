/**
 * A section of the inspector: a native `<details>` disclosure with a title, a
 * count of what it holds, and a body the caller fills.
 *
 * The disclosure is the platform's — expanded state, keyboard activation and
 * the accessible name are the element's job, not a second button-and-panel
 * implementation. This control's job is the section's identity, its count and
 * the body it is handed. It knows no section semantics: `defaultOpen` and the
 * order are the caller's, because "geometry is closed by default" is a rule
 * about the column, not about a disclosure.
 *
 * The count renders inside the summary, never inside the body: a collapsed
 * section that stopped saying how much it holds would be hiding, and the spec's
 * rule is that collapsing is ordering, not removal.
 */

export interface PropertySectionOptions {
  /** The section's own name, `content`/`position`/… — see `SETTINGS_SECTIONS`
      in renderer-core. A plain string, because the vocabulary lives with the
      table that declares it and this control must not import chart types. */
  readonly id: string;
  readonly title: string;
  readonly body: readonly HTMLElement[];
  readonly defaultOpen: boolean;
  /** Rendered in the summary when given. A count of zero on a body that has
      fields is the caller's mistake, not this control's to invent one for. */
  readonly count?: number;
}

export interface PropertySection {
  readonly root: HTMLElement;
  isOpen(): boolean;
  open(): void;
  /** Replaces the body and leaves the open state alone: a re-render must not
      collapse the section the author just opened. */
  setBody(next: readonly HTMLElement[]): void;
}

let seq = 0;

export function propertySection(
  options: PropertySectionOptions,
): PropertySection {
  // The root is a bare container rather than the `<section>` itself, so a
  // section with no body can be appended without leaving an empty header or a
  // 12px gap where a heading would have been.
  const root = document.createElement("div");
  let details: HTMLDetailsElement | undefined;
  let content: HTMLElement | undefined;

  const build = (children: readonly HTMLElement[]): void => {
    const section = document.createElement("section");
    section.className = "vigilia-section";
    section.dataset["vigiliaSection"] = options.id;

    const disclosure = document.createElement("details");
    disclosure.className = "vigilia-section-details";
    disclosure.open = options.defaultOpen;

    const summary = document.createElement("summary");
    summary.className = "vigilia-section-summary";
    const title = document.createElement("span");
    title.className = "vigilia-section-title";
    title.textContent = options.title;
    // The title is the summary's accessible name; without this the name would
    // be the title and the count run together, and a header whose name is only
    // a number would tell a screen reader nothing about the section.
    title.id = `vigilia-section-title-${++seq}`;
    summary.setAttribute("aria-labelledby", title.id);
    summary.append(title);
    if (options.count !== undefined) {
      const count = document.createElement("span");
      count.className = "vigilia-section-count";
      count.textContent = String(options.count);
      summary.append(count);
    }

    const body = document.createElement("div");
    body.className = "vigilia-section-body";
    body.append(...children);

    disclosure.append(summary, body);
    section.append(disclosure);
    root.append(section);
    details = disclosure;
    content = body;
  };

  // Nothing to hold means nothing to disclose: no header, no count of zero.
  if (options.body.length > 0) build(options.body);

  return {
    root,
    isOpen: () => details?.open ?? false,
    open: () => {
      if (details !== undefined) details.open = true;
    },
    setBody: (next) => {
      if (content === undefined) {
        if (next.length > 0) build(next);
        return;
      }
      content.replaceChildren(...next);
    },
  };
}
