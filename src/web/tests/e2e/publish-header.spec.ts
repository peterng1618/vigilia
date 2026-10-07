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
 * One real host, on its own port, over its own app folder, bound to the LAN with
 * `--host 0.0.0.0` — the flag Phase 2 still uses. The address it reports is
 * whatever `lanAddress()` answered on this machine, which is the point: the
 * header must render the *host's* answer and never compose one of its own.
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

async function startHost(): Promise<ChildProcess> {
  const child = spawn(
    "node",
    [
      "packages/host/bin/vigilia.js",
      "--no-browser",
      "--port",
      String(PORT),
      "--host",
      "0.0.0.0",
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

  test("the header carries the address and a code for it", async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto(`${HOST}/editor/`);

    const publish = page.locator("[data-vigilia-publish]");
    await expect(publish).toBeVisible({ timeout: 30_000 });

    const shown = await publish.locator("code").textContent();
    expect(shown).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/);

    const qr = publish.locator("[data-vigilia-qr]");
    const box = await qr.boundingBox();
    // A camera needs modules, not a thumbnail: 45 modules at 3 px.
    expect(box?.width).toBeGreaterThanOrEqual(120);
    expect(
      (await qr.getAttribute("aria-label"))?.startsWith("QR code: http://"),
    ).toBe(true);

    await page.screenshot({
      path: "test-results/publish/header-desktop.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/publish/header-390.png",
      fullPage: false,
    });
  });
});
