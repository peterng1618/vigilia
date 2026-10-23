import type * as React from "react";
import { useEffect, useState } from "react";
import { uiCopy } from "../ui-copy.js";
import {
  fetchWallpaperEngine,
  type WallpaperEngineAnswer,
  type WallpaperEngineClientOptions,
  type WallpaperEngineItem,
} from "../wallpaper-engine/client.js";
import type { ImportOutcome } from "./actions.js";

/** The finder's Wallpaper Engine body: this PC's library, not a search.
 *
 * The import itself is the session's — this body only says which item, because
 * the asset manager's caps and the credit are not something a row can own. */
export function WallpaperEngineBody(props: {
  readonly onImport: (item: WallpaperEngineItem) => Promise<ImportOutcome>;
  /** Task 7 supplies this; without it a scene row's action is not drawn. */
  readonly onOpenScene?: (item: WallpaperEngineItem) => void;
  readonly client?: WallpaperEngineClientOptions;
}): React.JSX.Element {
  const client = props.client;
  const onImport = props.onImport;
  const onOpenScene = props.onOpenScene;
  const [answer, setAnswer] = useState<WallpaperEngineAnswer | undefined>();
  const [refusals, setRefusals] = useState<Readonly<Record<string, string>>>(
    {},
  );

  useEffect(() => {
    let live = true;
    void fetchWallpaperEngine(client).then((next) => {
      if (live) setAnswer(next);
    });
    return () => {
      live = false;
    };
  }, [client]);

  if (answer === undefined) return <></>;

  if (answer.available === false) {
    return (
      <p
        data-yunari-wallpaper-engine-unavailable=""
        className="text-sm text-muted"
      >
        {uiCopy.assets.wallpaperEngine.reason[answer.reason]}
      </p>
    );
  }

  if (answer.items.length === 0) {
    return (
      <p className="text-sm text-muted">
        {uiCopy.assets.wallpaperEngine.empty}
      </p>
    );
  }

  const importItem = async (item: WallpaperEngineItem): Promise<void> => {
    const outcome = await onImport(item);
    setRefusals((current) => {
      const next = { ...current };
      if (outcome.ok) delete next[item.workshopId];
      else next[item.workshopId] = outcome.message;
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      {answer.items.map((item) => {
        const refusal = refusals[item.workshopId];
        return (
          <div
            key={item.workshopId}
            data-yunari-wallpaper-engine-item={item.workshopId}
            className="flex items-center gap-[var(--space-10)] rounded-[var(--radius-md)] border border-edge bg-[var(--panel-2)] p-[var(--space-8)]"
          >
            {item.previewUrl === undefined ? null : (
              <img
                src={item.previewUrl}
                alt=""
                loading="lazy"
                className="h-16 w-24 shrink-0 rounded-[var(--radius-sm)] object-cover"
              />
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-[var(--space-2)]">
              <span className="truncate text-sm">{item.title}</span>
              <span className="text-xs text-muted">
                {uiCopy.assets.wallpaperEngine.kind[item.kind]} ·{" "}
                {uiCopy.assets.wallpaperEngine.size(item.filesize)}
              </span>
              {refusal === undefined ? null : (
                <span
                  data-yunari-wallpaper-engine-refusal=""
                  className="text-xs text-muted"
                >
                  {refusal}
                </span>
              )}
            </span>
            {item.kind === "image" || item.kind === "video" ? (
              <button
                type="button"
                data-yunari-wallpaper-engine-import=""
                onClick={() => {
                  void importItem(item);
                }}
                className="shrink-0 rounded-[var(--radius-sm)] border border-edge px-[var(--space-10)] py-[var(--space-6)] text-sm"
              >
                {uiCopy.assets.wallpaperEngine.import}
              </button>
            ) : item.kind === "scene" && onOpenScene !== undefined ? (
              <button
                type="button"
                data-yunari-wallpaper-engine-open=""
                onClick={() => {
                  onOpenScene(item);
                }}
                className="shrink-0 rounded-[var(--radius-sm)] border border-edge px-[var(--space-10)] py-[var(--space-6)] text-sm"
              >
                {uiCopy.assets.wallpaperEngine.openScene}
              </button>
            ) : item.kind === "web" ? (
              <span className="shrink-0 text-xs text-muted">
                {uiCopy.assets.wallpaperEngine.webUnsupported}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
