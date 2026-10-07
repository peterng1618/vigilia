# Publish loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish answers one question — *put this on the phone*. The editor header
carries the address and a QR code for it, LAN serving becomes a control rather than a CLI
flag, and a phone showing a theme keeps showing it while the author edits it. The
Preview/Live switch stops being described as fake data and starts saying what its two
readings actually are.

**Architecture:** Publishing is **three separate owners**, and this plan adds the three
that do not exist. **One** — the switch's vocabulary — is already built and only its words
change: the two readings are real, both survive, and neither is inferior.
**Two** — reaching the phone — is a *hosting* concern the host already half-owns:
`lanAddress()` finds the address, `pairing.ts` mints the token, `main.ts` is the only thing
that decides whether the LAN is bound at all, and that decision is currently a CLI flag.
The plan moves the binding decision to a runtime control and adds a loopback-only
`/api/hosting` so the editor header can read it and render the address and QR.
**Three** — the phone following the editor — is a new host-owned *published document*: an
in-memory overlay that a display prefers over the stored theme, plus a revision the player
follows. The editor never becomes the display's owner; it publishes and stops.

**Tech Stack:** TypeScript, React 19 for the shell chrome (Base UI `Menu` for the header
surface — §8's migration to Radix is plan 9's and this plan adds no new UI library),
`qr` for the QR encoder (0 dependencies, MIT, decided in
[`docs/decisions/0032`](../../decisions/0032-a-qr-symbol-is-encoded-by-a-dependency.md)),
`jsqr` as a devDependency only for the decode round-trip, Node `http`, Vitest + jsdom,
Playwright against built bundles.

**Spec:** [`../specs/2026-10-03-dashboard-authoring-design.md`](../specs/2026-10-03-dashboard-authoring-design.md)
— plan 6 of 9. Read §6 to its end (`:374-395`), the §*Acceptance* bullet at `:546`, and the
§*Sequencing* table row 6 at `:476`. §145 itself is
[`../../product/requirements.md:331-339`](../../product/requirements.md). The one test
every task is judged by is the spec's own: *does this change remove a step, or does it
remove a freedom?*

---

## What is already true — do not rebuild

Verified against the source at `0f95f2a6`, the commit this plan was written from. **A task
that rebuilds any of this has misread the plan.** Plan 5 was materially smaller than its
title because part of it had already landed; measuring first is the whole reason this list
exists.

1. **The Preview/Live switch exists and already does what §6 describes.**
   `shell-layout.tsx:316-327` renders a `ViewSetting` labelled `uiCopy.view.dataSource`
   with exactly two options, `preview` and `live`; `editor-main.ts:89-104` owns
   `EditorViewControls.setSourceMode`, and `live-source.ts:9-27` routes `"preview"` to
   `createPreviewSource({ keys })` — which answers for **every key the theme names** — and
   `"live"` to the host's sample stream. The behaviour §6 asks for is built. **Only the
   words change.**
2. **The switch is *not* in canvas controls, and §6's parenthetical is false.**
   `:391-392` says it "stays in canvas controls where the canvas is (plan 1, task 4)".
   `src/web/packages/editor/src/editor-shell/canvas-view-controls.tsx` — the file that plan
   1's Task 4 names, and the file that task was to create — **does not exist**, and the
   View settings still live in the header's `ShellMenuBar` (`shell-layout.tsx:315-352`).
   The unlanded plan is `docs/superpowers/plans/2026-10-03-editor-left-column-and-header.md`,
   its Task 4 is `:265-309`, and the row that queues it is **`vg-161`**, which this plan's
   brief lists as deliberately not ours. **This plan therefore changes the copy where the
   switch actually is and does not move it.** See *Out of scope*.
3. **Nothing user-visible says "fake data".** `rg -i "fake"` over editor, host,
   renderer-core and player source returns: `preview-source.ts` importing
   `FakeSampleSource` from `@vigilia/fake-source`, three identifiers in
   `player/src/main.ts`, and **one visible string** — `player/src/ui-copy.ts:74`,
   `syntheticData`, which is the player's §97 disclosure that a *fixture* display is showing
   invented values, not the editor's switch. So §6's "stop describing it as 'fake data'" is
   a change to the *framing* of two words in the View menu, and the player's honest
   disclosure is **left exactly as it is** — weakening it would break §97 rather than
   satisfy §6.
4. **`lanAddress()` exists and is exported.** `src/web/packages/host/src/cli/net.ts:90`,
   re-exported at `src/web/packages/host/src/index.ts:22`. It returns the **first**
   non-internal IPv4 across `os.networkInterfaces()`. `main.ts:250-258` prints
   `Phones on this Wi-Fi: http://${lan}:${bound}` to the terminal — that print is the
   flag-shaped surface §145's control replaces. It **stays**: a terminal-launched host
   should still say where it is.
5. **`pairing.ts` is §145's own owner and is complete.** 32 bytes of CSPRNG, base64url,
   constant-time comparison, a 12-hour default TTL, minted and revoked only from loopback
   (`server.ts:406-447`), read from a `?session=` query or an `x-vigilia-session` header
   (`server.ts:378-391`). **Do not touch it.** The control *mints from* it; it does not
   change it.
6. **The header is `shell-layout.tsx:459-478`** — `<header className="editor-shell-header
   editor-glass">` holding the brand, the tagline, `ShellMenuBar`, `PaletteMenu` and the
   Save button. It is on `scripts/reuse-gate.mjs`'s watchlist, and running the gate shows a
   write to it is **already allowed**: `docs/decisions/0029-a-persistent-host-is-moved-into-its-slot.md`
   claims the path. `docs/decisions/0032` now claims it too, for the QR's own reason.
7. **`active-theme.ts` is *not* the editing path.** It stores **which saved theme the host
   displays** (`read`/`write`/`clear` over `active-theme.json`), and `server.ts:1113-1160`
   resolves `/` through it: an explicit `?theme=` wins, then the stored choice, then the
   only theme if there is exactly one. The editor edits a document **in memory** and writes
   it only on an explicit Save (`editor-session.ts:693`, reached from
   `shell-layout.tsx:470-477`). So "the phone shows what you are editing" is **neither**
   that store nor a second path: nothing carries the editing document to a display. That is
   Phase 4.
8. **The editor preview cannot reach a host.** `createThemeLibraryClient()` uses
   `baseUrl: ""` (`theme-library-client.ts:96-104`), so the editor fetches same-origin.
   Under `vite preview` (`playwright.config.ts` treats 4174/4223 as the editor) that is the
   preview server, which answers `/api/*` with a 404. **Every browser task below that needs
   a host drives the editor through the host's own `/editor/` mount**, which is
   loopback-only (`server.ts:1085-1109`) exactly as the editor is — so the browser test
   itself must run from `127.0.0.1`, which Playwright does.
9. **No QR code, no QR dependency, and no QR decision existed before this plan.**
   `docs/decisions/0032` records the seven rungs and the choice.

---

## Global Constraints

Copied from the spec and from §145 where it states them, verbatim where it does; every
task's requirements implicitly include this section.

- **Fabric stays imperative behind the editor boundary.** The header is React chrome; it
  never holds, mirrors or diffs a Fabric object. The switch's two readings and the publish
  state are primitives, not scene state.
- **One owner per concept.** Read `docs/architecture/ownership.md` and the existing owner
  before adding a type, key, default, action, route, helper, style property or schema
  value. This plan already names the owners it extends: `lanAddress()` for the address,
  `createSessionStore()` for the token, `uiCopy` for every visible word, `HostServerOptions`
  for the host's own configuration.
- **`renderer-core` stays Fabric- and DOM-free.** Nothing added here reaches it. The player
  may use `scene-fabric`, never editor UI or managers.
- **Persist authored state only (§67).** Where a display was pointing, which token was
  minted, and the published overlay are runtime state; they are never written into a theme,
  and the only thing this plan persists is the *hosting preference* — a fact about this PC.
- **Never fabricate a reading (§97).** A display with no host shows a gap or its own
  disclosure; a missing or non-`ok` reading is never rendered as zero or default.
- **Fabric JSON is the persisted scene. No second scene tree (§134).** Publishing carries
  the envelope the editor already holds; it does not introduce a simplified tree, and the
  display continues to run `buildScenePlan` from a `FabricThemeEnvelope`.
- **Editor-shell theming stays separate from authored theme globals (§35).** The QR is
  chrome and takes chrome colours, and it **does not** take them from the shell palette —
  see Task 2.3's failure mode.
- **§145 governs everything here.** Localhost administration remains available with LAN
  off. LAN serving is **explicit opt-in**. Phones pair with short-lived, revocable
  sessions. Editing is localhost-only by default. **Plain LAN HTTP has no confidentiality;
  never suggest internet exposure** — the surface that turns the LAN on must say so.
- **Licence duty for new dependencies.** Verify the licence from package metadata, then
  update `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md`. No hand-edits to
  `package-lock.json`; change the manifest and run `npm install`.
- **No `.md` report files.** Findings are returned as text and filed as backlog rows.
- **Every task's commit updates `STATUS.md`.** Replace its "Last completed change" with a 1–5
  bullet summary of that commit — one item per line, never wrapped, and never appended to —
  then run `npm run status:check` from `src/web/` and judge it by exit code. The file's own
  bullet limits are the limit. This is a Global Constraint rather than a line in fifteen Files
  blocks because a task that forgets it leaves the handoff stale, which is exactly what plan 5
  did for six tasks.

### Verification rules that cannot be guessed

- **Typecheck is judged by exit code**, and the command is `npm run typecheck` from
  `src/web/` (a workspace-wide `--workspaces --if-present` run). A typecheck "pass" means
  the process exited 0; do not read the log.
- **Lint is `./node_modules/.bin/biome lint ..` from `src/web/`.** `biome check` is **not**
  a gate and must not be used as one — it reports formatter differences as errors and would
  make every task red for reasons this plan does not own.
- **`npm run format:check` is also a gate**, run from `src/web/`. Plan 5 ended with this
  red because its constraint list named `biome lint` alone, which does not check
  formatting. Every task's final step runs both.
- **Playwright never uses the shared MCP browser.** Run it as a CLI, always
  `--workers=1`, and read results **from the JSON report file**: pass `--reporter=json`
  together with `PLAYWRIGHT_JSON_OUTPUT_NAME` pointing at a path under
  `src/web/test-results/`, then read that file. Do not read a passing/failing summary off
  stdout, and never run a spec through the MCP Playwright tools.
- **Playwright previews built bundles.** Any change to editor, player or host source
  requires the matching build (`npx vite build packages/editor`, `packages/player`;
  the host is TypeScript) **before** the browser run, and again after reverting a
  deliberate break.
- **A new regression test must fail when the fix is disabled before it is trusted.** Every
  task that adds one says, in its own steps, how it was disabled and what failed.
- **Visible behaviour needs rendered browser inspection**, not object counts or geometry
  assertions. A green unit test is not a proof that a header shows an address.
- **`npm run gates:self-test`** from `src/web/` after touching anything under `scripts/` or
  a gate's subject.
- **`shell-layout.dom.test.tsx` is slow for a filed reason, not a new one.** `vg-135`: jsdom
  stops firing `requestAnimationFrame` after the View-menu test, so any later test in that
  file that awaits a frame times out — measured, a bare `setTimeout(0)` cost 2 ms before the
  View-menu click and 58 592 ms after. Tasks 1.1 and 2.3 both run this file, and a run that
  hangs or takes minutes is **that row, not your change**. Prove the assertion you actually
  touched by narrowing it (raise the per-test timeout, or run the View-menu test by name),
  and report the condition with its row id. **Do not fix `vg-135`** and do not edit its
  backlog entry — it is not this plan's.
- **A prescribed break that does not break is a plan defect, not a passing test.** Two of this
  plan's own break-proof steps were measured **inert**: Task 1.2's inversion break leaves all
  three tests green because `jsqr` attempts inversion, and Task 2.1's `lan`-only break leaves
  all five green because the sibling guards reject the same body. If the break you were told to
  make leaves the suite green, **do not conclude the test is fine and do not edit the tests to
  make them fail.** Find a break that does fail, observe the failure, restore, and say in your
  report what the prescribed break actually did. A green run after a break proves only that the
  break was in the wrong place.

---

## Review Focus

The spec is a vision document: it says what publishing must do, not everything it will
meet, and its silence is not permission. These are the five inputs most likely to bite a
person using this software, most likely first, and **each one is pinned by a test in the
task that owns the code** — the task is named in brackets.

1. **A machine with more than one non-internal IPv4.** Laptops routinely carry a Hyper-V
   virtual switch, a WSL adapter, a Docker bridge or a VPN alongside the Wi-Fi address.
   `lanAddress()` returns whichever `os.networkInterfaces()` yields first, so the QR can
   encode an address **no phone on the Wi-Fi can reach**, and the failure is invisible on
   the machine that produced it. A person expects the address their phone can reach.
   [Task 1.3 — the host owns the address, and the owning task records the gap rather than
   guessing a fix; pinned by a test that the header renders *the host's* answer and never
   composes one of its own.]
2. **The QR under a dark shell palette.** The editor is warm cream glass but ships six
   palettes. A QR drawn from palette tokens inverts to light-on-dark, which many scanners
   refuse, and the editor that produced it looks perfectly fine. A person expects the code
   to scan whatever palette they are in. [Task 2.3 — pinned by a test that the rendered
   modules and background are the fixed ink and paper, not a `--vigilia-*` token.]
