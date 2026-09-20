import { describe, expect, it } from "vitest";
import { validateFabricThemeEnvelope } from "./fabric-envelope-validate.js";

function envelope(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "theme",
    artboard: { width: 400, height: 300 },
    bindings: { chart: [{ id: "cpu", semanticKey: "cpu.load", precision: 0 }] },
    scene: {
      version: "7.4.0",
      objects: [
        {
          type: "VigiliaChart",
          id: "chart",
          objects: [{ type: "Rect", id: "child" }],
        },
      ],
    },
  };
}

function fontAsset(id: string, weight: number): Record<string, unknown> {
  return {
    id,
    kind: "font",
    path: `assets/${id}.woff2`,
    family: "Inter",
    weight,
    style: "normal",
    format: "woff2",
    sourceUrl:
      "https://cdn.jsdelivr.net/fontsource/fonts/inter@5.1.1/latin-400-normal.woff2",
    license: {
      name: "SIL Open Font License 1.1",
      url: "https://openfontlicense.org/",
    },
  };
}

function envelopeWithFontRoles(): Record<string, unknown> {
  return {
    ...envelope(),
    assets: [
      fontAsset("heading-face", 700),
      fontAsset("body-face", 400),
      fontAsset("mono-face", 400),
    ],
    globals: {
      typePresets: {
        heading: {
          name: "Heading",
          value: {
            family: "Inter",
            size: 32,
            weight: 700,
            face: { assetId: "heading-face" },
            trioRole: "heading",
          },
        },
        metric: {
          name: "Metric",
          value: {
            family: "Inter",
            size: 48,
            weight: 700,
            face: { assetId: "heading-face" },
            trioRole: "heading",
          },
        },
        body: {
          name: "Body",
          value: {
            family: "Inter",
            size: 16,
            face: { assetId: "body-face" },
            trioRole: "body",
          },
        },
        mono: {
          name: "Mono",
          value: {
            family: "Inter",
            size: 14,
            face: { assetId: "mono-face" },
            trioRole: "mono",
          },
        },
      },
    },
  };
}

