import type { LiveSourceStatus, SampleSource } from "@vigilia/renderer-core";
import { type FabricSceneHandle, sceneBoxesOf } from "@vigilia/scene-fabric";
import { type ArtboardSize, cropNoticeText } from "./artboard-crop.js";
import { availabilityNoticeText } from "./availability-notice.js";
import { uiCopy } from "./ui-copy.js";

/**
 * The display's own chrome: what a reader is told, and the room it takes.
 *
 * One owner, because the defect this module fixes was two. Every strip used to
 * position itself (`position:fixed`, `top:0` or `bottom:0`) and every one of
 * them covered the artboard whenever the artboard filled the viewport's height
 * — which is the landscape phone the editor frames by default, and any display
 * whose artboard matches its own aspect. Measured on the built player at
 * 844x390: the crop strip and the scaffold banner together covered the top and
 * bottom 28.8px of a 390px artboard, 14.8% of the authored composition.
 *
 * The bands are in flow (`index.html` is the column that places them), so a
 * strip takes its room *from* the artboard instead of over it, and an empty
 * band is zero tall. Nothing here measures anything: the browser lays the
 * column out, and the scene's own `ResizeObserver` (`main.ts`) refits to the
 * box that is left. Nothing here decides what a strip says either — the words
 * and the colours are `ui-copy.ts`'s and the counting is `scene-fabric`'s.
 *
 * **Room is for the composition's own chrome; a notice that comes and goes
 * overlays instead.** Taking room re-fits the scene, and a re-fit moves the
 * whole picture: measured on the built player at 1920×1080, a 29px strip takes
 * the artboard from 1051 to 1022 and moves the ink 16–25px, right when the
 * notice arrives and left when it leaves (vg-028, measured and ruled
 * 2026-10-14). That is the right trade for the crop strip, which is told once
 * and describes what the display is showing; it is the wrong one for a
 * transport or availability notice, which can flash on any reconnect and would
 * move a dashboard nobody touched. So those two `overlay` — they sit at the
 * display's edge and the composition stays put.
 */

type ChromeSide = "top" | "bottom";

/** The band a strip belongs in.
 *
 *  Throws rather than creating one: the document declares both bands so the
 *  column is right before any script runs, and a document without them is one
 *  this renderer cannot draw into. That is the contract `main.ts` already has
 *  for `#artboard`. */
export function chromeBand(side: ChromeSide): HTMLElement {
  const band = document.querySelector<HTMLElement>(
    `[data-vigilia-chrome="${side}"]`,
  );
  if (band === null) {
    throw new Error(`The display has no ${side} chrome band.`);
  }
  return band;
}

/**
 * Shows one strip, replacing the last one with the same id.
 *
 * Every caller here is re-said rather than said once: the availability strip is
 * rebuilt on every refresh cadence and the transport strip changes as the
 * connection moves. Replacing by id is what keeps one kind of notice one strip
 * — which each writer used to arrange by hand, by removing the element it had
 * found and reusing it in place.
 */
export function putStrip(input: {
  readonly side: ChromeSide;
  readonly id: string;
  readonly text: string;
  readonly background: string;
  readonly color: string;
  /** A notice that can flash: fixed to the display's edge rather than laid out
   *  in the band, so raising or clearing it cannot re-fit the scene (see the
   *  module comment). The `z-index` is what puts it over the artboard — the top
   *  band precedes `#artboard` in `index.html`, and Fabric's wrapper is
   *  positioned, so without one the canvas would paint over the notice. */
  readonly overlay?: boolean;
}): HTMLElement {
  removeStrip(input.id);

  const strip = document.createElement("div");
  strip.id = input.id;
  strip.dataset["vigiliaChromeStrip"] = "";
  strip.textContent = input.text;
  strip.style.cssText =
    `${stripInset(input.side)};text-align:center;` +
    (input.overlay === true
      ? `position:fixed;left:0;right:0;z-index:1;${input.side}:0;`
      : "") +
    `background:${input.background};color:${input.color};` +
    "font:12px/1.4 ui-monospace,monospace;letter-spacing:0.02em";

  chromeBand(input.side).append(strip);
  return strip;
}