3. **The address changing under a live publish.** DHCP re-leases, a dock is unplugged and
   Wi-Fi joins, a VPN connects. The header shows an address it read once, and the QR goes
   stale without anything on screen changing. A person expects the header to say where the
   phone should go *now*. [Task 2.3 — pinned by a test that re-reading is driven by the
   host's answer and that a change replaces the rendered address and matrix.]
4. **A phone that reconnects after the session expires.** `pairing.ts` defaults to a
   12-hour TTL; a display that slept overnight comes back to a 403 and a page that shows
   nothing about why. A person expects to be told the pairing expired rather than to see a
   blank screen. [Task 1.3 carries the expiry to the header; Task 4.3's follower must not
   treat a refusal as "no change", or the display silently stops following.] **The blank
   page itself is `server.ts`'s and is not fixed here** — see *Out of scope*.
5. **An editor closed while publishing.** The overlay lives in the host's memory, so a
   display keeps showing the last published document after the author has gone, and
   §145's "explicit opt-in" reads as though nothing is being shared. A person expects
   publishing to stop when they stop. [Task 4.4 — a `stop()` that sends `DELETE`, called
   from `pagehide`; Task 4.5 — a browser test that closes the editor page and asserts the
   host's published id goes back to `null`. The residual ceiling — a crash, a killed
   tab — is marked with `ponytail:` rather than silently accepted.]

---

## Out of scope

- **Moving the View settings into canvas controls.** §6 says the switch "stays in canvas
  controls where the canvas is (plan 1, task 4)"; that task never landed and the file it
  names does not exist (see *What is already true*, 2). The work that would land it is
  **`vg-161`**, which this plan's brief lists as deliberately not ours. This plan changes
  the copy where the switch actually is.
- **Renaming `@vigilia/fake-source`, `FakeSampleSource`, `createPreviewSource`, or the
  `"preview"` discriminant.** §6 asks to stop *describing* the source as fake, not to
  rename the owner. A rename would touch the player, both build configs and every fixture
  for no user-visible gain.
- **The player's `syntheticData` banner** (`player/src/ui-copy.ts:74`) and the fixture
  themes it describes. It is §97's honest disclosure that a *fixture* display shows
  invented values, it is not the editor's switch, and weakening it would be a §97
  violation dressed as a §6 change.
- **The host settings page's Hosting section.** `specs/2026-10-02-frontend-redesign-design.md:353`
  puts a hosting section there with the toggle, address and QR. That spec's chrome work is
  a different plan; this plan's surface is the **editor header**, which is what §6 of the
  dashboard-authoring spec asks for. One owner, one surface.
- **§8's Radix migration, Dialogs, Collapsibles and the `?` reference.** Plan 7 (Keyboard)
  and plan 9 (Chrome) have no plan files. This plan adds no UI library and uses Base UI
  `Menu`, the primitive every existing header surface already uses.
- **The pinned-backlog work:** `vg-153`, `vg-154`, `vg-155`, `vg-156`, `vg-119`, `vg-151`,
  `vg-157`–`vg-160`, and plan 5's review findings `vg-161`–`vg-170`. The font catalogue
  plan stays on hold.

---

## Phase 1 — What the switch means, and where the phone goes (3 tasks)

Delivers: the two readings are named for what they are, and the host can answer where a
phone should point.

---

### Task 1.1: The switch's two readings, named

**Files:**
- Modify: `src/web/packages/editor/src/ui-copy.ts` — the `view` block at `:327-337`
- Modify: `src/web/packages/editor/src/live-source.ts:15`
- Modify: `src/web/packages/editor/src/editor-main.ts:106-113`
- Test: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`
- Test: `src/web/packages/editor/src/ui-copy.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `uiCopy.view.{dataSource, preview, live, previewDetail}` — four strings, read
  by `shell-layout.tsx:317-327` (existing) and `editor-main.ts` (new).

**Constraints.** One owner: every visible word is in `ui-copy.ts` (§35), so the string
`"Preview data"` currently hardcoded in `live-source.ts` moves there. `live-source.ts` is
in the editor package, so the import is a sibling, not a package edge. The `"preview"` /
`"live"` *discriminants* do not change — only what a reader sees.

- [ ] **Step 1: Write the failing test**

Append to `src/web/packages/editor/src/ui-copy.test.ts`:

```ts
/**
 * §6: the two readings answer different questions, and neither is the fallback
 * for the other. The words have to say which question each one answers — an
 * author building a theme for somebody else's machine reads this menu before
 * they discover the theme names a sensor their PC does not have.
 */
it("names each reading for the question it answers", () => {
  expect(uiCopy.view.preview).toBe("The theme's sensors");
  expect(uiCopy.view.live).toBe("This machine");
  expect(uiCopy.view.dataSource).toBe("Readings from");
  expect(uiCopy.view.previewDetail).toBe("every sensor this theme names");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/ui-copy.test.ts`
Expected: FAIL — `uiCopy.view.previewDetail` is `undefined`, and `preview` reads `"Preview"`.

- [ ] **Step 3: Write the minimal implementation**

In `src/web/packages/editor/src/ui-copy.ts`, replace the `view` block:

```ts
  /** The View menu. Each setting names itself and its current value; the values
   *  are listed here rather than composed from a number and a unit, so the menu
   *  cannot say `1` and leave the reader to guess FPS from the neighbour.
   *
   *  The two readings answer different questions (§6): one answers for every
   *  sensor the theme names, the other for what this machine reports. Neither is
   *  the fallback for the other, so neither is called a preview of the other. */
  view: {
    dataSource: "Readings from",
    chartRefresh: "Chart refresh",
    preview: "The theme's sensors",
    live: "This machine",
    previewDetail: "every sensor this theme names",
    valueRuns: "Value runs",
    tokens: "tokens",
    values: "values",
    fps30: "30 FPS",
    fps1: "1 FPS",
  },
```

In `src/web/packages/editor/src/live-source.ts`, import the copy table and use it:

```ts
import { createPreviewSource } from "./preview-source.js";
import { uiCopy } from "./ui-copy.js";
```

```ts
  if (options.mode === "preview") {
    options.onStatus("live", uiCopy.view.previewDetail);
```

In `src/web/packages/editor/src/editor-main.ts`, the status line stops hardcoding the two
words:

```ts
import { uiCopy } from "./ui-copy.js";
```

```ts
      onStatus: (sourceStatus, detail) => {
        const label = mode === "preview" ? uiCopy.view.preview : uiCopy.view.live;
        status.textContent = `${label}: ${detail ?? sourceStatus}`;
      },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/editor/src/ui-copy.test.ts packages/editor/src/editor-shell/shell-layout.dom.test.tsx`
Expected: PASS. The existing View-menu assertion at `shell-layout.dom.test.tsx:804`
compares against `uiCopy.view.*` **symbolically**, so it moves with the strings and needs
no edit — if it fails, something hard-coded the old words and that is the bug.

- [ ] **Step 5: Prove the test can fail**

Change `previewDetail` back to `"Preview data"` and re-run Step 4. Expected: FAIL on the
`previewDetail` assertion. Restore it.

- [ ] **Step 6: Look at it**

Build the editor and open the View menu in a browser:

```bash
npx vite build packages/editor
npx playwright test tests/e2e/editor.spec.ts --workers=1 --reporter=json
```
with `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/task-1-1.json`, then read that JSON. The
menu must read **Readings from: The theme's sensors**, and the status line must read
**The theme's sensors: every sensor this theme names**. Screenshot it.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/ui-copy.ts \
        src/web/packages/editor/src/live-source.ts \
        src/web/packages/editor/src/editor-main.ts \
        src/web/packages/editor/src/ui-copy.test.ts
git commit -m "feat(editor): the two readings are named for the question each answers"
```

**As executed — `00f370f0`.** Two claims above were wrong and one list was short:

- **Step 6's status-line reading is false at rest.** `editor-main.ts` writes `Fabric editor
  ready` after mount, which overwrites the source's status, so the new words reach the status
  line only once a reading is *chosen*. The menu label is correct the moment the menu opens.
  Both were read in a browser; assert the status line after a choice, not at `goto`.
- **"Screenshot it" had no registered action to attach to.** `docs/evidence/screenshots/README.md`
  admits captures only for the actions it lists, and none covers the View menu, so the check ran
  from a temporary spec under `tests/e2e/` which was then deleted. The image is at
  `test-results/task-1-1/view-menu.png` (gitignored). **`editor.spec.ts` does not cover the View
  menu at all**, so these labels are pinned by `ui-copy.test.ts` and by nothing in a browser.
- **Step 7's `git add` list omitted `STATUS.md`**, which the Global Constraints require in every
  task's commit. The executed commit carries it.

---

### Task 1.2: The QR encoder, and the round-trip that proves it

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/qr-code.ts`
- Create: `src/web/packages/editor/src/editor-shell/qr-code.test.ts`
- Modify: `src/web/packages/editor/package.json` — `dependencies.qr`
- Modify: `src/web/package.json` — `devDependencies.jsqr`
- Modify: `THIRD-PARTY-NOTICES.md`, `docs/engineering/dependencies.md`

**Interfaces:**
- Consumes: `docs/decisions/0032` — the decision is already taken; do not re-open it.
- Produces:
  - `export const QUIET_ZONE_MODULES: number` — `4`.
  - `export function qrMatrix(text: string): readonly (readonly boolean[])[]` — one row
    per module row, `true` for a dark module, each row the same length.
  - The devDependency `jsqr`, used only by the test.

**Constraints.** The module produces **data, never markup**: `encodeQR(url, "svg")` returns
an SVG string, and the header would have to trust it through `dangerouslySetInnerHTML`.
`"raw"` returns `boolean[][]` and keeps the rendering ours. Licence duty applies: verify
`qr` and `jsqr` from their package metadata before writing the notice rows.

- [ ] **Step 1: Write the failing test**

Create `src/web/packages/editor/src/editor-shell/qr-code.test.ts`:

```ts
import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { QUIET_ZONE_MODULES, qrMatrix } from "./qr-code.js";

/** The payload this has to carry: what `main.ts` composes for a paired phone —
 *  a LAN address, the host's port, and the 43 characters `pairing.ts` mints
 *  from 32 bytes of CSPRNG. 77 characters, measured (§6 probe). */
const URL = `http://192.168.1.42:5227/?session=${"a".repeat(43)}`;

/** One block per module, at `scale` pixels a side, as the RGBA bytes a decoder
 *  reads. Written by hand rather than through a canvas: the decode is the claim,
 *  and a rasteriser that could be wrong would be a second thing to distrust. */
function rasterise(
  matrix: readonly (readonly boolean[])[],
  scale: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  const rows = matrix.length;
  const columns = matrix[0]?.length ?? 0;
  const width = columns * scale;
  const height = rows * scale;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dark = matrix[Math.floor(y / scale)]?.[Math.floor(x / scale)] === true;
      const value = dark ? 0 : 255;
      const at = (y * width + x) * 4;
      data[at] = value;
      data[at + 1] = value;
      data[at + 2] = value;
      data[at + 3] = 255;
    }
  }

  return { data, width, height };
}

