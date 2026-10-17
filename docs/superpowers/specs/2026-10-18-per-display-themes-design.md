# Per-display themes — design

- **Status:** draft 2026-10-18, revised the same day for acceptance; no plan yet
- **Register:** `vg-574` — *Each display client holds its own theme and its own
  theme-specific settings*
- **Lands before:** `2026-10-12-theme-store-design.md`'s phase A, which consumes
  this document's assign action and does not restate this model.

## What this is, and is not

**It is** the model for a display client: what one is, how it is named, which
theme it holds, and which answers that theme's questions on that display.

**It is not** the storefront (the store spec), the display's own settings panel
or keep-awake (`vg-576`), the installable player (`vg-577`), or where the
assignment is drawn — the store spec's Host settings mode and its local tab own
that surface.

## The intent

The user ruled on 2026-10-17: the app is to serve multiple display clients, each
with their own theme and that theme's own settings, and the store's activation is
built per-display from the start rather than against the single-theme model and
reworked later. Success is that a second screen shows a different theme from the
first, that the choice survives a restart of the host, and that the questions a
theme asks are asked once per display rather than once per PC.

## Today, read from the code

- **One theme per host.** `host/src/settings/active-theme.ts` stores
  `{ id }` in `active-theme.json`, with `read(exists)` treating a theme deleted
  since it was chosen as no choice at all.
- **One resolution order, and it is host-wide.** `server.ts`'s `GET /` answers
  the author's published theme, then `?theme=`, then the chosen theme, then the
  only theme when the library holds exactly one.
- **Answers are keyed by theme alone.** `settings/theme-settings.ts` stores
  `Record<themeId, Partial<Record<AssignableGroup, string>>>` in
  `theme-answers.json`, and `currentAssignment()` (`server.ts`) resolves
  `perTheme[group] ?? stored.assigned[group]`.
- **A display's only identity is a short-lived token.**
  `session/pairing.ts` holds `DisplaySession { token, label, createdAt, expiresAt }`
  in an in-memory `Map` with a 12-hour TTL, deliberately: *"a leaked token must
  stop working on its own."* The token rides in the page URL as `?session=`.
- **Loopback is trusted admin and is never paired** (`allowed()`), and
  `/api/themes/active` is loopback-only.
- **A display already polls for change.** `player/src/publish-follower.ts` reads
  `/api/published`, which answers `{ id, revision }`.

## What a display is

**A display is a client that shows a theme, not a panel.** A PC with two monitors
showing the same page is one display; two browsers on one PC are two. This is
worth stating because "display" in the user's own words means the screens, while
everything that can hold an assignment is a client — and the code can only ever
see a client. The objective's "detect connected displays" is therefore satisfied
by naming the clients that are showing something, not by enumerating monitors.

Three kinds of client exist, and all three are displays:

| Display | Identity | Paired |
|---|---|---|
| **This PC's own screen** — the root page on loopback | the reserved id `this-pc` | never; loopback is already trusted |
| **A paired LAN client** — a phone, tablet, TV or installed player | a display record's id | yes |
| **An unpaired reader** — anyone else who opens the root page on the LAN | none | no; it gets the default |

## Identity: the token is a credential, not a name

**The assignment cannot be keyed by the session token**, and this is the one
decision the rest of the model hangs on: the token lives in memory for twelve
hours, so a theme assigned to it would evaporate at the first restart — and the
person would have to walk to the display and re-choose, which is exactly the work
this feature exists to remove. Loosening the token's lifetime to fix that would
spend a security property to buy a convenience.

So the two are separated:

- **Pairing mints a display record** — `{ id, label, createdAt }` — and persists
  it. The id is the name an assignment is keyed by.
- **The session carries a `displayId` beside its token.** Tokens stay short-lived
  and in memory; nothing about their security changes.
- **Re-pairing a known display issues a new session for the existing record**,
  rather than minting a second display: `POST /api/pairing/sessions` takes either
  a `label` (a new display) or a `displayId` (another session for that one). A
  host restart therefore costs a re-pair and not an assignment.
