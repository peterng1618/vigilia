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
  /** Rendered in the summary when given, and kept in step with the body by
      `setBody`. A count of zero on a body that has fields is the caller's
      mistake, not this control's to invent one for. */
  readonly count?: number;
}

export interface PropertySection {
  readonly root: HTMLElement;
  isOpen(): boolean;
  open(): void;
  /** Replaces the body and leaves the open state alone: a re-render must not
      collapse the section the author just opened. An empty body removes the
      section, and a body that follows builds it again at `defaultOpen`. */
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
  let counter: HTMLElement | undefined;

  const build = (
    children: readonly HTMLElement[],
    count: number | undefined,
  ): void => {
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
    if (count !== undefined) {
      const element = document.createElement("span");
      element.className = "vigilia-section-count";
      element.textContent = String(count);
      summary.append(element);
      counter = element;
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
  if (options.body.length > 0) build(options.body, options.count);

  return {
    root,
    isOpen: () => details?.open ?? false,
    open: () => {
      if (details !== undefined) details.open = true;
    },
    setBody: (next) => {
      if (next.length === 0) {
        // An emptied body is an empty section, so the header goes with it
        // rather than claiming a count over nothing. A later body builds it
        // again at `defaultOpen`: a section that disappeared has no open state
        // left to preserve, and reopening it closed is the only honest reset.
        root.replaceChildren();
        details = undefined;
        content = undefined;
        counter = undefined;
        return;
      }
      if (content === undefined) {
        build(next, options.count === undefined ? undefined : next.length);
        return;
      }
      // A count that can lie is worse than no count: the header follows the
      // body it now holds.
      if (counter !== undefined) counter.textContent = String(next.length);
      content.replaceChildren(...next);
    },
  };
}
