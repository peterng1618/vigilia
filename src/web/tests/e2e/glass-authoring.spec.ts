import { expect, type Locator, type Page, test } from "@playwright/test";
import { readThemePackage, writeThemePackage } from "@vigilia/theme-package";
import { captureVisualReview, clientOfScene } from "./editor-canvas.js";
import {
  AUTHORING_PANEL_ID,
  GLASS_ARTBOARD,
  GLASS_ENVELOPE,
  glassStripesPng,
} from "./glass-fixture.js";
import { assertBlur, readGlass } from "./glass-probe.js";

const EDITOR = "http://127.0.0.1:4174/";

/**
 * The glass control, driven in the real editor over a real backdrop.
 *
 * The unit suite can prove that the control writes a property; only a browser
 * can prove the pixels that property produces. This is the editor mount, the
 * one whose background media loads, so the blur is measurable here — the
 * player's media 404s (issue #3), which is why the player's evidence is the
 * starter's own scene rather than this backdrop.
 *
 * The panel is selected, styled and grouped through the product's own paths —
 * pointer for the canvas, keyboard for the controls — and a **grouped** panel is
 * measured as well as an ordinary one, because a control that only works while
 * its object is alone is not an authoring operation.
 */

/** The band, in artboard x, that sits inside the authoring panel. */
const BAND = { left: 80, width: 80 } as const;

const desktop = (name: string): void => {
  test.skip(name !== "desktop-chromium", "the editor is a desktop surface");
};

async function openFixture(page: Page): Promise<void> {
  const fixture = writeThemePackage({
    envelope: GLASS_ENVELOPE,
    assets: { "assets/stripes.png": glassStripesPng() },
  });
  if (!fixture.ok)
    throw new Error(`the glass fixture is invalid: ${fixture.message}`);

  await page.goto(EDITOR);
  await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
    name: "glass.vigilia-theme",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(fixture.bytes),
  });
  await expect(page.locator("#status")).toHaveText(
    "Opened glass.vigilia-theme",
  );
}

function activeId(page: Page): Promise<string | undefined> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: { getActiveObject(): { id?: string } | undefined };
            };
          };
        }
      ).vigiliaEditorBridge.editor.canvas.getActiveObject()?.id,
  );
}

/** Selects the authoring panel by clicking the canvas, through the camera. */
async function selectAuthoringPanel(page: Page): Promise<void> {
  const centre = await clientOfScene(
    page,
    AUTHORING_PANEL_ID,
    GLASS_ARTBOARD.width,
  );
  await page.mouse.click(centre.x, centre.y);
  await expect.poll(() => activeId(page)).toBe(AUTHORING_PANEL_ID);
  await page.getByRole("tab", { name: "Design", exact: true }).click();
}

/** Replaces a numeric field's value from the keyboard alone. */
async function typeInto(
  page: Page,
  field: Locator,
  value: string,
): Promise<void> {
  await field.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type(value);
  await page.keyboard.press("Tab");
}

async function saveEnvelope(page: Page): Promise<unknown> {
  const download = page.waitForEvent("download");
  await page.locator("[data-vigilia-save-package]").click();
  await expect(page.locator("#status")).toHaveText("Theme package saved");
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const parsed = readThemePackage(Buffer.concat(chunks));
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.envelope;
}

function treatmentOf(page: Page, id: string): unknown {
  return (
    saveEnvelope(page) as Promise<{
      scene: { objects: ReadonlyArray<Record<string, unknown>> };
    }>
  ).then(
    (envelope) =>
      envelope.scene.objects.find((object) => object["id"] === id)?.[
        "vigiliaGlass"
      ],
  );
}

