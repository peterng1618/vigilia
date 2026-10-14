import { Slider } from "@base-ui/react/slider";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ControlNumber } from "./control-number.js";
import {
  type ControlProps,
  ControlRow,
  describedBy,
  isBlocked,
  useControlIds,
} from "./control-well.js";

/**
 * A bounded number: a 3px track with an accent fill, a 10px thumb, and a well
 * showing the value (DESIGN.md §5).
 *
 * A gesture has one undo boundary, so preview and history are separate calls:
 * `onPreview` fires while the gesture is moving and writes nothing, one changed
 * value reaches `onCommit` when the gesture ends, and Escape ends it with
 * `onCancel` and no commit at all. Base UI's commit does not fire when the
 * value did not change, so a press that moves nothing adds nothing.
 *
 * **The gesture's own value is this control's state.** A controlled slider
 * renders from `value`, and every caller here implements `onCommit` alone —
 * `SelectionEdits` has no preview route — so with nothing feeding the moving
 * value back the thumb could not move until the gesture ended and the value
 * landed, which is what the author saw as a slider that updates half a second
 * late (vg-449). `onPreview` stays for a caller that also wants a live preview
 * elsewhere; the pointer no longer depends on one being supplied.
 *
 * **The well is the slider's other edit route, and it is not a second one.** It
 * is a `ControlNumber` in its inline form, so the draft, the validation and the
 * commit rule stay in the one control that owns them (the reasoning
 * `control-pair.tsx` states for its halves) — a readout beside a track would put
 * a second copy of §5's rules three lines away from the first. It is named by
 * the row's own label rather than printing that label a second time, and it is
 * 36px wide because the track takes the rest of the row.
 *
 * A wheel over the control moves it by **the slider's own step**, read back off
 * the range input, so the gesture and the drag cannot step differently. The
 * listener is native and non-passive — React attaches `wheel` passively, so a
 * `preventDefault` through its own prop is a no-op and the panel would scroll
 * under the gesture, which is the reasoning `viewport-manager/navigation.ts`
 * already states for the canvas.
 */
