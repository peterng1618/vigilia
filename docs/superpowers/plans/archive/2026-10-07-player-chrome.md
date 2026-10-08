# Player chrome — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nothing the display says about itself is drawn over the artboard. The two strips a
reader is told something by take their room *from* the artboard — which is the whole of the
Sequencing row's sentence, "diagnostics stop eating the phone's best pixels" (`:474`).

**Architecture:** One owner for the display's own chrome, and one layout. Today four strips
(`showAvailabilityNotice`, `showCropNotice`, `showConnectionState`, `showScaffoldBanner`, all
in `packages/player/src/main.ts`) each position themselves with `position:fixed` and are
appended to `document.body`; the artboard host is `position:absolute; inset:0` underneath all
of them. `packages/player/index.html` becomes a three-row column instead — a top band, the
artboard host, a bottom band — so a strip is *in flow* and the renderer's viewport is what is
left. The bands carry no arithmetic: the browser lays the column out, and the `ResizeObserver`
`main.ts:253`/`:377` already observes the artboard host, so the scene refits to the smaller box
through the path it already has. A new module `packages/player/src/chrome.ts` owns the bands
and the four strips; nothing else in the player is repositioned, and `renderer-core` and
`scene-fabric` are not touched at all.

**Tech Stack:** TypeScript, the DOM, and CSS the platform already has — flex column, `env()`.
No new dependency, no new primitive, no interactive control. Vitest + jsdom for the strip
contract (`// @vitest-environment jsdom`, `packages/player/src/chrome.dom.test.ts`), Playwright
against built bundles for the geometry, which is what the requirement is actually about.

**Spec:** [`../specs/2026-10-03-dashboard-authoring-design.md`](../specs/2026-10-03-dashboard-authoring-design.md)
— plan 8 of 9. **Read the Sequencing table (`:459-480`), the Invariants (`:482-496`), the
Non-goals (`:498-504`) and the Acceptance list (`:506-543`) before the first task**, because
they are the only text that bounds this plan: plan 8 has no section of its own. The nearest
prose is `:176-182`, about the crop notice staying honest, and that work has landed (the
`vigiliaBleeds` mark, `host-bleed.spec.ts`). This plan changes no copy and no counting.

---

## What is already true — measured, not read

> **Corrected 2026-10-08 after Task 1.2: the four strip writers this section cites inside `main.ts` now live in `chrome.ts`.** Task 1.2 moved them and retired `topNotices()` (`bd6e1e29`), so `main.ts` is **524** lines rather than 658 and every citation below in the range `main.ts:496-656` names a line that no longer exists. **The measurements stand — the code they were taken against moved**, and the writers' new home is `chrome.ts`.
>
> **Everything under `main.ts:400` is unaffected**, because the deleted region was contiguous and at the end: `showLoadFailure`'s two call sites are still `:89`/`:104`, `FIXTURE_THEME_IDS` is still `:59`, the availability cadence is still `:220-222`/`:356`, the artboard-host contract is still `:55-57`, and both `ResizeObserver`s still `observe(host)` at `:253`/`:377` — each re-derivable and each checked. The one exception above that line is the diagnostics handle, corrected in place below: `exposeForDiagnostics` is now `main.ts:517`.

Verified on 2026-10-07 by driving the built player in Chromium from this repo (below, *How the
numbers were taken*), against the preview bundle on `packages/player/dist` (built 22:37, newer
than `main.ts` at 22:25) and against the real host on its own port. **A task that rebuilds any
of this has misread the plan.**

