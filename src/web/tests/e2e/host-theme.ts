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
    fitMode: "contain" as const,
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
  ];

  rmSync(HOST_THEMES_DIR, { recursive: true, force: true });
  mkdirSync(HOST_THEMES_DIR, { recursive: true });

  for (const envelope of themes) {
    const result = writeThemePackage({ envelope, assets });
    if (!result.ok) {
      throw new Error(`E2E host fixture is invalid: ${result.message}`);
    }

    writeFileSync(
      path.join(HOST_THEMES_DIR, `${envelope.id}.vigilia-theme`),
      result.bytes,
    );
  }
}
