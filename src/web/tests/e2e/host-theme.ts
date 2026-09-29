import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeThemePackage } from "@vigilia/theme-package";

/** Seeds a theme package into the host's themes directory so a browser test can
 * load it through the real host — the path `vite preview` cannot exercise. */

const here = path.dirname(fileURLToPath(import.meta.url));

/** The same URL shape `font-catalog.ts` uses, so the fixture declares a real
 * packaged face. Downloaded bytes are cached under a gitignored directory: a
 * 24 KB binary does not belong in the repository, and the licence is declared
 * in the envelope rather than vendored. */
const FONT_SOURCE_URL =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@5.1.1/latin-400-normal.woff2";

const FONT_CACHE_DIR = path.join(here, "..", "..", ".e2e-font-cache");

export const HOST_PORT = 4175;
/** Binds the clock only, so the settings page asks it nothing about devices. */
export const HOST_THEME_ID = "e2e-hosted";
/** Binds a disk, so the settings page has a question to ask it. */
export const HOST_DISK_THEME_ID = "e2e-disk";
/** Binds a temperature, so a display's own unit preference has something to convert. */
export const HOST_TEMP_THEME_ID = "e2e-temp";
/** Twin clock themes: language is their only rendering difference. */
export const HOST_JAPANESE_THEME_ID = "e2e-lang-ja";
export const HOST_ENGLISH_THEME_ID = "e2e-lang-en";
/** Binds a key no provider reports, so the player's gap is measurable: a
 * theme that invented a reading for it would be the failure this catches. */
export const HOST_MISSING_THEME_ID = "e2e-missing-sensor";
/** Glass under a group, a rotation and an intersection, on the real player.
 * The editor proves all three; this is the same composition through the host
 * so the player's `StaticCanvas` mount is measured too. */
export const HOST_GROUPED_THEME_ID = "e2e-grouped-glass";
/** Packaged media and nothing else, so every light pixel on the artboard came
 *  from the bytes the host served. The only place a theme's declared asset
 *  reaches a display is the URL its asset resolver builds, so this is the
 *  fixture that covers it. */
export const HOST_MEDIA_THEME_ID = "e2e-media";
export const HOST_THEMES_DIR = path.join(here, "..", "..", ".e2e-host-themes");

/** The node a reading is painted into, by the id a test reads it back by. */
export const CLOCK_NODE_ID = "clock";
export const TEMPERATURE_NODE_ID = "temperature";

/** The one bound reading is what separates the seeded themes: a disk key makes
 * the theme raise a question, a clock key does not, and a temperature key is
 * the only one a display's measurement preference can change. */
