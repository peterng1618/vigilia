// @vitest-environment jsdom
// No colour literal is styled here: every one is a document fixture the walk
// only ever reads, so the design ratchet has nothing to hold to a token.

/**
 * The document-references walk: what the document offers, and what each entry
 * resolves to. The rendering is the Document pane's References section and its
 * cases live beside it (`panes/document/references.dom.test.tsx`); this file owns
 * the walk's answer — which references, in which order, and the `none` token that
 * is the absence of a reference rather than one of them.
 */
import { describe, expect, it } from "vitest";
import { documentReferences } from "./style.js";

const globals = {
  palette: {
    ink: { name: "Ink", value: { kind: "solid", color: "#e8ecf3" } },
  },
  typePresets: {
    body: { name: "Body", value: { family: "Inter", size: 16, weight: "600" } },
  },
} as never;

describe("the document's references", () => {
  it("lists the document's tokens and presets by name, and resolves them", () => {
    // The authored name, then what it resolves to: the panel answers "what can
    // this document reference, and what does each one mean".
    expect(documentReferences(globals)).toEqual([
      { ref: "palette.ink", label: "Ink", resolved: "#e8ecf3" },
      { ref: "typePresets.body", label: "Body", resolved: "Inter 600 16px" },
    ]);
  });

  it("skips the absence of a token", () => {
    const references = documentReferences({
      palette: {
        none: { name: "None", value: { kind: "solid", color: "#00000000" } },
        ink: { name: "Ink", value: { kind: "solid", color: "#e8ecf3" } },
      },
      typePresets: {},
    } as never);

    // `none` is the absence of a token, not one of them: listing it would offer
    // the author a reference that means "no reference".
    expect(references.map((reference) => reference.label)).toEqual(["Ink"]);
  });

  it("falls back to the reference when the document declares no name", () => {
    const references = documentReferences({
      palette: { ink: { value: { kind: "solid", color: "#e8ecf3" } } },
      typePresets: {},
    } as never);

    // A token the author has deleted has no name left, and its reference is
    // then the only thing that identifies the dangling use.
    expect(references[0]?.label).toBe("palette.ink");
  });
});
