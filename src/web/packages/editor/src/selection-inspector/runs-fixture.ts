/**
 * The globals `runs.dom.test.tsx` mounts the run editor over.
 *
 * A document's own palette and type presets — the values a run resolves through
 * — rather than styling the shell paints, so the fixture lives beside the test
 * that drives it.
 */
import type { FabricGlobals } from "@vigilia/renderer-core";

export const RUN_GLOBALS = {
  typePresets: {
    plain: { name: "Plain", value: { family: "Inter", size: 16 } },
    caption: { name: "Caption", value: { family: "Inter", size: 12 } },
    title: { name: "Title", value: { family: "Inter", size: 24 } },
  },
  palette: {
    text: { name: "Text", value: { kind: "solid", color: "#fff" } },
  },
} as unknown as FabricGlobals;
