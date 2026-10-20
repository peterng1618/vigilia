# Theme store — phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The shell gains its three modes, and the Themes mode's local half is a
searchable gallery of this PC's themes with an item modal — the surface that
answers "the store shows online and local themes together" for the half that
needs no catalogue.

**Architecture:** A fourth mode is a mode, not an iframe: the header's `Segmented`
switches what the content region renders, and the store's region owns its own
tabs, facet row, grid and pager. The facets are **derived** from each theme's
envelope by one function in `renderer-core`, so nothing about a theme is authored
twice. The local half reads items through a kind's own source rather than through
`ThemeStore` directly, which is what makes a second item kind an addition.

**Tech Stack:** React 19, Base UI, Tailwind, Fabric 7.4.0 (imperative, behind the
editor boundary), Vitest, Playwright, Biome. Node 22.12+, npm workspace under
`src/web/`.

**Spec:** `docs/superpowers/specs/2026-10-12-theme-store-design.md` — read it; the
plan implements its **phase A** only. Register row: `vg-388`.

## Global Constraints

- Run every command from `src/web/`. Scripts are `package.json`'s.
- **One plan is active at a time.** This plan was queued behind
  `2026-10-18-per-display-themes.md`, which landed on 2026-10-19
  ([archived](archive/2026-10-18-per-display-themes.md))
  and supplies Task A.9's assign action.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled.
- **Fabric stays imperative behind the editor boundary.** Never mirror a Fabric
  object in React. The store mode renders no canvas at all.
- **`renderer-core` stays Fabric/DOM-free.** The facet record lives there because
  it is the only layer both the host and a catalogue Action can import.
- Persist authored state only. Telemetry, selection and viewport are not persisted;
  a view preference (page size) is, in the shell's `localStorage`.
- DESIGN.md is normative. A surface that needs what it lacks **amends it in the
  same commit** rather than being exempted locally.
- Watched paths needing a decision note before the first write:
  `editor-shell/shell-layout.tsx`, `renderer-core/src/theme/`, `host/src/server.ts`.
  Template: `docs/decisions/README.md`.
- Conventional Commit titles; stage explicit paths; never `git add -A`.
- §2's six sizes each carry their own line-height, and §3's spacing steps are
  4/6/8/10/12/14/16/20/24/32. A drawing or a component that invents a value fails
  the design gate.

## Review Focus

Five inputs and conditions the spec implies and no task's own tests exercise. Each
gets its test in the task named beside it.

1. **A theme whose thumbnail is missing, or is a PNG of an unexpected size** — the
   cell must draw the theme's own ground rather than an empty box, and the grid
   must not reflow. (Task A.5)
2. **A theme that binds nothing** — it must be matched by no sensor selection and
   still reachable under "any", never by a facet that silently treats it as
   matching everything. (Task A.4)
3. **A filter that matches nothing, and a library with nothing in it** — two
   different sentences, because the answers differ, and the second must not tell
   someone with forty themes to go and build one. (Task A.6)
4. **A theme with a `backgroundMedia` ground, and a gradient whose stops average
   into the mid band** — both are `unclassified`, and neither may be guessed into
   light or dark. (Task A.3)
