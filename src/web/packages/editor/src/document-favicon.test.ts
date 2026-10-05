import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/**
 * Every served document names an icon the bundle actually carries.
 *
 * A document with no `<link rel="icon">` makes the browser probe
 * `/favicon.ico`, get a 404 and log it — on the editor that was the only
 * error on a clean load, which is exactly what makes a real one easy to miss
 * later. A link to a file the bundle does not carry produces the same 404 with
 * the same silence, so the file's existence and content are half the assertion.
 *
 * The editor and the player are separate documents with separate bundles, and
 * the mark is duplicated between them by hand, so both are checked here rather
 * than one being trusted to follow the other.
 */
const DOCUMENTS = [
  {
    name: "editor",
    /** Relative for the reason the bundle's own `base` is relative: the host
     *  mounts this document under `/editor/`, where an absolute path resolves
     *  against the *player's* dist and 404s (`packages/editor/vite.config.ts`).
     *  The player is mounted at the root by both hosts, so its own can be
     *  absolute — the test asks each for what its mount requires. */
    relative: true,
    document: fileURLToPath(new URL("../index.html", import.meta.url)),
    public: fileURLToPath(new URL("../public/", import.meta.url)),
  },
  {
    name: "player",
    relative: false,
    document: fileURLToPath(
      new URL("../../player/index.html", import.meta.url),
    ),
    public: fileURLToPath(new URL("../../player/public/", import.meta.url)),
  },
] as const;

/** Where a served href lands on disk. The bundle root is the document's own
 * directory, so the leading `./` or `/` is stripped rather than resolved as a
 * URL — resolved, an absolute href would escape to the filesystem root. */
const built = (site: (typeof DOCUMENTS)[number], href: string): string =>
  join(site.public, href.replace(/^\.?\//, ""));

/** `statSync` rather than `existsSync`: the shared Node typings are narrow on
 * purpose, and widening them for one assertion is not this test's business. */
const shipped = (path: string): boolean => {
  try {
    return statSync(path).isDirectory() === false;
  } catch {
    return false;
  }
};

for (const site of DOCUMENTS) {
  const declared = (): string =>
    readFileSync(site.document, "utf8").match(
      /<link\b[^>]*\brel="icon"[^>]*>/,
    )?.[0] ?? "";

  it(`${site.name} names the icon in a link the browser will fetch`, () => {
    const link = declared();
    expect(link, `${site.name}/index.html declares no icon link`).not.toBe("");
    const href = link.match(/\bhref="([^"]+)"/)?.[1];
    expect(href, `no href on ${link}`).toBeDefined();
    expect(
      site.relative ? href?.startsWith("./") : href?.startsWith("/"),
      `${site.name}'s ${href} is wrong for its mount`,
    ).toBe(true);
  });

  it(`${site.name} ships the file that link points at`, () => {
    const href = declared().match(/\bhref="([^"]+)"/)?.[1];
    expect(href).toBeDefined();
    const served = built(site, href ?? "");
    expect(shipped(served), `${href} is named but not built`).toBe(true);
    const mark = readFileSync(served, "utf8");
    // A path with an empty or truncated file behind it 404s nothing yet renders
    // nothing, which is the same invisible failure the 404 was. The root
    // element is what the browser needs; a comment may precede it.
    expect(mark, `${href} is not an SVG`).toMatch(/<svg[\s>][\s\S]*<\/svg>/);
    // An SVG that breaks XML's comment rule still exists, still contains a root
    // element and still 404s nothing: the browser refuses to decode it, which
    // is a blank tab and a silent regression. This one carried a CSS custom
    // property name in its comment, and a doubled hyphen is what XML forbids
    // there.
    const illegal = [...mark.matchAll(/<!--([\s\S]*?)-->/g)].flatMap(
      ([, b = ""]) => [...b.matchAll(/--/g)],
    );
    expect(illegal, `${href} has a comment XML cannot parse`).toEqual([]);
  });
}

it("draws the same mark on both surfaces", () => {
  // One product, one mark: a favicon is browser chrome, so a per-surface design
  // would be a second logo. The two copies are hand-kept in step, and this is
  // what notices when one drifts.
  const [editor, player] = DOCUMENTS.map((site) =>
    readFileSync(built(site, "favicon.svg"), "utf8"),
  );
  expect(player).toBe(editor);
});
