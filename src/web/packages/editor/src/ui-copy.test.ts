// @vitest-environment jsdom
/**
 * The copy table's own rules: every word an author reads comes from `uiCopy`, or
 * is data — a token's name, a locale's, an asset's, a preset's.
 *
 * **This file asserts the table, not a surface.** It holds what needs no mount:
 * no pictograph can be stored as copy, the favourite toggle's two states name
 * two different actions, the two readings answer different questions, and a menu
 * row is sentence case — the last read off the rows the menus' own owners derive,
 * with the first-letter rule proved on the shapes that reach it.
 *
 * A word a surface prints is read where it is printed, so a literal in one is
 * caught at the point it is written rather than by a grep that also matches
 * authored theme data: `ui-copy-panels.test.ts` for the imperative panels and
 * the picker their type-preset panel mounts, `ui-copy-surfaces.test.ts` for the
 * landed React surfaces.
 */
import { expect, it } from "vitest";
import { EDIT_MENU_ROWS } from "./editor-shell/shell-menu-bar.js";
import { glassRefusalKinds, uiCopy } from "./ui-copy.js";
import { copy } from "./ui-copy-readers.js";

/**
 * No pictograph is copy. §35 keeps visible copy in this table, and a glyph is
 * decoration: it is announced as a word of its own, it cannot inherit a shell
 * colour the way every icon beside it does, and it does not render like them.
 * The rail's four marks were exactly that — `▤ + ▣ ⚙` as translatable strings —
 * so the rule is the net under the fix rather than the fix itself.
 */
it("holds no pictographs, so an icon cannot be stored as copy", () => {
  expect(pictographs(uiCopy)).toEqual([]);
});

/** Every string the table reaches, paired with the key that holds it. Letters
 * are labels (`X`, `W`) and stay; the Unicode symbol blocks are decoration. */
function pictographs(value: unknown, path = "uiCopy"): string[] {
  if (typeof value === "string") {
    return /\p{S}/u.test(value) ? [`${path} = ${JSON.stringify(value)}`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      pictographs(entry, `${path}[${index}]`),
    );
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, entry]) =>
      pictographs(entry, `${path}.${key}`),
    );
  }
  return [];
}

/**
 * `vg-417`: the walk collects what a keyed function answers, not only what its
 * fallback says. `copy()` calls every function with a count and a name, and
 * `glassRefused` chooses its sentence by the kind it is asked with — so every
 * refusal the table holds read as a string with no owner, and a surface
 * printing one went falsely **red**. Disable the keyed pass in `copy()` and
 * this fails on the first kind: the sentences are in the table and nothing
 * collected them.
 *
 * The other keyed function needs no case: `chartFamilyLabels` is reachable as
 * `uiCopy.chartFamilies`, so the object walk already collects it.
 */
it("collects every string a keyed copy function answers with", () => {
  const owned = new Set(copy());
  for (const kind of glassRefusalKinds)
    expect(owned, kind).toContain(uiCopy.inspectorFields.glassRefused(kind));
});

/**
 * §6: the two readings answer different questions, and neither is the fallback
 * for the other. The words have to say which question each one answers — an
 * author building a theme for somebody else's machine reads this menu before
 * they discover the theme names a sensor their PC does not have.
 */
it("names each reading for the question it answers", () => {
  expect(uiCopy.view.preview).toBe("The theme's sensors");
  expect(uiCopy.view.live).toBe("This machine");
  expect(uiCopy.view.dataSource).toBe("Readings from");
  expect(uiCopy.view.previewDetail).toBe("every sensor this theme names");
});

/**
 * **The origin word is pinned as a literal, because the drawings are its owner
 * and this table is not.** Every surface that prints it reads
 * `uiCopy.store.fromStore`, so a case asserting the badge says *that key* stays
 * green if the key's own value changes — and it did change once: *Installed* is
 * the **online** half's footer verb (`store-detail.html`), where a theme is read
 * against the catalogue rather than against this machine's copy, while the local
 * half badges its cells *From the store* (`store-themes.html`). One fact, two
 * views, two words; this is the only assertion that tells them apart.
 */
it("words the local origin badge the way the drawing does", () => {
  expect(uiCopy.store.fromStore).toBe("From the store");
});

