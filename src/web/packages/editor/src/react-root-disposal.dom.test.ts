// @vitest-environment jsdom

/**
 * Every React root the editor creates is unmounted on its own disposal path.
 *
 * `createRoot` is a subscription: unmounting is the only thing that releases
 * the tree it rendered, and neither `element.remove()` nor dropping the last
 * reference does it. The Add pane was the first shipped root disposed by DOM
 * removal alone; the palette panel was the second, and it is worse — its picker
 * and gradient roots are re-created every time the field set rebuilds (the
 * `built`/`shape` rule), so it leaked per token switch as well as per session
 * teardown.
 *
 * **Why this counts roots and not document listeners.** The instrument that
 * found the Add pane's leak — a tally of `document.addEventListener` against
 * `removeEventListener` — measures nothing here. Mounting this panel registers
 * exactly one document listener, and it is React DOM's own `selectionchange`
 * (`listenToAllSupportedEvents`), added once per document at `createRoot` and
 * never removed by `unmount`; a closed popover registers nothing else. So the
 * listener tally is `added: 1, removed: 0` with the fix and without it, and an
 * assertion that the two balance can never hold for any implementation. What
 * the leak actually strands is the root itself — its tree, its closures and its
 * detached host — so that is what is measured. The Add pane's listener case
 * stays where it is, because that pane's roots do own twelve `pointerdown`
 * listeners and the tally does move there.
 *
 * Two instruments, because the defect has two halves:
 *
 * - the **root count** disposes the panel the way `editor-session` does and
 *   asserts every root it created was unmounted;
 * - the **source guard** refuses a shipped `createRoot` with no `unmount` on
 *   its disposal path, so a third site cannot land the way the second did.
 *
 * A zero on both sides is the vacuous pass both cases refuse: the created-root
 * count is asserted too, so a panel that mounted nothing could not pass by
 * having nothing to release.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FabricPalette } from "@vigilia/renderer-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPalettePanel } from "./palette-manager/panel.js";

const SRC = dirname(fileURLToPath(import.meta.url));

interface CreatedRoot {
  readonly container: Element | DocumentFragment;
  unmounted: boolean;
}

/** Every root this file's panel asked React for, in creation order. Held in
 *  `vi.hoisted` so the module mock below can reach it — `vi.mock` factories are
 *  hoisted above every import in this file. */
const createdRoots = vi.hoisted(() => [] as CreatedRoot[]);

vi.mock("react-dom/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom/client")>();
  return {
    ...actual,
    createRoot(
      container: Element | DocumentFragment,
      options?: Parameters<typeof actual.createRoot>[1],
    ) {
      const root = actual.createRoot(container, options);
      const record: CreatedRoot = { container, unmounted: false };
      createdRoots.push(record);
      const unmount = root.unmount.bind(root);
      root.unmount = () => {
        record.unmounted = true;
        unmount();
      };
      return root;
    },
  };
});

beforeEach(() => {
  createdRoots.length = 0;
  document.body.replaceChildren();
});

/**
 * The fixture is `transparent` — the picker's own no-paint value, and the one
 * `panel.dom.test.ts` already uses — because what these cases measure is
 * whether the root was released, not what it paints.
 */
const paletteWithOneSolidToken: FabricPalette = {
  panel: { name: "Panel", value: { kind: "solid", color: "transparent" } },
};

/** The same token as a gradient, which is a *different shape*, so `render`
 *  rebuilds the field set and re-creates the nested root. */
const paletteWithOneGradientToken: FabricPalette = {
  panel: {
    name: "Panel",
    value: {
      kind: "gradient",
      angle: 0,
      stops: [
        { offset: 0, color: "transparent" },
        { offset: 1, color: "transparent" },
      ],
    },
  },
};

function mountHost(): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  return host;
}

