import type { Page } from "@playwright/test";
import { expect, it } from "vitest";
import { tabUntil } from "./walkthrough-focus.js";

/**
 * `tabUntil`'s failure report, read without a browser.
 *
 * The reporting is a contract about the message rather than visible behaviour,
 * so it is proved here and not in the browser suite: the browser run that shows
 * the message against the real shell is `host-walkthrough.spec.ts`'s, and it
 * costs a built bundle and a live host to say one string.
 *
 * `vg-551` is the defect this reads against: the walk crossed 758 font-picker
 * stops inside the inspector and the failure said only `nothing matched in 200
 * presses`, which is indistinguishable from a walk that never left its start.
 */

/** One landing, shaped as `focusProbe` answers one. */
interface Landing {
  readonly region: string | null;
  readonly tag: string;
  readonly name: string;
}

const landing = (region: string | null): Landing => ({
  region,
  tag: "button",
  name: `${region ?? "outside"} control`,
});

/**
 * A `Page` whose probe answers `landings` in order.
 *
 * `tabUntil` makes two kinds of `evaluate` call — `clearWalkMarks` passes the
 * marks **array**, the probe passes an **object** — so the stub branches on the
 * argument rather than on call order, and a change to either call site shows up
 * as a wrong answer rather than as an off-by-one nobody sees.
 */
function scriptedPage(landings: readonly (Landing | null)[]): Page {
  let next = 0;
  return {
    keyboard: { press: async (): Promise<void> => undefined },
    evaluate: async (_fn: unknown, arg: unknown): Promise<unknown> => {
      if (Array.isArray(arg)) return undefined;
      return landings[next++] ?? null;
    },
  } as unknown as Page;
}

it("reports the presses it took and the regions it saw when nothing matches", async () => {
  const page = scriptedPage([
    landing("inspector"),
    landing("inspector"),
    landing("inspector"),
  ]);
  await expect(tabUntil(page, () => false, 3)).rejects.toThrow(
    "nothing matched in 3 presses; regions seen: inspector",
  );
});

/** The regions are the ones the walk actually crossed, in the order it saw
 *  them, and a repeat does not add a region twice. */
it("names every region a failing walk crossed, in order and once each", async () => {
  const page = scriptedPage([
    landing("rail"),
    landing("pane"),
    landing("inspector"),
    landing("pane"),
  ]);
  await expect(tabUntil(page, () => false, 4)).rejects.toThrow(
    "regions seen: rail, pane, inspector",
  );
});

/** A walk that never landed inside one of the four regions says so rather than
 *  printing an empty list, which reads as a formatting fault. */
it("says no region was seen when focus never landed in one", async () => {
  const page = scriptedPage([landing(null), landing(null)]);
  await expect(tabUntil(page, () => false, 2)).rejects.toThrow(
    "regions seen: none",
  );
});