/**
 * **The two store words the drawings settle, pinned as literals because the
 * drawings own them and this table does not.** Both were drift: the tabs read
 * `Local`/`Online` where both drawings label them `Your themes`/`Store`
 * (`store-browse.html:65-69`), and the kind badge read `Dashboard theme` where
 * both drawings draw `Theme` (`store-browse.html:122`, `store-detail.html:79`).
 * A case asserting the key would stay green through the value changing again.
 */
it("names the store's two halves the way the drawings label the tabs", () => {
  expect(uiCopy.store.halves.local).toBe("Your themes");
  expect(uiCopy.store.halves.online).toBe("Store");
});

it("names the dashboard theme kind the way the drawings badge it", () => {
  expect(uiCopy.store.cell.kinds["dashboard-theme"]).toBe("Theme");
});

/**
 * **The counts' nouns are pinned as literals, because the reading is the
 * claim** — see `uiCopy.store.counts` for the whole rule. One is a real case,
 * so both the singular and the plural are pinned.
 */
it("inflects each catalogue count's noun for the number it counts", () => {
  expect(uiCopy.store.counts.downloads(1)).toBe("download");
  expect(uiCopy.store.counts.downloads(2)).toBe("downloads");
  expect(uiCopy.store.counts.favorites(1)).toBe("favorite");
  expect(uiCopy.store.counts.favorites(2)).toBe("favorites");
});

/**
 * **An empty catalogue is not an empty library**, and the two words are pinned
 * as literals because the pair is the claim: a case asserting the keys would
 * stay green while the catalogue's sentence was rewritten into the library's,
 * which tells someone with a full library that they have nothing.
 */
it("says the store has nothing yet without calling the library empty", () => {
  expect(uiCopy.store.empty.catalogue).toBe("The store has nothing yet.");
  expect(uiCopy.store.empty.catalogueHint).toBe(
    "Themes published to the store will appear here.",
  );
});

/**
 * The refusal sentence is read by a person, so the identifier it carries is the
 * **wire value** and not a word this build invents: `widget-preset` is what the
 * catalogue declared and what the line must print.
 */
it("names a skipped kind by the identifier the catalogue declared", () => {
  expect(uiCopy.store.catalogueRefused("widget-preset", 1)).toContain(
    "widget-preset",
  );
  expect(uiCopy.store.catalogueRefused("widget-preset", 1)).toContain(
    "1 entry",
  );
  expect(uiCopy.store.catalogueRefused(undefined, 2)).toContain("2 entries");
});

/**
 * **The install's four sentences are pinned as literals**, because each names
 * a different outcome the person who pressed has to act on: no package to
 * install, a refusal with no host sentence, a host that installed the theme but
 * could not re-list it, and a success the live region announces. Keys-only
 * assertions would stay green if they were rewritten into one another, which is
 * exactly the mix-up that matters here — neither the success nor the stale
 * listing may read as a failure of the install.
 */
it("tells an install's no-package, refusal, stale-listing and success cases apart", () => {
  expect(uiCopy.store.install.noCatalogueVersion).toBe(
    "This item has no catalogue version to install.",
  );
  expect(uiCopy.store.install.refused(502)).toBe(
    "The host refused the install (502).",
  );
  expect(uiCopy.store.install.notRefreshed).toBe(
    "The theme was installed, but the library could not be refreshed.",
  );
  expect(uiCopy.store.install.installed("Aurora")).toBe(
    "Aurora was installed.",
  );
});

/**
 * **The submission's sentences are pinned as literals**, for the same reason
 * the install's are: each names a different thing the author does next — press,
 * enter a code, read the pull request, or try again after a sign-in expired —
 * and keys-only assertions would stay green if two were rewritten into one.
 */
it("pins the submission's sentences as literals", () => {
  expect(uiCopy.store.submit.label).toBe("Submit to the store");
  expect(uiCopy.store.submit.busy).toBe("Submitting…");
  expect(uiCopy.store.submit.authorising("ABCD-1234")).toBe(
    "Enter ABCD-1234 at github.com to approve this submission.",
  );
  expect(uiCopy.store.submit.open).toBe("Open github.com to approve");
  expect(uiCopy.store.submit.submitted).toBe("Pull request opened.");
  expect(uiCopy.store.submit.expired).toBe(
    "The GitHub sign-in expired. Submit again.",
  );
  expect(uiCopy.store.submit.denied).toBe(
    "The GitHub sign-in was denied. Submit again.",
  );
});

