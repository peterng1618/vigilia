import type {
  Binding,
  FabricGlobals,
  SampleSource,
} from "@vigilia/renderer-core";
import { applyAuthoredText, refreshBoundText } from "@vigilia/scene-fabric";
import type { StaticCanvas } from "fabric/es";
import {
  DEFAULT_RUN_DISPLAY_MODE,
  type RunDisplayMode,
  toAuthoringSegments,
} from "./run-placeholder.js";

/**
 * How often the sample pass repaints text.
 *
 * The fastest cadence any bound value can change at is a clock, and a clock
 * changes once a second. A reading that changes once a second was being
 * re-measured thirty times a second, across every text object in the document,
 * and the text pass is the expensive half of the repaint rather than the chart
 * half. 4 Hz is four times the fastest signal, so a clock's second boundary is
 * never missed and is at most 250 ms late, and it is well above the rate at
 * which a changing digit can be read — a value visible for a quarter of a
 * second is unambiguous, one visible for 33 ms is a blur.
 */
const SAMPLE_TEXT_INTERVAL_MS = 250;

/**
 * How often the authored pass repaints when nothing has asked it to.
 *
 * Authored content is a function of the bindings, the globals, the run display
 * and the object's own runs — none of which the frame clock changes — so the
 * setters ask for their own repaint and this is only the net under an edit that
 * reaches Fabric without passing one, such as a run rewritten by the property
 * panel. It is a second rather than nothing because a repair loop that never
 * runs is a different failure from one that runs late.
 */
const AUTHORED_TEXT_INTERVAL_MS = 1_000;

/** Runtime samples update Fabric objects without becoming authored editor state. */
export class LiveRuntime {
  readonly #canvas: StaticCanvas;
  #bindings: Readonly<Record<string, readonly Binding[]>>;
  #source: SampleSource;
  #globals: FabricGlobals | undefined;
  #themeLanguage: string | undefined;
  #runDisplay: RunDisplayMode = DEFAULT_RUN_DISPLAY_MODE;
  /** Set by every input the authored pass resolves against; cleared by the pass. */
  #authoredDue = true;
  #lastAuthoredMs: number | undefined;
  #lastSampleMs: number | undefined;
  readonly #now: () => number;

  constructor(options: {
    readonly canvas: StaticCanvas;
    readonly bindings?: Readonly<Record<string, readonly Binding[]>>;
    readonly source: SampleSource;
    readonly globals?: FabricGlobals;
    readonly themeLanguage?: string;
    /** Injectable so a test can hold the loop still; wall clock otherwise. */
    readonly now?: () => number;
  }) {
    this.#canvas = options.canvas;
    this.#bindings = options.bindings ?? {};
    this.#source = options.source;
    this.#globals = options.globals;
    this.#themeLanguage = options.themeLanguage;
    this.#now = options.now ?? (() => Date.now());
  }

