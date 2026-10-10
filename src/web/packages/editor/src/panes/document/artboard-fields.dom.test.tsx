// @vitest-environment jsdom
// No colour literal appears in this file: every fixture is a document value the
// panel only ever prints, so the design ratchet has nothing here to hold to a
// token.

/**
 * The Document pane, measured against the enumeration taken from the imperative
 * panel before a line of it was rewritten.
 *
 * The three cases below are the ones the brief names, and they are the whole
 * point of the rewrite: **every hook the panel carried is still there**, the
 * size note is **derived from the scene** rather than printed from a stored
 * figure, and **no native select survives** — a `select` is the control the
 * shell's own set replaced, and `input[type=range]` is the slider primitive's
 * hidden thumb rather than a control this pane may hold.
 *
 * The pane is mounted the way the session mounts it — through
 * `createArtboardPanel`, whose `root`/`render` pair is the contract
 * `editor-session.ts` keeps — so a hook asserted here is a hook the editor's own
 * wiring really reaches.
 */
import type {
  Artboard,
  AssetReference,
  ThemeMetadata,
} from "@vigilia/renderer-core";
import { outsideCount, type SceneBox } from "@vigilia/scene-fabric";
import { act } from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  type ArtboardPanel,
  createArtboardPanel,
} from "../../artboard-panel.js";
import { uiCopy } from "../../ui-copy.js";

// Base UI's popups need three browser APIs jsdom has none of — the same three
// `preset-list.dom.test.tsx` supplies, for the same reason.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];
window.PointerEvent ??= MouseEvent as never;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  const matches = Element.prototype.matches;
  Element.prototype.matches = Object.assign(function (
    this: Element,
    selector: string,
  ): boolean {
    if (selector === ":modal" || selector === ":popover-open") return false;
    return matches.call(this, selector);
  }, matches);
});

let panel: ArtboardPanel | undefined;

afterEach(async () => {
  if (panel !== undefined) await act(async () => panel?.destroy());
  panel = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

/**
 * Step 1's checklist, verbatim: every `data-vigilia-*` hook the imperative panel
 * rendered, in the order it rendered them. A field the rewrite dropped is a
 * missing hook, and this list is the only thing that catches it.
 *
 * `background-media-fit` is in the list because the panel renders it in every
 * state — the branch a single render hides is the *offer*, the declared assets
 * the media control lists, and the case below drives that rather than assuming
 * it.
 */
const enumeratedHooks = [
  // Metadata: the theme's own description.
  "theme-name",
  "theme-author",
  "theme-description",
  "theme-language",
  "theme-language-sample",
  "theme-version",
  // The artboard: the three controls that derive a size, and the free pair for
  // a size no preset names.
  "artboard-ratio",
  "artboard-orientation",
  "artboard-resolution",
  "artboard-width",
  "artboard-height",
  "artboard-note",
  // The board's paint, the media behind it, and how that media fills it.
  "artboard-background",
  "artboard-bar-color",
  "background-asset",
  "background-media-fit",
] as const;

const ASSETS: readonly AssetReference[] = [
  { id: "clip", kind: "video", path: "assets/clip.mp4" },
];

const GLOBALS = {
  palette: {
    background: {
      name: "Background",
      value: { kind: "solid", color: "transparent" } as const,
    },
    bars: {
      name: "Bars",
      value: { kind: "solid", color: "transparent" } as const,
    },
  },
};

async function mount(
  options: {
    readonly sceneBoxes?: () => readonly SceneBox[];
    readonly assets?: readonly AssetReference[];
  } = {},
): Promise<{
  readonly host: HTMLElement;
  readonly change: ReturnType<typeof vi.fn>;
}> {
  // The previous panel goes the way the session takes it, so a case that mounts
  // twice leaves one tree behind rather than two.
  if (panel !== undefined) await act(async () => panel?.destroy());
  panel = undefined;
  document.body.replaceChildren();
  const host = document.createElement("div");
  document.body.append(host);
  const change = vi.fn();
  await act(async () => {
    panel = createArtboardPanel(host, GLOBALS, change, {
      assets: ASSETS,
      onMetadataChange: vi.fn(),
      ...options,
    });
  });
  return { host, change };
}

async function draw(artboard: Artboard, metadata?: ThemeMetadata) {
  if (panel === undefined) throw new Error("no panel mounted");
  await act(async () => panel?.render(artboard, metadata));
}

/** React and floating-ui schedule outside `act`, so a popup is flushed with
 *  macrotasks rather than one. */
async function flush(): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function click(target: Element, detail = 0): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail }),
    );
  });
}

/** Base UI commits a list item only when the press that precedes the click
 *  started on it, so the press is part of the interaction. */