describe("qrMatrix", () => {
  it("decodes back to the URL it was asked to carry", () => {
    const matrix = qrMatrix(URL);
    const { data, width, height } = rasterise(matrix, 8);

    expect(jsQR(data, width, height)?.data).toBe(URL);
  });

  it("carries the quiet zone the standard requires", () => {
    const matrix = qrMatrix(URL);
    const columns = matrix[0]?.length ?? 0;

    expect(columns).toBeGreaterThan(0);
    // Every row is the same width, and the outer frame is light.
    expect(matrix.every((row) => row.length === columns)).toBe(true);
    for (let i = 0; i < QUIET_ZONE_MODULES; i += 1) {
      expect(matrix[i]?.every((module) => module === false)).toBe(true);
      expect(matrix[matrix.length - 1 - i]?.every((module) => module === false)).toBe(true);
      for (const row of matrix) {
        expect(row[i]).toBe(false);
        expect(row[columns - 1 - i]).toBe(false);
      }
    }
  });

  it("sizes the symbol for the payload, not for a guess", () => {
    // 77 bytes at error-correction M is QR version 5: 4 × 5 + 17 = 37 modules.
    expect(qrMatrix(URL).length).toBe(37 + QUIET_ZONE_MODULES * 2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/qr-code.test.ts`
Expected: FAIL with **`Cannot find package 'jsqr'`** — the test's first import is `jsqr`, and
`qr-code.js` does not exist yet either, so which one Vite reports first depends on the
resolver. Either message is the dependency being absent, which is the point of this step.

- [ ] **Step 3: Add the dependencies**

```bash
cd src/web
npm install --workspace @vigilia/editor qr
npm install --save-dev jsqr
```

Confirm from the installed metadata before writing the notice rows:

```bash
node -e "for (const p of ['qr','jsqr']) { const m = require('./node_modules/' + p + '/package.json'); console.log(p, m.version, m.license, JSON.stringify(m.dependencies ?? {})); }"
```

Expected: `qr` **`MIT OR Apache-2.0`** with **no** dependencies; `jsqr` **`Apache-2.0`**
with no dependencies. Both were checked against the registry before this plan was
accepted — `npm view qr license dependencies` answers `(MIT OR Apache-2.0)` and nothing
else, `npm view jsqr license` answers `Apache-2.0` — so `jsqr` being Apache-2.0 and not
MIT is the expected reading, not a reason to stop. If either disagrees on this machine,
stop and file a backlog row rather than proceeding.

- [ ] **Step 4: Write the minimal implementation**

Create `src/web/packages/editor/src/editor-shell/qr-code.ts`:

```ts
import encodeQR from "qr";

/**
 * The QR symbol for one URL, as rows of booleans.
 *
 * Data, never markup: the header draws `<rect>` elements from this, so a
 * library-authored SVG string never has to be trusted through
 * `dangerouslySetInnerHTML`, and the ink and paper stay the header's decision
 * rather than the encoder's.
 *
 * The encoder is a dependency for a reason recorded in `docs/decisions/0032`:
 * every way a hand-written encoder can be wrong — Reed–Solomon, mask penalty
 * scoring, BCH format information — produces a matrix that looks right and
 * never scans, and the only instrument that would catch it is a camera this
 * project cannot put in CI.
 */
export const QUIET_ZONE_MODULES = 4;

/** Error correction M: ~15 % of the symbol recoverable, which is the level the
 *  standard's own guidance starts from for a code read off a screen. */
const ERROR_CORRECTION = "medium" as const;

export function qrMatrix(text: string): readonly (readonly boolean[])[] {
  return encodeQR(text, "raw", {
    ecc: ERROR_CORRECTION,
    border: QUIET_ZONE_MODULES,
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run packages/editor/src/editor-shell/qr-code.test.ts`
Expected: PASS, three tests.

`docs/decisions/0032` recorded the option *names* and not their accepted values, so both
were read off `qr@0.7.2`'s published `index.d.ts` and README before this plan was accepted.
They are settled; do not re-open them:

- **`ecc` takes the word.** `export type ErrorCorrection = 'low' | 'medium' | 'quartile' |
  'high'` — so `"medium"` is correct as written, and it is the 15 % level the comment above
  claims.
- **`border` is in modules, and its default is 2 — not the 4 the standard requires.** That
  is exactly why `border: QUIET_ZONE_MODULES` is passed explicitly rather than left out:
  omit it and the symbol ships with half the quiet zone ISO/IEC 18004 asks for, which is a
  code some scanners refuse and nothing in this repo would notice.
- **`encodeQR(text, 'raw', opts)` is declared `=> boolean[][]`**, so the matrix is returned
  as booleans without normalising.

**If the quiet-zone test still fails**, the installed version's `border` does not pad the
`raw` output. That is not a reason to change the encoder — pad it once, here, so the symbol
this module returns always carries the quiet zone it promises — and say so in the commit.

- [ ] **Step 6: Prove the test can fail**

In the `rasterise` helper, replace the `dark` computation with a constant so every module is
drawn as paper:

```ts
const dark = false;
```

Re-run Step 5. Expected: **FAIL** on the decode test — `AssertionError: expected undefined to
be 'http://…'`, because `jsQR` returned `null` and `?.data` is undefined. Restore the line and
re-run to green.

**Do not use the inversion break, and do not "fix" the tests when it passes.** Replacing
`=== true` with `=== false` — inverting ink and paper — was measured to leave **all three tests
passing**, because `jsqr` 1.4.0 defaults to `inversionAttempts: "attemptBoth"` and decodes an
inverted symbol perfectly well. A break that cannot fail proves nothing about the test, and
inverting the rasteriser is the obvious thing to reach for; `As executed` at the end of this
task records the measurement.

- [ ] **Step 7: Update the licence records**

Add one row to `THIRD-PARTY-NOTICES.md`'s **Runtime/editor** table, recording the licence
as the **declared expression** — house style already writes a dual licence that way
(`@biomejs/biome` is `MIT OR Apache-2.0` at `:51`), and `qr` declares the same pair:

`| qr <version> | MIT OR Apache-2.0 | QR symbol for the display link (no dependencies of its own) |`

Add the same version and licence to the **Declared dependencies** section of
`docs/engineering/dependencies.md`.

`jsqr` is Apache-2.0 and is a *development* dependency, so it does not go in a runtime
table: the **Build/test** section at `THIRD-PARTY-NOTICES.md:49-58` lists declared
development dependencies one by one in prose. Append `, jsqr <version> (Apache-2.0)` to
that sentence, and the same to the matching list in `docs/engineering/dependencies.md`.

- [ ] **Step 8: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/qr-code.ts \
        src/web/packages/editor/src/editor-shell/qr-code.test.ts \
        src/web/packages/editor/package.json src/web/package.json \
        src/web/package-lock.json THIRD-PARTY-NOTICES.md docs/engineering/dependencies.md
git commit -m "feat(editor): encode a QR symbol from a dependency, and prove it decodes"
```

**As executed — `31eb2ff7`.** Four things worth carrying forward:

- **Step 6's break was wrong, and the replacement was measured twice** — once by the task and
  once independently by the controller. `=== true` → `=== false` leaves **3 passed**, because
  `jsqr` defaults to `inversionAttempts: "attemptBoth"`; `const dark = false` fails with
  `AssertionError: expected undefined`. The step above now prescribes the second.
- **Step 2's expected message is `Cannot find package 'jsqr'`**, not the `./qr-code.js` import —
  the test's first import is the dependency, so that is what the resolver reports first.
- **Step 8's `git add` list omits `STATUS.md`**, which the Global Constraints require in every
  task's commit. The executed commit carries it.
- **`npm install` rewrites the `—` escapes in `src/web/package.json`'s `//devDependencies`
  comment.** This task restored them so the diff stayed the single `jsqr` line. Any later task
  that installs should do the same, or its commit carries unrelated churn.

Licences were read off the installed metadata rather than taken from this plan:
`qr 0.7.2 (MIT OR Apache-2.0) {}` and `jsqr 1.4.0 Apache-2.0 {}` — both zero-dependency, both
as written above.

---

### Task 1.3: The host answers where a phone should go

**Files:**
- Modify: `src/web/packages/host/src/server.ts` — `HostServerOptions`, the route table
- Modify: `src/web/packages/host/src/index.ts` — export the new type
- Test: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: `lanAddress()` (`cli/net.ts:90`), `isLoopbackHost` (`cli/args.ts:68`),
  `isLoopbackRemote` (`server.ts`), `SessionStore.list()` (`session/pairing.ts:112`).
- Produces:
  ```ts
  export interface HostingState {
    /** True when this host is reachable beyond loopback right now. */
    readonly lan: boolean;
    /** The address a phone should use, or null when there is none. */
    readonly address: string | null;
    /** The port this host is bound to, or null when it is not bound. */
    readonly port: number | null;
  }
  ```
  ```ts
  /** A paired phone as the header may see it: `DisplaySession` **minus its
   *  credential**. `list()` returns whole sessions, so the route maps. */
  export type HostingPeer = Omit<DisplaySession, "token">;
  ```
  `HostServerOptions.hosting?: () => HostingState`, defaulting to
  `{ lan: false, address: null, port: null }`; and the route
  `GET /api/hosting` → `HostingState & { readonly sessions: readonly HostingPeer[] }`.

**Constraints.** The server **does not introspect its own binding**: `server.address()` is
`null` for a server that is not listening, which is every unit test in `server.test.ts`, so
the state is supplied by the owner that does the binding (`main.ts` today, the binding
owner in Phase 3). Loopback-only, like every other admin route — the editor is the only
caller and the editor is loopback-only too. Session tokens are **never** in the response:
the header mints its own (Task 2.1).
**This needs a map, not a forward.** `SessionStore.list()` returns `DisplaySession[]`, and
`DisplaySession` carries `token` (`session/pairing.ts:6-11`) — so returning `list()` unchanged
puts a live credential in the body. Strip it: `HostingPeer` above is `DisplaySession` without
`token`, and the step's test mints a session so the two implementations are distinguishable.
An assertion over an empty list passes for both.

- [ ] **Step 1: Write the failing test**

Add to `src/web/packages/host/src/server.test.ts`, beside the other route tests:

```ts
it("answers where a phone should go, and nothing else", async () => {
  const store = createSessionStore({ randomToken: () => "t".repeat(43) });
  const host = createTestServer({
    hosting: () => ({ lan: true, address: "192.168.1.42", port: 5227 }),
    sessions: store,
  });

  const answered = await request(host.server, "GET", "/api/hosting");
  expect(answered.status).toBe(200);
  expect(answered.json()).toEqual({
    lan: true,
    address: "192.168.1.42",
    port: 5227,
    sessions: [],
  });

  // A token is a credential, and `DisplaySession` carries one — so a route that
  // forwards `list()` unchanged hands it back. An assertion over an empty list
  // passes for that implementation and for a redacting one alike, which is why
  // this mints: without a session present, the test cannot tell them apart.
  store.create("Kitchen phone");
  const withOne = await request(host.server, "GET", "/api/hosting");
  const peers = (
    withOne.json() as { sessions: readonly Record<string, unknown>[] }
  ).sessions;
  expect(peers).toHaveLength(1);
  expect(peers[0]).not.toHaveProperty("token");
  expect(JSON.stringify(peers)).not.toContain("t".repeat(43));
});

it("keeps hosting settings on this PC", async () => {
  const host = createTestServer({
    hosting: () => ({ lan: true, address: "192.168.1.42", port: 5227 }),
  });

  const answered = await request(host.server, "GET", "/api/hosting", undefined, {
    remoteAddress: "192.168.1.50",
  });
  expect(answered.status).toBe(403);
});

it("answers loopback with nothing hosted when it was told nothing", async () => {
  const host = createTestServer({});

  const answered = await request(host.server, "GET", "/api/hosting");
  expect(answered.json()).toEqual({
    lan: false,
    address: null,
    port: null,
    sessions: [],
  });
});
```

**There is no `createTestServer` helper in `server.test.ts`.** The file builds each server
with its own local wrapper around `createHostServer` and a temporary bundle and theme
directory per test. Read the top of the file and follow that idiom — do not introduce a
shared helper for this one task. The call shape above shows the options it must forward;
nothing else about it is prescribed.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/host/src/server.test.ts -t hosting`
Expected: FAIL — the route answers the site's 404 for a path the bundle does not declare.

- [ ] **Step 3: Write the minimal implementation**

In `src/web/packages/host/src/server.ts`, add to `HostServerOptions` (beside `sessions`
at `:65-68`):

```ts
  /** Where a phone should point, and whether it can reach this host at all.
   *  Supplied rather than introspected: `server.address()` is null for a server
   *  that is not listening, which is every test, and the thing that binds the
   *  socket is the thing that knows. */
  readonly hosting?: () => HostingState;
```

Export the type beside the other interfaces:

```ts
export interface HostingState {
  readonly lan: boolean;
  readonly address: string | null;
  readonly port: number | null;
}

const NO_HOSTING: HostingState = { lan: false, address: null, port: null };
```

Near the top of `createHostServer`, beside `const sessions = options.sessions` (`:298`):

```ts
  const hosting = options.hosting ?? (() => NO_HOSTING);
```

And add the route immediately after the `/api/health` block (`:627-637`):

```ts
    // Where the phone should go, and the sessions this PC has minted, so the
    // editor header can show the address and a code for it. Admin, like the
    // other settings: it names this machine's address and its credentials.
    if (url.pathname === "/api/hosting") {
      if (!isLoopbackRemote(request.socket.remoteAddress)) {
        sendText(response, 403, "Hosting settings are available on this PC only.");
        return;
      }

      if (request.method !== "GET") {
        sendText(response, 405, "Only GET and PUT are supported.");
        return;
      }

      sendJson(response, 200, {
        ...hosting(),
        // `DisplaySession` carries `token`, so `list()` is never forwarded:
        // the header learns that a phone is paired, never the credential.
        sessions: (sessions?.list() ?? []).map(
          ({ token: _credential, ...peer }) => peer,
        ),
      });
      return;
    }
```

In `src/web/packages/host/src/index.ts`, export the type beside `HostServerOptions`:

```ts
export type {
  BundleRoots,
  HostingState,
  HostServer,
  HostServerOptions,
} from "./server.js";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/host/src/server.test.ts`
Expected: PASS, including every pre-existing route test.

- [ ] **Step 5: Prove the tests can fail**

Delete the `isLoopbackRemote` guard and re-run Step 4. Expected: FAIL on the
`remoteAddress: "192.168.1.50"` case with 200 instead of 403. Restore it.

- [ ] **Step 6: Record the address gap rather than fixing it**

`lanAddress()` returns the **first** non-internal IPv4 with no preference between a
physical adapter and a virtual one, so a laptop with a Hyper-V switch, a WSL adapter or a
VPN can be handed an address no phone can reach, and nothing on the machine shows it. The
fix needs a decision this task does not own (which interface wins, and what to do when
there are three plausible ones), so it is **filed, not fixed** — already done, as **`vg-171`**,
which Task 1.3 left as a `Discovered, not fixed:` trailer because its dispatch forbade
writing the register, and the controller materialised from that trailer. The row's `detail`
names `src/web/packages/host/src/cli/net.ts:90-100` and the reproduction (a machine with a
virtual adapter). Nothing further is required here.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/host/src/server.ts \
        src/web/packages/host/src/index.ts \
        src/web/packages/host/src/server.test.ts
git commit -m "feat(host): answer where a phone should point"
```

---

## Phase 2 — The header carries the address and the QR (3 tasks)

Delivers: with the LAN on, the editor header shows the address and a QR code a phone can
scan. **Phase 3 makes the LAN controllable; here it is still `--host`.** This phase is
proved by starting a host bound to the LAN.

---

### Task 2.1: The editor's hosting client

**Files:**
- Create: `src/web/packages/editor/src/hosting-client.ts`
- Create: `src/web/packages/editor/src/hosting-client.test.ts`

**Interfaces:**
- Consumes: `HostingState` from `@vigilia/host`'s `GET /api/hosting` — over the wire, not
  as an import; the editor does not depend on the host package.
- Produces:
  ```ts
  export interface HostingAnswer {
    readonly lan: boolean;
    readonly address: string | null;
    readonly port: number | null;
    /** A minted display credential, present only just after a publish. */
    readonly session?: { readonly token: string; readonly expiresAt: string };
  }
  export async function readHosting(fetcher?: typeof fetch): Promise<HostingAnswer | undefined>;
  export async function mintSession(fetcher?: typeof fetch): Promise<HostingAnswer["session"]>;
  export function displayUrl(
    answer: { readonly address: string; readonly port: number },
    token: string,
  ): string;
  ```

**Constraints.** `readHosting` returns `undefined` for **any** failure — an editor served
by `vite preview` has no host behind it and must render nothing rather than an error. Shape
is checked field by field: a body the editor cannot read is the same as no answer, and
`exactOptionalPropertyTypes` means absent fields are omitted, never `undefined`.

- [ ] **Step 1: Write the failing test**

Create `src/web/packages/editor/src/hosting-client.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { displayUrl, mintSession, readHosting } from "./hosting-client.js";

const answer = (url: string, body: unknown, init?: ResponseInit): typeof fetch =>
  vi.fn(async () => new Response(JSON.stringify(body), init)) as unknown as typeof fetch;

describe("readHosting", () => {
  it("reads this machine's address and port", async () => {
    const read = await readHosting(
      answer("/api/hosting", { lan: true, address: "192.168.1.42", port: 5227, sessions: [] }),
    );
    expect(read).toEqual({ lan: true, address: "192.168.1.42", port: 5227 });
  });

  it("answers nothing when no host is behind the editor", async () => {
    const missing = vi.fn(async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    expect(await readHosting(missing)).toBeUndefined();
  });

  it("answers nothing for a body it cannot read", async () => {
    expect(await readHosting(answer("/api/hosting", { lan: "yes" }))).toBeUndefined();
  });
});

describe("mintSession", () => {
  it("mints from the host, which is the only thing that may", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ session: { token: "t".repeat(43), expiresAt: "2026-10-08T00:00:00.000Z" } }),
          { status: 201 },
        ),
    ) as unknown as typeof fetch;

    expect(await mintSession(fetcher)).toEqual({
      token: "t".repeat(43),
      expiresAt: "2026-10-08T00:00:00.000Z",
    });
    expect(String((fetcher as unknown as { mock: { calls: string[][] } }).mock.calls[0]?.[0])).toBe(
      "/api/pairing/sessions?label=display",
    );
  });
});

describe("displayUrl", () => {
  it("puts the session in the query, because a script cannot send a header", () => {
    expect(displayUrl({ address: "192.168.1.42", port: 5227 }, "abc/def")).toBe(
      "http://192.168.1.42:5227/?session=abc%2Fdef",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/hosting-client.test.ts`
Expected: FAIL — `Failed to resolve import "./hosting-client.js"`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/web/packages/editor/src/hosting-client.ts`:

```ts
/**
 * What this host offers a phone, asked from the editor.
 *
 * Everything here answers `undefined` rather than throwing: the editor is
 * routinely served by a build with no host behind it, and a header that cannot
 * say where the phone should go must render nothing — not an error the author
 * cannot act on, and never an address the editor invented.
 */

export interface HostingAnswer {
  readonly lan: boolean;
  readonly address: string | null;
  readonly port: number | null;
  readonly session?: { readonly token: string; readonly expiresAt: string };
}

const isString = (value: unknown): value is string => typeof value === "string";

export async function readHosting(
  fetcher: typeof fetch = fetch,
): Promise<HostingAnswer | undefined> {
  try {
    const response = await fetcher("/api/hosting");
    if (!response.ok) return undefined;

    const body = (await response.json()) as Record<string, unknown>;
    if (typeof body["lan"] !== "boolean") return undefined;
    if (body["address"] !== null && !isString(body["address"])) return undefined;
    if (body["port"] !== null && typeof body["port"] !== "number") return undefined;

    return {
      lan: body["lan"],
      address: body["address"] === null ? null : (body["address"] as string),
      port: body["port"] === null ? null : (body["port"] as number),
    };
  } catch {
    return undefined;
  }
}

/** Mints a display credential. The host refuses anything but loopback, which is
 *  where the editor already is (§145). */
export async function mintSession(
  fetcher: typeof fetch = fetch,
): Promise<HostingAnswer["session"]> {
  try {
    const response = await fetcher("/api/pairing/sessions?label=display", {
      method: "POST",
    });
    if (!response.ok) return undefined;

    const { session } = (await response.json()) as {
      session?: { token?: unknown; expiresAt?: unknown };
    };
    if (!isString(session?.token) || !isString(session.expiresAt)) return undefined;

    return { token: session.token, expiresAt: session.expiresAt };
  } catch {
    return undefined;
  }
}

/** The URL the QR carries. The token rides in the query because `EventSource`
 *  cannot set a request header, which is why it is short-lived. */
export function displayUrl(
  answer: { readonly address: string; readonly port: number },
  token: string,
): string {
  return `http://${answer.address}:${answer.port}/?session=${encodeURIComponent(token)}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/editor/src/hosting-client.test.ts`
Expected: PASS, five tests.

- [ ] **Step 5: Prove the tests can fail**

**The break this step used to prescribe was measured inert.** Flipping only the `lan` guard to
`false` leaves all five tests green: the "cannot read" case's `{ lan: "yes" }` body is rejected
by the `address` and `port` guards too, so removing one of the three changes nothing.

Break the shape check as a whole instead — delete all three `return undefined` guards in
`readHosting`, so a body the editor cannot read is returned as though it were good. Re-run
Step 4. Expected: **FAIL** on the "cannot read" case, `AssertionError: expected { Object (lan,
address, …) } to be undefined`. Restore all three and re-run to green.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/hosting-client.ts \
        src/web/packages/editor/src/hosting-client.test.ts
git commit -m "feat(editor): read this host's address, and mint a display credential"
```

**As executed — `5b6335dc`.** The break-proof correction above was made here, and the wire
shapes were read from `server.ts` rather than assumed: `GET /api/hosting` answers
`{ lan, address, port, sessions[] }`, and `POST /api/pairing/sessions?label=display` answers
`201 { session: { token, expiresAt } }`. The client reaches both over HTTP and imports nothing
from `@vigilia/host` — the editor package must not gain that edge.

Note that `HostingAnswer` deliberately drops the `sessions` array the route returns. If no
surface ends up reading it, the field is dead weight on a route whose whole reason for
existing is the address — worth settling when Task 2.3 renders the header.

---

### Task 2.2: The QR renderer, in the header's own ink

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/qr-symbol.tsx`
- Test: `src/web/packages/editor/src/editor-shell/qr-symbol.dom.test.tsx`
- Modify: `src/web/packages/editor/src/ui-copy.ts` — `publish.qrName`

**Interfaces:**
- Consumes: `qrMatrix` and `QUIET_ZONE_MODULES` from `./qr-code.js` (Task 1.2) — that import
  is the encoder and resolves correctly; it is the *renderer's own* basename that must differ.
- Produces:
  ```tsx
  export function QrCode({ text, modulePitch }: {
    readonly text: string;
    /** Pixels per module. 3 keeps a 45-module symbol at 135 px. */
    readonly modulePitch?: number;
  }): React.JSX.Element;
  ```
  Rendering an `<svg role="img">` whose accessible name is the URL it carries.

**Constraints.** **The QR never takes shell palette tokens.** The editor ships six
palettes and a QR drawn in `--vigilia-*` foreground inverts to light-on-dark under the
dark ones, which many scanners refuse — and the editor that produced it looks correct. Ink
and paper are fixed: `#101418` on `#ffffff`. The accessible name is the URL, because a
code a sighted reader can scan is a code a voice user must still be able to hear.

**This file is `qr-symbol`, not `qr-code`, and the name is load-bearing.** Task 1.2's encoder
already owns `qr-code.ts`; under `moduleResolution: bundler` — and in Vite — an import of
`./qr-code.js` resolves to that `.ts`, so a `.tsx` sibling of the same basename is
**unreachable**. It fails as a silent wrong-module resolution, not as an error, which is the
worst way for it to fail. There are **zero** same-basename `.ts`/`.tsx` pairs anywhere under
`packages/`; do not create the first one here.

- [ ] **Step 1: Write the failing test**

Create `src/web/packages/editor/src/editor-shell/qr-symbol.dom.test.tsx` — **`qr-symbol`, not
`qr-code`**, for the reason in the Constraints below:

```tsx
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { QrCode } from "./qr-symbol.js";

const URL = `http://192.168.1.42:5227/?session=${"a".repeat(43)}`;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  root?.unmount();
  root = undefined;
  host?.remove();
  host = undefined;
});

/** The element the symbol is drawn into. `createRoot` rather than
 *  `@testing-library/react`, which this workspace does not depend on. */
function mount(text: string): HTMLDivElement {
  const mounted = document.createElement("div");
  host = mounted;
  document.body.append(mounted);
  const created = createRoot(mounted);
  root = created;
  act(() => created.render(<QrCode text={text} />));
  return mounted;
}

it("draws the ink on the paper, whatever palette the shell is in", () => {
  const container = mount(URL);
  const svg = container.querySelector("svg");
  expect(svg).not.toBeNull();

  const background = svg?.querySelector("rect");
  expect(background?.getAttribute("fill")).toBe("#ffffff");

  const module = svg?.querySelectorAll("path")[0];
  expect(module?.getAttribute("fill")).toBe("#101418");
  // A token here would invert under a dark shell palette and stop scanning.
  expect(module?.getAttribute("fill")).not.toContain("var(--vigilia");
});

it("names the URL it carries, so the code is not only a picture", () => {
  const container = mount(URL);
  expect(container.querySelector("svg")?.getAttribute("aria-label")).toBe(`QR code: ${URL}`);
});
```

`@testing-library/react` is in **no** manifest and not in the lockfile, so do not reach for it —
`createRoot` and `act` are what this repo's `.dom.test.tsx` files already use.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/qr-symbol.dom.test.tsx`
Expected: FAIL — `Cannot find module './qr-symbol.js'`, the renderer not existing yet.

- [ ] **Step 3: Write the minimal implementation**

Create `src/web/packages/editor/src/editor-shell/qr-symbol.tsx`:

```tsx
import type { CSSProperties } from "react";
import { uiCopy } from "../ui-copy.js";
import { qrMatrix } from "./qr-code.js";

/**
 * One QR symbol, drawn from the matrix rather than from markup the encoder
 * produced.
 *
 * **The ink and the paper are fixed, not themed.** A QR is read by a camera
 * looking for dark modules on light ones; the editor ships six shell palettes,
 * and a code drawn in the palette's own foreground would invert to
 * light-on-dark under half of them and stop scanning while looking perfectly
 * correct on screen.
 */
const INK = "#101418";
const PAPER = "#ffffff";

/** Pixels per module. 3 keeps a version-5 symbol (45 modules with its quiet
 *  zone) at 135 px, which is a comfortable camera target at arm's length. */
const DEFAULT_PITCH = 3;

export function QrCode({
  text,
  modulePitch = DEFAULT_PITCH,
}: {
  readonly text: string;
  readonly modulePitch?: number;
}): React.JSX.Element {
  const matrix = qrMatrix(text);
  const modules = matrix[0]?.length ?? 0;
  const side = modules * modulePitch;
  const style: CSSProperties = { display: "block" };

  return (
    <svg
      role="img"
      aria-label={uiCopy.publish.qrName(text)}
      width={side}
      height={side}
      viewBox={`0 0 ${modules} ${modules}`}
      style={style}
      data-vigilia-qr=""
    >
      <rect width={modules} height={modules} fill={PAPER} />
      {/* One path for every dark module: a version-5 symbol is over a thousand
          rects as elements, and the browser lays each one out. */}
      <path fill={INK} d={pathOf(matrix)} />
    </svg>
  );
}

/** A single `d` for every dark module, one `M x y h1 v1 h-1 z` each — the
 *  matrix is already modules, so the path is in module coordinates and the
 *  `viewBox` does the scaling. */
function pathOf(matrix: readonly (readonly boolean[])[]): string {
  const parts: string[] = [];

  for (const [y, row] of matrix.entries()) {
    for (const [x, dark] of row.entries()) {
      if (dark) parts.push(`M${x} ${y}h1v1h-1z`);
    }
  }

  return parts.join("");
}
```

Add to `ui-copy.ts`'s top level (beside `saveState` at `:323`):

```ts
  /** The publish surface. §145: plain LAN HTTP has no confidentiality, so the
   *  words that turn it on have to say what it is. */
  publish: {
    qrName: (url: string): string => `QR code: ${url}`,
  },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/editor/src/editor-shell/qr-symbol.dom.test.tsx`
Expected: PASS, two tests.

- [ ] **Step 5: Prove the tests can fail**

Change `INK` to `"var(--vigilia-text, #101418)"`. Re-run Step 4. Expected: FAIL on the `toBe`
that pins the fill — `expected 'var(--vigilia-text, #101418)' to be '#101418'`. The
`not.toContain` line would fail too, but it is asserted second and never reached. Restore
`#101418` and re-run to green.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/qr-symbol.tsx \
        src/web/packages/editor/src/editor-shell/qr-symbol.dom.test.tsx \
        src/web/packages/editor/src/ui-copy.ts STATUS.md
git commit -m "feat(editor): draw the QR from the matrix, in ink the palettes cannot invert"
```

**As executed — `7727493f`.** Four corrections, one of them blocking:

- **The plan's filename was unusable.** `qr-code.tsx` cannot sit beside Task 1.2's `qr-code.ts`:
  `./qr-code.js` resolves to the `.ts`, and the component import came back `undefined` rather
  than erroring. The file landed as **`qr-symbol.tsx`** and its test as
  `qr-symbol.dom.test.tsx`. **Any later task importing `QrCode` must use `./qr-symbol.js`.**
  The repo has zero same-basename `.ts`/`.tsx` pairs; this would have been the first.
- **`@testing-library/react` is in no manifest and not in the lockfile.** The test was rewritten
  with the repo's own `createRoot`/`act` idiom, assertions unchanged.
- **Step 2's expected message was stale** — `./qr-code.js` *does* resolve, so the failure was
  the undefined component, not an unresolved import.
- **Step 5 named the wrong assertion order**, as corrected above.

---

### Task 2.3: The header's publish surface

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/publish-control.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx:459-478`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Test: `src/web/packages/editor/src/editor-shell/publish-control.dom.test.tsx`
- Test: `src/web/tests/e2e/publish-header.spec.ts`

**Interfaces:**
- Consumes: `readHosting`, `mintSession`, `displayUrl` (Task 2.1); `QrCode` (Task 2.2).
- Produces: `export function PublishControl(): React.JSX.Element | null` — `null` whenever
  this host is not reachable from the LAN, so the header grows nothing on a loopback-only
  host.

**Constraints.** The header is React chrome; this component holds four primitives and no
Fabric object. The address is **whatever the host answered** — the editor never composes
one from `location`, because in the browser the editor's own URL is `127.0.0.1`. The
surface says §145's warning in words: *trusted networks only, never the internet*.

- [ ] **Step 1: Write the failing test**

Create `src/web/packages/editor/src/editor-shell/publish-control.dom.test.tsx`:

**The harness is Task 2.2's, not `@testing-library/react`.** That package is in no manifest and
not in the lockfile — Task 2.2 hit this and rewrote its test. Copy the `mount` helper from
`src/web/packages/editor/src/editor-shell/qr-symbol.dom.test.tsx` (it uses `createRoot` from
`react-dom/client` and `act` from `react`, with an `afterEach` that unmounts), and use
**`vi.waitFor`** for the async assertions below, since `waitFor` came from the absent package.
The imports that follow are the ones to end up with:

```tsx
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { PublishControl } from "./publish-control.js";

const token = "t".repeat(43);

function hostAnswers(hosting: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).startsWith("/api/hosting")
        ? new Response(JSON.stringify(hosting), { status: 200 })
        : new Response(JSON.stringify({ session: { token, expiresAt: "2026-10-08T00:00:00.000Z" } }), {
            status: 201,
          }),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

it("renders nothing when this host is not on the LAN", async () => {
  hostAnswers({ lan: false, address: null, port: null, sessions: [] });
  const { container } = render(<PublishControl />);
  await waitFor(() => expect(container.firstChild).toBeNull());
});

it("shows the address the host named, with a code for it", async () => {
  hostAnswers({ lan: true, address: "192.168.1.42", port: 5227, sessions: [] });
  const { getByText, container } = render(<PublishControl />);

  await waitFor(() => expect(getByText("http://192.168.1.42:5227")).toBeTruthy());
  expect(container.querySelector("[data-vigilia-qr]")?.getAttribute("aria-label")).toBe(
    `QR code: http://192.168.1.42:5227/?session=${token}`,
  );
  expect(getByText(uiCopy.publish.warning)).toBeTruthy();
});

it("takes the address apart again when the host answers with a new one", async () => {
  hostAnswers({ lan: true, address: "192.168.1.42", port: 5227, sessions: [] });
  const { getByText, queryByText, rerender } = render(<PublishControl />);
  await waitFor(() => expect(getByText("http://192.168.1.42:5227")).toBeTruthy());

  hostAnswers({ lan: true, address: "192.168.1.99", port: 5227, sessions: [] });
  rerender(<PublishControl />);

  await waitFor(() => expect(getByText("http://192.168.1.99:5227")).toBeTruthy());
  expect(queryByText("http://192.168.1.42:5227")).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/publish-control.dom.test.tsx`
Expected: FAIL — `Failed to resolve import "./publish-control.js"`.

- [ ] **Step 3: Write the minimal implementation**

Add to `ui-copy.ts`'s `publish` block:

```ts
    address: "Phone address",
    warning: "Plain HTTP on your own network — trusted networks only, never the internet.",
    copy: "Copy link",
    copied: "Copied",
    expires: (at: string): string => `Pairing expires ${at}`,
```

Create `src/web/packages/editor/src/editor-shell/publish-control.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { displayUrl, mintSession, readHosting } from "../hosting-client.js";
import { uiCopy } from "../ui-copy.js";
// `qr-symbol`, not `qr-code`: `./qr-code.js` is Task 1.2's encoder, and a
// same-basename `.tsx` beside it is unreachable under `moduleResolution:
// bundler` — it resolves to the `.ts` and yields `undefined`, not an error.
import { QrCode } from "./qr-symbol.js";

/**
 * Where the phone should go, in the header, because that is where §6 puts it:
 * publishing answers one question, and the answer is an address and a code.
 *
 * Everything is read from the host. In the browser the editor's own URL is
 * `127.0.0.1`, so an address composed here would be an address no phone can
 * reach — and it would look right.
 */
interface Shown {
  readonly address: string;
  readonly port: number;
  readonly url: string;
  readonly expiresAt: string | undefined;
}

export function PublishControl(): React.JSX.Element | null {
  const [shown, setShown] = useState<Shown | undefined>(undefined);
  const asked = useRef(false);

  useEffect(() => {
    let live = true;

    void (async () => {
      const hosting = await readHosting();
      if (!live || hosting === undefined || !hosting.lan) return;
      if (hosting.address === null || hosting.port === null) return;

      const session = await mintSession();
      if (!live || session === undefined) return;

      setShown({
        address: hosting.address,
        port: hosting.port,
        url: displayUrl({ address: hosting.address, port: hosting.port }, session.token),
        expiresAt: session.expiresAt,
      });
    })();

    return () => {
      live = false;
    };
  }, []);

  if (shown === undefined) return null;

  return (
    <div className="editor-shell-publish editor-glass" data-vigilia-publish="">
      <div className="editor-shell-publish-text">
        <span className="editor-shell-publish-label">{uiCopy.publish.address}</span>
        <code className="editor-shell-publish-url">{`http://${shown.address}:${shown.port}`}</code>
        <span className="editor-shell-publish-warning">{uiCopy.publish.warning}</span>
        {shown.expiresAt === undefined ? null : (
          <span className="editor-shell-publish-expiry">{uiCopy.publish.expires(shown.expiresAt)}</span>
        )}
      </div>
      <QrCode text={shown.url} />
    </div>
  );
}
```

Remove the unused `asked` ref if you left it; `noUnusedLocals` will say so.

In `shell-layout.tsx`, render it in the header between `PaletteMenu` and the Save button:

```tsx
          <PaletteMenu
            storage={storage}
            palette={palette}
            onChange={setPalette}
          />
          <PublishControl />
          <button
```

and import it beside `PaletteMenu`:

```tsx
import { PublishControl } from "./publish-control.js";
```

In `editor-shell.css`, add a block beside `.editor-shell-menubar` (`:292`) that lays the
surface out as a row with the text stack on the left and the code on the right, sized by
its own content, using the existing `--vigilia-*` chrome tokens — **except** inside the
`svg`, which Task 2.2 has already fixed.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/editor/src/editor-shell/publish-control.dom.test.tsx packages/editor/src/editor-shell/shell-layout.dom.test.tsx`
Expected: PASS. `shell-layout.dom.test.tsx` stubs `fetch`-free environments, so if it now
fails, `readHosting` is throwing instead of answering `undefined` — fix that, not the test.

- [ ] **Step 5: Prove the tests can fail**

In `PublishControl`, replace `readHosting()` with a value composed from
`window.location` (`{ lan: true, address: location.hostname, port: Number(location.port) }`).
Re-run Step 4. Expected: FAIL on the address test — it renders `127.0.0.1`, not the host's
answer. Restore it.

- [ ] **Step 6: Browser proof, through the host's own editor mount**

Create `src/web/tests/e2e/publish-header.spec.ts`. It starts **one real host bound to the
LAN** over its own port and its own app directory, and drives the editor through that
host's `/editor/` mount — which is the only way `/api/hosting` is same-origin, and is why
the editor preview at 4174 cannot prove this.

```ts
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4227;
const APP_DIR = path.join(here, "..", "..", ".e2e-publish-app");
```

Seed `APP_DIR/themes` with one package (reuse `writeThemePackage` from
`@vigilia/theme-package` the way `tests/e2e/host-theme.ts` does), spawn
`node packages/host/bin/vigilia.js --no-browser --port ${PORT} --host 0.0.0.0
--themes-dir … --settings-dir …`, wait for `/api/health`, then:

```ts
test("the header carries the address and a code for it", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${PORT}/editor/`);

  const publish = page.locator("[data-vigilia-publish]");
  await expect(publish).toBeVisible();

  const shown = await publish.locator("code").textContent();
  expect(shown).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/);

  const qr = publish.locator("[data-vigilia-qr]");
  const box = await qr.boundingBox();
  // A camera needs modules, not a thumbnail: 45 modules at 3 px.
  expect(box?.width).toBeGreaterThanOrEqual(120);
  expect((await qr.getAttribute("aria-label"))?.startsWith("QR code: http://")).toBe(true);

  await page.screenshot({ path: "test-results/publish/header-desktop.png", fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/publish/header-390.png", fullPage: false });
});
```

Run it, from `src/web/`, with the JSON report:

```bash
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/task-2-3.json \
  npx playwright test tests/e2e/publish-header.spec.ts --workers=1 --reporter=json
```

Then read `test-results/task-2-3.json`, and **look at both screenshots**. The 390 px one is
the one that matters: the header is a flex row and the QR is 135 px of it.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/publish-control.tsx \
        src/web/packages/editor/src/editor-shell/publish-control.dom.test.tsx \
        src/web/packages/editor/src/editor-shell/shell-layout.tsx \
        src/web/packages/editor/src/editor-shell/editor-shell.css \
        src/web/packages/editor/src/ui-copy.ts \
        src/web/tests/e2e/publish-header.spec.ts
git commit -m "feat(editor): the header carries the phone's address and a QR code for it"
```

---

## Phase 3 — LAN is a control, not a flag (4 tasks)

Delivers: §145's "explicit opt-in" is a control in the editor. The flag becomes the
*initial* value only. A host bound to loopback can start serving the LAN and stop again
without a restart, and the preference survives one.

---

### Task 3.1: The hosting preference

**Files:**
- Create: `src/web/packages/host/src/settings/hosting.ts`
- Test: `src/web/packages/host/src/settings/hosting.test.ts`

**Interfaces:**
- Consumes: the store idiom in `settings/display.ts` (`mkdir`, `readFile`, `writeFile`, a
  normaliser that refuses rather than coerces).
- Produces:
  ```ts
  export interface HostingSettings { readonly lan: boolean }
  export const DEFAULT_HOSTING_SETTINGS: HostingSettings;   // { lan: false }
  export interface HostingSettingsStore {
    read(): Promise<HostingSettings>;
    write(input: unknown): Promise<HostingSettings>;
  }
  export function createHostingSettingsStore(directory: string): HostingSettingsStore;
  ```

**Constraints.** File `hosting.json`, in the settings directory, **never** in a theme
folder (ADR-0017). §145: LAN is off unless someone asked for it, so a missing file, an
unreadable file and a malformed file all answer `{ lan: false }`. A non-boolean `lan` is
refused with a thrown message rather than coerced — the reading would otherwise silently
fall back and a consumer would be left with a setting that appears to do nothing
(`normalizeDisplaySettings`'s own rule).

- [ ] **Step 1: Write the failing test**

Create `src/web/packages/host/src/settings/hosting.test.ts`:

```ts
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createHostingSettingsStore,
  DEFAULT_HOSTING_SETTINGS,
} from "./hosting.js";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "vigilia-hosting-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("hosting settings", () => {
  it("serves loopback until somebody asks otherwise (§145)", async () => {
    expect(await createHostingSettingsStore(directory).read()).toEqual(
      DEFAULT_HOSTING_SETTINGS,
    );
  });

  it("remembers the choice across a restart", async () => {
    await createHostingSettingsStore(directory).write({ lan: true });
    expect(await createHostingSettingsStore(directory).read()).toEqual({ lan: true });
  });

  it("refuses a value it cannot obey rather than coercing it", async () => {
    const store = createHostingSettingsStore(directory);
    await expect(store.write({ lan: "yes" })).rejects.toThrow(/lan/i);
    await expect(store.write({})).rejects.toThrow(/lan/i);
  });

  it("answers loopback for a file it cannot read", async () => {
    await writeFile(path.join(directory, "hosting.json"), "{ not json", "utf8");
    expect(await createHostingSettingsStore(directory).read()).toEqual(
      DEFAULT_HOSTING_SETTINGS,
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/host/src/settings/hosting.test.ts`
Expected: FAIL — `Failed to resolve import "./hosting.js"`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/web/packages/host/src/settings/hosting.ts` with the same shape as
`settings/display.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Whether this PC serves the LAN (§145). A fact about this machine, so it sits
 * with the other settings and never in a theme folder.
 *
 * LAN serving is explicit opt-in, and that is what the default is for: an
 * unreadable file, a missing file and a malformed one all answer "loopback
 * only", because the failure that matters is serving a home network because
 * something could not be read.
 */

export interface HostingSettings {
  readonly lan: boolean;
}

export const DEFAULT_HOSTING_SETTINGS: HostingSettings = { lan: false };

export interface HostingSettingsStore {
  read(): Promise<HostingSettings>;
  write(input: unknown): Promise<HostingSettings>;
}

const FILE = "hosting.json";

export function normalizeHostingSettings(input: unknown): HostingSettings {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return DEFAULT_HOSTING_SETTINGS;
  }

  const lan = (input as Record<string, unknown>)["lan"];
  if (lan === undefined) return DEFAULT_HOSTING_SETTINGS;
  if (typeof lan !== "boolean") {
    throw new Error("Hosting's `lan` is on or off, and nothing else.");
  }

  return { lan };
}

export function createHostingSettingsStore(
  directory: string,
): HostingSettingsStore {
  const file = path.join(directory, FILE);

  return {
    async read() {
      try {
        return normalizeHostingSettings(
          JSON.parse(await readFile(file, "utf8")) as unknown,
        );
      } catch {
        // No file yet, or an unreadable one: loopback only.
        return DEFAULT_HOSTING_SETTINGS;
      }
    },

    async write(input) {
      const settings = normalizeHostingSettings(input);
      await mkdir(directory, { recursive: true });
      await writeFile(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
      return settings;
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/host/src/settings/hosting.test.ts`
Expected: PASS, four tests.

- [ ] **Step 5: Prove the tests can fail**

Change `DEFAULT_HOSTING_SETTINGS` to `{ lan: true }`. Re-run Step 4. Expected: FAIL on the
first and last tests. Restore it.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/host/src/settings/hosting.ts \
        src/web/packages/host/src/settings/hosting.test.ts
git commit -m "feat(host): remember whether this PC serves the LAN"
```

---

### Task 3.2: The binding moves at runtime

**Files:**
- Create: `src/web/packages/host/src/cli/hosting.ts`
- Test: `src/web/packages/host/src/cli/hosting.test.ts`
- Modify: `src/web/packages/host/src/cli/args.ts` — record whether `--host` was given
- Modify: `src/web/packages/host/src/main.ts:104-108, 193-200, 249-287`
- Test: `src/web/packages/host/src/cli/args.test.ts`

**Interfaces:**
- Consumes: `listenWithFallback` (`cli/net.ts:10`), `isLoopbackHost` (`cli/args.ts:68`),
  `lanAddress`, `createSessionStore`.
- Produces:
  ```ts
  export interface HostBinding {
    /** The state the host reports to the editor: what it is bound to now. */
    readonly state: () => HostingState;
    /** Rebinds on the same port. Resolves false, with a reason, when the new
     *  interface will not take that port — the old binding is restored. */
    setLan(on: boolean): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }>;
    close(): Promise<void>;
  }
  export function createHostBinding(
    server: http.Server,
    initial: { readonly port: number; readonly host: string },
  ): HostBinding;
  ```
- Produces on `ArgsResult`'s options: `readonly hostGiven: boolean`.

**Constraints.** **The port never moves.** `listenWithFallback` retries on
`EADDRINUSE`, which is right at startup and wrong here: a rebind that landed on 5228
would move the editor's own origin out from under the page that asked for it. So the
rebind uses a plain `server.listen(port, host)` and, on failure, re-binds the previous
host and answers `{ ok: false, reason }` — the control shows the reason. Live SSE
connections are closed on the way through (`closeAllConnections()`), because they belong to
displays that must reconnect to the new binding anyway.

- [ ] **Step 1: Write the failing tests**

Create `src/web/packages/host/src/cli/hosting.test.ts`:

```ts
import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createHostBinding } from "./hosting.js";

const open: http.Server[] = [];

function listening(host: string): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((_request, response) => response.end("ok"));
    open.push(server);
    server.listen(0, host, () => {
      const address = server.address();
      resolve({ server, port: typeof address === "object" && address !== null ? address.port : 0 });
    });
  });
}

afterEach(async () => {
  await Promise.all(
    open.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

describe("createHostBinding", () => {
  it("says where a phone should go once it serves the LAN", async () => {
    const { server, port } = await listening("127.0.0.1");
    const binding = createHostBinding(server, { port, host: "127.0.0.1" });

    expect(binding.state().lan).toBe(false);

    const turned = await binding.setLan(true);
    expect(turned.ok).toBe(true);
    expect(binding.state().lan).toBe(true);
    expect(binding.state().port).toBe(port);

    await binding.setLan(false);
    expect(binding.state().lan).toBe(false);
    expect(binding.state().port).toBe(port);
  });

  it("keeps the port when the interface will not take it, and says so", async () => {
    const { server, port } = await listening("127.0.0.1");
    const squatter = http.createServer();
    open.push(squatter);
    await new Promise<void>((resolve) => squatter.listen(port, "0.0.0.0", () => resolve()));

    const binding = createHostBinding(server, { port, host: "127.0.0.1" });
    const turned = await binding.setLan(true);

    expect(turned.ok).toBe(false);
    // The host is still answering where it was, which is the whole point of
    // refusing rather than falling back to another port.
    expect(binding.state().lan).toBe(false);
    expect(binding.state().port).toBe(port);
  });
});
```

Add to `src/web/packages/host/src/cli/args.test.ts`:

```ts
it("says whether the address was asked for or defaulted", () => {
  expect(parseArgs([], "0.0.0").options?.hostGiven).toBe(false);
  expect(parseArgs(["--host", "0.0.0.0"], "0.0.0").options?.hostGiven).toBe(true);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run packages/host/src/cli/hosting.test.ts packages/host/src/cli/args.test.ts`
Expected: FAIL — `Failed to resolve import "./hosting.js"`, and `hostGiven` undefined.

- [ ] **Step 3a: Record whether `--host` was given**

In `args.ts`, add `readonly hostGiven: boolean` to the parsed options beside `host`
(`:9`), set `let hostGiven = false;` beside `let host = DEFAULT_HOST` (`:98`), set it true
in the `case "--host":` arm (`:143-154`), and include it in the returned options object
(`:229`).

- [ ] **Step 3b: Write the binding owner**

Create `src/web/packages/host/src/cli/hosting.ts`:

```ts
import type http from "node:http";
import type { HostingState } from "../server.js";
import { isLoopbackHost } from "./args.js";
import { lanAddress } from "./net.js";

/**
 * The one listener, and the two addresses it can be told to sit on.
 *
 * Moving it is a rebind rather than a second socket, because two servers cannot
 * share a port — `0.0.0.0` already includes `127.0.0.1` — and because §145 wants
 * one exposed thing, not two.
 *
 * **The port never moves.** `listenWithFallback` is right at startup and wrong
 * here: a rebind that landed on the next free port would change the editor's own
 * origin under the page that asked for it, and every display's URL with it. So a
 * refused interface is answered with a reason and the old binding is restored.
 */

export interface HostBinding {
  readonly state: () => HostingState;
  setLan(
    on: boolean,
  ): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }>;
  close(): Promise<void>;
}

export function createHostBinding(
  server: http.Server,
  initial: { readonly port: number; readonly host: string },
): HostBinding {
  let port = initial.port;
  let host = initial.host;

  const state = (): HostingState => ({
    lan: !isLoopbackHost(host),
    address: isLoopbackHost(host) ? null : (lanAddress() ?? null),
    port,
  });

  const bind = (next: string): Promise<void> =>
    new Promise((resolve, reject) => {
      const onError = (error: Error): void => {
        server.removeListener("listening", onListening);
        reject(error);
      };
      const onListening = (): void => {
        server.removeListener("error", onError);
        resolve();
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, next);
    });

  return {
    state,

    async setLan(on) {
      const next = on ? "0.0.0.0" : "127.0.0.1";
      if (next === host) return { ok: true };

      // Displays are holding streams open, and a close waits for them.
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));

      try {
        await bind(next);
        host = next;
        return { ok: true };
      } catch (error) {
        // Put it back where it was, so a refusal is not also an outage.
        await bind(host);
        return {
          ok: false,
          reason: `Port ${port} is not free on ${next}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    },

    close() {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
```

- [ ] **Step 4: Wire it into the launcher**

In `main.ts`, replace the sessions line and the startup listen:

```ts
  // Sessions exist whether or not the LAN is on, because the control can turn it
  // on after launch; the binding decides whether anything but loopback can reach
  // them at all (§145).
  const sessions = createSessionStore();
  const hosting = createHostingSettingsStore(settingsDir);
  const storedHosting = await hosting.read();
```

```ts
  const binding = createHostBinding(hosted.server, {
    port: bound,
    host: parsed.options.host,
  });
```

…but the binding needs the port *after* the first bind, so order it as: choose the initial
host (`parsed.options.hostGiven ? parsed.options.host : storedHosting.lan ? "0.0.0.0" :
DEFAULT_HOST`), `listenWithFallback`, then `createHostBinding`. Pass
`hosting: binding.state` into `createHostServer`'s options, and use `binding.close()`
instead of `hosted.close()` at the shutdown site. **`--host` wins for the run; the stored
preference is what a run without it obeys.** Keep the terminal print at `:249-287` — a
terminal-launched host should still say where it is.

Add the route that turns it on and off, immediately after the `GET /api/hosting` block
from Task 1.3:

```ts
    if (url.pathname === "/api/hosting" && request.method === "PUT") {
      // The guard above has already run: this whole block is loopback-only.
      let body: { readonly lan?: unknown };
      try {
        body = JSON.parse(await readBody(request)) as { readonly lan?: unknown };
      } catch {
        sendText(response, 400, "That is not a hosting setting.");
        return;
      }

      if (typeof body.lan !== "boolean") {
        sendText(response, 400, "Hosting is on or off, and nothing else.");
        return;
      }

      const outcome = await toggled(body.lan);
      if (!outcome.ok) {
        sendText(response, 409, outcome.reason);
        return;
      }

      await saved(body.lan);
      // The same redaction Task 1.3's GET makes, for the same reason: a
      // `DisplaySession` carries `token`, and this route answers about hosting,
      // not about credentials.
      sendJson(response, 200, {
        ...hosting(),
        sessions: (sessions?.list() ?? []).map(
          ({ token: _credential, ...peer }) => peer,
        ),
      });
      return;
    }
```

where `toggled` and `saved` are `HostServerOptions` callbacks — add
`readonly setLan?: (on: boolean) => Promise<{ ok: true } | { ok: false; reason: string }>`
and `readonly rememberLan?: (on: boolean) => Promise<void>` — supplied by `main.ts` from
`binding.setLan` and `hosting.write`. **The server does not persist anything itself**; it
is given the two things it must do.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run packages/host/src/cli packages/host/src/server.test.ts`
Expected: PASS. Add to `server.test.ts` three cases in the same shape as Task 1.3's: a
loopback `PUT {lan:true}` answers 200 with `lan: true`; a `PUT` from `10.0.0.2` answers
403; a `PUT` whose `setLan` refuses answers 409 with the reason and does **not** call
`rememberLan`.

- [ ] **Step 6: Prove the tests can fail**

In `createHostBinding.setLan`, delete the `await bind(host)` restore line. Re-run Step 5.
Expected: FAIL on the "keeps the port" case — the host is left unbound. Restore it.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/host/src/cli/hosting.ts \
        src/web/packages/host/src/cli/hosting.test.ts \
        src/web/packages/host/src/cli/args.ts \
        src/web/packages/host/src/cli/args.test.ts \
        src/web/packages/host/src/main.ts \
        src/web/packages/host/src/server.ts \
        src/web/packages/host/src/server.test.ts
git commit -m "feat(host): the LAN binding moves at runtime, and the port does not"
```

---

### Task 3.3: The header's control

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/publish-control.tsx`
- Modify: `src/web/packages/editor/src/hosting-client.ts`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Test: `src/web/packages/editor/src/editor-shell/publish-control.dom.test.tsx`

**Interfaces:**
- Consumes: `GET`/`PUT /api/hosting` (Tasks 1.3, 3.2).
- Produces: `export async function setLan(on: boolean, fetcher?: typeof fetch):
  Promise<{ ok: true; answer: HostingAnswer } | { ok: false; reason: string }>`.

**Constraints.** The control is the only place in the product that turns the LAN on, and
**it says what turning it on means before it does it** — §145's "plain LAN HTTP has no
confidentiality; never suggest internet exposure" is a sentence on the surface, not a
tooltip. A refusal from the host (Task 3.2's 409) is shown as the host's own reason and the
control goes back to off, because that is what the host is.

**This task changes Task 2.3's first test deliberately.** That test pins *renders nothing
when this host is not on the LAN*, which was right while Phase 2 could only show an
address — there was nothing to say. Now there is: the off state carries the offer and the
§145 warning, and a header that renders nothing is a feature nobody can find. **Replace
that test** with the off-state test in Step 1 below; do not keep both.

- [ ] **Step 1: Write the failing tests**

Add to `publish-control.dom.test.tsx`:

```tsx
it("offers to serve the LAN, and says what that costs before it does", async () => {
  hostAnswers({ lan: false, address: null, port: null, sessions: [] });
  const { getByRole, getByText } = render(<PublishControl />);

  await waitFor(() => expect(getByText(uiCopy.publish.warning)).toBeTruthy());
  expect(getByRole("button", { name: uiCopy.publish.start }).getAttribute("aria-pressed")).toBe("false");
});

it("shows the host's own reason when it refuses the interface", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== "/api/hosting") return new Response("", { status: 404 });
      if (init?.method === "PUT") {
        return new Response("Port 5227 is not free on 0.0.0.0: EADDRINUSE", { status: 409 });
      }
      return new Response(JSON.stringify({ lan: false, address: null, port: null, sessions: [] }));
    }),
  );

  const { getByRole, getByText } = render(<PublishControl />);
  await waitFor(() => expect(getByText(uiCopy.publish.warning)).toBeTruthy());
  getByRole("button", { name: uiCopy.publish.start }).click();

  await waitFor(() => expect(getByText(/EADDRINUSE/)).toBeTruthy());
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run packages/editor/src/editor-shell/publish-control.dom.test.tsx`
Expected: FAIL — `uiCopy.publish.start` is undefined and no button is rendered.

- [ ] **Step 3: Write the minimal implementation**

Add to `hosting-client.ts`:

```ts
export async function setLan(
  on: boolean,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: true; answer: HostingAnswer } | { ok: false; reason: string }> {
  try {
    const response = await fetcher("/api/hosting", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lan: on }),
    });

    if (!response.ok) {
      // The host's own words: it is the only thing that knows why a socket
      // refused, and a message composed here would be a guess shown as a fact.
      return { ok: false, reason: (await response.text()).trim() };
    }

    const answer = await readHosting(fetcher);
    return answer === undefined
      ? { ok: false, reason: "The host answered with something unreadable." }
      : { ok: true, answer };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
```

Add to `ui-copy.ts`'s `publish` block:

```ts
    start: "Publish to a phone",
    stop: "Stop publishing",
    starting: "Opening the LAN…",
```

Rework `PublishControl` so it renders whenever a host answers — **including when the LAN
is off** — with the warning, a button whose label is `start`/`stop` and whose
`aria-pressed` is the LAN's state, and, when on, the address, the QR (Task 2.2) and the
expiry. The address and the session are minted only while the LAN is on; turning it off
clears both, so a stale URL is never on screen. A `setLan` failure renders the reason in
`uiCopy`'s own frame and leaves the control off.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/editor/src/editor-shell/publish-control.dom.test.tsx`
Expected: PASS, all five.

- [ ] **Step 5: Prove the tests can fail**

Make the failure branch answer a fixed string (`"Could not publish."`) instead of
`response.text()`. Re-run Step 4. Expected: FAIL on the `EADDRINUSE` assertion. Restore it.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/publish-control.tsx \
        src/web/packages/editor/src/editor-shell/publish-control.dom.test.tsx \
        src/web/packages/editor/src/hosting-client.ts \
        src/web/packages/editor/src/ui-copy.ts
git commit -m "feat(editor): publish is a control, not a command-line flag"
```

---

### Task 3.4: Proving the LAN without a phone

**Files:**
- Modify: `src/web/tests/e2e/publish-header.spec.ts`
- Test: `src/web/packages/host/src/settings/hosting.test.ts` (unchanged; re-run)
- Test: `src/web/packages/host/src/cli/hosting.test.ts` (unchanged; re-run)

**Interfaces:** none new.

**Constraints.** **A real phone is not available to the executor.** The LAN surface is
proved by three things and the plan says plainly what they do not cover:

1. **The host's own binding is measured** — `cli/hosting.test.ts` shows a real socket
   rebind on the same port, and `server.test.ts` shows a non-loopback request refused until
   a session is presented.
2. **The header is rendered and read in a real browser** through the host's `/editor/`
   mount, at 1680 px and at 390 px, with the address and the QR inspected as pixels.
3. **The symbol itself decodes**, in `qr-code.test.ts`, through a second library.

**What this does not cover:** that a camera on a particular phone, at a particular
distance, in a particular light, reads a QR off a glossy screen. That needs a phone and a
person, and it is named as unverified in the plan's closing report rather than implied by a
green suite.

- [ ] **Step 1: Extend the browser spec to the off→on path**

In `publish-header.spec.ts`, start the host **loopback-only** (drop `--host 0.0.0.0`) and
add:

```ts
test("the LAN is turned on from the editor, and the port does not move", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${PORT}/editor/`);

  const publish = page.locator("[data-vigilia-publish]");
  const toggle = publish.getByRole("button");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(publish.locator("code")).toHaveCount(0);

  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(publish.locator("code")).toHaveText(new RegExp(`:${PORT}$`));
  await expect(publish.locator("[data-vigilia-qr]")).toBeVisible();

  // Still the same origin, which is the claim `createHostBinding` makes.
  expect(page.url()).toContain(`127.0.0.1:${PORT}/editor/`);

  await toggle.click();
  await expect(publish.locator("code")).toHaveCount(0);
});

test("refuses the LAN to anything but this PC", async ({ request }) => {
  const refused = await request.put(`http://127.0.0.1:${PORT}/api/hosting`, {
    data: { lan: true },
    headers: { "x-forwarded-for": "192.168.1.50" },
  });
  // The guard reads the socket, not a header: from loopback this is allowed,
  // which is why the refusal itself is `server.test.ts`'s to prove.
  expect(refused.status()).toBe(200);
});
```

- [ ] **Step 2: Run it**

```bash
cd src/web && npx vite build packages/editor
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/task-3-4.json \
  npx playwright test tests/e2e/publish-header.spec.ts --workers=1 --reporter=json
```

Read `test-results/task-3-4.json`, then look at `test-results/publish/*.png`. The loopback
run must show the control **off** with the warning and no code; after the click, the
address, the code and the expiry.

- [ ] **Step 3: Prove the browser test can fail**

Comment out the `binding.setLan` wiring in `main.ts` so `PUT` answers 200 without moving
the socket. Rebuild the host, re-run Step 2. Expected: FAIL — `aria-pressed` flips but the
address never appears, because the host is still loopback-only and `/api/hosting` still
answers `lan: false`. Restore and rebuild.

- [ ] **Step 4: Run the whole gate**

```bash
cd src/web
npm run typecheck           # judged by exit code
./node_modules/.bin/biome lint ..
npm run format:check
npx vitest run
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/phase-3.json \
  npx playwright test --workers=1 --reporter=json
```

Read the JSON report; do not read a summary off stdout.

- [ ] **Step 5: Commit**

```bash
git add src/web/tests/e2e/publish-header.spec.ts
git commit -m "test(editor): prove the LAN control without a phone, and say what that misses"
```

---

## Phase 4 — The phone shows what you are editing (5 tasks)

Delivers: §6's acceptance bullet — *the phone shows the theme while the editor has it
open*. The host holds the document the editor is publishing; a display prefers it to the
stored theme; the editor pushes on change and stops when asked.

---

### Task 4.1: The published document, and the route that takes it

**Files:**
- Create: `src/web/packages/host/src/serve/published.ts`
- Test: `src/web/packages/host/src/serve/published.test.ts`
- Modify: `src/web/packages/host/src/server.ts` — `HostServerOptions`, `PUT`/`DELETE /api/publish`
- Test: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: `decodeThemeSave` (`themes/wire.ts:47`) — the editor already speaks this wire
  for a save, and publishing is the same document; `validateFabricThemeEnvelope`
  (`@vigilia/renderer-core`).
- Produces:
  ```ts
  export interface PublishedDocument {
    readonly id: string;
    readonly envelope: FabricThemeEnvelope;
    /** Bumped by every publish and by every stop. A display polls this. */
    readonly revision: number;
  }
  export interface PublishedStore {
    read(): PublishedDocument | undefined;
    publish(id: string, envelope: FabricThemeEnvelope): number;
    clear(): number;
    revision(): number;
  }
  export function createPublishedStore(): PublishedStore;
  ```
- Routes, both loopback-only: `PUT /api/publish` (body: the save wire, `overwrite`
  ignored) → `{ ok: true, id, revision }`; `DELETE /api/publish` → the same with
  `id: null`. `GET /api/publish` → `{ id, revision }` or `{ id: null, revision }`.

**Constraints.** **The document is validated before it is held**, with the same validator
the store uses — the overlay bypasses `themeStore.write`, so nothing else would check it,
and a display serves what it is given. **The id must already exist in the library**: a
published document's assets are served from `/api/themes/:id/assets/...`
(`server.ts:752-789`), so a document that was never saved has no assets to serve and the
display would render a theme with holes. A publish for an unknown id is a **409**, not an
overlay with a broken asset path.

- [ ] **Step 1: Write the failing tests**

Create `src/web/packages/host/src/serve/published.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createPublishedStore } from "./published.js";

describe("the published document", () => {
  it("starts empty and stays empty until something is published", () => {
    expect(createPublishedStore().read()).toBeUndefined();
  });

  it("answers with what was published, and a revision that moved", () => {
    const store = createPublishedStore();
    const before = store.revision();
    const after = store.publish("living-room", { schemaVersion: 2 } as never);

    expect(after).not.toBe(before);
    expect(store.read()).toMatchObject({ id: "living-room" });
  });

  it("counts a stop as a change, so a display stops showing what was published", () => {
    const store = createPublishedStore();
    store.publish("living-room", {} as never);
    const stopped = store.clear();

    expect(store.read()).toBeUndefined();
    expect(store.revision()).toBe(stopped);
  });
});
```

Add to `server.test.ts`:

```ts
it("holds a published document, and only for a theme it has", async () => {
  const host = createTestServer({});

  const refused = await request(
    host.server, "PUT", "/api/publish",
    JSON.stringify({ envelope: { schemaVersion: 2 }, assets: {} }),
    { headers: { "content-type": "application/json" } },
  );
  expect(refused.status()).toBe(409);

  const fromTheLan = await request(host.server, "PUT", "/api/publish", "{}", {
    remoteAddress: "10.0.0.2",
  });
  expect(fromTheLan.status).toBe(403);
});

it("refuses a document it cannot validate", async () => {
  const host = createTestServer({});
  const bad = await request(
    host.server, "PUT", "/api/publish",
    JSON.stringify({ envelope: { schemaVersion: 99 }, assets: {} }),
    { headers: { "content-type": "application/json" } },
  );
  expect(bad.status).toBe(400);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run packages/host/src/serve/published.test.ts packages/host/src/server.test.ts -t publish`
Expected: FAIL — the module does not exist and the route 404s.

- [ ] **Step 3: Write the minimal implementation**

Create `src/web/packages/host/src/serve/published.ts`:

```ts
import type { FabricThemeEnvelope } from "@vigilia/renderer-core";

/**
 * The document an author is looking at, held while they are looking at it.
 *
 * In memory and nowhere else. It is not a theme — nothing here is written to a
 * folder, nothing survives the host, and a display that asks for it falls back
 * to the stored document the moment it is gone. That is what makes "publishing"
 * different from "saving", and it is why a stop clears rather than reverts.
 *
 * The revision is the whole subscription mechanism: a display polls one small
 * number and re-reads only when it moves.
 */

export interface PublishedDocument {
  readonly id: string;
  readonly envelope: FabricThemeEnvelope;
  readonly revision: number;
}

export interface PublishedStore {
  read(): PublishedDocument | undefined;
  publish(id: string, envelope: FabricThemeEnvelope): number;
  clear(): number;
  revision(): number;
}

export function createPublishedStore(): PublishedStore {
  let current: PublishedDocument | undefined;
  let revision = 0;

  return {
    read: () => current,
    publish(id, envelope) {
      revision += 1;
      current = { id, envelope, revision };
      return revision;
    },
    clear() {
      revision += 1;
      current = undefined;
      return revision;
    },
    revision: () => revision,
  };
}
```

In `server.ts`, add `readonly published?: PublishedStore` to `HostServerOptions`, default
it (`const published = options.published ?? createPublishedStore();`), and add the routes
**after** the `PUT /api/themes/:id` block so the theme's own routes are matched first:

```ts
    // Publishing is admin, like a save: it decides what every display shows, and
    // it holds a credential-free copy of the author's document in memory.
    if (url.pathname === "/api/publish") {
      if (!isLoopbackRemote(request.socket.remoteAddress)) {
        sendText(response, 403, "Publishing is available on this PC only.");
        return;
      }

      if (request.method === "PUT") {
        let decoded: DecodedThemeSave;
        try {
          decoded = decodeThemeSave(await readBody(request, MAX_THEME_UPLOAD_BYTES));
        } catch (error) {
          sendText(response, 400, error instanceof Error ? error.message : String(error));
          return;
        }

        const id = url.searchParams.get("id") ?? "";
        // The assets a display fetches come from the theme's own folder, so a
        // document with no folder would render with holes. Refusing is honest;
        // publishing it anyway is not.
        if (!isValidThemeId(id) || (await themeStore?.read(id)) === undefined) {
          sendText(response, 409, `No theme "${id}" in this library to publish.`);
          return;
        }

        const checked = validateFabricThemeEnvelope(decoded.content.envelope);
        if (!checked.ok) {
          sendText(response, 400, `That document is not a theme: ${checked.code}`);
          return;
        }

        const revision = published.publish(id, checked.value);
        sendJson(response, 200, { ok: true, id, revision });
        return;
      }

      if (request.method === "DELETE") {
        sendJson(response, 200, { ok: true, id: null, revision: published.clear() });
        return;
      }

      if (request.method === "GET") {
        const current = published.read();
        sendJson(response, 200, {
          id: current?.id ?? null,
          revision: published.revision(),
        });
        return;
      }

      sendText(response, 405, "Only GET, PUT and DELETE are supported.");
      return;
    }
```

Check `validateFabricThemeEnvelope`'s actual return shape in `renderer-core` before
writing those three lines — it is an existing contract, and this is the one place in the
task where the exact field names must be read rather than assumed.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/host/src/serve/published.test.ts packages/host/src/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Prove the tests can fail**

Delete the `validateFabricThemeEnvelope` guard. Re-run Step 4. Expected: FAIL on the
"cannot validate" case with 200. Restore it.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/host/src/serve/published.ts \
        src/web/packages/host/src/serve/published.test.ts \
        src/web/packages/host/src/server.ts \
        src/web/packages/host/src/server.test.ts
git commit -m "feat(host): hold the document an author is publishing"
```

---

### Task 4.2: A display prefers it to the stored theme

**Files:**
- Modify: `src/web/packages/host/src/server.ts` — `/api/themes/:id/document`, `/` routing, the revision route
- Test: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: `PublishedStore` (Task 4.1).
- Produces:
  - `GET /api/themes/:id/document` returns the published envelope when
    `published.read()?.id === id`, and the stored one otherwise.
  - `GET /api/published` — display-readable with a session, like `/api/display` — →
    `{ id, revision }`, which is what a phone polls.
  - `/` resolves through the published id first, then the stored choice.

**Constraints.** The overlay replaces the **document** and nothing else: the theme's own
assets, answers, thumbnail and settings still come from its folder, because the folder is
what the document was published *against*. `GET /api/published` is a new read surface, so
it goes behind the same display guard the other display reads use
(`server.ts:654-663`) — a phone with no session must not be able to enumerate what this PC
is holding.

- [ ] **Step 1: Write the failing tests**

Add to `server.test.ts`:

```ts
it("serves the published document to a display that asks for that theme", async () => {
  const host = createTestServer({});
  // Seed a stored theme, publish a different document over it, and read both.
  const stored = await request(host.server, "GET", "/api/themes/living-room/document");
  const publishedBody = JSON.stringify({
    envelope: { ...(stored.json() as object), artboard: { width: 320, height: 240 } },
    assets: {},
  });

  const published = await request(
    host.server, "PUT", "/api/publish?id=living-room", publishedBody,
    { headers: { "content-type": "application/json" } },
  );
  expect(published.status).toBe(200);

  const shown = await request(host.server, "GET", "/api/themes/living-room/document");
  expect((shown.json() as { artboard: unknown }).artboard).toEqual({ width: 320, height: 240 });

  // The stored document is untouched: publishing is not saving.
  await request(host.server, "DELETE", "/api/publish");
  const again = await request(host.server, "GET", "/api/themes/living-room/document");
  expect((again.json() as { artboard: unknown }).artboard).not.toEqual({ width: 320, height: 240 });
});

it("hides the revision from an unpaired display", async () => {
  const host = createTestServer({ sessions: createSessionStore() });
  const refused = await request(host.server, "GET", "/api/published", undefined, {
    remoteAddress: "192.168.1.50",
  });
  expect(refused.status).toBe(403);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run packages/host/src/server.test.ts -t "published document"`
Expected: FAIL — the second read still answers the stored artboard.

- [ ] **Step 3: Write the minimal implementation**

In the `docMatch` block (`server.ts:910-928`), before the store read:

```ts
      // A display showing the theme an author is editing shows the document as
      // it stands, not as it was last saved. The folder it came from is
      // unchanged: this is the display's view, and it lasts as long as the
      // publish does.
      const live = published.read();
      if (live !== undefined && live.id === rawId) {
        sendJson(response, 200, live.envelope);
        return;
      }
```

Add the revision route beside `GET /api/display`'s read arm:

```ts
    // One number, so a display can tell whether what it is showing is still
    // what the author is publishing. A display read, so it is behind the same
    // guard: what this PC is holding is not something the network enumerates.
    if (url.pathname === "/api/published") {
      if (
        !isLoopbackRemote(request.socket.remoteAddress) &&
        !allowed(request, url)
      ) {
        sendText(response, 403, "This display is not paired with the host.");
        return;
      }

      const live = published.read();
      sendJson(response, 200, { id: live?.id ?? null, revision: published.revision() });
      return;
    }
```

In the `/` resolution (`server.ts:1113-1160`), make the published id win:

```ts
      const live = published.read();
      const theme =
        live?.id ??
        requested ??
        stored ??
        (available.length === 1 ? available[0]?.id : undefined);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/host/src/server.test.ts`
Expected: PASS, including the four pre-existing `/` resolution tests — if one of them now
fails it is because a published store leaked between tests, which is a fixture bug and not
a behaviour change.

- [ ] **Step 5: Prove the tests can fail**

Remove the `live?.id ??` from the `/` resolution. Re-run Step 4. Expected: FAIL on the
first test's second half — the display falls back to the stored document. Restore it.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts
git commit -m "feat(host): a display shows what is being published, and the folder stays what it was"
```

---

### Task 4.3: The phone follows

**Files:**
- Create: `src/web/packages/player/src/publish-follower.ts`
- Test: `src/web/packages/player/src/publish-follower.test.ts`
- Modify: `src/web/packages/player/src/main.ts` — `startHostedTheme`

**Interfaces:**
- Consumes: `GET /api/published` (Task 4.2); `DisplaySessionToken.fetch`
  (`player/src/session.ts`).
- Produces:
  ```ts
  export function followPublished(
    session: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> },
    reload: () => void,
    options?: { readonly intervalMs?: number; readonly now?: () => number },
  ): () => void;
  ```
  Returns a stop function.

**Constraints.** **A refusal is not "no change".** A session that expires turns every poll
into a 403; treating that as "nothing moved" leaves a display frozen on a stale document
and saying nothing about why, which is Review Focus 4. A refusal stops the follower and
reports on the display's own connection surface (`showConnectionState`), so the reader is
told rather than shown a still image forever. **The reload is deliberate**: the display is
a phone showing a dashboard, and the smallest correct way to show a new document is to come
back with it. Marked with `ponytail:` rather than pretending it is a diff.

- [ ] **Step 1: Write the failing test**

Create `src/web/packages/player/src/publish-follower.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { followPublished } from "./publish-follower.js";

const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("followPublished", () => {
  it("does not reload while the revision sits still", async () => {
    const reload = vi.fn();
    const stop = followPublished(
      { fetch: answer({ id: "living-room", revision: 4 }) },
      reload,
      { intervalMs: 5 },
    );

    await new Promise((resolve) => setTimeout(resolve, 40));
    stop();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once the revision moves", async () => {
    let revision = 4;
    const reload = vi.fn();
    const stop = followPublished(
      { fetch: vi.fn(async () => new Response(JSON.stringify({ id: "living-room", revision }))) },
      reload,
      { intervalMs: 5 },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    revision = 5;
    await new Promise((resolve) => setTimeout(resolve, 40));
    stop();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("stops, and says so, when the host refuses the session", async () => {
    const reload = vi.fn();
    const refused = vi.fn();
    const stop = followPublished(
      { fetch: answer({ error: "not paired" }, 403) },
      reload,
      { intervalMs: 5, onRefused: refused },
    );

    await new Promise((resolve) => setTimeout(resolve, 40));
    const calls = refused.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 40));
    stop();

    expect(calls).toBeGreaterThan(0);
    // Stopped: a refusal is reported once, not polled forever.
    expect(refused.mock.calls.length).toBe(calls);
    expect(reload).not.toHaveBeenCalled();
  });
});
```

Add `readonly onRefused?: (reason: string) => void` to the options in the interface block
when you write the module.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/player/src/publish-follower.test.ts`
Expected: FAIL — `Failed to resolve import "./publish-follower.js"`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/web/packages/player/src/publish-follower.ts`:

```ts
/**
 * Whether what this display is showing is still what the author is publishing.
 *
 * One small number, polled, because the display already holds an SSE connection
 * for readings and adding a second event channel would be a second owner for
 * "the host has news". A refusal is not silence: a session that expired turns
 * every poll into a 403, and a follower that read that as "nothing changed"
 * would leave a frozen dashboard with no explanation (§ Review Focus 4).
 *
 * `ponytail:` comes back with the document rather than diffing it in place —
 * a flash on a phone that is usually on a wall, for one screenful of code. If
 * the flash ever matters, the upgrade is to hand the new envelope to the
 * existing mount instead of reloading.
 */

export interface PublishFollowerSession {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface PublishFollowerOptions {
  readonly intervalMs?: number;
  readonly onRefused?: (reason: string) => void;
}

const DEFAULT_INTERVAL_MS = 2_000;

export function followPublished(
  session: PublishFollowerSession,
  reload: () => void,
  options: PublishFollowerOptions = {},
): () => void {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  let stopped = false;
  let last: number | undefined;

  const tick = async (): Promise<void> => {
    if (stopped) return;

    try {
      const response = await session.fetch("/api/published");

      if (response.status === 403 || response.status === 404) {
        stopped = true;
        options.onRefused?.(
          "This display is no longer paired with the host.",
        );
        return;
      }

      if (response.ok) {
        const body = (await response.json()) as { revision?: unknown };
        if (typeof body.revision === "number") {
          if (last !== undefined && body.revision !== last) {
            reload();
            return;
          }
          last = body.revision;
        }
      }
    } catch {
      // A host that is briefly unreachable is the connection surface's news,
      // not this follower's: the readings stream already says it.
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
```

- [ ] **Step 4: Wire it into `startHostedTheme`**

After the scene is mounted and the live source is running, start the follower and hand it
`showConnectionState` for a refusal:

```ts
  // Only a host-served display follows a publish: a fixture theme is not
  // something an author is editing.
  followPublished(session, () => window.location.reload(), {
    onRefused: (reason) => showConnectionState("refused", 0, reason),
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run packages/player/src`
Expected: PASS, including the existing player tests.

- [ ] **Step 6: Prove the test can fail**

Change the refusal branch so it does not set `stopped = true`. Re-run Step 5. Expected:
FAIL on the third test — `onRefused` is called more than once. Restore it.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/player/src/publish-follower.ts \
        src/web/packages/player/src/publish-follower.test.ts \
        src/web/packages/player/src/main.ts
git commit -m "feat(player): a display follows what the author is publishing"
```

---

### Task 4.4: The editor publishes on change, and stops

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/session-facade.ts` — one method
- Modify: `src/web/packages/editor/src/editor-session.ts` — implement it
- Create: `src/web/packages/editor/src/publish-client.ts`
- Test: `src/web/packages/editor/src/publish-client.test.ts`
- Modify: `src/web/packages/editor/src/editor-main.ts`
- Modify: `src/web/packages/editor/src/editor-shell/publish-control.tsx`

**Interfaces:**
- Consumes: `PUT`/`DELETE /api/publish?id=` (Task 4.1); `subscribeDocumentChange` and
  `isDirty` (existing facade, `session-facade.ts:34-37`).
- Produces:
  ```ts
  // session-facade.ts
  /** The document as it stands, and the id a display must fetch its assets
   *  from. `undefined` when this document has never been saved: a published
   *  document's assets come from the theme's folder, so there would be none. */
  publishableDocument(): { readonly id: string; readonly envelope: FabricThemeEnvelopeInput } | undefined;
  ```
  ```ts
  // publish-client.ts
  export function createPublisher(options?: { readonly debounceMs?: number }): {
    /** Offers the document; the latest offer wins. */
    offer(document: { readonly id: string; readonly envelope: FabricThemeEnvelopeInput }): void;
    stop(): Promise<void>;
  };
  ```

**Constraints.** **Publishing never saves.** The overlay is memory; the library is disk. An
author who publishes and never saves keeps their edits out of their library, and the
control says which document is live so that is not a surprise. **A publish that fails is
reported once and does not retry in a loop** — an editor that hammered the host would make
the connection surface useless. The debounce is the whole rate limit; there is no timer
beyond it.

- [ ] **Step 1: Write the failing test**

Create `src/web/packages/editor/src/publish-client.test.ts`:

```ts
import { afterEach, expect, it, vi } from "vitest";
import { createPublisher } from "./publish-client.js";

afterEach(() => vi.unstubAllGlobals());

const document = { id: "living-room", envelope: { schemaVersion: 2 } as never };

it("sends the latest document once, not every edit", async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, revision: 1 })));
  vi.stubGlobal("fetch", fetch);

  const publisher = createPublisher({ debounceMs: 5 });
  publisher.offer(document);
  publisher.offer(document);
  publisher.offer(document);

  await new Promise((resolve) => setTimeout(resolve, 30));
  await publisher.stop();

  expect(fetch.mock.calls.filter(([url]) => String(url).startsWith("/api/publish?"))).toHaveLength(1);
});

it("stops by telling the host, so the display goes back to the stored theme", async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetch);

  const publisher = createPublisher({ debounceMs: 5 });
  publisher.offer(document);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await publisher.stop();

  expect(fetch.mock.calls.at(-1)?.[1]).toMatchObject({ method: "DELETE" });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/publish-client.test.ts`
Expected: FAIL — `Failed to resolve import "./publish-client.js"`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/web/packages/editor/src/publish-client.ts`:

```ts
import type { FabricThemeEnvelopeInput } from "@vigilia/renderer-core";

/**
 * Pushes the document being edited to the host, at most once per burst.
 *
 * One owner for the rate limit and one for the transport, because a save is
 * explicit and a publish is continuous: the editor must not write a theme
 * folder every time a shape moves, and it must not send a document the author
 * has already moved past. The debounce *is* the rate limit — there is no second
 * timer, and no queue: a publish that is superseded is dropped, not replayed.
 */
const DEFAULT_DEBOUNCE_MS = 400;

export interface Publisher {
  offer(document: {
    readonly id: string;
    readonly envelope: FabricThemeEnvelopeInput;
  }): void;
  stop(): Promise<void>;
}

export function createPublisher(
  options: { readonly debounceMs?: number; readonly onError?: (message: string) => void } = {},
): Publisher {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { readonly id: string; readonly envelope: FabricThemeEnvelopeInput } | undefined;
  let live = false;

  const send = async (): Promise<void> => {
    timer = undefined;
    const next = pending;
    pending = undefined;
    if (next === undefined) return;

    try {
      const response = await fetch(`/api/publish?id=${encodeURIComponent(next.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ envelope: next.envelope, assets: {} }),
      });
      if (!response.ok) {
        live = false;
        options.onError?.((await response.text()).trim());
        return;
      }
      live = true;
    } catch (error) {
      live = false;
      options.onError?.(error instanceof Error ? error.message : String(error));
    }
  };

  return {
    offer(document) {
      pending = document;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => void send(), debounceMs);
    },

    async stop() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
      if (!live) return;
      live = false;

      try {
        await fetch("/api/publish", { method: "DELETE" });
      } catch {
        // The host holds it in memory and its own lifetime ends with the
        // process; a stop that cannot be delivered is not work lost.
      }
    },
  };
}
```

In `session-facade.ts` add the method to `EditorActionFacade`, and in `editor-session.ts`
implement it from `#snapshot` and the id the session already tracks for its base:

