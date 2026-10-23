// @vitest-environment jsdom

import type {
  AssetPage,
  AssetResult,
  AssetSearchAnswer,
  AssetSourceListing,
} from "@yunari/renderer-core";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import * as client from "./client.js";
import { AssetFinder, SEARCH_DEBOUNCE_MS } from "./modal.js";

vi.mock("./client.js", () => ({
  listSources: vi.fn(),
  searchAssets: vi.fn(),
  assetBytes: vi.fn(),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const listSources = vi.mocked(client.listSources);
const searchAssets = vi.mocked(client.searchAssets);

const lucide: AssetSourceListing = {
  id: "lucide",
  label: "Lucide",
  category: "icon",
  body: "grid",
  requires: null,
  configurable: true,
  host: null,
};

const fontAwesome: AssetSourceListing = {
  id: "fontawesome-free",
  label: "Font Awesome Free",
  category: "icon",
  body: "grid",
  requires: null,
  configurable: true,
  host: null,
};

const unsplash: AssetSourceListing = {
  id: "unsplash",
  label: "Unsplash",
  category: "image",
  body: "grid",
  requires: "unsplash",
  configurable: true,
  host: "api.unsplash.com",
};

const curatedFonts: AssetSourceListing = {
  id: "curated-fonts",
  label: "Curated fonts",
  category: "font",
  body: "font-picker",
  requires: null,
  configurable: true,
  host: null,
};

const wallpaperEngine: AssetSourceListing = {
  id: "wallpaper-engine",
  label: "Wallpaper Engine",
  category: "local",
  body: "wallpaper-engine",
  requires: null,
  configurable: false,
  host: null,
};

const result = (id: string): AssetResult => ({
  id,
  name: id,
  kind: "icon",
  preview: "",
  subtitle: undefined,
  licence: "ISC",
  sourceUrl: "",
});

const page = (
  source: string,
  results: readonly AssetResult[] = [],
  extra: Partial<AssetPage> = {},
): AssetPage => ({
  source,
  results,
  next: undefined,
  failure: undefined,
  ...extra,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

let root: HTMLDivElement | undefined;
let container: Root | undefined;

async function settle(): Promise<void> {
  await act(async () => {
    for (let pass = 0; pass < 5; pass += 1) {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 1);
      await Promise.resolve();
      await Promise.resolve();
    }
  });
}

async function render(
  sources: readonly AssetSourceListing[],
  props: Partial<Parameters<typeof AssetFinder>[0]> = {},
  listing: Awaited<ReturnType<typeof client.listSources>> = {
    ok: true,
    sources,
  },
): Promise<void> {
  listSources.mockResolvedValue(listing);
  root = document.createElement("div");
  document.body.append(root);
  container = createRoot(root);

  await act(async () => {
    container?.render(finder(props));
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    for (let pass = 0; pass < 3; pass += 1) {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    }
  });
}

/** The same instance with new props, so a case can close and reopen it. */
async function rerender(
  props: Partial<Parameters<typeof AssetFinder>[0]>,
): Promise<void> {
  await act(async () => {
    container?.render(finder(props));
    await Promise.resolve();
  });
  await act(async () => {
    for (let pass = 0; pass < 3; pass += 1) {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    }
  });
}

function finder(
  props: Partial<Parameters<typeof AssetFinder>[0]>,
): ReactElement {
  return (
    <AssetFinder
      open
      onOpenChange={() => {}}
      bodies={{
        "font-picker": <p data-yunari-asset-body="font-picker">faces</p>,
        "wallpaper-engine": (
          <p data-yunari-asset-body="wallpaper-engine">scenes</p>
        ),
      }}
      onAction={async () => ({ ok: true })}
      {...props}
    />
  );
}

function tab(value: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(
    `[data-yunari-asset-tab="${value}"]`,
  );
  if (found === null) throw new Error(`no ${value} tab.`);
  return found;
}

function input(): HTMLInputElement {
  const found = document.querySelector<HTMLInputElement>(
    "[data-yunari-asset-search]",
  );
  if (found === null) throw new Error("no search input.");
  return found;
}

async function type(value: string): Promise<void> {
  const field = input();
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setter?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function rowIds(): string[] {
  return [...document.querySelectorAll("[data-yunari-asset-row]")].map(
    (row) => row.getAttribute("data-yunari-asset-row") ?? "",
  );
}

function footerAction(): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>(
    "[data-yunari-asset-action]",
  );
  if (found === null) throw new Error("no footer action.");
  return found;
}

function moreButton(): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>(
    "[data-yunari-asset-more]",
  );
  if (found === null) throw new Error("no Load more.");
  return found;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  listSources.mockReset();
  searchAssets.mockReset();
  searchAssets.mockResolvedValue({ pages: [] });
});

afterEach(async () => {
  await act(async () => container?.unmount());
  root?.remove();
  root = undefined;
  container = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AssetFinder tabs", () => {
  it("derives one tab per category, in registry order", async () => {
    await render([lucide, curatedFonts, wallpaperEngine]);
    await settle();

    const tabs = [...document.querySelectorAll("[data-yunari-asset-tab]")].map(
      (element) => element.getAttribute("data-yunari-asset-tab"),
    );
    expect(tabs).toEqual(["icon", "font", "local"]);
    expect(tab("icon").textContent).toContain(uiCopy.assets.category.icon);
    expect(tab("local").textContent).toContain(uiCopy.assets.category.local);
  });

  it("opens on the category a caller asked for", async () => {
    // The font field's button opens the finder on Fonts, so the modal honours
    // `initialCategory` over the listing's own first entry.
    await render([lucide, curatedFonts], { initialCategory: "font" });
    await settle();

    expect(tab("font").getAttribute("aria-selected")).toBe("true");
    expect(
      document.querySelector('[data-yunari-asset-body="font-picker"]'),
    ).not.toBeNull();
  });

  it("reopens on the category a caller asks for, after an earlier open", async () => {
    // The font field's button must land on Fonts even when the finder has been
    // opened before: the selection is kept for a plain reopen, not over a
    // caller that names a category.
    await render([lucide, curatedFonts]);
    await settle();
    expect(tab("icon").getAttribute("aria-selected")).toBe("true");

    await rerender({ open: false });
    await rerender({ open: true, initialCategory: "font" });

    expect(tab("font").getAttribute("aria-selected")).toBe("true");
  });

  it("says the host is absent rather than drawing a blank dialog", async () => {
    await render([], {}, { ok: false });

    expect(
      document.querySelector("[data-yunari-asset-host-failure]")?.textContent,
    ).toContain(uiCopy.assets.hostUnavailable);
  });

  it("renders a body-only category's body and no chips", async () => {
    await render([curatedFonts]);
    await settle();

    expect(
      document.querySelector('[data-yunari-asset-body="font-picker"]'),
    ).not.toBeNull();
    expect(document.querySelector("[data-yunari-asset-chip]")).toBeNull();
    expect(searchAssets).not.toHaveBeenCalled();
  });
});

describe("AssetFinder chips", () => {
  it("draws no chip row for one source", async () => {
    await render([lucide]);
    await settle();

    expect(document.querySelector("[data-yunari-asset-chip]")).toBeNull();
  });

  it("still switches a chip where the browser refuses storage", async () => {
    // A private window's store can throw on write; the chip is the author's
    // choice for this session either way, and an unhandled throw in an effect
    // would take the modal with it.
    const deny = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage denied");
      });

    await render([lucide, fontAwesome]);
    await settle();

    const chip = document.querySelector<HTMLButtonElement>(
      '[data-yunari-asset-chip="lucide"]',
    );
    if (chip === null) throw new Error("no Lucide chip.");
    await act(async () => chip.click());
    await settle();

    expect(chip.getAttribute("aria-pressed")).toBe("false");
    deny.mockRestore();
  });

  it("searches without a source whose chip is switched off", async () => {
    await render([lucide, fontAwesome]);
    await settle();
    searchAssets.mockClear();

    const chip = document.querySelector<HTMLButtonElement>(
      '[data-yunari-asset-chip="fontawesome-free"]',
    );
    if (chip === null) throw new Error("no Font Awesome chip.");
    await act(async () => chip.click());
    await settle();

    expect(searchAssets).toHaveBeenCalledTimes(1);
    expect(searchAssets.mock.calls[0]?.[0]).toMatchObject({
      enabled: ["lucide"],
    });
  });
});

