/**
 * The document globals `references.dom.test.tsx` drives the section with.
 *
 * These are a document's own resolved tokens and presets — the values a case
 * reads back off the rows — not styling the shell paints, so the fixture lives
 * beside the test rather than inside it. `INK_PAINT` is named because the
 * section prints it: the row that says which token it resolved is asserted
 * against this value rather than against a copy of it.
 */
import type { FabricGlobals } from "@vigilia/renderer-core";

/** The ink token's own paint, the one the resolved row prints. */
export const INK_PAINT = "#e8ecf3";

export const REFERENCES_GLOBALS = {
  palette: {
    none: { name: "None", value: { kind: "solid", color: "#00000000" } },
    ink: { name: "Ink", value: { kind: "solid", color: INK_PAINT } },
  },
  typePresets: {
    body: { name: "Body", value: { family: "Inter", size: 16, weight: "600" } },
  },
} as unknown as FabricGlobals;

/** The same document after a theme edit: the panel is mounted for the session, so
 *  it has to re-read rather than keep the copy it started with. */
export const EDITED_GLOBALS = {
  palette: {
    ink: { name: "Ink", value: { kind: "solid", color: INK_PAINT } },
    accent: { name: "Accent", value: { kind: "solid", color: "#ff8800" } },
  },
  typePresets: {},
} as unknown as FabricGlobals;