```ts
    publishableDocument: () => {
      const id = this.#storedId;
      return id === undefined
        ? undefined
        : { id, envelope: this.#snapshot(options.shell) };
    },
```

Use whatever field already holds the saved document's id — read `#saveLibrary` and the
`base` handling before naming it, and **do not invent a second id**.

In `editor-main.ts`, hold one publisher for the session's lifetime: subscribe to
`active.bridge.session.subscribeDocumentChange`, and on each change call
`publisher.offer(document)` when `publishableDocument()` answers. When the control turns
publishing off, or the page is going away, `await publisher.stop()`:

```ts
  window.addEventListener("pagehide", () => {
    void publisher.stop();
  });
```

In `publish-control.tsx`, when the LAN is on, publishing is on: the control offers the
document through a callback the shell passes it, and shows `uiCopy.publish.live(name)` for
the document it is publishing, or `uiCopy.publish.unsaved` when
`publishableDocument()` answered `undefined`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/editor/src`
Expected: PASS.

- [ ] **Step 5: Prove the tests can fail**

Remove the `if (timer !== undefined) clearTimeout(timer)` line in `offer`. Re-run Step 4.
Expected: FAIL on the first test — three publishes instead of one. Restore it.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/publish-client.ts \
        src/web/packages/editor/src/publish-client.test.ts \
        src/web/packages/editor/src/editor-shell/session-facade.ts \
        src/web/packages/editor/src/editor-session.ts \
        src/web/packages/editor/src/editor-main.ts \
        src/web/packages/editor/src/editor-shell/publish-control.tsx \
        src/web/packages/editor/src/ui-copy.ts
git commit -m "feat(editor): publishing follows the document, and stops when asked"
```