const envelopeFor = (
  id: string,
  name: string,
  nodeId: string,
  binding: { semanticKey: string; format?: string; precision?: number },
  locale = "en",
) => ({
  schemaVersion: 2 as const,
  fabricVersion: "7.4.0",
  id,
  metadata: { name, locale },
  artboard: {
    width: 640,
    height: 360,
    contentFit: "contain" as const,
    background: { ref: "palette.bar" },
    barColor: { ref: "palette.bar" },
  },
  globals: {
    palette: {
      none: {
        name: "None",
        value: { kind: "solid" as const, color: "transparent" },
      },
      ink: { name: "Ink", value: { kind: "solid" as const, color: "#e8ecf3" } },
      bar: { name: "Bar", value: { kind: "solid" as const, color: "#101318" } },
    },
    typePresets: {
      "11-400": {
        name: "Caption",
        value: { family: "system-ui, sans-serif", size: 22, weight: "400" },
      },
    },
  },
  assets: [
    {
      id: "badge",
      kind: "svg" as const,
      path: "assets/badge.svg",
      license: { name: "MIT", attribution: "Vigilia test fixture." },
    },
    {
      // Same source the curated catalog uses, so the fixture exercises the real
      // packaged-font path rather than a hand-made blob.
      id: "inter-400",
      kind: "font" as const,
      path: "assets/inter-400.woff2",
      family: "Inter",
      weight: 400,
      style: "normal" as const,
      format: "woff2" as const,
      sourceUrl: FONT_SOURCE_URL,
      license: {
        name: "SIL Open Font License 1.1",
        url: "https://openfontlicense.org/",
        attribution: "Inter, via Fontsource (cdn.jsdelivr.net).",
      },
    },
  ],
  scene: {
    version: "7.4.0",
    objects: [
      {
        type: "Rect",
        version: "7.4.0",
        originX: "left",
        originY: "top",
        left: 40,
        top: 40,
        width: 200,
        height: 80,
        fill: "palette.ink",
        id: "card",
        vigiliaPaint: { fill: "palette.ink" },
      },
      {
        type: "Textbox",
        version: "7.4.0",
        originX: "left",
        originY: "top",
        left: 40,
        top: 140,
        width: 420,
        height: 60,
        text: "Hosted theme from the real host",
        fontSize: 22,
        fontFamily: "system-ui, sans-serif",
        fill: "palette.ink",
        id: "title",
        vigiliaPaint: { fill: "palette.ink" },
        vigiliaText: {
          runs: [
            {
              text: "Hosted theme from the real host",
              typePreset: "typePresets.11-400",
              style: { color: { ref: "palette.ink" } },
            },
          ],
        },
      },
      {
        // Seconds, so a test can watch the reading move without waiting a
        // minute for it.
        type: "Textbox",
        version: "7.4.0",
        originX: "left",
        originY: "top",
        left: 40,
        top: 220,
        width: 420,
        height: 60,
        text: "--:--:--",
        fontSize: 22,
        fontFamily: "system-ui, sans-serif",
        fill: "palette.ink",
        id: "clock",
        vigiliaPaint: { fill: "palette.ink" },
        vigiliaText: {
          runs: [
            {
              kind: "value",
              bindingId: "bound-value",
              typePreset: "typePresets.11-400",
              style: { color: { ref: "palette.ink" } },
            },
          ],
        },
      },
      {
        // Where a temperature lands. A clock reports text, which no measurement
        // preference touches, so this node is what proves the preference reached
        // the screen rather than the theme.
        type: "Textbox",
        version: "7.4.0",
        originX: "left",
        originY: "top",
        left: 40,
        top: 300,
        width: 420,
        height: 60,
        text: "--°C",
        fontSize: 22,
        fontFamily: "system-ui, sans-serif",
        fill: "palette.ink",
        id: TEMPERATURE_NODE_ID,
        vigiliaPaint: { fill: "palette.ink" },
        vigiliaText: {
          runs: [
            {
              kind: "value",
              bindingId: "bound-value",
              typePreset: "typePresets.11-400",
              style: { color: { ref: "palette.ink" } },
            },
          ],
        },
      },
    ],
  },
  bindings: {
    [nodeId]: [{ id: "bound-value", ...binding }],
  },
});

