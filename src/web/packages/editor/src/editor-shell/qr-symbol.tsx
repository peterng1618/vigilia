import type { CSSProperties } from "react";
import { uiCopy } from "../ui-copy.js";
import { qrMatrix } from "./qr-code.js";

/**
 * One QR symbol, drawn from the matrix rather than from markup the encoder
 * produced.
 *
 * **The ink and the paper are fixed, not themed.** A QR is read by a camera
 * looking for dark modules on light ones; the editor ships six shell palettes,
 * and a code drawn in the palette's own foreground would invert to
 * light-on-dark under half of them and stop scanning while looking perfectly
 * correct on screen.
 *
 * This file is `qr-symbol` and not `qr-code` because the encoder already owns
 * that basename: under `moduleResolution: bundler` and Vite, an import of
 * `./qr-code.js` resolves to the `.ts`, so a `.tsx` sibling of the same name is
 * unreachable — a silent wrong-module resolution, not an error.
 */
const INK = "#101418";
const PAPER = "#ffffff";

/** Pixels per module. 3 keeps a version-5 symbol (45 modules with its quiet
 *  zone) at 135 px, which is a comfortable camera target at arm's length. */
const DEFAULT_PITCH = 3;

export function QrCode({
  text,
  modulePitch = DEFAULT_PITCH,
}: {
  readonly text: string;
  /** Pixels per module. 3 keeps a 45-module symbol at 135 px. */
  readonly modulePitch?: number;
}): React.JSX.Element {
  const matrix = qrMatrix(text);
  const modules = matrix[0]?.length ?? 0;
  const side = modules * modulePitch;
  const style: CSSProperties = { display: "block" };

  return (
    <svg
      role="img"
      aria-label={uiCopy.publish.qrName(text)}
      width={side}
      height={side}
      viewBox={`0 0 ${modules} ${modules}`}
      style={style}
      data-vigilia-qr=""
    >
      <rect width={modules} height={modules} fill={PAPER} />
      {/* One path for every dark module: a version-5 symbol is over a thousand
          rects as elements, and the browser lays each one out. */}
      <path fill={INK} d={pathOf(matrix)} />
    </svg>
  );
}

/** A single `d` for every dark module, one `M x y h1 v1 h-1 z` each — the
 *  matrix is already modules, so the path is in module coordinates and the
 *  `viewBox` does the scaling. */
function pathOf(matrix: readonly (readonly boolean[])[]): string {
  const parts: string[] = [];

  for (const [y, row] of matrix.entries()) {
    for (const [x, dark] of row.entries()) {
      if (dark) parts.push(`M${x} ${y}h1v1h-1z`);
    }
  }

  return parts.join("");
}
