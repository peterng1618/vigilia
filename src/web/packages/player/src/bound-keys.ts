import type { FabricThemeEnvelope } from "@vigilia/renderer-core";

/**
 * The sensors a hosted theme needs, one entry per sensor.
 *
 * The same reading is bound in several places — a value, a chart, a legend —
 * and a repeated key asked the display nothing new while inflating every count
 * this list feeds: the stream URL repeated `cpu.load` three times, and the
 * availability notice told a reader it had 30 sensors for 19.
 *
 * `requiredSemanticKeys` is the same answer for a `ThemeDocument`; this is the
 * envelope shape, which is what a served theme arrives as.
 */
export function boundSemanticKeys(
  envelope: Pick<FabricThemeEnvelope, "bindings">,
): string[] {
  return [
    ...new Set(
      Object.values(envelope.bindings ?? {})
        .flat()
        .map((binding) => binding.semanticKey),
    ),
  ].sort();
}
