// @vitest-environment jsdom

import { serialiseScene } from "@vigilia/scene-fabric";
import { Rect } from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountEditorShell } from "./editor-shell.js";

/**
 * **Review Focus 4: choosing a display changes the view and nothing else.**
 *
 * The document is byte-identical before and after every choice, and the undo
 * history does not grow. Those are the two ways a view preference becomes a
 * document — by being serialised, or by being recorded — and neither fails
 * loudly: the theme still opens, it just also remembers which phone you were
 * looking through, and the author's next Ctrl+Z silently discards their work
 * instead of the edit they meant.
 *
 * Both are measured on a real mounted shell with a real scene, because a
 * stubbed camera cannot serialise anything and would pass on any code at all.
 */

// jsdom cannot drawImage an undecoded img inside Fabric's render pass; a proxy
// over a real context forwards everything, no-ops only drawImage, and swallows
// Fabric's node-canvas-only `patternQuality` writes.
beforeEach(() => {
  const real = document.createElement("canvas").getContext("2d");
  if (real !== null) {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        new Proxy(real, {
          get(target, property) {
            if (property === "drawImage") return (): void => {};
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
          set(target, property, value) {
            if (property === "patternQuality") return true;
            return Reflect.set(target, property, value);
          },
        }) as unknown as CanvasRenderingContext2D,
    );
  }
});

const LENSES = [
  "phone-landscape",
  "phone-portrait",
  "wall-panel",
  undefined,
] as const;

describe("the display lens is a view preference, not document content", () => {
  it("leaves the serialised scene byte-identical across every choice", async () => {
    const host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { value: 800 },
      clientHeight: { value: 600 },
    });
    const shell = await mountEditorShell({
      host,
      // A 3:1 board, which no display can frame without letterboxing it. The
      // lens must not reach the artboard to make that easier — §57 keeps the
      // author's dimensions whatever the display is.
      artboard: { width: 1200, height: 400 },
    });
    const artboard = shell.editor.artboard();
    const panel = new Rect({ id: "card", width: 300, height: 120 });
    panel.set({ left: 40, top: 40 });
    shell.editor.canvas.add(panel);

    const before = serialiseScene(shell.editor.canvas);
    // Byte equality, not deep equality: a key order that changed on one lens
    // and not another is still a document that differs between two sessions.
    const bytes = JSON.stringify(before);
    expect(
      bytes.length,
      "the scene was not empty, so this proves nothing",
    ).toBeGreaterThan(100);

    for (const lens of LENSES) {
      shell.viewport.showDisplay(lens);
      expect(
        JSON.stringify(serialiseScene(shell.editor.canvas)),
        `the scene after choosing ${lens ?? "Fit"}`,
      ).toBe(bytes);
    }

    // And the artboard itself — the thing a "helpful" lens implementation would
    // most likely reach for. §57: no reflow, whole artboard units.
    expect(shell.editor.artboard()).toEqual(artboard);

    shell.destroy();
  });

  it("records no undo entry for any choice", async () => {
    const host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { value: 800 },
      clientHeight: { value: 600 },
    });
    const shell = await mountEditorShell({
      host,
      artboard: { width: 1200, height: 400 },
    });

    // `EditorHistory` has no length to read, so this counts the event `save()`
    // fires when it actually appends — which is the signal the dirty guard and
    // the session both listen to, so a count of zero is the count that matters.
    let recorded = 0;
    shell.editor.canvas.on("editor:edit-committed" as never, () => {
      recorded += 1;
    });

    for (const lens of LENSES) shell.viewport.showDisplay(lens);
    shell.viewport.zoomToFit();
    shell.viewport.reset();

    expect(
      recorded,
      "choosing a display, refitting and 100 % are camera moves, not edits",
    ).toBe(0);

    // Control: an edit *does* record, so the count is measuring something. A
    // spy that never fires proves only that the shell is silent, not that the
    // history is untouched — and `save()` skips an entry whose scene matches the
    // current one, so the control has to actually change the scene.
    const card = new Rect({ id: "edited", width: 100, height: 40 });
    card.set({ left: 12, top: 12 });
    shell.editor.canvas.add(card);
    shell.editor.historyManager.saveState();
    expect(recorded, "a real edit is still recorded").toBeGreaterThan(0);

    shell.destroy();
  });
});
