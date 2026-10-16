import { expect, it } from "vitest";
// The script lives at the repository root, four levels above this file:
// src/web/tests/scripts → ../../../.. = repo root.
import {
  CITE_EXTENSIONS,
  checkCitations,
  checkSync,
} from "../../../../scripts/design-md.mjs";

/**
 * The two checks' own proof. `design-md.mjs` is the reader every DESIGN.md gate
 * will call, so its rules are exercised against inline fixtures here rather than
 * only against the real file — a check that passes because it read a constant is
 * the defect a gate exists to remove. The real tree is red-proofed separately
 * (`--sync` and `--cite` shown to bite in the task's Step 5).
 */

type Citation = { readonly path: string; readonly text: string };

type Read = {
  readonly design?: string;
  readonly css?: string;
  readonly citations?: readonly Citation[];
  readonly mapping?: ReadonlyMap<string, readonly string[]>;
};

/** A read of the world with only the pieces a case needs. */
function fixture(partial: Read): Read {
  return { design: "", css: "", citations: [], ...partial };
}

/** A citation as the collector records it: text, with the document it came from. */
const cited = (...texts: string[]): Citation[] =>
  texts.map((text) => ({ path: "docs/design/mockups/README.md", text }));

const whats = (findings: readonly { readonly what: string }[]) =>
  findings.map((f) => f.what);

it("fails a scale the stylesheet and the front matter disagree on", () => {
  const read = fixture({
    css: "--space-16: 15px;",
    design: "spacing:\n  16: 16px\n",
  });
  const findings = checkSync(read);
  expect(findings.map((f) => f.what)).toEqual(["space-16"]);
});

it("fails a declared marker that the file no longer carries", () => {
  const read = fixture({ design: "## Copy\n\nNo marker here.\n" });
  expect(checkCitations(read).map((f) => f.what)).toContain("§9");
});

it("fails a marker no citation in the repo claims", () => {
  const read = fixture({
    citations: cited("§5"),
    design: "<!-- §1 -->\n<!-- §5 -->\n",
  });
  expect(checkCitations(read).map((f) => f.what)).toContain("§1");
});

it("reads the @theme static block, not :root", () => {
  const read = fixture({
    css: "@theme static {\n  --space-16: 16px;\n}\n:root {\n  --space-16: 99px;\n}\n",
    design: "spacing:\n  16: 16px\n",
  });
  expect(checkSync(read)).toEqual([]);
});

it("fails a name only one side declares, in either direction", () => {
  expect(
    whats(checkSync(fixture({ css: "", design: "spacing:\n  16: 16px\n" }))),
  ).toEqual(["space-16"]);
  expect(
    whats(
      checkSync(
        fixture({
          css: "@theme static {\n  --radius-lg: 8px;\n}\n",
          design: "",
        }),
      ),
    ),
  ).toEqual(["radius-lg"]);
});

it("treats the typography line-height companion as its own token", () => {
  const read = fixture({
    css: "@theme static {\n  --text-md: 13px;\n  --text-md--line-height: 1.5;\n}\n",
    design: "typography:\n  md:\n    fontSize: 13px\n    lineHeight: 1.3\n",
  });
  expect(whats(checkSync(read))).toEqual(["text-md--line-height"]);
});

it("reads the front matter's typography keys as the bare suffix", () => {
  // `--text-2xs`, not `--text-text-2xs`: the key is the scale-level suffix.
  const read = fixture({
    css: "@theme static {\n  --text-2xs: 10px;\n  --text-2xs--line-height: 1.2;\n}\n",
    design: "typography:\n  2xs:\n    fontSize: 10px\n    lineHeight: 1.2\n",
  });
  expect(checkSync(read)).toEqual([]);
});

it("ignores a name outside the three synced groups", () => {
  // Tailwind's own base and the elevation tokens are not front-matter material.
  const read = fixture({
    css: "@theme static {\n  --spacing: 0.25rem;\n  --shadow-raised: 0 12px 28px #000;\n}\n",
    design: "",
  });
  expect(checkSync(read)).toEqual([]);
});

it("ignores a number outside the canonical range", () => {
  // The redesign spec's §75/§141 share the `§` and must not be re-pointed.
  const read = fixture({
    design: "<!-- §9 -->\n",
    citations: cited("§75", "§141", "DESIGN.md §9"),
  });
  expect(
    whats(checkCitations(read, { numbers: ["9"], uncitedOk: [] })),
  ).toEqual([]);
});

it("fails a citation whose number has no marker, and lets UNCITED_OK silence the reverse", () => {
  const opts = { numbers: ["9"], uncitedOk: [] };
  const read = fixture({ design: "<!-- §9 -->\n", citations: [] });
  // Rule 3: the marker is unclaimed.
  expect(whats(checkCitations(read, opts))).toContain("§9");
  expect(
    whats(checkCitations(read, { numbers: ["9"], uncitedOk: ["9"] })),
  ).toEqual([]);
});

