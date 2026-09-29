import { expect, it } from "vitest";
import { uiCopy } from "./ui-copy.js";

/**
 * No pictograph is copy. §35 keeps visible copy in this table, and a glyph is
 * decoration: it is announced as a word of its own, it cannot inherit a shell
 * colour the way every icon beside it does, and it does not render like them.
 * The rail's four marks were exactly that — `▤ + ▣ ⚙` as translatable strings —
 * so the rule is the net under the fix rather than the fix itself.
 */
it("holds no pictographs, so an icon cannot be stored as copy", () => {
  expect(pictographs(uiCopy)).toEqual([]);
});

/** Every string the table reaches, paired with the key that holds it. Letters
 * are labels (`X`, `W`) and stay; the Unicode symbol blocks are decoration. */
function pictographs(value: unknown, path = "uiCopy"): string[] {
  if (typeof value === "string") {
    return /\p{S}/u.test(value) ? [`${path} = ${JSON.stringify(value)}`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      pictographs(entry, `${path}[${index}]`),
    );
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, entry]) =>
      pictographs(entry, `${path}.${key}`),
    );
  }
  return [];
}
