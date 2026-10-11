import { expect, type Page, test } from "@playwright/test";
import { HOST_PORT, HOST_THEME_ID } from "./host-theme.js";

/**
 * §13.1's keyboard-only walkthrough, on the real host.
 *
 * The editor is driven through the host's own `/editor/` mount, never a preview
 * server: the walkthrough's own round trip ends by asking whether the document
 * came back unchanged, and the document is the host's file. `desktop-host`
 * boots that host through its `webServer`.
 *
 * **This file is a host spec for the reason the others are**, and
 * `playwright.config.ts`'s `HOST_SPECS` admits it by name for the same reason.
 *
 * This task's own job is the census: does every region of the shell have a
 * focus target a keyboard can reach, and does each of those targets have a
 * name. A later task cannot be written on an answer of no.
 */

const HOST = `http://127.0.0.1:${HOST_PORT}`;

/**
 * The shell's regions.
 *
 * **Taken from DESIGN.md §7's own drawing, not invented to fit a result.** Its
 * labelled bands are `header · rail · pane · stage · inspector · status bar`.
 * The four here are the body's — the ones §13.1's interactions move through,
 * and the ones that own a focusable surface: the rail chooses a pane, the pane
 * holds the scene tree, the stage holds the canvas and its dock, the inspector
 * holds the selection's own column.
 *
 * The header and the status bar are outside the set because nothing in
 * §13.1's order lands in either: the header's menus and publish control are
 * commands about a finished document, and the status bar is a readout. That is
 * a reading of the drawing, so it is written down here rather than left
 * implicit — if a later task reaches a control in one of them, the region
 * belongs in this list and the list is what moves.
 *
 * Each region's selector is the shell's own class or id, the same ones
 * `shell-appearance.spec.ts`, `inspector-sections.spec.ts` and
 * `editor-rail.spec.ts` browse by. A region whose element was renamed would
 * fail here rather than quietly stop being censused.
 *
 * **A second, independent statement of the same four**: `vg-231` in the
 * register calls `.editor-shell-body`'s children "the shell's four body
 * regions", and names them rail, pane, stage and inspector. Two documents and
 * the drawing agree, which is why this list is a reading rather than a guess.
 */
const REGIONS = ["rail", "pane", "stage", "inspector"] as const;

type Region = (typeof REGIONS)[number];

const REGION_SELECTOR: Record<Region, string> = {
  rail: ".editor-shell-rail",
  pane: ".editor-shell-panel",
  stage: "#stage",
  inspector: ".editor-shell-inspector",
};

/**
 * How far the census will walk before it gives up.
 *
 * The bound exists so a shell that never returns focus to a seen node ends as a
 * reported count rather than a hung run. It is generous on purpose: the count
 * the walk actually took is the evidence, and this only says when the walk
 * stopped being one.
 */
const TAB_BOUND = 200;

/** The attribute the census writes on each element it reached, so the stop
 *  condition is "focus came back to something already seen" rather than a
 *  count. A test-owned name: no shell style or selector reads it. */
const SEEN = "data-walkthrough-seen";
/** The first element reached in each region, which is the one whose name is
 *  asserted. Scratch on the page, like {@link SEEN}. */
const FIRST = "data-walkthrough-first";

/** What a focused element is, before the census numbers the step. */
interface Landed {
  /** The region the focused element sits in, or `null` for one outside all
   *  four — a header menu, the status bar, the document itself. */
  readonly region: Region | null;
  /** The element's tag, lowercased, so a step is readable in a failure. */
  readonly tag: string;
  /** Its spoken name, approximated — see {@link focusProbe}. */
  readonly name: string;
}

/** One step of the census: where focus landed, and when. */
export interface Focus extends Landed {
  /** The census's own index, in Tab order. */
  readonly press: number;
}

/** Opens the editor on the real host and waits for the shell to be complete.
 *
 * The wait is for the stage's zoom cluster, not for `.editor-shell`: the shell
 * element exists before its hosts do, and a census taken then would be a census
 * of a half-built focus order. The cluster is a stage control that only renders
 * once the bridge is set, which is the same fact as "the shell is wired".
 *
 * **`?theme=` names the document rather than letting the boot choose one.** A
 * bare `/editor/` resumes the author's most recent save (`boot-theme.ts`), and
 * with the host fixture's ten themes written in one pass several of them share
 * an mtime — compared at millisecond precision, so a tie is ordinary rather
 * than exotic. Two runs of this very test opened `E2E missing` and then
 * `E2E deliberate bleed`: one object in the tree against three, and a census
 * whose press count moved from 18 to 26 for a reason that is not the finder's.
 * The fixture that is seeded for it, `HOST_THEME_ID`, is the one the settings
 * spec works against, and naming it makes the tree, the dock and the count the
 * same on every run. That a bare mount resumes arbitrarily among themes with
 * equal mtimes is `vg-363`, filed rather than repaired here. */
export async function openWalkthrough(page: Page): Promise<void> {
  await page.goto(`${HOST}/editor/?theme=${HOST_THEME_ID}`);
  await expect(page.locator(".editor-shell-zoom")).toBeVisible();
}

