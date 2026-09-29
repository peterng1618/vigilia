/**
 * The templates the product ships, as the host's pages see them.
 *
 * A template is not a saved theme: it has no file in the themes directory, so
 * there is nothing to delete, nothing to count among the author's own, and
 * nothing for the player to fetch. The editor holds the composition behind each
 * id and opens it from its own library; the host holds the *catalogue*, because
 * the host is what a consumer's browser asks and the editor's bundle is not
 * loadable from Node.
 *
 * That is a second place the id and name are written, and it is deliberate:
 * importing the editor here would drag React and Fabric into a Node process
 * whose one rule is that it adds no runtime dependency. The two lists must
 * agree, and nothing enforces that across packages yet — a template added to
 * the editor's library without a line here is invisible to the chooser, which
 * is the defect this list exists to close. `ponytail:` move the catalogue to a
 * shared package (or have the editor's library read this route) when the second
 * entry arrives; one list hand-copied is a decision, two is a drift.
 */
export interface TemplateEntry {
  readonly id: string;
  readonly name: string;
}

export const SHIPPED_TEMPLATES: readonly TemplateEntry[] = [
  { id: "vigilia-starter-template", name: "Starter — System dashboard" },
];
