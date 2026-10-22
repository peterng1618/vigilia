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
- Create: `docs/decisions/0077-the-facet-record-lives-in-renderer-core.md`
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
git add src/web/packages/renderer-core/src/theme/facet-record.ts src/web/packages/renderer-core/src/theme/facet-record.test.ts src/web/packages/renderer-core/src/theme/index.ts docs/decisions/0077-the-facet-record-lives-in-renderer-core.md
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

**The tag-proposal case this task used to name is phase G's (R127).** A tag the vocabulary does not know
cannot be proposed in phase A: the format carries no `tags` at all
(`schema/theme-document.schema.json`), and the spec's own phase table
(`2026-10-12-theme-store-design.md:912`) gives **G** "the format's shape rule, the editor's
pick-or-propose control, and the Style facet". The case moved there with the field it needs, rather than
being written against a field invented here.

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

### Task A.7: Import lands in the library, as the host's write

**The spec is this task's authority** — `2026-10-12-theme-store-design.md:761-777`
(R133). It rules where the import happens, the id rule, and that import never
overwrites. The plan's earlier text had the browser compose the write and refuse a
taken id; that is the opposite of the spec's rule and is withdrawn.

**Files:**
- New: `src/web/packages/host/src/themes/import.ts` — the id rule and the two writes
- Modify: `src/web/packages/host/src/server.ts` — the route. **A watched path: its
  decision note lands before the first write.**
- Modify: `src/web/packages/host/src/themes/store.ts` — the write's free-id claim
- Modify: `src/web/packages/editor/src/theme-import.ts`, `editor-main.ts` — the
  browser posts bytes and maps the answer; `THEME_ID_REGEX`'s export reverts
- Test: `src/web/packages/host/src/themes/import.test.ts`, and the editor module's
  own cases

**Interfaces:**
- Consumes: `readThemePackage` (`@yunari/theme-package`), `ThemeStore.write` and
  `isValidThemeId` (`store.ts`), `createThumbnailStore(...).write`.
- Produces: one host route taking package bytes and answering the id the package
  landed under, or the reader's own refusal. The browser's half is a post and a
  mapping, and nothing else.

- [ ] **Step 1: Write the failing tests** — at the module and at the route: a
  package whose `id` is free lands under its own; a package whose `id` is taken
  lands under a suffixed one **and the theme already there is byte-for-byte
  unchanged**; a package whose `id` fails the shape lands under an id derived from
  `metadata.name`; a package carrying a thumbnail has it written; a package
  `readThemePackage` refuses writes nothing and reaches the caller with the
  reader's own reason.
- [ ] **Step 2: Run them to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Re-run them, then the editor's own suite.**
- [ ] **Step 5: Commit.**

**Constraints the spec does not spell out:**
- **The id rule is the host's** (R137): reuse `isValidThemeId` rather than
  importing the editor's regex.
- **The free-id claim and the write are one step** (R136): `ThemeWriteOptions`
  gains `expectFree`. A listing in the browser followed by a save is a window in
  which a theme is replaced — the data loss the spec's rule exists to prevent.
- **The thumbnail is written after the theme**: the thumbnail store addresses it
  through the theme's own folder (`library/<id>/thumbnail.png`) and accepts PNG
  only. A package whose slot is not a PNG is not an error — the library falls back
  to text.
- **No invalidation channel** (R132 stands), and the browser never parses the
  package.

### Task A.7b: The store opens a theme in the editor

**The defect this owns** (R134): `region.tsx`'s `onAction` maps `open` to
`setOpenId(id)`, so the control `uiCopy` labels **"Open in editor"** opens a modal,
and the modal's footer repeats the same inert call. The spec says the *cell* opens
the modal (`:712`, `:1064`), which leaves `open` naming the library operation the
drawing labels. A.7 removes the picker's document route, so until this lands there
is no way into a document at all.

**Files:**
- Modify: `src/web/packages/editor/src/store-mode/gallery.tsx`, `region.tsx`,
  `item-modal.tsx`
- Modify: the editor's document path (`editor-document.ts`, `editor-session.ts`,
  `editor-main.ts`) so a library theme can become the open document