it("fails a marker moved under a heading its mapping does not name", () => {
  const mapping = new Map([
    ["1", ["## Overview"]],
    ["4", ["## Colors"]],
  ]);
  // §1 sits under Overview — its mapped heading — and §4 under Overview too,
  // which the mapping does not allow.
  const read = fixture({
    design: "## Overview\n\n<!-- §1 -->\n\n## Copy\n\n<!-- §4 -->\n",
    citations: cited("§1", "§4"),
    mapping,
  });
  const findings = checkCitations(read, { numbers: ["1", "4"], uncitedOk: [] });
  expect(findings.map((f) => f.what)).toEqual(["§4"]);
  expect(findings[0]?.why).toContain("sits under");
});

it("fails a marker that drifts into a `###` the mapped `##` does not name", () => {
  // vg-356: the mapping names `## Layout` for §7, so §7.1 parked under
  // `### The header` is a drift the exact-path check rejects. A prefix test
  // admitted it.
  const read = fixture({
    design: "## Layout\n\n### The header\n\n<!-- §7.1 -->\n",
    citations: cited("§7.1"),
    mapping: new Map([["7", ["## Layout"]]]),
  });
  const findings = checkCitations(read, { numbers: ["7.1"], uncitedOk: [] });
  expect(findings.map((f) => f.what)).toEqual(["§7.1"]);
  expect(findings[0]?.why).toContain("sits under");
});

it("passes a marker under the exact `###` its mapping names", () => {
  const read = fixture({
    design: "## Layout\n\n### The header\n\n<!-- §7.1 -->\n",
    citations: cited("§7.1"),
    mapping: new Map([["7.1", ["## Layout", "### The header"]]]),
  });
  expect(checkCitations(read, { numbers: ["7.1"], uncitedOk: [] })).toEqual([]);
});

it("fails a marker under a duplicated heading its mapping names", () => {
  // `markerPlacements` keys on heading text, so a second `## Colors` elsewhere in
  // the file would otherwise let a marker parked under it pass unchecked.
  const read = fixture({
    design: "## Colors\n\n## Copy\n\n## Colors\n\n<!-- §4 -->\n",
    citations: cited("§4"),
    mapping: new Map([["4", ["## Colors"]]]),
  });
  const findings = checkCitations(read, { numbers: ["4"], uncitedOk: [] });
  expect(findings.map((f) => f.what)).toEqual(["§4"]);
  expect(findings[0]?.why).toContain("more than once");
});

it("fails a number the section mapping has no row for, rather than skipping it", () => {
  const read = fixture({
    design: "## Colors\n\n<!-- §4 -->\n\n## Copy\n\n<!-- §9 -->\n",
    citations: cited("§4", "§9"),
    mapping: new Map([["4", ["## Colors"]]]),
  });
  expect(
    whats(checkCitations(read, { numbers: ["4", "9"], uncitedOk: [] })),
  ).toEqual(["§9"]);
});

it("keeps the register's .jsonl out of the citation scan", () => {
  // The register carries historical `§N` prose; admitting `.jsonl` would let it
  // claim markers the live prose does not (`vg-352`). On the collected path so a
  // widening fails in CI, not only under the hand-run `--self-test`.
  expect(CITE_EXTENSIONS.test("docs/product/backlog.jsonl")).toBe(false);
  expect(CITE_EXTENSIONS.test("data.json")).toBe(true);
});

it("claims a marker only from a document that speaks the design language", () => {
  // vg-352, both directions. `docs/product/requirements.md` numbers its own
  // requirements `## §N — title`, so its §7 is its own section and must not keep
  // rule 3 silent for a DESIGN.md marker nothing cited; a design-language
  // document's §7 is the claim that marker needs. Deleting the source filter
  // makes the first half of this case pass with no findings.
  const opts = { numbers: ["7"], uncitedOk: [] };
  const design = "<!-- §7 -->\n";
  expect(
    whats(
      checkCitations(
        fixture({
          design,
          citations: [
            {
              path: "docs/product/requirements.md",
              text: "## §7 — Product and scope\n",
            },
          ],
        }),
        opts,
      ),
    ),
  ).toEqual(["§7"]);
  expect(
    whats(
      checkCitations(
        fixture({ design, citations: cited("§7's three tabs") }),
        opts,
      ),
    ),
  ).toEqual([]);
});

it("merges a rule-1 and a rule-2 finding for one number into one line", () => {
  const read = fixture({ design: "", citations: cited("§9") });
  const findings = checkCitations(read, { numbers: ["1", "9"], uncitedOk: [] });
  const nine = findings.filter((f) => f.what === "§9");
  expect(nine).toHaveLength(1);
  expect(nine[0]?.why).toContain("canonical range");
  expect(nine[0]?.why).toContain("the repo cites");
});