- **Re-attaching is the admin's choice, never the client's claim.** The client
  cannot name a `displayId`; only the loopback-only pairing route accepts one. A
  client that could name a display would be a client that could take another
  display's theme.

**The id's shape is the one this codebase already uses for a device id** —
`[a-z0-9][a-z0-9-]{0,63}` (`settings/devices.ts`'s `ID_PATTERN`,
`theme-settings.ts`'s `DEVICE_ID`) — minted from the label's slug, with a short
random suffix when the slug is taken. Reusing the pattern is not decoration: the
answers file already refuses a key that does not match it, so a display id that
did not would be unanswerable.

## The model: a default, and an override per display

`active-theme.json` becomes:

```json
{
  "default": "living-room",
  "displays": { "this-pc": "attic-wall", "kitchen-tablet-a1b2": "kitchen-strip" }
}
```

- **A display with no entry gets the default.** That is what an unpaired LAN
  reader gets, and what a freshly paired display gets before anyone assigns it.
- **A stale id falls back rather than failing.** The existing rule survives: an
  entry naming a theme that is no longer in the library is no choice, so the
  display falls to the default rather than to an error page.
- **`default` is a display id or a theme id, and the file says which by its
  shape** — a string under `default`, an object under `displays` — so a
  hand-edited file cannot be read two ways. Both are validated against the theme
  library on read, as today.

**`this-pc` is reserved and always exists.** Without it the local screen would be
the one client that cannot be given a theme of its own, which is the client the
author is looking at. It is never paired and has no record; the map simply
accepts it as a key.

## The answers belong to a display's use of a theme

`theme-answers.json` becomes
`Record<displayId, Record<themeId, ThemeAnswers>>`.

The global device settings keep their place as the fallback, so the property the
file exists for survives unchanged: *a consumer who set the system disk once is
not asked again by every theme that reads a disk*. What changes is only where a
theme's **difference** from that global choice is recorded — per display, because
"which GPU does this dashboard show" is now a question about the screen as well as
the theme.

## Resolution, for a display

`GET /` keeps its order and gains one step:

1. **what the author is publishing now** — unchanged, and still the head
2. **`?theme=`** — an explicit link, unchanged
3. **the theme this display holds** — the map entry for the asking display
4. **the default** — new, and where an unassigned display lands
5. **the only theme, when the library holds exactly one** — unchanged
6. **the chooser** — unchanged

Steps 3 and 4 need the route to know which display is asking. It already can: a
request is loopback (so it is `this-pc`), or it carries a session (so it is that
session's `displayId`), or it is neither (so it is an unpaired reader, and gets
the default).

## A reassignment reaches a display that is already showing

Assigning a theme to a display that is on a wall must not need someone to walk to
it. The mechanism already exists and is not rebuilt: `publish-follower.ts` polls
`/api/published` and the player reacts to a change. That read gains the resolved
theme id for the asking display, and the player reloads when it differs from what
it is showing — the same comparison it already makes for the published id, over
the same interval.

**A display that is showing an explicit `?theme=` link is not moved by an
assignment.** The link is the person's own instruction for that page, and it
outranks the map for exactly as long as it is in the URL.

## The routes

| Route | Who | Answers |
|---|---|---|
| `GET /api/pairing/sessions` | loopback | the live sessions **and** the known displays |
| `POST /api/pairing/sessions?label=` | loopback | a new display and a session for it |
| `POST /api/pairing/sessions?displayId=` | loopback | a session for an existing display |
| `DELETE /api/pairing/sessions/:token` | loopback | revokes the session; **the display record stays** |
| `GET /api/themes/active` | loopback | the default, each display with its theme, the library, the templates |
| `PUT /api/themes/active` | loopback | `{ display: "<id>" \| "default", id }` |
| `GET /api/published` | loopback or paired | `{ id, revision, display: { id, theme } }` |

**Revoking a session does not delete a display**, and that asymmetry is the point
of the split: revoking is taking away a credential, while the display and its
theme are the person's configuration. Deleting a display is its own act on the
displays route, and it removes that display's answers with it — otherwise a new
display reusing a slug would inherit a stranger's answers.

## What already exists, and must not be rebuilt

- **The pairing mechanism, its loopback guard and its token discipline.**
  `session/pairing.ts` is extended with a `displayId` on the session and a
  persisted display list; its constant-time comparison, TTL and sweep stay.
- **The staleness rule** — a chosen theme that is no longer in the library is no
  choice (`active-theme.ts`'s `read(exists)`).
- **The answer fallback** — `perTheme[group] ?? stored.assigned[group]`
  (`server.ts`'s `currentAssignment`).
- **The id pattern** — `settings/devices.ts`'s `ID_PATTERN`.
- **`requiredDeviceGroups`** already derives a theme's slots from its bindings;
  this document changes *whose* answers are read, not how they are derived.
- **The publish poll** — `publish-follower.ts` and `/api/published`.
- **`settings.html` and `library.html` stay served.** They are the only surfaces a
  browser with no editor open can reach, so their theme chooser is rewritten
  against the display model rather than removed.

## Landing order

One plan, and it is a prerequisite of the store's phase A rather than a sibling:

| Phase | Lands | Needs |
|---|---|---|
| **1** | the display record, pairing against it, and the persisted display list | — |
| **2** | the per-display map, the default, and `GET /`'s resolution | 1 |
| **3** | the answers keyed by display and theme, through `currentAssignment` | 2 |
| **4** | the routes, the reassignment read on `/api/published`, and the two host pages rewritten against the model | 3 |

**Phase 2 is the one that must not be built against a model that does not exist**,
which is `vg-574`'s own reason for landing first. Phases 1 and 2 are the pair the
store's assign action consumes; 3 and 4 make the feature usable rather than merely
correct, and nothing in the store spec depends on them.

## Open questions

1. **Whether a display should be able to choose for itself.** The model above has
   every assignment made from this PC, which is what the pairing route's loopback
   guard already implies. A display that could pick its own theme would need the
   display list to be readable by a paired client, and would make the wall screen
   self-service at the cost of a paired client being able to take a theme that is
   not its own. Not ruled.
2. **What a display's record should carry beyond `label` and `createdAt`** — a
   last-seen time is the obvious candidate and is the thing the Host settings mode
   would want in order to say *this one is online*. Deferred until that surface is
   drawn, so the field is added by the thing that reads it.
3. **Whether an assignment should survive deleting the display's record** — the
   answer above is no (the answers go with it), and the theme assignment going
   too is the consistent reading rather than a decided one.

## Not verified, and must be before this is planned

- **That a session token is the only identity a LAN request carries.** Read from
  `session.ts` and `allowed()`; not driven against a real paired phone.
- **That `/api/published`'s poll interval suits a reassignment.** The interval is
  in `publish-follower.ts` and has not been read for this purpose.
- **That `this-pc` cannot collide with a minted display id.** The reserved word is
  safe only if minting refuses it, which the plan must make true rather than
  assume.

## Acceptance

- **1** — pairing twice with the same label creates two displays; pairing with a
  `displayId` creates a session for the existing one and no new display; revoking
  a session leaves the display in the list; a client that sends a `displayId` to
  the pairing route from off-loopback is refused.
- **2** — two displays hold two themes and each `GET /` answers its own; a display
  with no entry gets the default; an entry naming a deleted theme falls back to the
  default rather than erroring; the local root page is assignable as `this-pc`.
- **3** — the same theme on two displays can answer a different GPU on each, and a
  display with no answer still falls back to the global device settings.
- **4** — a reassignment reaches a display already showing a theme without anyone
  touching it; a display on an explicit `?theme=` link is not moved; the display
  list, each display's theme and the default survive a host restart; and
  `library.html`'s chooser writes the display it names rather than the host.
