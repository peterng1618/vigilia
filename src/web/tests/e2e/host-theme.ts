import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeThemePackage } from "@vigilia/theme-package";

/** Seeds a theme package into the host's themes directory so a browser test can
 * load it through the real host — the path `vite preview` cannot exercise. */

const here = path.dirname(fileURLToPath(import.meta.url));

export const HOST_PORT = 4175;
export const HOST_THEME_ID = "e2e-hosted";
export const HOST_THEMES_DIR = path.join(here, "..", "..", ".e2e-host-themes");

const envelope = {
  schemaVersion: 2 as const,
  fabricVersion: "7.4.0",
  id: HOST_THEME_ID,
  metadata: { name: "E2E hosted" },
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
    ],
  },
};

const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <circle cx="12" cy="12" r="10" fill="#e8ecf3" />
</svg>
`;

/** Writes the package the host serves. `writeThemePackage` owns validation, so
 * the fixture cannot drift into an envelope the player would reject. */
export function seedHostTheme(): void {
  const result = writeThemePackage({
    envelope,
    assets: { "assets/badge.svg": new TextEncoder().encode(badge) },
  });

  if (!result.ok) {
    throw new Error(`E2E host fixture is invalid: ${result.message}`);
  }

  rmSync(HOST_THEMES_DIR, { recursive: true, force: true });
  mkdirSync(HOST_THEMES_DIR, { recursive: true });
  writeFileSync(
    path.join(HOST_THEMES_DIR, `${HOST_THEME_ID}.vigilia-theme`),
    result.bytes,
  );
}
