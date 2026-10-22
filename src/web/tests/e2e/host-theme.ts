import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type APIRequestContext, request } from "@playwright/test";
import { writeThemePackage } from "@yunari/theme-package";

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

/**
 * A client for a host this spec started, accepting the certificate it issues
 * itself (`docs/decisions/0070`).
 *
 * The host serves both protocols on one port, so a spec may read it either way;
 * this exists for the ones that read the **secure** origin, which is the one a
 * display is meant to use. Node's own `fetch` cannot be told to accept a root
 * this machine's trust store has not been given — installing one is the owner's
 * step and a test must not take it — so the choice is this or a process-wide
 * `NODE_TLS_REJECT_UNAUTHORIZED`, which would also switch the check off for the
 * font download in this file.
 *
 * `request.newContext` rather than the `request` fixture, because a spec that
 * polls a host does it in `beforeAll`, where fixtures do not exist. **Dispose
 * it.**
 */
export async function hostClient(baseURL: string): Promise<APIRequestContext> {
  return request.newContext({ ignoreHTTPSErrors: true, baseURL });
}
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
/**
 * A theme-bounded image the player must place by its authored transform and
 * clip to the artboard, with a glass panel over it.
 *
 * **The board is wide and the source narrow on purpose.** `contain` then
 * letterboxes the artboard vertically on any viewport, and the `scale`/`offsetX`
 * push the media out of the board's top, bottom and right edges — so the
 * placed-but-clipped region is on screen and a pixel read there is evidence
 * rather than an off-screen coordinate. A square source in a 16:9 board
 * happened to overflow only where a desktop viewport ends, which no screenshot
 * can read.
 */
export const HOST_BACKGROUND_LAYER_THEME_ID = "e2e-background-layer";
/** The ink the background-layer source paints, read back from a screenshot. */
export const BACKGROUND_LAYER_INK = { r: 232, g: 236, b: 243 } as const;
/** The theme's background colour, which is also the host's letterbox paint. */
export const BACKGROUND_LAYER_PAINT = { r: 0x10, g: 0x13, b: 0x18 } as const;
/**
 * A video background and **no glass** — the one cost whose answer depends on
 * the display the theme is given to, which is what the assignment's warning
 * table is read against. Nothing here is ever decoded: the cost is read from
 * the asset's declaration, and no test mounts this theme on a player.
 */
export const HOST_VIDEO_THEME_ID = "e2e-video";
/**
 * **One chart, bound to nothing** — the theme a frame-determinism case needs.
 *
 * Every other fixture here binds a key the host's own sample stream answers, and
 * a live reading is a different value on every page load, so two frames of one
 * display would differ for a reason that has nothing to do with the clock. This
 * theme declares no `bindings` at all, so nothing on it moves except time: a
 * gauge with no datum draws its track and nothing else (`buildGaugeOption`'s
 * "missing samples show only the track, never a false zero").
 */
export const HOST_CHART_THEME_ID = "e2e-chart";
/** The chart's own id, so a test can name the canvas it compares. */
export const CHART_NODE_ID = "e2e-gauge";
/**
 * Two quarter-discs hanging off opposite edges of a 640 × 360 artboard, and an
 * open arc well inside it.
 *
 * The composition `host-viewport-refit.spec.ts` measures its mount frames
 * against: an object that straddles the edge is what makes "did the composition
 * move when the display mounted" a reading rather than an absence, and the arc
 * keeps the frame from being a test of emptiness. Opposite sides on purpose —
 * a one-sided overhang cannot show a shift that is really a re-centring.
 *
 * **It used to carry the deliberate bleed mark, and does not any more.** That is
 * the whole point of keeping it: the strip this theme once raised at mount is
 * what moved `stray-quarter` +30.61 px, and the same composition with the strip
 * gone is what `vg-572` waits on (`docs/decisions/0069`).
 *
 * **The discs are placed so part of each survives the clip.** A `Wedge` swept
 * 0°–90° occupies the bottom-right quadrant of its own centre, so a centre near
 * the artboard's edge puts half the shape on the canvas and half past it.
 * Placing the whole quadrant outside would render nothing at all and pass every
 * assertion while showing a reader an empty frame. Worked out rather than
 * eyeballed, because `left`/`top` are the bounding box's corner and the centre
 * is `left + radius`, `top + radius`:
 *   - bleeding-quarter: centre (560, 200), radius 140 → x 560…700, and the
 *     artboard ends at 640, so 60 units are cut and 80 are drawn.
 *   - stray-quarter: swept 90°–180° so it occupies the *left* quadrant, centre
 *     (80, 200) → x −60…80, so 60 units are cut past the left edge.
 */
