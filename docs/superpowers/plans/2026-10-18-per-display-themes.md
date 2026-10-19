# Per-display themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each display client holds its own theme and its own answers, a display
may change its own theme without touching any other, and all of it survives a
restart of the host.

**Architecture:** A display becomes a persisted record with a stable id, separate
from the short-lived session token that names it on the wire. The active theme
becomes one map keyed by display id plus a reserved `default` key, the answers
file gains a display level above its theme level, and `GET /` resolves the asking
display's entry before the default. The one map has two writers, and the second
one's authority is derived from its session rather than claimed in a body.

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
- **Watched paths need a decision note before the first write.** `host/src/server.ts`
  (Task 4.6) and `renderer-core/src/theme/` (Task 4.8's `performance-cost.ts`) are both
  on the reuse gate's watchlist (`scripts/reuse-gate.mjs`): a note at
  `docs/decisions/NNNN-<slug>.md` must claim the path first, and the note records the
  searches that were run rather than the conclusion alone.
- **A browser proof names the origin it ran on.** The host serves plain http
  (`http.createServer`, no TLS), so a **local monitor at `127.0.0.1` is a secure context
  and a paired display at a LAN address is not** — `navigator.wakeLock` and
  `navigator.serviceWorker` are present in the first and absent in the second. Playwright
  runs on localhost, so **a run here shows both APIs present and proves nothing about a
  phone**. This plan adds no TLS and makes no ruling on it: `vg-580` and Phase 25's
  Task 25.8 own that decision. What this plan must not do is claim a phone behaviour from
  a localhost run, and its re-find proofs must name their origin.
- This plan lands before `2026-10-18-theme-store.md`, which consumes Task 4.4's
  assign action and does not restate this model.
- **Ruling 12: a pairing lasts until the host removes the client.** Nothing in this
  plan may expire a credential on a timer, and `DEFAULT_SESSION_TTL_MS`, `sweep()`
  and any expiry field are deleted rather than left unenforced. A credential is
  stored as `hashToken(token)` and never in the clear, and a route never echoes a
  stored hash.
- **The display list is `display-clients.json`, never `displays.json`.**
  `settings/display.ts` already owns `display.json` in the same directory for how
  readings are displayed; two files one character apart with different owners is a
  defect waiting for a tired reader. Do not rename the incumbent.
- **A local display is resolved only from loopback, and only by `?display=`.** Its
  `kind` is checked as well as the origin: the parameter names `local` records and
  never a paired one, so it cannot be used to impersonate a display that has a
  credential. This is the property that lets a local display exist without one.
- **Ruling 13: the host launches a local monitor and registers itself at sign-in.**
  A wall display nobody reopens is not a display. Spawn a **host-owned** child
  (no `detached`), relaunch on start, and **only ever close a window this launcher
  opened** — a browser the owner started is not the host's to kill. One autostart
  entry covers every monitor.
- **A local monitor's client must not become the load it reports.** The chart rate
  is **per display** — a local monitor defaults to 1 fps, a remote display to 30 —
  and it is read from `chartFpsFor`, never re-decided by a caller and never
  hardcoded in the player. Never leave a local monitor animating when idle, and do
  not raise the host's sampling cadence for it. `server.ts`'s `tick` returning on
  `connections.size === 0` is a property to keep, not to work around.
- **A per-frame repaint needs a reader.** `onFrame`'s `requestRenderAll` exists so a
  glass panel over a video is not a frozen frame, so it is subscribed only when
  something samples the backdrop — and re-evaluated when the scene changes, because
  a theme can gain a glass panel after mount. **Task 4.7 must leave a video
  background with no glass repainting zero times**, not merely fewer.
- **The assignment warns about the two combinations that cost, and only those, on the
  host's own page.** Glass **and** a video background warns for any display; a video
  background alone warns for a host monitor only; glass alone and neither warn for
  nothing; the default row warns for every cost, because it has no kind. Detection is
  `performanceCostsOf(envelope)` in `renderer-core` — pure, answering cost codes rather
  than a boolean, and never throwing on a theme nothing has validated. **The editor
  raises none of it** (the user narrowed this on 2026-10-18): the warning is the host
  theme row's own note, through `theme-list.js`'s existing `role="status"` pattern.

## Review Focus

Seventeen inputs and conditions the spec implies and no task's own tests exercise.
Each gets its test in the task named beside it.

1. **A display whose assigned theme was deleted** — a person removes a theme from
   the library while a wall screen holds it. The display must fall to the default
   and keep showing something, never an error page or a blank stage. (Task 2.2)
2. **A label that mints no usable id** — `"???"`, `"---"`, an emoji-only name, or a
   name that is only whitespace. Pairing must refuse with a reason rather than mint a
   display whose id no other file will accept. **A 200-character name is not one of
   these** and the gate corrected this item's own example: `displayIdFrom` *shortens*
   it so the disambiguating suffix still fits the 64-character bound, which is the
   shipped and tested rule — a reader who "fixed" this by refusing long labels would
   be breaking the case the item was written to protect. (Task 1.1)
3. **A hand-edited `theme-answers.json` with an unknown display or group** — the
   file is a plain JSON file a person can open. An unknown key must be dropped,
   not carried into a lookup. (Task 3.1)
4. **Two displays that both answer a question, then one display's record is
   deleted** — the other display's answers must be untouched, and the deleted
   display's must be gone rather than orphaned. (Task 3.2)
5. **A client that names a display it does not own** — on the pairing route, or in
   the body of a theme write. Pairing must refuse before it reads the parameter,
   and a theme write must take the display from the session and ignore the body
   rather than trust it. (Tasks 1.3, 4.1, 4.5)
6. **Anyone on the LAN hammering the code-claim route** — guessing must not close a
   pairing window someone is using, and the refusal must not say whether the code
   they guessed exists. (Task 1.4)
7. **A hand-edited `display-clients.json`** — a record with no `tokenHash`, a
   duplicated id, or a token pasted into the file in the clear. None may
   authenticate, and none may make `GET /api/host` or the display list answer
   something a display could not have been given. (Tasks 1.1, 1.3; the gate found
   the duplicated-id and clear-token halves untested — `readDisplays` dedupes at
   `displays.ts:347-353` and `normalizeRecord` reads only `tokenHash`, and no case
   writes either shape, so Phase 1's gate fix round adds both. **The ordering is
   stated here because the test was otherwise its only record:** a record whose id was
   already seen is the one dropped, so the first in the file wins and a refactor may not
   flip which credential survives.)
8. **A second host on the same LAN answering a sweep** — a display re-finding its
   host must match the id it stored, not the first host that replies, or the
   two-host no-tangle property the spec claims is gone. (Task 4.6)
9. **A rename that collides with a label already in the list** — two displays
   called *Kitchen* are allowed, and neither may lose its theme, its answers or its
   own identity to the other. The list disambiguates; the ids stay distinct. (Task
   1.3)
10. **A request naming a local display from off this PC** — `?display=` is the only
    thing that could identify a credentialless display, so it is the only way to
    impersonate one. It must be refused off loopback, and it must not resolve a
    paired display at all. (Task 2.2)
11. **A host restarted while a wall display is already up** — the restart must not
    open a second window on that monitor, **including when a killed host left an
    orphan behind**, and it must not close the first. This is the case a naive
    launcher gets wrong in both directions, and the reason the liveness check is
    `lastSeenAt` rather than a process scan. (Task 1.8, and the producer of that
    check is Task 4.2's — see rulings 35 and 40: the clean-restart half is Task
    1.8's and closes with `stop()` killing what it opened, the killed-host half
    cannot be verified until a window names itself on a repeating request, which
    lands with Task 4.2's poll, and the Phase 1 gate records it as unverified
    rather than verified.)
12. **Removing a local display, and a browser the owner started themselves** —
    removal must close the window the host opened, and must never kill a browser it
    did not launch. Getting this backwards closes someone's own browsing session.
    (Task 1.8)
13. **A video background with no glass panel** — the per-frame canvas repaint exists
    only so a blur over a video is not a frozen frame, so a theme with no glass must
    repaint zero times for it. A 60 fps background repainting a 1440p canvas 60 times
    a second is the largest single cost this product can impose on itself, and it is
    imposed for nothing. (Task 4.7)
14. **A theme that gains a glass panel after the scene has mounted** — the gate is
    re-evaluated on `update()`, or a video behind a newly-added blur freezes, which
    is the bug the repaint loop was written to fix. (Task 4.7)
15. **A `theme.json` that parses but is not a theme** — `list()` drops it before a cost
    is ever asked, because `readEnvelope` validates. The guard is still owed by the
    function itself: it is exported from `renderer-core` and typed `unknown`, so a caller
    handing it raw JSON must get no costs rather than an exception thrown in the middle
    of a listing that was otherwise fine. (Task 4.8)
16. **An image background declared with a `.mp4` path, and a video declared as
    `image`** — the declared `kind` decides, because the model already refuses to
    infer an asset's type from its path. A detector that sniffed the extension would
    warn about a theme that costs nothing and stay silent about one that does.
    (Task 4.8)
17. **A display whose host moved and whose certificate it does not trust** — every
    re-find probe fails against an untrusted origin, so the ladder answers nothing and
    the code route is the answer. The proof must name the origin it ran on, because a
    `localhost` run is a secure context and a phone is not (`vg-580`). (Task 4.6)

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/host/src/settings/displays.ts` (create) | The display record: its id, its kind, its durable hashed credential, its minting, renaming and removal rules, and the persisted list in `display-clients.json` |
| `packages/host/src/settings/devices.ts` (modify) | Exports `DEVICE_ID_PATTERN`, the one id shape the host accepts |
| `packages/host/src/settings/theme-settings.ts` (modify) | Answers gain a display level above their theme level |
| `packages/host/src/settings/active-theme.ts` (modify) | One map from display key to theme id, `default` reserved |
| `packages/host/src/settings/monitors.ts` (create) | What `systeminformation` reports is attached, and the hint and command line a local display needs |
| `packages/host/src/serve/display-launcher.ts` (create) | Launches, reconciles and closes the browser for each local display, and registers the host at sign-in |
| `packages/host/src/session/pairing.ts` (modify) | The CSPRNG mint and the constant-time compare, and nothing that expires |
| `packages/host/src/session/pairing-code.ts` (create) | The one-time code: its alphabet, its expiry, and the claim that consumes it |
| `packages/host/public/pair.html` (create) | The page a camera-less display types the code into |
| `packages/host/src/settings/host-record.ts` (create) | Which host this folder is: the id a display stores and the name it shows |
| `packages/host/src/settings/host-lock.ts` (create) | One app folder is one host |
| `packages/host/src/server.ts` (modify) | Which display is asking; the routes; the resolution order; the two routes an unpaired client may read |
| `packages/player/src/publish-follower.ts` (modify) | A display follows its own reassignment |
| `packages/player/src/theme-chooser.ts` (create) | The display's own chooser: a chrome control that lists this host's themes and writes the one chosen |
| `packages/player/src/host-refind.ts` (create) | The ladder that finds this display's own host again after its address changes |
| `packages/host/src/themes/store.ts` (modify) | A listed theme carries what displaying it costs, read from the envelope `list()` already reads |
| `packages/host/public/theme-list.js` (modify) | The theme row itself: the display column it offers (Task 4.3), and which costs matter for a display of each kind, the sentence each shows and the row note that says it (Task 4.8) |
| `packages/host/public/library.html`, `settings.html` (modify) | The two host pages write the display they name, and hand the row the kind of the display it is assigning to |

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
    - `export type DisplayKind = "paired" | "local"`
    - `export interface MonitorHint { readonly serial?: string; readonly deviceName: string }`
    - `export interface DisplayRecord { readonly id: string; readonly label: string; readonly kind: DisplayKind; readonly createdAt: string; readonly lastSeenAt: string; readonly tokenHash?: string; readonly monitor?: MonitorHint; readonly chartFps?: ChartRefreshRate }`
    - `export function chartFpsFor(record: Pick<DisplayRecord, "kind" | "chartFps">): ChartRefreshRate` — the record's own rate, else `1` for `local` and `30` for `paired`. One function, so no caller re-decides the default.
    - `export interface DisplayStore { list(): Promise<readonly DisplayRecord[]>; create(label: string, token: string): Promise<DisplayRecord>; createLocal(label: string, monitor: MonitorHint): Promise<DisplayRecord>; find(id: string): Promise<DisplayRecord | undefined>; authenticate(token: string): Promise<DisplayRecord | undefined>; rotate(id: string, token: string): Promise<DisplayRecord | undefined>; update(id: string, patch: DisplayPatch): Promise<DisplayRecord | undefined>; touch(id: string, at: string): Promise<void>; remove(id: string): Promise<boolean> }`
    - `export interface DisplayPatch { readonly label?: string; readonly chartFps?: ChartRefreshRate }` — one mutator for the two things a person edits, because both are "change this field and nothing else" and neither may touch the id.
    - `export function normalizeLabel(input: unknown): string` — trims, refuses empty and over-64, and is **not** the slug rule (spec § "Renaming a display").
    - `export function hashToken(token: string): string` — `createHash("sha256").update(token).digest("base64url")`, so nothing else in the tree decides how a credential is stored.
    - `export function createDisplayStore(directory: string, options?: { readonly now?: () => number; readonly randomSuffix?: () => string }): DisplayStore`
    - `export function displayIdFrom(label: string, suffix: string): string` — the slug rule, pure, so its refusals are unit-testable.

- [ ] **Step 1: Write the failing test**

```ts
// displays.test.ts
import { describe, expect, it } from "vitest";
import { createDisplayStore, displayIdFrom, hashToken, normalizeLabel } from "./displays.js";

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
  it("mints a record and lists it", async () => { /* create("Kitchen tablet", "tok") -> id "kitchen-tablet"; list() has it */ });
  it("adds a suffix when the slug is taken", async () => { /* second create("Kitchen tablet", "tok2") -> id !== first */ });
  it("refuses the two reserved ids", async () => {
    await expect(store.create("this pc", "tok")).rejects.toThrow(/reserved/);
    await expect(store.create("default", "tok")).rejects.toThrow(/reserved/);
  });
  it("survives a new store over the same directory", async () => { /* create, re-create, list() still has it */ });
  it("removes a record", async () => { /* remove(id) true, then false for the same id */ });

  // Ruling 12 — the credential is durable, hashed, and rotated in place.
  it("never writes the token to the file", async () => {
    const token = "a-token-nobody-should-read";
    await store.create("Kitchen tablet", token);
    const raw = await readFile(path.join(directory, "display-clients.json"), "utf8");
    expect(raw).not.toContain(token);
    expect(raw).toContain(hashToken(token));
  });

  it("authenticates the token it was given and nothing else", async () => {
    await store.create("Kitchen tablet", "right");
    expect((await store.authenticate("right"))?.id).toBe("kitchen-tablet");
    expect(await store.authenticate("wrong")).toBeUndefined();
    expect(await store.authenticate("")).toBeUndefined();
  });

  it("rotates in place, keeping the record and killing the old token", async () => {
    const before = await store.create("Kitchen tablet", "old");
    const after = await store.rotate(before.id, "new");
    expect(after?.id).toBe(before.id);
    expect(after?.createdAt).toBe(before.createdAt);
    expect(await store.authenticate("old")).toBeUndefined();
    expect((await store.authenticate("new"))?.id).toBe(before.id);
    expect(await store.list()).toHaveLength(1);
  });

  it("answers undefined for rotating a display it does not know", async () => {
    expect(await store.rotate("nobody", "new")).toBeUndefined();
  });

  it("records when a display was last seen", async () => {
    const record = await store.create("Kitchen tablet", "tok");
    await store.touch(record.id, "2026-10-18T00:00:00.000Z");
    expect((await store.find(record.id))?.lastSeenAt).toBe("2026-10-18T00:00:00.000Z");
  });

  it("drops a stored record whose tokenHash is missing", async () => { /* hand-written file, no tokenHash -> dropped, not authenticated */ });

  // Renaming: the label moves, the id does not.
  it("renames without moving the id or the creation time", async () => {
    const before = await store.create("office tv", "tok");
    const after = await store.update(before.id, { label: "Kitchen" });
    expect(after).toMatchObject({ id: before.id, label: "Kitchen", createdAt: before.createdAt });
    expect((await store.find(before.id))?.label).toBe("Kitchen");
  });

  it("refuses a label that is empty or only whitespace", async () => {
    const record = await store.create("office tv", "tok");
    for (const label of ["", "   ", "\t\n"]) {
      await expect(store.update(record.id, { label })).rejects.toThrow(/label/);
    }
    expect((await store.find(record.id))?.label).toBe("office tv");
  });

  it("trims a label, and accepts one the slug rule would refuse", async () => {
    const record = await store.create("office tv", "tok");
    expect((await store.update(record.id, { label: "  Living Room (TV)  " }))?.label).toBe("Living Room (TV)");
  });

  it("answers undefined for renaming a display it does not know", async () => {
    expect(await store.update("nobody", { label: "Kitchen" })).toBeUndefined();
  });

  it("lets two displays hold the same label", async () => {
    const a = await store.create("Kitchen", "t1");
    const b = await store.create("Kitchen", "t2");
    await store.update(b.id, { label: "Kitchen" });
    expect(a.id).not.toBe(b.id);
    expect((await store.list()).filter((d) => d.label === "Kitchen")).toHaveLength(2);
  });

  // A local monitor is a display with no credential.
  it("mints a local display with no tokenHash, and it never authenticates", async () => {
    const local = await store.createLocal("Left screen", { deviceName: "\\\\.\\DISPLAY2", serial: "abc" });
    expect(local.kind).toBe("local");
    expect(local.tokenHash).toBeUndefined();
    expect(local.monitor).toEqual({ deviceName: "\\\\.\\DISPLAY2", serial: "abc" });
    expect(await store.authenticate("")).toBeUndefined();
  });

  it("refuses to mint a local display for a reserved id", async () => {
    await expect(store.createLocal("this pc", { deviceName: "\\\\.\\DISPLAY2" })).rejects.toThrow(/reserved/);
  });

  // The rate is per display, defaulted by kind (ruling, 2026-10-18).
  it("defaults the rate by kind and lets a record override it", () => {
    expect(chartFpsFor({ kind: "local" })).toBe(1);
    expect(chartFpsFor({ kind: "paired" })).toBe(30);
    expect(chartFpsFor({ kind: "local", chartFps: 30 })).toBe(30);
    expect(chartFpsFor({ kind: "paired", chartFps: 1 })).toBe(1);
  });

  it("keeps a stored rate and refuses one that is not 1 or 30", async () => {
    // update(id, { chartFps: 1 }) survives a new store over the same directory; a stored
    //   chartFps of 7 is dropped on read rather than carried, so the kind's
    //   default answers instead of a rate the player cannot run.
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/settings/displays.test.ts`
Expected: FAIL — cannot resolve `./displays.js`.

- [ ] **Step 3: Implement the store**

`displays.ts` owns one file, **`display-clients.json`**, holding
`{ displays: DisplayRecord[] }`. Read it the way `devices.ts` reads its own:
a missing or unreadable file is an empty list, and every record is normalised on
read (an id failing `DEVICE_ID_PATTERN`, a non-string label, a label longer than
64 characters, a duplicate id, a `kind` that is neither `paired` nor `local`, a
`paired` record with no `tokenHash`, or a `local` record that carries one, is
dropped) — a hand-edited file must not be able to introduce a display nothing else
accepts, a `paired` record with no hash is a display nothing can authenticate as,
and a `local` record carrying a hash is a credentialless display pretending
otherwise.

**The file is not `displays.json`.** `settings/display.ts` already owns
`display.json` in this same directory for a different concept — how readings are
displayed — and two files one character apart with different owners is a defect
waiting for a tired reader (spec § "Identity"). The incumbent keeps its name.

`create` slugs the label, and appends `-<suffix>` when the slug is taken, where
the suffix is `options.randomSuffix?.() ?? randomBytes(2).toString("hex")`. It
throws `Error` with `reserved` in the message for `LOCAL_DISPLAY_ID` and
`DEFAULT_DISPLAY`, and with `usable id` when `displayIdFrom` refuses. In
`devices.ts`, replace the module-local `ID_PATTERN` with the exported
`DEVICE_ID_PATTERN` and delete `theme-settings.ts`'s own `DEVICE_ID`, importing
the shared one — three copies of one shape is the defect this task exists to
prevent.

**The credential is stored as `hashToken(token)` and never in the clear**
(ruling 12). `authenticate` hashes what it was given and compares it against the
stored hashes, answering the first match; a token of 32 CSPRNG bytes has no
dictionary to attack, so the hash's job is that reading `display-clients.json` — a
backup, a synced folder, a screenshot — yields a list of displays rather than a
set of usable credentials. `rotate` replaces one record's `tokenHash` in place and
returns the updated record; `touch` sets `lastSeenAt`. Both are written through
the same read-modify-write the other mutators use, so two of them racing lose one
write rather than corrupting the file — acceptable here because the only writer is
the host's own single process.

**`createLocal` and `rename` are the two mutators the user's 2026-10-18 requests
add**, and both are small because the record already carries everything they need.
`createLocal(label, monitor)` is `create` minus the token: it slugs the id the same
way, refuses the same two reserved ids, and writes `kind: "local"` with a `monitor`
hint and no `tokenHash`. `update(id, patch)` runs `normalizeLabel` on a label and validates a rate, and writes the
label **and nothing else** — not the id, not `createdAt`, not the assignment, which
is the invariant the spec's § "Renaming a display" is entirely about.
`normalizeLabel` trims, refuses a result shorter than 1 or longer than 64, and
**does not slug**: `Living Room (TV)` is a name a person may have, and refusing it
because it contains a space and a bracket would be a rule nobody could act on.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/settings/displays.test.ts packages/host/src/settings/devices.test.ts packages/host/src/settings/theme-settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/settings/displays.ts src/web/packages/host/src/settings/displays.test.ts src/web/packages/host/src/settings/devices.ts src/web/packages/host/src/settings/theme-settings.ts
git commit -m "feat(host): give a display a persisted record with its own id"
```

### Task 1.2: A display authenticates with its own durable credential

Ruling 12 (spec § "Identity: the token is a credential, not a name"): a pairing
lasts until the host removes the client. So the session store stops existing — the
credential is the display record's, it is verified against the display store, and
nothing expires.

**Files:**
- Modify: `src/web/packages/host/src/session/pairing.ts`
- Modify: `src/web/packages/host/src/server.ts`
- Test: `src/web/packages/host/src/session/pairing.test.ts`
- Test: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: `DisplayStore`, `DisplayRecord`, `createDisplayStore` (Task 1.1).
- Produces:
  - `pairing.ts` keeps `export function newToken(): string` (the 32-byte CSPRNG
    mint, renamed from the module-local `defaultToken`) and
    `export function sameToken(a: string, b: string): boolean`, and **loses**
    `DisplaySession`, `SessionStore`, `SessionStoreOptions`,
    `DEFAULT_SESSION_TTL_MS`, `createSessionStore` and `sweep`.
  - `HostServerOptions` gains `readonly displays?: DisplayStore`; the `sessions`
    option and its `SessionStore` import are removed.
  - The request→display resolution the guard uses:
    `export async function displayFor(request, url, displays): Promise<DisplayRecord | undefined>` —
    loopback answers the reserved `this-pc` record's *id* without a lookup, and any
    other request authenticates `url.searchParams.get("session") ?? header`.
  - `server.ts`'s `allowed()` and the display guard call `displayFor`, so the
    credential is checked in one place.

- [ ] **Step 1: Write the failing test**

```ts
// server.test.ts
it("keeps a display paired across a restart, with no code retyped", async () => {
  // Pair once; take the token. Build a *second* server over the same settings
  // directory. The token still reaches a display-guarded route.
});

it("refuses a token that no display holds", async () => {
  // GET /api/themes?session=<random> -> 403, not 200.
});

it("does not accept an expired-looking or absent credential", async () => {
  // No token at all off loopback -> 403; loopback still 200 as admin.
});

// pairing.test.ts
it("mints distinct tokens and compares them without leaking length", () => {
  expect(newToken()).not.toBe(newToken());
  expect(sameToken("a", "a")).toBe(true);
  expect(sameToken("a", "b")).toBe(false);
  expect(sameToken("a", "aa")).toBe(false);
});

it("has no TTL left to enforce", () => {
  // The module exports no expiry constant and no store: a pairing that expires
  // on its own is the behaviour ruling 12 removed.
  expect(pairing).not.toHaveProperty("DEFAULT_SESSION_TTL_MS");
  expect(pairing).not.toHaveProperty("createSessionStore");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/session/pairing.test.ts packages/host/src/server.test.ts`
Expected: FAIL — `newToken` is not exported; the restart case 403s.

- [ ] **Step 3: Implement**

Delete `createSessionStore` and everything only it used. `newToken` and `sameToken`
stay, with `sameToken`'s comment rewritten: it now guards the one-time code's
comparison (Task 1.4) and the credential's, and its padded-length note still
applies.

`displayFor` is the one place a request becomes a display. Loopback is trusted
admin and never paired — the existing `allowed()` rule — so it resolves to
`LOCAL_DISPLAY_ID` without a lookup; anything else reads the credential and asks
`displays.authenticate`. A `?session=` value that matches nothing is `undefined`,
and the caller refuses it exactly as it refuses a missing token today, so there is
no new refusal path to get wrong.

**`touch` is called here**, on the authenticated display, with
`new Date().toISOString()` — one write per authenticated request is the cost of
`lastSeenAt`, and it is why the field is optional in what the surface reads rather
than a second polling loop. If that write proves too hot for a poll every few
seconds, the fix is a throttle in this function and not a new route.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/session/pairing.test.ts packages/host/src/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/session/pairing.ts src/web/packages/host/src/session/pairing.test.ts src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts
git commit -m "feat(host): a display authenticates with its own durable credential"
```

### Task 1.3: Pairing against a display

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Test: `src/web/packages/host/src/server.test.ts`
- Create: `docs/decisions/0072-display-identity-in-the-server.md` (the watched
  path's note — see Global Constraints)

**Interfaces:**
- Consumes: `DisplayStore`, `createDisplayStore`, `LOCAL_DISPLAY_ID` (Task 1.1);
  `newToken` (Task 1.2); `displayFor` (Task 1.2).
- Produces: the routes below, all loopback-only as they are today. `HostServerOptions`
  already carries `displays` from Task 1.2.

- [ ] **Step 1: Write the failing test**

```ts
it("mints a display and a credential for it", async () => {
  // POST /api/pairing/sessions?label=Kitchen+tablet -> 201, body carries
  //   displayId "kitchen-tablet" and a token; GET /api/pairing/sessions lists
  //   that display, and the token authenticates.
});

it("rotates an existing display's credential rather than minting a second display", async () => {
  // POST ?displayId=kitchen-tablet -> 201, same displayId, a *different* token,
  //   the previous token now refused, and the display list still one long.
});

it("removes a client and its credential", async () => {
  // DELETE /api/displays/kitchen-tablet -> 200; the token is refused; GET
  //   /api/pairing/sessions no longer lists it.
});

it("renames a display without moving it", async () => {
  // PATCH /api/displays/office-tv { label: "Kitchen" } -> 200 with the same id
  //   and the new label; GET lists it under "Kitchen" and its theme is unchanged.
});

it("refuses an empty label rather than storing it", async () => {
  // PATCH { label: "   " } -> 400, and the stored label is still the old one.
});

it("refuses a rename from off loopback", async () => {
  // A non-loopback PATCH -> 403, and the label is unchanged.
});

it("answers 404 for a displayId it does not know, on both routes", async () => {
  // POST ?displayId=nobody -> 404, no credential minted.
  // DELETE /api/displays/nobody -> 404.
  // PATCH /api/displays/nobody -> 404.
});

it("refuses a displayId from off loopback before reading it", async () => {
  // A non-loopback POST ?displayId=kitchen-tablet -> 403 "Pairing is available
  // on this PC only.", and the display list is unchanged.
});

it("refuses to remove the reserved local display", async () => {
  // DELETE /api/displays/this-pc -> 409, because this PC is not a paired client.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/server.test.ts -t pairing`
Expected: FAIL.

- [ ] **Step 3: Implement**

The pairing block already refuses non-loopback first; keep that order so the
guard precedes the parameter read. `POST` with `label` mints a token with
`newToken()` and calls `displays.create(label, token)`; with `displayId`, finds the
record and calls `displays.rotate(id, newToken())`. Both answer 201 with
`{ display, token }` — the token is returned exactly once, because only its hash is
stored. `GET` answers `{ displays }`. `DELETE /api/displays/:id` calls
`displays.remove(id)`, and refuses `LOCAL_DISPLAY_ID`. `PATCH /api/displays/:id`
calls `displays.update(id, body)` and answers the updated record, so the
surface does not have to refetch the list to redraw one row.

**Rotation is why the answer carries a token and the list never does.** `GET
/api/pairing/sessions` answers displays, and a display's `tokenHash` is not part of
what it returns — a route that echoed the hash would undo the reason it is hashed.

The decision note claims `server.ts` before this write and records all seven
reuse-gate rungs, including the rungs that found nothing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts docs/decisions/0072-display-identity-in-the-server.md
git commit -m "feat(host): pair a durable credential against a persisted display"
```

### Task 1.4: The one-time code, and `/pair`

**Files:**
- Create: `src/web/packages/host/src/session/pairing-code.ts`
- Create: `src/web/packages/host/src/session/pairing-code.test.ts`
- Create: `src/web/packages/host/public/pair.html`
- Modify: `src/web/packages/host/src/server.ts`
- Modify: `src/web/packages/editor/src/editor-shell/publish-control.tsx`
- Test: `src/web/packages/host/src/server.test.ts`,
  `src/web/packages/editor/src/editor-shell/publish-control.dom.test.tsx`

**Interfaces:**
- Consumes: `DisplayStore.create`/`find` (Task 1.1), `SessionStore.create` (Task 1.2).
- Produces:

```ts
/** No I, L, O, 0 or 1: the glyphs a person reads off one screen and types on another. */
export const PAIRING_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const PAIRING_CODE_LENGTH = 6;
export interface PairingCode { readonly code: string; readonly expiresAt: string }
export interface PairingCodeStore {
  mint(): PairingCode;
  /** Consumes the live code on a match. A mismatch never consumes it. */
  claim(code: string): boolean;
  current(): PairingCode | undefined;
}
export function createPairingCodeStore(options?: {
  readonly ttlMs?: number;
  readonly now?: () => number;
  readonly randomCode?: () => string;
}): PairingCodeStore;
```

  Routes: `GET /api/pairing/code` (loopback) answers
  `{ code: string | null, expiresAt: string | null }`; `POST /api/pairing/claim`
  takes `{ code, label }`, is **reachable unpaired**, and answers
  `{ displayId, token, expiresAt }` or a 404 that says nothing about whether a code
  exists.

- [ ] **Step 1: Write the failing test**

```ts
// pairing-code.test.ts
it("draws only from the alphabet a person can read back", () => {
  // 2000 draws: every character is in PAIRING_CODE_ALPHABET, and no draw contains
  // I, L, O, 0 or 1.
});
it("consumes on a match and never on a mismatch", () => {
  // claim(wrong) -> false and current() is still the same code;
  // claim(right) -> true and current() is undefined.
});
it("expires", () => { /* now advances past ttlMs -> claim(right) false */ });

// server.test.ts
it("pairs a camera-less display from the code alone", async () => {
  // POST /api/pairing/claim { code, label } from off-loopback with no session ->
  // 200 carrying a displayId and a token, and the display is listed.
});
it("says nothing about whether a code exists", async () => {
  // An unknown code and an expired one answer the same status and the same text.
});
it("does not let a wrong guess close the window", async () => {
  // Five wrong claims, then the right one still succeeds.
});
it("keeps the QR and the code in step", () => {
  // publish-control's QR label carries the same code the card shows.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/session/pairing-code.test.ts packages/host/src/server.test.ts -t "claim"`
Expected: FAIL.

- [ ] **Step 3: Implement**

**The QR carries the code, not the token.** `publish-control.tsx` renders the QR
today as `http://<address>:<port>/?session=<token>`; it becomes
`http://<address>:<port>/pair?code=<code>`, and the card writes the address out
beside it so a camera-less device has somewhere to go. One mint, two presentations
— that is the whole point of the split.

**The card names the one step that makes address changes stop mattering**: reserve
this address in the router, or give the host a name, and the display's URL never
breaks (spec § "Finding the host after its address changes"). One line of copy on
the card, because the card is the only moment the owner is thinking about it.
**The address the card prints is `lanAddress()`'s.** **[Corrected 2026-10-18: this paragraph read "— the first
non-internal IPv4 — which is the wrong one on a PC with Docker, WSL, Hyper-V or a VPN adapter. Do not fix
that here; check the printed address against the one a phone actually reaches, and file it if it is wrong
rather than widening this task." That premise is gone: Task 23.1 of the backlog drain landed `vg-171`'s ruling
as `rankLanAddresses` (`packages/host/src/cli/net.ts`), so `lanAddress()` now drops virtual adapters by name and prefers the interface carrying the
default IPv4 route, and a tie-break warns with the alternatives. What remains for this task is the card's
copy, not a suspect address — and if a printed address is ever wrong on a real machine, that is a row against
`rankLanAddresses`, not something to widen this task into.]**

`POST /api/pairing/claim` is **one of the two routes reachable unpaired** — with
`GET /api/host` (Task 1.6) — so it does no listing, returns no theme and no device
fact, and its refusal is the same sentence for an unknown code, an expired code and
a consumed code. Rate limiting is per source and per code with a growing penalty,
never a lockout: a lockout is a way to aim a denial at the person trying to pair. A
mismatch never consumes the live code, so nobody on the LAN can close a pairing
window by guessing wrong.

**What the claim returns is a durable credential** (ruling 12), minted with
`newToken()` and stored through `displays.create(label, token)`: the code is the
only short-lived secret in the exchange and everything after it lasts until the
host removes the client. A display that paired this way has a credential the host
can see and remove by name, which is the property the TTL used to stand in for.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/session/pairing-code.test.ts packages/host/src/server.test.ts packages/editor/src/editor-shell/publish-control.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/session/pairing-code.ts src/web/packages/host/src/session/pairing-code.test.ts src/web/packages/host/public/pair.html src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts src/web/packages/editor/src/editor-shell/publish-control.tsx src/web/packages/editor/src/editor-shell/publish-control.dom.test.tsx
git commit -m "feat(host): pair a display that has no camera by typing a code"
```

### Task 1.5: One app folder is one host, with an identity of its own

Two things the folder carries: the record that says *which host this is* — the id a
display stores so a re-find matches its own host and not another (§ "Finding the
host after its address changes") — and the lock that says *a host is already
running here*.

**Files:**
- Create: `src/web/packages/host/src/settings/host-record.ts`
- Create: `src/web/packages/host/src/settings/host-record.test.ts`
- Create: `src/web/packages/host/src/settings/host-lock.ts`
- Create: `src/web/packages/host/src/settings/host-lock.test.ts`
- Modify: `src/web/packages/host/src/cli/args.ts` (the refusal's message)
- Modify: `src/web/packages/host/src/main.ts` (**R19**: acquire the lock before
  `listen`, release it on exit. Neither this task's original file list nor Task
  1.6's named `main.ts`, so the lock would have had no production caller anywhere
  in Phase 1 while the phase's own exit criterion claims "the host's own identity
  and lock in the app folder". The record's wiring stays in Task 1.6, which adds the
  option it is passed to; this task must not read the record in `main.ts`.)

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export interface HostRecord { readonly id: string; readonly name: string }
/** Reads the folder's host record, minting and persisting one on first run. */
export async function readOrMintHostRecord(settingsDir: string, options?: { readonly hostname?: () => string }): Promise<HostRecord>;
export interface HostLock { readonly release: () => Promise<void> }
/** Holds the folder for this process, or answers why another host has it. */
export async function acquireHostLock(settingsDir: string, port: number): Promise<{ readonly ok: true; readonly lock: HostLock } | { readonly ok: false; readonly reason: string }>;
```

- [ ] **Step 1: Write the failing test**

```ts
// host-record.test.ts
it("mints an id and a name on first run, and keeps them after", async () => {
  const first = await readOrMintHostRecord(dir, { hostname: () => "study-pc" });
  expect(first.id).toMatch(/^[a-z0-9-]{8,64}$/);
  expect(first.name).toBe("study-pc");
  const again = await readOrMintHostRecord(dir, { hostname: () => "renamed-pc" });
  expect(again).toEqual(first);           // the id and the stored name win
});
it("refuses a stored record with no usable id, and mints a fresh one", async () => {
  // { id: "", name: "x" } -> a new record, not an empty id on the wire.
});

// host-lock.test.ts
it("refuses a folder a live host already holds", async () => {
  // acquire(dir) then acquire(dir) -> ok: false, and the reason names --app-dir.
});
it("takes the folder back after the holder releases", async () => {
  // release(), then acquire -> ok: true.
});
it("takes a folder whose holder is gone", async () => {
  // Write a lock naming a pid that is not running -> ok: true.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/settings/host-record.test.ts packages/host/src/settings/host-lock.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`host-record.ts` owns `host-identity.json`, `{ id, name }` — not `host.json`, which
would sit one character from the incumbent `hosting.json` in the same directory
(**R20**; the plan's Global Constraint against exactly that). The id is
`randomBytes(8).toString("hex")` — **its job is uniqueness, not secrecy**: it is
answered publicly by `GET /api/host` (Task 1.6), and what it defends is a display
attaching to the wrong host, which a guessable-but-unique id already prevents. The
name defaults to `os.hostname()`. A stored record whose id does not match
`DEVICE_ID_PATTERN`'s shape is replaced rather than served, so `/api/host` can
never answer an id no display could store.

The lock is a file in the settings directory naming the holding pid and port, and
it is *stale-tolerant*: a lock whose pid is not running is taken rather than
respected, so a crash does not lock someone out of their own library. The refusal's
message names the folder, the port the other host is on, and `--app-dir` — the flag
that already exists to separate two installs. The host acquires it before it
listens and releases it on exit.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/settings/host-record.test.ts packages/host/src/settings/host-lock.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/settings/host-record.ts src/web/packages/host/src/settings/host-record.test.ts src/web/packages/host/src/settings/host-lock.ts src/web/packages/host/src/settings/host-lock.test.ts src/web/packages/host/src/cli/args.ts src/web/packages/host/src/main.ts
git commit -m "feat(host): one app folder is one host, with an identity of its own"
```

### Task 1.6: `GET /api/host`, the route anyone may read

The one route that answers an unpaired client, and the reason it can: it says
`{ id, name, port }` and nothing else.

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Test: `src/web/packages/host/src/server.test.ts`
- Modify: `src/web/packages/host/src/main.ts` (**R19**: read-or-mint the record and
  pass it as `host`, the wiring for the option this task adds. Task 1.5 owns the
  lock's half of `main.ts`.)

**Interfaces:**
- Consumes: `HostRecord`, `readOrMintHostRecord` (Task 1.5).
- Produces: `HostServerOptions` gains `readonly host?: HostRecord`. The route
  `GET /api/host` → `200 { id, name, port }` with `Access-Control-Allow-Origin: *`.

- [ ] **Step 1: Write the failing test**

```ts
it("answers an unpaired caller with the identity and nothing else", async () => {
  // GET /api/host with no credential -> 200, and the body's keys are exactly
  //   ["id", "name", "port"] — no themes, no displays, no counts.
});

it("is readable cross-origin, because a re-find sweep is cross-origin", async () => {
  // The response carries Access-Control-Allow-Origin: *.
});

it("does not leak the credential or the display list", async () => {
  // With two paired displays, the body still holds only the three fields, and
  // its bytes contain neither token nor tokenHash.
});

it("answers a port that is the one it is actually listening on", async () => {
  // Started with a fallback port, GET /api/host reports the port in the URL.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/server.test.ts -t "api/host"`
Expected: FAIL — 404.

- [ ] **Step 3: Implement**

Register the route **before** the display guard and outside `allowed()`, beside the
pairing block's own exemption, and say in a comment why: this is the one route an
unpaired client may read, so it is the one route whose body is fixed by that
promise. The port comes from the listening socket rather than from the option, so a
host that fell back to the next port answers the port a display must use.

**No `Access-Control-Allow-Credentials`.** A sweep sends no credential, and a
wildcard origin with credentials is refused by browsers anyway; adding it would
only invite a later reader to send the token cross-origin.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts src/web/packages/host/src/main.ts
git commit -m "feat(host): answer the identity a display re-finds its host by"
```

### Task 1.7: The host's own monitors

Spec § "The host's own monitors". A second kind of display: the host's own screen,
running a browser the host specified, with **no code and no credential** because it
is on this PC. No new dependency — `systeminformation` is already here.

**Files:**
- Create: `src/web/packages/host/src/settings/monitors.ts`
- Create: `src/web/packages/host/src/settings/monitors.test.ts`
- Modify: `src/web/packages/host/src/settings/displays.ts`
- Test: `src/web/packages/host/src/settings/displays.test.ts`
- Modify: `src/web/packages/host/src/server.ts`
- Test: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: `DisplayStore.createLocal` (Task 1.1); `LOCAL_DISPLAY_ID` (Task 1.1).
- Produces:

```ts
export interface Monitor { readonly deviceName: string; readonly serial?: string; readonly main: boolean; readonly positionX: number; readonly positionY: number; readonly currentResX: number; readonly currentResY: number }
/** What is attached now, from `systeminformation`'s `graphics()`. */
export async function listMonitors(): Promise<readonly Monitor[]>;
/** The hint a record stores: serial when the monitor reports one, else deviceName. */
export function hintFor(monitor: Monitor): MonitorHint;
/** Whether a stored hint still matches something attached. */
export function isAttached(hint: MonitorHint, monitors: readonly Monitor[]): boolean;
/** The URL to open on that monitor, and the geometry a window needs. */
export function launchFor(monitor: Monitor, port: number, displayId: string): { readonly url: string; readonly position: readonly [number, number]; readonly size: readonly [number, number] };
```

- [ ] **Step 1: Write the failing test**

```ts
// monitors.test.ts — pure, over a fixture shaped like the probe's real answer.
const ATTACHED: Monitor[] = [
  { deviceName: "\\\\.\\DISPLAY1", serial: "4790810010513", main: true,  positionX: 0,    positionY: 0, currentResX: 2560, currentResY: 1440 },
  { deviceName: "\\\\.\\DISPLAY2", main: false, positionX: 2560, positionY: 0, currentResX: 1920, currentResY: 1080 },
];

it("prefers the serial, because a device name moves when cables do", () => {
  expect(hintFor(ATTACHED[0]!)).toEqual({ serial: "4790810010513", deviceName: "\\\\.\\DISPLAY1" });
  expect(hintFor(ATTACHED[1]!)).toEqual({ deviceName: "\\\\.\\DISPLAY2" });
});

it("matches a hint on serial when it has one, and on deviceName when it does not", () => {
  expect(isAttached({ serial: "4790810010513", deviceName: "\\\\.\\DISPLAY1" }, ATTACHED)).toBe(true);
  expect(isAttached({ serial: "gone", deviceName: "\\\\.\\DISPLAY1" }, ATTACHED)).toBe(false);
  expect(isAttached({ deviceName: "\\\\.\\DISPLAY2" }, ATTACHED)).toBe(true);
  expect(isAttached({ deviceName: "\\\\.\\DISPLAY9" }, ATTACHED)).toBe(false);
});

it("builds a loopback URL and the geometry that puts a window on the monitor", () => {
  const { url, position, size } = launchFor(ATTACHED[1]!, 5227, "left-screen");
  expect(url).toBe("http://127.0.0.1:5227/?display=left-screen");
  expect(position).toEqual([2560, 0]);
  expect(size).toEqual([1920, 1080]);
});

// server.test.ts
it("adds a local monitor with no credential", async () => {
  // POST /api/displays { label: "Left screen", monitor: {...} } -> 201 with
  //   kind "local", no token in the body, and the display listed.
});

it("answers what is attached, for the owner to pick from", async () => {
  // GET /api/displays/monitors -> 200 with one entry per monitor.
});

it("refuses a local display from off loopback, on every route", async () => {
  // A non-loopback POST /api/displays -> 403; the list is unchanged.
});

it("keeps a display whose monitor is no longer attached", async () => {
  // A record hinting at a monitor not in the fixture: GET lists it, its theme is
  //   unchanged, and the monitor list does not contain it.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/settings/monitors.test.ts packages/host/src/server.test.ts -t "monitor"`
Expected: FAIL — cannot resolve `./monitors.js`.

- [ ] **Step 3: Implement**

`listMonitors` calls `graphics()` and maps `displays` to `Monitor`, reading
`deviceName`, `serial`, `main`, `positionX`, `positionY`, `currentResX` and
`currentResY`. **Geometry is read live and never stored on the record** — a
resolution change is not an identity change, and a stored `currentResX` would go
stale silently. `launchFor` builds the URL on `127.0.0.1` rather than the LAN
address, because a local monitor is on this PC and the loopback address is the one
that cannot change, and answers the geometry beside it. **It builds no command
line** (ruling 33): the argv belongs to the launcher, which is the only owner that
knows the browser and the per-display profile directory, so a flag set built here
as well would drift from the one the host actually runs the first time either side
adds a flag — and nothing fails when it does.

**The host launches it** — ruling 13, Task 1.8. This task produces the URL and the
geometry; it does not spawn anything and it does not build the command line. Keep
the pure part apart from the process so it is testable without one.

**A record whose hint matches nothing stays.** `GET /api/displays/monitors` answers
what is attached, and the surface compares — the host does not delete a display
because a cable moved, because that would throw away the person's theme to report a
fact about the furniture. **Nor does it relaunch one whose monitor is gone** (Task
1.8): a window on a monitor that is not attached has nowhere to go, and the record
waiting in the list is the honest state.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/settings/monitors.test.ts packages/host/src/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/settings/monitors.ts src/web/packages/host/src/settings/monitors.test.ts src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts
git commit -m "feat(host): a second kind of display, specified rather than paired"
```

### Task 1.8: The host launches it, and comes back after a reboot

Spec § "The host's own monitors", ruling 13: the user overruled the earlier
recommendation that the owner run a shortcut — *"It needs to survive host app
restarts & computer reboots, else it's useless if user have to manually reopen it
everytime."* This is `lhm-launcher.ts`'s shape with a browser where LHM was.

**Files:**
- Create: `src/web/packages/host/src/serve/display-launcher.ts`
- Create: `src/web/packages/host/src/serve/display-launcher.test.ts`
- Modify: `src/web/packages/host/src/settings/displays.ts`
- Test: `src/web/packages/host/src/settings/displays.test.ts`
- Modify: `src/web/packages/host/src/server.ts`
- Modify: `src/web/packages/host/src/main.ts`
- Test: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: `DisplayStore.list`/`find`/`touch`/`createLocal` (Task 1.1, ruling 32);
  `listMonitors`, `isAttached`, `launchFor` (Task 1.7).
- Produces:

```ts
export interface Launcher {
  /** Ensures every attached local display has a window; never a second one. */
  reconcile(): Promise<void>;
  /** Closes the window this launcher opened for a display, if any. */
  close(displayId: string): void;
  /** Closes every window it opened, then stops reconciling. */
  stop(): void;
}
export function findBrowser(platform?: NodeJS.Platform): string | undefined;
export function browserCommand(browser: string, target: { readonly url: string; readonly position: readonly [number, number]; readonly size: readonly [number, number] }, profileDir: string): { readonly file: string; readonly args: readonly string[] };
/** Registers the *host* at sign-in, so every local monitor survives a reboot. */
export function registerHostAutostart(command: string): Promise<{ readonly ok: boolean; readonly message: string }>;
export const LIVE_WINDOW_MS = 15_000;
export function createDisplayLauncher(input: { readonly displays: DisplayStore; readonly port: number; readonly spawn?: typeof spawn; readonly now?: () => number }): Launcher;
```

- [ ] **Step 1: Write the failing test**

```ts
// display-launcher.test.ts — a fake store, a fake clock, a recording spawn.
it("launches a local display that has not been seen recently", async () => {
  // A local record with lastSeenAt older than LIVE_WINDOW_MS -> one spawn, and
  //   the args carry the monitor's position and size.
});

it("does not launch a display that was seen recently", async () => {
  // lastSeenAt inside LIVE_WINDOW_MS -> no spawn at all. This is the check that
  //   makes a host restart not open a second window.
});

it("does not launch one whose monitor is not attached", async () => {
  // Hint matches nothing -> no spawn, and the record is untouched.
});

// displays.test.ts
it("refuses a second local display for a monitor one already holds", async () => {
  // Two creates with the same hint -> the second is refused and the list still
  //   holds one. A hint is a local display's identity, so a second record has no
  //   window the first does not already have, and reconcile would open two.
});

it("never launches a paired display", async () => {
  // kind "paired" -> no spawn, whatever its lastSeenAt says.
});

it("brings back a window that went away", async () => {
  // Launch, then lastSeenAt goes stale again -> a second spawn on the next
  //   reconcile, because a closed window is a stale display.
});

it("does not open a second window when a killed host left an orphan behind", async () => {
  // A stale in-memory child map (a fresh launcher, as after a restart) but a
  //   *fresh* lastSeenAt -> no spawn. The orphan is still polling, so it is the
  //   window this display already has.
});

it("spawns a host-owned child, not a detached one", async () => {
  // The spawn options do NOT carry detached: the browser is the host's own child,
  //   which is what makes close() unambiguous.
});

it("closes the window it opened when the display is removed", async () => {
  // launch(id), then close(id) -> the recorded child was killed; close again is
  //   a no-op rather than an error.
});

it("only ever closes a window it opened itself", async () => {
  // close() for a display this launcher never launched -> no kill, no throw.
});

it("stops reconciling after stop()", async () => {
  // stop(), then reconcile() -> no spawn.
});

it("closes the windows it opened when it stops", async () => {
  // launch two local displays, stop() -> both children killed, and a display this
  //   launcher never launched is untouched. A clean stop must leave no orphan, or
  //   the next start opens a second window on a monitor that already has one.
});

it("answers undefined when no browser is installed, rather than guessing", () => {
  expect(findBrowser("linux")).toBeUndefined();   // with no candidate on PATH
});

// server.test.ts
it("launches a local display when it is added", async () => {
  // POST /api/displays -> one spawn for the new display.
});

it("closes the window when the display is removed", async () => {
  // DELETE /api/displays/<local id> -> the child was killed.
});

it("registers the host at sign-in, once", async () => {
  // POST /api/displays/autostart -> the registration ran, and its message is
  //   the one the surface shows.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/serve/display-launcher.test.ts`
Expected: FAIL — cannot resolve `./display-launcher.js`.

- [ ] **Step 3: Implement**

`findBrowser` looks for a Chromium-family executable at the platform's known
install paths and on `PATH`, and answers `undefined` rather than guessing — a
guessed path is a display that silently never appears. **`browserCommand` is the one
owner of the argv** (ruling 33): Task 1.7's `launchFor` answers the URL and the
geometry and builds no command line, so this is where the flag set lives — a second
builder in `monitors.ts` would drift from this one the first time either side adds a
flag, and nothing fails when it does. It takes `launchFor`'s result and the
per-display profile directory and adds `--app=<url>`, `--start-fullscreen`,
`--user-data-dir=<profileDir>` (a separate profile per display, so the wall screen
does not carry the owner's session or extensions), `--no-first-run`,
`--no-default-browser-check`, and `--disable-extensions`.

**One monitor holds one local display, and the store is what says so** (ruling 32,
from Task 1.7's own trailer). The hint *is* a local display's identity, so a second
record for a monitor an existing local display already holds is a state with no
meaning: `reconcile` would open two fullscreen windows on one screen, one hidden
behind the other and both polling. `DisplayStore.createLocal` refuses it, so the record
cannot be written at all — the route turns that refusal into a 409, beside the 400
`normalizeMonitor` already produces for a hint the reader would drop. Equality on the
stored hint is the whole check: two records holding the same hint match the same
attached monitor, so no separate attached-ness test is needed. Paired displays carry
no hint and are unaffected. Keying the launcher's child map by hint instead would be
the wrong repair: the second record would then sit in the list for ever with no
window and no explanation.

**`reconcile` is a comparison, not a process scan.** For each record with
`kind: "local"` whose monitor is attached, it launches when `lastSeenAt` is older
than `LIVE_WINDOW_MS` and this launcher holds no live child for it. Run it on
start, when a local display is added, and on an interval; a closed window goes stale
and comes back on the next pass, and a window on a monitor that is not attached is
not launched at all.

**That check has no producer yet, and this task must not pretend otherwise**
(ruling 35, established while implementing it). The premise was that
`lastSeenAt` is written on every authenticated request (`displayFor`, Task 1.2) and
a local display's page polls continuously, so *seen recently* would be *running*.
It is not: `displayFor` answers `undefined` for a loopback remote by design
(`server.ts:272-277`), because loopback is trusted admin rather than an identity, so
a local display's requests never reach `touch` and its `lastSeenAt` stays at
`createdAt` for ever. Nothing else in this plan writes it either — Task 2.2's
`displayKeyFor` resolves *which* display is asking but touches nothing. So in the
shipped wiring `windowIsLive` answers false for every local display, and the child
map is the whole of the dedupe. **What closes it:** a local display's window must
name itself on a *repeating* request, and the host must record that sighting. That
lands with Task 2.2, which produces the identity resolution, and with the player
change that makes a display follow its own reassignment — a page-load touch is not
enough, because a window loaded an hour ago is exactly the case this is for. Task
1.8 keeps the check, with its docblock stating this, because the logic is right and
becomes live when the producer exists; what it must not do is claim a fact the host
does not have.

**`stop()` closes the windows this launcher opened.** The plan's own claim that
"nothing has to outlive the host" is true of a console Ctrl+C and false of every
other way a host goes away: a child spawned without `detached` is not killed when
its parent is signalled by a service manager, and never when the parent is killed.
Without this, the ordinary restart — stop the host, start it again — leaves a window
on screen that the fresh launcher cannot see, and its empty child map plus a stale
`lastSeenAt` opens a second one on the same monitor. It never closes a window the
owner started, which is the same rule `close` follows.

**A host that is *killed* still leaves an orphan**, and until a window can identify
itself there is no way to tell it from a display with no window: that half of
Review Focus 11 stays open and the Phase 1 gate records it as unverified rather
than verified.

**The child is the host's own: spawn without `detached`, which is `launchChild`'s
choice rather than `openBrowser`'s.** The user's clarification is the reason — *"the
host relaunch the browser on the right monitor again"* — so nothing has to outlive
the host and the reconcile pass on start is the whole of the restart behaviour. The
launcher keeps the child handle per display id so `close` can kill **only a window it
opened itself**: a browser the owner started is not the host's to close, which is
`launchLhm`'s "an LHM the owner already runs keeps ownership of itself" applied to a
browser.

**`lastSeenAt` is what makes a killed host safe.** A host that is killed rather than
closed can leave its browser orphaned, and a fresh launcher has an empty child map —
so without the liveness check, restarting would put a second window on the monitor
the orphan is already on. Test it explicitly: a fresh launcher over a *fresh*
`lastSeenAt` must spawn nothing.

**`registerHostAutostart` registers the host, not the monitor.** One entry at
sign-in covers every local monitor including one added later, and the owner has one
thing to find and remove. On Windows it is the `schtasks /Create /TN ... /SC
ONLOGON /F` call `registerLhmTask` already makes, with the host's own command;
macOS's launchd and Linux's systemd-user or XDG autostart **are not in this task** —
return `{ ok: false, message }` naming the platform, the way `registerLhmTask`
answers "LibreOfficeHardwareMonitor only runs on Windows." for a non-Windows host.
Do not silently do nothing on a platform that is not implemented.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/serve/display-launcher.test.ts packages/host/src/server.test.ts packages/host/src/settings/displays.test.ts packages/host/src/providers/lhm-launcher.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/serve/display-launcher.ts src/web/packages/host/src/serve/display-launcher.test.ts src/web/packages/host/src/settings/displays.ts src/web/packages/host/src/settings/displays.test.ts src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts src/web/packages/host/src/main.ts
git commit -m "feat(host): launch a local monitor's browser, and come back after a reboot"
```

---

## Phase 2 — The per-display map

### Task 2.1: One map, with `default` reserved

**Files:**
- Modify: `src/web/packages/host/src/settings/active-theme.ts`
- Test: `src/web/packages/host/src/settings/active-theme.test.ts`
- Modify: `src/web/packages/host/src/server.ts`
- Test: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_DISPLAY` (Task 1.1).
- Produces: `ActiveThemeStore` becomes
  - `read(display: string, exists: (id: string) => Promise<boolean>): Promise<string | undefined>`
  - `write(display: string, id: string): Promise<void>`
  - `clear(display: string): Promise<void>`

  The file is `{ "<display>": "<theme id>" }`, flat, with `default` an ordinary
  key — so there is no second shape for a reader to get wrong. **There is no
  `readAll` here** (ruling 37): its only consumer is Phase 4's theme-list, which
  shows a display column, and nothing in Phase 2 reads the whole map — so it would
  be a method with no caller and no test, which is the shape that cost this plan
  R7 and R8. Phase 4 adds it with the surface that needs it, and lets that surface
  say whether it wants the raw map or the displays joined to it.

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

The **theme id** is validated against `THEME_ID` on write and its entry dropped on
read when it does not match. The **display key** is not validated here (ruling 39):
its shape is `displays.ts`'s rule (`DEVICE_ID_PATTERN`, "the host's one id shape"),
and a key no reader can ask for is inert, so re-spelling that pattern in this file
would be the second owner the plan's constraints forbid. **The old shape is read as
the default** — an object whose `id` is
a string and which holds no `default` key is read as `{ default: id }`. That is a
migration of a person's own choice rather than compatibility glue for a superseded
internal design: losing it would leave a working dashboard blank. The next write
persists the new shape and the old key is not written again.

**The four existing call sites move to `DEFAULT_DISPLAY` in this task** (ruling
38). Changing the signature breaks `server.ts`'s callers — the assignment's
effective theme, the active-theme route's read, its write, and the `GET /` stored
read — and `server.test.ts` constructs the store four times, so a task that changed
the interface alone would leave the tree failing typecheck until Task 2.2 landed.
They pass `DEFAULT_DISPLAY` because that is exactly what today's global store *is*:
one theme for every client, which is the default display's entry. Task 2.2 replaces
the `GET /` site with `displayKeyFor`; the active-theme route keeps reading and
writing the default until Phase 4 gives that route a display to write for, which is
why it is not a defect for it to still name `DEFAULT_DISPLAY` after Phase 2. **The
count in the first sentence is four, not three** — the pre-flight scan missed the
`GET /` site when it wrote this ruling, and the seat found it, which is the
correction rather than the seat's error.

**A present-but-unreadable file refuses mutation** rather than being overwritten
with one display's entry. `write` and `clear` are read-modify-write over a map that
now holds other displays' choices, so writing over a file the store could not read
would persist that failure as the loss of everyone else's — which is
`createDisplayStore`'s `readOrThrow` rule, spelled the same way here for the same
reason. A file that is simply *absent* still means an empty map: not-yet-chosen and
unreadable are different facts.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/settings/active-theme.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/settings/active-theme.ts src/web/packages/host/src/settings/active-theme.test.ts src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts
git commit -m "feat(host): hold a theme per display, with a default"
```

### Task 2.2: `GET /` resolves the asking display

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Test: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: `ActiveThemeStore.read(display, exists)` (Task 2.1);
  `DisplayStore.find` (Task 1.1); `LOCAL_DISPLAY_ID`, `DEFAULT_DISPLAY` (Task 1.1).
- Produces: `export function displayKeyFor(request: http.IncomingMessage, url: URL, displays: DisplayStore | undefined): Promise<string>`
  — loopback answers `url.searchParams.get("display")` when it names a **local**
  display, else `LOCAL_DISPLAY_ID`; a credential answers its own display's id;
  anything else answers `DEFAULT_DISPLAY`. It is async because the display lookup
  is, and a caller that ignores that would resolve a `Promise` to a key.

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

it("resolves a local monitor from loopback", async () => {
  // A local display "left-screen" with its own theme; GET /?display=left-screen on
  //   loopback renders that theme.
});

it("refuses to resolve a local monitor from off this PC", async () => {
  // GET /?display=left-screen from the LAN, with no credential -> the *default*
  //   theme, not the local monitor's. Naming a display is not a way to become one.
});

it("refuses to resolve a *paired* display from loopback by naming it", async () => {
  // GET /?display=kitchen-tablet on loopback -> "this-pc"'s theme, because
  //   ?display= names local displays only. A paired display is reached by its
  //   credential, so a stray query parameter cannot impersonate one.
});

it("answers displayKeyFor for the four kinds of caller", async () => {
  // loopback -> "this-pc"; loopback + a local display's id -> that id;
  //   credential -> its display's id; no credential, not loopback -> "default".
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/server.test.ts -t "own theme"`
Expected: FAIL.

- [ ] **Step 3: Implement**

The root route's order becomes published, `?theme=`, this display's entry, the
default, the only theme, the chooser. Only step three and the new step four change;
`displayKeyFor` is a module-level function so its answers are unit-testable without
a server.

**`?display=` names local displays only, and that restriction is the security
property rather than a nicety.** A local monitor has no credential, so the query
parameter is the only thing that could identify it — which means the parameter is
also the only way to impersonate one. Two rules close that: the parameter is read
**only on loopback**, and it is matched **only against records whose `kind` is
`local`**. So a LAN client cannot name a local monitor, and no one at all can name
a paired display through the parameter, because a paired display is reached by the
credential it was given and by nothing else. Write the reason in a comment: a
future reader who loosens either rule has removed the reason the credential exists.

**And this is where a local display becomes *nameable*** (ruling 35, carried here
from Task 1.8). Task 1.8's launcher decides whether a local display already has a
window by asking whether its `lastSeenAt` is inside `LIVE_WINDOW_MS`, and nothing
produces that fact: `displayFor` answers `undefined` for a loopback remote by
design, so a local display is never `touch`ed and its `lastSeenAt` stays at
`createdAt` for ever.

**This task produces the resolution and no sighting** (ruling 40). A `touch` here
would fire on the page load a person can see and never again — a mechanism with no
producer, which is the shape ruling 35 was raised about and the shape that cost this
plan R7 and R8. The sighting needs the display's own page to name itself on its
*repeating* requests, and that is the player's poll, which Task 4.2 already changes
on both sides: its file list holds `server.ts` and `publish-follower.ts` together, so
the pair lands in one task or not at all. `displayKeyFor` is the interface that makes
it possible, and Task 4.2 is what makes it true.

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
- Modify: `src/web/packages/host/src/server.ts`
- Test: `src/web/packages/host/src/settings/theme-settings.test.ts`
- Test: `src/web/packages/host/src/server.test.ts`

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

it("reads the shape that was on disk before this task as the default's answers", async () => {
  // Hand-write the old flat file {"wall": {"gpu": "gpu-0"}} and read it back:
  // read(DEFAULT_DISPLAY, "wall") is { gpu: "gpu-0" }, and no display called
  // "wall" exists. A new-shape file holding a display named after a theme id is
  // *not* rewritten — the trigger is that no value is a level map.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/settings/theme-settings.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`normalizeAnswers` keeps its job and gains two callers: the outer map normalises
its display keys with `DEVICE_ID_PATTERN` and its theme keys with `THEME_ID`, and
drops a level that normalises to `{}` so an empty level is not written.

**The file on disk changes shape, so the old one is migrated rather than
misread** (ruling 42). The reader above does not read
`{"wall": {"gpu": "gpu-0"}}` as the answers it holds: `wall` matches
`DEVICE_ID_PATTERN` and `gpu` matches `THEME_ID`, so the old file reads as a display
named after a theme, holding a theme named after a group. A file that holds **no**
level at all is the old shape, and it is read as `{ [DEFAULT_DISPLAY]: <old file> }`
— the same reading Task 2.1 gave `active-theme.json`, because one answer set per
theme is the answers of whoever asked, and that is the default display. The
trigger is deliberately as narrow as 2.1's corrected one: a file that already
holds a display named after a theme id must not be rewritten.

**A level is told from an answers map by its depth, not by its key names**, and
Task 3.1's seat caught the first version of this ruling contradicting its own
diagnosis. The old file's values are *device ids* — strings — where a level's
values are *answers maps*; so a value is a level when it holds **at least one**
theme whose answers are an object. The ruling first said "no value whose keys are
all `THEME_ID`-valid", which never holds for the old file at all: `gpu` is a
`THEME_ID`-valid key, so that trigger would have read every old file as the new
shape and lost every answer in it. *At least one*, not every, for 2.1's reason: a
single unusable theme key must not flip a good level into the old shape and take
every display it holds with it.

**Three call sites in `server.ts` move to `DEFAULT_DISPLAY`** (ruling 41), for
ruling 38's reason: the assignment's read, the answers route's read and its write.
Today's answer file is one answer set per theme for whoever asked, which is the
default display's entry, so the move is behaviour-preserving rather than a
placeholder. Task 3.2 replaces them with the display it is resolving for.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/settings/theme-settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/settings/theme-settings.ts src/web/packages/host/src/settings/theme-settings.test.ts src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts
git commit -m "feat(host): key a theme's answers by the display that answered"
```

### Task 3.2: The assignment the providers consume

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Modify: `src/web/packages/host/src/transport/sse.ts`
- Modify: `src/web/packages/host/src/providers/provider.ts`
- Modify: `src/web/packages/host/src/providers/registry.ts`
- Modify: `src/web/packages/host/src/providers/lhm.ts`
- Modify: `src/web/packages/host/src/providers/library.ts`
- Modify: `src/web/packages/host/src/main.ts`
- Test: `src/web/packages/host/src/server.test.ts`
- Test: `src/web/packages/host/src/providers/registry.test.ts`

**Interfaces:**
- Consumes: `ThemeSettingsStore.read(display, themeId)` (Task 3.1);
  `displayKeyFor` (Task 2.2).
- Produces: `currentAssignment(display: string): Promise<DeviceAssignment>` — the
  signature gains the display it is resolving for — and the assignment reaching
  the connection that display is on. `SseConnection`'s constructor gains
  `readonly display: string`; `registry.sample` and `provider.sample` gain the
  assignment they should answer with, replacing the mutable `setAssignment` a
  provider currently holds.

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

// providers/registry.test.ts
it("samples once per distinct assignment, not once per display", async () => {
  // Three connections, two holding the same assignment: two samples, and each
  // connection is offered the payload its own assignment produced.
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

**The assignment has no per-display path to travel, so this task builds it**
(ruling 43). `currentAssignment` has one caller, `publishAssignment()`, which has
no request and no display: it pushes **one** assignment through
`options.onDeviceAssignment` into `main.ts`, which calls `setAssignment` on the LHM
and library providers, and `tick()` then samples the union **once** and offers
**one** payload to every connection. So an assignment resolved for a display could
not reach that display, and "the assignment each is served carries its own" would
be a test asserting a path that does not exist. Three changes, and each replaces a
global with the thing it was standing in for:

- **The connection knows its display.** `openStream` has the request and the url,
  so it resolves the key with Task 2.2's `displayKeyFor` and hands it to
  `SseConnection`, which already takes per-display state (`semanticKeys`).
- **`tick()` groups before it samples.** Connections are grouped by display, and
  each distinct display gets its own `currentAssignment(display)` and its own
  `registry.sample(keys, now, assignment)` — one sample per distinct assignment
  rather than one per connection, so two displays holding the same devices still
  cost one poll.
- **The assignment is passed, not held.** `registry.sample` and `provider.sample`
  take it, and `setAssignment` goes: a provider that holds a mutable assignment is
  a provider that can only answer for one display, which is the global this task is
  replacing. `main.ts` loses both the initial `setAssignment` and the
  `onDeviceAssignment` fan-out.

`publishAssignment` and its three call sites then have nothing to publish — a
reassignment reaches a display on that display's next tick. Removing them is part
of this task; leaving them would be a second, unused path to the same fact.

**The assignment falls back to the default display's, exactly as the theme
resolution does** (ruling 44, found by this task's review). The answers route and
the active-theme route keep writing `DEFAULT_DISPLAY` until Task 4.1 and 4.3 give
them a display, so without the fallback an answer a person sets on the host page
reaches **no display at all**: no connection resolves as `default` — the stream
route sits behind the pairing guard, which refuses an unpaired LAN client before
`openStream` — and before this task `currentAssignment()` read `DEFAULT_DISPLAY`
and applied that answer to every display. The asymmetry was visible in the diff:
`assignedThemeFor` keeps the fallback, which is what makes ruling 38's "the route
keeps naming the default until Phase 4" survive, and `currentAssignment` had none.
The fallback covers **the chosen theme as well as the answers**, or there is no
theme to look answers up under:

    const own = await activeTheme.read(display, async () => true);
    const chosen = own ?? (display === DEFAULT_DISPLAY ? undefined : await activeTheme.read(DEFAULT_DISPLAY, async () => true));

and the pick becomes `perTheme[group] ?? defaultAnswers[group] ?? stored.assigned[group]`.
**Cost if wrong:** after Task 4.3 writes a display's own answers, the fallback is
dead for displays that have them and still correct for those that do not; it costs
one extra file read on the miss path.

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
- Modify: `src/web/packages/host/src/settings/active-theme.ts`
- Test: `src/web/packages/host/src/server.test.ts`
- Test: `src/web/packages/host/src/settings/active-theme.test.ts`

**Interfaces:**
- Consumes: `ActiveThemeStore.readAll` — **added by this task** (R45): R37 removed it
  from Task 2.1 and deferred it here, because this route is the surface that reads the
  whole map and so the surface that says what it wants from it.
- Consumes: `DisplayStore.list` and `DisplayStore.authenticate` (Task 1.1). **There is
  no `SessionStore`** (R46): ruling 12 deleted sessions and moved the credential onto
  the display record, so a paired request is resolved by `displayFor` →
  `displays.authenticate(token)` (`server.ts:289`).
- Produces: `GET` answers
  `{ default: string | null, displays: readonly { id: string; label: string; kind: DisplayKind; theme: string | null }[], themes, templates }`;
  **`kind` is carried because the host page's warning table is keyed on it** (Task 4.8)
  and the page cannot ask a display what it is. `themes` is `themeStore.list()`
  unchanged, so anything an entry carries rides this response already — **Task 4.8's
  costs arrive here without this route being touched again.**
  `PUT` answers `{ ok: true, default, displays }` in the same shape, and takes
  **two bodies from two callers**: loopback sends
  `{ display: string, id: string }` where `display` is a display id or `"default"`,
  and a paired session sends `{ id: string }` alone. **The admin `GET` stays
  loopback-only.**

- [ ] **Step 1: Write the failing test**

`settings/active-theme.test.ts` — the store method this task adds (R45):

```ts
it("reads every display's entry at once", async () => {
  // Two displays and a default written; readAll returns all three by key.
});
```

`server.test.ts`:

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

it("stays loopback only for the admin read", async () => {
  // A paired non-loopback GET -> 403 "Settings are available on this PC only."
});

it("lets a paired session set its own entry, and only its own", async () => {
  // PUT { id: "kitchen-strip" } with the kitchen tablet's session -> that entry
  // changes; the other display's and the default do not.
});

it("ignores a display named in the body by a session", async () => {
  // PUT { display: "this-pc", id: "x" } with a session -> this-pc is unchanged
  // and the session's own entry is what changed.
});

it("refuses a token that matches no display", async () => {
  // An unknown token -> 403, and no entry changes. Nothing expires (R48): the
  // credential is a hash on the display record and `authenticate` is a lookup.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/settings/active-theme.test.ts packages/host/src/server.test.ts`
Expected: FAIL — the store method does not exist and the route is not the map yet.

- [ ] **Step 3: Implement**

`this-pc` is always present in `displays` with `label` from `uiCopy`'s word for
this PC and never from the display store; a stored record with that id is not
possible because Task 1.1 refuses to mint it.

`readAll` returns the whole map keyed by display, and `GET` joins it against
`displays.list()` — an entry with no theme is `theme: null` rather than absent, so the
page can tell "no theme" from "no display".

**The write's authority is derived, never claimed.** Loopback is the admin path and
reads `display` from the body. A paired request takes the display key from the
**authenticated record's id** — `displayFor(request, url, displays)` already resolves it
and returns the record, so the route reuses that rather than looking a session up
(R46) — and **ignores `display` entirely if the body carries one** — ignoring rather
than refusing, so a client that sends both gets the safe answer instead of a
distinction it could probe. The two keys a paired request can never reach are `default`
and `this-pc`, and they are unreachable by construction: the resolved id is the
request's own record's id, and Task 1.1 refuses to mint either reserved word.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/settings/active-theme.test.ts packages/host/src/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts \
  src/web/packages/host/src/settings/active-theme.ts \
  src/web/packages/host/src/settings/active-theme.test.ts
git commit -m "feat(host): read and write the display map over one route"
```

### Task 4.2: A reassignment reaches a display that is already showing

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Modify: `src/web/packages/player/src/publish-follower.ts`
- Modify: `src/web/packages/player/src/session.ts`
- Test: `src/web/packages/host/src/server.test.ts`,
  `src/web/packages/player/src/publish-follower.test.ts`,
  `src/web/packages/player/src/session.test.ts`

**The root route must say where a theme came from, or this task does nothing** (R50).
`GET /` 302-redirects every display to a URL that names a theme — `url.searchParams.set(
"theme", theme)` then `location: /?theme=<resolved>&data=live` (`server.ts:2399-2403`) —
so a launcher-opened local display and a paired one both arrive carrying
`theme=<assigned>`, and the person's link is indistinguishable from the host's own
resolution. A follower that forwarded its page's `theme` would be answered `null` on
every poll and no reassignment would ever land. So `GET /`'s redirect also sets
**`theme-source`**, one of `link` (the request named it), `published` (the publish won),
or `map` (the display's entry or the default). `DisplaySessionToken` gains
`readonly pageUrl: string` — `displaySession(pageUrl, fetcher)` already receives it and
keeps only the token (`session.ts:20`) — so the follower reads the page it is on and
**`main.ts` does not change.** The follower forwards `theme-source`, forwards `theme`
only when the source is `link`, and **acts on `display.theme` only when the source is
`map`**: with a publish live the page shows the published theme, and acting there would
reload, re-resolve to the published theme, and see the map's entry again on the next
poll — a reload loop. Suppressing costs nothing, because the revision comparison already
reloads a display when the publish changes or stops.

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

it("follows the map only for a page the host resolved itself", async () => {
  // theme-source=map -> acts; =link and =published -> the callback is not called,
  //   and the poll carries no `theme` for the first and one for the second.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/host/src/server.test.ts -t published packages/player/src/publish-follower.test.ts packages/player/src/session.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

The follower gains one more comparison beside the published-id one it already
makes, over the same interval, and the player reloads on the callback — the
existing reaction to a published change, reached the same way. No new poll is
added.

**This task also carries the sighting pair that closes ruling 35** (ruling 40), and
it is here rather than in Task 2.2 because this is the only task whose file list
holds both sides. The poll the follower already makes is the *repeating* request a
local display's window has been missing: it must name itself with `?display=<id>`,
and the host must record a sighting (`touch`) for a request that resolves to a
**local** display. Both halves or neither — a touch with no repeating request
changes nothing, and a repeating request nobody records is not a sighting — which is
why the pair could not be split across phases. **What it fixes:** Task 1.8's
launcher currently answers "no window" for every local display, so a host restarted
after being killed opens a second window on a monitor that already has one. Add the
case that pins it — a local display's poll moves its `lastSeenAt`, and the launcher
then declines to launch — and red-prove it by removing the touch.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/host/src/server.test.ts packages/player/src/publish-follower.test.ts packages/player/src/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts \
  src/web/packages/player/src/publish-follower.ts \
  src/web/packages/player/src/publish-follower.test.ts \
  src/web/packages/player/src/session.ts src/web/packages/player/src/session.test.ts
git commit -m "feat(player): follow the theme this display was assigned"
```

### Task 4.3: The two host pages write the display they name

**Files:**
- Modify: `src/web/packages/host/public/library.html`
- Modify: `src/web/packages/host/public/settings.html`
- Modify: `src/web/packages/host/public/theme-list.js` — **the rows are drawn there**, so
  a display column cannot be added to a page without it. It gains the `displays` option
  the column offers and reports `(display, id)` on choose.
- Modify: `src/web/packages/host/src/editor-link.dom.test.ts`
- Modify: `src/web/packages/host/src/settings-page.dom.test.ts`
- Test: `src/web/tests/e2e/host-settings.spec.ts` (the existing spec covering the
  host's own pages)

**Both DOM test files stub this route and neither task 4.1 nor this one named them**
(R49). `editor-link.dom.test.ts:79` and `settings-page.dom.test.ts:74` both feed the
page `{ themes, templates, active }` — the shape Task 4.1 replaced — so they go red the
moment the pages read `default` and `displays`, and they go red as a task-boundary
surprise rather than as a red test in the task that changed the route. A repo-wide grep
for `api/themes/active` finds no third one.

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

**The column is drawn by `theme-list.js`**, so that module gains the option and the
pages only pass it. The display's `kind` travels with it and is read by Task 4.8's
warning; the warning itself is not this task's, and this task must not add one.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx playwright test tests/e2e/host-settings.spec.ts --workers=1`
Expected: PASS, with the rendered page inspected rather than only its element
counts. Also run `npx vitest run packages/host/src/editor-link.dom.test.ts
packages/host/src/settings-page.dom.test.ts` (R49) — both stubs move to the new shape
in this task.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/public/library.html src/web/packages/host/public/settings.html \
  src/web/packages/host/public/theme-list.js \
  src/web/packages/host/src/editor-link.dom.test.ts \
  src/web/packages/host/src/settings-page.dom.test.ts \
  src/web/tests/e2e/host-settings.spec.ts
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
  re-implemented there.** It carries no cost warning: the warning is the host page's
  (Task 4.8), and the editor raises nothing.

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

### Task 4.5: The display's own chooser

**Files:**
- Create: `src/web/packages/player/src/theme-chooser.ts`
- Create: `src/web/packages/player/src/theme-chooser.dom.test.ts`
- Modify: `src/web/packages/player/src/chrome.ts`
- Modify: `src/web/packages/player/src/main.ts`

**Interfaces:**
- Consumes: `session.ts`'s existing session object, which already carries `fetch`
  (`publish-follower.ts` uses it); `chrome.ts`'s `chromeBand(side)`; Task 4.1's
  paired `PUT`.
- Produces:
  - `export interface ThemeChoice { readonly id: string; readonly name: string }`
  - `export function createThemeChooser(input: { readonly session: PlayerSession; readonly side: ChromeSide; readonly current: string; readonly onChosen: (id: string) => void }): { readonly dispose: () => void }`
  - `export async function listLocalThemes(session: PlayerSession): Promise<readonly ThemeChoice[]>`
  - `export async function chooseOwnTheme(session: PlayerSession, id: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
it("writes the theme and names no display", async () => {
  // chooseOwnTheme(session, "kitchen-strip") -> one PUT to /api/themes/active
  // whose body is exactly { id: "kitchen-strip" }.
});

it("does not offer a chooser to a session-less reader", async () => {
  // No token -> createThemeChooser renders no control and requests nothing.
});

it("reports the host's refusal in the host's own words", async () => {
  // A 403 reaches onError with the host's message rather than a bare status.
});

it("lists the host's themes with their names", async () => {
  // listLocalThemes reads /api/themes and answers one choice per theme.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/player/src/theme-chooser.dom.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

The control joins the player's existing chrome rather than becoming a settings
modal — `chrome.ts` already owns "the display's own chrome: what a reader is told,
and the room it takes", so the chooser is one more strip in a band and takes its
room the same way. **The body carries the id and nothing else**: the display it is
written for is the one the session names, and a client that sent a `display` key
would be a client trying to name someone else's screen. A session-less reader gets
no control at all rather than a control that fails, which is the same rule the
editor's `ThemeLibraryClient.remove` follows for a client that cannot delete.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/player/src/theme-chooser.dom.test.ts packages/player/src/chrome.dom.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/player/src/theme-chooser.ts src/web/packages/player/src/theme-chooser.dom.test.ts src/web/packages/player/src/chrome.ts src/web/packages/player/src/main.ts
git commit -m "feat(player): let a display choose its own theme"
```

### Task 4.6: A display finds its host again after the address changes

Spec § "Finding the host after its address changes". The port never moves
(`cli/hosting.ts`), so only the address is in question; the display stored an
identity, so the re-find is a match rather than a guess.

**Files:**
- Create: `src/web/packages/player/src/host-refind.ts`
- Create: `src/web/packages/player/src/host-refind.test.ts`
- Modify: `src/web/packages/player/src/session.ts`
- Test: `src/web/packages/player/src/session.test.ts`
- Modify: `src/web/packages/player/src/main.ts`

**Interfaces:**
- Consumes: `GET /api/host` (Task 1.6).
- Produces:

```ts
export interface PairedHost {
  readonly hostId: string;
  readonly hostName: string;
  readonly port: number;
  readonly token: string;
  readonly lastAddress: string;
}
/** What a probe answers: the identity at an address, or nothing. */
export type HostProbe = (origin: string) => Promise<{ readonly id: string; readonly name: string } | undefined>;
export function readStoredPairing(storage: Storage): PairedHost | undefined;
export function storePairing(storage: Storage, pairing: PairedHost): void;
/** The ladder: last address, then the name, then the last address's /24. */
export async function refindHost(pairing: PairedHost, probe: HostProbe, options?: { readonly concurrency?: number }): Promise<string | undefined>;
export function originFor(address: string, port: number): string;
export function sweepAddresses(address: string): readonly string[];  // the /24, minus the host itself
```

- [ ] **Step 1: Write the failing test**

```ts
// host-refind.test.ts — the ladder, with a probe that answers for chosen origins.
it("answers the last-known address without sweeping when it still matches", async () => {
  const seen: string[] = [];
  const origin = await refindHost(pairing, async (o) => { seen.push(o); return { id: pairing.hostId, name: "study-pc" }; });
  expect(origin).toBe("http://192.168.1.10:5227");
  expect(seen).toEqual(["http://192.168.1.10:5227"]);   // no sweep happened
});

it("falls through to the sweep and finds the host at its new address", async () => {
  const probe = async (o: string) => (o === "http://192.168.1.44:5227" ? { id: pairing.hostId, name: "study-pc" } : undefined);
  expect(await refindHost(pairing, probe)).toBe("http://192.168.1.44:5227");
});

it("never attaches to a different host", async () => {
  // Every address answers a *different* id -> undefined, not the first responder.
  expect(await refindHost(pairing, async () => ({ id: "somebody-else", name: "other-pc" }))).toBeUndefined();
});

it("answers nothing when no host answers at all", async () => {
  expect(await refindHost(pairing, async () => undefined)).toBeUndefined();
});

it("sweeps its own /24 and not the address it already tried", () => {
  const addresses = sweepAddresses("192.168.1.10");
  expect(addresses).toHaveLength(254);
  expect(addresses).not.toContain("192.168.1.10");
  expect(addresses).toContain("192.168.1.1");
});

it("keeps a bound on how many probes are in flight", async () => {
  let inFlight = 0, peak = 0;
  const probe = async () => { peak = Math.max(peak, ++inFlight); await Promise.resolve(); inFlight--; return undefined; };
  await refindHost(pairing, probe, { concurrency: 8 });
  expect(peak).toBeLessThanOrEqual(8);
});

// session.test.ts
it("stores the credential it was handed and stops reading it from the URL", () => {
  // ?session=<token> once -> storePairing called with it; the same page reloaded
  //   with no query still resolves the session from storage.
});
it("keeps the host identity beside the credential", () => {
  // ?session=<token>&host=<id>&name=<name>&port=5227 -> stored as PairedHost.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/player/src/host-refind.test.ts packages/player/src/session.test.ts`
Expected: FAIL — cannot resolve `./host-refind.js`.

- [ ] **Step 3: Implement**

`refindHost` is the ladder in the spec's order and stops at the first match:
`originFor(pairing.lastAddress, pairing.port)`, then
`originFor(`${pairing.hostName}.local`, pairing.port)`, then `sweepAddresses`.
**A probe that answers a different `id` is not a match and does not end the
search**, which is the whole point of having stored an id: two hosts on one LAN is
the case the spec's § "Two hosts on one network" says must not tangle, and a
first-responder rule is exactly how it would. The sweep runs
`options.concurrency ?? 8` probes at a time with a short per-probe timeout, because
254 sockets at once is how a display becomes a problem for its own network.

`session.ts` reads `?session=` and the identity parameters **once**, stores them
with `storePairing`, and resolves every later request from storage — so the
credential stops living in the URL, which is what a durable credential requires
(spec § "Identity"). A URL that carries no session and no stored pairing is
unpaired, exactly as it is today. `main.ts` calls `refindHost` when a request fails
to reach `pairing.lastAddress`, and re-stores the address it found.

**What this task cannot fix, and must not pretend to.** A display that *reloads*
while the host is elsewhere is served the browser's error page, not ours, so this
routine only runs from a page that is already loaded — or from a cached app shell,
which is `vg-577`'s PWA and not this plan's work. The URL being a name instead of
an address is the deployment answer the pairing card recommends (Task 4.3), and it
is the only answer that covers the reload case without the PWA.

**And on a paired display the app shell is not available at all.** A service worker needs
a secure context, and a LAN origin over this host's plain http is not one — so the name is
not one of two answers on a phone, it is the only one (`vg-580`, spec § "The origin decides
what a display can do"). A certificate the display does not trust fails every probe in the
ladder, so the proof for this task **names the origin it ran on** and does not report a
localhost result as a phone result.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/player/src/host-refind.test.ts packages/player/src/session.test.ts packages/player/src/main.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/player/src/host-refind.ts src/web/packages/player/src/host-refind.test.ts src/web/packages/player/src/session.ts src/web/packages/player/src/session.test.ts src/web/packages/player/src/main.ts
git commit -m "feat(player): find the host again after its address changes"
```

### Task 4.7: The player honours its own rate, and the unconditional repaint is fixed

Spec § "The host's own monitors" and § "A video background defeats the rate". Two
changes that only matter together: the rate becomes the display's, and the one thing
that ignores the rate stops ignoring it.

**This task fixes the unconditional repaint**, and that is a required outcome rather
than a side effect: `scene.ts` subscribes `onFrame` with no reader at all today, so a
video background repaints the whole canvas per decoded frame even when nothing
consumes the result. After this task a video background with no glass repaints the
canvas **zero** times for it. The one case that still repaints per frame — glass over
a video — is the effect's own price, and Task 4.8 warns about it rather than this
task hiding it.

**Files:**
- Modify: `src/web/packages/host/src/server.ts` (`/api/published` carries the rate)
- Test: `src/web/packages/host/src/server.test.ts`
- Modify: `src/web/packages/player/src/main.ts`
- Test: `src/web/packages/player/src/main.test.ts`
- Modify: `src/web/packages/scene-fabric/src/scene.ts`
- Test: `src/web/packages/scene-fabric/src/scene.dom.test.ts`

**Interfaces:**
- Consumes: `chartFpsFor` (Task 1.1); `/api/published` (Task 4.2); `startChartRefresh`
  and `ChartRefreshRate` (`scene-fabric`).
- Produces:
  - `/api/published`'s `display` gains `readonly chartFps: ChartRefreshRate`.
  - `mountFabricScene` subscribes `onFrame` **only when a backdrop reader exists**:
    `FabricSceneOptions` gains `readonly samplesBackdrop?: () => boolean`, and
    `scene.ts` passes `onFrame` only when it answers true at mount.

- [ ] **Step 1: Write the failing test**

```ts
// server.test.ts
it("carries the display's rate on the poll the player already makes", async () => {
  // A local display with no rate set -> /api/published's display.chartFps is 1.
  // The same display after update(id, { chartFps: 30 }) -> 30.
});

// main.test.ts
it("starts the refresh loop at the rate the host gave it", async () => {
  // A published display with chartFps 1 -> startChartRefresh called with 1, not
  //   the 30 the player used to hardcode.
});

it("follows a rate change without a reload", async () => {
  // The poll answers a new rate -> setRate is called on the existing loop.
});

// scene.dom.test.ts
it("starts no per-frame repaint when nothing samples the backdrop", async () => {
  // A video background and samplesBackdrop() === false -> no
  //   requestVideoFrameCallback was ever registered, so a 60 fps video repaints
  //   the canvas zero times.
});

it("still repaints per frame when a glass panel samples the backdrop", async () => {
  // samplesBackdrop() === true -> one callback per decoded frame, because a
  //   frozen frame behind a blur is the bug the loop exists to prevent.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/player/src/main.test.ts packages/scene-fabric/src/scene.dom.test.ts`
Expected: FAIL — `chartFps` is undefined; the frame callback is registered either way.

- [ ] **Step 3: Implement**

`/api/published` answers `chartFpsFor(record)` for the asking display, so the player
reads its rate from the poll it already makes and no new route appears. The player
passes it to `startChartRefresh` and calls `setRate` when a later poll changes it —
the loop already has `setRate`, so this is a call and not a restart.

**The gate is `samplesBackdrop`, and it is the point of the task.** `scene.ts` today
passes `onFrame: () => canvas.requestRenderAll()` unconditionally, and
`background-media.ts` drives it from `requestVideoFrameCallback`, so a 60 fps video
repaints the whole canvas 60 times a second whether or not anything reads the
backdrop. Only glass does — `createGlass` is the one consumer, through
`backdrop()`. So the caller answers whether any object in the scene carries a glass
treatment, and `scene.ts` subscribes `onFrame` only then. **Re-evaluate it on
`update()`**, because a theme can gain a glass panel after mount, and a frozen frame
behind a blur is exactly the bug the loop was added for.

Keep `background-media.ts` unchanged: it already starts no loop unless a video is the
media and an `onFrame` was given, which is the same reasoning one level up.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/player/src/main.test.ts packages/scene-fabric/src/scene.dom.test.ts packages/scene-fabric/src/background-media.dom.test.ts packages/host/src/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts src/web/packages/player/src/main.ts src/web/packages/player/src/main.test.ts src/web/packages/scene-fabric/src/scene.ts src/web/packages/scene-fabric/src/scene.dom.test.ts
git commit -m "feat(player): refresh at the display's own rate, and stop repainting for a video nobody samples"
```

### Task 4.8: The assignment says what the theme will cost

Spec § "What the assignment warns about". The user's rule, 2026-10-18: glass **and**
a video background warns for any display; a video background alone warns for a host
monitor only — and, narrowed the same day, *"the warning only needs to appear on the
host, when the user assign a theme to a device."* **So the editor raises none of it.**

**Nothing new is read to know this.** `ThemeStore.list()` already reads every theme's
`theme.json` to build its rows (`readEnvelope` inside `list`), and `/api/themes/active`
already answers `themes: await themeStore.list()`. So an entry carries its costs and the
page's existing fetch delivers them.

**And the page already has the message shape.** `theme-list.js` gives a row its own note
— `theme-delete-note`, `role="status"`, `hidden` until it has something to say — with
the comment *"Said on the row rather than in a page-level status line: it belongs to
this theme"*. The cost warning is that pattern rather than a second one.

**Files:**
- Create: `docs/decisions/0069-a-themes-cost-is-read-from-the-envelope-alone.md`
- Create: `src/web/packages/renderer-core/src/theme/performance-cost.ts`
- Create: `src/web/packages/renderer-core/src/theme/performance-cost.test.ts`
- Modify: `src/web/packages/renderer-core/src/index.ts` (the public barrel)
- Modify: `src/web/packages/host/src/themes/store.ts` (`ThemeStoreEntry` gains `costs`)
- Modify: `src/web/packages/host/public/theme-list.js` (the policy, the sentence, the note)
- Modify: `src/web/packages/host/public/library.html` (pass the row's display kind)
- Modify: `src/web/packages/host/public/settings.html` (the same)
- Test: `src/web/packages/host/src/themes/store.test.ts`
- Test: `src/web/packages/host/src/theme-list.dom.test.ts`
- Test: `src/web/tests/e2e/host-settings.spec.ts` (the browser proof)

**The decision note lands before the first write to `renderer-core/src/theme/`** (R47):
that directory is on the reuse gate's watchlist and the gate matches a claim by path, so
notes 0003 and 0015 — which claim `document.ts` and `glass.ts` — do not cover a new
`performance-cost.ts` and the hook refuses the write until 0069 exists and claims it.
The seven rungs are worked and recorded in the note; the gate's own rule is that the
searches are the evidence.

**Interfaces:**
- Consumes: `glassTreatment`, `VIGILIA_GLASS_PROPERTY` (`renderer-core/src/theme/glass.ts`);
  the envelope's `artboard.backgroundMedia` and its asset declarations;
  `ThemeStore.list()`'s existing `readEnvelope`; the display row's `kind` (Task 4.1).
- Produces:
  - `renderer-core/src/theme/performance-cost.ts`:
    - `export type PerformanceCost = "glass-over-video" | "video-background"`
    - `export function performanceCostsOf(envelope: unknown): readonly PerformanceCost[]`
  - `host/src/themes/store.ts`: `ThemeStoreEntry` gains
    `readonly costs: readonly PerformanceCost[]` — computed in `entryFor` from the
    envelope it is already handed, so `list()`, `read` and `write` all carry it.
  - `host/public/theme-list.js`:
    - `export function costsFor(kind: "paired" | "local" | "default", costs: readonly PerformanceCost[]): readonly PerformanceCost[]`
    - `export function costWarning(kind: "paired" | "local" | "default", costs: readonly PerformanceCost[]): string | undefined`
    - `themeList(themes, { …, displayKind })` — the kind of the display this list is
      assigning to, so a row can say what that display will pay.

- [ ] **Step 1: Write the failing test**

```ts
// performance-cost.test.ts — envelopes built inline, no renderer, no DOM.
it("finds a video background and no glass", () => {
  expect(performanceCostsOf(videoOnly)).toEqual(["video-background"]);
});

it("finds glass over a video", () => {
  expect(performanceCostsOf(videoWithGlass)).toEqual(["glass-over-video"]);
});

it("finds neither for a plain theme, and neither for glass over an image", () => {
  expect(performanceCostsOf(plain)).toEqual([]);
  expect(performanceCostsOf(glassOverImage)).toEqual([]);
});

it("does not call an image background a video one", () => {
  // The same envelope with asset.kind "image" -> no cost. The declaration is what
  //   decides, not the file extension, which the model already refuses to infer.
});

it("answers no costs for anything malformed, and never throws", () => {
  for (const bad of [undefined, null, 42, "theme", {}, { artboard: 3 }]) {
    expect(performanceCostsOf(bad)).toEqual([]);
  }
});

// theme-list.dom.test.ts — the policy and the sentence.
it("warns about glass over video for every kind of row", () => {
  for (const kind of ["local", "paired", "default"] as const) {
    expect(costWarning(kind, ["glass-over-video"])).toMatch(/repaint/i);
  }
});

it("warns about a video background only for a host monitor, and for the default", () => {
  expect(costWarning("local", ["video-background"])).toMatch(/idle|never/i);
  expect(costWarning("paired", ["video-background"])).toBeUndefined();
  // The default has no kind and may land on a host monitor, so it is told.
  expect(costWarning("default", ["video-background"])).toMatch(/idle|never/i);
});

it("says nothing for a theme with no cost", () => {
  expect(costWarning("local", [])).toBeUndefined();
  expect(costWarning("local", ["glass-over-video"])).not.toMatch(/performance/i);
});

// themes/store.test.ts — the costs ride the listing the route already sends.
it("carries each theme's costs on the entry it already built", async () => {
  // A video theme's entry.costs is ["video-background"]; a plain theme's is [].
  //   No second read of theme.json: list() already reads it for the row.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/renderer-core/src/theme/performance-cost.test.ts packages/host/src/theme-list.dom.test.ts packages/host/src/themes/store.test.ts`
Expected: FAIL — cannot resolve `./performance-cost.js`.

- [ ] **Step 3: Implement**

**The decision note comes first**, because `renderer-core/src/theme/` is on the reuse
gate's watchlist and the hook refuses the write until a note claims the path
(`0069-a-themes-cost-is-read-from-the-envelope-alone.md`). It records all seven
reuse-gate rungs, including the rungs that found nothing: the searches are the evidence,
and a note that names a conclusion without saying what was searched is worth nothing.
Rungs 1–2 are the load-bearing ones — `glassTreatment` and `validateBackgroundMedia`
already read these same two facts, so the note says why this is a third reader of the
envelope rather than a second owner of either.

`performanceCostsOf` reads the envelope and answers costs, in a fixed order so the
output is stable. A video background is `artboard.backgroundMedia.assetId` resolved
against the envelope's own asset declarations to an entry whose **declared** `kind` is
`"video"` — the declaration decides, because the model already refuses to infer an
asset's type from its path (`AssetKind`'s own comment). Glass is any object carrying a
treatment under `VIGILIA_GLASS_PROPERTY`, found by walking the scene the way `glass.ts`'s
own `walk` does — but **reuse `glassTreatment` rather than re-testing the property**, so
the vocabulary keeps one owner.

**It takes `unknown`, not an envelope, and never throws.** It runs on a theme the host
has on disk, and a listing is the wrong place to raise: a malformed envelope has no
costs rather than an exception that would fail the whole list.

**`ThemeStoreEntry.costs` is computed where the envelope already is** — `entryFor` is
handed it, so `list()` pays nothing new for this. `entryFor`'s callers are `list`, `read`
and `write`; all three get the field, and only `list`'s reaches the page.

`costsFor` and `costWarning` live in `theme-list.js`, because that is the one place a
cost is ever shown: `glass-over-video` is a cost for every kind, `video-background` for
`"local"` and for `"default"`, which has no kind and may land on a host monitor. **One
sentence per cost, naming the cost** — the repaint, or the idle — because a warning that
says "performance" is a warning nobody can act on. The sentence is taken from the
editor's own copy rather than imported, which is what `DELETE_LEAD` in the same file
already does and for the same reason: the host serves this module with no build step.

`themeList` gains `displayKind` and puts `costWarning(displayKind, theme.costs)` on the
row as a note, hidden while there is nothing to say. **The note is raised when the row
is chosen for a display and before the write lands**, and it is the row's, so it is still
on screen after the page settles — `library.html` reloads on a successful choice today,
and a warning wiped by that reload is a warning nobody read.

**What this task must check rather than assume.** The reload above: whether the note
survives it, or whether the reload has to wait for the reader, is decided by the browser
test and not by reading `library.html`. **Report which it turned out to be.**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/renderer-core/src/theme/performance-cost.test.ts packages/host/src/theme-list.dom.test.ts packages/host/src/themes/store.test.ts`
Expected: PASS. Then the browser proof, against rebuilt bundles and one worker:
`npx playwright test tests/e2e/host-settings.spec.ts --workers=1` — the note appears when
a video theme is chosen for a host monitor, does not for a remote display, and is still
on screen after the page settles.

- [ ] **Step 5: Commit**

```bash
git add docs/decisions/0069-a-themes-cost-is-read-from-the-envelope-alone.md src/web/packages/renderer-core/src/theme/performance-cost.ts src/web/packages/renderer-core/src/theme/performance-cost.test.ts src/web/packages/renderer-core/src/index.ts src/web/packages/host/src/themes/store.ts src/web/packages/host/src/themes/store.test.ts src/web/packages/host/public/theme-list.js src/web/packages/host/src/theme-list.dom.test.ts src/web/packages/host/public/library.html src/web/packages/host/public/settings.html src/web/tests/e2e/host-settings.spec.ts
git commit -m "feat(host): the assignment says what the theme will cost the display"
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
