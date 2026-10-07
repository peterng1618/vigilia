import {
  createLiveSource,
  type LiveSourceStatus,
  SAMPLE_STREAM_PATH,
  type SampleSource,
} from "@vigilia/renderer-core";
import { createPreviewSource } from "./preview-source.js";
import { uiCopy } from "./ui-copy.js";

export function createEditorSource(options: {
  readonly mode: "preview" | "live";
  readonly keys: readonly string[];
  readonly onStatus: (status: LiveSourceStatus, detail?: string) => void;
}): { readonly source: SampleSource; close(): void } {
  if (options.mode === "preview") {
    options.onStatus("live", uiCopy.view.previewDetail);
    return {
      ...createPreviewSource({ keys: options.keys, now: () => Date.now() }),
      close: () => {},
    };
  }

  const query = new URLSearchParams({ keys: options.keys.join(",") });
  return createLiveSource({
    url: `${SAMPLE_STREAM_PATH}?${query}`,
    onStatus: options.onStatus,
  });
}
