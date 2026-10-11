/**
 * The name a control is announced under, as far as jsdom can be asked: the same
 * four mechanisms the platform uses, in the platform's own order of precedence.
 * A browser measures the real thing — this is the regression net under it.
 *
 * It lives here rather than inside one audit because two audits ask the same
 * question: `accessible-names.dom.test.ts` (is every control named?) and
 * `control-icon-button.dom.test.tsx` (is an icon-only control's tooltip that
 * same name?). A second implementation would be a second answer to "what is
 * this control called", and the two would drift.
 */
export function accessibleName(element: Element): string {
  const labelled = element.getAttribute("aria-label")?.trim();
  if (labelled !== undefined && labelled !== "") return labelled;
  const referenced = element.getAttribute("aria-labelledby");
  if (referenced !== null && referenced !== "") {
    const text = referenced
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
    if (text !== "") return text;
  }
  if (element.id !== "") {
    const labels =
      element.ownerDocument.querySelectorAll<HTMLLabelElement>("label[for]");
    for (const label of labels) {
      if (label.htmlFor === element.id) return label.textContent?.trim() ?? "";
    }
  }
  const wrapping = element.closest("label")?.textContent?.trim() ?? "";
  if (wrapping !== "") return wrapping;
  // Name from content, which is how a button is named and how a select's option
  // text is emphatically not: the option list is the control's value.
  return element.tagName === "BUTTON"
    ? (element.textContent?.trim() ?? "")
    : "";
}
