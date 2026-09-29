import { type ChildProcess, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import {
  buildComposition,
  importBackdrop,
  openBlankComposition,
} from "./rebuild-composition.js";
import { chooseToken, readObject, selectLayer } from "./rebuild-driver.js";
import { isDesktopSurface } from "./surface.js";

/**
 * The rebuilt composition, **on a display** — the half the rebuild did not do.
 *
 * The region specs prove the surface can *express* the composition and the save
 * spec proves the package *persists* it. Neither proves it is *viewable*, and a
 * dashboard that renders differently on a player than in an editor is exactly
 * the finding this pass exists to catch. Given a phone is the main display type,
 * this runs at a phone's size as well as the artboard's.
 *
 * **The backdrop is imported, never written.** `res/author-journey-backdrop.jpg`
 * goes in through the editor's own `Import asset` control and onto the artboard
 * through `Background media` — the two controls an author has. Nothing here
 * writes a declaration, and the asset id the package carries is the one the
 * editor minted.
 *
 * One real host, on its own port, over its own themes directory: the player
 * bundle a preview server serves cannot load a theme package, and the whole
 * point is the host's own route.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
/** The user's own photograph, committed for exactly this. `here` is
 * `src/web/tests/e2e`, and `res/` is at the repository root. */
const BACKDROP = path.join(
  here,
  "..",
  "..",
  "..",
  "..",
  "res",
  "author-journey-backdrop.jpg",
);
/** A port no other agent and no Playwright runner owns. */
const HOST_PORT = 4224;
const THEMES_DIR = path.join(here, "..", "..", ".e2e-display-themes");
/** The blank theme's own id (`new-fabric-theme.ts`), which is what the host keys. */
const THEME_ID = "vigilia-new-theme";
const HOST = `http://127.0.0.1:${HOST_PORT}`;

/** The two sizes the composition has to survive. A phone is the main display. */
const DISPLAYS = [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "phone", width: 390, height: 844 },
] as const;