/**
 * §9: a menu's rows are sentence case. The list is the menu's own — its three
 * names, its File and Edit rows and its View settings — not the whole table,
 * which carries `W`, `H`, `CPU`, `2K`, `(empty)` and `Left`/`Right`:
 * abbreviations, marks and a parenthesised gap, none of them a row a menu
 * prints. A row title-cased (`New From Starter`) or lower-cased (`value runs`)
 * is what this catches.
 *
 * **The count is guarded, in the same shape as the per-surface assertion.** The
 * case could pass by being fed nothing, so the Edit rows are counted against the
 * six the menu is specified to hold (`EDIT_MENU_ROWS`), not against the length of
 * the list the case derives: a row dropped from the menu's owner shrinks both it
 * and this list together, which a derived count could not see.
 */
it("prints every menu row in sentence case", () => {
  const rows = menuRows();
  const editLabels = new Set(EDIT_MENU_ROWS.map((row) => row.label));
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.filter((row) => editLabels.has(row)).length).toBe(6);
  for (const row of rows) expect(isSentenceCase(row), row).toBe(true);
});

/**
 * The digit arm of the first-word rule, on the shapes that reach it. This menu
 * already prints `30 FPS` and `1 FPS`, so a digit-led row is one edit away —
 * and `^[A-Z0-9]` alone admitted any of them, `3d view` included, which is how
 * `2d mode` would have slipped through a sentence-case net unnoticed.
 */
it("reads the first letter of the first word, not its first character", () => {
  expect(isSentenceCase("30 FPS")).toBe(true);
  expect(isSentenceCase("3D view")).toBe(true);
  expect(isSentenceCase("Tokens")).toBe(true);
  expect(isSentenceCase("3d view")).toBe(false);
  expect(isSentenceCase("2d mode")).toBe(false);
  expect(isSentenceCase("(empty)")).toBe(false);
});

/**
 * The rows `ShellMenuBar` renders. Read from the menu's own owners rather than
 * from the whole table: the three names are `uiCopy.menus`, the File rows are
 * `uiCopy.file`, the Edit rows are `EDIT_MENU_ROWS` — the const the menu itself
 * maps over, because `uiCopy.actions` holds fourteen keys and only six are Edit
 * rows, so no `Object.values` derives them — and the View rows are `uiCopy.view`
 * less the one entry no menu prints: `previewDetail` is the status line under
 * the source control (`live-source.ts`), not a row. A row added to File or View
 * is covered by the derivation; one added to Edit is covered by the const.
 */
function menuRows(): string[] {
  return [
    uiCopy.menus.file,
    uiCopy.menus.edit,
    uiCopy.menus.view,
    ...Object.values(uiCopy.file),
    ...EDIT_MENU_ROWS.map((row) => row.label),
    ...Object.values(uiCopy.view).filter(
      (row) => row !== uiCopy.view.previewDetail,
    ),
  ];
}

/** Sentence case: the first word carries the capital and no later word is
 *  capitalised like a title. A later acronym (`FPS`) is all caps and is not
 *  title case, so `30 FPS` passes and `New From Starter` does not; a lower-cased
 *  first word (`value runs`) fails.
 *
 *  The capital is read off the first token's first **letter**, so a leading
 *  digit is not a licence: `30 FPS` and `1 FPS` pass because their first token
 *  carries no letter at all, `3D view` passes on the `D`, and `3d view` — the
 *  shape `2d mode` would have in this very menu — fails. A row leading with a
 *  non-alphanumeric still fails, which is a loud false positive rather than a
 *  silent pass; nothing produces that shape. */
function isSentenceCase(row: string): boolean {
  const [first, ...rest] = row.split(/\s+/);
  // The guard is the narrowing `noUncheckedIndexedAccess` requires of a
  // destructured `string[]`, not a branch `split` can reach.
  if (first === undefined || !/^[A-Z0-9]/.test(first)) return false;
  if (/^[^A-Za-z]*[a-z]/.test(first)) return false;
  return rest.every((word) => !/^[A-Z][a-z]/.test(word));
}
