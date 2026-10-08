import { Popover } from "@base-ui/react/popover";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  hsvaToRgba,
  type Hsva,
  parseColour,
  rgbaToHsva,
  toHex,
} from "./colour-maths.js";
import { cn } from "@/lib/utils";

/** One press of an arrow key, as a fraction of the track. */
const TRACK_STEP = 0.01;

/** Where the keyboard moves a track, or `undefined` for a key it does not own.
 *
 * Pure, and separate from the element, so the stepping can be tested without a
 * pointer and `Track` is left with nothing but the wiring.
 */
function nextTrackRatio(value: number, key: string): number | undefined {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return value + TRACK_STEP;
    case "ArrowLeft":
    case "ArrowDown":
      return value - TRACK_STEP;
    case "Home":
      return 0;
    case "End":
      return 1;
    default:
      return undefined;
  }
}

/** One track: a gradient painted by the caller, a drag or an arrow key read by
 *  `onPick`.
 *
 * `role="slider"` is a promise, not a label: it says the control has a value and
 * that the keyboard can change it, so the range has to be declared and the keys
 * have to work (`vg-194`). Both halves or neither — a keyboard path over an
 * undeclared range is still wrong, and a declared range over a control no key
 * reaches is worse than an honest div.
 */
function Track({
  background,
  value,
  onPick,
  className,
  testId,
}: {
  readonly background: string;
  readonly value: number;
  readonly onPick: (ratio: number) => void;
  readonly className?: string;
  readonly testId: string;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const pick = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const box = ref.current?.getBoundingClientRect();
      if (box === undefined || box.width === 0 || box.height === 0) return;
      onPick(
        Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
      );
    },
    [onPick],
  );
  return (
    <div
      ref={ref}
      data-testid={testId}
      role="slider"
      tabIndex={0}
      aria-label={testId}
      aria-valuemin={0}
      aria-valuemax={100}
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
      onKeyDown={(event) => {
        const next = nextTrackRatio(value, event.key);
        if (next === undefined) return;
        // A slider that lets an arrow through scrolls the panel behind it.
        event.preventDefault();
        onPick(Math.min(1, Math.max(0, next)));
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
        style={{
          left: `${value * 100}%`,
          top: "50%",
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
 * Surface is shadcn on Base UI, per decision `0038`. The picker keeps its own
 * `Popover` rather than going through a shared wrapper: it styles the whole
 * popup and anchors to a trigger it owns, so a wrapper would be an element and
 * a prop list with one consumer.
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
    parsed === undefined ? { h: 0, s: 0, v: 0, a: 1 } : rgbaToHsva(parsed),
  );
  const [draft, setDraft] = useState(value);

  // The field is the truth from outside, and only from outside: reopening the
  // popover must not undo a colour the author just picked here, so this
  // follows `value` and not `open`. Resetting on open is what made the swatch
  // disagree with the colour field beside it the moment the panel stopped
  // rebuilding itself on every commit.
  useEffect(() => {
    const next = parseColour(value);
    if (next !== undefined) setHsva(rgbaToHsva(next));
    setDraft(value);
  }, [value]);

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
    <Popover.Root
      open={open}
      // Base UI passes its own event details as a second argument; this wrapper
      // declares one, so it drops them rather than leaking the library's shape.
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <Popover.Trigger
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
      </Popover.Trigger>
      <Popover.Portal>
        {/* Base UI positions `Positioner`, not `Popup`: a `Popup` placed
            straight in the portal renders unpositioned. The stacking context
            has to be here for the same reason. */}
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup
            data-testid="colour-picker"
            className="w-64 space-y-3 rounded-md border border-neutral-700 bg-neutral-900 p-3 text-neutral-100 shadow-lg"
          >
            <Track
              testId="picker-saturation"
              className="h-28"
              value={hsva.s}
              background={`linear-gradient(to right, #fff, hsl(${hsva.h} 100% 50%))`}
              onPick={(s) => emit({ ...hsva, s })}
            />
            {/* Brightness, over the saturation the track above just set. */}
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
              {square === undefined
                ? ""
                : `${toHex(hsvaToRgba(hsva))} — alpha ${Math.round(hsva.a * 100)}%`}
            </p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
