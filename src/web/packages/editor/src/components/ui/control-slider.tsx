import { Slider } from "@base-ui/react/slider";
import type * as React from "react";
import { useEffect, useRef } from "react";
import {
  ControlRow,
  type ControlProps,
  isBlocked,
  useControlIds,
  wellClasses,
} from "./control-well.js";

/**
 * A bounded number: a 3px track with an accent fill, a 10px thumb, and a well
 * showing the value (bible §5).
 *
 * A gesture has one undo boundary, so preview and history are separate calls:
 * `onPreview` fires while the gesture is moving and writes nothing, one changed
 * value reaches `onCommit` when the gesture ends, and Escape ends it with
 * `onCancel` and no commit at all. Base UI's commit does not fire when the
 * value did not change, so a press that moves nothing adds nothing.
 *
 * The value well is a readout of the slider, not a second input: the well shows
 * the value the control edits, and the slider is the edit route.
 */
export function ControlSlider(
  props: ControlProps & {
    readonly value: number;
    readonly min: number;
    readonly max: number;
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
    density,
    data,
    value,
    min,
    max,
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

  return (
    <ControlRow ids={ids} label={label} refused={refused} density={density}>
      <Slider.Root
        {...data}
        value={value}
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
          onPreview?.(next);
        }}
        onValueCommitted={(next) => {
          pressing.current = false;
          if (cancelled.current) {
            cancelled.current = false;
            return;
          }
          if (blocked) return;
          onCommit(next);
        }}
        className="flex w-full items-center gap-[var(--space-6)]"
      >
        <Slider.Control className="relative flex h-[26px] flex-1 items-center">
          <Slider.Track className="h-[3px] w-full rounded-sm bg-edge">
            <Slider.Indicator className="rounded-sm bg-accent" />
          </Slider.Track>
          <Slider.Thumb
            inputRef={input}
            aria-labelledby={ids.label}
            aria-describedby={refused === undefined ? undefined : ids.reason}
            className="size-[10px] rounded-sm bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
        </Slider.Control>
        <span
          className={`${wellClasses(density)} w-[36px] flex-none justify-end font-mono text-sm text-text`}
        >
          {value}
        </span>
      </Slider.Root>
    </ControlRow>
  );
}
