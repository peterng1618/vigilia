import type { Canvas } from "fabric/es";
import { OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { EditorDiagnostic } from "../error-manager/index.js";
import { uiCopy } from "../ui-copy.js";

type DiagnosticSeverity = "error" | "warning";

const SEVERITY_ICONS: Readonly<Record<DiagnosticSeverity, LucideIcon>> = {
  error: OctagonAlert,
  warning: TriangleAlert,
};

interface ShownDiagnostic {
  /** The document's canvas. A message belongs to the editor that raised it. */
  readonly canvas: Canvas;
  readonly severity: DiagnosticSeverity;
  readonly diagnostic: EditorDiagnostic;
}

/**
 * The shell's reading of the error manager's structured diagnostics (§F1.15).
 *
 * The error manager owns the diagnostics and knows nothing about the DOM; this
 * is the one place they become a line the author can see and hear. A refusal
 * leaves the number it refused standing, so the message stays until a newer one
 * replaces it or a different document is open — an author who looks away and
 * looks back still reads why.
 */
export function DiagnosticMessage({
  canvas,
}: {
  readonly canvas: Canvas | undefined;
}): React.JSX.Element {
  const [shown, setShown] = useState<ShownDiagnostic | undefined>();
  useEffect(() => {
    if (canvas === undefined) return;
    const receive =
      (severity: DiagnosticSeverity) => (diagnostic: EditorDiagnostic): void =>
        setShown({ canvas, severity, diagnostic });
    const onError = receive("error");
    const onWarning = receive("warning");
    canvas.on("editor:error" as never, onError as never);
    canvas.on("editor:warning" as never, onWarning as never);
    return () => {
      canvas.off("editor:error" as never, onError as never);
      canvas.off("editor:warning" as never, onWarning as never);
    };
  }, [canvas]);

  // Held rather than cleared: the document swapped under the message, so it
  // describes an editor that is gone and there is nothing left to say about it.
  const current =
    shown !== undefined && canvas !== undefined && shown.canvas === canvas
      ? shown
      : undefined;
  const Icon = current === undefined ? undefined : SEVERITY_ICONS[current.severity];
  const text =
    current === undefined
      ? ""
      : `${uiCopy.diagnostics[current.severity]}: ${current.diagnostic.message}`;

  return (
    // One polite region, always mounted: swapping the role on a live region
    // does not re-announce it, and the message outlives the moment it was
    // written, so it is read rather than pushed.
    <p
      className="editor-shell-diagnostic"
      role="status"
      aria-label={uiCopy.diagnostics.label}
      data-severity={current?.severity}
      data-category={current?.diagnostic.category}
    >
      {Icon === undefined ? null : (
        <>
          <Icon aria-hidden size={13} strokeWidth={2} />
          <span>{text}</span>
        </>
      )}
    </p>
  );
}
