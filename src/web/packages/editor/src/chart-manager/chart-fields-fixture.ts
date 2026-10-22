/**
 * The palette `chart-fields.dom.test.tsx` drives the fields with.
 *
 * These are a document's own paint values — what an author typed into the
 * palette the chart references — not styling the shell paints, so the fixture
 * lives beside the test that drives it rather than inside it.
 */
import type { FabricPalette } from "@yunari/renderer-core";

export const CHART_PALETTE: FabricPalette = {
  cpu: { name: "CPU", value: { kind: "solid", color: "#00b8d9" } },
  gpu: { name: "GPU", value: { kind: "solid", color: "#a78bfa" } },
  ram: { name: "RAM", value: { kind: "solid", color: "#2dd4bf" } },
};