export function ControlSlider(
  props: ControlProps & {
    readonly value: number;
    readonly min: number;
    readonly max: number;
    /** The owner says the value is whole; the well refuses a fraction the way
     *  every other number field does, and the track already steps by 1. */
    readonly integer?: boolean;
    /** The owner can take the key away again — an absent optional setting. The
     *  track has no empty state, so the well is where that act lives. */
    readonly onClear?: () => void;
    readonly onPreview?: (value: number) => void;
    readonly onCancel?: () => void;
    readonly onCommit: (value: number) => void;
  },
): React.JSX.Element {
  const {
    label,
    id,
    disabled,
    refused,
    hint,
    density,
    data,
    value,
    min,
    max,
    integer,
    onClear,
    onPreview,
    onCancel,
    onCommit,
  } = props;
  const ids = useControlIds(id);
  const blocked = isBlocked({ disabled, refused });
  // A press in flight, and whether Escape ended it. The release that follows a
  // cancel must add no history, so the flag is consumed by the commit rather
  // than cleared by it; a keyboard step is never part of a pointer gesture and
  // clears it, which is what stops a stale cancel from eating a later commit.
  const pressing = useRef(false);
  const cancelled = useRef(false);
  // What the pointer is holding, until the committed value arrives. The two are
  // cleared together at the end of the gesture, so a refusal — which writes
  // nothing — cannot strand the thumb on a value the document never took.
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? value;
  // Base UI's slider is not the accessible element: the nested `input[type=range]`
  // is, and most aria props land on the thumb `div` beside it. So the refusal
  // state is written onto the input directly, or a screen reader never hears it.
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const node = input.current;
    if (node === null) return;
    if (refused === undefined) node.removeAttribute("aria-disabled");
    else node.setAttribute("aria-disabled", "true");
  }, [refused]);

  // `data` belongs to the focus target (control-well.tsx), and the focus target
  // is the nested `input[type=range]` — not `Slider.Root`, which is a wrapper.
  // Base UI exposes no prop that reaches the input, so the attributes are
  // mirrored onto it here.
  useEffect(() => {
    const node = input.current;
    if (node === null) return;
    const entries = Object.entries(data ?? {});
    for (const [key, value] of entries) node.setAttribute(key, value);
    return () => {
      for (const [key] of entries) node.removeAttribute(key);
    };
  }, [data]);

  // What a wheel tick has moved the value to, until the document answers. A
  // burst of ticks arrives faster than React re-renders, so each tick reads the
  // previous tick's result rather than the value this control was rendered
  // with — otherwise five steps would write the same number five times.
  const ticked = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const hooks = wellData(data);

  useEffect(() => {
    const node = root.current;
    if (node === null) return;
    const onWheel = (event: WheelEvent): void => {
      if (blocked) return;
      event.preventDefault();
      // The step the drag uses, read off the element that carries it. A step of
      // `any` reports 0, and a wheel cannot move by nothing.
      const step = stepOf(input.current);
      const from = ticked.current ?? value;
      const next = Math.min(Math.max(from + (event.deltaY < 0 ? step : -step), min), max);
      if (next === from) return;
      ticked.current = next;
      cancelled.current = false;
      setDragging(next);
      onPreview?.(next);
      onCommit(next);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [blocked, value, min, max, onPreview, onCommit]);

  // The hold is only honest while the document catches up: any answer that
  // moves the value retires it, so a tick that was refused cannot strand the
  // thumb on a number the document never took.
  useEffect(() => {
    ticked.current = null;
    setDragging(null);
  }, [value]);

  return (
    <ControlRow
      ids={ids}
      label={label}
      refused={refused}
      hint={hint}
      density={density}
    >
      <Slider.Root
        ref={root}
        value={shown}
        min={min}
        max={max}
        disabled={disabled}
        aria-disabled={refused === undefined ? undefined : true}
        onPointerDown={() => {
          pressing.current = true;
          cancelled.current = false;
        }}
        onPointerUp={() => {
          pressing.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !pressing.current) return;
          event.preventDefault();
          pressing.current = false;
          cancelled.current = true;
          setDragging(null);
          onCancel?.();
        }}
        onValueChange={(next, details) => {
          if (blocked) {
            // The primitive's own refusal: the change is never applied, so
            // nothing is previewed and nothing can be committed.
            details.cancel();
            return;
          }
          if (details.reason === "keyboard") cancelled.current = false;
          setDragging(next);
          onPreview?.(next);
        }}
        onValueCommitted={(next) => {
          pressing.current = false;
          setDragging(null);
          if (cancelled.current) {
            cancelled.current = false;
            return;
          }
          if (blocked) return;
          onCommit(next);
        }}
        className="flex w-full flex-wrap items-center gap-x-[var(--space-6)] gap-y-[var(--space-4)]"
      >
        <Slider.Control className="relative flex h-[26px] flex-1 items-center">
          <Slider.Track className="h-[3px] w-full rounded-sm bg-edge">
            <Slider.Indicator className="rounded-sm bg-accent" />
          </Slider.Track>
          {/* Two parts, because one cannot do it: the fill half is the accent
              and the rest half is `--edge`, and in graphite and light those sit
              far enough apart that no single colour clears §5's 3:1 against
              both. The interior answers to the fill, the ring to the rest, and
              the parity gate measures each against the half it has to beat. */}
          <Slider.Thumb
            inputRef={input}
            aria-labelledby={ids.label}
            // The hint and the refusal are the two notes the row owns, and the
            // range input is the element a screen reader reaches: a hint that
            // stayed on the wrapper would reach nobody (§5.3 keeps a refusal out
            // of a tooltip for the same reason).
            aria-describedby={describedBy(
              hint === undefined ? undefined : ids.hint,
              refused === undefined ? undefined : ids.reason,
            )}
            className="size-[10px] rounded-sm border border-panel bg-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
        </Slider.Control>
        {/* The row wraps, so a refused draft's own words take a line under the
            track instead of being squeezed into the fixed 36px the well is. */}
        <ControlNumber
          inline
          labelledById={ids.label}
          label={label}
          {...(hooks === undefined ? {} : { data: hooks })}
          wellClassName="w-[36px] flex-none"
          value={shown}
          min={min}
          max={max}
          {...(integer === undefined ? {} : { integer })}
          {...(density === undefined ? {} : { density })}
          {...(onClear === undefined ? {} : { onClear })}
          onCommit={onCommit}
        />
      </Slider.Root>
    </ControlRow>
  );
}

/**
 * The well's own hooks: the slider's name the track, and the well is the same
 * control's typed route, so each takes the same name with `-well` appended.
 *
 * Two elements under one name would be a strict-mode violation for every suite
 * that reads the track's value, and the field has to stay addressable by both
 * routes — one hook naming both is a locator that cannot say which one it means.
 */
function wellData(
  data: Readonly<Record<`data-${string}`, string>> | undefined,
): Readonly<Record<`data-${string}`, string>> | undefined {
  const entries = Object.entries(data ?? {});
  return entries.length === 0
    ? undefined
    : Object.fromEntries(entries.map(([key, value]) => [`${key}-well`, value]));
}

/**
 * The step the drag moves by, read off the range input Base UI renders.
 *
 * Read rather than declared: a step held here beside the slider's own could
 * disagree with it, and the wheel would then step differently from every other
 * way of moving the value. The default step (no `step` attribute) is 1, which
 * is what this control has always used; `any` parses to nothing and cannot move
 * a value.
 */
function stepOf(node: HTMLInputElement | null): number {
  const raw = node === null ? null : node.getAttribute("step");
  const step = raw === null ? 1 : Number(raw);
  return Number.isFinite(step) && step > 0 ? step : 1;
}