export function removeStrip(id: string): void {
  document.getElementById(id)?.remove();
}

/**
 * Names the sensors this display cannot read, and why. Section 97 requires an
 * unavailable sensor to explain itself; without this the consumer sees empty
 * charts and no reason for them.
 *
 * The leading `removeStrip` is what clears a stale notice when the reading
 * comes back: the write below is skipped when there is nothing to say, so the
 * removal cannot move inside it. The wording is `availabilityNoticeText`'s,
 * which groups by cause so a reason shared by several sensors is said once.
 */
export function showAvailabilityNotice(
  source: SampleSource,
  semanticKeys: readonly string[],
): void {
  removeStrip("vigilia-availability");

  const text = availabilityNoticeText(
    semanticKeys.map((key) => source.latest(key)),
  );
  if (text === undefined) return;

  const strip = putStrip({
    side: "top",
    id: "vigilia-availability",
    text,
    background: "#3a2a00",
    color: "#ffce6a",
    // A reading can come back at any cadence, so this one must not move the
    // composition when it clears.
    overlay: true,
  });
  strip.dataset["vigiliaAvailability"] = "";
}

/**
 * Says what this artboard does not contain, and that it is not being shown.
 *
 * The other strips here all describe the *transport* — a sensor with no
 * reading, a host that went away. This one describes the *composition*, and it
 * is told once and left: no reading arriving will bring a cropped panel back,
 * and a strip that came and went would read as a fault the display recovered
 * from. Only a re-saved theme can change it. Slate rather than the availability
 * strip's amber, because §97 requires the two gaps not to read as the same kind
 * of gap.
 */
export function showCropNotice(
  handle: FabricSceneHandle,
  artboard: ArtboardSize,
): void {
  removeStrip("vigilia-crop");

  const text = cropNoticeText(
    sceneBoxesOf(handle.canvas.getObjects()),
    artboard,
  );
  if (text === undefined) return;

  const strip = putStrip({
    side: "top",
    id: "vigilia-crop",
    text,
    background: "#1d2230",
    color: "#c3cde3",
  });
  strip.dataset["vigiliaCrop"] = "";
}

/** Shows non-live connection states; a healthy live display needs no badge. */
export function showConnectionState(
  status: LiveSourceStatus,
  keyCount: number,
  detail?: string,
): void {
  if (status === "live") {
    removeStrip("vigilia-connection");
    return;
  }

  const refused = status === "refused";
  putStrip({
    side: "bottom",
    id: "vigilia-connection",
    text: refused
      ? uiCopy.connection.refused(detail)
      : status === "connecting"
        ? uiCopy.connection.connecting(keyCount)
        : uiCopy.connection.reconnecting,
    background: refused ? "#4a0000" : "#003a4a",
    color: refused ? "#ff9a9a" : "#7fdce9",
    // The one that flashes most: a reconnect raises it and the next batch
    // clears it, which is what a reader sees as the dashboard jumping.
    overlay: true,
  });
}

/**
 * The strip's own inset from the display's edge — on the strip, never on the
 * band.
 *
 * `index.html` sets `viewport-fit=cover` so the artboard reaches a notched
 * phone's edges, which puts the system's own bar over the top of the screen; a
 * strip under it is a strip nobody reads. Padding on the **band** would reserve
 * the notch's height on a display with nothing to say, which is the one thing
 * this layout must not do; the failure page already takes the same care for the
 * same reason (`load-failure.ts:113-116`).
 */
function stripInset(side: ChromeSide): string {
  const top = side === "top" ? "env(safe-area-inset-top)" : "0px";
  const bottom = side === "bottom" ? "env(safe-area-inset-bottom)" : "0px";
  return `padding: calc(6px + ${top}) 12px calc(6px + ${bottom})`;
}
