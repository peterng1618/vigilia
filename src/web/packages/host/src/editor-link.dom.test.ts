// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Where the host's pages send an author who wants to change a theme.
 *
 * Both pages offered "Open the editor" as a bare `/editor/`, and the editor
 * opened its own default whatever the URL said. So a consumer who picked a
 * theme, read its questions on `/settings` and went to change it arrived
 * somewhere else entirely — and the editor's own *Open library* dialog was the
 * only way back to a saved theme that existed.
 *
 * The pages are static documents the host serves as-is, so this reads the file
 * and runs its script against stubbed answers rather than importing anything.
 * Both pages are covered here because both carry the link, and the copy that
 * arrives second is the one that gets forgotten.
 */

// `import.meta.dirname`, not `fileURLToPath`: this runs under jsdom, whose
// `URL` is the browser's and which `fileURLToPath` refuses as a non-file URL.
const PUBLIC = join(import.meta.dirname, "../public");

/** The page's markup, minus the script the runner evaluates separately. */
function bodyOf(page: string): string {
  const html = readFileSync(join(PUBLIC, page), "utf8");
  return html
    .slice(html.indexOf("<body>") + "<body>".length, html.indexOf("</body>"))
    .replace(/<script[\s\S]*?<\/script>/, "");
}

/** The page's one module, with its import replaced by a stand-in.
 *  `/settings/theme-list.js` is a URL only a host serves, and what is under
 *  test here is the link beside the rows rather than the rows themselves —
 *  which are covered where they are drawn. The chooser calls it
 *  unconditionally, so it has to exist. */
function scriptOf(page: string): string {
  const html = readFileSync(join(PUBLIC, page), "utf8");
  return (
    html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1] ?? ""
  ).replace(
    // EVERY imported name, not a hard-coded one. `library.html` imports
    // `deleteTheme` as well as `themeList`, and a stand-in that named only the
    // first left the page calling something undefined — which read as three
    // failures in the editor-link tests and looked like a broken page.
    /^\s*import\s*\{([^}]*)\}[^\n]*$/gm,
    (_statement, names: string) =>
      names
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .map(
          (name) => `const ${name} = () => document.createDocumentFragment();`,
        )
        .join("\n"),
  );
}

const AsyncFunction = Object.getPrototypeOf(
  async (): Promise<void> => undefined,
).constructor as new (
  source: string,
) => () => Promise<void>;

const json = (body: unknown): Response =>
  ({
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

/** The answers both pages ask for. `active` is what the page should put on
 *  the link, and it is the only thing under test that varies. */
function stub(active: string | null): void {
  globalThis.fetch = (async (input: string) => {
    switch (input) {
      case "/api/themes/active":
        return json({ themes: [], templates: [], active });
      case "/api/devices":
        return json({
          available: { gpus: [], disks: [] },
          assigned: { assigned: {}, names: {} },
        });
      case "/api/display":
        return json({ zones: ["Europe/London"], settings: {} });
      default:
        return json({ required: [], answers: {} });
    }
  }) as unknown as typeof globalThis.fetch;
}

const realFetch = globalThis.fetch;

async function open(page: string, active: string | null): Promise<void> {
  document.body.innerHTML = bodyOf(page);
  stub(active);
  await new AsyncFunction(scriptOf(page))();
}

afterEach(() => {
  globalThis.fetch = realFetch;
  document.body.replaceChildren();
});

for (const page of ["settings.html", "library.html"]) {
  describe(`${page}'s link into the editor`, () => {
    it("carries the theme this PC is showing", async () => {
      await open(page, "living-room");

      // The point of the whole change: an author who picks a theme and then
      // goes to change it arrives on that theme. A bare `/editor/` did not,
      // and the editor silently opened something else.
      expect(document.querySelector("#editor-link")?.getAttribute("href")).toBe(
        "/editor/?theme=living-room",
      );
    });

    it("stays a plain link when no theme is active, because there is none to carry", async () => {
      await open(page, null);

      expect(document.querySelector("#editor-link")?.getAttribute("href")).toBe(
        "/editor/",
      );
    });

    it("names the editor in the link's own text, which is its accessible name", async () => {
      await open(page, "living-room");

      expect(document.querySelector("#editor-link")?.textContent).toBe(
        "Open the editor",
      );
    });
  });
}