describe("Fabric theme envelope validation", () => {
  it("accepts a bounded Fabric scene with identities and semantic bindings", () => {
    expect(validateFabricThemeEnvelope(envelope())).toMatchObject({ ok: true });
  });

  it("accepts one declared background image or video and a semantic release version", () => {
    expect(
      validateFabricThemeEnvelope({
        ...envelope(),
        metadata: { version: "1.2.3" },
        artboard: {
          width: 400,
          height: 300,
          backgroundMedia: { assetId: "clip", fit: "cover" },
        },
        assets: [{ id: "clip", kind: "video", path: "assets/clip.mp4" }],
      }),
    ).toMatchObject({ ok: true });
  });

  it("rejects malformed versions and invalid background-media references", () => {
    const result = validateFabricThemeEnvelope({
      ...envelope(),
      metadata: { version: "v1.2.3" },
      artboard: {
        width: 400,
        height: 300,
        backgroundMedia: { assetId: "font", fit: "stretch" },
      },
      assets: [{ id: "font", kind: "font", path: "assets/body.woff2" }],
    });

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "/metadata/version" }),
        expect.objectContaining({ path: "/artboard/backgroundMedia/fit" }),
        expect.objectContaining({ path: "/artboard/backgroundMedia/assetId" }),
      ]),
    });
  });

  it("reports an unknown version alone before interpreting the envelope", () => {
    const result = validateFabricThemeEnvelope({
      ...envelope(),
      schemaVersion: 3,
      artboard: "wrong",
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "newer-schema-version", path: "/schemaVersion" }],
    });
    if (!result.ok) expect(result.issues).toHaveLength(1);
  });

  it("rejects unknown envelope fields and malformed Fabric scene state", () => {
    const result = validateFabricThemeEnvelope({
      ...envelope(),
      unexpected: true,
      scene: {
        version: "7.4.0",
        objects: [{ type: "Rect", id: "x", width: Number.POSITIVE_INFINITY }],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "unknown-field",
            path: "/unexpected",
          }),
          expect.objectContaining({
            code: "invalid-fabric-scene",
            path: "/scene/objects/0/width",
          }),
        ]),
      );
    }
  });

  it("rejects anonymous or duplicate Fabric objects and malformed bindings", () => {
    const result = validateFabricThemeEnvelope({
      ...envelope(),
      bindings: {
        chart: [
          { id: "same", semanticKey: "" },
          { id: "same", semanticKey: "gpu.load" },
        ],
      },
      scene: {
        version: "7.4.0",
        objects: [
          { type: "Rect", id: "same" },
          { type: "Rect", id: "same" },
          { type: "Rect" },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "duplicate-id",
            path: "/bindings/chart/1/id",
          }),
          expect.objectContaining({
            code: "missing-field",
            path: "/bindings/chart/0/semanticKey",
          }),
          expect.objectContaining({
            code: "duplicate-id",
            path: "/scene/objects/1/id",
          }),
          expect.objectContaining({
            code: "invalid-id",
            path: "/scene/objects/2/id",
          }),
        ]),
      );
    }
  });

  it("keeps shared semantics valid while refusing obsolete GIF assets", () => {
    const result = validateFabricThemeEnvelope({
      ...envelope(),
      metadata: { name: "Valid", unexpected: true },
      assets: [{ id: "animated", kind: "gif", path: "assets/animated.gif" }],
      editorMetadata: ["not-an-object"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "unknown-field",
            path: "/metadata/unexpected",
          }),
          expect.objectContaining({
            code: "invalid-enum",
            path: "/assets/0/kind",
          }),
          expect.objectContaining({
            code: "wrong-type",
            path: "/editorMetadata",
          }),
        ]),
      );
    }
  });

  it("requires an immutable transparent palette.none whenever a palette is present", () => {
    const missing = validateFabricThemeEnvelope({
      ...envelope(),
      globals: {
        palette: {
          accent: {
            name: "Accent",
            value: { kind: "solid", color: "#00b8d9" },
          },
        },
      },
    });
    const renamed = validateFabricThemeEnvelope({
      ...envelope(),
      globals: {
        palette: {
          none: {
            name: "Clear",
            value: { kind: "solid", color: "transparent" },
          },
        },
      },
    });

    expect(missing).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ path: "/globals/palette/none" })],
    });
    expect(renamed).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ path: "/globals/palette/none" })],
    });
    expect(
      validateFabricThemeEnvelope({
        ...envelope(),
        globals: {
          palette: {
            none: {
              name: "None",
              value: { kind: "solid", color: "transparent" },
            },
          },
        },
      }),
    ).toMatchObject({ ok: true });
  });

  it("accepts CSS-compatible solid colours and ordered angled gradients", () => {
    expect(
      validateFabricThemeEnvelope({
        ...envelope(),
        globals: {
          palette: {
            none: {
              name: "None",
              value: { kind: "solid", color: "transparent" },
            },
            ink: { name: "Ink", value: { kind: "solid", color: "#101216" } },
            glow: {
              name: "Glow",
              value: {
                kind: "gradient",
                angle: 45,
                stops: [
                  { offset: 0, color: "rgb(0, 0, 0)" },
                  { offset: 1, color: "#ffffff" },
                ],
              },
            },
          },
        },
      }),
    ).toMatchObject({ ok: true });
  });

  it("rejects resolved object paint without a palette reference", () => {
    const result = validateFabricThemeEnvelope({
      ...envelope(),
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          ink: { name: "Ink", value: { kind: "solid", color: "#fff" } },
        },
      },
      scene: {
        version: "7.4.0",
        objects: [{ type: "Rect", id: "box", fill: "#fff" }],
      },
    });
    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "unresolved-global-ref",
          path: "/scene/objects/0/fill",
        }),
      ]),
    });
  });

  it("requires palette references for persisted chart paint", () => {
    const base = {
      ...envelope(),
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          accent: {
            name: "Accent",
            value: { kind: "solid", color: "#00b8d9" },
          },
        },
      },
    };
    const valid = validateFabricThemeEnvelope({
      ...base,
      scene: {
        version: "7.4.0",
        objects: [
          {
            type: "VigiliaChart",
            id: "chart",
            family: "gauge",
            settings: {
              track: { ref: "palette.none" },
              progress: { ref: "palette.accent" },
            },
          },
        ],
      },
    });
    const literal = validateFabricThemeEnvelope({
      ...base,
      scene: {
        version: "7.4.0",
        objects: [
          {
            type: "VigiliaChart",
            id: "chart",
            family: "gauge",
            settings: {
              track: { kind: "solid", color: "#000" },
              progress: { ref: "palette.accent" },
            },
          },
        ],
      },
    });

    expect(valid).toMatchObject({ ok: true });
    expect(literal).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "unresolved-global-ref",
          path: "/scene/objects/0/settings/track",
        }),
      ]),
    });
  });

  it("rejects resolved text type without a preset reference", () => {
    const result = validateFabricThemeEnvelope({
      ...envelope(),
      globals: {
        typePresets: {
          body: { name: "Body", value: { family: "Inter", size: 16 } },
        },
      },
      scene: {
        version: "7.4.0",
        objects: [
          { type: "Textbox", id: "label", fontFamily: "Inter", fontSize: 16 },
        ],
      },
    });
    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "unresolved-global-ref",
          path: "/scene/objects/0/vigiliaText",
        }),
      ]),
    });
  });

  it("accepts typed presets as v2 globals", () => {
    expect(
      validateFabricThemeEnvelope({
        ...envelope(),
        globals: {
          typePresets: {
            metric: {
              name: "Metric",
              value: {
                family: "Inter",
                size: 32,
                weight: 700,
                lineHeight: 1.1,
              },
            },
          },
        },
      }),
    ).toMatchObject({ ok: true });
  });

  it("validates exact declared font faces and shared trio roles", () => {
    expect(
      validateFabricThemeEnvelope(envelopeWithFontRoles(), {
        requireTrioRoles: true,
      }),
    ).toMatchObject({ ok: true });
  });

  it("rejects a face with metadata that disagrees with its WOFF2 declaration", () => {
    const result = validateFabricThemeEnvelope({
      ...envelopeWithFontRoles(),
      assets: [
        fontAsset("heading-face", 600),
        fontAsset("body-face", 400),
        fontAsset("mono-face", 400),
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: "/globals/typePresets/heading/value/face/assetId",
        }),
      ]),
    });
  });

  it("requires all starter roles only when requested", () => {
    const theme = envelopeWithFontRoles();
    const globals = theme["globals"] as Record<string, unknown>;
    const presets = globals["typePresets"] as Record<string, unknown>;
    delete presets["mono"];

    expect(validateFabricThemeEnvelope(theme)).toMatchObject({ ok: true });
    expect(
      validateFabricThemeEnvelope(theme, { requireTrioRoles: true }),
    ).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "/globals/typePresets" }),
      ]),
    });
  });

  it("rejects transitional globals and literal artboard paint", () => {
    const result = validateFabricThemeEnvelope({
      ...envelope(),
      artboard: { width: 400, height: 300, background: { value: "#101216" } },
      globals: { fonts: { body: { name: "Body", value: "Inter" } } },
    });

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "unknown-field",
          path: "/globals/fonts",
        }),
        expect.objectContaining({
          code: "unresolved-global-ref",
          path: "/artboard/background",
        }),
      ]),
    });
  });

  it("rejects local text-run colour and type settings", () => {
    const result = validateFabricThemeEnvelope({
      ...envelope(),
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          text: { name: "Text", value: { kind: "solid", color: "#fff" } },
        },
        typePresets: {
          body: { name: "Body", value: { family: "Inter", size: 16 } },
        },
      },
      scene: {
        version: "7.4.0",
        objects: [
          {
            type: "Textbox",
            id: "label",
            fill: "#fff",
            vigiliaPaint: { fill: "palette.text" },
            vigiliaText: {
              runs: [
                {
                  kind: "literal",
                  text: "CPU",
                  typePreset: "typePresets.body",
                  style: { color: { value: "#fff" }, fontSize: { value: 16 } },
                },
              ],
            },
          },
        ],
      },
    });

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "unknown-field",
          path: "/scene/objects/0/vigiliaText/runs/0/style/fontSize",
        }),
        expect.objectContaining({
          code: "unresolved-global-ref",
          path: "/scene/objects/0/vigiliaText/runs/0/style/color",
        }),
      ]),
    });
  });
});
