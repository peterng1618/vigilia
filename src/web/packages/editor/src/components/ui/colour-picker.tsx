import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  hsvaToRgba,
  type Hsva,
  parseColour,
  rgbaToHsva,
  toHex,
} from "./colour-maths.js";
import { cn } from "@/lib/utils";

/** One track: a gradient painted by the caller, a drag read by `onPick`. */
function Track({
  background,
  value,
  onPick,
  className,
  testId,
  axis = "x",
}: {
  readonly background: string;
  readonly value: number;
  readonly onPick: (ratio: number) => void;
  readonly className?: string;
  readonly testId: string;
  /** Vertical tracks read top-down, so the handle and the ratio both flip. */
  readonly axis?: "x" | "y";
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const pick = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const box = ref.current?.getBoundingClientRect();
      if (box === undefined || box.width === 0 || box.height === 0) return;
      const raw =
        axis === "y"
          ? (event.clientY - box.top) / box.height
          : (event.clientX - box.left) / box.width;
      // A vertical track reads top-down, so its ratio is the distance from the
      // bottom: dragging up must raise brightness, not lower it.
      onPick(Math.min(1, Math.max(0, axis === "y" ? 1 - raw : raw)));
    },
    [axis, onPick],
  );
  return (
    <div
      ref={ref}
      data-testid={testId}
      role="slider"
      tabIndex={0}
      aria-label={testId}
      aria-valuenow={Math.round(value * 100)}
      className={cn(
        "relative h-3 w-full cursor-pointer rounded-sm border border-neutral-700 touch-none",
        className,
      )}
      style={{ background }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pick(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 0) pick(event);
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
        style={{
          // A vertical track reads top-down, so its handle sits at the inverse
          // of its ratio and its centre is pinned to the other axis.
          left: axis === "y" ? "50%" : `${value * 100}%`,
          top: axis === "y" ? `${(1 - value) * 100}%` : "50%",
          background: "#fff",
          boxShadow: "0 0 0 1px #000",
        }}
      />
    </div>
  );
}

/**
 * The palette's colour picker.
 *
 * `<input type="color">` cannot do this: the theme's paints carry alpha —
 * `panel` is 85%, `frost` is 30% — and a native input has no alpha channel, so
 * accepting one would be a way to lose the value. Everything is 8-digit hex,
 * which is what the envelope stores.
 *
 * Surface is shadcn on Radix, per the ruling on this field's ecosystem.
 */
export function ColourPicker({
  value,
  onChange,
  label,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly label: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const parsed = parseColour(value);
  const [hsva, setHsva] = useState<Hsva>(
    parsed === undefined
      ? { h: 0, s: 0, v: 0, a: 1 }
      : rgbaToHsva(parsed),
  );
  const [draft, setDraft] = useState(value);

  // The field is the truth from outside; a reopened popover follows it.
  useEffect(() => {
    const next = parseColour(value);
    if (next !== undefined) setHsva(rgbaToHsva(next));
    setDraft(value);
  }, [value, open]);

  const emit = useCallback(
    (next: Hsva) => {
      setHsva(next);
      const hex = toHex(hsvaToRgba(next));
      setDraft(hex);
      onChange(hex);
    },
    [onChange],
  );

  const square = hsvaToRgba({ ...hsva, s: 1, v: 1 });
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          data-testid="picker-trigger"
          aria-label={label}
          style={{
            width: 28,
            height: 28,
            borderRadius: 4,
            border: "1px solid #3a3f4b",
            flex: "0 0 auto",
            // A checkerboard, so a translucent token reads as translucent here.
            backgroundImage: "repeating-conic-gradient(#666 0% 25%, #999 0% 50%)",
            backgroundSize: "10px 10px",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              borderRadius: 3,
              background: value,
            }}
          />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-testid="colour-picker"
          align="start"
          sideOffset={6}
          className="z-50 w-64 space-y-3 rounded-md border border-neutral-700 bg-neutral-900 p-3 text-neutral-100 shadow-lg"
        >
          <Track
            testId="picker-saturation"
            className="h-28"
            value={hsva.s}
            background={`linear-gradient(to right, #fff, hsl(${hsva.h} 100% 50%))`}
            onPick={(s) => emit({ ...hsva, s })}
          />
          {/* Brightness, over the saturation the track above just set. Both are
            vertical drags on the same pair of dimensions the square shows, which
            is the whole reason the square is two tracks rather than one canvas. */}
          <Track
            testId="picker-value"
            className="h-24"
            value={hsva.v}
            background={`linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsva.h} 100% 50%)`}
            onPick={(v) => emit({ ...hsva, v })}
          />
          <Track
            testId="picker-hue"
            value={hsva.h / 360}
            background="linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
            onPick={(ratio) => emit({ ...hsva, h: ratio * 360 })}
          />
          <Track
            testId="picker-alpha"
            // A checkerboard, so a translucent value is visibly translucent.
            background={`linear-gradient(to right, transparent, ${toHex({ ...hsvaToRgba(hsva), a: 1 })}), repeating-conic-gradient(#666 0% 25%, #999 0% 50%) 0 0 / 8px 8px`}
            value={hsva.a}
            onPick={(a) => emit({ ...hsva, a })}
          />
          <input
            data-testid="picker-hex"
            aria-label="Hex colour"
            value={draft}
            spellCheck={false}
            onChange={(event) => {
              const next = event.target.value;
              setDraft(next);
              const parsedNext = parseColour(next);
              if (parsedNext !== undefined) {
                setHsva(rgbaToHsva(parsedNext));
                onChange(next.trim());
              }
            }}
            className="w-full rounded-sm border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-sm"
          />
          <p className="text-xs text-neutral-400">
            {square === undefined ? "" : `${toHex(hsvaToRgba(hsva))} — alpha ${Math.round(hsva.a * 100)}%`}
          </p>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
