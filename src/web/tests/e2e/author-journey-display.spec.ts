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
import { chooseToken, selectLayer } from "./rebuild-driver.js";
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

/** The eight frosted cards, by the names `buildComposition` gives them. */
const CARDS = [
  "time-card",
  "cpu-card",
  "gpu-card",
  "ram-card",
  "vram-card",
  "trends-card",
  "storage-card",
  "network-card",
] as const;

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
  // A frame caught while the stream is still opening reads as a card of gaps,
  // which is §97 behaving correctly and proves nothing about the composition.
  // The footer's own copy is the signal, so the wait is on the product's word.
  await page
    .waitForFunction(
      () => !document.body.innerText.includes("Connecting to the host"),
      undefined,
      { timeout: 30_000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(6_000);
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
    // All eight regions in **one** document, then three displays. The region
    // specs each fit 30 s because each is one region; this is the composition
    // plus a host plus a wait for the charts to fill their window, so the
    // default is not the right budget and the honest one is stated here.
    test.setTimeout(900_000);

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
    // one's memory, and a navigation to the host would unload it — so the two
    // captures of the same document, before and after a material change, have
    // to happen without ever leaving the editor.
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
    await (await openPackage).setFiles(
      path.join(THEMES_DIR, `${THEME_ID}.vigilia-theme`),
    );
    await expect
      .poll(async () => (await reopened.locator("canvas").count()) > 0)
      .toBe(true);
    await reopened.waitForTimeout(4_000);
    await reopened.screenshot({
      path: "test-results/display/editor-desktop.png",
    });
    await reopened.close();

    // ---- and the material the reference composition itself uses ----
    //
    // `frostedCard()` fills a glass card with `palette.frost` (30%), and the
    // Fill picker lists it by name, so the frosted material is reachable — by
    // a second control, one the author has to know to find. This frame is the
    // same document with that token on all eight cards, applied through the
    // real picker, and it is what says whether the 30 % tint reads as glass
    // where the 85 % `panel` tint did not.
    for (const card of CARDS) {
      await selectLayer(page, card);
      await chooseToken(page, "[data-vigilia-panel-fill]", "Frosted panel");
    }
    await saveToHost();
    await shootDisplay(screen, {
      name: "desktop-frosted",
      width: 1920,
      height: 1080,
    });
    await screen.close();
  });
});
