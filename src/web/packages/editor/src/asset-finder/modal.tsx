import { Tabs } from "@base-ui/react/tabs";
import type {
  AssetPage,
  AssetResult,
  AssetSearchAnswer,
  AssetSourceListing,
  ListingCategory,
} from "@yunari/renderer-core";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "../components/ui/dialog.js";
import { uiCopy } from "../ui-copy.js";
import { type ClientOptions, listSources, searchAssets } from "./client.js";
import { AssetRow } from "./row.js";

/** How long a keystroke settles before it is the query. */
export const SEARCH_DEBOUNCE_MS = 200;

const DISABLED_KEY = "yunari.asset-finder.disabled";

export type ActionOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

export interface FinderProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The category whose body is a component, never a grid. */
  readonly bodies: Readonly<
    Record<"font-picker" | "wallpaper-engine", React.ReactNode>
  >;
  readonly onAction: (
    page: AssetPage,
    result: AssetResult,
  ) => Promise<ActionOutcome>;
  /** Opens Settings on Connections; absent until the shell wires it. */
  readonly onOpenConnections?: () => void;
  /** The category to select once the listing arrives, when the caller asked
   *  for one (the font field opens on Fonts). */
  readonly initialCategory?: ListingCategory;
  readonly client?: ClientOptions;
}

function storedDisabled(): ReadonlySet<string> {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(DISABLED_KEY) ?? "[]",
    ) as unknown;
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function gridSourcesOf(
  sources: readonly AssetSourceListing[],
  category: ListingCategory,
): readonly AssetSourceListing[] {
  return sources.filter(
    (source) => source.category === category && source.body === "grid",
  );
}

/**
 * The finder: one modal, tabs derived from the registry's categories, one
 * mixed grid per grid category and a body per category that owns a component.
 *
 * A late answer is dropped by comparing a ticket on resolve; an abort alone
 * does not stop a response already in flight, so two searches racing would
 * otherwise leave the older one on screen.
 */
