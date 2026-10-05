import { describe, expect, it } from "vitest";
import {
  isObjectName,
  MAX_OBJECT_NAME_LENGTH,
  objectName,
} from "./object-name.js";

describe("the authored object name", () => {
  it("accepts a display name and refuses everything that is not one", () => {
    expect(isObjectName("Header panel")).toBe(true);
    // A name is a label an author reads; these are the shapes that would print
    // as something else in a layer row.
    expect(isObjectName("")).toBe(false);
    expect(isObjectName("   ")).toBe(false);
    expect(isObjectName(42)).toBe(false);
    expect(isObjectName(null)).toBe(false);
    expect(isObjectName(["Header"])).toBe(false);
  });

  it("bounds the length, and accepts exactly the bound", () => {
    expect(isObjectName("x".repeat(MAX_OBJECT_NAME_LENGTH))).toBe(true);
    expect(isObjectName("x".repeat(MAX_OBJECT_NAME_LENGTH + 1))).toBe(false);
  });

  it("reads the name off a revived object and reports absence as undefined", () => {
    // Absence is the whole backward-compatibility contract: a scene authored
    // before the field carries no property and must read as unnamed rather than
    // as an error or an empty string.
    expect(objectName({ get: () => undefined })).toBeUndefined();
    expect(objectName({ get: () => "Header panel" })).toBe("Header panel");
  });

  it("treats a malformed value as no name rather than passing it through", () => {
    // Trust boundary: the validator already refused this at import, so the
    // reader agrees instead of printing `42` into a layer row.
    expect(objectName({ get: () => 42 })).toBeUndefined();
  });
});