async function pointerDown(target: Element): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "mouse",
        button: 0,
      }),
    );
  });
}

/** Picks the option whose value is `id` — the id the control commits, never the
 *  label it prints. */
async function chooseIn(control: string, id: string): Promise<void> {
  const trigger = document.querySelector<HTMLElement>(control);
  if (trigger === null) throw new Error(`no control matches ${control}`);
  await click(trigger);
  await flush();
  const option = Array.from(document.querySelectorAll('[role="option"]')).find(
    (candidate) => candidate.getAttribute("data-vigilia-option") === id,
  );
  if (option === undefined) throw new Error(`no option ${id} in ${control}`);
  await pointerDown(option);
  await click(option, 1);
  await flush();
}

/** The boxes a scene reports, one of them wholly outside a 1000 × 1000 board. */
function scene(bleeds: boolean): readonly SceneBox[] {
  return [
    {
      visible: true,
      bleeds,
      left: 950,
      top: 100,
      width: 100,
      height: 100,
      depth: 0,
    },
  ];
}

/** What the note says for a scene, from the owners' own answers: `uiCopy`'s
 *  wording and `scene-fabric`'s count, never a restatement of either. */
function noteFor(boxes: readonly SceneBox[]): string {
  const { outside, counted } = outsideCount(boxes, {
    width: 1000,
    height: 1000,
  });
  return outside === 0
    ? uiCopy.panels.artboardSizeNote
    : uiCopy.panels.artboardOutside(
        uiCopy.panels.artboardSizeNote,
        outside,
        counted,
      );
}

function note(host: HTMLElement): string {
  return host.querySelector("[data-vigilia-artboard-note]")?.textContent ?? "";
}

it("renders every field the panel rendered, including the branch that needs a background asset", async () => {
  const { host, change } = await mount();
  await draw({ width: 1280, height: 720 }, { name: "Living Room" });

  for (const hook of enumeratedHooks) {
    expect(host.querySelector(`[data-vigilia-${hook}]`), hook).not.toBeNull();
  }

  // The branch a single render hides: with no asset declared the media control
  // offers nothing but the blank reading, so the state that has one is driven
  // rather than assumed. The fit control is asserted in **this** state, and the
  // commit that follows is one only an asset can produce.
  await chooseIn("[data-vigilia-background-asset]", "clip");
  expect(
    host.querySelector("[data-vigilia-background-media-fit]"),
  ).not.toBeNull();
  await chooseIn("[data-vigilia-background-media-fit]", "contain");

  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({
      backgroundMedia: { assetId: "clip", fit: "contain" },
    }),
  );
});

it("derives the size note rather than printing a stored figure", async () => {
  // The note is `sceneBoxes`', so it moves when the boxes move and cannot go
  // stale on disk: the same board says one thing for a scene that fits and
  // another for one that does not.
  const boxes = scene(false);
  const { host } = await mount({ sceneBoxes: () => boxes });
  await draw({ width: 1000, height: 1000 });

  expect(note(host)).toBe(noteFor(boxes));
  expect(note(host)).not.toBe(noteFor(scene(true)));

  // And the rule alone when nothing is outside, which is the arm the figure
  // would otherwise hide behind a count of zero.
  const { host: fitting } = await mount({ sceneBoxes: () => scene(true) });
  await draw({ width: 1000, height: 1000 });
  expect(note(fitting)).toBe(uiCopy.panels.artboardSizeNote);
});

it("states the note's role and describes the controls it is about with it", async () => {
  // The note is the one place the panel says what a size change costs, so it
  // reaches a screen reader through the controls that change a size — the free
  // pair and all three preset controls — rather than only to whoever reads the
  // pane top to bottom.
  const { host } = await mount();
  await draw({ width: 1280, height: 720 });

  const noteElement = host.querySelector("[data-vigilia-artboard-note]");
  expect(noteElement?.getAttribute("role")).toBe("note");
  const id = noteElement?.id ?? "";
  expect(id).not.toBe("");
  for (const hook of [
    "artboard-width",
    "artboard-height",
    "artboard-ratio",
    "artboard-orientation",
    "artboard-resolution",
  ]) {
    expect(
      host
        .querySelector(`[data-vigilia-${hook}]`)
        ?.getAttribute("aria-describedby"),
      hook,
    ).toBe(id);
  }
});

it("has no native select left in the pane", async () => {
  const { host } = await mount();
  await draw({ width: 1280, height: 720 });

  expect(host.querySelectorAll("select")).toHaveLength(0);
  expect(host.querySelectorAll('input[type="range"]')).toHaveLength(0);
});
