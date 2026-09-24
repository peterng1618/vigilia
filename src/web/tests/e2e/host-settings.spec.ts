import { writeFileSync } from "node:fs";
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
  HOST_THEME_ID,
  HOST_THEMES_DIR,
} from "./host-theme.js";

/** Drives the consumer settings page against the real host. The page is the
 * only surface where global settings and a theme's own questions meet, and the
 * difference is invisible anywhere else: reading `/api/devices` cannot tell a
 * choice the page hid from one the consumer saved. */

const HOST = `http://127.0.0.1:${HOST_PORT}`;

/** Every store sits in the seeded fixture directory, so each state below is
 * reachable by writing the same file the host reads — including after a
 * recycled server left state behind. */
const ACTIVE_FILE = path.join(HOST_THEMES_DIR, "active-theme.json");
const ANSWERS_FILE = path.join(HOST_THEMES_DIR, "theme-answers.json");

function resetStores(): void {
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

async function chooseTheme(page: Page, id: string): Promise<void> {
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
      testInfo.project.name !== "desktop-chromium",
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

  test("saves this PC's device choice with no theme chosen", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
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
      testInfo.project.name !== "desktop-chromium",
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
      await expect(page.locator(`label:has(input[data-name="${other}"])`)).toHaveText(
        reported,
      );
      await expect(page.locator('select[data-group="data-disk"]')).toHaveValue("");

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
      testInfo.project.name !== "desktop-chromium",
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
      testInfo.project.name !== "desktop-chromium",
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
      testInfo.project.name !== "desktop-chromium",
      "one desktop pass owns the shared host state",
    );

    resetStores();
    await page.goto(`${HOST}/settings`);
    await chooseTheme(page, HOST_THEME_ID);
    await expect(questions(page)).toBeHidden();
  });
});

test.describe("the settings page in a screenshot", () => {
  test("captures the question a theme raises", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium" ||
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
