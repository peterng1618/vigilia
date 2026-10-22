import {
  envelopeKeysFor,
  type FabricThemeEnvelope,
} from "@vigilia/renderer-core";
import { describe, expect, it } from "vitest";
import {
  bumpVersion,
  CLASSIFIED_ENVELOPE_KEYS,
  classifyThemeChange,
  IGNORED_ENVELOPE_KEYS,
  isSemanticVersion,
  versionFor,
} from "./version-ladder.js";

type EnvelopeOverrides = Omit<Partial<FabricThemeEnvelope>, "schemaVersion"> & {
  readonly schemaVersion?: number;
};

/** A minimal valid envelope. Tests mutate clones of this. */
function base(overrides: EnvelopeOverrides = {}): FabricThemeEnvelope {
  return {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "demo-theme",
    metadata: { themeLanguage: "en" },
    artboard: { width: 1280, height: 720, contentFit: "contain" },
    bindings: {},
    scene: { version: "7.4.0", objects: [] },
    ...overrides,
  } as unknown as FabricThemeEnvelope;
}

describe("isSemanticVersion", () => {
  it.each(["0.0.0", "1.4.0", "10.20.30"])("accepts %s", (text) =>
    expect(isSemanticVersion(text)).toBe(true),
  );
  it.each(["v1.4.0", "1.4", "1.4.0-beta.1", "1.4.0+build", ""])(
    "refuses %s",
    (text) => expect(isSemanticVersion(text)).toBe(false),
  );
});

describe("bumpVersion", () => {
  it.each([
    ["1.4.0", "patch", "1.4.1"],
    ["1.4.0", "minor", "1.5.0"],
    ["1.4.0", "major", "2.0.0"],
    ["0.9.9", "minor", "0.10.0"],
    ["1.9.9", "patch", "1.9.10"],
    ["9.9.9", "major", "10.0.0"],
  ] as const)("%s + %s = %s", (previous, level, expected) =>
    expect(bumpVersion(previous, level)).toBe(expected),
  );
  it("answers undefined for a previous that is not a version", () =>
    expect(bumpVersion("v1.4", "patch")).toBeUndefined());
  it("answers undefined for digits past the safe-integer range", () =>
    expect(bumpVersion("9007199254740992.0.0", "patch")).toBeUndefined());
});

describe("versionFor", () => {
  it("mints 1.0.0 for a first publication", () =>
    expect(versionFor(undefined, { level: "initial", reasons: [] })).toBe(
      "1.0.0",
    ));
  it("keeps the published version when nothing changed", () =>
    expect(versionFor("1.4.0", { level: "none", reasons: [] })).toBe("1.4.0"));
  it("bumps the published version by the level", () =>
    expect(versionFor("1.4.0", { level: "minor", reasons: [] })).toBe("1.5.0"));
  it("answers undefined for a previous that is not a version", () =>
    expect(versionFor("v1", { level: "patch", reasons: [] })).toBeUndefined());
  it("answers undefined for initial without a previous", () =>
    expect(
      versionFor("1.4.0", { level: "initial", reasons: [] }),
    ).toBeUndefined());
});

describe("classifyThemeChange", () => {
  it("is initial with no published package", () => {
    expect(classifyThemeChange(undefined, base())).toEqual({
      level: "initial",
      reasons: [],
    });
  });
  it("is none when only ignored fields move", () => {
    const next = base({
      fabricVersion: "7.5.0",
      scene: { ...base().scene, version: "7.5.0" },
      editorMetadata: { zoom: 2 },
      metadata: {
        ...base().metadata,
        version: "9.9.9",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(classifyThemeChange(base(), next)).toEqual({
      level: "none",
      reasons: [],
    });
  });
  it("is major when the schema version changes", () => {
    expect(classifyThemeChange(base(), base({ schemaVersion: 3 }))).toEqual({
      level: "major",
      reasons: ["schema"],
    });
  });
  it("is major when the artboard's width or height changes", () => {
    const next = base({ artboard: { ...base().artboard, width: 1920 } });
    expect(classifyThemeChange(base(), next)).toEqual({
      level: "major",
      reasons: ["canvas"],
    });
  });
  it("is major when a bound sensor is no longer bound", () => {
    const withSensor = base({
      bindings: {
        chart: [{ id: "cpu", semanticKey: "cpu.load", precision: 0 }],
      },
    });
    const next = base({ bindings: {} });
    expect(classifyThemeChange(withSensor, next)).toEqual({
      level: "major",
      reasons: ["sensor-removed"],
    });
  });
  it("is minor when a sensor is added", () => {
    const next = base({
      bindings: {
        chart: [{ id: "cpu", semanticKey: "cpu.load", precision: 0 }],
      },
    });
    expect(classifyThemeChange(base(), next)).toEqual({
      level: "minor",
      reasons: ["sensor-added"],
    });
  });
  it("is patch when a binding moves between objects and keeps its sensor", () => {
    const before = base({
      bindings: { a: [{ id: "cpu", semanticKey: "cpu.load", precision: 0 }] },
    });
    const after = base({
      bindings: { b: [{ id: "cpu", semanticKey: "cpu.load", precision: 0 }] },
    });
    expect(classifyThemeChange(before, after)).toEqual({
      level: "patch",
      reasons: ["content"],
    });
  });
  it("is major for a member no rule knows", () => {
    const next = { ...base(), futureThing: {} } as unknown as ReturnType<
      typeof base
    >;
    expect(classifyThemeChange(base(), next)).toEqual({
      level: "major",
      reasons: ["schema"],
    });
  });
});

it("classifies every envelope member the schema can carry", () => {
  const known = new Set([
    ...CLASSIFIED_ENVELOPE_KEYS,
    ...IGNORED_ENVELOPE_KEYS,
  ]);
  expect([...envelopeKeysFor("envelope")].sort()).toEqual([...known].sort());
});