/** The census's probe, serialised into the page by `page.evaluate`.
 *
 * It names no module constant — everything arrives through `args` — because
 * `evaluate` ships the function's own source and a closure over {@link SEEN} or
 * {@link FIRST} would arrive undefined.
 *
 * The name is an **approximation** — `aria-label`, else the text
 * `aria-labelledby` points at, else the element's own text, else `title`. It is
 * the census's running record and the thing a failure prints. The
 * *authoritative* name — the one a screen reader would say — is asserted with
 * Playwright's own `toHaveAccessibleName`. The two mechanisms are deliberately
 * different: an approximation that agreed with itself would prove nothing about
 * what a voice user hears.
 *
 * Answers `null` when there is no element to describe, and `{ repeat: true }`
 * when the element already carries `args.seen` — the census's stop condition. */
function focusProbe(args: {
  readonly selectors: Record<string, string>;
  readonly seenRegions: readonly string[];
  readonly seen: string;
  readonly first: string;
}): Landed | { repeat: true } | null {
  const active: Element | null = document.activeElement;
  if (active === null) return null;
  if (active.hasAttribute(args.seen)) return { repeat: true };
  active.setAttribute(args.seen, "");

  let region: string | null = null;
  for (const [name, selector] of Object.entries(args.selectors)) {
    if (active.closest(selector) !== null) {
      region = name;
      break;
    }
  }
  if (region !== null && !args.seenRegions.includes(region)) {
    active.setAttribute(args.first, region);
  }

  const label = active.getAttribute("aria-label");
  const labelledBy = active.getAttribute("aria-labelledby");
  const byId =
    labelledBy === null
      ? ""
      : labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
  const own = (active.textContent ?? "").replace(/\s+/g, " ").trim();
  const name =
    label !== null && label.trim() !== ""
      ? label.trim()
      : byId !== ""
        ? byId
        : own !== ""
          ? own
          : (active.getAttribute("title") ?? "").trim();

  return {
    region: region as Region | null,
    tag: active.tagName.toLowerCase(),
    name,
  };
}

/**
 * Tabs from the document's own focus, recording each element focus lands on.
 *
 * Keyboard only: `Tab` is the one thing that moves focus. The walk stops when
 * focus returns to an element already seen — which is what a focus order that
 * has closed its cycle looks like — or at {@link TAB_BOUND} presses, whichever
 * comes first. The returned length is the press count.
 */
export async function keyboardReach(page: Page): Promise<readonly Focus[]> {
  const reached: Focus[] = [];
  const seenRegions: Region[] = [];

  for (let press = 0; press < TAB_BOUND; press++) {
    await page.keyboard.press("Tab");
    const step = await page.evaluate(focusProbe, {
      selectors: REGION_SELECTOR,
      seenRegions,
      seen: SEEN,
      first: FIRST,
    });
    if (step === null) break;
    if ("repeat" in step) break;
    reached.push({ ...step, press });
    if (step.region !== null && !seenRegions.includes(step.region)) {
      seenRegions.push(step.region);
    }
  }

  return reached;
}

/**
 * Tabs until the focused element satisfies `matches`, and answers with it.
 *
 * The helper later tasks reach a control with. It asks what a control *is*
 * rather than where it sits in an order the shell is free to change, and it
 * fails saying how many presses it spent rather than running out of a loop.
 */
export async function tabUntil(
  page: Page,
  matches: (focus: Focus) => boolean,
  limit = TAB_BOUND,
): Promise<Focus> {
  const seenRegions: Region[] = [];
  let pressed = 0;
  for (; pressed < limit; pressed++) {
    await page.keyboard.press("Tab");
    const step = await page.evaluate(focusProbe, {
      selectors: REGION_SELECTOR,
      seenRegions,
      seen: SEEN,
      first: FIRST,
    });
    if (step === null) {
      throw new Error(`focus left the document after ${pressed + 1} presses`);
    }
    if ("repeat" in step) {
      throw new Error(
        `focus returned to a seen element after ${pressed + 1} presses`,
      );
    }
    if (step.region !== null && !seenRegions.includes(step.region)) {
      seenRegions.push(step.region);
    }
    const focus: Focus = { ...step, press: pressed };
    if (matches(focus)) return focus;
  }
  throw new Error(`nothing matched in ${limit} presses`);
}

test.describe("the shell, reached by keyboard alone", () => {
  /**
   * **This test is red, and the red is its result.** The census reaches the
   * rail, the pane and the stage; it does not reach the inspector, because the
   * inspector renders only "Select an object to inspect it." while nothing is
   * selected and a paragraph is not a focus target. That is `vg-362` — the
   * finding this task existed to produce, filed rather than fixed, because
   * §13.1's rule and the shell's focus order are not this plan's to change. The
   * region list is left at four; it is not trimmed to the three that pass.
   *
   * The name half is proved to have teeth: with the region list reduced to the
   * three reached ones and the name assertion pointed at an element with no
   * accessible name, the run gets past the reachability assertion and fails on
   * the name — so neither half is vacuous.
   */
  test("the shell's regions each have a reachable, named focus target", async ({
    page,
  }) => {
    await openWalkthrough(page);
    const reached = await keyboardReach(page);

    const regionsReached = [
      ...new Set(
        reached
          .map((step) => step.region)
          .filter((region): region is Region => region !== null),
      ),
    ];

    expect(
      regionsReached,
      `the census, in Tab order:\n${JSON.stringify(reached, null, 2)}`,
    ).toEqual(expect.arrayContaining([...REGIONS]));

    // Reachable is not reachable if nothing can say its name (Review Focus 4),
    // so the first target in each region is asked what it is called.
    for (const region of REGIONS) {
      await expect(
        page.locator(`[${FIRST}="${region}"]`),
        `the first ${region} focus target`,
      ).toHaveAccessibleName(/\S/);
    }
  });
});
