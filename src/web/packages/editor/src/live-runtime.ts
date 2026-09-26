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
    if (this.#runDisplay === "tokens") {
      // Authoring view: each value run shows its token, so the structure of the
      // text is visible. Painting this way also means a bound run no longer
      // depends on a sample arriving to be readable.
      applyAuthoredText(this.#canvas, this.#globals, {
        bindings: this.#bindings,
        ...(this.#locale === undefined ? {} : { locale: this.#locale }),
        transform: (segments, runs, bindings) =>
          toAuthoringSegments(segments, runs, bindings),
      });
      this.#canvas.requestRenderAll();
      return;
    }

    // Both paths must repaint every text object: tokens mode overwrites an
    // unbound object's text, so switching back has to restore it even though
    // `refreshBoundText` only handles objects a sample resolves.
    applyAuthoredText(this.#canvas, this.#globals, {
      bindings: this.#bindings,
      ...(this.#locale === undefined ? {} : { locale: this.#locale }),
    });
    refreshBoundText(
      this.#canvas,
      this.#bindings,
      this.#source,
      this.#globals,
      undefined,
      this.#locale,
    );
    this.#canvas.requestRenderAll();
  }
}