  /**
   * One object's authoring view — its value runs as tokens.
   *
   * Fabric enters inline editing on the first click's mouse-up, not on the
   * double-click, so the object is already editing by the time an author asks
   * for this. Both refresh passes skip an editing object — that is what keeps a
   * keystroke from being repainted away — so the flag is taken down for the one
   * call that paints it and put straight back. Nothing is rendered between them.
   */
  showAuthoringView(object: { isEditing: boolean }): void {
    const editing = object.isEditing;
    object.isEditing = false;
    try {
      applyAuthoredText(this.#canvas, this.#globals, {
        bindings: this.#bindings,
        transform: toAuthoringSegments,
        only: (candidate) => candidate === object,
      });
    } finally {
      // A throw here must not leave Fabric believing the object is not editing,
      // which would strand the caret and the 30 fps skip that protects it.
      object.isEditing = editing;
    }
    // The loop's own copy of the authored pass is what restores every other
    // object after an inline edit, and an edit is a change to authored content
    // that arrives without passing a setter.
    this.#authoredDue = true;
    this.#canvas.requestRenderAll();
  }

  setSource(source: SampleSource): void {
    this.#source = source;
    this.refresh();
  }

  setBindings(bindings: Readonly<Record<string, readonly Binding[]>>): void {
    this.#bindings = bindings;
    // What a bound run paints is decided by its binding, so changing one must
    // repaint rather than wait for the next sample.
    this.refresh();
  }

  setGlobals(globals: FabricGlobals | undefined): void {
    if (globals === this.#globals) return;
    this.#globals = globals;
    // Deliberately not a `refresh`, and that is what makes it work. A palette
    // drag is the reason: the session hands new globals to six owners
    // (`editor-session.ts:1041-1046`) and not one of them repaints text, so this
    // pass is the only thing that shows the canvas recolouring as the saturation
    // square is dragged. Marking it due rather than repainting here keeps that
    // within a frame of the pointer without repainting on every one of them.
    this.#authoredDue = true;
  }

  setThemeLanguage(themeLanguage: string | undefined): void {
    if (themeLanguage === this.#themeLanguage) return;
    this.#themeLanguage = themeLanguage;
    // The language decides the words a clock paints, so changing it must repaint
    // rather than wait for the next sample. `setGlobals` above deliberately does
    // not refresh; this one must, because nothing else is scheduled to.
    this.refresh();
  }

  /** How value runs are shown while authoring; a display never sees this. */
  setRunDisplay(mode: RunDisplayMode): void {
    this.#runDisplay = mode;
    this.refresh();
  }

  get runDisplay(): RunDisplayMode {
    return this.#runDisplay;
  }

  /**
   * Repaint every text object now, because something changed.
   *
   * The change-driven half, and what every setter above calls. A repaint asked
   * for is owed in full and at once, which is why this is not the method the
   * loop calls — see `tick`.
   */
  refresh(): void {
    this.#paintAuthored();
    this.#paintSample();
    const now = this.#now();
    this.#lastAuthoredMs = now;
    this.#lastSampleMs = now;
    this.#canvas.requestRenderAll();
  }

  /**
   * The refresh loop's own call.
   *
   * Separate from `refresh` because the loop runs at the author's chart rate —
   * 30 fps by default — and a chart that is animating does not make a clock's
   * seconds change any faster. The two passes are repainted on their own
   * cadences and the canvas is only asked to render when one of them painted
   * something; an unchanged scene re-rendered is 30 identical pictures a second,
   * and the charts ask for their own render when they move
   * (`chart-manager/index.ts:456`).
   */
  tick(): void {
    const now = this.#now();
    let painted = false;

    if (
      this.#authoredDue ||
      due(now, this.#lastAuthoredMs, AUTHORED_TEXT_INTERVAL_MS)
    ) {
      this.#paintAuthored();
      this.#lastAuthoredMs = now;
      painted = true;
    }
    if (due(now, this.#lastSampleMs, SAMPLE_TEXT_INTERVAL_MS)) {
      this.#paintSample();
      this.#lastSampleMs = now;
      painted = true;
    }
    if (painted) {
      this.#canvas.requestRenderAll();
    }
  }

  /** Authored content, which a token pass overwrites and this pass restores. */
  #paintAuthored(): void {
    this.#authoredDue = false;
    // Both passes must repaint every text object: a token pass overwrites an
    // unbound object's text, so switching back has to restore it even though
    // `refreshBoundText` only handles objects a sample resolves. The object
    // being edited inline is the one exception, and both passes make it.
    applyAuthoredText(this.#canvas, this.#globals, {
      bindings: this.#bindings,
      ...(this.#runDisplay === "tokens"
        ? { transform: toAuthoringSegments }
        : {}),
    });
  }

  #paintSample(): void {
    if (this.#runDisplay === "tokens") return;
    refreshBoundText(
      this.#canvas,
      this.#bindings,
      this.#source,
      this.#globals,
      undefined,
      this.#themeLanguage,
    );
  }
}

/** Unmeasured yet, or long enough ago that what it painted may have moved. */
function due(nowMs: number, lastMs: number | undefined, intervalMs: number) {
  return lastMs === undefined || nowMs - lastMs >= intervalMs;
}
