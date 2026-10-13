// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { Glyph, STACK_GLYPH } from "../../editor-shell/icons.js";
import type { LayerMark } from "../../editor-shell/layer-tree.js";
import { KindMark } from "./kind-mark.js";
import { MEMBER_PAINT, SHAPE_PAINT } from "./layer-mark-fixture.js";

// React only flushes work scheduled inside `act` when it has been told it is in
// a test; without this, `act` warns and the update lands after the assertion.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** One arm per kind, so a case can ask every arm rather than the ones it happens
 *  to get right. The image carries a `src` so the arm draws rather than returning
 *  nothing — `src: undefined` is a real row state and not what slot width is
 *  about. */
const ARMS: readonly LayerMark[] = [
  { kind: "text", text: "VIGILIA", family: "Inter, sans-serif", weight: "600" },
  { kind: "chart", family: "gauge" },
  { kind: "shape", paint: SHAPE_PAINT },
  { kind: "image", src: "blob:pic" },
  { kind: "group" },
];

function render(mark: LayerMark): HTMLElement {
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<KindMark mark={mark} />));
  return host;
}

it("gives a group a generic glyph, and nothing it could not know", () => {
  const host = render({ kind: "group" });
  const slot = host.querySelector<HTMLElement>(".vigilia-layer-mark");
  const glyph = host.querySelector<SVGElement>(
    '[data-vigilia-layer-mark="group"]',
  );

  // The group's own arm drew, and it drew a glyph rather than nothing — the
  // whole correction to the earlier "a group shows nothing here". It is the
  // chrome vocabulary's stack glyph (`icons.ts`), the same one the rail's
  // Composition slot wears, rather than a second hand-authored path set.
  //
  // The expected class is read off `STACK_GLYPH` itself rather than written as
  // a literal, so changing the vocabulary's stack glyph moves this assertion
  // with it instead of leaving a stale name that still passes.
  expect(glyph).not.toBeNull();
  const vocabulary = document.createElement("div");
  const vocabularyRoot = createRoot(vocabulary);
  act(() => vocabularyRoot.render(<Glyph icon={STACK_GLYPH} size={13} />));
  expect(glyph?.querySelector("svg")?.getAttribute("class")).toBe(
    vocabulary.querySelector("svg")?.getAttribute("class"),
  );
  // A glyph, not a word: the mark says "this holds others" without a second
  // string the treeitem's accessible name would then repeat.
  expect(slot?.textContent).toBe("");

  // **Nothing it could not know.** The same mark carrying fields the kind arm
  // never reads — the shape of a group's members, its name — draws the *same*
  // glyph. A treatment derived from a group's contents would differ here, which
  // is what makes §5.1's correction structural rather than a comment.
  const planted = {
    kind: "group",
    name: "CPU card",
    children: [{ kind: "shape", paint: MEMBER_PAINT }],
  } as unknown as LayerMark;
  const plantedHost = render(planted);
  expect(
    plantedHost.querySelector('[data-vigilia-layer-mark="group"]')?.outerHTML,
  ).toBe(glyph?.outerHTML);
});

it("draws a text mark as its own words, in its own face", () => {
  // A 12px `T` glyph answers neither question an author has; the mark's own
  // string does both at once — *what it says* and *that it is text*. Read on the
  // declared value: jsdom applies no stylesheet, so a computed style would be
  // theatre, but the inline declaration is exactly what the browser paints.
  const host = render({
    kind: "text",
    text: "VIGILIA",
    family: "Inter, sans-serif",
    weight: "600",
  });

  const sample = host.querySelector<HTMLElement>(
    '[data-vigilia-layer-mark="text"]',
  )!;
  expect(sample.textContent).toBe("VIGILIA");
  expect(sample.style.fontFamily).toBe("Inter, sans-serif");
  expect(sample.style.fontWeight).toBe("600");
  // The mark declares no face of its own beyond the object's, so the specimen is
  // the only place a font family appears — checked on the declaration rather
  // than a substring, because `sans-serif` contains `serif`.
  expect(host.querySelectorAll("[style*='font-family']")).toHaveLength(1);
});

