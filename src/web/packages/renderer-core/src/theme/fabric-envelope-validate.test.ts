import { describe, expect, it } from "vitest";
import {
  type FabricEnvelopeValidationResult,
  validateFabricThemeEnvelope,
} from "./fabric-envelope-validate.js";
import type { ValidationIssue } from "./validate.js";

function withMetadata(
  base: Record<string, unknown>,
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  return { ...base, metadata };
}

function withoutKey(
  base: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const copy = { ...base };
  delete copy[key];
  return copy;
}

function issuesOf(
  result: FabricEnvelopeValidationResult,
): readonly ValidationIssue[] {
  return result.ok ? [] : result.issues;
}

function envelope(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "theme",
    metadata: { locale: "en" },
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
        metadata: { version: "1.2.3", locale: "en" },
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
      metadata: { version: "v1.2.3", locale: "en" },
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
      metadata: { name: "Valid", locale: "en", unexpected: true },
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

  it("requires a palette reference for the string form of a shadow", () => {
    // Fabric accepts a shadow as a CSS string and parses it into a real Shadow
    // with a real colour, so the unowned-literal hole is the same one the
    // object form has. A hand-edited theme would otherwise smuggle a resolved
    // colour past the check that exists precisely to prevent that.
    const result = validateFabricThemeEnvelope({
      ...withoutKey(
        {
          ...envelope(),
          globals: {
            palette: {
              none: {
                name: "None",
                value: { kind: "solid", color: "transparent" },
              },
              edge: {
                name: "Edge",
                value: { kind: "solid", color: "#0a0f16" },
              },
            },
          },
        },
        "bindings",
      ),
      scene: {
        version: "7.4.0",
        objects: [{ type: "Rect", id: "panel", shadow: "0 0 18 #123456" }],
      },
    });

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "unresolved-global-ref",
          path: "/scene/objects/0/shadowColor",
        }),
      ]),
    });
  });

  it("refuses a shadow colour reference the renderer cannot apply", () => {
    // A gradient token resolves fine, but Fabric's `Shadow.color` is a string;
    // applyingPaints drops it. A reference that cannot be applied must be an
    // issue, matching how an unresolvable palette ref is already reported,
    // rather than a silent no-op that leaves the shadow unowned in practice.
    const result = validateFabricThemeEnvelope({
      ...withoutKey(
        {
          ...envelope(),
          globals: {
            palette: {
              none: {
                name: "None",
                value: { kind: "solid", color: "transparent" },
              },
              edge: {
                name: "Edge",
                value: {
                  kind: "gradient",
                  angle: 90,
                  stops: [
                    { offset: 0, color: "#0a0f16" },
                    { offset: 1, color: "#0d1b2a" },
                  ],
                },
              },
            },
          },
        },
        "bindings",
      ),
      scene: {
        version: "7.4.0",
        objects: [
          {
            type: "Rect",
            id: "panel",
            shadow: { color: "#0a0f16", blur: 18 },
            vigiliaPaint: { shadowColor: "palette.edge" },
          },
        ],
      },
    });

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "unresolved-global-ref",
          path: "/scene/objects/0/shadowColor",
        }),
      ]),
    });
  });

  it("requires a palette reference for a persisted shadow colour", () => {
    // Shadow is a native Fabric property, so its colour is resolved state
    // exactly like fill and stroke: it needs an owner in `vigiliaPaint`.
    const withPalette = {
      ...withoutKey(
        {
          ...envelope(),
          globals: {
            palette: {
              none: {
                name: "None",
                value: { kind: "solid", color: "transparent" },
              },
              edge: {
                name: "Edge",
                value: { kind: "solid", color: "#0a0f16" },
              },
            },
          },
        },
        "bindings",
      ),
    };

    expect(
      validateFabricThemeEnvelope({
        ...withPalette,
        scene: {
          version: "7.4.0",
          objects: [
            {
              type: "Rect",
              id: "panel",
              shadow: { color: "#0a0f16", blur: 18 },
              vigiliaPaint: { shadowColor: "palette.edge" },
            },
          ],
        },
      }).ok,
    ).toBe(true);

    expect(
      validateFabricThemeEnvelope({
        ...withPalette,
        scene: {
          version: "7.4.0",
          objects: [
            {
              type: "Rect",
              id: "panel",
              shadow: { color: "#0a0f16", blur: 18 },
            },
          ],
        },
      }),
    ).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "unresolved-global-ref",
          path: "/scene/objects/0/shadowColor",
        }),
      ]),
    });

    expect(
      validateFabricThemeEnvelope({
        ...withPalette,
        scene: {
          version: "7.4.0",
          objects: [
            {
              type: "Rect",
              id: "panel",
              shadow: { color: "#0a0f16", blur: 18 },
              vigiliaPaint: { shadowColor: "palette.gone" },
            },
          ],
        },
      }).ok,
    ).toBe(false);
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

  it("requires the theme to declare the language its text is written in", () => {
    // The realistic case: every v2 theme already has a metadata bag with a name
    // and author, so the refusal that matters is a bag without `locale` in it —
    // not a document missing metadata entirely. Both paths are pinned, since the
    // validator handles them separately.
    const withoutLocale = withMetadata(envelope(), {
      name: "Fixture",
      author: "Vigilia",
    });

    const missing = validateFabricThemeEnvelope(withoutLocale);
    expect(missing.ok).toBe(false);
    // A refusal that names the field, not a crash: a theme saved before this
    // change must fail legibly.
    expect(issuesOf(missing)).toContainEqual(
      expect.objectContaining({ path: "/metadata/locale" }),
    );

    const withoutMetadata = withoutKey(envelope(), "metadata");
    expect(
      issuesOf(validateFabricThemeEnvelope(withoutMetadata)),
    ).toContainEqual(expect.objectContaining({ path: "/metadata/locale" }));
  });

  it("refuses a language this runtime cannot render", () => {
    for (const locale of ["en_US", "xx-YY"]) {
      const result = validateFabricThemeEnvelope(
        withMetadata(envelope(), { name: "Fixture", locale }),
      );

      expect(result.ok).toBe(false);
      expect(issuesOf(result)).toContainEqual(
        expect.objectContaining({ path: "/metadata/locale" }),
      );
    }
  });

  it("accepts a theme that declares a language but binds no clock", () => {
    // The language is a fact about the document, not a demand that it show a clock.
    const result = validateFabricThemeEnvelope(
      withMetadata(envelope(), { name: "Fixture", locale: "ja" }),
    );

    expect(result.ok).toBe(true);
  });

  it("accepts a theme that declares a language but binds nothing at all", () => {
    // The factory's own binding is `cpu.load`, so the case above only proves the
    // absence of a clock key. A theme with no bindings whatsoever must also
    // validate: a language is a fact about the document, not a promise that any
    // reading is bound. Both spellings of "no bindings" are pinned, since the
    // validator only skips the bag entirely when the key is absent.
    const noBindingsKey = withoutKey(envelope(), "bindings");
    expect(
      validateFabricThemeEnvelope(
        withMetadata(noBindingsKey, { name: "Fixture", locale: "ja" }),
      ).ok,
    ).toBe(true);

    const emptyBindings = { ...envelope(), bindings: {} };
    expect(
      validateFabricThemeEnvelope(
        withMetadata(emptyBindings, { name: "Fixture", locale: "ja" }),
      ).ok,
    ).toBe(true);
  });
});

