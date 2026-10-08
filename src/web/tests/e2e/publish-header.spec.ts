import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { writeThemePackage } from "@vigilia/theme-package";

/**
 * The header's publish surface, on a real host that is actually serving the LAN.
 *
 * **The editor is driven through the host's own `/editor/` mount**, not the
 * `vite preview` server. `createThemeLibraryClient()` uses `baseUrl: ""`, so the
 * editor fetches same-origin — and under `vite preview` that is a preview server
 * answering `/api/*` with a 404. The host's `/editor/` mount is loopback-only,
 * which is where Playwright already is, so it is the only arrangement in which
 * `/api/hosting` is genuinely the same origin as the page.
 *
 * One real host, on its own port, over its own app folder, started **loopback-only
 * and without `--host`** — §145's default and Phase 3's whole claim: nothing but
 * this PC can reach the socket until somebody uses the control. The address it
 * reports once the control has been used is whatever `lanAddress()` answered on
 * this machine, which is the point: the header must render the *host's* answer
 * and never compose one of its own.
 *
 * **What this file does not prove.** That a camera on a particular phone, at a
 * particular distance, in a particular light, reads a code off a glossy screen.
 * That needs a phone and a person. Three things stand in its place and none of
 * them is that: `cli/hosting.test.ts` measures a real socket rebind on the same
 * port, `server.test.ts` refuses a non-loopback request until a session is
 * presented, and `qr-code.test.ts` decodes the symbol through a second library.
 * The gap is named rather than implied away by a green suite.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
/** A port no other agent and no Playwright runner owns. */
const PORT = 4227;
const APP_DIR = path.join(here, "..", "..", ".e2e-publish-app");
const THEMES_DIR = path.join(APP_DIR, "themes");
const HOST = `http://127.0.0.1:${PORT}`;

const THEME_ID = "e2e-publish";

/** One minimal, valid package, so the host starts with a real library rather
 *  than an empty folder. */
const envelope = {
  schemaVersion: 2 as const,
  fabricVersion: "7.4.0",
  id: THEME_ID,
  metadata: { name: "E2E publish", themeLanguage: "en" },
  artboard: {
    width: 640,
    height: 360,
    contentFit: "contain" as const,
    background: { ref: "palette.bar" },
    barColor: { ref: "palette.bar" },
  },
  globals: {
    palette: {
      // The immutable transparent token every package must carry.
      none: {
        name: "None",
        value: { kind: "solid" as const, color: "transparent" },
      },
      bar: { name: "Bar", value: { kind: "solid" as const, color: "#101318" } },
    },
    typePresets: {},
  },
  assets: [],
  scene: { version: "7.4.0" as const, objects: [] },
};

function seedLibrary(): void {
  const result = writeThemePackage({ envelope, assets: {} });
  if (!result.ok)
    throw new Error(`publish fixture is invalid: ${result.message}`);

  const folder = path.join(THEMES_DIR, THEME_ID);
  mkdirSync(path.join(folder, "assets"), { recursive: true });
  writeFileSync(path.join(folder, "theme.json"), JSON.stringify(envelope));
}

/** Loopback only, with no `--host`: the app directory is empty, so there is no
 *  `hosting.json` either and the host takes §145's default. */
async function startHost(): Promise<ChildProcess> {
  const child = spawn(
    "node",
    [
      "packages/host/bin/vigilia.js",
      "--no-browser",
      "--port",
      String(PORT),
      "--app-dir",
      APP_DIR,
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
  throw new Error(`the publish host never answered on ${PORT}`);
}

test.describe("the header's publish surface", () => {
  let host: ChildProcess | undefined;

  test.beforeAll(async () => {
    rmSync(APP_DIR, { recursive: true, force: true });
    mkdirSync(THEMES_DIR, { recursive: true });
    seedLibrary();
    host = await startHost();
  });

  test.afterAll(() => {
    host?.kill();
  });

  test("the LAN is turned on from the editor, and the port does not move", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await page.goto(`${HOST}/editor/`);

    // The one control *is* the toggle (§7.1), and the facts are its popover's:
    // the bar itself never carries an address.
    const publish = page.locator("[data-vigilia-publish]");
    const facts = page.locator(".editor-shell-publish-popup");
    await expect(publish).toBeVisible({ timeout: 30_000 });
    await expect(publish).toHaveAttribute("aria-pressed", "false");
    await expect(facts.locator("code")).toHaveCount(0);

    await publish.click();

    await expect(publish).toHaveAttribute("aria-pressed", "true");
    await expect(facts.locator("code")).toHaveText(new RegExp(`:${PORT}$`));
    await expect(facts.locator("[data-vigilia-qr]")).toBeVisible();

    // Still the same origin, which is the claim `createHostBinding` makes.
    expect(page.url()).toContain(`127.0.0.1:${PORT}/editor/`);

    await publish.click();
    await expect(facts.locator("code")).toHaveCount(0);
  });

  test("the control carries the address and a code for it", async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto(`${HOST}/editor/`);

    const publish = page.locator("[data-vigilia-publish]");
    const facts = page.locator(".editor-shell-publish-popup");
    await expect(publish).toBeVisible({ timeout: 30_000 });

    // The host starts loopback-only, so the address exists only once the
    // control has been used — there is no `--host` flag left to arrange it with.
    await publish.click();
    await expect(facts.locator("code")).toBeVisible({ timeout: 30_000 });

    const shown = await facts.locator("code").textContent();
    expect(shown).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/);

    const qr = facts.locator("[data-vigilia-qr]");
    const box = await qr.boundingBox();
    // A camera needs modules, not a thumbnail: 45 modules at 3 px.
    expect(box?.width).toBeGreaterThanOrEqual(120);
    expect(
      (await qr.getAttribute("aria-label"))?.startsWith("QR code: http://"),
    ).toBe(true);

    // 1680 px, which is the `publish` project's own viewport.
    await page.screenshot({
      path: "test-results/publish/header-desktop.png",
      fullPage: false,
    });

    // The same control at a phone's width, and *read* rather than only
    // photographed. Whether the surface is still inside that viewport is
    // `vg-172`'s question, not this assertion's: it says the control is still
    // rendered, which is all a DOM read can say about it.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(facts.locator("code")).toBeVisible();
    await expect(qr).toBeVisible();
    await page.screenshot({
      path: "test-results/publish/header-390.png",
      fullPage: false,
    });

    // Leave the host off, because the first test reads the off state.
    await publish.click();
    await expect(facts.locator("code")).toHaveCount(0);
  });

  test("a forwarded-for header does not move the guard off the socket", async ({
    request,
  }) => {
    const answered = await request.put(`${HOST}/api/hosting`, {
      data: { lan: true },
      headers: { "x-forwarded-for": "192.168.1.50" },
    });
    // A *header* claiming another origin changes nothing, because the guard reads
    // `request.socket.remoteAddress` — which is why this is 200 from loopback and
    // why the refusal itself is `server.test.ts`'s to prove, not this file's. The
    // test is here to pin the direction: a proxy header must never be what decides
    // whether this PC is exposed.
    expect(answered.status()).toBe(200);
  });
});