---

### Task 4.5: The whole loop, proved

**Files:**
- Create: `src/web/tests/e2e/publish-loop.spec.ts`
- Modify: `src/web/playwright.config.ts` — the new spec needs its own host

**Interfaces:** none new.

**Constraints.** This spec starts **one real host** on its own port over its own app
directory, drives the editor through that host's `/editor/` mount, and reads the display
page the same host serves at `/`. It is one document, one author, one phone-sized viewport.
**A real phone is not available**, so the display is a phone-sized Chromium and the QR is
proved by its own decode test rather than by a camera — and the task says so in the spec's
own header comment.

- [ ] **Step 1: Write the spec**

Create `src/web/tests/e2e/publish-loop.spec.ts`, modeled on
`tests/e2e/author-journey-display.spec.ts`'s own-host arrangement (its `HOST_PORT`,
`APP_DIR`, spawn, and health wait are the pattern to copy — do not copy its composition
builders, which this spec does not need):

```ts
test("an edit reaches the display while the editor has it open", async ({ page, context }) => {
  // Author: open the stored theme, publish, move something.
  await page.goto(`${HOST}/editor/`);
  await page.locator("[data-vigilia-publish]").getByRole("button").click();
  await expect(page.locator("[data-vigilia-qr]")).toBeVisible();

  const display = await context.newPage();
  await display.setViewportSize({ width: 390, height: 844 });
  await display.goto(`${HOST}/`);
  await expect(display.locator("#artboard")).toBeVisible();
  const before = await display.locator("#artboard").screenshot();

  // The edit the display must follow: the artboard is a document fact, so it
  // is read back from the file the display actually loaded, not from a colour.
  await page.evaluate(() => {
    const bridge = (window as unknown as { __vigilia?: { editor: { artboard: { set(w: number, h: number): void } } } }).__vigilia;
    bridge?.editor.artboard.set(320, 240);
  });
  await expect(page.locator("[data-vigilia-publish]")).toContainText(/publishing|live/i);

  // The display comes back with the published document, on its own.
  await expect
    .poll(async () => (await display.locator("#artboard").screenshot()).length, { timeout: 15_000 })
    .not.toBe(before.length);

  const shown = await display.evaluate(async () =>
    (await (await fetch("/api/themes/" + new URL(location.href).searchParams.get("theme") + "/document")).json()) as {
      artboard: { width: number; height: number };
    },
  );
  expect(shown.artboard).toEqual({ width: 320, height: 240 });

  await display.screenshot({ path: "test-results/publish/display-390.png" });
});
```

