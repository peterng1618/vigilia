// @vitest-environment jsdom

/**
 * The Add pane's insert surface.
 *
 * **Membership and order come from `insertGroups()` and nowhere else.** The
 * pane draws a tile for whatever the owner declares, in the owner's order, so a
 * group added to the owner appears here the day it is added — and a group the
 * pane invented, or one it dropped, fails below rather than three tasks later.
 *
 * **A card unit may be depicted; a primitive may not be depicted beyond its
 * kind.** The library is a fixed set of eight, so a unit's tile is honest; a
 * shape is a kind, so its tile is the kind and nothing more (bible §6).
 */
import { describe, expect, it, vi } from "vitest";
import { createNewObjectPanel, insertGroups } from "../../new-object-panel.js";
import { uiCopy } from "../../ui-copy.js";

/** The CPU unit, whose label is the one the hard-coded-label red proof moves. */
const CPU_CARD = "group-cpu-card";

/** The construction surface a tile writes through, with its diagnostics
 *  reachable — a refusal is reported there rather than thrown at the author. */
function editorStub() {
  return {
    canvas: {
      add: vi.fn(),
      setActiveObject: vi.fn(),
      requestRenderAll: vi.fn(),
      getObjects: vi.fn((): unknown[] => []),
    },
    artboard: () => ({ width: 1920, height: 1080 }),
    historyManager: { saveState: vi.fn() },
    textManager: { addText: vi.fn() },
    errorManager: { warn: vi.fn(), error: vi.fn() },
  };
}

/**
 * The pane over a host of its own.
 *
 * `actions` is what the case that drives the pre-document refusal leaves out:
 * the pane has no session to insert through, which is the state the refusal was
 * written for. Nothing else here presses a tile hard enough to need one.
 */
function mount(actions?: Parameters<typeof createNewObjectPanel>[3]): {
  readonly pane: HTMLElement;
  readonly editor: ReturnType<typeof editorStub>;
  readonly panel: ReturnType<typeof createNewObjectPanel>;
} {
  const editor = editorStub();
  const host = document.createElement("div");
  document.body.append(host);
  const panel = createNewObjectPanel(host, editor as never, undefined, actions);
  return { pane: panel.root, editor, panel };
}

/** The headings the pane drew, in the order it drew them. */
function groupHeadings(pane: HTMLElement): readonly (string | null)[] {
  return [...pane.querySelectorAll("fieldset > legend")].map(
    (legend) => legend.textContent,
  );
}

/** Every tile the pane drew, which is every control it offers. */
function tileCount(pane: HTMLElement): number {
  return pane.querySelectorAll("button").length;
}

function cardTile(pane: HTMLElement, cardId: string): HTMLButtonElement {
  return pane.querySelector<HTMLButtonElement>(
    `[data-vigilia-panel-card="${cardId}"]`,
  )!;
}

function shapeTile(pane: HTMLElement, kind: string): HTMLButtonElement {
  return pane.querySelector<HTMLButtonElement>(
    `[data-vigilia-panel-add="${kind}"]`,
  )!;
}

describe("the Add pane's insert surface", () => {
  it("offers each group insertGroups() declares, and no list of its own", () => {
    const { pane } = mount();

    // The owner's own answer, not a copy of its rule: a pane that named its
    // groups itself would agree today and diverge the day a group is added.
    expect(groupHeadings(pane)).toEqual(
      insertGroups()
        .map((group) => group.label)
        .filter((label) => label !== undefined),
    );
    expect(tileCount(pane)).toBe(
      insertGroups().flatMap((group) => group.objects).length,
    );
  });

  it("names a card unit with the library's own label, never a literal", () => {
    const { pane } = mount();

    // Change `uiCopy.cardLibrary.cpu` and this fails: a tile that hard-codes
    // "CPU" agrees with the copy until the copy moves.
    expect(cardTile(pane, CPU_CARD).textContent).toBe(uiCopy.cardLibrary.cpu);
  });

  it("depicts a card unit and does not depict a primitive beyond its kind", () => {
    const { pane } = mount();

    // §5.2: the library is a fixed set of eight, so a unit tile may be drawn.
    // A primitive's tile is its kind — a shape glyph, never a card diagram.
    expect(cardTile(pane, CPU_CARD).querySelector("svg")).not.toBeNull();
    expect(
      shapeTile(pane, "rect").querySelector("[data-vigilia-card-diagram]"),
    ).toBeNull();
  });

  it("refuses, in words, before a document is open, rather than offering tiles that insert nothing", async () => {
    const { pane, editor } = mount();

    // The `constructing` wrapper owns the refusal: with no session behind the
    // tile, a press reaches `errorManager.warn("controls", …)` rather than
    // vanishing into a click that does nothing.
    cardTile(pane, CPU_CARD).click();
    await Promise.resolve();

    expect(editor.errorManager.warn.mock.calls).toEqual([
      ["controls", expect.stringMatching(/session|document/i)],
    ]);
  });

  it("releases the document listeners its tiles registered, on the panel's own disposal path", () => {
    const added: Record<string, number> = {};
    const removed: Record<string, number> = {};
    const tally =
      (into: Record<string, number>) =>
      (type: string): void => {
        into[type] = (into[type] ?? 0) + 1;
      };
    const addSpy = vi
      .spyOn(document, "addEventListener")
      .mockImplementation(
        tally(added) as unknown as typeof document.addEventListener,
      );
    const removeSpy = vi
      .spyOn(document, "removeEventListener")
      .mockImplementation(
        tally(removed) as unknown as typeof document.removeEventListener,
      );

    try {
      const { panel } = mount();
      panel.destroy();

      // Every shape and chart tile carries a tooltip, and the tooltip's
      // press-elsewhere dismissal is a `document`-level `pointerdown`
      // (`editor-shell/controls/tooltip.ts:134`) removed only by its `destroy`.
      // 8 shapes + 4 charts = 12, asserted as added *and* removed: a count of 0
      // removed would pass vacuously against a pane that registered none, and a
      // panel that removed its host node without unmounting the tree left all
      // twelve behind, once per session teardown.
      expect(added["pointerdown"]).toBe(12);
      expect(removed["pointerdown"]).toBe(12);
    } finally {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });
});
