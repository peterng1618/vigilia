# Per-display themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each display client holds its own theme and its own answers, and both
survive a restart of the host.

**Architecture:** A display becomes a persisted record with a stable id, separate
from the short-lived session token that names it on the wire. The active theme
becomes one map keyed by display id plus a reserved `default` key, the answers
file gains a display level above its theme level, and `GET /` resolves the asking
display's entry before the default.

**Tech Stack:** TypeScript, Node 22.12+ (ESM, `node:fs/promises`), Vitest,
Playwright, Biome. npm workspace under `src/web/`.

**Spec:** `docs/superpowers/specs/2026-10-18-per-display-themes-design.md` — the
plan argues from the spec, so read both. Register row: `vg-574`.

## Global Constraints

- Run every command from `src/web/`. Scripts are `package.json`'s; read them
  there rather than trusting a copy.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled.
  Refuse invalid numeric or string input rather than coercing it to zero or to a
  default.
- One owner per concept. A theme id, a display id and a device id are three
  different things and none may be validated by a second hand-rolled pattern.
- Stage explicit paths. Never `git add -A`, never `git commit -a`.
- 500 lines is a signal and 800 is a stop for a normal source file.
- Conventional Commit titles. Comments explain **why**, are 1–3 lines, and never
  narrate the change.
- `host/src/server.ts` is on the reuse gate's watchlist: a note at
  `docs/decisions/NNNN-<slug>.md` must claim it before the first write there.
- This plan lands before `2026-10-18-theme-store.md`, which consumes Task 4.4's
  assign action and does not restate this model.

## Review Focus

Five inputs and conditions the spec implies and no task's own tests exercise.
Each gets its test in the task named beside it.

1. **A display whose assigned theme was deleted** — a person removes a theme from
   the library while a wall screen holds it. The display must fall to the default
   and keep showing something, never an error page or a blank stage. (Task 2.2)
2. **A label that mints no usable id** — `"???"`, `"---"`, a 200-character name, an
   emoji-only name. Pairing must refuse with a reason rather than mint a display
   whose id no other file will accept. (Task 1.1)
3. **A hand-edited `theme-answers.json` with an unknown display or group** — the
   file is a plain JSON file a person can open. An unknown key must be dropped,
   not carried into a lookup. (Task 3.1)
4. **Two displays that both answer a question, then one display's record is
   deleted** — the other display's answers must be untouched, and the deleted
   display's must be gone rather than orphaned. (Task 3.2)
5. **A paired client that sends another display's id** — the pairing route is
   loopback-only, so it must refuse before it reads the parameter, not after.
   (Task 1.3)

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/host/src/settings/displays.ts` (create) | The display record: its id, its minting rules, and the persisted list |
| `packages/host/src/settings/devices.ts` (modify) | Exports `DEVICE_ID_PATTERN`, the one id shape the host accepts |
| `packages/host/src/settings/theme-settings.ts` (modify) | Answers gain a display level above their theme level |
| `packages/host/src/settings/active-theme.ts` (modify) | One map from display key to theme id, `default` reserved |
| `packages/host/src/session/pairing.ts` (modify) | A session names a display; it still owns nothing else |
| `packages/host/src/server.ts` (modify) | Which display is asking; the routes; the resolution order |
| `packages/player/src/publish-follower.ts` (modify) | A display follows its own reassignment |
| `packages/host/public/library.html`, `settings.html` (modify) | The two host pages write the display they name |

---

## Phase 1 — The display record

### Task 1.1: The display store

**Files:**
- Create: `src/web/packages/host/src/settings/displays.ts`
- Create: `src/web/packages/host/src/settings/displays.test.ts`
- Modify: `src/web/packages/host/src/settings/devices.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `devices.ts`: `export const DEVICE_ID_PATTERN: RegExp` (the existing
    `/^[a-z0-9][a-z0-9-]{0,63}$/`, moved from a module-local const to an export).
  - `displays.ts`:
    - `export const LOCAL_DISPLAY_ID = "this-pc"`
    - `export const DEFAULT_DISPLAY = "default"`
    - `export interface DisplayRecord { readonly id: string; readonly label: string; readonly createdAt: string }`
    - `export interface DisplayStore { list(): Promise<readonly DisplayRecord[]>; create(label: string): Promise<DisplayRecord>; find(id: string): Promise<DisplayRecord | undefined>; remove(id: string): Promise<boolean> }`
    - `export function createDisplayStore(directory: string, options?: { readonly now?: () => number; readonly randomSuffix?: () => string }): DisplayStore`
    - `export function displayIdFrom(label: string, suffix: string): string` — the slug rule, pure, so its refusals are unit-testable.