test.describe("authoring frosted glass through the inspector", () => {
  test("gives an ordinary panel a real, measured backdrop blur, and undoes it", async ({
    page,
  }, testInfo) => {
    desktop(testInfo.project.name);
    await openFixture(page);
    await selectAuthoringPanel(page);

    const enabled = page.locator("[data-vigilia-glass-enabled]");
    const blur = page.locator("[data-vigilia-glass-blur]");
    await expect(enabled).toBeVisible();
    // Off to start: the panel carries no treatment, so there is no radius to
    // change and no box that would accept an edit and apply none.
    expect(await enabled.isChecked()).toBe(false);
    await expect(blur).toHaveCount(0);

    // Keyboard: focus the checkbox and press Space, the platform's own key for
    // it. Nothing here needs a bespoke key handler.
    await enabled.focus();
    await page.keyboard.press("Space");
    await expect(enabled).toBeChecked();
    await expect(blur).toBeVisible();
    const onEnable = Number(await blur.inputValue());
    expect(onEnable).toBeGreaterThan(0);

    // Keyboard: the radius, committed with Tab.
    await typeInto(page, blur, "24");
    await expect(blur).toHaveValue("24");

    // The pixels, which is the only thing the unit suite cannot reach.
    assertBlur(
      await readGlass(page, { id: AUTHORING_PANEL_ID, band: BAND }),
      "editor, authored through the control",
    );

    await captureVisualReview(page, testInfo, "editor-glass-authoring");

    // The saved document carries the treatment as authored state.
    expect(await treatmentOf(page, AUTHORING_PANEL_ID)).toEqual({
      blurRadius: 24,
    });

    // Undo steps back the radius edit, then the enable, and the panel itself
    // survives both.
    await page.keyboard.press("Control+z");
    await expect(blur).toHaveValue(String(onEnable));
    await page.keyboard.press("Control+z");
    await expect(enabled).not.toBeChecked();
    await expect(blur).toHaveCount(0);
  });

  test("refuses a radius past the published bound and puts the box back", async ({
    page,
  }, testInfo) => {
    desktop(testInfo.project.name);
    await openFixture(page);
    await selectAuthoringPanel(page);

    const enabled = page.locator("[data-vigilia-glass-enabled]");
    await enabled.focus();
    await page.keyboard.press("Space");
    const blur = page.locator("[data-vigilia-glass-blur]");
    const onEnable = Number(await blur.inputValue());

    await typeInto(page, blur, "999");

    // Refused, not clamped: a box reading the bound would look identical on
    // screen while the document carried a radius nobody chose.
    await expect(blur).toHaveValue(String(onEnable));
    expect(await treatmentOf(page, AUTHORING_PANEL_ID)).toEqual({
      blurRadius: onEnable,
    });
    // And through the field's own alert, the same one an empty value raises.
    await expect(page.locator(".vigilia-field [role='alert']")).toHaveCount(1);
  });

  test("carries the treatment through redo, duplicate and a token change", async ({
    page,
  }, testInfo) => {
    desktop(testInfo.project.name);
    await openFixture(page);
    await selectAuthoringPanel(page);
    await page.locator("[data-vigilia-glass-enabled]").focus();
    await page.keyboard.press("Space");
    await typeInto(page, page.locator("[data-vigilia-glass-blur]"), "24");

    // **Redo.** An edit an author can undo and get back is an edit the document
    // actually holds; a control whose history is one-way is a different promise.
    //
    // Focus leaves the number box first, because `edit.undo` and `edit.redo` are
    // deliberately deferred to a focused text field — Ctrl+Z in a number input is
    // that input's own undo, not the scene's. The radius box is the last control
    // in the panel, so Tab leaves focus on it, and the undo has to be aimed
    // somewhere real.
    await page.locator("[data-vigilia-glass-enabled]").focus();
    // Two entries, so two steps: the enable wrote one and the radius another.
    await page.keyboard.press("Control+z");
    await expect(page.locator("[data-vigilia-glass-blur]")).toHaveValue("16");
    expect(await treatmentOf(page, AUTHORING_PANEL_ID)).toEqual({
      blurRadius: 16,
    });
    await page.keyboard.press("Control+z");
    await expect(
      page.locator("[data-vigilia-glass-enabled]"),
    ).not.toBeChecked();
    expect(await treatmentOf(page, AUTHORING_PANEL_ID)).toBeUndefined();
    await page.keyboard.press("Control+y");
    await page.keyboard.press("Control+y");
    await expect(page.locator("[data-vigilia-glass-enabled]")).toBeChecked();
    await expect(page.locator("[data-vigilia-glass-blur]")).toHaveValue("24");
    expect(await treatmentOf(page, AUTHORING_PANEL_ID)).toEqual({
      blurRadius: 24,
    });

    // **A token change through the UI.** The treatment is not a colour, so a
    // palette edit must not disturb it — and the panel must stay attached and
    // keep compositing, which is what the pixels show.
    const centre = await clientOfScene(
      page,
      AUTHORING_PANEL_ID,
      GLASS_ARTBOARD.width,
    );
    await page.mouse.click(centre.x, centre.y);
    // The **stroke** token, not the fill: replacing the panel's own tint with
    // an opaque colour would legitimately hide the glass and the blur would
    // then have nothing to show. Changing the outline is a palette edit the
    // treatment has to survive, with the backdrop still visible behind it.
    await page.locator("[data-vigilia-palette-token]").selectOption("edge");
    const colour = page.locator("[data-vigilia-palette-color]");
    await colour.fill("rgb(200 220 255)");
    await colour.press("Tab");
    await expect(colour).toHaveValue("rgb(200 220 255)");

    expect((await treatmentOf(page, AUTHORING_PANEL_ID)) as unknown).toEqual({
      blurRadius: 24,
    });
    assertBlur(
      await readGlass(page, { id: AUTHORING_PANEL_ID, band: BAND }),
      "editor, after a token change",
    );

    // **Duplicate.** The clipboard carries `SCENE_PERSISTED_PROPERTIES`, which
    // includes the treatment; a copy without it would silently lose the blur.
    const before = (await saveEnvelope(page)) as {
      scene: { objects: ReadonlyArray<Record<string, unknown>> };
    };
    // History restores drop Fabric's selection, so the panel is clicked again
    // before the dock is asked to act — which is what an author does too.
    await selectAuthoringPanel(page);
    const dock = page.locator('[aria-label="Selected object actions"]');
    await dock.getByRole("button", { name: "Duplicate" }).click();
    const after = (await saveEnvelope(page)) as {
      scene: { objects: ReadonlyArray<Record<string, unknown>> };
    };
    // Counted by the radius this panel carries, because the fixture ships one
    // already-frosted panel of its own and a bare "has a treatment" count would
    // include it.
    const at = (envelope: {
      scene: { objects: ReadonlyArray<Record<string, unknown>> };
    }): number =>
      envelope.scene.objects.filter(
        (object) =>
          (object["vigiliaGlass"] as { blurRadius?: number } | undefined)
            ?.blurRadius === 24,
      ).length;
    expect(at(before)).toBe(1);
    expect(at(after)).toBe(2);
    // And the copy is a distinct object, not the original counted twice.
    expect(
      new Set(after.scene.objects.map((object) => object["id"])).size,
    ).toBe(after.scene.objects.length);
  });

  test("keeps a grouped panel's blur, so grouping is not a way to lose it", async ({
    page,
  }, testInfo) => {
    desktop(testInfo.project.name);
    await openFixture(page);
    await selectAuthoringPanel(page);

    const enabled = page.locator("[data-vigilia-glass-enabled]");
    await enabled.focus();
    await page.keyboard.press("Space");
    await typeInto(page, page.locator("[data-vigilia-glass-blur]"), "24");
    assertBlur(
      await readGlass(page, { id: AUTHORING_PANEL_ID, band: BAND }),
      "editor, before grouping",
    );

    // Group it with the ordinary panel beside it, through the dock's own action.
    const neighbour = await clientOfScene(page, "plain", GLASS_ARTBOARD.width);
    await page.keyboard.down("Shift");
    await page.mouse.click(neighbour.x, neighbour.y);
    await page.keyboard.up("Shift");
    const dock = page.locator('[aria-label="Selected object actions"]');
    await dock.getByRole("button", { name: "Group", exact: true }).click();

    // The grouping itself is asserted, because "the blur still reads" would
    // also be true of a test whose grouping quietly did nothing — and the probe
    // walks into groups, so a panel that never left the top level would be found
    // and measured just as happily.
    const placement = await page.evaluate((id) => {
      const canvas = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: {
                getObjects(): Array<{
                  get(name: string): unknown;
                  getObjects?(): Array<{ get(name: string): unknown }>;
                }>;
              };
            };
          };
        }
      ).vigiliaEditorBridge.editor.canvas;
      const top = canvas.getObjects().filter((o) => o.get("id") === id).length;
      let inGroup = false;
      for (const object of canvas.getObjects()) {
        for (const child of object.getObjects?.() ?? []) {
          if (child.get("id") === id) inGroup = true;
        }
      }
      return { top, inGroup };
    }, AUTHORING_PANEL_ID);
    expect(placement).toEqual({ top: 0, inGroup: true });

    // And the panel keeps compositing once it is inside one.
    assertBlur(
      await readGlass(page, { id: AUTHORING_PANEL_ID, band: BAND }),
      "editor, grouped",
    );
  });
});