describe("a palette panel's React roots", () => {
  it("are all unmounted when the panel is disposed", () => {
    const panel = createPalettePanel(mountHost(), () => {}, undefined, {});
    panel.render(paletteWithOneSolidToken);

    // The field set really mounted a root: without this, a panel that created
    // none would report every root unmounted, which is the vacuous pass.
    expect(createdRoots.length).toBeGreaterThan(0);

    panel.destroy();

    expect(createdRoots.map((root) => root.unmounted)).toEqual(
      createdRoots.map(() => true),
    );
  });

  it("unmounts the root it is replacing when the field set is rebuilt", () => {
    const panel = createPalettePanel(mountHost(), () => {}, undefined, {});
    panel.render(paletteWithOneSolidToken);
    const firstFieldSet = createdRoots.length;
    expect(firstFieldSet).toBeGreaterThan(0);

    panel.render(paletteWithOneGradientToken);

    // The picker's root was created for the solid field set and re-created for
    // the gradient, so the one it replaced must be gone — otherwise every token
    // switch strands a root holding the discarded token in its closures.
    expect(
      createdRoots.slice(0, firstFieldSet).map((root) => root.unmounted),
    ).toEqual(Array.from({ length: firstFieldSet }, () => true));
    expect(createdRoots.length).toBeGreaterThan(firstFieldSet);
  });
});

/**
 * The shipped sources, minus the two kinds of file whose root outlives any
 * editor surface and so has no disposal path to be on:
 *
 * - `*.test.*` and `*.test-stage.*` — a test's tree is the test's;
 * - `control-fixture.tsx` — the control set's preview page, a build entry whose
 *   lifetime is the page's, not an editor surface's.
 *
 * Those exclusions are the ones this task enumerated, and the case below names
 * the three harness pages so the exclusion stays a judgement about them rather
 * than a pattern that happened to miss them.
 */
function shippedSourceFiles(dir = SRC): readonly string[] {
  // `readdirSync(path)` plus `statSync`, not `withFileTypes`: the editor's Node
  // typings are deliberately narrow (`node-builtins.d.ts`), and widening them
  // for a test's convenience is the act that file exists to make visible.
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return shippedSourceFiles(path);
    if (!/\.tsx?$/.test(name)) return [];
    if (/\.test\.tsx?$/.test(name)) return [];
    if (/\.test-stage\.tsx?$/.test(name)) return [];
    if (name === "control-fixture.tsx") return [];
    return [path];
  });
}

describe("every shipped React root", () => {
  it("is unmounted on its own disposal path, and the scan reaches each known one", () => {
    const sites = shippedSourceFiles()
      .filter((path) => /createRoot\s*\(/.test(readFileSync(path, "utf8")))
      .map((path) => relative(SRC, path).split("\\").join("/"))
      .sort();

    // The five files this task enumerated. A file that quietly stopped being
    // scanned — a rename, a new exclusion — fails here rather than leaving the
    // loop below checking nothing and passing.
    expect(sites).toEqual([
      "editor-shell/shell-layout.tsx",
      "new-object-panel.ts",
      "palette-manager/panel.ts",
      "selection-inspector/column.tsx",
      "selection-inspector/inspector.tsx",
    ]);

    // `unmount` in the same file as the `createRoot`: a root built here and
    // released nowhere is the defect, and it cannot be released from elsewhere.
    for (const relPath of sites) {
      expect(
        /\.unmount\s*\(/.test(readFileSync(resolve(SRC, relPath), "utf8")),
        `${relPath} creates a React root and never unmounts one`,
      ).toBe(true);
    }
  });

  it("does not read the dev harness pages it excludes", () => {
    // These three do contain `createRoot`; naming them here is what makes the
    // exclusion above a decision about them rather than an accident.
    for (const harness of [
      "control-fixture.tsx",
      "chart-manager/chart-stage.test-stage.tsx",
      "selection-inspector/runs.test-stage.tsx",
    ]) {
      expect(
        readFileSync(resolve(SRC, harness), "utf8"),
        `${harness} is excluded as a dev harness page`,
      ).toMatch(/createRoot\s*\(/);
    }
  });
});
