// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { type Artboard, type ScenePlan } from "@vigilia/renderer-core";
import { mountFabricScene } from "./scene.js";

function plan(): ScenePlan {
  return {
    artboard: {
      width: 400,
      height: 300,
      fitMode: "contain",
      background: "#000",
      barColor: "#000",
    },
    nodes: [],
    issues: [],
  };
}

function host(): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientWidth", { value: 400 });
  Object.defineProperty(element, "clientHeight", { value: 300 });
  document.body.append(element);
  return element;
}

describe("mountFabricScene updateArtboard", () => {
  it("swaps background media without remounting scene", () => {
    const element = host();
    const artboard: Artboard = { width: 400, height: 300 };
    const scene = mountFabricScene({
      host: element,
      plan: plan(),
      artboard,
      assets: [
        { id: "a", kind: "image", path: "assets/a.png" },
        { id: "b", kind: "image", path: "assets/b.png" },
      ],
      resolveAsset: (assetId) => ({ url: `blob:${assetId}` }),
    });

    scene.updateArtboard({
      ...artboard,
      backgroundMedia: { assetId: "b", fit: "cover" },
    });

    const media = element.querySelector<HTMLImageElement>(
      "[data-vigilia-background-media] img",
    );
    expect(media?.src).toBe("blob:b");
    scene.dispose();
    element.remove();
  });

  it("is inert when scene mounted without asset resolver", () => {
    const element = host();
    const scene = mountFabricScene({ host: element, plan: plan() });

    expect(() =>
      scene.updateArtboard({
        width: 400,
        height: 300,
        backgroundMedia: { assetId: "b", fit: "cover" },
      }),
    ).not.toThrow();
    expect(element.querySelector("[data-vigilia-background-media]")).toBeNull();

    scene.dispose();
    element.remove();
  });
});