describe("authored glass treatment", () => {
  function withObjects(objects: readonly unknown[]): Record<string, unknown> {
    // The shared fixture binds a chart; these cases replace the scene, so the
    // binding would fail for an unrelated reason and hide the real one.
    return withoutKey(
      { ...envelope(), scene: { version: "7.4.0", objects } },
      "bindings",
    );
  }

  it("accepts a bounded radius, and treats absence as off", () => {
    // Absence must stay legal forever: a theme authored before glass existed
    // is not invalid because it lacks the property.
    expect(
      validateFabricThemeEnvelope(withObjects([{ type: "Rect", id: "panel" }]))
        .ok,
    ).toBe(true);
    expect(
      validateFabricThemeEnvelope(
        withObjects([
          { type: "Rect", id: "panel", vigiliaGlass: { blurRadius: 0 } },
          { type: "Rect", id: "soft", vigiliaGlass: { blurRadius: 48 } },
        ]),
      ).ok,
    ).toBe(true);
  });

  it("refuses a radius that is out of range, non-finite or the wrong type", () => {
    for (const blurRadius of [
      -1,
      48.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "12",
      null,
    ]) {
      const result = validateFabricThemeEnvelope(
        withObjects([
          { type: "Rect", id: "panel", vigiliaGlass: { blurRadius } },
        ]),
      );
      expect(result, `blurRadius ${String(blurRadius)}`).toMatchObject({
        ok: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "invalid-fabric-scene",
            path: "/scene/objects/0/vigiliaGlass",
          }),
        ]),
      });
    }
  });

  it("refuses a treatment that is not an object, or carries extra authored state", () => {
    for (const vigiliaGlass of [
      12,
      "glass",
      {},
      { radius: 12 },
      // A resolved surface or sampled pixel is exactly the derived state a
      // portable document must not carry.
      { blurRadius: 12, surface: "data:image/png;base64,AAAA" },
      { blurRadius: 12, sample: 42.7 },
    ]) {
      expect(
        validateFabricThemeEnvelope(
          withObjects([{ type: "Rect", id: "panel", vigiliaGlass }]),
        ),
        JSON.stringify(vigiliaGlass),
      ).toMatchObject({ ok: false });
    }
  });

  it("refuses glass on an object kind with no sampleable clipped area", () => {
    const result = validateFabricThemeEnvelope(
      withObjects([
        { type: "Textbox", id: "label", vigiliaGlass: { blurRadius: 12 } },
      ]),
    );

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-enum",
          path: "/scene/objects/0/vigiliaGlass",
        }),
      ]),
    });
  });

  it("validates a nested treatment at the child's own path", () => {
    // The scene walk is the only thing that reaches a group child, so a
    // treatment validated only at the top level would let a bad nested value
    // through into revival.
    const result = validateFabricThemeEnvelope(
      withObjects([
        {
          type: "Group",
          id: "card",
          objects: [
            { type: "Rect", id: "panel", vigiliaGlass: { blurRadius: 12 } },
            { type: "Rect", id: "inner", vigiliaGlass: { blurRadius: 999 } },
          ],
        },
      ]),
    );

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-fabric-scene",
          path: "/scene/objects/0/objects/1/vigiliaGlass",
        }),
      ]),
    });
  });
});