- Modify: `src/web/packages/editor/src/ui-copy.ts`,
  `src/web/packages/editor/src/shortcut-manager/reference.ts` — the File row's word
- Test: the store mode's dom cases, the document's own, and a browser case

**Interfaces:**
- Consumes: `ThemeLibraryClient.open` (existing), the mount path the picker used
  before A.7.
- Produces: the cell's own surface opens the item's modal; the `open` action — from
  the cell and from the modal's footer — loads that library theme as the open
  document; the File row reads **Import package** and imports without touching the
  document.

- [ ] **Step 1: A failing case per half** — the cell's surface opens the modal and
  the `open` control does not; the `open` control loads a theme as the document,
  from the cell and from the footer.
- [ ] **Step 2: Run them to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Re-run them, then the store's and the document's own suites.**
- [ ] **Step 5: Commit.**

**Constraints:**
- **The document bookkeeping moves rather than being deleted.** `File ▸ Open
  package` reaches `EditorDocument.open()`, which asks "Save changes before opening
  another theme?" and calls `#library.forget()` before handing to the picker. In
  front of an *import* both are wrong — nothing is replaced, and forgetting the base
  drops the open document's conflict guard on its next save. In front of opening a
  library theme over the open document both are right, so the bookkeeping belongs to
  this route.