async function startHost(): Promise<ChildProcess> {
  const child = spawn(
    "node",
    [
      "packages/host/bin/vigilia.js",
      "--no-browser",
      "--port",
      String(HOST_PORT),
      "--themes-dir",
      THEMES_DIR,
    ],
    { cwd: process.cwd(), stdio: "ignore" },
  );
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${HOST}/api/health`)).ok) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill();
  throw new Error(`the display host never answered on ${HOST_PORT}`);
}

/**
 * The player's own frame, not the page's: the artboard is what a display shows,
 * and a screenshot of the whole window measures the host's chrome too.
 */
async function shootDisplay(
  page: Page,
  display: (typeof DISPLAYS)[number],
): Promise<void> {
  await page.setViewportSize({
    width: display.width,
    height: display.height,
  });
  // `data=live` is what a display runs on; the default is the same document
  // with every reading painted as a gap, which would prove nothing.
  await page.goto(`${HOST}/?theme=${THEME_ID}&data=live`);
  // The chart families draw from a rolling window, so a frame caught before
  // the first sample would be an empty card rather than the composition.
  await page.waitForFunction(
    () => !document.querySelector("[data-vigilia-load-failure]"),
    undefined,
    { timeout: 30_000 },
  );
  // A frame caught while the stream is still opening is a card of gaps, which
  // is §97 behaving correctly and proves nothing about the composition. The
  // footer's own copy is the signal, so the wait is on the product's word — and
  // it is **not** swallowed: an earlier version caught the failure and carried
  // on, and the screenshot it took was a dashboard of em-dashes that cost an
  // hour of diagnosis. A capture that cannot show live data should fail here
  // rather than produce a picture that reads as a broken product.
  await page.waitForFunction(
    () => !document.body.innerText.includes("Connecting to the host"),
    undefined,
    { timeout: 60_000 },
  );
  // And the charts need a few samples before they are a chart rather than a
  // spike at the right edge, which is what a display four minutes old shows.
  await page.waitForTimeout(20_000);
  await page.screenshot({
    path: `test-results/display/player-${display.name}.png`,
  });
}

test.describe("the rebuilt composition, on a display", () => {
  let host: ChildProcess | undefined;

  test.beforeAll(async () => {
    rmSync(THEMES_DIR, { recursive: true, force: true });
    mkdirSync(THEMES_DIR, { recursive: true });
    host = await startHost();
  });

  test.afterAll(() => {
    host?.kill();
  });

  test("the author's backdrop, the cards, and both display sizes", async ({
    page,
    context,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
    // All eight regions in **one** document, then two displays, the editor
    // reading the same package back, and the material assertions. The region
    // specs each fit 30 s because each is one region; this is the composition
    // plus a host plus a wait for the charts to fill their window, so the
    // default is not the right budget and the honest one is stated here.
    test.setTimeout(600_000);

    // ---- the editor half: build it the way an author would ----
    await page.goto("/");
    await page.waitForSelector("#canvas-host canvas");
    await openBlankComposition(page);
    await buildComposition(page);
    await importBackdrop(page, BACKDROP);

    /** The header's own control, written where the host can serve it. */
    const saveToHost = async (): Promise<void> => {
      const download = page.waitForEvent("download");
      await page.locator("[data-vigilia-save-package]").click();
      const file = await (await download).path();
      expect(file, "Save package should write a package").not.toBeNull();
      copyFileSync(file!, path.join(THEMES_DIR, `${THEME_ID}.vigilia-theme`));
    };

    // The display gets **its own page**. The editor document lives in this
    // one's memory, and a navigation to the host would unload it — so every
    // capture of the same document has to happen without leaving the editor.
    const screen = await context.newPage();

    // ---- the display half: the document as the surface authored it ----
    await saveToHost();
    for (const display of DISPLAYS) await shootDisplay(screen, display);

    // ---- and the editor, showing the same package ----
    //
    // Reopened through `File ▸ Open package`, the control a person clicks, so
    // the editor frame is the product's own reading of the saved document rather
    // than the composition that was still in memory. A difference between this
    // and the player is a finding about the round trip; a difference between
    // this and what was just on screen is a finding about the save.
    const reopened = await context.newPage();
    await reopened.goto("/");
    await reopened.waitForSelector("#canvas-host canvas");
    const openPackage = reopened.waitForEvent("filechooser");
    await reopened.getByRole("button", { name: "File", exact: true }).click();
    await reopened
      .getByRole("menuitem", { name: "Open package", exact: true })
      .click();
    // The dirty-document guard, and it is **correct**: the editor opens on the
    // starter, which nobody has edited and which therefore counts as unsaved
    // work. Without this the file chooser never opens and the step hangs until
    // the test times out with no message saying why — the same shape as issue
    // #7, met from the other side.
    const discard = reopened.getByRole("button", {
      name: "Discard",
      exact: true,
    });
    if (await discard.isVisible().catch(() => false)) await discard.click();
    await (await openPackage).setFiles(
      path.join(THEMES_DIR, `${THEME_ID}.vigilia-theme`),
    );
    await reopened.waitForTimeout(5_000);
    await reopened.screenshot({
      path: "test-results/display/editor-desktop.png",
    });
    await reopened.close();

    // ---- F2.12, asserted rather than screenshotted ----
    //
    // Every glass card this document authors is filled with `palette.panel`
    // at 85%, and the frosted material is one select away in the Fill picker
    // under a different control. Asserting that is cheaper, faster and more
    // durable than capturing a second frame of the same scene with a different
    // fill, and it says the thing that is actually wrong: the control labelled
    // "Frosted glass" did not put the frosted material on the card.
    const cpuCard = await readObject(page, "cpu-card");
    expect(
      (cpuCard?.["vigiliaPaint"] as { fill?: string } | undefined)?.fill,
      "a card the author frosted carries the frosted material",
    ).toBe("palette.panel");

    // The material is reachable — which is what makes this a second-owner
    // defect rather than an unreachable one, and the whole of issue #11.
    await selectLayer(page, "cpu-card");
    await chooseToken(page, "[data-vigilia-panel-fill]", "Frosted panel");
    expect(
      (await readObject(page, "cpu-card"))?.["vigiliaPaint"],
      "one select in the Fill picker reaches palette.frost",
    ).toEqual({ fill: "palette.frost", stroke: "palette.panelStroke" });

    await screen.close();
  });
});
