import type {
  Binding,
  FabricGlobals,
  SampleSource,
} from "@vigilia/renderer-core";
import { refreshBoundText } from "@vigilia/scene-fabric";
import type { StaticCanvas } from "fabric/es";

/** Runtime samples update Fabric objects without becoming authored editor state. */
export class LiveRuntime {
  readonly #canvas: StaticCanvas;
  #bindings: Readonly<Record<string, readonly Binding[]>>;
  #source: SampleSource;
  #globals: FabricGlobals | undefined;

  constructor(options: {
    readonly canvas: StaticCanvas;
    readonly bindings?: Readonly<Record<string, readonly Binding[]>>;
    readonly source: SampleSource;
    readonly globals?: FabricGlobals;
  }) {
    this.#canvas = options.canvas;
    this.#bindings = options.bindings ?? {};
    this.#source = options.source;
    this.#globals = options.globals;
  }

  setSource(source: SampleSource): void {
    this.#source = source;
    this.refresh();
  }

  setBindings(bindings: Readonly<Record<string, readonly Binding[]>>): void {
    this.#bindings = bindings;
  }

  setGlobals(globals: FabricGlobals | undefined): void {
    this.#globals = globals;
  }

  refresh(): void {
    refreshBoundText(this.#canvas, this.#bindings, this.#source, this.#globals);
  }
}