- **The opened theme's base is the library's**, so the next save is gated on the
  document the library holds rather than ungated (R136's other half).
- A.7's editor module is not this task's; the import's own shape is A.7's.

### Task A.7c: The browser suite reaches a document through the store

**Why this is a task** (R135): fourteen files under `tests/e2e/` reach a document
through the package picker — 26 `setInputFiles` sites on
`input[accept=".yunari-theme"]`, plus the `filechooser` route, which is the same
handler and not a second route. A.7 ends that route, so the phase's browser proof
cannot be taken until they are re-pointed.

**Files:**
- New or extended: one helper under `tests/e2e/` that puts a fixture into a stubbed
  library and opens it through the store
- Modify: the fourteen spec files and the two fixtures that drive the picker

**Interfaces:**
- Consumes: the store's `open` action (A.7b), `page.route` against `/api/themes`.
- Produces: every spec that needs a document gets one the same way, and no spec
  reaches a document through the picker.

- [ ] **Step 1: Write the helper and re-point one spec.** Prove it green before
  touching the rest.
- [ ] **Step 2: Re-point the remainder.**
- [ ] **Step 3: Run the affected specs whole, one worker, each run's own JSON
  report.**
- [ ] **Step 4: Commit.**

**Constraints:**
- **The helper seeds the stub library directly and does not import.** A spec about
  glass geometry must not fail because the import broke; the two routes are proved
  separately.
- **The stub is the pattern A.6 established** — `editor-rail.spec.ts:1476-1480`,
  "The editor preview serves no `/api/themes` at all".
- The `Opened <file>.yunari-theme` assertions become the surface's own words; a
  status line the product no longer writes is not an assertion to keep.

### Task A.7d: Opening a library theme shows the editor

**The defect this owns** (issue 48, found by A.7c's sweep and not by A.7b's own
browser case, which asserted the document's id and never the mode). A.7b wired
the store's `open` action to load a document but nothing switches the shell out
of Themes, and `shell-layout.tsx`'s editor body is `hidden={mode !== "editor"}` —
so the mount's `viewport.zoomToFit()` runs against a zero-sized host and writes
nothing, and when the body becomes visible `viewport-manager`'s `resize()` asks
whether the camera is fitted against a canvas the camera was never fitted to,
answers no, and commits the identity transform. Measured: after the store's open
the camera is `[1, 0, 0, 1, 0, 0]` on the desktop project (canvas 712x652) and on
the phone project (canvas 86x771), where the product's own `zoomToFit()` writes
`[0.834375, 0, 0, 0.834375, 89, 125.75]`.

**Two things are wrong and the second is the visible one.** A control labelled
**Open in editor** leaves the author in the store; and the theme it opened
renders at 1:1, which on a phone-sized window puts most of the artboard off an
86px canvas. The first is why the second happens.

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx` — the mode
  state, `requestMode`, the store's `onOpenTheme` handler and
  `refitOnViewportChange`
- Test: a browser case, and the nine cases A.7c left red

**Interfaces:**
- Consumes: `requestMode` and `refitOnViewportChange` (both already in that file),
  `session.openLibraryTheme(id)` (A.7b).
- Produces: opening a library theme puts the shell in Editor mode with the theme
  fitted, on both viewports.

- [ ] **Step 1: A failing browser case** — open a theme from a stubbed store and
  assert the shell is in Editor mode **and** the camera is fitted, on the desktop
  project and on the phone project's 86px canvas.
- [ ] **Step 2: Run it to verify it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: The nine cases A.7c left red must go green**, run whole and one
  worker at a time, each with its own JSON report.
- [ ] **Step 5: Commit.**

**Constraints:**
- **The mode change is not guarded on the way in.** `requestMode` asks the
  dirty-document question only when *leaving* editor; opening a library theme
  already asks it through `ThemeLibraryManager.openById`'s `confirmReplacement()`,
  so the author must not be asked twice.
- **Ruled: the shell enters Editor mode before the document is read**, so the
  mount measures a visible body rather than relying on a later refit. Cost if
  wrong: an open that fails leaves the author in Editor mode with their previous
  document — which is where they came from, with the error reported.
- **`refitOnViewportChange` is the owner of "the canvas's box changed, so
  refit"**, and a mode change changes that box. If the fix needs it there, it goes
  there rather than into a second refit path.
- The nine red cases are this task's **proof**, not its scope: they are not to be
  edited, weakened or skipped, and a case that goes green for a different reason
  than the camera is a finding.

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

**Files** (corrected after the task landed, from its review's finding 3 — see the note
at the end of this task):
- Modify: `src/web/packages/editor/src/store-mode/region.tsx`
- Create: `src/web/packages/editor/src/store-mode/assign-display.tsx`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Test: `src/web/packages/editor/src/store-mode/region.dom.test.tsx`

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

Run: `npx vitest run packages/editor/src/store-mode/region.dom.test.tsx`
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

Run: `npx vitest run packages/editor/src/store-mode/region.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the pathspec form, which never reads the index for other paths (R144 — a
controller commit already swallowed a seat's staged work in this plan):

```bash
git commit -F <msgfile> -- src/web/packages/editor/src/store-mode/region.tsx src/web/packages/editor/src/store-mode/assign-display.tsx src/web/packages/editor/src/ui-copy.ts src/web/packages/editor/src/store-mode/region.dom.test.tsx
```

**What landed, and the three places this task's own text was wrong** (the review's
finding 3; the plan is corrected rather than the work):

- **`gallery.tsx` needed no change.** It already drew all four actions and reported them
  through the one callback, so the missing piece was only where `assign` leads. The
  Files list named it, and the task is the seam rather than the cell.
- **The cases live in `region.dom.test.tsx`, not `gallery.dom.test.tsx`**, because that
  is where the client harness is — the test followed the harness rather than the file
  the plan guessed at, and Step 2's and Step 4's commands now name the right one.
- **`assign-display.tsx` is a new file and `ui-copy.ts` gained the strings**, because
  `region.tsx` reached 698 lines. The Files list named neither.

### Task A.10: `settings.html` stops listing themes

**Files:**
- Modify: `src/web/packages/host/public/settings.html`
- Test: `src/web/tests/e2e/host-settings.spec.ts` (the existing spec covering the
  host's own pages)
- Test: `src/web/packages/host/src/settings-page.dom.test.ts` and
  `src/web/packages/host/src/editor-link.dom.test.ts` — both run this page's own script

**Interfaces:**
- Consumes: nothing.
- Produces: no exported interface.

**The removal is `/settings`'s Themes section, and nothing else (R116, resolving
`vg-633`).** The host's own *Choose a theme* page is the document `library.html`, and it
renders the same list from the same `/settings/theme-list.js`, so `theme-list.js` is
**not touched** and the per-display plan's display column (Task 4.3) and cost note
(Task 4.8) stay on the chooser by construction. `host-settings.spec.ts` is the **only**
spec asserting either of them (`#themes [data-display]`, `.theme-cost-note`), and this
task edits that file — so those cases **move to a chooser case rather than being
deleted**, and the removal must not take the last test of a landed feature with it. The
editor raises no cost warning (A.9).

**The chooser has no `/library` route, and the first draft of this task said it did
(R161).** `library.html` is served by one `serveStatic` inside the display-resolution
branch (`packages/host/src/server.ts:2554-2562`), reached only when the request is for
`/` and the theme resolves to nothing; everything else falls through to the player
bundle, so `/library` is a 404. The chooser is therefore **`/`**, and it is **one-shot
for the caller's own screen**: `displayKeyFor` answers `this-pc` for a loopback browser,
so a write that gives this PC a theme makes the next `/` resolve a theme and serve that
screen's dashboard instead. A case that must stay on the chooser after a write therefore
presses **another display's** row — which leaves the write path for this PC's own screen
asserted nowhere in this file (`vg-653`).

**Removing the section also removes this page's only display selector (R153, filed
`vg-649`).** `selected` (`settings.html:137`) is the display the Questions section answers
for, read as `?display=` at `:248`, and its **only** writer is the `onSelect` callback the
page hands to `themeList` — the display column, which lives inside `themeList`'s own output
and so cannot be kept while the list goes. **Ruled: the Questions section stays, answers for
the default display, and the page says which display it is answering for.** The capability
that costs — answering for a display other than the default on a page with no editor open —
is recorded in `vg-649` for the user rather than decided here.

**The spec's blast radius is wider than "the cases asserting the column and the note".**
All ten cases navigate to `/settings` and seven drive its theme UI through `chooseTheme`
(`host-settings.spec.ts:136-146`), which clicks `#themes [data-display="…"]` on whatever page
is loaded. **Ruled, and carried in this task's brief:** the two cases whose subject is the
list (`:182` the display column, `:477` the cost note) **move to the chooser at `/`**, which
renders the same rows into the same `#themes`; the four that use `chooseTheme` only as a precondition
(`:155`, `:359`, `:457`, `:529`) **set the theme through `PUT /api/themes/active` via the
`request` fixture** and stay on `/settings`; and `:417`, whose subject is the selector itself,
has nowhere to move and is re-pointed to what R153 leaves, with its per-display half resting
on `vg-649`.

- [ ] **Step 1: Write the failing test**

Browser proof: `/settings` renders no theme list, and the chooser at `/` still chooses a
theme and still works in a plain browser with no editor open — **including its display
column, one row per display the host holds, and the cost note on the row of a theme
that carries one.** Plus: `/settings`'s Questions section still answers, for the default
display, and the page says so (R153). A case that must still be the chooser after a
write presses another display's row (R161).

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/host-settings.spec.ts --workers=1` against
rebuilt bundles. Expected: FAIL — the theme list is still rendered.

- [ ] **Step 3: Implement**

**Both pages stay served.** They are the only surfaces a phone, or a browser with
no editor open, can reach, so removing the list is not removing the path. What
leaves is the duplicate listing: the store mode's local tab is where a theme is
listed, opened, activated, exported or removed.

**The list itself is not what is duplicate — the section is.** `/settings` and the
chooser both call `themeList`, and what `/settings` loses is its *Themes* section, heading
included. `theme-list.js` stays as it is: it is the chooser's renderer, and the display
column and cost note on its rows are the chooser's too.

**Two jsdom files read this page and the task's Files list must name them.**
`packages/host/src/settings-page.dom.test.ts` and `packages/host/src/editor-link.dom.test.ts`
both run `settings.html`'s own script, so the removal breaks them and `npm run gate`
chains `npm test` — leaving them red would close the task with the gate red.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx playwright test tests/e2e/host-settings.spec.ts --workers=1`
Expected: PASS, with the rendered page inspected rather than only its element
counts.

- [ ] **Step 5: Commit**

Commit with the pathspec form, which never reads the index for other paths (R144 — a
controller commit already swallowed a seat's staged work in this plan):

```bash
git commit -F <msgfile> -- src/web/packages/host/public/settings.html src/web/tests/e2e/host-settings.spec.ts
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