1. **Four strips, and one of the four the requirement names does not exist.**
   - the **crop notice** — `main.ts:551-574`, `#vigilia-crop`, `data-vigilia-crop`, top;
   - the **availability notice** — `main.ts:496-519`, `#vigilia-availability`,
     `data-vigilia-availability`, top;
   - the **connection banner** — `main.ts:616-648`, `#vigilia-connection`, bottom;
   - the **scaffold banner** — `main.ts:577-584`, bottom, **and it carries no `id` and no
     data attribute at all**, so no test can address it. It is the synthetic-data disclosure,
     and it appears on every fixture theme because every fixture runs the fake source.
   - **There is no glass-error notice.** `reportGlassError` (`main.ts:116-118`) is a
     `console.warn`, by a decision its own comment states ("The player has no user-visible
     diagnostic surface"). It costs **zero** pixels, and this plan does not give it any. The
     same is true of `reportRepaintError` (`:122-124`) and `reportFontError` (`:131-133`).
2. **The two strips that are stacked are stacked by hand, in one column.**
   `topNotices()` (`main.ts:529-540`) builds `#vigilia-notices`,
   `position:fixed;left:0;right:0;top:0;z-index:9;display:flex;flex-direction:column`, and the
   comment states the reason it is a column rather than two fixed strips: §97 wants a data gap
   and a composition gap to look different, not to hide one another. **`#vigilia-notices` is
   referenced by nothing but `main.ts:530`** — no test, no doc (grepped, whole repo).
3. **The artboard is contained with letterbox bars, and its fit is `renderer-core`'s.**
   `computeArtboardTransform` (`renderer-core/src/artboard.ts:46-117`) returns `scale`,
   `offsetX/Y`, `bars` and `crop` for a given *viewport size*; `scene.ts:113-156` reads that
   viewport from `host.clientWidth/clientHeight` and applies one uniform transform (§51).
   `contentFit` is `contain` for the starter's fixtures and **`cover` is reachable** — the
   `portrait-cover` fixture declares it and fills-and-crops (measured below).
4. **The letterbox is why the defect is a landscape defect, and this is the number that
   matters.** The strips are pinned to the *viewport's* top and bottom edges. When the
   artboard's aspect is wider than the viewport's, the bars are on the **sides**: the artboard
   fills the full height and the strips land on top of it. When the artboard is taller than the
   viewport, the bars are on the **top and bottom** and the strips land harmlessly on black.
5. **Measured, fixture `?theme=stress` (artboard 1024×768, `contain`), preview bundle:**

   | viewport | artboard rect in the viewport | top strip (crop) | bottom strip (scaffold) |
   |---|---|---|---|
   | **390×844** portrait | scale 0.380859375, x 0–390, **y 275.75–568.25** (292.5 tall) | h **45.6** at y 0 — over the top bar, **0 artboard px** | h **45.6** at y 798.4 — over the bottom bar, **0 artboard px** |
   | **844×390** landscape | scale 0.5078125, x 162–682 (520 wide), **y 0–390 (the full height)** | h **28.8** at y 0 — **over the artboard's top 28.8px, 7.4% of its height** | h **28.8** at y 361.2 — **over the artboard's bottom 28.8px, 7.4%** |

   Both strips together in landscape cover **57.6 of the artboard's 390px — 14.8%** of the
   authored composition, and it is the top and bottom edges, which is where a panel's title bar
   and its last row live.
6. **Measured, real host, theme `e2e-missing-sensor` (artboard 640×360, `contain`):**

   | viewport | artboard rect | the availability strip |
   |---|---|---|
   | 390×844 | scale 0.609375, y 312.3–531.7 (219.4 tall) | h **62.4** (3 wrapped lines) at y 0 — over the top bar, **0 artboard px** |
   | 844×390 | scale 1.0833333, x 75.3–768.7 (693.3 wide), y 0–390 | h **45.6** (2 lines) at y 0 — **over the artboard's top 45.6px, 11.7% of its height** |

   The connection banner measures 45.6 (2 lines) at 390×844 and 28.8 (1 line) at 844×390, in
   both cases wholly inside the viewport's bottom edge. The strip height is
   `6 + 6 + lines × (12 × 1.4)`: **28.8px for one line, 45.6 for two, 62.4 for three** — every
   number above is that formula, so the arithmetic and the measurement agree.
7. **A display with nothing to say adds nothing to the page today, and that is the baseline
   this plan must preserve.** Measured on the real host at `?theme=e2e-hosted` (a clock binding,
   a healthy stream) at both viewports: **`document.body` has exactly one child, `#artboard`**,
   and the host's rect is the whole viewport (390×844 and 844×390). The connection banner is
   drawn at mount and removed when the stream goes live (`main.ts:363`, `:624-627`), so the
   first seconds of any display are *not* quiet.
8. **A display that fills the viewport is not enough to hide a strip.** `?theme=stress` at
   **1040×780** — the artboard's own aspect — has `bars: {x: 0, y: 0}`, the artboard occupies
   the whole viewport, and the crop strip covers its top 28.8px of 780 (**3.7%**, full width).
9. **`cover` fills and crops, and its strips have no bar to hide in either.** Measured
   `?theme=portrait-cover` at 844×390: scale 1.9181818, `offsetY -721.89`, `bars {0,0}`,
   `crop.y 376.34` — the artboard is 1964.2px wide against an 844px viewport and is cut top and
   bottom. The scaffold banner (fixture) or the connection banner (`&data=live`) still draws a
   28.8px strip across the top of those authored pixels. **No crop notice is raised for this
   theme**, which is correct: the artboard is cropped, not the content outside it.
10. **The load-failure page is mounted *in* the artboard host.** `showLoadFailure(host, error)`
    (`load-failure.ts:17-25`) does `host.replaceChildren(view)`, and the page's own style is
    `position:absolute; inset:0` (`:104-122`) — it is the whole display only because the host
    it is put into happens to be `inset:0` itself. Its jsdom test mounts it on `document.body`
    directly (`load-failure.dom.test.ts:11`), which is the shape it must keep.
11. **The size gate has room.** `npm run size -w @vigilia/player` reports **295.7 KB gzip of a
    400 KB budget** (CSS 0.0 of 40). This plan moves code between files in one bundle and adds
    one CSS rule.
12. **`#vigilia-crop` and `#vigilia-connection` are the selectors the browser suite already
    reads**, and they are the contract this plan must not break:
    `host-bleed.spec.ts:31` (`[data-vigilia-crop]`), `host-player.spec.ts:442, :456, :515,
    :767, :837, :957, :983, :1192-1205, :1434` (`#vigilia-connection`).
13. **`player/src` has no owner row for its chrome.** `docs/architecture/ownership.md` carries
    two player concepts (the rows beside `player/src/theme-loader.ts`), both about preferences.
    The document's own *Known ownership gaps* section names "stale-reading visual treatment
    under Fabric" — adjacent, not this. Nothing owns where a notice goes.
14. **Two handles the plan cites are stale or missing, found by grepping rather than assuming.**
    `packages/player/index.html:5-9` cites **`§151`**, and `§151` exists nowhere in
    `docs/product/requirements.md` — the marker is not a requirement. And `main.ts` is **658
    lines**, past the 500-line signal; this plan moves roughly 90 of them out.

### How the numbers were taken

Reproducible, and worth re-running before the first task if anything looks wrong:

```bash
cd src/web
npx vite preview packages/player --port 4199 --strictPort --host 127.0.0.1   # background
node packages/host/bin/vigilia.js --no-browser --port 4188 \
  --app-dir <the gitignored src/web/.e2e-host-app>                            # background
# then drive each URL with Playwright at 390x844 and 844x390 and read
# `getBoundingClientRect()` per body child plus `window.vigilia.handle.transform()`.
```

The `e2e-*` themes in `.e2e-host-app` are seeded by `tests/e2e/global-setup.ts`
(`seedHostTheme()` in `host-theme.ts:706`); `e2e-missing-sensor` binds one key no provider on
this PC reports, which is what raises the availability strip, and `e2e-hosted` binds a clock,
which raises nothing. **`window.vigilia.handle.transform()` is a diagnostics handle
(`main.ts:517`, `exposeForDiagnostics`; the method itself is `scene-fabric/src/scene.ts:166`) and
is legitimate to read in a test** — `host-player.spec.ts` reads the same
object for `batchCount`.

---

## The design

**One column, and the chrome is in it.** `body` is a `flex-direction: column` of three rows: a
top band, the artboard host, a bottom band. A strip appended to a band is in normal flow, so the
artboard host — `flex: 1 1 auto; min-height: 0` — is *what is left*, and the renderer computes
its transform against that smaller box the moment the `ResizeObserver` reports it. Nothing is
measured in JavaScript, nothing is animated, and no strip is ever `position: fixed` again. The
bands are empty elements in `index.html`, so they are **zero tall** on a display with nothing to
say, which is precisely the baseline in *What is already true* 7.

Why this and not the alternatives:

| Rejected | Why |
|---|---|
| **Measure the bands in JS and set `#artboard`'s `top`/`bottom` insets** | Same outcome, more machinery: the browser already computes a flex column's remaining space, and a measured inset has to re-measure on every reflow, on every font load, and on rotation. Rung 3 of the reuse gate: the platform does this. |
| **Reserve a fixed band, always, even when there is nothing to say** | It is stable and it makes the arithmetic trivial, and it costs 28.8–57.6px of a 390px-tall phone **permanently** — the same pixels this plan exists to stop spending, spent while the display is telling the reader nothing. |
| **Shrink the type, or rotate the sentence, so the strip overlaps less** | Reduces the overlap without reaching zero, and 12px monospace is already at the floor for a sentence read at arm's length. It fails the requirement's own word: *stop*. |
| **Pills in a corner, on a tap, dismissed by the reader** | Two things at once, both worse. A pill small enough to sit in a letterbox bar cannot hold a sentence, and a wall-mounted display has no hands. Preview of that question: **Q1** below. |
| **Let the chrome be dismissed, or time out after N seconds** | Hides a *standing* property of the theme (a crop cannot be fixed by looking away) and contradicts §97's "unavailable sensors explain why". It is a product decision, not a design one — **Q1**. |
| **Keep the strips and move the diagnostics to the host's pages** | The host's pages are a different surface a phone does not show. The reader standing in front of the phone is the one who needs to know. Out of scope below. |

Two consequences stated rather than discovered later:

- **The artboard's size now follows the chrome.** On a display where a reading flickers, the
  artboard resizes when the availability strip appears and again when it goes. There is no
  transition (adding one would be §173's decorative motion), and `prefers-reduced-motion` is not
  consulted because nothing moves — the layout changes once per state change. **Q2** owns whether
  that is wanted.
- **The editor's device lens does not preview the chrome.** An author framing a landscape phone
  sees the artboard against the lens; the phone now shows it a little smaller with a band above
  it. The artboard is not distorted and its aspect is not changed, so the lens is still honest
  about *what* the phone shows, and not about *how big* — the same class of gap plan 2 closed
  for the crop. **Q4**.

## Product questions this plan does not settle

A human owns these. The plan implements the stated default and says so at the site; a task
that settles one has overreached.

- **Q1 — may a reader ever dismiss a strip, and may one ever time out?** Default here: **no**
  strip is dismissible and none expires, which is what the product does today. The crop strip is
  a standing property of the theme and only a re-save can change it (`main.ts:542-550` says so);
  the availability strip is this instant's news, and the transport strips describe a connection
  that is either working or not. Whether a *wall* should be able to silence a notice nobody will
  read is the user's call.
- **Q2 — should the artboard's size follow the chrome, or stay steady while the chrome grows
  into the room it reserved?** Default here: **follow**. Steady means always reserving the
  tallest band, and the cost of that is in the rejected table above.
- **Q3 — how much of the phone may the chrome take before something has to give?** Default here:
  no ceiling is enforced, the artboard may shrink to nothing in principle, and the *test* pins
  that a realistic worst case (three wrapped strips at 390px) leaves the artboard more than half
  the viewport. A reader of a 2000-character provider reason can still collapse the artboard.
  Whether the answer is a ceiling on the chrome, a scroll on the band, or a truncated sentence is
  a person's.
- **Q4 — should the editor's device lens preview the chrome?** Default here: **no**, the lens is
  unchanged. It would cost a band in the editor's stage and a second owner for the strip heights.

---

## Global Constraints

Copied from `AGENTS.md`, from the spec and (where it states them) verbatim. Every task's
requirements implicitly include this section.

- **Unit-test pure decisions and contracts; browser-test wiring and visible behaviour.**
  Visible behaviour requires rendered/browser inspection, not only object counts or geometry
  assertions. This plan's subject *is* geometry, which is why the browser tests below are the
  proof and the jsdom tests are only the contract.
- **A new regression test must fail when the fix is disabled before it is trusted.** Every task
  below that adds one says, in its own steps, how it was disabled and what failed. **A
  prescribed break that does not break is a plan defect, not a passing test** — find a break
  that fails, observe it, restore it, and say in your report what the prescribed break actually
  did.
- **Playwright previews built bundles.** Run `npx vite build packages/player` from `src/web/`
  **before** any browser run, and again after reverting a deliberate break. Run Playwright as a
  CLI, always `--workers=1`, and read results **from the JSON report file** — pass
  `--reporter=json` together with `PLAYWRIGHT_JSON_OUTPUT_NAME` under `src/web/test-results/`.
  **`vg-150`: the environment variable is inert without the flag**, because
  `playwright.config.ts:71-74` configures its own json reporter with its own `outputFile` — the
  row cites `:60-65`, which is where that block used to be, so read the config rather than the
  row's line number. Never
  run a spec through a shared MCP browser, and never read a pass/fail summary off stdout.
- **Typecheck by exit code:** `npm run typecheck` from `src/web/`. **Lint is
  `./node_modules/.bin/biome lint ..`** — there is no working `npm run lint` (the script runs
  `biome lint ..` but the constraint is the binary, and **`biome check` is not a gate** and must
  not be used as one). **Formatting is `npm run format:check` and nothing else does it** — its
  path is `..`, so it covers the repository root.
- **500 lines is a signal and 800 is a stop** for a normal source file. `main.ts` is **658**
  today, so this plan must **shrink** it — the strips move out — and `chrome.ts` is new: keep it
  well under 300.
- **`exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on.** An optional property
  is omitted, never passed as `undefined` — `showConnectionState(status, keyCount, detail?)`
  keeps its optional third parameter and is called as `showConnectionState("refused", 0, reason)`
  or with two arguments, never with a conditional `undefined`.
- **One owner per concept.** The counting of objects outside the artboard stays
  `scene-fabric/artboard-crop.ts`'s and `player/src/artboard-crop.ts` keeps supplying only what a
  display says about it; the words stay `player/src/ui-copy.ts`'s; the fit stays
  `renderer-core/src/artboard.ts`'s. **This plan adds no second copy of any of them** and touches
  no file in `renderer-core` or `scene-fabric`.
- **Never fabricate a reading** (§97, and the design's Invariants `:493-495`). Nothing here
  changes what a strip says or when it is raised: a missing or non-`ok` sample stays a gap, on
  the phone as in the editor. The strips' wording and colours are **unchanged**, and the two
  gaps keep the two treatments §97 requires them to keep.
- **The player may use `scene-fabric`, never editor UI/managers or an interactive `Canvas`**;
  `renderer-core` stays Fabric- and DOM-free. `main.ts` and `chrome.ts` are DOM; nothing new
  crosses into `renderer-core`.
- **Persist authored state only.** Every string, attribute and element this plan adds is
  transient display chrome. Nothing written here may reach a theme, a sample, or a saved
  document (§67).
- **The display bundle budget (§47)** stays under the gate: `npm run size -w @vigilia/player`
  (295.7 KB gzip of 400 today; the change is a move within one bundle plus one CSS rule).

---

## Review Focus

The spec is a vision document, and this plan's spec is one line of a Sequencing table: it says
where the pixels may not go, and nothing about the shapes a phone will actually meet. These are
the five inputs most likely to bite a person using this software, most likely first, and **each
one is pinned by a test in the task that owns the code** — the task is named in brackets.

1. **A strip that arrives after the display has already fitted itself.** The availability strip
   is raised from the refresh cadence, not at mount (`main.ts:220-222`, `:356`), so on a real
   display the *first* fit happens with no chrome and a later one arrives into a viewport
   already full of artboard. A person expects the display to make room for what it has to say
   whenever it has to say it, not only in the first second. [Task 2.3 — pinned by a test on the
   real host that reads the artboard's painted box before and after the strip appears, and
   asserts the fit changed and the strip still touches nothing.]
2. **Two or three strips at once on a 390px screen, wrapped.** §97 requires a data gap and a
   composition gap to be legible as different things, which is exactly why they can be on the
   screen together; at 390px one sentence is 3 lines and the pair is ~108px of an 844px phone.
   A person expects the dashboard to still be the thing they are looking at. [Task 2.3 — pinned
   by a test that raises the availability strip and the connection banner together and asserts
   the **host** keeps more than half the viewport, the chrome takes less than half, and the
   artboard is refitted to what is left. **Corrected 2026-10-08: the pin originally said the
   *artboard* keeps more than half, which is unreachable and has nothing to do with the chrome.**
   `e2e-missing-sensor` is 640×360, so at 390×844 `contain` gives a painted height of ~219px —
   **26% of the phone with no chrome at all** — and even the starter's 4:3 artboard reaches only
   292.5px, 34.7%. The letterbox, not the chrome, is what takes the rest. What the requirement
   can be held to is the share the chrome itself costs, and the host's height is that share's
   complement.]
3. **A theme whose artboard is the shape of the viewport.** The starter's artboard is 4:3, so
   *some* phone orientation always has bars — but a 1040×780 display, or any desktop preview,
   has `bars: {x: 0, y: 0}` (measured, 3.7% covered today) and the chrome has no bar to hide in.
   A person expects the same promise to hold where there is nowhere to hide. [Task 2.2 — pinned
   by a test at 1040×780, the artboard's own aspect.]
4. **A `cover` artboard, where the painted box is *larger* than its viewport.** `portrait-cover`
   at 844×390 draws 1964px of artboard into an 844px viewport and crops 376 units off the top
   and bottom (measured). A person expects a deliberate cover crop to be the only thing cropping
   their composition. [Task 2.2 — pinned by a test on `?theme=portrait-cover` at 844×390 with the
   scaffold strip up.]
   **Corrected 2026-10-08 from Task 2.2's measurement: two separate claims were run together, and
   the second was answered by the wrong box.** (a) "The artboard fits inside its host" is false
   here by design — that half was right. (b) "No strip covers the artboard" is **not** answered by
   the painted box: the painted box is *unclipped*, so at 844×390 it reads 844 × 1833.78 and runs
   the full height of the viewport, under the band a strip sits in, giving a permanent false
   positive of **24304.5625** that no fix could ever remove. Fabric clips to the host, so the
   pixels a reader can actually lose are `host ∩ painted`, and `overlap(strip, host) === 0`
   implies `overlap(strip, host ∩ painted) === 0`. **The host is the discriminating box.** The
   plan's own figure was wrong besides: `portrait-cover`'s painted box is 844 wide, not 1964 —
   1964.2 is `1024 × 1.9181818`, which is `stress`'s width copied into this entry.
5. **The load-failure page, which is the one surface with no artboard to take room from.** It is
   mounted *inside* the artboard host today (`load-failure.ts:22`), so the moment that host
   becomes the middle row of a column, the page becomes a panel between two bands with black
   above and below it — on the screen a reader is most likely to be looking at. A person expects
   "nothing to show" to be the whole display. [Task 1.3 pins the mount, in jsdom; Task 2.1 pins
   the rendered result, that its box is the viewport.]

---

## Out of scope

- **Plan 9 owns Tailwind `@theme`, the OS appearance, the six palettes and §8's Radix migration
  of the five Base UI imports** (spec `:404-449`, `:451-457`, `:475`; decision
  [`0033`](../../decisions/0033-new-primitives-are-radix-the-tooltip-is-not.md)). **This plan
  adds no primitive library and no interactive control at all** — a band and a strip are two
  `div`s, so there is no ruling to inherit and no decision note owed (below).
- **The host's own pages are not the phone.** `host/public/library.html`, `settings.html`,
  `theme-list.js` and `vigilia-page.css` have their own chrome, and nothing here touches them.
- **The editor's device lens does not preview the chrome.** See **Q4**.
- **No copy change.** Every sentence a strip shows stays `ui-copy.ts`'s, unchanged, and the two
  §97 treatments (amber for a data gap, slate for a composition gap) stay distinct.
- **No new diagnostic surface.** The glass, repaint and font errors stay `console.warn`
  (`main.ts:116-133`); giving them a strip would be a new product surface nobody asked for
  (Non-goals `:504`), and it is not this plan's.
- **`shell-layout.dom.test.tsx`'s `vg-135`, named so it is not reported as a regression.** One
  Base UI menu-trigger click blocks for **50–90 s** under jsdom, so that file is pathological and
  the full unit suite is red because of it. This plan touches no editor file; a red unit run
  that names `shell-layout.dom.test.tsx` is that row.
- **The pinned rows nothing here closes:** `vg-135` (above), `vg-140` (the intermittent
  `display-fabric.spec.ts` fit-mode ink read — this plan adds a file and does not touch that
  one, but Phase 3 re-runs the suite and may see it), `vg-143`, `vg-150` (named in Global
  Constraints, and obeyed), `vg-164`, `vg-175` (both likewise load-sensitive members of the full
  suite), `vg-172` (the editor header at 390px — a different surface), and the Playwright 1.63.0
  trace-teardown `ENOENT`.

---

## Phase 1 — One owner, and one column (3 tasks)

Delivers: the display's chrome has a module and a place to be, the four strips live in that
module and are in flow rather than pinned to the viewport, and the failure page is the display
rather than a row of it. Every jsdom test here is a contract test; **the geometry they imply is
proved in Phase 2, and no task in this phase may claim it.**

---

### Task 1.1: One owner for the chrome, and the column it lives in

**Files:**
- Create: `src/web/packages/player/src/chrome.ts`
- Create: `src/web/packages/player/src/chrome.dom.test.ts`
- Modify: `src/web/packages/player/index.html` — the `<style>` block and the two bands

**Interfaces:**
- Consumes: nothing (this is the first task).
- Produces, for Task 1.2 and every later task:
  - `type ChromeSide = "top" | "bottom"`
  - `chromeBand(side: ChromeSide): HTMLElement` — the band element, or throws
  - `putStrip(input: { side: ChromeSide; id: string; text: string; background: string; color:
    string }): HTMLElement` — replaces any element with `input.id`, appends the new one, returns
    it
  - `removeStrip(id: string): void`
  - the two band selectors: `#vigilia-chrome-top` / `#vigilia-chrome-bottom`, each carrying
    `data-vigilia-chrome="top" | "bottom"`
  - the strip marker every strip gets: `data-vigilia-chrome-strip`

**Constraints.** `index.html` also feeds the built bundle, so `vite build` is what makes the new
layout visible; nothing here needs a browser to be *written*, but nothing here may be *claimed*
without one (Task 2.1). The `§151` marker on the comment at `index.html:5-9` exists nowhere in
`docs/product/requirements.md` (**grep it before trusting this**) — keep the comment's substance
about `viewport-fit=cover`, and do not carry a citation to a marker that is not there.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { chromeBand, putStrip, removeStrip } from "./chrome.js";

/**
 * The document `index.html` ships: the chrome's two bands around the artboard
 * host. Built with createElement rather than innerHTML, because the point is to
 * assert against the structure the document declares.
 */
function skeleton(): void {
  document.body.replaceChildren();
  for (const side of ["top", "bottom"] as const) {
    const band = document.createElement("div");
    band.id = `vigilia-chrome-${side}`;
    band.dataset["vigiliaChrome"] = side;
    document.body.append(band);
    if (side === "top") {
      const host = document.createElement("div");
      host.id = "artboard";
      document.body.append(host);
    }
  }
}

function stripsIn(side: "top" | "bottom"): HTMLElement[] {
  return [...chromeBand(side).querySelectorAll<HTMLElement>("[data-vigilia-chrome-strip]")];
}

describe("the display's chrome", () => {
  beforeEach(skeleton);

  it("puts a strip in the band it names, and nowhere else", () => {
    putStrip({ side: "top", id: "vigilia-crop", text: "1 of 2 objects", background: "#1d2230", color: "#c3cde3" });

    expect(stripsIn("top")).toHaveLength(1);
    expect(stripsIn("bottom")).toHaveLength(0);
    expect(document.getElementById("vigilia-crop")?.textContent).toBe("1 of 2 objects");
  });

  it("replaces a strip of the same kind rather than stacking it", () => {
    // The availability strip is rebuilt on every refresh cadence and the
    // connection banner changes as the transport moves: one kind of notice is
    // one strip, which each writer used to arrange by removing the old element
    // by hand.
    putStrip({ side: "top", id: "vigilia-crop", text: "first", background: "#1d2230", color: "#c3cde3" });
    putStrip({ side: "top", id: "vigilia-crop", text: "second", background: "#1d2230", color: "#c3cde3" });

    expect(document.querySelectorAll("#vigilia-crop")).toHaveLength(1);
    expect(document.getElementById("vigilia-crop")?.textContent).toBe("second");
  });

  it("leaves an empty band empty, so a quiet display costs no room", () => {
    // This is the property the whole layout rests on: a band with nothing in it
    // is zero tall, so a display with nothing to say gets the whole viewport —
    // measured on the real host before this plan, and preserved by it.
    expect(stripsIn("top")).toHaveLength(0);
    expect(stripsIn("bottom")).toHaveLength(0);
  });

  it("keeps the order the strips were put in, so the two gaps stay legible apart", () => {
    putStrip({ side: "top", id: "vigilia-availability", text: "a", background: "#3a2a00", color: "#ffce6a" });
    putStrip({ side: "top", id: "vigilia-crop", text: "b", background: "#1d2230", color: "#c3cde3" });

    expect(stripsIn("top").map((strip) => strip.id)).toEqual([
      "vigilia-availability",
      "vigilia-crop",
    ]);
  });

  it("refuses to draw into a document that has no band", () => {
    // The same contract `main.ts:55-57` already has for `#artboard`: a document
    // this renderer cannot draw into fails loudly rather than silently putting
    // a strip somewhere that covers the composition.
    document.body.replaceChildren();

    expect(() => chromeBand("top")).toThrow(/top chrome band/);
  });

  it("takes the empty space back when a strip is removed", () => {
    putStrip({ side: "bottom", id: "vigilia-connection", text: "Lost the host.", background: "#003a4a", color: "#7fdce9" });
    removeStrip("vigilia-connection");

    expect(stripsIn("bottom")).toHaveLength(0);
    expect(document.getElementById("vigilia-connection")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/player/src/chrome.dom.test.ts` from `src/web/`
Expected: FAIL — `Failed to resolve import "./chrome.js"`.

- [ ] **Step 3: Write `chrome.ts`**

```ts
/**
 * The display's own chrome: what a reader is told, and the room it takes.
 *
 * One owner, because the defect this module fixes was two. Every strip used to
 * position itself (`position:fixed`, `top:0` or `bottom:0`) and every one of
 * them covered the artboard whenever the artboard filled the viewport's height
 * — which is the landscape phone the editor frames by default, and any display
 * whose artboard matches its own aspect. Measured on the built player at
 * 844x390: the crop strip and the scaffold banner together covered the top and
 * bottom 28.8px of a 390px artboard, 14.8% of the authored composition.
 *
 * The bands are in flow (`index.html` is the column that places them), so a
 * strip takes its room *from* the artboard instead of over it, and an empty
 * band is zero tall. Nothing here measures anything: the browser lays the
 * column out, and the scene's own `ResizeObserver` (`main.ts`) refits to the
 * box that is left. Nothing here decides what a strip says either — the words
 * and the colours are `ui-copy.ts`'s and the counting is `scene-fabric`'s.
 */

export type ChromeSide = "top" | "bottom";

/** The band a strip belongs in.
 *
 *  Throws rather than creating one: the document declares both bands so the
 *  column is right before any script runs, and a document without them is one
 *  this renderer cannot draw into. That is the contract `main.ts` already has
 *  for `#artboard`. */
export function chromeBand(side: ChromeSide): HTMLElement {
  const band = document.querySelector<HTMLElement>(
    `[data-vigilia-chrome="${side}"]`,
  );
  if (band === null) {
    throw new Error(`The display has no ${side} chrome band.`);
  }
  return band;
}

/**
 * Shows one strip, replacing the last one with the same id.
 *
 * Every caller here is re-said rather than said once: the availability strip is
 * rebuilt on every refresh cadence and the transport strip changes as the
 * connection moves. Replacing by id is what keeps one kind of notice one strip
 * — which each writer used to arrange by hand, by removing the element it had
 * found and reusing it in place.
 */
export function putStrip(input: {
  readonly side: ChromeSide;
  readonly id: string;
  readonly text: string;
  readonly background: string;
  readonly color: string;
}): HTMLElement {
  removeStrip(input.id);

  const strip = document.createElement("div");
  strip.id = input.id;
  strip.dataset["vigiliaChromeStrip"] = "";
  strip.textContent = input.text;
  strip.style.cssText =
    `${stripInset(input.side)};text-align:center;` +
    `background:${input.background};color:${input.color};` +
    "font:12px/1.4 ui-monospace,monospace;letter-spacing:0.02em";

  chromeBand(input.side).append(strip);
  return strip;
}

export function removeStrip(id: string): void {
  document.getElementById(id)?.remove();
}

/**
 * The strip's own inset from the display's edge — on the strip, never on the
 * band.
 *
 * `index.html` sets `viewport-fit=cover` so the artboard reaches a notched
 * phone's edges, which puts the system's own bar over the top of the screen; a
 * strip under it is a strip nobody reads. Padding on the **band** would reserve
 * the notch's height on a display with nothing to say, which is the one thing
 * this layout must not do; the failure page already takes the same care for the
 * same reason (`load-failure.ts:113-116`).
 */
function stripInset(side: ChromeSide): string {
  const top = side === "top" ? "env(safe-area-inset-top)" : "0px";
  const bottom = side === "bottom" ? "env(safe-area-inset-bottom)" : "0px";
  return `padding: calc(6px + ${top}) 12px calc(6px + ${bottom})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/player/src/chrome.dom.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Rewrite `index.html`'s layout**

Everything else in the file — the charset, the viewport meta, the `color-scheme`, the title, the
favicon link — is unchanged. Replace the `<style>` block and the body:

```html
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
        background: #000;
        overflow: hidden;
      }
      /* The display is one column: the chrome's two bands, and the artboard
         between them. A strip in a band is in flow, so a diagnostic takes its
         room *from* the artboard rather than over it. An empty band is zero
         tall, so a display with nothing to say is a display unchanged. */
      body {
        display: flex;
        flex-direction: column;
      }
      [data-vigilia-chrome] {
        flex: 0 0 auto;
      }
      /* Artboard host. The renderer applies one uniform transform to all
         content (§51); this element must not impose its own layout, and it is
         what is left of the column. */
      #artboard {
        flex: 1 1 auto;
        min-height: 0;
        position: relative;
      }
    </style>
```

```html
  <body>
    <div id="vigilia-chrome-top" data-vigilia-chrome="top"></div>
    <div id="artboard"></div>
    <div id="vigilia-chrome-bottom" data-vigilia-chrome="bottom"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
```

Three things to get right rather than discover: `#artboard` is **no longer**
`position:absolute; inset:0` — it is the flexible row, and it is `position: relative` explicitly
so the absolutely-positioned canvas `scene.ts:69-74` creates is anchored to it rather than
depending on the `static` branch at `scene.ts:64-67`; a `<script>` is `display: none` in the
user-agent stylesheet and therefore takes no row; and the empty bands must stay empty — nothing
in this task writes into them.

- [ ] **Step 6: Typecheck, lint, format, build**

> **Corrected 2026-10-08 by Task 1.1's executor: the test source in Step 1 is not
> `format:check`-clean, so this step fails on the file Step 1 supplied.** Every
> `putStrip({…})` call in that block exceeds the formatter's line width. The block is
> otherwise right and was written as given, then formatted in place; the landed file is
> `8cb99931`. **Task 1.2 then hit the same thing one step earlier and in production code**:
> its Step 3 `chrome.ts` body carries the over-width line
> `const text = cropNoticeText(sceneBoxesOf(handle.canvas.getObjects()), artboard);`, which is
> where `format:check` actually failed there. Read this as a warning for **Steps 1, 3 and 6**
> of Tasks 1.2 and 1.3 too — a block pasted verbatim from this plan is a starting point, and
> `npm run format:check` is the gate that decides, not the block's own line breaks.
>
> **Task 1.2 also prescribes no deliberate break, and it is the first task here to add
> regression tests.** The Global Constraints require every such task to say, in its own steps,
> how the fix was disabled and what failed; Task 1.2's Steps 1-7 contain no such step, so its
> executor supplied two of its own (dropping `putStrip`'s `removeStrip`, and dropping the
> scaffold banner's `data-vigilia-scaffold`) and observed `1 failed | 9 passed` for each. The
> gap is in the plan, not the code. **Tasks 1.3, 2.1-2.3 and 3.x are checked for this when they
> are dispatched**; none of them inherits the omission silently.

```bash
cd src/web
npm run typecheck
./node_modules/.bin/biome lint ..
npm run format:check
npm run size -w @vigilia/player
npx vite build packages/player
```

Expected: typecheck exit 0; lint clean for the two files touched; format clean; the size gate
still PASS; the build writes `packages/player/dist` (gitignored).

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/player/src/chrome.ts src/web/packages/player/src/chrome.dom.test.ts src/web/packages/player/index.html
git commit -m "feat(player): one owner for the display's chrome, in a column the artboard shares"
```

---

### Task 1.2: The four strips move onto the bands

**Files:**
- Modify: `src/web/packages/player/src/chrome.ts` — the four writers
- Modify: `src/web/packages/player/src/main.ts` — delete the four writers and the imports only
  they used; keep every call site
- Modify: `src/web/packages/player/src/chrome.dom.test.ts` — the strip-level assertions

**Interfaces:**
- Consumes: `chromeBand`, `putStrip`, `removeStrip` (Task 1.1).
- Produces, with the signatures **unchanged** from today so no call site moves:
  - `showCropNotice(handle: FabricSceneHandle, artboard: ArtboardSize): void`
  - `showAvailabilityNotice(source: SampleSource, semanticKeys: readonly string[]): void`
  - `showConnectionState(status: LiveSourceStatus, keyCount: number, detail?: string): void`
  - `showScaffoldBanner(keyCount: number, themeName: string): void`
  - the strip identity every existing test and page already reads: `#vigilia-crop` +
    `data-vigilia-crop`, `#vigilia-availability` + `data-vigilia-availability`,
    `#vigilia-connection`; and, **new**, `#vigilia-scaffold` + `data-vigilia-scaffold` — the
    scaffold banner carries no `id` and no attribute today, so nothing can address it.

**Constraints.** **The words do not change.** Every sentence stays the one `ui-copy.ts` supplies
and every colour stays the one it is today (availability `#3a2a00`/`#ffce6a`, crop
`#1d2230`/`#c3cde3`, connecting-or-reconnecting `#003a4a`/`#7fdce9`, refused `#4a0000`/`#ff9a9a`,
scaffold `#4a2c00`/`#ffc14d`). One visible property does normalise, and the executor should say
so in the commit rather than discover it in a capture: the scaffold and connection strips used
`letter-spacing: 0.04em` and now share the strips' single template at **`0.02em`** — one strip
style, one owner. `#vigilia-notices` (the hand-built top column, `main.ts:529-540`) is
**retired**, because the top band is that column; nothing but `main.ts:530` referenced it.

- [ ] **Step 1: Write the failing test**

Add to `chrome.dom.test.ts` — these are the assertions about the *rendered strip*, and each one
is a property an existing spec or the product relies on:

```ts
import { showCropNotice, showScaffoldBanner, showConnectionState } from "./chrome.js";
import { uiCopy } from "./ui-copy.js";

describe("the strips the display is told by", () => {
  beforeEach(skeleton);

  it("marks every strip with one attribute, in the band for what it is", () => {
    showConnectionState("reconnecting", 3);
    showScaffoldBanner(18, "Edge cases");

    expect(stripsIn("bottom").map((strip) => strip.id)).toEqual([
      "vigilia-connection",
      "vigilia-scaffold",
    ]);
    expect(document.querySelector("#vigilia-scaffold")?.textContent).toBe(
      uiCopy.syntheticData("Edge cases", 18),
    );
  });

  it("keeps the scaffold banner addressable, which it was not", () => {
    showScaffoldBanner(18, "Edge cases");

    expect(document.querySelector("[data-vigilia-scaffold]")).not.toBeNull();
  });

  it("clears the transport strip when the connection is live", () => {
    showConnectionState("reconnecting", 3);
    showConnectionState("live", 3);

    expect(stripsIn("bottom")).toHaveLength(0);
  });

  it("says nothing at all when there is nothing to say", () => {
    // The quiet display: a connection that is live raises no strip, and a theme
    // whose objects are inside its artboard raises no crop strip.
    showConnectionState("live", 3);
    showCropNotice(
      { canvas: { getObjects: () => [] } } as unknown as FabricSceneHandle,
      { width: 1024, height: 768 },
    );

    expect(stripsIn("top")).toHaveLength(0);
    expect(stripsIn("bottom")).toHaveLength(0);
  });
});
```

with `import type { FabricSceneHandle } from "@vigilia/scene-fabric";` at the top of the test —
the same import `main.ts:26` uses today.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/player/src/chrome.dom.test.ts`
Expected: FAIL — `showScaffoldBanner is not a function` (or a resolve error for the new import).

- [ ] **Step 3: Move the four writers into `chrome.ts`**

Their bodies are the ones at `main.ts:496-519`, `:551-574`, `:616-648` and `:577-584`, with two
changes each: the element they build is a `putStrip` call, and the `position:fixed;…;z-index:9`
half of their `cssText` is **gone** because the band places them.

```ts
/** Section 97 requires an unavailable sensor to explain itself; without this the
 *  consumer sees empty charts and no reason for them. Says nothing when every
 *  key has a reading — which is also what keeps the band empty. */
export function showAvailabilityNotice(
  source: SampleSource,
  semanticKeys: readonly string[],
): void {
  removeStrip("vigilia-availability");

  const text = availabilityNoticeText(
    semanticKeys.map((key) => source.latest(key)),
  );
  if (text === undefined) return;

  const strip = putStrip({
    side: "top",
    id: "vigilia-availability",
    text,
    background: "#3a2a00",
    color: "#ffce6a",
  });
  strip.dataset["vigiliaAvailability"] = "";
}

/** Says what this artboard does not contain, and that it is not being shown.
 *  Slate rather than the availability strip's amber: a missing reading is this
 *  instant's news and a crop is a standing property of the theme, and §97
 *  requires the two gaps not to read as the same kind of gap. */
export function showCropNotice(
  handle: FabricSceneHandle,
  artboard: ArtboardSize,
): void {
  removeStrip("vigilia-crop");

  const text = cropNoticeText(sceneBoxesOf(handle.canvas.getObjects()), artboard);
  if (text === undefined) return;

  const strip = putStrip({
    side: "top",
    id: "vigilia-crop",
    text,
    background: "#1d2230",
    color: "#c3cde3",
  });
  strip.dataset["vigiliaCrop"] = "";
}

/** Persistent disclosure that displayed values are synthetic. */
export function showScaffoldBanner(keyCount: number, themeName: string): void {
  const strip = putStrip({
    side: "bottom",
    id: "vigilia-scaffold",
    text: uiCopy.syntheticData(themeName, keyCount),
    background: "#4a2c00",
    color: "#ffc14d",
  });
  strip.dataset["vigiliaScaffold"] = "";
}

/** Shows non-live connection states; a healthy live display needs no badge. */
export function showConnectionState(
  status: LiveSourceStatus,
  keyCount: number,
  detail?: string,
): void {
  if (status === "live") {
    removeStrip("vigilia-connection");
    return;
  }

  const refused = status === "refused";
  putStrip({
    side: "bottom",
    id: "vigilia-connection",
    text: refused
      ? uiCopy.connection.refused(detail)
      : status === "connecting"
        ? uiCopy.connection.connecting(keyCount)
        : uiCopy.connection.reconnecting,
    background: refused ? "#4a0000" : "#003a4a",
    color: refused ? "#ff9a9a" : "#7fdce9",
  });
}
```

`chrome.ts`'s imports, all of them existing handles:

```ts
import type { LiveSourceStatus, SampleSource } from "@vigilia/renderer-core";
import { type FabricSceneHandle, sceneBoxesOf } from "@vigilia/scene-fabric";
import { type ArtboardSize, cropNoticeText } from "./artboard-crop.js";
import { availabilityNoticeText } from "./availability-notice.js";
import { uiCopy } from "./ui-copy.js";
```

- [ ] **Step 4: Delete the writers and the now-unused imports from `main.ts`**

`main.ts` keeps every **call site** (`:201`, `:204`, `:206`, `:220-222`, `:356`, `:362`, `:363`)
and gains one import:

```ts
import {
  showAvailabilityNotice,
  showConnectionState,
  showCropNotice,
  showScaffoldBanner,
} from "./chrome.js";
```

Remove, because after the move nothing in the file uses them — grep each before deleting rather
than trusting this list: `type FabricSceneHandle` and `sceneBoxesOf` from the `@vigilia/scene-fabric`
import; `type LiveSourceStatus` from the `renderer-core` import (the `onStatus` callbacks infer
their own); the whole `./artboard-crop.js` import (`ArtboardSize` and `cropNoticeText` both go);
the whole `./availability-notice.js` import; the whole `./ui-copy.js` import. **`type SampleSource`
stays** — `startFixtureTheme` (`:147`) and `hydrateCharts` (`:400`) still use it. Then:

```bash
cd src/web
./node_modules/.bin/biome lint packages/player/src/main.ts
```

Expected: no `noUnusedImports` finding. Biome is the check for this step because a leftover
import is exactly what it catches.

- [ ] **Step 5: Run the tests, and the player's existing unit suite**

Run: `npx vitest run packages/player/`
Expected: PASS — the new chrome tests plus everything that was already there
(`availability-notice.test.ts`, `artboard-crop.test.ts`, `load-failure.dom.test.ts`,
`boundaries.test.ts`, `theme-loader.test.ts`, `session.test.ts`, `publish-follower.test.ts`,
`bound-keys.test.ts`, `hosted-plan.test.ts`). **A failure in any of them is a signal, not
noise**: none of them reads the strips, so a red one means the move took something with it.

- [ ] **Step 6: Build, typecheck, lint, format**

```bash
cd src/web
npm run typecheck && ./node_modules/.bin/biome lint .. && npm run format:check
npx vite build packages/player
```

Expected: all exit 0; the build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/player/src/chrome.ts src/web/packages/player/src/chrome.dom.test.ts src/web/packages/player/src/main.ts
git commit -m "refactor(player): the four diagnostic strips move into the chrome owner" \
  -m "The strips' wording and colours are unchanged; the scaffold banner gains the id and data attribute it never had, and one strip template replaces four hand-set letter-spacings."
```

---

### Task 1.3: The failure page is the display, not a row of it

> **Corrected 2026-10-08 by Task 1.3's executor: this task has a third caller the Files list
> above omits, and one of its two premises is false.** The third caller is
> `load-failure-reason.test.ts` — eleven cases that read the page out of an element they handed to
> `showLoadFailure` and now read `document.body`. Omitting it from the Files list, the ownership
> brief and Step 6's `git add` made a necessary edit look like drift; it landed as `66ee3414`, and
> the ownership list is the thing that was wrong, not the edit. **The `showLoadFailure` signature
> change is a source change with three callers, and a Files list is a claim about how many there
> are.**
>
> **The "no canvas to lose" sentence below is false for the second call site**, and was carried
> into the landed comment before anyone checked it. `main.ts:89` runs before anything; `main.ts:104`
> is a `catch` around all of `await startHostedTheme(...)`, which mounts the scene at `:301` and
> keeps running. A rejection arriving after that mount reaches `showLoadFailure` with a canvas on
> the page. **This is not a regression** — the old code replaced the *artboard host's* children,
> and the canvas lives inside that host, so the canvas went either way; what changed is that the
> bands go with it. Whether a late failure *should* blank a display that was working is `vg-190`'s
> question, and the landed comment now states the behaviour without claiming an intent for it.

**Files:**
- Modify: `src/web/packages/player/src/load-failure.ts:17-25` — `showLoadFailure`
- Modify: `src/web/packages/player/src/main.ts:89`, `:104` — the two call sites
- Modify: `src/web/packages/player/src/load-failure.dom.test.ts` — one new test
- Modify: `src/web/packages/player/src/load-failure-reason.test.ts` — **the third caller**, eleven
  cases that now read the page from `document.body`

**Interfaces:**
- Consumes: nothing from Tasks 1.1-1.2 directly; it exists because of the layout they create.
- Produces: `showLoadFailure(error: unknown): void` — **the first parameter is gone**, so all
  **three** call sites must change. `loadFailureView(reason, retry): HTMLElement` and every data
  attribute it carries (`data-vigilia-load-failure`, `-reason`, `-retry`, `-host`) are unchanged,
  and so is its stylesheet.

**Constraints.** The page's own style is `position:absolute; inset:0` (`load-failure.ts:104-108`),
which fills whatever contains it; putting it in `document.body` is what makes it the viewport
again, with **no CSS change at all**. `document.body.replaceChildren(view)` is the strongest
form of "this is the whole display": it takes the bands and the artboard host with it, which is
correct — nothing else is being said, and nothing else will be. **One of the two callers arrives
before any scene is mounted and one does not**; see the correction above.

- [ ] **Step 1: Write the failing test**

Add to `load-failure.dom.test.ts`:

```ts
it("takes the whole display, not the row the artboard lives in", async () => {
  // The artboard host is the middle row of the display's column, so a page
  // mounted *in* it would be a panel between two bands with black above and
  // below it — on the one screen whose entire message is that there is nothing
  // to show. `showLoadFailure` is the caller that decides where.
  document.body.replaceChildren();
  const chrome = document.createElement("div");
  chrome.dataset["vigiliaChrome"] = "top";
  const host = document.createElement("div");
  host.id = "artboard";
  document.body.append(chrome, host);

  const { showLoadFailure } = await import("./load-failure.js");
  showLoadFailure(new Error("boom"));

  const view = document.querySelector<HTMLElement>("[data-vigilia-load-failure]");
  expect(view?.parentElement).toBe(document.body);
  expect(document.getElementById("artboard")).toBeNull();
  expect(document.querySelector("[data-vigilia-chrome]")).toBeNull();
});
```

The test needs `vi.spyOn(console, "warn")` (or a `console.warn` stub in `beforeEach`) so the
page's own `console.warn` does not print; `restoreMocks: true` in `vitest.config.ts` already
undoes it between tests.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/player/src/load-failure.dom.test.ts`
Expected: FAIL — `showLoadFailure` is called with one argument and `host` is required, so either
a type error under `npm run typecheck` or a `view` that is still inside `#artboard`.

- [ ] **Step 3: Change `showLoadFailure`**

```ts
export function showLoadFailure(error: unknown): void {
  // The error object, not a string of it: the stack is the part a developer
  // needs and the part `String(error)` throws away.
  console.warn("Vigilia: theme did not load.", error);
  document.title = uiCopy.loadFailure.documentTitle;
  // The display's own page, not the artboard's. The artboard host is the middle
  // row of the display's column, so a page mounted in it would be a panel
  // between two bands — and this is the one failure that replaces the whole
  // screen, not a part of it.
  //
  // The second caller is a `catch` around the display's whole lifetime
  // (`main.ts:103`, with the scene mounted at `:301`), so a rejection arriving
  // **after** the scene mounted reaches here too and takes that with it. That is
  // what the page is for — a half-drawn display is not something to leave on a
  // wall — but the status of a late failure is `vg-190`'s question rather than
  // something this comment settles.
  document.body.replaceChildren(
    loadFailureView(loadFailureReason(error), () => window.location.reload()),
  );
}
```

and the two call sites, `main.ts:89` and `main.ts:104`, lose their `host` argument
(`showLoadFailure(host, new ThemeLoadError("missing-id", "No ?theme=."))` →
`showLoadFailure(new ThemeLoadError("missing-id", "No ?theme=."))`). The `host` parameter of
`start` itself stays — it is the artboard host. **A third caller is in
`load-failure-reason.test.ts` and is corrected above; nothing else calls it.**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/player/src/`
Expected: PASS, including the **six** existing load-failure tests in
`load-failure.dom.test.ts` — the plan said five and the file has six, so take the count from the
run rather than from here — which mount on `document.body` themselves (`load-failure.dom.test.ts:11`)
and therefore already assert the new parent.

- [ ] **Step 5: Build, typecheck, lint, format**

```bash
cd src/web
npm run typecheck && ./node_modules/.bin/biome lint .. && npm run format:check
npx vite build packages/player
```

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/player/src/load-failure.ts src/web/packages/player/src/main.ts src/web/packages/player/src/load-failure.dom.test.ts
git commit -m "fix(player): the load-failure page takes the whole display again"
```

---

## Phase 2 — Proved where the pixels are (3 tasks)

Delivers: the geometry claim of phase 1, in a browser, at the shapes that were measured — and
the deliberate breaks that prove each test can fail. **This is the phase that discharges the
Sequencing row.** Every test here runs against a **built** bundle (`npx vite build
packages/player`), and every one of them is expected to fail before its own task's break is
restored.

The numbers to expect are in *What is already true*: at 844×390 the crop strip is 28.8px and the
scaffold banner 28.8px, both currently over the artboard's top and bottom; after this plan each
is above or below it and the artboard is that much shorter.

---

### Task 2.1: What may cover the phone, at the two phone shapes

**Files:**
- Create: `src/web/tests/e2e/player-chrome.spec.ts`
- Create: `docs/evidence/screenshots/player-chrome-phone-chromium.png`, by running the spec with
  `VIGILIA_CAPTURE=1` and `--workers=1`
- Modify: `docs/evidence/screenshots/README.md` — one new capture row

**Interfaces:**
- Consumes: the built player bundle (Task 1.1's layout, Task 1.2's strips, Task 1.3's page);
  `openCanvasPlayer(page, query)` from `tests/e2e/canvas-probe.ts:195` (it installs a fixed
  clock and appends `&static=1`); `captureVisualReview(page, testInfo, name)` from
  `tests/e2e/editor-canvas.ts:297`.
- Produces: `player-chrome.spec.ts`, which Task 2.2 extends, and the registered capture
  `player-chrome-phone-chromium`.

**Constraints.** No new project is needed: a spec that no project's `testMatch`/`testIgnore`
claims runs under `desktop-chromium` and `phone-chromium` (the `projects` list at
`playwright.config.ts:107`), both of which point at the preview server on 4173 that `webServer`
starts (`:82-89`). Each test sets its own viewport with `page.setViewportSize`, the idiom
`display-fabric.spec.ts:303` and `host-player.spec.ts:1241` already use, so the project's device
does not decide the measurement.
**Read the transform through `window.vigilia.handle.transform()`** (`main.ts:517`), typed the
way `host-player.spec.ts` types it — it is the same diagnostics handle that file reads for
`batchCount`, and there is no other way to read where the renderer put the artboard.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, type Page, test } from "@playwright/test";
import { openCanvasPlayer } from "./canvas-probe.js";
import { captureVisualReview } from "./editor-canvas.js";

/**
 * What the display says about itself, and what it is allowed to cover.
 *
 * The requirement is a sentence about pixels — "diagnostics stop eating the
 * phone's best pixels" (spec :474) — so it is measured in pixels, at the two
 * phone shapes it was measured at when the plan was written. Both assertions
 * below are needed and they are not the same claim: `host` is the renderer's
 * own viewport, which a strip must be outside of *by construction*, and
 * `painted` is where the authored composition actually lands, which is the
 * thing a reader loses.
 */

const PHONE = {
  portrait: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
} as const;

/** `?theme=stress`'s own artboard, from `packages/fake-source/src/themes/stress.json`. */
const STRESS_ARTBOARD = { width: 1024, height: 768 } as const;

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface ChromeGeometry {
  readonly host: Box;
  readonly strips: readonly { readonly id: string; readonly box: Box }[];
  readonly painted: Box;
  readonly degenerate: boolean;
}

async function chromeGeometry(
  page: Page,
  artboard: { readonly width: number; readonly height: number },
): Promise<ChromeGeometry> {
  return page.evaluate((size) => {
    const box = (element: Element): Box => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    };
    const host = document.querySelector<HTMLElement>("#artboard");
    if (host === null) throw new Error("the display has no artboard host");
    const handle = (
      window as unknown as {
        vigilia?: {
          handle?: {
            transform(): {
              scale: number;
              offsetX: number;
              offsetY: number;
              isDegenerate: boolean;
            };
          };
        };
      }
    ).vigilia?.handle;
    const transform = handle?.transform();
    if (transform === undefined) throw new Error("the display has no scene");

    const hostBox = box(host);
    return {
      host: hostBox,
      strips: [
        ...document.querySelectorAll<HTMLElement>("[data-vigilia-chrome-strip]"),
      ].map((strip) => ({ id: strip.id, box: box(strip) })),
      // The transform's offsets are relative to the host, the rects are not.
      painted: {
        x: hostBox.x + transform.offsetX,
        y: hostBox.y + transform.offsetY,
        w: size.width * transform.scale,
        h: size.height * transform.scale,
      },
      degenerate: transform.isDegenerate,
    };
  }, artboard);
}

/** Area shared by two boxes, in square CSS pixels. */
function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return Math.max(0, w) * Math.max(0, h);
}

for (const [name, viewport] of Object.entries(PHONE)) {
  test(`no strip covers the artboard at ${name} ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await openCanvasPlayer(page, "/?theme=stress");
    await expect(page.locator("[data-vigilia-crop]")).toBeVisible();

    const geometry = await chromeGeometry(page, STRESS_ARTBOARD);

    // Something was actually said, or the rest of this test measures nothing.
    expect(geometry.strips.length).toBeGreaterThan(0);
    expect(geometry.degenerate).toBe(false);

    for (const strip of geometry.strips) {
      // The renderer's viewport excludes the chrome, by construction: the band
      // is a row of the column the artboard is fitted into.
      expect(overlap(strip.box, geometry.host), `${strip.id} over the viewport`).toBe(0);
      // And the authored composition is not covered, which is what a reader
      // loses. At 390x844 this one is already true of the old layout — the
      // strips sat on the letterbox bars — and at 844x390 it was not: 28.8px at
      // each end of a 390px artboard.
      expect(overlap(strip.box, geometry.painted), `${strip.id} over the artboard`).toBe(0);
    }

    // The artboard is still fitted to what is left, not merely moved: with
    // contain, the painted box must fill its host on one axis.
    expect(geometry.painted.w).toBeLessThanOrEqual(geometry.host.w + 0.5);
    expect(geometry.painted.h).toBeLessThanOrEqual(geometry.host.h + 0.5);
    expect(
      Math.abs(geometry.painted.w - geometry.host.w) < 0.5 ||
        Math.abs(geometry.painted.h - geometry.host.h) < 0.5,
      "the artboard was not refitted to the box the chrome left it",
    ).toBe(true);

    if (name === "landscape") {
      await captureVisualReview(page, testInfo, "player-chrome");
    }
  });
}

test("nothing else the display adds covers the artboard", async ({ page }) => {
  await page.setViewportSize(PHONE.landscape);
  await openCanvasPlayer(page, "/?theme=stress");
  await expect(page.locator("[data-vigilia-crop]")).toBeVisible();

  // The guard, not the fix: the requirement is a property of the display, and a
  // future notice appended to `document.body` with `position: fixed` would put
  // it back with nothing to catch it. Every element the display adds is either
  // the artboard host itself or outside it.
  const geometry = await chromeGeometry(page, STRESS_ARTBOARD);
  const intruders = await page.evaluate(() => {
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    };
    const host = document.querySelector<HTMLElement>("#artboard");
    if (host === null) throw new Error("no host");
    const hostBox = box(host);
    return [...document.body.children]
      .filter((element) => element !== host)
      .map((element) => ({ id: element.id, box: box(element) }))
      .filter(({ box: candidate }) => {
        const w = Math.min(candidate.x + candidate.w, hostBox.x + hostBox.w) - Math.max(candidate.x, hostBox.x);
        const h = Math.min(candidate.y + candidate.h, hostBox.y + hostBox.h) - Math.max(candidate.y, hostBox.y);
        return Math.max(0, w) * Math.max(0, h) > 0;
      });
  });

  expect(geometry.strips.length).toBeGreaterThan(0);
  expect(intruders).toEqual([]);
});

test("the load-failure page is the whole display", async ({ page }) => {
  await page.setViewportSize(PHONE.landscape);
  await page.goto("/?theme=does-not-exist");

  const failure = page.locator("[data-vigilia-load-failure]");
  await expect(failure).toBeVisible();
  const box = (await failure.boundingBox())!;

  expect(box.x).toBeCloseTo(0, 0);
  expect(box.y).toBeCloseTo(0, 0);
  expect(box.width).toBeCloseTo(PHONE.landscape.width, 0);
  expect(box.height).toBeCloseTo(PHONE.landscape.height, 0);
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd src/web
npx vite build packages/player
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/player-chrome.json \
  npx playwright test tests/e2e/player-chrome.spec.ts --project=phone-chromium --workers=1 --reporter=json
```

> **Corrected 2026-10-08 by Task 2.1's executor: this step's premise is stale, its Step 3 names
> the wrong elements, and Step 4's count is wrong.** The step expects a red first run "today"
> because "the host is the whole viewport" — but that describes the **pre-Phase-1** layout, and
> Phase 1 is committed. This task adds a test and no fix, so there is nothing for a first run to
> fail against; it was **green on arrival** (`expected: 4, unexpected: 0`). The proof this task
> actually rests on is **Step 3's break**, which failed exactly as intended — recorded there.
> A step whose stated expectation cannot occur is worse than a missing one, because a green run
> reads as a passed gate rather than as a step that measured nothing.
>
> Step 3 says the guard lists "both strips as intruders". It lists the two **bands**
> (`vigilia-chrome-top`, `vigilia-chrome-bottom`): the guard inspects `document.body`'s children,
> the bands are those children, and the strips are inside them. The guard fails correctly; only
> the described shape was off. And Step 4's "6 tests" is **8** — four tests × two projects.

Expected: **GREEN on arrival, and that is the correct outcome for a task that adds only a test.**
The plan originally said this run should be red; it was written before Phase 1 landed and the
premise no longer holds. The red run this task needs is Step 3's break. Record the actual counts
from the JSON report either way.

- [ ] **Step 3: The deliberate break, and what it must do**

Revert **only** Task 1.1's `#artboard` rule in `index.html` to `position: absolute; inset: 0`
(keeping `flex: 1 1 auto` out), rebuild the player, and re-run the same command. Expected: the
two viewport tests fail on the **host** assertion and on the **artboard** assertion, and
`nothing else the display adds covers the artboard` fails with the two **bands** listed as
intruders — the guard reads `document.body`'s children, so it sees `vigilia-chrome-top` and
`vigilia-chrome-bottom`, not the strips inside them.
**A break that does not fail is a finding about the test, not a passing test** — if the
prescribed break leaves the suite green, find a break that does fail, observe it, and report
what the prescribed one actually did. Restore the rule and rebuild before Step 4.
**Observed at `c73c8394`:** the break produced `expected: 1, unexpected: 3`, with the crop strip's
host overlap reading exactly `390 × 45.59375` at portrait and `844 × 28.796875` at landscape —
the strip's whole area, which is what "the host is the whole viewport" means arithmetically.

- [ ] **Step 4: Run it to verify it passes**

```bash
cd src/web
npx vite build packages/player
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/player-chrome.json \
  npx playwright test tests/e2e/player-chrome.spec.ts --workers=1 --reporter=json
```

Expected: PASS — **8** tests, which is four (two viewport geometries, the body-children guard,
the failure page) × **two projects**. The plan said 6 and the arithmetic was wrong; observed at
`c73c8394` as `expected: 8, unexpected: 0`, exit 0. Read the result from
`test-results/player-chrome.json`, never from stdout.

- [ ] **Step 5: Take the capture, and register it**

```bash
cd src/web
VIGILIA_CAPTURE=1 npx playwright test tests/e2e/player-chrome.spec.ts \
  --project=phone-chromium --grep "landscape" --workers=1
```

Expected: `docs/evidence/screenshots/player-chrome-phone-chromium.png`, written by
`captureVisualReview`. **Open the PNG and look at it before staging it** — the claim is that the
artboard is whole and the strip is beside it, and a black image would pass every assertion above.
Then add one row to the *Settings page* table's Player block in
`docs/evidence/screenshots/README.md`, in the same shape as `player-reference`:

```markdown
| Player | The phone's chrome taking its room from the artboard rather than covering it | `player-chrome-phone-chromium` / `no strip covers the artboard at landscape` |
```

- [ ] **Step 6: Commit**

```bash
git add src/web/tests/e2e/player-chrome.spec.ts docs/evidence/screenshots/player-chrome-phone-chromium.png docs/evidence/screenshots/README.md
git commit -m "test(player): no diagnostic strip covers the phone's artboard, at two phone shapes" \
  -m "390x844 and 844x390 against the built bundle: the renderer's viewport excludes the chrome, the painted composition is untouched, and a guard fails if any future element the display adds goes back over the artboard."
```

---

### Task 2.2: The shapes with no bar to hide in

**Files:**
- Modify: `src/web/tests/e2e/player-chrome.spec.ts` — three more tests

**Interfaces:**
- Consumes: `chromeGeometry`, `overlap` and `PHONE` from Task 2.1's file — same file, so they are
  simply in scope; `captureVisualReview` is not used here.
- Produces: nothing later tasks import; this is the second half of the geometry claim.

**Constraints.** Both fixtures are already served by the preview bundle
(`FIXTURE_THEME_IDS` in `main.ts:59`: `stress`, `portrait-cover`, `assets`), and
`openCanvasPlayer`'s `&static=1` does not suppress any strip — `showScaffoldBanner` and
`showCropNotice` are both independent of the animation flag (measured).

> **Corrected 2026-10-08 from Task 2.2's own run at `bf05b11e`: three of Step 1's assertions
> pinned the pre-fix geometry the fix removes, and a fourth was unreachable.**
>
> - **`painted.w ≈ 1040` is false after the fix, by construction.** 1040×780 is the artboard's own
>   aspect only against the *full* viewport; once the bands take 57.6px the host is 1040×722.4 and
>   `contain` fits by height, giving `painted.w` = **962.667**. The assertion pinned the geometry
>   the chrome had just removed. What replaces it is stronger and true either way:
>   `painted.h < viewport.height` — the artboard is *shorter* than the viewport by the chrome's
>   height, which is the proof the room was taken rather than the strip moved onto the artboard.
> - **The cover test's `overlap(strip, painted) === 0` cannot hold.** Corrected in Review Focus 4
>   above; the discriminating box is the host.
> - **`host.h ≈ 390` is unreachable on the preview bundle.** `main.ts:206` raises
>   `showScaffoldBanner` for **every** fixture theme, so no preview URL is "a display with nothing
>   to say"; 390 − 28.797 = **361.203**. The true form is `host.h + strip.h ≈ viewport.height`, and
>   the empty case belongs to Task 2.3's real host.
> - **Q3 is not this task's.** Review Focus 2 names Task 2.3, and this task's third case is the
>   `assets` compatibility pin. The executor kept the plan's subject and corrected its claim, which
>   is the right call; the "artboard keeps more than half the viewport" assertion moved to Task 2.3
>   where it belongs, corrected there.
>
> **All three landed failing, for three different reasons** — the plan predicted that they might be
> green on arrival, and that prediction was wrong too. Recorded because the difference matters: a
> test that fails on a stale assertion is not evidence of a defect in the product.

- [ ] **Step 1: Write the failing tests**

```ts
/** The artboard's own aspect: `bars: {x: 0, y: 0}`, so there is no bar to hide in. */
const SQUARE_ON_SCREEN = { width: 1040, height: 780 } as const;

test("a viewport the artboard exactly fills still keeps the strip off it", async ({
  page,
}) => {
  // Measured before this plan: bars {0,0}, and the crop strip covered the top
  // 28.8px of a 780px viewport, full width — 3.7% of the composition, with
  // nowhere for it to have gone instead.
  await page.setViewportSize(SQUARE_ON_SCREEN);
  await openCanvasPlayer(page, "/?theme=stress");
  await expect(page.locator("[data-vigilia-crop]")).toBeVisible();

  const geometry = await chromeGeometry(page, STRESS_ARTBOARD);

  expect(geometry.strips.length).toBeGreaterThan(0);
  expect(geometry.painted.w).toBeCloseTo(SQUARE_ON_SCREEN.width, 0);
  for (const strip of geometry.strips) {
    expect(overlap(strip.box, geometry.painted), `${strip.id} over the artboard`).toBe(0);
    expect(overlap(strip.box, geometry.host)).toBe(0);
  }
});

test("a cover artboard, whose painted box is larger than its viewport, is not covered either", async ({
  page,
}) => {
  // `?theme=portrait-cover` at a landscape viewport: scale 1.9181818, the
  // artboard drawn 1964px wide into 844px and cropped 376 units off the top and
  // bottom. An assertion that the painted box fits inside the host is false
  // here by design, which is exactly why this case is measured separately: the
  // chrome's promise is about the painted composition, not about the box.
  await page.setViewportSize(PHONE.landscape);
  await openCanvasPlayer(page, "/?theme=portrait-cover");

  const geometry = await chromeGeometry(page, POSTER); // see below
  const strip = await page.locator("[data-vigilia-chrome-strip]").first();
  await expect(strip).toBeVisible();

  expect(geometry.painted.h).toBeGreaterThan(geometry.host.h);
  for (const candidate of geometry.strips) {
    expect(overlap(candidate.box, geometry.painted), `${candidate.id} over the artboard`).toBe(0);
  }
});

test("a cover artboard with nothing wrong still gets the whole viewport", async ({
  page,
}) => {
  // The compatibility claim: this change is a no-op on a display with nothing
  // to say. `portrait-cover` raises no crop strip (the artboard is cropped, not
  // the content outside it) and, with no transport to fail, `&static=1` leaves
  // the scaffold banner as the only strip — so this one asserts the *host*, not
  // the absence of chrome.
  await page.setViewportSize(PHONE.landscape);
  await openCanvasPlayer(page, "/?theme=assets");
  const geometry = await chromeGeometry(page, ASSETS_ARTBOARD);

  expect(geometry.host.w).toBeCloseTo(PHONE.landscape.width, 0);
  expect(geometry.host.h).toBeCloseTo(PHONE.landscape.height, 0);
  expect(geometry.degenerate).toBe(false);
});
```

`POSTER` and `ASSETS_ARTBOARD` are the two fixtures' own artboards, and **the executor must read
them out of the fixture files rather than trusting a number in this plan**:
`packages/fake-source/src/themes/portrait-cover.json` and `assets.json`, in each case the
`artboard.width`/`artboard.height` the file declares (`portrait-cover` is the tall 9:19.5
artboard its own `metadata.description` describes). `stress` is 1024×768 and is already a
constant in Task 2.1's file.

- [ ] **Step 2: Run them to verify they fail**

```bash
cd src/web
npx vite build packages/player
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/player-chrome-shapes.json \
  npx playwright test tests/e2e/player-chrome.spec.ts --project=phone-chromium --workers=1 --reporter=json
```

Expected: the 1040×780 test fails on the artboard overlap against the *original* bundle. Against
the current (already fixed) bundle it should pass — so state in your report which of the three
failed before this task and which were green on arrival. **These three are the Review Focus 3
and 4 pins, and a green-on-arrival test is still worth keeping**: it is what stops the fix being
reverted by a later change.

- [ ] **Step 3: Prove each one can fail**

Two breaks, one at a time, each rebuilt and reverted:
1. re-add `position: fixed; left: 0; right: 0; top: 0; z-index: 9` to the crop strip's
   `cssText` in `chrome.ts`'s `showCropNotice` path (a literal regression of the defect) —
   expected: both the 1040×780 test and the cover test fail on `over the artboard`;
2. delete `flex: 1 1 auto` from `#artboard` in `index.html` — expected: the host assertions
   fail, the same way Task 2.1's prescribed break does.
Restore both, rebuild, and record what each break actually did.

- [ ] **Step 4: Run them to verify they pass**

```bash
cd src/web
npx vite build packages/player
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/player-chrome-shapes.json \
  npx playwright test tests/e2e/player-chrome.spec.ts --workers=1 --reporter=json
```

Expected: PASS — **7 tests per project, 14 in total**, which is Task 2.1's four plus this task's
three, each project. The plan said 9 and was wrong; observed at `bf05b11e` as
`expected: 14, unexpected: 0`, exit 0, the count read from the JSON report. Read
`test-results/player-chrome-shapes.json`.

- [ ] **Step 5: Commit**

```bash
git add src/web/tests/e2e/player-chrome.spec.ts
git commit -m "test(player): the artboard keeps its pixels where there is no letterbox bar to hide in" \
  -m "The 4:3 viewport and the cover artboard: the two shapes in which an assertion that the artboard fits inside its host is either vacuous or false."
```

---

### Task 2.3: The strips that arrive, on the real host

**Files:**
- Create: `src/web/tests/e2e/host-chrome.spec.ts`
- Modify: `src/web/playwright.config.ts:28` — `HOST_SPECS`, so the new file joins the host
  projects rather than the preview ones

**Interfaces:**
- Consumes: the real host started by `webServer` (`playwright.config.ts:97-104`, port `HOST_PORT`
  = 4175, app dir `.e2e-host-app` seeded by `globalSetup`); `e2e-hosted` and `e2e-missing-sensor`
  from `tests/e2e/host-theme.ts:22`, `:32`; the geometry helpers — **import them from
  `player-chrome.spec.ts`, or copy them into this file**, which the executor must decide and say
  why. Importing from a spec file is unusual here; the two numeric constants `PHONE` and the
  `chromeGeometry` reader are what is shared. Prefer moving both into a small helper module
  beside `canvas-probe.ts` if the copy would be the third one.
  **Corrected 2026-10-08, before this task was dispatched: importing is not merely "unusual" and
  the count is not the discriminator.** Playwright's loader registers `test()` against the file it
  is loading, so importing `player-chrome.spec.ts` executes its seven top-level `test()` calls
  while `host-chrome.spec.ts` is loading — a second registration of tests that already have one.
  Nothing in this repo does that today, and a duplicated-title error is the likely shape of
  finding out. It would also require exporting `PHONE`, `chromeGeometry`, `overlap` and the two
  interfaces from a **verified** file. **Copy them instead**, which is the plan's second option
  and what its own Step 1 block implies; `player-chrome.spec.ts` is then left byte-identical. The
  third copy is the one that earns the extraction, and it does not exist yet. Choose differently
  only with a reason that answers the registration problem.
- Produces: `host-chrome.spec.ts`, and a `HOST_SPECS` regex that claims it:
  `/host-(player|settings|media|bleed|chrome)\.spec\.ts/`.

**Constraints.** The host projects pin `workers: 1` (`playwright.config.ts:134`, `:140`) because
their stores are one directory on disk; a new file in this project inherits that and must not
assume otherwise. `phone-host`'s `testMatch` is `/host-player\.spec\.ts/` only
(`playwright.config.ts:139`), so **this file
runs on `desktop-host` (1280×720) and each test sets its own viewport** — do not widen
`testMatch`; it is a scope decision documented at `playwright.config.ts:18-26`.
`page.route("**/ws", route => route.abort())` is the established way to break the transport
(`host-player.spec.ts:1190`) and the comment beside it (`:1180-1189`) records what does *not*
work (`context.setOffline` does not tear down an open stream in this Chromium).

- [ ] **Step 1: Write the tests**

> **Not "the failing tests".** Three of this task's four predecessors in this plan prescribed a red
> run that the fixed code could not produce, and one of them was read as a passed gate. These three
> are expected green on arrival; the failure this task owes is Step 3's break.

```ts
import { expect, test } from "@playwright/test";
import {
  HOST_BLEED_THEME_ID,
  HOST_MISSING_THEME_ID,
  HOST_PORT,
  HOST_THEME_ID,
} from "./host-theme.js";
// Copied from `player-chrome.spec.ts` rather than imported — see Interfaces.
const PHONE = {
  portrait: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
} as const;
// ...and `Box`, `ChromeGeometry`, `chromeGeometry()` and `overlap()` verbatim.

const HOST = `http://127.0.0.1:${HOST_PORT}`;

test("a strip that arrives after the fit takes its room then", async ({ page }) => {
  // The availability strip is raised from the refresh cadence, not at mount
  // (`main.ts:220-222`), so on a real display the first fit happens with no
  // chrome. This is that display: its only binding is a key no provider on this
  // PC reports.
  //
  // **`&data=live` is load-bearing and the test is unreachable without it.**
  // Corrected 2026-10-08, before dispatch: `main.ts:145-146` feeds the display
  // from `createDemoSource` unless the parameter says otherwise, and the demo
  // source fabricates a reading for every key it is asked for — the opposite of
  // a gap. The availability notice is raised on the **live** path only:
  // `main.ts:221` sits inside `if (fake === undefined)`, and `main.ts:356` is
  // inside the live block. A fake-fed display raises `#vigilia-scaffold` at
  // mount instead (`main.ts:206`), which is a strip that arrives *with* the fit
  // rather than after it — so the locator below would poll for 30 s and then
  // fail on a display that is working correctly.
  await page.setViewportSize(PHONE.landscape);
  await page.goto(`${HOST}/?theme=${HOST_MISSING_THEME_ID}&data=live`);
  await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();

  await expect(page.locator("[data-vigilia-availability]")).toBeVisible({
    timeout: 30_000,
  });

  const geometry = await chromeGeometry(page, { width: 640, height: 360 });
  for (const strip of geometry.strips) {
    expect(overlap(strip.box, geometry.painted), `${strip.id} over the artboard`).toBe(0);
  }
  // The artboard took the room the strip needed rather than being covered: it
  // no longer fills the viewport's height, and still fills its host.
  await expect
    .poll(async () => (await chromeGeometry(page, { width: 640, height: 360 })).painted.h, {
      timeout: 10_000,
    })
    .toBeLessThan(PHONE.landscape.height);
});

test("two strips at once leave the artboard more than half the phone", async ({ page }) => {
  // Two strips on one display, which is what makes this the ceiling's case
  // rather than one notice's.
  //
  // **Rewritten 2026-10-08 after the prescribed version was measured
  // unreachable, and the finding is worth more than the test.** It aborted
  // `**/ws` and waited for `[data-vigilia-availability]`, but a gap needs a
  // *sample* to be named: `availabilityNoticeText` returns `undefined` while
  // every reading is `undefined` (`availability-notice.ts:38-40` — "what keeps
  // the strip quiet before the first batch"), and a refused socket never
  // delivers one. So on the real host the data-gap strip and the transport
  // strip are **mutually exclusive**: measured, the prescribed version times out
  // at 32.6 s on the first `toBeVisible`. The gap that needs no sample is a
  // *composition* one, so this takes its second strip from `e2e-bleed`'s
  // unmarked overhang, which is raised at mount by the crop notice.
  //
  // The pair is therefore a composition gap and a transport gap. The pair §97
  // describes — a data gap beside a composition gap — needs a fixture that both
  // bleeds and binds an unreportable key, which no seeded theme is; that is
  // `vg-191`.
  //
  // At 390px that is a 3-line sentence and a 2-line one; the display must still
  // be a display. (Measured: crop 46px, connection 46px, host 753px of 844.)
  await page.route(/\/ws(\?|$)/, (route) => route.abort());
  await page.setViewportSize(PHONE.portrait);
  await page.goto(`${HOST}/?theme=${HOST_BLEED_THEME_ID}&data=live`);

  await expect(page.locator("[data-vigilia-crop]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#vigilia-connection")).toBeVisible({ timeout: 30_000 });

  const geometry = await chromeGeometry(page, { width: 640, height: 360 });
  const chrome = geometry.strips.reduce((total, strip) => total + strip.box.h, 0);

  expect(geometry.strips.length).toBe(2);
  expect(geometry.degenerate).toBe(false);
  // **The host keeps more than half the phone, not the artboard.** A 16:9 or 4:3
  // artboard on a 390x844 portrait display is letterboxed down to ~219px or
  // ~292px *before any chrome exists*, so `painted.h > height / 2` is unreachable
  // here for a reason that has nothing to do with this plan. What the chrome is
  // being asked not to do is eat the display, and that is the host's share.
  expect(geometry.host.h).toBeGreaterThan(PHONE.portrait.height / 2);
  // And the artboard was refitted to what is left, not merely drawn smaller:
  // `contain` fills the host on one axis, and for a 640x360 artboard on this
  // display that axis is the width, so this is an either/or and not a height.
  expect(
    Math.abs(geometry.painted.w - geometry.host.w) < 0.5 ||
      Math.abs(geometry.painted.h - geometry.host.h) < 0.5,
    "the artboard was not refitted to the box the chrome left it",
  ).toBe(true);
  // The ceiling's own number, said once: past half the screen the conversation
  // is about the design, not about this test (Q3 in the plan).
  expect(chrome).toBeLessThan(PHONE.portrait.height / 2);
  for (const strip of geometry.strips) {
    expect(overlap(strip.box, geometry.painted), `${strip.id} over the artboard`).toBe(0);
  }
});

test("a display with nothing to say is a display unchanged", async ({ page }) => {
  // The compatibility claim, on the surface that matters: a healthy stream and
  // a theme whose objects are inside its artboard. The connection strip is
  // drawn at mount and removed when the stream goes live (`main.ts:363`,
  // `:624-627`), so this waits for it — and then reads the fit, because the
  // artboard has to grow back into the room the strip was holding.
  for (const viewport of [PHONE.portrait, PHONE.landscape]) {
    await page.setViewportSize(viewport);
    await page.goto(`${HOST}/?theme=${HOST_THEME_ID}&data=live`);
    await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();
    await expect(page.locator("#vigilia-connection")).toHaveCount(0, { timeout: 20_000 });

    await expect
      .poll(async () => {
        const geometry = await chromeGeometry(page, { width: 640, height: 360 });
        return [geometry.host.w, geometry.host.h, geometry.strips.length];
      }, { timeout: 10_000 })
      .toEqual([viewport.width, viewport.height, 0]);
  }
});
```

- [ ] **Step 2: Run them, and record where they stand**

```bash
cd src/web
npx vite build packages/player
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/host-chrome.json \
  npx playwright test tests/e2e/host-chrome.spec.ts --project=desktop-host --workers=1 --reporter=json
```

> **Corrected 2026-10-08, before this task was dispatched: the expectations below describe the
> pre-Phase-1 layout and none of them can happen.** Phase 1 is committed (`8cb99931`, `bd6e1e29`,
> `66ee3414`), so the availability strip no longer covers the top of the artboard, and
> `document.body` has **three** children — `vigilia-chrome-top`, `#artboard`,
> `vigilia-chrome-bottom` — not one. **This is the same defect Task 2.1's Step 2 carried**, where a
> step asking for an impossible red run was read as a passed gate. **The red run this task needs
> is Step 3's break.** Report the actual counts either way, and report which of the three were
> green.

Expected: **all three green on arrival.** Two of this task's own defects were corrected above
before dispatch — test 1 was missing `&data=live`, without which its availability strip could
never be raised, and test 2's `painted.h > portrait.height / 2` was unreachable because
`e2e-missing-sensor` is 640×360, so at 390×844 `contain` paints ~219px and the letterbox rather
than the chrome takes the rest — **that assertion has since been corrected to the host's share**.

So a green run here is the *baseline*, not the proof: this task's red run is Step 3's break, and
the honest answer to "which failed first" is "none". **If a test does fail, it is a finding about
the host surface rather than about the chrome** — report the failure with its numbers rather than
loosening the assertion, and do not read a timeout as a layout defect before checking whether the
host delivered at all (`vg-143` lives in this project).

- [ ] **Step 3: The deliberate break**

Re-add `position: fixed; left: 0; right: 0; top: 0; z-index: 9` to the availability strip in
`chrome.ts`, rebuild, re-run. **Expected, corrected 2026-10-08: test 1 fails on
`over the artboard` — and test 1 alone.** Restore, rebuild, and record what the break did.

> **Both breaks were then performed and measured, 2026-10-08, and both matched the prediction —
> the first time in this plan that a prescribed break has.** Recorded here so Task 3.2 reports a
> measurement rather than a claim:
>
> - `position: fixed` on the availability strip: **test 1 fails alone**, `vigilia-availability over
>   the artboard`, overlap **31611.67 px²** (844 × ~37.5). Tests 2 and 3 green.
> - `min-height: 70vh` on `#vigilia-chrome-top`: **test 2 fails** on `host.h > 422`, received
>   **207.61** — the band, 590.8 at 844 tall, plus the connection strip — and **test 3 goes with
>   it** on `toEqual([390, 844, 0])`. Test 1 stays green, because it asserts only that the painted
>   box is shorter than the viewport and that no strip overlaps it.
> - Green re-run after both restores: **3 expected / 0 unexpected / 0 flaky**, with
>   `git diff --stat src/web/packages/player` empty.

> **Why test 2 cannot fail on this break, worked out before dispatch rather than discovered in the
> run.** `computeArtboardTransform` centres (`renderer-core/src/artboard.ts:83-84`,
> `offsetY = (viewportHeight - scaledHeight) / 2`). At 390×844 with a 640×360 artboard, `contain`
> binds on width, so the painted box is ~219px tall and sits at y ≈ 312 — reached by neither a
> `top: 0` nor a `bottom: 0` fixed strip. The portrait letterbox absorbs the break exactly the way
> it absorbed the original defect, which is the whole reason Task 2.1's discriminating case was
> the landscape one. Test 2's remaining assertions (`strips.length`, `host.h > half`) are all
> *satisfied* by a fixed strip, because a collapsed band makes the host the full viewport.
>
> **If test 2's ceiling assertion is to be proven rather than assumed, the break for it is a band
> given a height** — `min-height: 70vh` on `#vigilia-chrome-top` in `index.html` drops `host.h` to
> ~254 and fails `host.h > 422` while leaving `chrome` (the sum of *strip* heights) small. Perform
> it if you want that assertion live, and **say which breaks you performed and what each one
> actually failed** — a break whose description does not match its result is the defect this plan
> has now hit four times.

> **Corrected 2026-10-08 from Task 2.2's measured breaks, before this task was dispatched: two of
> the three descriptions below do not match what the breaks actually do, and a third break is
> needed.** Task 2.2 performed the equivalent breaks on the preview spec and observed:
>
> - **The crop-strip break reaches only the tests whose theme raises a crop strip.** `portrait-cover`
>   raises none (only `vigilia-scaffold`), so a break inside `showCropNotice` cannot fail a cover
>   test. The equivalent here is narrower than it looks: both themes do raise the availability
>   strip, because both now carry `&data=live` — but only test 1's assertion is reached by it, for
>   the centring reason given above. **Which tests a break reaches is a measurement, not a
>   deduction: report the failures you saw.**
> - **Deleting `flex: 1 1 auto` from `#artboard` does not produce "the host assertions fail".**
>   Measured: `#artboard` collapses to zero height, the canvas is never visible, and every test that
>   waits for ink dies in a 30 s timeout. A real break with the wrong description — the description
>   is corrected here so a timeout is not read as a new class of failure.
> - **The break that actually proves a cover/strip test can fail is a `position: fixed` scaffold
>   banner**, which failed two tests in Task 2.2. If the prescribed breaks leave the discriminating
>   assertion unproven, find the break that does fail it, observe it, and say which one worked.

- [ ] **Step 4: Run them to verify they pass**

```bash
cd src/web
npx vite build packages/player
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/host-chrome.json \
  npx playwright test tests/e2e/host-chrome.spec.ts --project=desktop-host --workers=1 --reporter=json
```

Expected: PASS, 3 tests — **and the count is not to be taken from this line, which has been wrong
three times in this plan; report the number the run gave.** **Landed 2026-10-08 as `1e52b8da`:
`expected: 3, unexpected: 0, flaky: 0, skipped: 0`, read from
`test-results/host-chrome.json`.** **`vg-143` lives in this project** (`host-player.spec.ts`'s units spec
timing out on the real host, which times out in isolation too) — it is not this plan's, and this
file must not be made flaky alongside it: if a test here times out, check whether the host
delivered at all before blaming the layout.

- [ ] **Step 5: Commit**

```bash
git add src/web/tests/e2e/host-chrome.spec.ts src/web/playwright.config.ts
git commit -m "test(player): the strip that arrives late still takes its room, on the real host" \
  -m "Also pins the case the whole change rests on: a healthy display with nothing to say gets the whole viewport, and gets it back when the transport strip clears."
```

---

## Phase 3 — Closing (2 tasks)

---

### Task 3.1: The register names the owner

**Files:**
- Modify: `docs/architecture/ownership.md` — one row, in the table that already carries the
  player's other entry (`:192`, the row beside `player/src/theme-loader.ts`)

**Interfaces:**
- Consumes: `chrome.ts` and its exported names (Task 1.1).
- Produces: nothing code reads. This is the register's half.

- [ ] **Step 1: Add the row**

The document's rule is one owner per concept; before this plan the player's chrome had none, and
its *Known ownership gaps* section names only stale-reading treatment and colour parsing.
Add, beside the existing player row:

```markdown
| The display's own chrome — the strips it is told by, and the room they take from the artboard | `player/src/chrome.ts` |
```

- [ ] **Step 2: Run the ownership gates, which is what makes the row more than prose**

```bash
cd src/web
npm run ownership:sweep
npm run ownership:overlap
npm run status:check
```

Expected: the sweep reports the same findings it reported before this task — **a new finding
here is this plan's, and a pre-existing one is not**; record which is which in your report.
`status:check` is run here only to prove this change did not touch `STATUS.md` (it does not).

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/ownership.md
git commit -m "docs(architecture): the display's chrome has an owner"
```

---

### Task 3.2: Walk the phone, and hand over what is owed

**Files:**
- No source change. This task produces a report, and reverts nothing.
- Read (do not modify): `docs/evidence/screenshots/README.md`, `STATUS.md`, `docs/product/backlog.jsonl`

**Interfaces:**
- Consumes: every phase above.
- Produces: the walk's evidence, and the four open questions (**Q1-Q4** in the design section)
  surfaced to the controller rather than settled.

- [ ] **Step 1: Re-run the suites the layout could have broken**

```bash
cd src/web
npx vite build packages/player
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/player-chrome-close.json \
  npx playwright test tests/e2e/display-fabric.spec.ts tests/e2e/host-bleed.spec.ts \
  --workers=1 --reporter=json
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/player-chrome-host-close.json \
  npx playwright test tests/e2e/host-player.spec.ts tests/e2e/host-media.spec.ts \
  --project=desktop-host --workers=1 --reporter=json
```

Why these four and no more: `display-fabric.spec.ts` owns the player's visible behaviour
including the fit modes and the load-failure page (`:663-687`);
`host-bleed.spec.ts` is the existing reader of `[data-vigilia-crop]`; `host-player.spec.ts` is
the existing reader of `#vigilia-connection` in **eleven** places (`grep -c`, corrected 2026-10-08
from a remembered nine); and `host-media.spec.ts:408`
screenshots `#artboard` itself, so it is the one spec that could notice the host changing from
an absolutely-positioned overlay into a row. Names to expect in the failures and not to fix
here: `vg-140` (`display-fabric.spec.ts`'s intermittent fit-mode ink read), `vg-143`, and the
Playwright 1.63.0 trace-teardown `ENOENT`.

> **Walked 2026-10-08, and the failures were none of those three.** Both suites were red on
> arrival with a defect this plan caused and this task's own text did not anticipate: `#artboard`
> was `position:absolute; inset:0` before Phase 1, so every assertion deriving an expected box
> from `page.viewportSize()` was correct then and wrong now. Three failures in
> `display-fabric.spec.ts` (`662` against `720`, `748` against `839`, `842` against `900`) and one
> in `host-player.spec.ts` (`expectContainFit`, scale `0.7768` against a viewport-derived
> `0.8077` — the 29px of chrome over 941; it reaches only the read where `contain` binds on
> height). **Fixed on the fly at `c145598a`, not filed**, because the cause is named with a line,
> the fix is in one owner per file, and the correct behaviour is this plan's own requirement.
> **The lesson is the one this plan keeps re-learning: a step that predicts which tests will fail
> is a step that has not run them.**

- [ ] **Step 2: Look at the captures the change affects**

```bash
cd src/web
VIGILIA_CAPTURE=1 npx playwright test tests/e2e/host-player.spec.ts \
  --project=desktop-host --grep "plays the reference composition" --workers=1
```

One run: `player-reference` (`docs/evidence/screenshots/README.md`, the Player row) is the
registered capture that shows the display, so the change must be visible in it, and
`publish-loop-live`'s row is affected the same way. **Inspect both PNGs**: a `player-reference`
that still shows a notice over the artboard is a failure of this plan; one that shows the
artboard smaller with the notice beside it is the change working. This plan adds no capture
other than Task 2.1's, so no README row is added or edited here.

- [ ] **Step 3: Report, and do not settle the questions**

Your report says, in its own words and with the numbers you read:
- the four questions **Q1-Q4** are open and unowned by this plan, each with the default the
  plan implemented, so the controller can put them to the user;
- every prescribed break: what it was, what it did, and whether it failed;
- which of the tests in Tasks 2.2 and 2.3 were **green on arrival** (a test that never failed is
  still worth keeping, and it is not evidence that the defect existed);
- **the two handles this plan found stale — and both are already closed, so report them as
  closed rather than as outstanding** (corrected 2026-10-08): `§151` was cited at
  `packages/player/index.html` and defined nowhere in `docs/product/requirements.md`, and Task
  1.1's Constraints block ordered the marker dropped, which `8cb99931`'s diff is — the sentence
  keeps its substance and the marker that remains, `§57`, resolves at `requirements.md:89`; the
  scaffold banner's missing `id` was given one by Task 1.2. The register row for the first,
  `vg-180`, is closed as verified with a check and that sha;
- anything in *What is already true* that a measurement contradicted.

- [ ] **Step 4: No commit**

This task changes no file. If it changes one — a corrected number in a doc, a comment — commit
it explicitly with `docs(player): <what was wrong>` and say in the message which claim it
corrects.

> **Walked 2026-10-08, and it changed files after all — the Step 1 correction above is why.**
> Suites after the fix: `display-fabric` + `host-bleed` = **53 expected / 0 unexpected / 0
> flaky**, `host-player` + `host-media` (`desktop-host`) = **28 / 0 / 0**, both from JSON
> reports, with the two skips being the by-design project guards; the fixes landed as
> `c145598a`. Both registered captures were **re-taken rather than merely inspected**, because
> the copies on disk predated Phase 1 and a stale capture is not evidence of anything:
> `player-reference` now shows the amber availability strip in its own band above an artboard
> whose top edge — the `VIGILIA` wordmark — is no longer under it, and `publish-loop-live` shows
> the connection strip in the bottom band with the artboard clear of it. Both PNGs were opened
> and read, not judged by size.
>
> **The plan's own warning held: the four open questions Q1–Q4 are unowned and go to the
> controller**, and `vg-191` and `vg-192` are the two rows this plan's last phase filed rather
> than settled.

---

## Self-review

Run against the plan, not against the intention.

**1. Spec coverage.** The spec's own sentence for plan 8 is one line (`:474`), and this plan's
whole content is that line: the two strips that overlay the artboard stop overlaying it, by
construction, at every shape measured. Checked against the four boundaries the brief named:
Sequencing (`:459-480`) — this plan is row 8, it owns no other row, and it names 9's territory in
*Out of scope*; Invariants (`:482-496`) — no Fabric object is mirrored in React (no React at
all), `renderer-core` is untouched, the crop counting has one owner, no reading is fabricated,
no second scene tree, and every element added is transient; Non-goals (`:498-504`) — no new
product surface, no decoration, no motion, no responsive themes, no mobile authoring (the editor
is untouched); Acceptance (`:506-543`) — **no acceptance item is this plan's**, which is why the
plan's proof is the measurement rather than a checklist item, and the report must say so rather
than implying an acceptance item closed.

**2. Placeholder scan.** No "TBD", no "add appropriate handling", no "similar to Task N". Two
places name a value the executor must read rather than trust — the `portrait-cover` and
`assets` artboard sizes in Task 2.2, and the fixture ids in Task 2.3 — and both say where to read
it. That is deliberate: a number copied into a plan is a number that goes stale.

**3. Type consistency.** `ChromeSide`, `chromeBand`, `putStrip`, `removeStrip` are spelled the
same in Task 1.1's interfaces, its code, its tests and Tasks 1.2-1.3. The four writers keep the
signatures they have today, so `main.ts`'s call sites do not move except for `showLoadFailure`,
whose parameter list changes once and is named in Task 1.3 along with both call sites.
`chromeGeometry`, `overlap` and `PHONE` are defined in Task 2.1 and consumed in 2.2 (same file)
and 2.3 (**copied**, corrected 2026-10-08: importing a spec file would re-register its own
`test()` calls a second time, because Playwright binds them to the file being loaded, so the
second copy is the right answer until a third one exists).

**4. Review Focus.** Five lines, five owning tasks, each pinned by a named test: the late strip
(Task 2.3, test 1), several at once (2.3, test 2), the 4:3 viewport (2.2, test 1), the cover
artboard (2.2, test 2), the failure page (1.3 in jsdom, 2.1 in the browser). None of the five
is a duplicate of another, and none is covered by a test that only counts objects.

**5. What the requirement implies that no task here does.** Named rather than hidden:

- **`env(safe-area-inset-*)` is added on the strips and cannot be verified on this machine.**
  A desktop Chromium reports zero insets, so no test here exercises a notch. Task 1.1 adds it
  because the band is in flow and a strip under a system bar is unreadable, but the report must
  say it is unproven on a notched device. It is the plan's one unverifiable change.
- **No test measures how a *reader* experiences the resize** when a strip appears on a live
  display. Task 2.3 proves the fit changes; nothing proves it is not jarring, and that is **Q2**.
- **`window.vigilia.handle.transform()` is a development handle**, so the geometry tests read the
  renderer's intent rather than its paint. The `painted` box is arithmetic on that transform; a
  renderer that reported a transform it did not paint would pass. The guard test in Task 2.1 and
  the capture in its Step 5 are the two things that see actual pixels, and neither reads the
  canvas — an ink measurement over the strip's band, in the shape `drawnFractionIn` already
  provides (`canvas-probe.ts:356`), is the stronger instrument if a reviewer wants one.
