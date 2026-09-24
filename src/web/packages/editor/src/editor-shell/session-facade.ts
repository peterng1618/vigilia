import type { ChartFamily } from "@vigilia/renderer-core";
import type { ArrangeAction } from "../arrange.js";
import type { RunDisplayMode } from "../run-placeholder.js";

/** Document-level editor actions the shell dispatches. Every method delegates to
 * an existing owner; the façade adds reachability, never logic. */
export interface EditorActionFacade {
  newDocument(): Promise<void>;
  openPackage(): void;
  savePackage(): Promise<void>;
  releasePackage(): Promise<void>;
  openLibrary(): Promise<void>;
  saveLibrary(): Promise<void>;
  addText(): void;
  addChart(family: ChartFamily): void;
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
  /** Editor-only display state; persisted in envelope.editorMetadata (§172). */
  layerNames(): Readonly<Record<string, string>>;
  setLayerNames(names: Readonly<Record<string, string>>): void;
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
