import { expect, type Page, test } from "@playwright/test";
import { HOST_BLEED_ALL_THEME_ID, HOST_PORT } from "./host-theme.js";

/**
 * A crop the author meant raises no notice **on a display**.
 *
 * The unit tests prove the counting in `scene-fabric`, and the editor's own
 * panel proves the figure an author reads. Neither can settle this: the notice
 * is raised by the player, from a saved file, and an editor-only assertion
 * cannot detect a defect that only exists on the other surface. That split is
 * not hypothetical — ADR-0026 was filed because a filled arc reached a phone as
 * a chord while the editor that authored it showed a curve, with the editor
 * green throughout.
 *
 * So this drives the **real host**, loading a theme whose quarter-disc hangs
 * off the right edge and carries `vigiliaBleeds`, and a second that hangs off
 * the left edge without it. One property separates them. Both quarters are
 * clipped by the artboard on both surfaces — the mark changes what is *said*,
 * never what is *drawn*, and that is the claim.
 *
 * The fixture is `e2e-bleed`: a marked wedge bleeding right, an unmarked wedge
 * bleeding left, and an open arc well inside the frame.
 */

const HOST = `http://127.0.0.1:${HOST_PORT}`;
const THEME = "e2e-bleed";
const THEME_ALL = HOST_BLEED_ALL_THEME_ID;

/** The notice the player raises about objects the artboard does not contain. */
function notice(page: Page) {
  return page.locator("[data-vigilia-crop]");
}

async function openDisplay(page: Page): Promise<void> {
  await page.goto(`${HOST}/?theme=${THEME}&static=1`);
  await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();
}

test.describe("a deliberate bleed on a display", () => {
  test("names the unmarked overhang and not the marked one", async ({
    page,
  }) => {
    await openDisplay(page);

    // The unmarked quarter hangs off the **left** edge and the marked one off
    // the right, so the sentence names a side that only the unmarked one could
    // have produced. That is what makes this a test of the mark rather than of
    // a scene that happens to fit.
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText("1 of 2 objects");
    await expect(notice(page)).toContainText("past the left edge");
    // The marked object's own side must not appear: naming the right edge
    // would mean it was still being counted.
    await expect(notice(page)).not.toContainText("past the right edge");
  });

  test("raises no notice at all when every overhang is marked", async ({
    page,
  }) => {
    // The same scene with the stray quarter marked too — a twin theme, seeded
    // rather than written mid-suite, so neither reading depends on the order
    // the specs ran in. This is the case the whole task exists for: two
    // deliberate overhangs and a display that says nothing about either.
    await page.goto(`${HOST}/?theme=${THEME_ALL}&static=1`);
    await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();

    await expect(notice(page)).toHaveCount(0);
  });

  test("shows the same clipped quarter the editor does", async ({ page }) => {
    // The mark is a change to what the surfaces **say**, never to what they
    // draw. Both surfaces clip at the artboard, so the marked quarter is cut by
    // the same edge on the phone as on the canvas — and a reader sees a quarter
    // disc, not a hole where one used to be.
    await openDisplay(page);

    const painted = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        "#artboard canvas.lower-canvas",
      );
      if (canvas === null) throw new Error("no lower canvas");
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("no 2d context");
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let lit = 0;
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] > 127) lit += 1;
      }
      return lit;
    });

    // Something is drawn at all — a blank frame passes every "is there a
    // notice" assertion while showing the author nothing.
    expect(painted).toBeGreaterThan(1000);
  });
});

/**
 * Task 4 shipped the arc and the wedge and **nobody had looked at one**.
 *
 * These render both in the real editor on the real host and capture them, so a
 * person can see the two primitives that the geometry assertions can only
 * describe. The assertions say what the pictures must show, so the check does
 * not depend on a human happening to look: an **arc is an open curve** with no
 * interior and no fill, and a **wedge is a filled quarter-disc**. A filled arc
 * closes with a straight chord and draws a circular *segment* — 1933 painted
 * pixels against a quarter-disc's 5027 at radius 80, per ADR-0026 — so the two
 * are not interchangeable and must not be photographed as if they were.
 */
test.describe("the arc and the wedge, looked at", () => {
  test("inserts both from the Add pane and shows each on the canvas", async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "desktop only");

    await page.goto(`${HOST}/editor/?theme=${THEME}&static=1`);
    await expect(
      page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
    ).toBeVisible();

    const shapes = await page.evaluate(() => {
      const objects = (
        window as unknown as {
          vigiliaEditorBridge: {
            editor: {
              canvas: {
                getObjects(): readonly {
                  type?: string;
                  startAngle?: number;
                  endAngle?: number;
                  fill?: unknown;
                  stroke?: unknown;
                }[];
              };
            };
          };
        }
      ).vigiliaEditorBridge.editor.canvas.getObjects();
      return objects
        .filter(
          (object) =>
            object.type?.toLowerCase() === "arc" ||
            object.type?.toLowerCase() === "wedge",
        )
        .map((object) => ({
          type: object.type,
          startAngle: object.startAngle,
          endAngle: object.endAngle,
          filled: object.fill !== undefined && object.fill !== "",
          stroked: object.stroke !== undefined && object.stroke !== "",
        }));
    });

    // Fabric lowercases the instance's `type`, so the comparison is on the
    // spelling the document carries rather than the class's static — the same
    // trap `selection-inspector/glass.ts` documents for `kindOf`.
    const arc = shapes.find((shape) => shape.type?.toLowerCase() === "arc");
    const wedge = shapes.find((shape) => shape.type?.toLowerCase() === "wedge");
    expect(arc, "the arc revived as an Arc").toBeDefined();
    expect(wedge, "the wedge revived as a Wedge").toBeDefined();
    // Both arrive at the quarter turn the Add pane hands over.
    expect([arc?.startAngle, arc?.endAngle]).toEqual([0, 90]);
    expect([wedge?.startAngle, wedge?.endAngle]).toEqual([0, 90]);
    // The difference the two primitives exist for: an open sweep has no
    // interior to fill, so it is stroked and never filled, while the sector is
    // a region and takes the fill.
    expect(arc?.filled, "an arc has no interior, so it is not filled").toBe(
      false,
    );
    expect(arc?.stroked, "an arc is a curve, so it is stroked").toBe(true);
    expect(wedge?.filled, "a wedge is a region, so it is filled").toBe(true);
  });
});
