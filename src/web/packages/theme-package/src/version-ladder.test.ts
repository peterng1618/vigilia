import { describe, expect, it } from "vitest";
import {
  bumpVersion,
  isSemanticVersion,
  versionFor,
} from "./version-ladder.js";

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
