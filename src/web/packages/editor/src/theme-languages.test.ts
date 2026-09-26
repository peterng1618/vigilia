import { isLocaleName } from "@vigilia/renderer-core";
import { describe, expect, it } from "vitest";
import { languageLabel, THEME_LANGUAGES } from "./theme-languages.js";

describe("the languages an author may pick", () => {
  it("offers only languages this runtime can render", () => {
    // The control can never hand the validator a tag it then refuses.
    expect(THEME_LANGUAGES.every(isLocaleName)).toBe(true);
  });

  it("leads with English and includes Vietnamese", () => {
    expect(THEME_LANGUAGES[0]).toBe("en");
    expect(THEME_LANGUAGES).toContain("vi");
    expect(THEME_LANGUAGES).toHaveLength(15);
  });

  it("labels a language from the platform rather than a table", () => {
    expect(languageLabel("zh-Hans")).toBe("Simplified Chinese");
    expect(languageLabel("ko")).toBe("Korean");
    expect(languageLabel("vi")).toBe("Vietnamese");
  });
});