const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <circle cx="12" cy="12" r="10" fill="#e8ecf3" />
</svg>
`;

/** The ink colour the badge paints, kept as a constant so a media test counts
 *  pixels of the served bytes rather than of anything the theme draws. */
export const BADGE_INK = { r: 232, g: 236, b: 243 } as const;

/** A theme whose only content is a packaged image as the artboard's background.
 *  An empty scene is deliberate: no authored node can contribute a light pixel,
 *  so what a test sees on the artboard is the host's bytes and nothing else. */
const mediaEnvelope = {
  schemaVersion: 2 as const,
  fabricVersion: "7.4.0",
  id: HOST_MEDIA_THEME_ID,
  metadata: { name: "E2E media", locale: "en" },
  artboard: {
    width: 640,
    height: 360,
    contentFit: "contain" as const,
    background: { ref: "palette.bar" as const },
    barColor: { ref: "palette.bar" as const },
    backgroundMedia: { assetId: "badge", fit: "contain" as const },
  },
  globals: {
    palette: {
      none: {
        name: "None",
        value: { kind: "solid" as const, color: "transparent" },
      },
      bar: { name: "Bar", value: { kind: "solid" as const, color: "#101318" } },
    },
    typePresets: {},
  },
  assets: [
    {
      id: "badge",
      kind: "svg" as const,
      path: "assets/badge.svg",
      license: { name: "MIT", attribution: "Vigilia test fixture." },
    },
  ],
  scene: { version: "7.4.0" as const, objects: [] },
};

/** Artboard units per bar, alternating light and dark. Four times the widest
 *  blur the panels author, so a real blur flattens each bar's step and a tint
 *  leaves it standing — the same discrimination `glass-fixture.ts` makes. */
const BAR_PITCH = 96;

const PANEL = {
  fill: "rgba(255, 255, 255, 0.10)",
  stroke: "rgba(255, 255, 255, 0.35)",
  strokeWidth: 2,
  radius: 24,
  blurRadius: 16,
} as const;

/** Every panel's own authored box, so a test can place a band without reading
 *  the scene back — and so a fixture that drifts from what it claims is a
 *  failing assertion rather than a silently different picture. */
export const GROUPED_BOXES = {
  /** Inside a group whose own angle is -20, so the child is rotated by ancestry. */
  grouped: { width: 200, height: 140 },
  flat: { width: 220, height: 150 },
  overlapUnder: { width: 260, height: 140 },
  overlapOver: { width: 260, height: 140 },
} as const;

export const GROUPED_PANEL_IDS = {
  grouped: "grouped-panel",
  flat: "flat-panel",
  overlapUnder: "overlap-under",
  overlapOver: "overlap-over",
} as const;

export const GROUPED_GROUP_ID = "panel-group";
export const GROUPED_GROUP_ANGLE = -20;

/**
 * Glass under a group, a rotation and an intersection, mounted by the real host
 * and read back by the real player.
 *
 * **The backdrop is scene geometry, not media.** A `<video>` or `<img>` media
 * layer is a DOM sibling the player cannot load — its asset URL drops a segment
 * the host's route needs, [#3](https://github.com/peterng1618/vigilia/issues/3) —
 * but an authored `Rect` is a Fabric object, already on the canvas and already
 * painted when a panel samples it. The glass has a real high-frequency backdrop
 * on the player, and nothing here waits on an issue.
 *
 * The artboard paint is transparent for the same reason the editor fixture's
 * is: an opaque artboard would cover the bars before any panel sampled them.
 */
const groupedGlassEnvelope = {
  schemaVersion: 2 as const,
  fabricVersion: "7.4.0",
  id: HOST_GROUPED_THEME_ID,
  metadata: { name: "E2E grouped glass", locale: "en" },
  artboard: {
    width: 640,
    height: 480,
    contentFit: "contain" as const,
    background: { ref: "palette.none" as const },
    barColor: { ref: "palette.bar" as const },
  },
  globals: {
    palette: {
      none: {
        name: "None",
        value: { kind: "solid" as const, color: "transparent" },
      },
      bar: { name: "Bar", value: { kind: "solid" as const, color: "#101318" } },
      panel: {
        name: "Panel",
        value: { kind: "solid" as const, color: PANEL.fill },
      },
      edge: {
        name: "Edge",
        value: { kind: "solid" as const, color: PANEL.stroke },
      },
      light: {
        name: "Light",
        value: { kind: "solid" as const, color: "#e8e8e8" },
      },
      dark: {
        name: "Dark",
        value: { kind: "solid" as const, color: "#3a3a3a" },
      },
      tag: { name: "Tag", value: { kind: "solid" as const, color: "#2f6f4f" } },
      ink: { name: "Ink", value: { kind: "solid" as const, color: "#e8ecf3" } },
    },
    typePresets: {
      "11-400": {
        name: "Caption",
        value: {
          family: "Inter, system-ui, sans-serif",
          size: 22,
          weight: "400",
        },
      },
    },
  },
  assets: [
    {
      id: "inter-400",
      kind: "font" as const,
      path: "assets/inter-400.woff2",
      family: "Inter",
      weight: 400,
      style: "normal" as const,
      format: "woff2" as const,
      sourceUrl: FONT_SOURCE_URL,
      license: {
        name: "SIL Open Font License 1.1",
        url: "https://openfontlicense.org/",
        attribution: "Inter, via Fontsource (cdn.jsdelivr.net).",
      },
    },
  ],
  scene: {
    version: "7.4.0",
    objects: [
      ...Array.from({ length: 7 }, (_, index) => {
        const light = index % 2 === 0;
        return {
          type: "Rect",
          version: "7.4.0",
          originX: "left" as const,
          originY: "top" as const,
          left: index * BAR_PITCH,
          top: 0,
          width: BAR_PITCH,
          height: 480,
          fill: light ? "#e8e8e8" : "#3a3a3a",
          id: `bar-${index}`,
          selectable: false,
          evented: false,
          vigiliaPaint: { fill: light ? "palette.light" : "palette.dark" },
        };
      }),
      {
        // A group whose own angle is the rotation: the treated child's
        // transform comes from its ancestry, which is the case the glass
        // handle's ancestor walk exists for. `width`/`height` are declared
        // because Fabric lays a group out from them on revival, and the
        // untreated tag keeps the group a real two-object card.
        type: "Group",
        version: "7.4.0",
        id: GROUPED_GROUP_ID,
        left: 170,
        top: 130,
        angle: GROUPED_GROUP_ANGLE,
        width: 260,
        height: 180,
        objects: [
          {
            type: "Rect",
            version: "7.4.0",
            originX: "center",
            originY: "center",
            left: -30,
            top: 0,
            width: GROUPED_BOXES.grouped.width,
            height: GROUPED_BOXES.grouped.height,
            rx: PANEL.radius,
            ry: PANEL.radius,
            fill: PANEL.fill,
            stroke: PANEL.stroke,
            strokeWidth: PANEL.strokeWidth,
            id: GROUPED_PANEL_IDS.grouped,
            selectable: false,
            evented: false,
            vigiliaPaint: {
              fill: "palette.panel",
              stroke: "palette.edge",
            },
            vigiliaGlass: { blurRadius: PANEL.blurRadius },
          },
          {
            type: "Rect",
            version: "7.4.0",
            originX: "center",
            originY: "center",
            left: 110,
            top: 70,
            width: 50,
            height: 50,
            rx: 10,
            ry: 10,
            fill: "#2f6f4f",
            id: "grouped-tag",
            selectable: false,
            evented: false,
            vigiliaPaint: { fill: "palette.tag" },
          },
        ],
      },
      {
        type: "Rect",
        version: "7.4.0",
        originX: "left",
        originY: "top",
        left: 380,
        top: 40,
        width: GROUPED_BOXES.flat.width,
        height: GROUPED_BOXES.flat.height,
        rx: PANEL.radius,
        ry: PANEL.radius,
        fill: PANEL.fill,
        stroke: PANEL.stroke,
        strokeWidth: PANEL.strokeWidth,
        id: GROUPED_PANEL_IDS.flat,
        selectable: false,
        evented: false,
        vigiliaPaint: { fill: "palette.panel", stroke: "palette.edge" },
        vigiliaGlass: { blurRadius: PANEL.blurRadius },
      },
      {
        // A real reading in free space, so the mount is a display and not a
        // still composition.
        type: "Textbox",
        version: "7.4.0",
        originX: "left",
        originY: "top",
        left: 250,
        top: 240,
        width: 200,
        height: 40,
        text: "--:--:--",
        fontSize: 22,
        fontFamily: "Inter, system-ui, sans-serif",
        fill: "#e8ecf3",
        id: CLOCK_NODE_ID,
        vigiliaPaint: { fill: "palette.ink" },
        vigiliaText: {
          runs: [
            {
              kind: "value",
              bindingId: "bound-value",
              typePreset: "typePresets.11-400",
              style: { color: { ref: "palette.ink" } },
            },
          ],
        },
      },
      {
        type: "Rect",
        version: "7.4.0",
        originX: "left",
        originY: "top",
        left: 60,
        top: 290,
        width: GROUPED_BOXES.overlapUnder.width,
        height: GROUPED_BOXES.overlapUnder.height,
        rx: PANEL.radius,
        ry: PANEL.radius,
        fill: PANEL.fill,
        stroke: PANEL.stroke,
        strokeWidth: PANEL.strokeWidth,
        id: GROUPED_PANEL_IDS.overlapUnder,
        selectable: false,
        evented: false,
        vigiliaPaint: { fill: "palette.panel", stroke: "palette.edge" },
        vigiliaGlass: { blurRadius: PANEL.blurRadius },
      },
      {
        // Intersects the panel above it over 90x110 artboard units.
        type: "Rect",
        version: "7.4.0",
        originX: "left",
        originY: "top",
        left: 230,
        top: 320,
        width: GROUPED_BOXES.overlapOver.width,
        height: GROUPED_BOXES.overlapOver.height,
        rx: PANEL.radius,
        ry: PANEL.radius,
        fill: PANEL.fill,
        stroke: PANEL.stroke,
        strokeWidth: PANEL.strokeWidth,
        id: GROUPED_PANEL_IDS.overlapOver,
        selectable: false,
        evented: false,
        vigiliaPaint: { fill: "palette.panel", stroke: "palette.edge" },
        vigiliaGlass: { blurRadius: PANEL.blurRadius },
      },
    ],
  },
  bindings: {
    [CLOCK_NODE_ID]: [
      { id: "bound-value", semanticKey: "time.now", format: "HH:mm:ss" },
    ],
  },
};

/** The same URL shape `font-catalog.ts` uses, so the fixture declares a real
 * packaged face; bytes are cached, not vendored. */
async function fontBytes(): Promise<Uint8Array> {
  const cached = path.join(FONT_CACHE_DIR, "inter-400.woff2");
  try {
    return new Uint8Array(readFileSync(cached));
  } catch {
    const response = await fetch(FONT_SOURCE_URL);
    if (!response.ok) {
      throw new Error(
        `Could not download the e2e font fixture (${response.status}). ` +
          "The suite needs network access once to seed it.",
      );
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    mkdirSync(FONT_CACHE_DIR, { recursive: true });
    writeFileSync(cached, bytes);
    return bytes;
  }
}

/** Writes the packages the host serves. `writeThemePackage` owns validation, so
 * the fixture cannot drift into an envelope the player would reject. */
export async function seedHostTheme(): Promise<void> {
  const assets = {
    "assets/badge.svg": new TextEncoder().encode(badge),
    "assets/inter-400.woff2": await fontBytes(),
  };

  const themes = [
    envelopeFor(HOST_THEME_ID, "E2E hosted", CLOCK_NODE_ID, {
      semanticKey: "time.now",
      format: "HH:mm:ss",
    }),
    envelopeFor(HOST_DISK_THEME_ID, "E2E disk", CLOCK_NODE_ID, {
      semanticKey: "disk.used",
    }),
    // Whole degrees, so a test can compare the painted reading against the
    // sample it came from without re-implementing the renderer's number format.
    envelopeFor(HOST_TEMP_THEME_ID, "E2E temperature", TEMPERATURE_NODE_ID, {
      semanticKey: "gpu.temp",
      precision: 0,
    }),
    envelopeFor(
      HOST_JAPANESE_THEME_ID,
      "E2E language",
      CLOCK_NODE_ID,
      { semanticKey: "date.today", format: "[日付 ]MMM ddd" },
      "ja",
    ),
    envelopeFor(HOST_ENGLISH_THEME_ID, "E2E language", CLOCK_NODE_ID, {
      semanticKey: "date.today",
      format: "[日付 ]MMM ddd",
    }),
    groupedGlassEnvelope,
    mediaEnvelope,
    // **A key nothing can report.** The envelope validator only checks that a
    // semantic key is a string of 1-120 characters, so this is a well-formed
    // package that a display must render as a gap.
    {
      ...envelopeFor(HOST_MISSING_THEME_ID, "E2E missing", CLOCK_NODE_ID, {
        semanticKey: "quantum.entanglement",
      }),
      scene: {
        version: "7.4.0" as const,
        objects: [
          {
            type: "Textbox",
            version: "7.4.0",
            originX: "left",
            originY: "top",
            left: 40,
            top: 140,
            width: 420,
            height: 60,
            text: "--",
            fontSize: 22,
            fontFamily: "system-ui, sans-serif",
            fill: "palette.ink",
            id: CLOCK_NODE_ID,
            vigiliaPaint: { fill: "palette.ink" },
            vigiliaText: {
              runs: [
                {
                  kind: "value",
                  bindingId: "bound-value",
                  typePreset: "typePresets.11-400",
                  style: { color: { ref: "palette.ink" } },
                },
              ],
            },
          },
        ],
      },
    },
  ];

  rmSync(HOST_THEMES_DIR, { recursive: true, force: true });
  mkdirSync(HOST_THEMES_DIR, { recursive: true });

  for (const envelope of themes) {
    // A package's bytes must match its own declaration exactly, so a theme
    // that declares a subset gets that subset rather than the whole map.
    const declared = new Set(
      (envelope.assets ?? []).map((entry) => entry.path),
    );
    const result = writeThemePackage({
      envelope,
      assets: Object.fromEntries(
        Object.entries(assets).filter(([assetPath]) => declared.has(assetPath)),
      ),
    });
    if (!result.ok) {
      throw new Error(`E2E host fixture is invalid: ${result.message}`);
    }

    writeFileSync(
      path.join(HOST_THEMES_DIR, `${envelope.id}.vigilia-theme`),
      result.bytes,
    );
  }
}
