import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import {
  HOST_DISK_THEME_ID,
  HOST_PORT,
  HOST_SETTINGS_DIR,
  HOST_THEME_ID,
  HOST_VIDEO_THEME_ID,
} from "./host-theme.js";
import { isDesktopSurface } from "./surface.js";

/** Drives the consumer settings page against the real host. The page is the
 * only surface where global settings and a theme's own questions meet, and the
 * difference is invisible anywhere else: reading `/api/devices` cannot tell a
 * choice the page hid from one the consumer saved. */

const HOST = `http://127.0.0.1:${HOST_PORT}`;

/** Every store sits in the app folder's settings directory, so each state below
 * is reachable by writing the same file the host reads — including after a
 * recycled server left state behind. They left the themes directory so that a
 * theme folder is only ever a theme (ADR-0017). */
const ACTIVE_FILE = path.join(HOST_SETTINGS_DIR, "active-theme.json");
const ANSWERS_FILE = path.join(HOST_SETTINGS_DIR, "theme-answers.json");

/**
 * The displays this host knows about, written by hand the same way the two
 * stores above are. Nothing else seeds a **paired** display, and the warning
 * table's other half needs one: a remote display is the row that must be told
 * nothing about a video background.
 *
 * Returns whatever was there before, so a record this spec invents is not left
 * behind for the cases that follow it.
 */
const DISPLAYS_FILE = path.join(HOST_SETTINGS_DIR, "display-clients.json");
const PAIRED_DISPLAY_ID = "kitchen-tablet";

function seedPairedDisplay(): string | undefined {
  let previous: string | undefined;
  try {
    previous = readFileSync(DISPLAYS_FILE, "utf8");
  } catch {
    previous = undefined;
  }

  const at = new Date("2026-10-19T00:00:00.000Z").toISOString();
  writeFileSync(
    DISPLAYS_FILE,
    `${JSON.stringify({
      displays: [
        {
          id: PAIRED_DISPLAY_ID,
          label: "Kitchen tablet",
          kind: "paired",
          createdAt: at,
          lastSeenAt: at,
          // A paired record with no credential is dropped on read: nothing
          // could ever authenticate as it, so it would not be a display.
          tokenHash: "e2e-paired-display-credential",
        },
      ],
    })}\n`,
    "utf8",
  );

  return previous;
}

function restoreDisplays(previous: string | undefined): void {
  if (previous === undefined) rmSync(DISPLAYS_FILE, { force: true });
  else writeFileSync(DISPLAYS_FILE, previous, "utf8");
}

function resetStores(): void {
  mkdirSync(HOST_SETTINGS_DIR, { recursive: true });
  writeFileSync(ACTIVE_FILE, "{}\n", "utf8");
  writeFileSync(ANSWERS_FILE, "{}\n", "utf8");
}

interface DeviceState {
  available: {
    gpus: { id: string; name: string }[];
    disks: { id: string; name: string }[];
  };
  assigned: Record<string, string>;
  names: Record<string, string>;
}

async function deviceState(request: APIRequestContext): Promise<DeviceState> {
  const body = (await (await request.get(`${HOST}/api/devices`)).json()) as {
    available: DeviceState["available"];
    assigned: {
      assigned?: Record<string, string>;
      names?: Record<string, string>;
    };
  };
  return {
    available: body.available,
    assigned: body.assigned.assigned ?? {},
    names: body.assigned.names ?? {},
  };
}

async function disksOn(request: APIRequestContext): Promise<string[]> {
  return (await deviceState(request)).available.disks.map((disk) => disk.id);
}

async function assignedSystemDisk(request: APIRequestContext): Promise<string> {
  return (await deviceState(request)).assigned["system-disk"] ?? "";
}

async function answersFor(
  request: APIRequestContext,
  id: string,
): Promise<Record<string, string>> {
  const response = await request.get(`${HOST}/api/themes/${id}/answers`);
  const body = (await response.json()) as { answers: Record<string, string> };
  return body.answers;
}

/** Chooses a theme for one display: the row is pressed first, because a theme
 *  is given *to* a display and the page writes whichever row is showing. */
async function chooseTheme(
  page: Page,
  id: string,
  display = "default",
): Promise<void> {
  await page.locator(`#themes [data-display="${display}"]`).click();
  await page.locator(`button.theme-option[data-theme="${id}"]`).click();
  await expect(
    page.locator(`button.theme-option[data-theme="${id}"]`),
  ).toHaveAttribute("aria-pressed", "true");
}

const questions = (page: Page) => page.locator("#questions-section");