Read the editor's own bridge handle out of the source before using it — `window.__vigilia`
is named here from memory and must be replaced with the real global the editor exposes (see
`tests/e2e/rebuild-driver.ts`, which already reaches the editor's bridge).

Add a second test in the same file, which is Review Focus 5's pin — **the author leaving is
a change the display sees**:

```ts
test("closing the editor puts the display back on the stored theme", async ({ page, context }) => {
  await page.goto(`${HOST}/editor/`);
  await page.locator("[data-vigilia-publish]").getByRole("button").click();

  const display = await context.newPage();
  await display.setViewportSize({ width: 390, height: 844 });
  await display.goto(`${HOST}/`);
  const published = await display.evaluate(async () =>
    (await (await fetch("/api/published")).json()) as { id: string | null },
  );
  expect(published.id).not.toBeNull();

  // `pagehide` is what a closed tab fires, and it is the only hook this has: a
  // crash or a killed browser leaves the overlay in the host's memory, which is
  // the ceiling Task 4.4's `ponytail:` names rather than hides.
  await page.close();

  await expect
    .poll(async () =>
      (await display.evaluate(async () =>
        (await (await fetch("/api/published")).json()) as { id: string | null },
      )).id,
    { timeout: 10_000 })
    .toBeNull();
});
```

- [ ] **Step 2: Run it**

```bash
cd src/web
npx vite build packages/editor && npx vite build packages/player
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/task-4-5.json \
  npx playwright test tests/e2e/publish-loop.spec.ts --workers=1 --reporter=json
```

Read the JSON report and **look at `test-results/publish/display-390.png`**. The display
must show the 320 × 240 document, not the stored one.

- [ ] **Step 3: Prove the browser test can fail**

Turn off the follower in `main.ts` (comment out the `followPublished` call), rebuild the
player, re-run Step 2. Expected: FAIL at the poll — the display never comes back. Restore,
rebuild.

- [ ] **Step 4: Run the whole gate**

```bash
cd src/web
npm run typecheck                              # judged by exit code
./node_modules/.bin/biome lint ..
npm run format:check
npm run status:check
npx vitest run
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/phase-4.json \
  npx playwright test --workers=1 --reporter=json
npm run gates:self-test
```

- [ ] **Step 5: Commit**

```bash
git add src/web/tests/e2e/publish-loop.spec.ts src/web/playwright.config.ts
git commit -m "test(publish): the whole loop — edit, publish, display follows"
```

---

## Closing report — what to say and what not to

When the plan is executed, the report back to the controller names, at minimum:

- **What was verified, and where the evidence is** — the JSON report path and the
  screenshot paths for each browser claim. A green unit suite is not evidence that a header
  shows an address.
- **What is not verified.** At least: that a real phone, at a real distance, in real light,
  scans the code off a real screen. Nothing in this plan tests that, and no amount of green
  says it does.
- **The findings filed and not fixed** — at least Task 1.3's `lanAddress()` row, and any
  other `Discovered, not fixed:` trailer this work produced.
- **The contradiction this plan found and did not resolve:** §6 says the Preview/Live
  switch "stays in canvas controls where the canvas is (plan 1, task 4)". It is not in
  canvas controls and never has been; the plan 1 Task 4 that would have put it there is
  `vg-161`'s, and `canvas-view-controls.tsx` does not exist. This plan changed the copy
  where the switch is.