export const HOST_OVERHANG_THEME_ID = "e2e-overhang";

/** The host's app folder; it owns both the library and the settings beside it. */
export const HOST_APP_DIR = path.join(here, "..", "..", ".e2e-host-app");
/** The library itself, where each theme is one folder (ADR-0017). */
export const HOST_THEMES_DIR = path.join(HOST_APP_DIR, "themes");
/** Host state, out of the library so a theme folder is only ever a theme. */
export const HOST_SETTINGS_DIR = path.join(HOST_APP_DIR, "settings");

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
  themeLanguage = "en",
) => ({
  schemaVersion: 2 as const,
  fabricVersion: "7.4.0",
  id,
  metadata: { name, themeLanguage },
  artboard: {
    width: 640,
    height: 360,
    contentFit: "contain" as const,
  },
  background: { color: { ref: "palette.bar" as const } },
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
      license: { name: "MIT", attribution: "Yunari test fixture." },
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
        yunariPaint: { fill: "palette.ink" },
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
        yunariPaint: { fill: "palette.ink" },
        yunariText: {
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
        yunariPaint: { fill: "palette.ink" },
        yunariText: {
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
        yunariPaint: { fill: "palette.ink" },
        yunariText: {
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

/**
 * The chart-only envelope. Settings carry palette references rather than
 * literals for the reason every other chart does: a resolved colour with no
 * token behind it is what the envelope validator refuses
 * (`chartPaintReferences`).
 */
const chartEnvelope = {
  schemaVersion: 2 as const,
  fabricVersion: "7.4.0",
  id: HOST_CHART_THEME_ID,
  metadata: { name: "E2E chart", themeLanguage: "en" },
  artboard: {
    width: 640,
    height: 360,
    contentFit: "contain" as const,
  },
  background: { color: { ref: "palette.bar" as const } },
  globals: {
    palette: {
      // Required by the envelope validator on every v2 document, used or not.
      none: {
        name: "None",
        value: { kind: "solid" as const, color: "transparent" },
      },
      bar: { name: "Bar", value: { kind: "solid" as const, color: "#101318" } },
      track: {
        name: "Track",
        value: { kind: "solid" as const, color: "#2a2f3a" },
      },
      ink: { name: "Ink", value: { kind: "solid" as const, color: "#e8ecf3" } },
    },
    typePresets: {},
  },
  assets: [],
  scene: {
    version: "7.4.0" as const,
    objects: [
      {
        type: "YunariChart" as const,
        version: "7.4.0" as const,
        id: CHART_NODE_ID,
        name: CHART_NODE_ID,
        // Centred, because that is `YunariChart`'s own default origin.
        left: 320,
        top: 180,
        width: 260,
        height: 260,
        family: "gauge" as const,
        settings: {
          startAngle: 225,
          endAngle: -45,
          min: 0,
          max: 100,
          thickness: 18,
          roundCap: true,
          track: { ref: "palette.track" },
          progress: { ref: "palette.ink" },
        },
      },
    ],
  },
};

const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <circle cx="12" cy="12" r="10" fill="#e8ecf3" />
</svg>
`;

/** The background layer's own source: 12 × 24 of one ink, so a pixel inside the
 *  placed rect has one answer and any other colour there is a wrong crop. */
const backdrop = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 24" width="12" height="24">
  <rect width="12" height="24" fill="#e8ecf3" />
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
  metadata: { name: "E2E media", themeLanguage: "en" },
  artboard: {
    width: 640,
    height: 360,
    contentFit: "contain" as const,
  },
  background: {
    color: { ref: "palette.bar" as const },
    media: { assetId: "badge", bounds: "display" as const },
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
      license: { name: "MIT", attribution: "Yunari test fixture." },
    },
  ],
  scene: { version: "7.4.0" as const, objects: [] },
};

/**
 * The transform-and-clip fixture: a narrow source placed with `contain`,
 * `scale: 1.4` and `offsetX: 0.25` inside a 640 × 200 board, under a glass
 * panel that sits wholly inside the media.
 *
 * Worked out rather than eyeballed, because a media strip that stayed inside the
 * board would make every clip assertion vacuous: the source is 12 × 24, so
 * `contain` fits it to 100 × 200 with scale 8.33…, `1.4` makes it 140 × 280,
 * the `0.25` offset moves its centre 160 units right, and the result is
 * x 410…550, y −40…240 — over the board's top, bottom and right by 40, 40 and
 * 0 units but for the panel already covering the middle.
 */
const backgroundLayerEnvelope = {
  schemaVersion: 2 as const,
  fabricVersion: "7.4.0",
  id: HOST_BACKGROUND_LAYER_THEME_ID,
  metadata: { name: "E2E background layer", themeLanguage: "en" },
  artboard: {
    width: 640,
    height: 200,
    contentFit: "contain" as const,
  },
  background: {
    color: { ref: "palette.bar" as const },
    media: {
      assetId: "backdrop",
      bounds: "theme" as const,
      fit: "contain" as const,
      scale: 1.4,
      offsetX: 0.25,
    },
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
        value: { kind: "solid" as const, color: "rgba(255, 255, 255, 0.10)" },
      },
      edge: {
        name: "Edge",
        value: { kind: "solid" as const, color: "rgba(255, 255, 255, 0.35)" },
      },
    },
    typePresets: {},
  },
  assets: [
    {
      id: "backdrop",
      kind: "svg" as const,
      path: "assets/backdrop.svg",
      license: { name: "MIT", attribution: "Yunari test fixture." },
    },
  ],
  scene: {
    version: "7.4.0" as const,
    objects: [
      {
        // Wholly inside the media strip (x 410…550, y −40…240). The glass then
        // samples the placed bitmap through Task 7's backdrop, and the strip is
        // still visible below the panel where the pixel read looks.
        type: "Rect" as const,
        version: "7.4.0" as const,
        originX: "left" as const,
        originY: "top" as const,
        left: 420,
        top: 20,
        width: 120,
        height: 120,
        rx: 16,
        ry: 16,
        fill: "rgba(255, 255, 255, 0.10)",
        stroke: "rgba(255, 255, 255, 0.35)",
        strokeWidth: 2,
        id: "media-panel",
        selectable: false,
        evented: false,
        yunariPaint: { fill: "palette.panel", stroke: "palette.edge" },
        yunariGlass: { blurRadius: 16 },
      },
    ],
  },
};

/** A video background, declared and never decoded: the bytes beside it are a
 *  placeholder, because the cost the host reads is the asset's declaration and
 *  the library writer only checks that a declared asset is present. An empty
 *  scene, so the theme carries no glass and answers `video-background`. */
const videoEnvelope = {
  schemaVersion: 2 as const,
  fabricVersion: "7.4.0",
  id: HOST_VIDEO_THEME_ID,
  metadata: { name: "E2E video", themeLanguage: "en" },
  artboard: {
    width: 640,
    height: 360,
    contentFit: "contain" as const,
  },
  background: {
    color: { ref: "palette.bar" as const },
    media: { assetId: "loop", bounds: "theme" as const },
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
      id: "loop",
      kind: "video" as const,
      path: "assets/loop.webm",
      license: { name: "CC0", attribution: "Yunari test fixture." },
    },
  ],
  scene: { version: "7.4.0" as const, objects: [] },
};

/** The overhang composition, unmarked: see {@link HOST_OVERHANG_THEME_ID}. */
const overhangEnvelope = {
  schemaVersion: 2 as const,
  fabricVersion: "7.4.0",
  id: HOST_OVERHANG_THEME_ID,
  metadata: { name: "E2E overhang", themeLanguage: "en" },
  artboard: {
    width: 640,
    height: 360,
    contentFit: "contain" as const,
  },
  background: { color: { ref: "palette.bar" as const } },
  globals: {
    palette: {
      none: {
        name: "None",
        value: { kind: "solid" as const, color: "transparent" },
      },
      ink: { name: "Ink", value: { kind: "solid" as const, color: "#e8ecf3" } },
      bar: { name: "Bar", value: { kind: "solid" as const, color: "#101318" } },
    },
    typePresets: {},
  },
  assets: [],
  scene: {
    version: "7.4.0" as const,
    objects: [
      {
        type: "Wedge" as const,
        version: "7.4.0" as const,
        originX: "left" as const,
        originY: "top" as const,
        left: 420,
        top: 60,
        radius: 140,
        startAngle: 0,
        endAngle: 90,
        fill: "#e8ecf3",
        id: "bleeding-quarter",
        // Resolved paint is a cache; the authored owner is a palette token, and
        // the validator refuses a resolved colour with no token behind it. The
        // literal is what a display draws, since the player resolves no palette
        // paints of its own (ADR-0026).
        yunariPaint: { fill: "palette.ink" },
      },
      {
        type: "Wedge" as const,
        version: "7.4.0" as const,
        originX: "left" as const,
        originY: "top" as const,
        left: -60,
        top: 60,
        radius: 140,
        startAngle: 90,
        endAngle: 180,
        fill: "#e8ecf3",
        id: "stray-quarter",
        yunariPaint: { fill: "palette.ink" },
      },
      {
        // An arc is an **open sweep**: no interior, so no fill, and it draws as
        // a curve. A fill would close it with a chord and make it a circular
        // segment, which is why the treatment is refused at revival (ADR-0026).
        type: "Arc" as const,
        version: "7.4.0" as const,
        originX: "left" as const,
        originY: "top" as const,
        left: 100,
        top: 100,
        radius: 70,
        startAngle: 0,
        endAngle: 90,
        stroke: "#e8ecf3",
        strokeWidth: 6,
        strokeLineCap: "round" as const,
        fill: "",
        id: "open-arc",
        yunariPaint: { stroke: "palette.ink" },
      },
    ],
  },
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
 * the host's route needs, [#3](https://github.com/peterng1618/yunari/issues/3) —
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
  metadata: { name: "E2E grouped glass", themeLanguage: "en" },
  artboard: {
    width: 640,
    height: 480,
    contentFit: "contain" as const,
  },
  background: { color: { ref: "palette.none" as const } },
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
          yunariPaint: { fill: light ? "palette.light" : "palette.dark" },
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
            yunariPaint: {
              fill: "palette.panel",
              stroke: "palette.edge",
            },
            yunariGlass: { blurRadius: PANEL.blurRadius },
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
            yunariPaint: { fill: "palette.tag" },
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
        yunariPaint: { fill: "palette.panel", stroke: "palette.edge" },
        yunariGlass: { blurRadius: PANEL.blurRadius },
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
        yunariPaint: { fill: "palette.ink" },
        yunariText: {
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
        yunariPaint: { fill: "palette.panel", stroke: "palette.edge" },
        yunariGlass: { blurRadius: PANEL.blurRadius },
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
        yunariPaint: { fill: "palette.panel", stroke: "palette.edge" },
        yunariGlass: { blurRadius: PANEL.blurRadius },
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
    "assets/backdrop.svg": new TextEncoder().encode(backdrop),
    "assets/inter-400.woff2": await fontBytes(),
    // Declared by the video theme and never decoded by any test: the host's
    // warning table reads the declaration, and the library writer refuses a
    // declaration with no file beside it. Four bytes of EBML header stand in
    // for a recording nothing plays.
    "assets/loop.webm": new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
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
    backgroundLayerEnvelope,
    videoEnvelope,
    chartEnvelope,
    overhangEnvelope,
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
            yunariPaint: { fill: "palette.ink" },
            yunariText: {
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

  rmSync(HOST_APP_DIR, { recursive: true, force: true });
  mkdirSync(HOST_THEMES_DIR, { recursive: true });

  for (const envelope of themes) {
    // A theme's bytes must match its own declaration exactly, so a theme
    // that declares a subset gets that subset rather than the whole map.
    const declared = new Set(
      (envelope.assets ?? []).map((entry) => entry.path),
    );
    const themeAssets = Object.fromEntries(
      Object.entries(assets).filter(([assetPath]) => declared.has(assetPath)),
    );
    // Validated by writing it, which is the one the store also does; a
    // fixture that cannot be saved would fail the browser test far from here.
    const result = writeThemePackage({ envelope, assets: themeAssets });
    if (!result.ok) {
      throw new Error(`E2E host fixture is invalid: ${result.message}`);
    }

    // The library is a folder: the document beside the bytes it declares
    // (ADR-0017). The archive above is only ever what an author exports.
    const folder = path.join(HOST_THEMES_DIR, envelope.id);
    mkdirSync(path.join(folder, "assets"), { recursive: true });
    writeFileSync(path.join(folder, "theme.json"), JSON.stringify(envelope));
    for (const [assetPath, bytes] of Object.entries(themeAssets)) {
      const file = path.join(folder, ...assetPath.split("/"));
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, bytes);
    }
  }
}
