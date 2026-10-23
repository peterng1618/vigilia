import { describe, expect, it } from "vitest";
import { parseAssetSearchRequest } from "./wire.js";

describe("parseAssetSearchRequest", () => {
  it("parses a well-formed search", () => {
    expect(
      parseAssetSearchRequest(
        { query: "arrow", enabled: ["lucide"], cursors: { lucide: "40" } },
        ["lucide", "fontawesome-free"],
      ),
    ).toEqual({
      query: "arrow",
      enabled: ["lucide"],
      cursors: { lucide: "40" },
    });
  });

  it("drops an enabled id this host does not know", () => {
    // A stale browser preference must not fail the search, and an unknown id
    // must not reach a source that is not registered.
    expect(
      parseAssetSearchRequest({ query: "arrow", enabled: ["gone", "lucide"] }, [
        "lucide",
      ]),
    ).toEqual({ query: "arrow", enabled: ["lucide"], cursors: {} });
  });

  it("refuses a body with no query", () => {
    expect(
      parseAssetSearchRequest({ enabled: ["lucide"] }, ["lucide"]),
    ).toBeUndefined();
    expect(
      parseAssetSearchRequest({ query: 7, enabled: ["lucide"] }, ["lucide"]),
    ).toBeUndefined();
  });

  it("refuses a body whose enabled is not an array", () => {
    expect(
      parseAssetSearchRequest({ query: "arrow", enabled: "lucide" }, [
        "lucide",
      ]),
    ).toBeUndefined();
  });

  it("drops a cursor that is not a string", () => {
    expect(
      parseAssetSearchRequest(
        {
          query: "arrow",
          enabled: ["lucide"],
          cursors: { lucide: 40, "fontawesome-free": "2", extra: null },
        },
        ["lucide", "fontawesome-free"],
      ),
    ).toEqual({
      query: "arrow",
      enabled: ["lucide"],
      cursors: { "fontawesome-free": "2" },
    });
  });

  it("answers no cursors when the field is absent or not an object", () => {
    expect(parseAssetSearchRequest({ query: "", enabled: [] }, [])).toEqual({
      query: "",
      enabled: [],
      cursors: {},
    });
    expect(
      parseAssetSearchRequest(
        { query: "", enabled: [], cursors: ["lucide"] },
        [],
      ),
    ).toEqual({ query: "", enabled: [], cursors: {} });
  });

  it("refuses a value that is not an object", () => {
    expect(parseAssetSearchRequest(undefined, [])).toBeUndefined();
    expect(parseAssetSearchRequest(null, [])).toBeUndefined();
    expect(parseAssetSearchRequest("{}", [])).toBeUndefined();
  });
});