- [ ] **Step 1: Write the failing test**

```ts
// displays.test.ts
import { describe, expect, it } from "vitest";
import { createDisplayStore, displayIdFrom } from "./displays.js";

describe("displayIdFrom", () => {
  it("slugs a label into the host's one id shape", () => {
    expect(displayIdFrom("Kitchen Tablet", "")).toBe("kitchen-tablet");
  });

  it("refuses a label that yields nothing usable", () => {
    for (const label of ["???", "---", "   ", "🌡️"]) {
      expect(() => displayIdFrom(label, "a1b2")).toThrow(/usable id/);
    }
  });

  it("shortens a long label so the suffix still fits the 64-character bound", () => {
    const id = displayIdFrom("x".repeat(200), "a1b2");
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id.endsWith("-a1b2")).toBe(true);
  });
});

describe("createDisplayStore", () => {
  it("mints a record and lists it", async () => { /* create("Kitchen tablet") -> id "kitchen-tablet"; list() has it */ });
  it("adds a suffix when the slug is taken", async () => { /* second create("Kitchen tablet") -> id !== first */ });
  it("refuses the two reserved ids", async () => {
    await expect(store.create("this pc")).rejects.toThrow(/reserved/);
    await expect(store.create("default")).rejects.toThrow(/reserved/);
  });
  it("survives a new store over the same directory", async () => { /* create, re-create, list() still has it */ });
  it("removes a record", async () => { /* remove(id) true, then false for the same id */ });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/settings/displays.test.ts`
Expected: FAIL — cannot resolve `./displays.js`.

- [ ] **Step 3: Implement the store**

`displays.ts` owns one file, `displays.json`, holding
`{ displays: DisplayRecord[] }`. Read it the way `devices.ts` reads its own:
a missing or unreadable file is an empty list, and every record is normalised on
read (an id failing `DEVICE_ID_PATTERN`, a non-string label, a label longer than
64 characters, or a duplicate id is dropped) — a hand-edited file must not be able
to introduce a display nothing else accepts.

`create` slugs the label, and appends `-<suffix>` when the slug is taken, where
the suffix is `options.randomSuffix?.() ?? randomBytes(2).toString("hex")`. It
throws `Error` with `reserved` in the message for `LOCAL_DISPLAY_ID` and
`DEFAULT_DISPLAY`, and with `usable id` when `displayIdFrom` refuses. In
`devices.ts`, replace the module-local `ID_PATTERN` with the exported
`DEVICE_ID_PATTERN` and delete `theme-settings.ts`'s own `DEVICE_ID`, importing
the shared one — three copies of one shape is the defect this task exists to
prevent.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/settings/displays.test.ts packages/host/src/settings/devices.test.ts packages/host/src/settings/theme-settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/settings/displays.ts src/web/packages/host/src/settings/displays.test.ts src/web/packages/host/src/settings/devices.ts src/web/packages/host/src/settings/theme-settings.ts
git commit -m "feat(host): give a display a persisted record with its own id"
```

### Task 1.2: A session names a display

**Files:**
- Modify: `src/web/packages/host/src/session/pairing.ts`
- Test: `src/web/packages/host/src/session/pairing.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.1 — the session store stays ignorant of the
  display store, and the route composes the two.
- Produces:
  - `DisplaySession` gains `readonly displayId: string`.
  - `SessionStore.create(label: string, displayId: string): DisplaySession`
    (was `create(label)`).
  - `SessionStore.find(token: string | undefined): DisplaySession | undefined` —
    the lookup `verify` cannot give, because a display id has to come back out.

- [ ] **Step 1: Write the failing test**

```ts
it("carries the display it names", () => {
  const session = store.create("Kitchen tablet", "kitchen-tablet");
  expect(session.displayId).toBe("kitchen-tablet");
  expect(store.find(session.token)?.displayId).toBe("kitchen-tablet");
});

it("finds nothing for a token it never issued, and nothing for undefined", () => {
  expect(store.find("nope")).toBeUndefined();
  expect(store.find(undefined)).toBeUndefined();
});

it("still compares in constant time", () => {
  // verify() keeps using sameToken; find() must not become the path a caller
  // uses to compare a secret.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/session/pairing.test.ts`