5. **Switching modes with an unsaved document** — the dirty guard must fire
   exactly as it does for any other document replacement, and a switch must not
   read as one. (Task A.1)

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/renderer-core/src/theme/facet-record.ts` (create) | The one derivation: author, colour mode, sensors, shape, from an envelope |
| `packages/editor/src/editor-shell/shell-layout.tsx` (modify) | The header's mode switch and which region each mode renders |
| `packages/editor/src/store-mode/` (create) | The store mode's region: its tabs, facet row, gallery, pager and modal |
| `packages/editor/src/store-mode/local-source.ts` (create) | The local half's item source — one per kind, not `ThemeStore` directly |
| `packages/editor/src/store-mode/facet-row.tsx` (create) | The five facet buttons and their popovers |
| `packages/editor/src/store-mode/gallery.tsx` (create) | The cell, the grid and the two empty states |
| `packages/editor/src/store-mode/pager.tsx` (create) | The numbered pager and the per-page choice |
| `packages/editor/src/store-mode/item-modal.tsx` (create) | The viewer: fixed stage, caption band, pill groups, actions |
| `packages/editor/src/editor-shell/page-size.ts` (create) | The page-size preference, on `palette.ts`'s pattern |
| `packages/editor/src/host-settings-mode/` (create) | This PC: displays, devices, and the theme questions per display |

---

## Phase A — The shell, the local half, and this PC

### Task A.1: The three-mode shell

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/tests/e2e/editor-rail.spec.ts` (the rail's own browser proof)
- Modify: `DESIGN.md` (§5's control, added rather than exempted)
- Create: `docs/decisions/0074-the-header-owns-the-mode-switch.md`
- Test: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`,
  `src/web/tests/e2e/editor-rail.spec.ts` (the existing shell spec)

**Interfaces:**
- Consumes: nothing.
- Produces: `export type ShellMode = "editor" | "themes" | "this-pc"`;
  `ShellLayoutProps` gains `readonly mode: ShellMode` and
  `readonly onModeChange: (mode: ShellMode) => void`.

- [ ] **Step 1: Write the failing test**

```tsx
it("offers the three modes and marks the active one", () => {
  // The header renders one Segmented with Editor, Themes and This PC; the active
  // item carries the chosen treatment and the other two do not.
});

it("does not render a second horizontal bar", () => {
  // The mode switch is inside the header element, and the content region has no
  // sibling bar above it.
});

it("asks the dirty guard before it leaves a dirty document", () => {
  // onModeChange("themes") with a dirty document calls the guard, and the mode
  // does not change until it answers.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/shell-layout.dom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

The switch is §5's `Segmented`, and the labels are the user's own words for the
three surfaces — the spec records `Editor · Themes · This PC` as the proposal and
names this as needing the user's word, so **confirm the three labels with the user
before this task is dispatched.** The chosen item takes the shared chosen
treatment (raised background, `--text`), never an accent fill: §4 allows one
accent-filled element per region and the editor's own is already spent.

**§7.1 is amended in this commit** — the header gains the mode switch and its
action region becomes per-mode, which is what §7.1 asks for when a surface needs
what it does not have. The decision note claims `shell-layout.tsx` and records all
seven reuse-gate rungs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/editor/src/editor-shell/shell-layout.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/shell-layout.tsx src/web/packages/editor/src/editor-shell/editor-shell.css src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx src/web/tests/e2e/editor-rail.spec.ts docs/decisions/0074-the-header-owns-the-mode-switch.md DESIGN.md
git commit -m "feat(shell): switch between the editor, the themes mode and this PC"
```

### Task A.2: The store mode's region

**Files:**
- Create: `src/web/packages/editor/src/store-mode/region.tsx`
- Create: `src/web/packages/editor/src/store-mode/facet-row.tsx` (this task's own case tests it)
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Modify: `DESIGN.md` (§5's checkbox choice row, added rather than exempted)
- Test: `src/web/packages/editor/src/store-mode/region.dom.test.tsx`

**Interfaces:**
- Consumes: `ShellMode` (Task A.1).
- Produces: `export function StoreModeRegion(props: { readonly mode: ShellMode }): ReactElement`
  and `export type StoreTab = "local" | "online"`.

- [ ] **Step 1: Write the failing test**

```tsx
it("shows the two halves as a Segmented inside the region's own header row", () => {
  // Both halves are named; the region has no bar of its own above its header row.
});

it("keeps the facet row on one line and wraps rather than dropping a control", () => {
  // At a narrow width every facet button is still rendered.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/editor/src/store-mode/region.dom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

The region renders its own header row: the two halves as a `Segmented`, the search
well, the facet row and the sort well. The half is **not** a shell mode and not a
second bar — it is a region's control over what the region lists.

**§5 gains one control in this commit**: a checkbox choice row, which the facet
popover is made of. Rule 7 describes a radio group, and a set that large is not
one — so the control is added to DESIGN.md rather than exempted locally. Everything
else here is composition: the facet button is the well idiom with a chevron and a
count, the per-page choice is a well, and the pager is §5's icon button whose glyph
is a numeral.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/editor/src/store-mode/region.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/store-mode/region.tsx src/web/packages/editor/src/store-mode/facet-row.tsx src/web/packages/editor/src/store-mode/region.dom.test.tsx src/web/packages/editor/src/editor-shell/shell-layout.tsx DESIGN.md
git commit -m "feat(store): add the store mode's region, its halves and its facet row"
```

### Task A.3: The facet record

**Files:**
- Create: `src/web/packages/renderer-core/src/theme/facet-record.ts`
- Create: `src/web/packages/renderer-core/src/theme/facet-record.test.ts`
- Create: `docs/decisions/0075-the-facet-record-lives-in-renderer-core.md`
- Modify: `src/web/packages/renderer-core/src/theme/index.ts` (or the package's
  public barrel — check which file re-exports `document.ts`)

**Interfaces:**
- Consumes: `describeSemanticKey` (existing, `renderer-core`),
  `FabricThemeEnvelope`, `PalettePaint`.
- Produces:

```ts
export type ColourMode = "light" | "dark" | "unclassified";
export type Orientation = "landscape" | "portrait" | "square";
export type AspectBucket = "1:1" | "4:3" | "3:2" | "16:10" | "16:9" | "21:9" | "32:9" | "other";

export interface FacetRecord {
  readonly author: string | undefined;
  readonly colourMode: ColourMode;
  readonly sensors: readonly { readonly key: string; readonly label: string; readonly family: string | undefined }[];
  readonly orientation: Orientation;
  readonly aspect: AspectBucket;
  readonly width: number;
  readonly height: number;
}

export function facetRecordOf(envelope: FabricThemeEnvelope): FacetRecord;
```

- [ ] **Step 1: Write the failing test**

```ts
it("reads a solid ground's own relative luminance", () => {
  // #000000 -> dark, #ffffff -> light.
});

it("averages a gradient's stops", () => {
  // Two stops that average dark -> dark; two that straddle the mid band -> unclassified.
});

it("never guesses when there is media behind it", () => {
  // artboard.backgroundMedia present -> unclassified whatever the paint says.
});

it("groups the sensors a theme binds, labelled by the descriptor", () => {
  // cpu.load and gpu.load -> two entries with their own labels and families;
  // a key the vocabulary does not know is still listed, labelled by its key.
});

it("calls 1000x1001 landscape, not square", () => {
  // Orientation is exact equality; square is width === height.
});

it("buckets the ratio in log space and answers other past the tolerance", () => {
  // 1920x1080 -> "16:9"; 1000x999 -> "other" rather than the nearest wrong bucket.
});

it("matches no sensor for a theme that binds nothing", () => {
  // An empty bindings map -> sensors is empty, and the facet matches no selection.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/renderer-core/src/theme/facet-record.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Nothing here is authored and nothing is stored in `theme.json`: the record is
derived on read, by the host for a library theme and by a catalogue Action for a
merged one. The two open questions the spec records — the shipped seed vocabulary
and the aspect-ratio bucket set with its tolerance — are **inputs to this task**,
so the bucket table and its tolerance are the ones the spec settles before this is
dispatched. The decision note claims `renderer-core/src/theme/` and records all
seven rungs, including that no existing helper already does this.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/renderer-core/src/theme/facet-record.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/renderer-core/src/theme/facet-record.ts src/web/packages/renderer-core/src/theme/facet-record.test.ts src/web/packages/renderer-core/src/theme/index.ts docs/decisions/0075-the-facet-record-lives-in-renderer-core.md
git commit -m "feat(renderer-core): derive a theme's facets from its envelope"
```

### Task A.4: The local item source, and the gallery

**Files:**
- Create: `src/web/packages/editor/src/store-mode/local-source.ts`
- Create: `src/web/packages/editor/src/store-mode/gallery.tsx`
- Create: `src/web/packages/editor/src/store-mode/gallery.dom.test.tsx`
- Test: `src/web/packages/editor/src/store-mode/local-source.test.ts`

**Interfaces:**
- Consumes: `FacetRecord`, `facetRecordOf` (Task A.3); `ThemeLibraryClient` (existing).
- Produces:

```ts
export interface StoreItem {
  readonly id: string;
  readonly kind: string;        // the wire value, e.g. "dashboard-theme"
  readonly name: string;
  readonly author: string | undefined;
  readonly updatedAt: string | undefined;
  readonly thumbnailUrl: string | undefined;
  readonly facets: FacetRecord;
}
export interface ItemSource {
  readonly kind: string;
  list(): Promise<readonly StoreItem[]>;
}
export function localThemeSource(client: ThemeLibraryClient): ItemSource;
export function Gallery(props: { readonly items: readonly StoreItem[]; readonly onOpen: (id: string) => void }): ReactElement;
```

- [ ] **Step 1: Write the failing test**

```ts
// local-source.test.ts
it("labels every item with the kind it is", async () => {
  // Every item from localThemeSource carries kind "dashboard-theme" — the wire
  // value, not a display word.
});
it("derives each item's facets from its envelope", async () => {
  // A stored theme with cpu.load and a 1920x1080 artboard arrives with those facets.
});

// gallery.dom.test.tsx
it("draws the theme's own ground when it has no thumbnail", () => {
  // No thumbnailUrl -> the cell's picture box is filled from the artboard, not empty.
});
it("narrows by a facet, and matches nothing for a theme that binds nothing", () => {
  // A sensor selection leaves that theme out; "any" keeps it in.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/editor/src/store-mode/local-source.test.ts packages/editor/src/store-mode/gallery.dom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

**The local half reads through an `ItemSource`, not through `ThemeStore`.** That
one hop is the whole cost of the kind ruling: a second kind is a second source
rather than a rewrite of this tab. `ThemeLibraryClient` gains nothing here — the
source wraps it.

The cell is the drawing's cell exactly: the picture at `aspect-ratio: 2/1` with
`object-fit: cover`, the name, the author in mono (or *No author*), and a 26px
facts band carrying the origin badge on the left and the four actions on the
right. The grid is `repeat(auto-fill, minmax(272px, 1fr))` and the minimum is
**272px, derived from the online half's busiest facts band** — not a number chosen
for this half.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/editor/src/store-mode/local-source.test.ts packages/editor/src/store-mode/gallery.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/store-mode/local-source.ts src/web/packages/editor/src/store-mode/local-source.test.ts src/web/packages/editor/src/store-mode/gallery.tsx src/web/packages/editor/src/store-mode/gallery.dom.test.tsx
git commit -m "feat(store): list this PC's themes as a gallery, through a kind's own source"
```

### Task A.5: Paging

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/page-size.ts`
- Create: `src/web/packages/editor/src/store-mode/pager.tsx`
- Test: `src/web/packages/editor/src/store-mode/pager.dom.test.tsx`
- Test: `src/web/packages/editor/src/editor-shell/page-size.test.ts`,
  `src/web/packages/editor/src/store-mode/pager.dom.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export type PageSize = 12 | 24 | 48 | "all";
export interface PageSizePreference { read(): PageSize; write(size: PageSize): void; clear(): void }
export function createPageSizePreference(storage?: Storage): PageSizePreference;
export function pageNumbers(current: number, total: number): readonly (number | "gap")[];
export function Pager(props: { readonly current: number; readonly total: number; readonly size: PageSize; readonly onPage: (page: number) => void; readonly onSize: (size: PageSize) => void }): ReactElement;
```

- [ ] **Step 1: Write the failing test**

```ts
// pager.dom.test.tsx
it("shows the five pages nearest the current one", () => {
  expect(pageNumbers(6, 12)).toEqual([1, "gap", 4, 5, 6, 7, 8, "gap", 12]);
});
it("shows every page when there are seven or fewer", () => {
  expect(pageNumbers(2, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
});
it("marks the current page with the chosen treatment and no accent fill", () => {
  // The current numeral is --text on a raised background.
});

// page-size.test.ts
it("remembers the size and forgets nothing else", () => {
  // write(24) then a new preference over the same storage reads 24; the key is
  // namespaced, and read() answers 12 for a missing or corrupt value.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/editor/src/store-mode/pager.dom.test.tsx packages/editor/src/editor-shell/page-size.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`pageNumbers` is pure and total: it never returns a duplicate, never omits the
first or the last, and never returns a `gap` adjacent to a number it stands for.
The page-size preference follows `editor-shell/palette.ts`'s namespaced-key
read/write/clear trio, and an unreadable value is the default rather than a throw.
**Changing a filter returns to page one**, which lives where the filter is applied
(Task A.6) rather than in the pager.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/editor/src/store-mode/pager.dom.test.tsx packages/editor/src/editor-shell/page-size.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/page-size.ts src/web/packages/editor/src/editor-shell/page-size.test.ts src/web/packages/editor/src/store-mode/pager.tsx src/web/packages/editor/src/store-mode/pager.dom.test.tsx
git commit -m "feat(store): page the gallery with a numbered pager"
```

### Task A.6: The item's own surface

**Files:**
- Create: `src/web/packages/editor/src/store-mode/item-modal.tsx`
- Create: `src/web/packages/editor/src/store-mode/item-modal.dom.test.tsx`
- Modify: `src/web/packages/editor/src/store-mode/region.tsx`

**Interfaces:**
- Consumes: `StoreItem` (Task A.4), `pageNumbers` and the filter state (Task A.5).
- Produces: `export function ItemModal(props: { readonly item: StoreItem; readonly onClose: () => void }): ReactElement`.

- [ ] **Step 1: Write the failing test**

```tsx
it("contains the theme in a fixed stage rather than sizing to its ratio", () => {
  // Two items of different ratios render a stage of the same height.
});

it("says a tag the vocabulary does not know is proposed", () => {
  // A tag outside the known set carries its own mark on its own pill.
});

it("offers the two different empty states, and not the same one twice", () => {
  // An empty library and an empty filter result are different sentences.
});

it("closes back onto the same page, filter and sort", () => {
  // Opening and closing leaves the page number and both wells unchanged.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/editor/src/store-mode/item-modal.dom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

§ "Elevation & Depth" level 3, as the settings modal is: radius 8, `0 24px 60px`
over the scrim, §3's dialog padding. **960px wide against the settings modal's
560.** The stage is one height for every item and the picture is contained in it,
letterboxed against a ground darker than the modal — sizing the stage to the item
would make the modal change height as a person steps between items. The facts are
**pills in three groups** under §2's eyebrow — Reads, Shape, Style — not a row per
fact. There is **no title bar**: the name, the author, the kind badge, the version
and the change date are one caption line, and the close control floats over the
stage's corner. The actions are written in words.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/editor/src/store-mode/item-modal.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/store-mode/item-modal.tsx src/web/packages/editor/src/store-mode/item-modal.dom.test.tsx src/web/packages/editor/src/store-mode/region.tsx
git commit -m "feat(store): open an item as a viewer with pills, not rows"
```

### Task A.7: Import lands in the library

**Files:**
- Modify: `src/web/packages/editor/src/editor-main.ts`
- Test: `src/web/packages/editor/src/editor-main.test.ts` (or the existing spec
  that covers the picker — check before creating one)

**Interfaces:**
- Consumes: `parseThemePackage` (existing), `ThemeLibraryClient.save` (existing).
- Produces: the picker's handler writes to the library and refreshes the local
  half, instead of opening the package as a document.

- [ ] **Step 1: Write the failing test**

```ts
it("writes an imported package into the library and leaves the document alone", async () => {
  // Choosing a package saves it, the open document is unchanged, and the library
  // list then holds it.
});
it("does not open the imported package as a document", async () => {
  // The open document's id is the same before and after.
});
it("reports a package the validator refuses, and changes nothing", async () => {
  // A §141 refusal reaches the caller with its reason and the library is unchanged.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/editor/src/editor-main.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Today the picker makes the package an open *document* which reaches the library
only if the author then saves it. The import becomes a library write, so an
imported theme survives the editor closing and appears in the local list. The id
the write uses is derived, never taken from the package's own metadata unchecked —
`THEME_ID_REGEX` is the owner of that shape.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/editor/src/editor-main.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-main.ts src/web/packages/editor/src/editor-main.test.ts
git commit -m "feat(store): an imported package lands in the library"
```

### Task A.8: This PC as a mode

**Files:**
- Create: `src/web/packages/editor/src/host-settings-mode/region.tsx`
- Create: `src/web/packages/editor/src/host-settings-mode/region.dom.test.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Modify: `src/web/packages/host/src/server.ts`

**Interfaces:**
- Consumes: `ThemeLibraryClient.assign`, `listDisplays` (the per-display plan's
  Task 4.4 — **do not re-implement them here**), `requiredDeviceGroups` (existing).
- Produces: `export function HostSettingsRegion(): ReactElement` — the displays and
  the theme each shows, the device groups and their names, the display settings,
  and one theme's unanswered question.

- [ ] **Step 1: Write the failing test**

```tsx
it("asks only the questions the theme on that display raises", () => {
  // A theme binding only cpu.load offers no GPU row for that display.
});
it("names each display, and the default for the ones with none", () => {
  // Every display the route answers is listed, the default among them.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/editor/src/host-settings-mode/region.dom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

The mode absorbs `settings.html`'s Themes section and `library.html`'s activate
job, which the store mode's local tab now owns — so this region shows **which theme
each display has** and does not choose it. The four sections are rebuilt in the
shell's own React, not an iframe over the host's page. `host/src/server.ts` is
touched only if a route needs a read it does not have; if it is, its decision note
must claim it first.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/editor/src/host-settings-mode/region.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/host-settings-mode/region.tsx src/web/packages/editor/src/host-settings-mode/region.dom.test.tsx src/web/packages/editor/src/editor-shell/shell-layout.tsx src/web/packages/host/src/server.ts
git commit -m "feat(shell): show this PC as a mode of its own"
```

### Task A.9: Assign a theme to a display from its cell

**Files:**
- Modify: `src/web/packages/editor/src/store-mode/gallery.tsx`
- Modify: `src/web/packages/editor/src/store-mode/region.tsx`
- Test: `src/web/packages/editor/src/store-mode/gallery.dom.test.tsx`

**Interfaces:**
- Consumes: `ThemeLibraryClient.assign`, `listDisplays` (the per-display plan's
  Task 4.4).
- Produces: the cell's third action opens a display choice and calls `assign`.

- [ ] **Step 1: Write the failing test**

```tsx
it("assigns to the display that was chosen and to no other", () => {
  // Choosing Kitchen tablet calls assign("kitchen-tablet", <this theme's id>).
});
it("offers the default as one of the choices", () => {
  // The default is selectable, and assign("default", id) is what it calls.
});
it("reports the host's refusal in the host's own words", () => {
  // A rejected assign surfaces the message the host sent.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/editor/src/store-mode/gallery.dom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

The choice is §5's control for a small exclusive set, and it is populated from
`listDisplays` — never from a list this surface keeps. A display the host does not
answer is not offered, because an assignment to a display that does not exist is a
404 the person would read as a bug in the gallery.

**`listDisplays` answers `{ default, displays }`, and the default is its own field
rather than a row** — the route puts it there (`server.ts:894-908`), and the choice
offers it alongside the displays. **And the editor is a loopback surface:** for a
non-loopback caller the route ignores the body's `display` and writes the caller's own
key (`server.ts:1868-1881`), so `assign("kitchen-tablet", …)` from a remote editor would
silently target the caller's own display. Nothing in this plan runs the editor off
loopback; if that changes, the choice must not be offered there.

**The cost warning is not here.** The user narrowed it to the host's own pages on
2026-10-18 (*"the warning only needs to appear on the host, when the user assign a theme
to a device"*), so the per-display plan's Task 4.8 owns it and this surface raises
nothing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/editor/src/store-mode/gallery.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/store-mode/gallery.tsx src/web/packages/editor/src/store-mode/gallery.dom.test.tsx src/web/packages/editor/src/store-mode/region.tsx
git commit -m "feat(store): assign a theme to a display from its cell"
```

### Task A.10: `settings.html` stops listing themes

**Files:**
- Modify: `src/web/packages/host/public/settings.html`
- Test: `src/web/tests/e2e/host-settings.spec.ts` (the existing spec covering the
  host's own pages)

**Interfaces:**
- Consumes: nothing.
- Produces: no exported interface.

**The removal is `/settings`'s Themes section, and nothing else (R116, resolving
`vg-633`).** `/library` is the host's own *Choose a theme* page and it renders the same
list from the same `/settings/theme-list.js`, so `theme-list.js` is **not touched** and
the per-display plan's display column (Task 4.3) and cost note (Task 4.8) stay on
`/library` by construction. `host-settings.spec.ts` is the **only** spec asserting either
of them (`#themes [data-display]`, `.theme-cost-note`), and this task edits that file —
so those cases **move to a `/library` case rather than being deleted**, and the removal
must not take the last test of a landed feature with it. The editor raises no cost
warning (A.9).

- [ ] **Step 1: Write the failing test**

Browser proof: `/settings` renders no theme list, and `/library` still chooses a
theme and still works in a plain browser with no editor open — **including its display
column, one row per display the host holds, and the cost note on the row of a theme
that carries one.**

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/host-settings.spec.ts --workers=1` against
rebuilt bundles. Expected: FAIL — the theme list is still rendered.

- [ ] **Step 3: Implement**

**Both pages stay served.** They are the only surfaces a phone, or a browser with
no editor open, can reach, so removing the list is not removing the path. What
leaves is the duplicate listing: the store mode's local tab is where a theme is
listed, opened, activated, exported or removed.

**The list itself is not what is duplicate — the section is.** `/settings` and `/library`
both call `themeList`, and what `/settings` loses is its *Themes* section, heading
included. `theme-list.js` stays as it is: it is `/library`'s renderer, and the display
column and cost note on its rows are `/library`'s too.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx playwright test tests/e2e/host-settings.spec.ts --workers=1`
Expected: PASS, with the rendered page inspected rather than only its element
counts.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/public/settings.html src/web/tests/e2e/host-settings.spec.ts
git commit -m "feat(host): one surface lists themes, and the host pages keep working"
```

---

## Plan boundary

```bash
cd src/web && npm run gate; echo "GATE EXIT=$?"
```

Then the browser proof this phase's acceptance names: the grid at 1280×720,
1440×900 and 200% zoom with every facet still reachable, an imported package
appearing in the list and surviving a restart, an assignment reaching a display,
and a mode switch with an unsaved document losing nothing. Bundles rebuilt after
any source change, one worker, each run's own JSON report. Report the gate's exit
code and the browser results as two separate facts.

## What this plan does not cover

The spec's phases **B** (the origin record), **C** (the online half), **D**
(install), **E** (submission), **F** (the media normalizer) and **G** (the
style-tag field) each get their own plan, in that order with **G before C**. They
are separate plans rather than phases of this one because each is its own
subsystem: C needs a catalogue repo and an Action, D needs the hosting decision,
E is an OAuth device flow, and F is media tooling. None of them is started by this
plan, and nothing here may be written as though the catalogue existed.