export function AssetFinder({
  open,
  onOpenChange,
  bodies,
  onAction,
  onOpenConnections,
  initialCategory,
  client,
}: FinderProps): React.JSX.Element {
  const [sources, setSources] = useState<readonly AssetSourceListing[]>([]);
  const [active, setActive] = useState<ListingCategory | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<AssetSearchAnswer | undefined>(
    undefined,
  );
  const [disabled, setDisabled] = useState<ReadonlySet<string>>(storedDisabled);
  const [selected, setSelected] = useState<
    { readonly page: AssetPage; readonly result: AssetResult } | undefined
  >(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const ticket = useRef(0);

  /** A category a body owns: no listing names it, and no source is searched. */
  const bodyKinds: Partial<Record<ListingCategory, React.ReactNode>> = {
    font: bodies["font-picker"],
    local: bodies["wallpaper-engine"],
  };

  const present = (
    category: ListingCategory,
    listing: readonly AssetSourceListing[],
  ): boolean =>
    listing.some((source) => source.category === category) ||
    bodyKinds[category] != null;

  useEffect(() => {
    if (!open) return;

    let live = true;
    void listSources(client).then((next) => {
      if (!live) return;
      setSources(next);
      setActive((current) => {
        if (current !== undefined && present(current, next)) return current;
        if (initialCategory !== undefined && present(initialCategory, next)) {
          return initialCategory;
        }
        return next[0]?.category ?? (bodyKinds.font != null ? "font" : "local");
      });
    });
    return () => {
      live = false;
    };
    // `bodyKinds` is read for presence only; its nodes are React state the
    // effect must not restart on.
  }, [open, client, initialCategory]);

  useEffect(() => {
    localStorage.setItem(DISABLED_KEY, JSON.stringify([...disabled]));
  }, [disabled]);

  const categories: ListingCategory[] = [];
  for (const source of sources) {
    if (!categories.includes(source.category)) categories.push(source.category);
  }
  for (const category of ["font", "local"] as const) {
    if (bodyKinds[category] != null && !categories.includes(category)) {
      categories.push(category);
    }
  }

  const gridSources =
    active === undefined ? [] : gridSourcesOf(sources, active);
  const enabledSources = gridSources.filter(
    (source) => !disabled.has(source.id),
  );
  const enabledKey = enabledSources.map((source) => source.id).join("|");

  useEffect(() => {
    // Body categories draw a component, not a search.
    if (!open || active === undefined || gridSources.length === 0) {
      ticket.current += 1;
      setAnswer(undefined);
      return;
    }

    const enabled = enabledSources.map((source) => source.id);
    const timer = setTimeout(() => {
      const issued = ++ticket.current;
      void searchAssets({ query, enabled, cursors: {} }, client).then(
        (next) => {
          if (issued !== ticket.current) return;
          setAnswer(next);
          setSelected(undefined);
        },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // `enabledKey` stands for the enabled list; `enabledSources` is a new array
    // every render and would restart the timer on unrelated state.
  }, [open, active, query, enabledKey, sources.length, client]);

  const rows =
    answer?.pages.flatMap((page) =>
      page.results.map((result) => ({ page, result })),
    ) ?? [];
  const failures =
    answer?.pages.filter((page) => page.failure !== undefined) ?? [];
  const empty =
    answer !== undefined &&
    failures.length === 0 &&
    answer.pages.every((page) => page.results.length === 0);

  const sourceOf = (id: string): AssetSourceListing | undefined =>
    sources.find((source) => source.id === id);

  const bodyOf = (
    category: ListingCategory,
  ): AssetSourceListing["body"] | undefined =>
    sources.find((source) => source.category === category)?.body ??
    (bodyKinds[category] == null
      ? undefined
      : category === "font"
        ? "font-picker"
        : "wallpaper-engine");

  const runAction = async (): Promise<void> => {
    if (selected === undefined) return;

    setBusy(true);
    const outcome = await onAction(selected.page, selected.result);
    setBusy(false);
    setMessage(outcome.ok ? undefined : outcome.message);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={uiCopy.assets.title}
      className="editor-shell-dialog--finder"
    >
      {active === undefined ? null : (
        <Tabs.Root
          value={active}
          onValueChange={(value) => {
            setActive(value as ListingCategory);
            setSelected(undefined);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <Tabs.List className="flex gap-[var(--space-4)] border-b border-edge px-[var(--space-16)] pt-[var(--space-12)]">
            {categories.map((category) => (
              <Tabs.Tab
                key={category}
                value={category}
                data-yunari-asset-tab={category}
                className="rounded-t-[var(--radius-sm)] px-[var(--space-12)] py-[var(--space-8)] text-sm text-muted data-[selected]:bg-[var(--panel-2)] data-[selected]:text-text"
              >
                {uiCopy.assets.category[category]}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {active === undefined ? null : (
            <Tabs.Panel
              value={active}
              className="flex min-h-0 flex-1 flex-col gap-[var(--space-12)] p-[var(--space-16)]"
            >
              {gridSources.length === 0 ? (
                <div
                  className="min-h-0 flex-1 overflow-y-auto"
                  data-yunari-asset-body={bodyOf(active)}
                >
                  {bodyOf(active) === "font-picker"
                    ? bodies["font-picker"]
                    : bodyOf(active) === "wallpaper-engine"
                      ? bodies["wallpaper-engine"]
                      : uiCopy.assets.noSource}
                </div>
              ) : (
                <>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={uiCopy.assets.searchPlaceholder}
                    aria-label={uiCopy.assets.searchPlaceholder}
                    data-yunari-asset-search=""
                    className="rounded-[var(--radius-sm)] border border-edge bg-[var(--bg)] px-[var(--space-10)] py-[var(--space-6)] text-sm"
                  />

                  {gridSources.length > 1 ? (
                    <div className="flex flex-wrap gap-[var(--space-6)]">
                      {gridSources.map((source) => {
                        const off = disabled.has(source.id);
                        return (
                          <button
                            key={source.id}
                            type="button"
                            aria-pressed={!off}
                            data-yunari-asset-chip={source.id}
                            data-disabled={off ? "" : undefined}
                            disabled={!source.configurable}
                            onClick={() =>
                              setDisabled((current) => {
                                const next = new Set(current);
                                if (next.has(source.id)) next.delete(source.id);
                                else if (
                                  enabledSources.length > 1 ||
                                  !gridSources.some(
                                    (entry) => !next.has(entry.id),
                                  )
                                ) {
                                  next.add(source.id);
                                }
                                return next;
                              })
                            }
                            className="rounded-full border border-edge px-[var(--space-10)] py-[var(--space-4)] text-xs aria-pressed:border-accent aria-pressed:text-accent data-[disabled]:text-faint"
                          >
                            {source.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {failures.map((page) => {
                    const source = sourceOf(page.source);
                    const label = source?.label ?? page.source;
                    const failure = page.failure;
                    if (failure === undefined) return null;

                    return failure.reason === "needs-credential" ? (
                      <p
                        key={page.source}
                        className="flex items-center gap-[var(--space-8)] text-sm"
                        data-yunari-asset-needs-credential={page.source}
                      >
                        {uiCopy.assets.needsCredential(label)}
                        <button
                          type="button"
                          onClick={() => onOpenConnections?.()}
                          data-yunari-asset-connections=""
                          className="underline"
                        >
                          {uiCopy.assets.connectionsAction}
                        </button>
                      </p>
                    ) : (
                      <p
                        key={page.source}
                        className="text-sm"
                        data-yunari-asset-failure={page.source}
                      >
                        {uiCopy.assets.sourceFailed(label, failure.message)}
                      </p>
                    );
                  })}

                  {empty ? (
                    <p
                      className="flex flex-col items-start gap-[var(--space-8)] text-sm text-muted"
                      data-yunari-asset-empty=""
                    >
                      {uiCopy.assets.noResults}
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        data-yunari-asset-clear-query=""
                        className="underline"
                      >
                        {uiCopy.assets.clearQuery}
                      </button>
                    </p>
                  ) : (
                    <div
                      className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-[var(--space-8)] overflow-y-auto"
                      data-yunari-asset-grid=""
                    >
                      {rows.map(({ page, result }) => (
                        <AssetRow
                          key={`${page.source}:${result.id}`}
                          result={result}
                          sourceLabel={
                            sourceOf(page.source)?.label ?? page.source
                          }
                          selected={
                            selected?.result.id === result.id &&
                            selected.page.source === page.source
                          }
                          onSelect={() => setSelected({ page, result })}
                        />
                      ))}
                    </div>
                  )}

                  <footer className="flex items-center justify-between gap-[var(--space-12)] border-t border-edge pt-[var(--space-10)] text-sm">
                    <span className="text-muted" data-yunari-asset-count="">
                      {answer === undefined
                        ? ""
                        : uiCopy.assets.results(
                            rows.length,
                            new Set(answer.pages.map((page) => page.source))
                              .size,
                          )}
                      {message === undefined ? null : (
                        <span className="ml-[var(--space-8)]">{message}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      disabled={selected === undefined || busy}
                      onClick={() => void runAction()}
                      data-yunari-asset-action=""
                      className="rounded-[var(--radius-sm)] border border-edge px-[var(--space-12)] py-[var(--space-6)] disabled:text-faint"
                    >
                      {uiCopy.assets.action[active]}
                    </button>
                  </footer>
                </>
              )}
            </Tabs.Panel>
          )}
        </Tabs.Root>
      )}
    </Dialog>
  );
}
