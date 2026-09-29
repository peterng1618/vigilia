// @vitest-environment jsdom
import { expect, it } from "vitest";
import { createArtboardPanel } from "./artboard-panel.js";
import { createPalettePanel } from "./palette-manager/panel.js";
import { createTypePresetPanel } from "./type-preset-manager/panel.js";
import { uiCopy } from "./ui-copy.js";

/**
 * No pictograph is copy. §35 keeps visible copy in this table, and a glyph is
 * decoration: it is announced as a word of its own, it cannot inherit a shell
 * colour the way every icon beside it does, and it does not render like them.
 * The rail's four marks were exactly that — `▤ + ▣ ⚙` as translatable strings —
 * so the rule is the net under the fix rather than the fix itself.
 */
it("holds no pictographs, so an icon cannot be stored as copy", () => {
  expect(pictographs(uiCopy)).toEqual([]);
});

/** Every string the table reaches, paired with the key that holds it. Letters
 * are labels (`X`, `W`) and stay; the Unicode symbol blocks are decoration. */
function pictographs(value: unknown, path = "uiCopy"): string[] {
  if (typeof value === "string") {
    return /\p{S}/u.test(value) ? [`${path} = ${JSON.stringify(value)}`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      pictographs(entry, `${path}[${index}]`),
    );
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, entry]) =>
      pictographs(entry, `${path}.${key}`),
    );
  }
  return [];
}

/**
 * The three panels say no word the table does not hold.
 *
 * A string literal in a panel is invisible to a reviewer reading `ui-copy.ts`
 * and invisible to the pictograph rule above, which only sees the table. The
 * cost is not the duplication — it is that the words an author reads have no
 * owner, so a rename fixes one surface and silently misses the other.
 *
 * The net is the panels' own rendered labels and buttons, so a literal is
 * caught at the point it is written rather than by a grep that also matches
 * authored theme data. Most option text is data — a token's name, a locale's,
 * an asset's, a preset's — and is deliberately not covered; the paint kinds
 * are copy and are listed by name.
 */
it("leaves the three panels with no copy of their own", () => {
  const root = document.createElement("div");
  document.body.append(root);

  createArtboardPanel(
    root,
    { palette: { bars: { name: "Bars", value: "#000" } } },
    () => undefined,
    {
      assets: [{ id: "clip", kind: "video", path: "assets/clip.mp4" }],
      onMetadataChange: () => undefined,
    },
  ).render({ width: 1280, height: 720 }, { name: "Living Room", locale: "en" });
  createPalettePanel(
    root,
    () => undefined,
    () => undefined,
  ).render({
    background: { name: "Background", value: { kind: "solid", color: "#000" } },
    glow: {
      name: "Glow",
      value: {
        kind: "gradient",
        angle: 45,
        stops: [
          { offset: 0, color: "#ffffff" },
          { offset: 1, color: "#000000" },
        ],
      },
    },
    accent: { name: "Accent", value: { kind: "solid", color: "#0ff" } },
  });
  // The gradient and delete branches, because a solid token renders neither.
  for (const [host, id] of [
    ["[data-vigilia-palette-token]", "glow"],
  ] as const) {
    const select = root.querySelector<HTMLSelectElement>(host)!;
    select.value = id;
    select.dispatchEvent(new Event("change"));
  }
  createTypePresetPanel(
    root,
    () => undefined,
    () => undefined,
    {
      preview: async () => undefined,
      applyFace: async () => undefined,
      applyTrio: async () => undefined,
    },
  ).render({
    body: { name: "Body", value: { family: "Inter", size: 16 } },
    caption: { name: "Caption", value: { family: "Inter", size: 12 } },
  });

  const owned = new Set(copy());
  const spoken = [
    ...Array.from(root.querySelectorAll("label"), (label) => label.textContent),
    ...Array.from(
      root.querySelectorAll("button"),
      (button) => button.textContent,
    ),
    // The palette's paint kinds, which are copy; the other option lists in
    // these panels are data — a token's name, a locale's, an asset's, a preset's.
    ...Array.from(
      root.querySelectorAll("[data-vigilia-palette-kind] option"),
      (option) => option.textContent,
    ),
  ]
    .map((text) => text?.trim() ?? "")
    // The release version's and the language sample's values are readings, not
    // copy: one is the document's own version, the other the platform's spelling
    // of a date in the chosen language.
    .filter((text) => text !== "" && !/^[\d.v-]+$/.test(text));
  expect(spoken.filter((text) => !owned.has(text))).toEqual([]);
});

/**
 * Every string the table can produce. A function entry is called with the
 * argument shapes the panels pass it — a count and a name — over the counts
 * this panel renders, which yields a superset of what they show: extra entries
 * only loosen the net, they cannot break it.
 */
function copy(): string[] {
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") out.push(value);
    else if (typeof value === "function")
      for (const argument of [1, 2, 3, 4, "x"]) {
        const produced: unknown = (value as (a: unknown) => unknown)(argument);
        if (typeof produced === "string") out.push(produced);
      }
    else if (Array.isArray(value)) value.forEach(walk);
    else if (typeof value === "object" && value !== null)
      Object.values(value).forEach(walk);
  };
  walk(uiCopy);
  return out;
}