describe("AssetFinder search", () => {
  it("issues one search for a burst of keystrokes", async () => {
    await render([lucide]);
    await settle();
    searchAssets.mockClear();

    await type("ho");
    await type("hou");
    await settle();

    expect(searchAssets).toHaveBeenCalledTimes(1);
    expect(searchAssets.mock.calls[0]?.[0]?.query).toBe("hou");
  });

  it("renders the newer query when answers arrive in reverse", async () => {
    const older = deferred<AssetSearchAnswer>();
    const newer = deferred<AssetSearchAnswer>();
    searchAssets
      .mockResolvedValueOnce({ pages: [] })
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    await render([lucide]);
    await settle();

    await type("a");
    await settle();
    await type("b");
    await settle();

    await act(async () => {
      void newer.resolve({ pages: [page("lucide", [result("lucide:newer")])] });
      await Promise.resolve();
    });
    await act(async () => {
      void older.resolve({ pages: [page("lucide", [result("lucide:older")])] });
      await Promise.resolve();
    });

    expect(rowIds()).toEqual(["lucide:newer"]);
  });

  it("names every source's failure and never reads as no results", async () => {
    searchAssets.mockResolvedValue({
      pages: [
        page("lucide", [], {
          failure: { reason: "failed", message: "Lucide answered 500." },
        }),
        page("fontawesome-free", [], {
          failure: { reason: "failed", message: "Font Awesome answered 502." },
        }),
      ],
    });

    await render([lucide, fontAwesome]);
    await settle();

    const sentences = [
      ...document.querySelectorAll("[data-yunari-asset-failure]"),
    ].map((node) => node.textContent ?? "");
    expect(sentences.join(" ")).toContain("Lucide answered 500.");
    expect(sentences.join(" ")).toContain("Font Awesome answered 502.");
    expect(document.querySelector("[data-yunari-asset-empty]")).toBeNull();
  });

  it("names the host on the first search that reaches one, not before", async () => {
    // A search that contacted no host is not the disclosure: a person is told
    // before their term leaves, which is the Images tab's first search.
    searchAssets.mockResolvedValue({ pages: [] });

    await render([lucide, unsplash]);
    await settle();
    expect(
      document.querySelector("[data-yunari-asset-host-notice]"),
    ).toBeNull();

    await act(async () => tab("image").click());
    await settle();

    expect(
      document.querySelector("[data-yunari-asset-host-notice]")?.textContent,
    ).toContain("api.unsplash.com");
  });

  it("keeps a failed source's sentence when Load more pages the survivors", async () => {
    searchAssets.mockImplementation(async (request) =>
      request.cursors["fontawesome-free"] === undefined
        ? {
            pages: [
              page("lucide", [], {
                failure: { reason: "failed", message: "Lucide answered 500." },
              }),
              page("fontawesome-free", [result("fontawesome-free:house")], {
                next: "F1",
              }),
            ],
          }
        : {
            pages: [
              page("fontawesome-free", [result("fontawesome-free:star")]),
            ],
          },
    );

    await render([lucide, fontAwesome]);
    await settle();
    await act(async () => moreButton().click());
    await settle();

    // The paged answer carries no Lucide page at all; its failure is still the
    // state of the grid, not a property of the last answer.
    expect(
      document.querySelector('[data-yunari-asset-failure="lucide"]')
        ?.textContent,
    ).toContain("Lucide answered 500.");
    expect(rowIds()).toEqual([
      "fontawesome-free:house",
      "fontawesome-free:star",
    ]);
  });

  it("does not read an empty page with a cursor as the end", async () => {
    searchAssets.mockResolvedValue({
      pages: [page("lucide", [], { next: "C1" })],
    });

    await render([lucide]);
    await settle();

    expect(document.querySelector("[data-yunari-asset-empty]")).toBeNull();
    expect(moreButton()).not.toBeNull();
  });

  it("prints the result's own second word, which distinguishes a style or an author", async () => {
    searchAssets.mockResolvedValue({
      pages: [
        page("fontawesome-free", [
          { ...result("fontawesome-free:house"), subtitle: "solid" },
        ]),
      ],
    });

    await render([fontAwesome]);
    await settle();

    expect(
      document.querySelector("[data-yunari-asset-row]")?.textContent,
    ).toContain("solid");
  });

  it("draws a failed page's sentence and keeps the other source's rows", async () => {
    searchAssets.mockResolvedValue({
      pages: [
        page("lucide", [], {
          failure: { reason: "failed", message: "Lucide answered 500." },
        }),
        page("fontawesome-free", [result("fontawesome-free:house")]),
      ],
    });

    await render([lucide, fontAwesome]);
    await settle();

    expect(
      document.querySelector("[data-yunari-asset-failure]")?.textContent,
    ).toContain("Lucide answered 500.");
    expect(rowIds()).toEqual(["fontawesome-free:house"]);
  });

  it("offers Connections instead of rows when a source needs a key", async () => {
    searchAssets.mockResolvedValue({
      pages: [
        page("unsplash", [], {
          failure: { reason: "needs-credential", credential: "unsplash" },
        }),
      ],
    });
    const onOpenConnections = vi.fn();

    await render([unsplash], { onOpenConnections });
    await settle();

    expect(rowIds()).toEqual([]);
    const link = document.querySelector<HTMLButtonElement>(
      "[data-yunari-asset-connections]",
    );
    if (link === null) throw new Error("no Connections link.");
    expect(link.textContent).toContain(uiCopy.assets.connectionsAction);
    await act(async () => link.click());
    expect(onOpenConnections).toHaveBeenCalledTimes(1);
  });

  it("draws no-results with a control that clears the query", async () => {
    await render([lucide]);
    await settle();
    await type("zzz");
    await settle();
    searchAssets.mockClear();

    expect(
      document.querySelector("[data-yunari-asset-empty]")?.textContent,
    ).toContain(uiCopy.assets.noResults);

    const clear = document.querySelector<HTMLButtonElement>(
      "[data-yunari-asset-clear-query]",
    );
    if (clear === null) throw new Error("no clear control.");
    await act(async () => clear.click());

    expect(input().value).toBe("");
    await settle();
    expect(searchAssets.mock.calls.at(-1)?.[0]?.query).toBe("");
  });
});