Expected: FAIL — `create` takes one argument; `find` is not a function.

- [ ] **Step 3: Implement**

`find` walks the stored sessions and answers the one whose token matches under
`sameToken`, sweeping first, as `verify` does. `verify` becomes
`find(token) !== undefined` rather than a second loop, so there is one comparison
in the file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/session/pairing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/session/pairing.ts src/web/packages/host/src/session/pairing.test.ts
git commit -m "feat(host): a session names the display it is for"
```

### Task 1.3: Pairing against a display

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Test: `src/web/packages/host/src/server.test.ts`
- Create: `docs/decisions/0068-display-identity-in-the-server.md` (the watched
  path's note — see Global Constraints)

**Interfaces:**
- Consumes: `DisplayStore`, `createDisplayStore`, `LOCAL_DISPLAY_ID` (Task 1.1);
  `SessionStore.find`, `create(label, displayId)` (Task 1.2).
- Produces: `HostServerOptions` gains `readonly displays?: DisplayStore`. The
  routes below, all loopback-only as they are today.

- [ ] **Step 1: Write the failing test**

```ts
it("mints a display and a session for it", async () => {
  // POST /api/pairing/sessions?label=Kitchen+tablet -> 201, body.session.displayId
  //   is "kitchen-tablet", and GET /api/pairing/sessions lists that display.
});

it("gives an existing display another session rather than a second display", async () => {
  // POST ?displayId=kitchen-tablet -> 201 with the same displayId, and the
  // display list is still one long.
});

it("leaves the display when a session is revoked", async () => {
  // DELETE /api/pairing/sessions/<token> -> 200, then GET lists the display still.
});

it("refuses a displayId from off loopback before reading it", async () => {
  // A non-loopback POST ?displayId=kitchen-tablet -> 403 "Pairing is available
  // on this PC only.", and the display list is unchanged.
});