it("gives each kind a mark that says which kind it is", () => {
  // The negative half matters as much as the positive: one mark for everything
  // would pass a case that only checked the arms it happens to get right.
  const gauge = render({ kind: "chart", family: "gauge" });
  expect(
    gauge
      .querySelector('[data-vigilia-layer-mark="chart"] svg')
      ?.getAttribute("class"),
  ).toContain("lucide-gauge");
  const line = render({ kind: "chart", family: "line" });
  expect(
    line
      .querySelector('[data-vigilia-layer-mark="chart"] svg')
      ?.getAttribute("class"),
  ).toContain("lucide-chart-line");
  // A shape's own paint, not a square in the shell's colour. The expected colour
  // is the fixture's, read back through the same normalisation the swatch got:
  // jsdom reports a hex as `rgb()`, so writing the triplet here would be a
  // second copy of the value the fixture already owns.
  const swatch = render({
    kind: "shape",
    paint: SHAPE_PAINT,
  }).querySelector<HTMLElement>('[data-vigilia-layer-mark="shape"]')!;
  const normalised = document.createElement("div");
  normalised.style.background = SHAPE_PAINT;
  expect(
    normalised.style.background,
    "the fixture is a colour jsdom reads",
  ).not.toBe("");
  expect(swatch.style.background).toBe(normalised.style.background);
  // An image is its own picture.
  expect(
    render({ kind: "image", src: "blob:pic" })
      .querySelector<HTMLImageElement>('[data-vigilia-layer-mark="image"]')
      ?.getAttribute("src"),
  ).toBe("blob:pic");
  // A group draws the generic stack glyph, never a diagram of what it holds.
  expect(
    render({ kind: "group" }).querySelector(
      '[data-vigilia-layer-mark="group"] svg',
    ),
  ).not.toBeNull();
});

it("draws the mark the projection named, and never walks the group's children", () => {
  for (const mark of ARMS) {
    const host = render(mark);
    expect(
      host.querySelector(`[data-vigilia-layer-mark="${mark.kind}"]`),
      `the ${mark.kind} arm drew its own treatment`,
    ).not.toBeNull();
  }

  // A group whose mark was handed a member's own treatment data must still draw
  // one mark, and it must be the group's: a descendant's `data-vigilia-layer-mark`
  // appearing here would be the mark walking the children.
  const planted = render({
    kind: "group",
    children: [
      { kind: "chart", family: "pie" },
      { kind: "shape", paint: MEMBER_PAINT },
    ],
  } as unknown as LayerMark);
  expect(planted.querySelectorAll("[data-vigilia-layer-mark]")).toHaveLength(1);
  expect(
    planted.querySelector('[data-vigilia-layer-mark="group"]'),
  ).not.toBeNull();
});

it("keeps every arm inside one fixed-width slot, so names stay in one column", () => {
  // Every arm is wrapped by the one slot, whatever it draws inside it, which is
  // what lines the names up across rows. A treatment that returned its own slot
  // would let two rows disagree about where the name begins.
  for (const mark of ARMS) {
    const host = render(mark);
    const slots = host.querySelectorAll(".vigilia-layer-mark");
    expect(slots, `one slot for the ${mark.kind} arm`).toHaveLength(1);
    expect(
      slots[0]?.querySelector(`[data-vigilia-layer-mark="${mark.kind}"]`),
      `the ${mark.kind} treatment sits inside the slot`,
    ).not.toBeNull();
  }

  // The slot's fixed width is a stylesheet fact, so it is read from the
  // stylesheet rather than restated: jsdom applies no CSS, and a copy here would
  // drift from the rule that actually lays the column out.
  const css = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../editor-shell/editor-shell.css",
    ),
    "utf8",
  );
  const at = css.indexOf("\n.vigilia-layer-mark {");
  expect(at, ".vigilia-layer-mark is not in the stylesheet").toBeGreaterThan(
    -1,
  );
  const declarations = css.slice(at, css.indexOf("}", at));
  expect(declarations).toMatch(/flex:\s*0 0 \d+px/);
});