describe("AssetFinder's mixed grid", () => {
  it("alternates two sources' first pages, each row naming its source", async () => {
    searchAssets.mockResolvedValue({
      pages: [
        page("lucide", [result("lucide:a"), result("lucide:c")]),
        page("fontawesome-free", [result("fontawesome-free:b")]),
      ],
    });

    await render([lucide, fontAwesome]);
    await settle();

    expect(rowIds()).toEqual(["lucide:a", "fontawesome-free:b", "lucide:c"]);
    const rows = [...document.querySelectorAll("[data-yunari-asset-row]")];
    expect(rows[1]?.textContent).toContain("Font Awesome Free");
  });

  it("keeps two sources' identical ids apart", async () => {
    searchAssets.mockResolvedValue({
      pages: [
        page("lucide", [result("lucide:x")]),
        page("fontawesome-free", [result("fontawesome-free:x")]),
      ],
    });

    await render([lucide, fontAwesome]);
    await settle();

    expect(rowIds()).toEqual(["lucide:x", "fontawesome-free:x"]);
  });

  it("appends a later page after the rows already shown", async () => {
    searchAssets
      .mockResolvedValueOnce({
        pages: [
          page("lucide", [result("lucide:a")], { next: "L1" }),
          page("fontawesome-free", [result("fontawesome-free:b")], {
            next: "F1",
          }),
        ],
      })
      .mockResolvedValueOnce({
        pages: [
          page("lucide", [result("lucide:c")]),
          page("fontawesome-free", [result("fontawesome-free:d")]),
        ],
      });

    await render([lucide, fontAwesome]);
    await settle();
    await act(async () => moreButton().click());
    await settle();

    expect(rowIds()).toEqual([
      "lucide:a",
      "fontawesome-free:b",
      "lucide:c",
      "fontawesome-free:d",
    ]);
    // Each source's cursor is its own: the second request carries both.
    expect(searchAssets.mock.calls[1]?.[0]?.cursors).toEqual({
      lucide: "L1",
      "fontawesome-free": "F1",
    });
    expect(document.querySelector("[data-yunari-asset-more]")).toBeNull();
  });

  it("stops asking a source that answered no cursor", async () => {
    searchAssets
      .mockResolvedValueOnce({
        pages: [
          page("lucide", [result("lucide:a")], { next: "L1" }),
          page("fontawesome-free", [result("fontawesome-free:b")]),
        ],
      })
      .mockResolvedValueOnce({
        pages: [page("lucide", [result("lucide:c")])],
      });

    await render([lucide, fontAwesome]);
    await settle();
    await act(async () => moreButton().click());
    await settle();

    expect(searchAssets.mock.calls[1]?.[0]).toMatchObject({
      enabled: ["lucide"],
      cursors: { lucide: "L1" },
    });
    expect(rowIds()).toEqual(["lucide:a", "fontawesome-free:b", "lucide:c"]);
  });

  it("names the host once, on the first search only", async () => {
    searchAssets.mockResolvedValue({
      pages: [page("unsplash", [result("unsplash:one")])],
    });

    await render([unsplash]);
    await settle();

    expect(
      document.querySelector("[data-yunari-asset-host-notice]")?.textContent,
    ).toContain("api.unsplash.com");

    await type("x");
    await settle();

    expect(
      document.querySelector("[data-yunari-asset-host-notice]"),
    ).toBeNull();
  });

  it("discards a source disabled mid-flight", async () => {
    const late = deferred<AssetSearchAnswer>();

    await render([lucide, fontAwesome]);
    await settle();

    searchAssets.mockReturnValueOnce(late.promise);
    await type("a");
    await settle();

    const chip = document.querySelector<HTMLButtonElement>(
      '[data-yunari-asset-chip="fontawesome-free"]',
    );
    if (chip === null) throw new Error("no chip.");
    await act(async () => chip.click());

    await act(async () => {
      void late.resolve({
        pages: [
          page("lucide", [result("lucide:a")]),
          page("fontawesome-free", [result("fontawesome-free:x")]),
        ],
      });
      await Promise.resolve();
    });

    expect(rowIds()).not.toContain("fontawesome-free:x");
  });
});

describe("AssetFinder footer", () => {
  it("names the action the active category offers, never a bare Import", async () => {
    await render([lucide, unsplash]);
    await settle();

    expect(footerAction().textContent).toBe(uiCopy.assets.action.icon);
    expect(footerAction().textContent).not.toBe("Import");

    await act(async () => tab("image").click());
    await settle();

    expect(footerAction().textContent).toBe(uiCopy.assets.action.image);
  });
});
