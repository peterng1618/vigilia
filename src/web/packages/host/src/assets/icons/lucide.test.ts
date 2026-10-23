import { describe, expect, it } from "vitest";
import { LUCIDE_ICONS, lucideSource, searchLucide } from "./lucide.js";

const context = {
  credential: () => undefined,
  signal: new AbortController().signal,
  fetch: globalThis.fetch,
};

describe("the Lucide manifest", () => {
  it("is generated as plain SVG data", () => {
    expect(LUCIDE_ICONS.length).toBeGreaterThan(1000);

    for (const icon of LUCIDE_ICONS) {
      expect(icon.svg.startsWith("<svg")).toBe(true);
      expect(icon.svg).not.toContain("script");
    }
  });
});

describe("searchLucide", () => {
  it("treats a space and a hyphen as one separator", () => {
    expect(
      searchLucide("arrow down", undefined).results.map((entry) => entry.id),
    ).toContain("arrow-down");
  });

  it("pages by offset and never repeats a page", async () => {
    const first = searchLucide("", undefined);
    expect(first.results).toHaveLength(40);
    expect(first.next).toBe("40");

    const second = searchLucide("", first.next);
    expect(second.results).toHaveLength(40);
    expect(second.results[0]?.id).not.toBe(first.results[0]?.id);
    expect(
      second.results.some((entry) =>
        first.results.some((previous) => previous.id === entry.id),
      ),
    ).toBe(false);
  });

  it("answers the first page for a cursor that is not an offset", () => {
    expect(searchLucide("", "nope").results).toEqual(
      searchLucide("", undefined).results,
    );
  });
});

describe("the Lucide source", () => {
  it("declares a grid body and no credential", () => {
    expect(lucideSource).toMatchObject({
      id: "lucide",
      category: "icon",
      body: "grid",
      requires: undefined,
      configurable: true,
    });
  });

  it("answers an icon's SVG as its bytes", async () => {
    const bytes = await lucideSource.bytesOf("arrow-down", context);

    expect(bytes?.contentType).toBe("image/svg+xml");
    expect(bytes?.filename).toBe("arrow-down.svg");
    expect(new TextDecoder().decode(bytes?.bytes)).toContain("<svg");
  });

  it("answers nothing for an icon it does not know", async () => {
    expect(await lucideSource.bytesOf("not-an-icon", context)).toBeUndefined();
  });
});
