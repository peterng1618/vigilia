// @vitest-environment jsdom

import type { FabricSceneHandle } from "@vigilia/scene-fabric";
import { beforeEach, describe, expect, it } from "vitest";
import {
  chromeBand,
  putStrip,
  removeStrip,
  showConnectionState,
  showCropNotice,
  showScaffoldBanner,
} from "./chrome.js";
import { uiCopy } from "./ui-copy.js";

/**
 * The document `index.html` ships: the chrome's two bands around the artboard
 * host. Built with createElement rather than innerHTML, because the point is to
 * assert against the structure the document declares.
 */
function skeleton(): void {
  document.body.replaceChildren();
  for (const side of ["top", "bottom"] as const) {
    const band = document.createElement("div");
    band.id = `vigilia-chrome-${side}`;
    band.dataset["vigiliaChrome"] = side;
    document.body.append(band);
    if (side === "top") {
      const host = document.createElement("div");
      host.id = "artboard";
      document.body.append(host);
    }
  }
}

function stripsIn(side: "top" | "bottom"): HTMLElement[] {
  return [
    ...chromeBand(side).querySelectorAll<HTMLElement>(
      "[data-vigilia-chrome-strip]",
    ),
  ];
}

describe("the display's chrome", () => {
  beforeEach(skeleton);

  it("puts a strip in the band it names, and nowhere else", () => {
    putStrip({
      side: "top",
      id: "vigilia-crop",
      text: "1 of 2 objects",
      background: "#1d2230",
      color: "#c3cde3",
    });

    expect(stripsIn("top")).toHaveLength(1);
    expect(stripsIn("bottom")).toHaveLength(0);
    expect(document.getElementById("vigilia-crop")?.textContent).toBe(
      "1 of 2 objects",
    );
  });

  it("replaces a strip of the same kind rather than stacking it", () => {
    // The availability strip is rebuilt on every refresh cadence and the
    // connection banner changes as the transport moves: one kind of notice is
    // one strip, which each writer used to arrange by removing the old element
    // by hand.
    putStrip({
      side: "top",
      id: "vigilia-crop",
      text: "first",
      background: "#1d2230",
      color: "#c3cde3",
    });
    putStrip({
      side: "top",
      id: "vigilia-crop",
      text: "second",
      background: "#1d2230",
      color: "#c3cde3",
    });

    expect(document.querySelectorAll("#vigilia-crop")).toHaveLength(1);
    expect(document.getElementById("vigilia-crop")?.textContent).toBe("second");
  });

  it("leaves an empty band empty, so a quiet display costs no room", () => {
    // This is the property the whole layout rests on: a band with nothing in it
    // is zero tall, so a display with nothing to say gets the whole viewport —
    // measured on the real host before this plan, and preserved by it.
    expect(stripsIn("top")).toHaveLength(0);
    expect(stripsIn("bottom")).toHaveLength(0);
  });

  it("keeps the order the strips were put in, so the two gaps stay legible apart", () => {
    putStrip({
      side: "top",
      id: "vigilia-availability",
      text: "a",
      background: "#3a2a00",
      color: "#ffce6a",
    });
    putStrip({
      side: "top",
      id: "vigilia-crop",
      text: "b",
      background: "#1d2230",
      color: "#c3cde3",
    });

    expect(stripsIn("top").map((strip) => strip.id)).toEqual([
      "vigilia-availability",
      "vigilia-crop",
    ]);
  });

  it("refuses to draw into a document that has no band", () => {
    // The same contract `main.ts:55-57` already has for `#artboard`: a document
    // this renderer cannot draw into fails loudly rather than silently putting
    // a strip somewhere that covers the composition.
    document.body.replaceChildren();

    expect(() => chromeBand("top")).toThrow(/top chrome band/);
  });

  it("takes the empty space back when a strip is removed", () => {
    putStrip({
      side: "bottom",
      id: "vigilia-connection",
      text: "Lost the host.",
      background: "#003a4a",
      color: "#7fdce9",
    });
    removeStrip("vigilia-connection");

    expect(stripsIn("bottom")).toHaveLength(0);
    expect(document.getElementById("vigilia-connection")).toBeNull();
  });
});

describe("the strips the display is told by", () => {
  beforeEach(skeleton);

  it("marks every strip with one attribute, in the band for what it is", () => {
    showConnectionState("reconnecting", 3);
    showScaffoldBanner(18, "Edge cases");

    expect(stripsIn("bottom").map((strip) => strip.id)).toEqual([
      "vigilia-connection",
      "vigilia-scaffold",
    ]);
    expect(document.querySelector("#vigilia-scaffold")?.textContent).toBe(
      uiCopy.syntheticData("Edge cases", 18),
    );
  });

  it("keeps the scaffold banner addressable, which it was not", () => {
    showScaffoldBanner(18, "Edge cases");

    expect(document.querySelector("[data-vigilia-scaffold]")).not.toBeNull();
  });

  it("clears the transport strip when the connection is live", () => {
    showConnectionState("reconnecting", 3);
    showConnectionState("live", 3);

    expect(stripsIn("bottom")).toHaveLength(0);
  });

  it("says nothing at all when there is nothing to say", () => {
    // The quiet display: a connection that is live raises no strip, and a theme
    // whose objects are inside its artboard raises no crop strip.
    showConnectionState("live", 3);
    showCropNotice(
      { canvas: { getObjects: () => [] } } as unknown as FabricSceneHandle,
      { width: 1024, height: 768 },
    );

    expect(stripsIn("top")).toHaveLength(0);
    expect(stripsIn("bottom")).toHaveLength(0);
  });
});
