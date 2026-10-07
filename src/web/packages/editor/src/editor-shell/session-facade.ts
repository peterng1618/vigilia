import type {
  ChartFamily,
  FabricThemeEnvelopeInput,
} from "@vigilia/renderer-core";
import type { ArrangeAction } from "../arrange.js";
import type { ShapeKind } from "../new-object-defaults.js";
import type { RunDisplayMode } from "../run-placeholder.js";

/** Document-level editor actions the shell dispatches. Every method delegates to
 * an existing owner; the façade adds reachability, never logic. */
export interface EditorActionFacade {
  newDocument(): Promise<void>;
  /** The reference composition as a template, not what `New` means. */
  newFromStarter(): Promise<void>;
  openPackage(): void;
  savePackage(): Promise<void>;
  releasePackage(): Promise<void>;
  openLibrary(): Promise<void>;
  saveLibrary(): Promise<void>;
  addText(): void;
  /** The Insert menu's route to a primitive; the Add pane's own buttons call
      the same construction rather than a second copy of it. */
  addShape(kind: ShapeKind): void;
  addChart(family: ChartFamily): void;
  /** The Insert menu's route to the unit library, for the same reason. */
  insertCard(cardId: string): void;
  arrange(action: ArrangeAction): boolean;
  canArrange(action: ArrangeAction): boolean;
  undo(): void;
  redo(): void;
  copy(): void;
  cut(): void;
  deleteActive(): void;
  duplicate(): void;
  group(): void;
  ungroup(): void;
  /** The document as it stands, and the id a display must fetch its assets
   *  from. `undefined` when this document has never been saved: a published
   *  document's assets come from the theme's folder, so there would be none. */
  publishableDocument():
    | { readonly id: string; readonly envelope: FabricThemeEnvelopeInput }
    | undefined;
  /** Whether the document differs from what was last saved. Pulled, so the
   *  subscription carries no value: it says the document may have moved. */
  isDirty(): boolean;
  subscribeDocumentChange(listener: () => void): () => void;
}

/** Editor-main owns these; the View menu dispatches through them. */
export interface EditorViewControls {
  readonly sourceMode: () => "preview" | "live";
  setSourceMode(mode: "preview" | "live"): void;
  readonly chartRefreshRate: () => 1 | 30;
  setChartRefreshRate(rate: 1 | 30): void;
  /** How value runs read while authoring (§89): the token, or its value. */
  readonly runDisplay: () => RunDisplayMode;
  setRunDisplay(mode: RunDisplayMode): void;
}