test.describe("the settings page a consumer configures", () => {
  // One host process and one set of stores, so these states are travelled in
  // order rather than in parallel.
  test.describe.configure({ mode: "serial" });

  test("keeps this PC's devices on screen whatever theme is shown", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass owns the shared host state",
    );

    const disks = await disksOn(request);
    test.skip(disks.length === 0, "this machine reports no disks");

    resetStores();
    await page.goto(`${HOST}/settings`);
    const legends = page.locator("#groups fieldset legend");
    await expect(legends.first()).toBeVisible();
    const before = await legends.allTextContents();

    // The bug this guards: filtering the machine's own settings by the active
    // theme hides a drive the consumer chose and cannot reach again.
    await chooseTheme(page, HOST_DISK_THEME_ID);
    expect(await legends.allTextContents()).toEqual(before);

    await chooseTheme(page, HOST_THEME_ID);
    expect(await legends.allTextContents()).toEqual(before);
  });

  test("gives every display its own row, and writes the one that was pressed", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass owns the shared host state",
    );

    resetStores();
    await page.goto(`${HOST}/settings`);

    const map = (await (
      await request.get(`${HOST}/api/themes/active`)
    ).json()) as { displays: { id: string }[] };

    // The column: the default first, then one row per display this host holds.
    // The default leads because it is what a display with no choice of its own
    // already gets, so it is the row the page opens on.
    const rows = page.locator("#themes [data-display]");
    await expect(rows).toHaveCount(1 + map.displays.length);
    await expect(rows.first()).toHaveAttribute("data-display", "default");
    await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
    await expect(rows.first()).toContainText("Nothing chosen");
    await expect(rows.nth(1)).toHaveAttribute("data-display", "this-pc");
    await expect(rows.nth(1)).toContainText("This PC");
    await expect(rows.nth(1)).toContainText("Uses the default");

    // One display's theme is not another's: choosing for this PC leaves the
    // default where it was, and the row says which theme it now holds.
    await chooseTheme(page, HOST_THEME_ID, "this-pc");

    await expect(rows.nth(1)).toContainText("E2E hosted");
    await expect(rows.first()).toContainText("Nothing chosen");

    const after = (await (
      await request.get(`${HOST}/api/themes/active`)
    ).json()) as {
      default: string | null;
      displays: { id: string; theme: string | null }[];
    };
    expect(after.default).toBeNull();
    expect(after.displays.find((row) => row.id === "this-pc")?.theme).toBe(
      HOST_THEME_ID,
    );
  });

  test("saves this PC's device choice with no theme chosen", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass owns the shared host state",
    );

    const disks = await disksOn(request);
    test.skip(disks.length === 0, "this machine reports no disks");

    resetStores();
    await page.goto(`${HOST}/settings`);
    await expect(questions(page)).toBeHidden();
    await expect(page.locator("button.theme-option .current")).toHaveCount(0);

    const chosen = disks[0]!;
    await page.locator('select[data-group="system-disk"]').selectOption(chosen);
    await expect(page.locator("#status")).toHaveText(
      "Saved. Displays update on their next frame.",
    );
    expect(await assignedSystemDisk(request)).toBe(chosen);

    await page.reload();
    await expect(page.locator('select[data-group="system-disk"]')).toHaveValue(
      chosen,
    );
  });

  test("names the device the consumer edited, not the first one", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass owns the shared host state",
    );

    const before = await deviceState(request);
    test.skip(
      before.available.disks.length < 2,
      "this machine reports fewer than two disks",
    );

    resetStores();
    const first = before.available.disks[0]!.id;
    const other = before.available.disks[1]!.id;
    const reported = before.available.disks[1]!.name;
    await request.put(`${HOST}/api/devices`, {
      data: { assigned: before.assigned, names: {} },
    });

    try {
      await page.goto(`${HOST}/settings`);

      // One field per reported device, labelled by that device. The bug this
      // guards: a group following the default points at no single device, and a
      // name field hung off the group renamed whichever device came first.
      const field = page.locator(`#groups input[data-name="${other}"]`);
      await expect(page.locator("#groups input[data-name]")).toHaveCount(
        before.available.gpus.length + before.available.disks.length,
      );
      await expect(
        page.locator(`label:has(input[data-name="${other}"])`),
      ).toHaveText(reported);
      await expect(page.locator('select[data-group="data-disk"]')).toHaveValue(
        "",
      );

      await field.fill("Archive");
      await field.blur();
      await expect(page.locator("#status")).toHaveText(
        "Saved. Displays update on their next frame.",
      );

      const after = await deviceState(request);
      expect(after.names[other]).toBe("Archive");
      expect(after.names[first]).toBeUndefined();
    } finally {
      await request.put(`${HOST}/api/devices`, {
        data: { assigned: before.assigned, names: before.names },
      });
    }
  });

  test("keeps both display preferences whichever one is saved", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass owns the shared host state",
    );

    // `display.json` is in the same directory but not in `resetStores`, so this
    // clears it too.
    await request.put(`${HOST}/api/display`, { data: {} });
    await page.goto(`${HOST}/settings`);
    await expect(page.locator("#timezone option").first()).toBeAttached();

    try {
      await page.locator("#measurement").selectOption("imperial");
      await expect(page.locator("#status")).toHaveText(
        "Saved. Displays already open keep their old units until they reload.",
      );

      // The host replaces the whole settings object, so a page that sent one
      // field at a time would drop the other without saying so.
      await page.locator("#timezone").selectOption("Asia/Tokyo");
      await expect(page.locator("#status")).toHaveText(
        "Saved. Displays update on their next frame.",
      );

      const body = (await (
        await request.get(`${HOST}/api/display`)
      ).json()) as { settings: unknown };
      expect(body.settings).toEqual({
        timeZone: "Asia/Tokyo",
        measurement: "imperial",
      });

      await page.reload();
      await expect(page.locator("#timezone")).toHaveValue("Asia/Tokyo");
      await expect(page.locator("#measurement")).toHaveValue("imperial");
    } finally {
      await request.put(`${HOST}/api/display`, { data: {} });
    }
  });

  test("asks a theme's disk question once, and remembers the answer", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass owns the shared host state",
    );

    const disks = await disksOn(request);
    test.skip(disks.length === 0, "this machine reports no disks");

    resetStores();
    const global = await assignedSystemDisk(request);
    // A disk this PC is not already using, so the theme's answer is a real
    // override rather than an echo of the machine's choice.
    const other = disks.find((disk) => disk !== global) ?? disks[0]!;

    await page.goto(`${HOST}/settings`);
    await chooseTheme(page, HOST_DISK_THEME_ID);
    await expect(questions(page)).toBeVisible();
    // The theme reads a disk and nothing else, so one question, once.
    await expect(page.locator("#questions fieldset legend")).toHaveText([
      "System disk",
    ]);

    await page
      .locator('select[data-question="system-disk"]')
      .selectOption(other);
    await expect(page.locator("#status")).toHaveText(
      "Saved. Only this theme is affected.",
    );

    // Answered: the question stops being asked, and the answer is stored
    // against the theme rather than against the machine.
    await expect(questions(page)).toBeHidden();
    expect(await answersFor(request, HOST_DISK_THEME_ID)).toEqual({
      "system-disk": other,
    });
    expect(await assignedSystemDisk(request)).toBe(global);

    await page.reload();
    await expect(questions(page)).toBeHidden();
    await expect(page.locator('select[data-group="system-disk"]')).toHaveValue(
      global,
    );
  });

  test("shows no questions for a theme that reads nothing", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass owns the shared host state",
    );

    resetStores();
    await page.goto(`${HOST}/settings`);
    await chooseTheme(page, HOST_THEME_ID);
    await expect(questions(page)).toBeHidden();
  });

  /**
   * The assignment says what a theme will cost the display it is being given
   * to, before the press. A video background with no glass is the only cost
   * whose answer depends on that display, so this is the case the whole table
   * exists for.
   */
  test("says what a theme will cost the display it is given to", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo),
      "one desktop pass owns the shared host state",
    );

    resetStores();
    const previous = seedPairedDisplay();

    try {
      await page.goto(`${HOST}/settings`);
      const note = page.locator(
        `.theme-row:has([data-theme="${HOST_VIDEO_THEME_ID}"]) .theme-cost-note`,
      );

      // This PC is a host monitor, and the note is on the row before anything
      // is pressed: it describes the pair a press would commit.
      await page.locator('#themes [data-display="this-pc"]').click();
      await expect(note).toBeVisible();
      await expect(note).toContainText(/idle/i);

      // The press, for this PC. The page re-renders its rows from the write's
      // own answer, which is also the reload a press-time note would not
      // survive — so the assertion after it is the one that matters.
      await page
        .locator(`button.theme-option[data-theme="${HOST_VIDEO_THEME_ID}"]`)
        .click();
      await expect(page.locator("#status")).toHaveText(
        "Saved. Displays show it on their next load.",
      );
      await expect(note).toBeVisible();

      // A paired display across the room pays nothing for the same theme, and
      // is told nothing: a phone showing video is doing what a phone does.
      //
      // **Present, and then hidden** — in that order, because `toBeHidden()`
      // alone passes on a locator that matches nothing, so it would be
      // satisfied by the note never being drawn for this row at all.
      await page
        .locator(`#themes [data-display="${PAIRED_DISPLAY_ID}"]`)
        .click();
      await expect(note).toHaveCount(1);
      await expect(note).toBeHidden();
    } finally {
      restoreDisplays(previous);
    }
  });
});

test.describe("the settings page in a screenshot", () => {
  test("captures the question a theme raises", async ({ page }, testInfo) => {
    test.skip(
      !isDesktopSurface(testInfo) ||
        process.env["VIGILIA_CAPTURE"] === undefined,
      "captures run on demand",
    );

    resetStores();
    await page.goto(`${HOST}/settings`);
    // The page reads its three sections at once; a capture is the settled page,
    // not whichever section happened to arrive first.
    await expect(page.locator("#status")).toHaveText(
      "Changes apply to every display immediately.",
    );
    await expect(page.locator("#timezone option").first()).toBeAttached();

    await chooseTheme(page, HOST_DISK_THEME_ID);
    await expect(questions(page)).toBeVisible();

    const directory =
      process.env["VIGILIA_CAPTURE_DIR"] ?? "../../docs/evidence/screenshots";
    const name = `settings-theme-question-${testInfo.project.name}.png`;
    const screenshot = await page.screenshot({
      fullPage: true,
      path: `${directory}/${name}`,
    });

    await testInfo.attach(name, {
      body: screenshot,
      contentType: "image/png",
    });
  });
});
