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

/** Runtime samples update Fabric objects without becoming authored editor state. */
export class LiveRuntime {
  readonly #canvas: StaticCanvas;
  #bindings: Readonly<Record<string, readonly Binding[]>>;
  #source: SampleSource;
  #globals: FabricGlobals | undefined;
  #locale: string | undefined;
  #runDisplay: RunDisplayMode = DEFAULT_RUN_DISPLAY_MODE;

  constructor(options: {
    readonly canvas: StaticCanvas;
    readonly bindings?: Readonly<Record<string, readonly Binding[]>>;
    readonly source: SampleSource;
    readonly globals?: FabricGlobals;
    readonly locale?: string;
  }) {
    this.#canvas = options.canvas;
    this.#bindings = options.bindings ?? {};
    this.#source = options.source;
    this.#globals = options.globals;
    this.#locale = options.locale;
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
    this.#globals = globals;
  }

  setLocale(locale: string | undefined): void {
    if (locale === this.#locale) return;
    this.#locale = locale;
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

  refresh(): void {
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
    if (this.#runDisplay !== "tokens") {
      refreshBoundText(
        this.#canvas,
        this.#bindings,
        this.#source,
        this.#globals,
        undefined,
        this.#locale,
      );
    }
    this.#canvas.requestRenderAll();
  }
}