it("answers 404 for a displayId it does not know", async () => {
  // POST ?displayId=nobody -> 404, and no session is minted.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/server.test.ts -t pairing`
Expected: FAIL.

- [ ] **Step 3: Implement**

The pairing block already refuses non-loopback first; keep that order so the
guard precedes the parameter read. `POST` with `displayId` finds the record and
mints `sessions.create(record.label, record.id)`; with `label`, calls
`displays.create(label)` first and then mints for it. `GET` answers
`{ sessions, displays }`. `DELETE` revokes the session and touches no display.

The decision note claims `server.ts` before this write and records all seven
reuse-gate rungs, including the rungs that found nothing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts docs/decisions/0068-display-identity-in-the-server.md
git commit -m "feat(host): pair a session against a persisted display"
```

---

## Phase 2 — The per-display map

### Task 2.1: One map, with `default` reserved

**Files:**
- Modify: `src/web/packages/host/src/settings/active-theme.ts`
- Test: `src/web/packages/host/src/settings/active-theme.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_DISPLAY` (Task 1.1).
- Produces: `ActiveThemeStore` becomes
  - `read(display: string, exists: (id: string) => Promise<boolean>): Promise<string | undefined>`
  - `write(display: string, id: string): Promise<void>`
  - `clear(display: string): Promise<void>`
  - `readAll(): Promise<Readonly<Record<string, string>>>`

  The file is `{ "<display>": "<theme id>" }`, flat, with `default` an ordinary
  key — so there is no second shape for a reader to get wrong.

- [ ] **Step 1: Write the failing test**

```ts
it("reads back what one display was given, and nothing for another", async () => {
  await store.write("this-pc", "attic-wall");
  expect(await store.read("this-pc", yes)).toBe("attic-wall");
  expect(await store.read("kitchen-tablet", yes)).toBeUndefined();
});

it("treats a theme that is gone as no choice", async () => {
  await store.write("this-pc", "deleted-theme");
  expect(await store.read("this-pc", async () => false)).toBeUndefined();
});

it("reads the old single-theme file as the default", async () => {
  // Write {"id":"living-room"} by hand, then read(DEFAULT_DISPLAY) -> "living-room".
});

it("refuses an id that is not a theme id, on write", async () => {
  await expect(store.write("this-pc", "../etc")).rejects.toThrow();
});

it("clears one display without touching another", async () => { /* ... */ });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/settings/active-theme.test.ts`
Expected: FAIL — `read` takes one argument.

- [ ] **Step 3: Implement**

Every key is validated against `THEME_ID` on write and dropped on read when it
does not match. **The old shape is read as the default** — an object whose `id` is
a string and which holds no `default` key is read as `{ default: id }`. That is a
migration of a person's own choice rather than compatibility glue for a superseded
internal design: losing it would leave a working dashboard blank. The next write
persists the new shape and the old key is not written again.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/settings/active-theme.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/settings/active-theme.ts src/web/packages/host/src/settings/active-theme.test.ts
git commit -m "feat(host): hold a theme per display, with a default"
```

### Task 2.2: `GET /` resolves the asking display

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Test: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: `ActiveThemeStore.read(display, exists)` (Task 2.1);
  `SessionStore.find` (Task 1.2); `LOCAL_DISPLAY_ID`, `DEFAULT_DISPLAY` (Task 1.1).
- Produces: `export function displayKeyFor(request: http.IncomingMessage, url: URL, sessions: SessionStore | undefined): string`
  — loopback answers `LOCAL_DISPLAY_ID`, a live session answers its `displayId`,
  anything else answers `DEFAULT_DISPLAY`.

- [ ] **Step 1: Write the failing test**

```ts
it("gives each display its own theme at the root", async () => {
  // write("this-pc", a) and write("kitchen-tablet", b); GET / on loopback renders
  // a; GET /?session=<kitchen token> renders b.
});

it("falls back to the default for a display with no entry", async () => {
  // write(DEFAULT_DISPLAY, a); GET /?session=<unassigned display's token> -> a.
});

it("falls back to the default when the assigned theme was deleted", async () => {
  // write("kitchen-tablet", "gone"); write(DEFAULT_DISPLAY, a); remove "gone" from
  // the library; GET /?session=... renders a and not an error page.
});

it("lets an explicit ?theme= outrank the assignment", async () => {
  // write("this-pc", a); GET /?theme=b -> b.
});

it("answers displayKeyFor for the three kinds of caller", () => {
  // loopback -> "this-pc"; live token -> its displayId; no token, not loopback -> "default".
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/server.test.ts -t "own theme"`
Expected: FAIL.

- [ ] **Step 3: Implement**

The root route's order becomes published, `?theme=`, this display's entry, the
default, the only theme, the chooser. Only step three and the new step four change;
`displayKeyFor` is a module-level function so its three answers are unit-testable
without a server.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts
git commit -m "feat(host): resolve the root page against the asking display"
```

---

## Phase 3 — Answers per display

### Task 3.1: The answers file gains a display level

**Files:**
- Modify: `src/web/packages/host/src/settings/theme-settings.ts`
- Test: `src/web/packages/host/src/settings/theme-settings.test.ts`

**Interfaces:**
- Consumes: `DEVICE_ID_PATTERN` (Task 1.1).
- Produces: `ThemeSettingsStore` becomes
  - `read(display: string, themeId: string): Promise<ThemeAnswers>`
  - `write(display: string, themeId: string, answers: unknown): Promise<ThemeAnswers>`
  - `removeTheme(themeId: string): Promise<void>` — every display's answers for
    one deleted theme
  - `removeDisplay(display: string): Promise<void>` — one deleted display's
    answers, across every theme

  The file is `Record<displayId, Record<themeId, ThemeAnswers>>`.

- [ ] **Step 1: Write the failing test**

```ts
it("keeps two displays' answers for one theme apart", async () => {
  await store.write("this-pc", "wall", { gpu: "gpu-0" });
  await store.write("kitchen-tablet", "wall", { gpu: "gpu-1" });
  expect(await store.read("this-pc", "wall")).toEqual({ gpu: "gpu-0" });
  expect(await store.read("kitchen-tablet", "wall")).toEqual({ gpu: "gpu-1" });
});

it("drops an unknown display, an unknown theme and an unknown group", async () => {
  // Hand-write { "../x": { "wall": { gpu: "gpu-0" } }, "this-pc": { "bad id": {...},
  //   "wall": { nope: "gpu-0", gpu: "gpu-0" } } } and read: only the last survives.
});

it("removes one theme across every display, and one display across every theme", async () => {
  // removeTheme("wall") leaves the other theme on both displays;
  // removeDisplay("kitchen-tablet") leaves this-pc's answers untouched.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/settings/theme-settings.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`normalizeAnswers` keeps its job and gains two callers: the outer map normalises
its display keys with `DEVICE_ID_PATTERN` and its theme keys with `THEME_ID`, and
drops a level that normalises to `{}` so an empty level is not written.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/settings/theme-settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/settings/theme-settings.ts src/web/packages/host/src/settings/theme-settings.test.ts
git commit -m "feat(host): key a theme's answers by the display that answered"
```

### Task 3.2: The assignment the providers consume

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Test: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: `ThemeSettingsStore.read(display, themeId)` (Task 3.1);
  `displayKeyFor` (Task 2.2).
- Produces: `currentAssignment(display: string): Promise<DeviceAssignment>` — the
  signature gains the display it is resolving for.

- [ ] **Step 1: Write the failing test**

```ts
it("reads the answering display's override, not another display's", async () => {
  // this-pc answers gpu-0 for the theme, kitchen-tablet answers gpu-1; the
  // assignment each is served carries its own.
});

it("falls back to the global device settings where a display answered nothing", async () => {
  // devices.assigned.gpu = "gpu-9", no per-display answer -> "gpu-9" for both.
});

it("does not leak a deleted display's answers to another display", async () => {
  // removeDisplay("kitchen-tablet") then the other display's answer is unchanged.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/server.test.ts -t assignment`
Expected: FAIL.

- [ ] **Step 3: Implement**

The chosen theme and the display are both needed, so the resolution is
`perDisplay[group] ?? stored.assigned[group]`, with the chosen theme read for that
same display. `pick` and the `ASSIGNABLE_GROUPS` comment stay as they are
(`vg-189`'s reason for that comment is unchanged).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts
git commit -m "feat(host): resolve device assignments for the asking display"
```

---

## Phase 4 — The routes, the reassignment and the two host pages

### Task 4.1: `/api/themes/active` becomes the display map

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Test: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: `ActiveThemeStore.readAll` (Task 2.1), `DisplayStore.list` (Task 1.1).
- Produces: `GET` answers
  `{ default: string | null, displays: readonly { id: string; label: string; theme: string | null }[], themes, templates }`;
  `PUT` takes `{ display: string, id: string }` where `display` is a display id or
  `"default"`, and answers `{ ok: true, default, displays }` in the same shape.

- [ ] **Step 1: Write the failing test**

```ts
it("lists every display with the theme it holds", async () => {
  // Two displays, one assigned: both appear, the unassigned one with theme: null.
});

it("writes one display and leaves the others alone", async () => {
  // PUT { display: "kitchen-tablet", id: "kitchen-strip" } -> that display only.
});

it("writes the default through the same route", async () => {
  // PUT { display: "default", id: "living-room" } -> default changes.
});

it("refuses a display it does not know, and a theme it does not have", async () => {
  // PUT { display: "nobody", id: "living-room" } -> 404;
  // PUT { display: "this-pc", id: "nope" } -> 404.
});

it("stays loopback only", async () => {
  // A paired non-loopback GET -> 403 "Settings are available on this PC only."
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/server.test.ts -t "themes/active"`
Expected: FAIL.

- [ ] **Step 3: Implement**

`this-pc` is always present in `displays` with `label` from `uiCopy`'s word for
this PC and never from the display store; a stored record with that id is not
possible because Task 1.1 refuses to mint it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts
git commit -m "feat(host): read and write the display map over one route"
```

### Task 4.2: A reassignment reaches a display that is already showing

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Modify: `src/web/packages/player/src/publish-follower.ts`
- Test: `src/web/packages/host/src/server.test.ts`,
  `src/web/packages/player/src/publish-follower.test.ts`

**Interfaces:**
- Consumes: `displayKeyFor` (Task 2.2), the resolution order (Task 2.2).
- Produces: `GET /api/published` answers
  `{ id: string | null, revision: number, display: { id: string, theme: string | null } }`,
  where `theme` is the theme this display should be showing **when it is not on an
  explicit `?theme=` link** — `null` when the request named one, because the link
  is the person's own instruction for that page.
  `publish-follower.ts` gains
  `readonly onThemeChange?: (theme: string | null) => void` on its options, called
  when `display.theme` differs from the previous poll's.

- [ ] **Step 1: Write the failing test**

```ts
// server.test.ts
it("answers the display its own theme on /api/published", async () => {
  // A paired display's poll carries its assignment; an unassigned one carries the default.
});

it("answers null for a display on an explicit ?theme= link", async () => {
  // GET /api/published?theme=other -> display.theme is null.
});

// publish-follower.test.ts
it("calls onThemeChange when the host's answer moves", async () => {
  // Two polls, the second answering a different theme -> one call, with the new id.
});

it("does not call onThemeChange when the answer is unchanged", async () => { /* ... */ });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/server.test.ts -t published packages/player/src/publish-follower.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

The follower gains one more comparison beside the published-id one it already
makes, over the same interval, and the player reloads on the callback — the
existing reaction to a published change, reached the same way. No new poll is
added.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/server.test.ts packages/player/src/publish-follower.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts src/web/packages/player/src/publish-follower.ts src/web/packages/player/src/publish-follower.test.ts
git commit -m "feat(player): follow the theme this display was assigned"
```

### Task 4.3: The two host pages write the display they name

**Files:**
- Modify: `src/web/packages/host/public/library.html`
- Modify: `src/web/packages/host/public/settings.html`
- Test: `src/web/tests/e2e/host-settings.spec.ts` (the existing spec covering the
  host's own pages)

**Interfaces:**
- Consumes: the route shapes from Task 4.1.
- Produces: no exported interface; the pages are dependency-free source served
  from `BundleRoots.admin`.

- [ ] **Step 1: Write the failing test**

Browser proof, because the visible behaviour is what changed: a display row per
display with the theme each holds, a default row above them, and choosing a theme
for one row leaving the others as they were.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/host-settings.spec.ts --workers=1` against
rebuilt bundles. Expected: FAIL — the page still writes a bare `{ id }`.

- [ ] **Step 3: Implement**

Both pages keep their existing rows and gain a display column: the default row
first, then one row per display from the route's `displays`. A write sends
`{ display, id }`. `settings.html`'s answers form sends the display it is showing
for, and reads the answers for that display's use of the active theme.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx playwright test tests/e2e/host-settings.spec.ts --workers=1`
Expected: PASS, with the rendered page inspected rather than only its element
counts.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/public/library.html src/web/packages/host/public/settings.html src/web/tests/e2e/host-settings.spec.ts
git commit -m "feat(host): choose a theme per display from the host's own pages"
```

### Task 4.4: The assign action the store consumes

**Files:**
- Modify: `src/web/packages/editor/src/theme-library-client.ts`
- Test: `src/web/packages/editor/src/theme-library-client.test.ts`

**Interfaces:**
- Consumes: Task 4.1's `PUT`.
- Produces: `ThemeLibraryClient` gains
  `assign(display: string, id: string): Promise<void>` and
  `listDisplays(): Promise<readonly { id: string; label: string; theme: string | null }[]>`.
  **This is the seam `2026-10-18-theme-store.md` consumes; it must not be
  re-implemented there.**

- [ ] **Step 1: Write the failing test**

```ts
it("assigns to the display it was given, and to no other", async () => {
  // assign("kitchen-tablet", "kitchen-strip") -> one PUT carrying both.
});

it("reports a refusal as the host's own message", async () => {
  // A 404 body's message reaches the caller rather than a bare status.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/editor/src/theme-library-client.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Both follow the client's existing shape: a `fetch` against a path this module
owns, a non-`ok` response turned into an `Error` carrying the host's own text,
as `deleteTheme` already does.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/editor/src/theme-library-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/theme-library-client.ts src/web/packages/editor/src/theme-library-client.test.ts
git commit -m "feat(editor): assign a theme to a named display"
```

---

## Plan boundary

Run the broad gate once, at the end:

```bash
cd src/web && npm run gate; echo "GATE EXIT=$?"
```

Then the browser proof this plan's visible work needs — the two host pages and
the player's reassignment — with bundles rebuilt after any source change, one
worker, and each run's own JSON report. Report the gate's exit code and the
browser results as two separate facts.
