# Consumer Journey — pick, configure, forget

- **Status:** queued — Tasks 1–4 landed, Task 4 deliberately reverted by settings-scope; Tasks 5–6 open.
- **Plan:** [`2026-09-24-consumer-journey.md`](../plans/2026-09-24-consumer-journey.md)

## Why

The author and consumer journeys were conflated. The evidence, from driving the
running product:

- A consumer landing on `/` is told "Open the editor to build one, then save it
  to this PC's library" and offered exactly one link: the editor.
- There is no way to choose among saved themes. `/` silently takes the first,
  and any other requires hand-editing `?theme=` in the URL.
- `/settings` covers **devices only**.

A consumer may never open the editor. They cannot build a theme, or do not want
to, and should not have to: they want to take a theme from the library, answer
the questions it needs answered for their machine, and be done.

## Two journeys, one mention

| | Author | Consumer |
|---|---|---|
| Who | Designs a dashboard | Displays one |
| Opens the editor | Yes, that is the job | **Never, ideally** |
| Needs | The full canvas and inspector | Choose, configure, forget |
| Failure today | No selection properties (fixed) | No journey at all |

The editor stays the author's surface. Everything below is the consumer's, and
none of it should require the editor.

## Journey

1. **See what is available.** A library listing of saved themes, by name and
   author, with a preview. Reachable from `/` without typing a URL.
2. **Choose one.** Selecting a theme makes it this host's active theme: what `/`
   shows and what a paired display loads. Persisted, so a reload keeps it.
3. **Answer what it needs.** A theme declares what a machine must supply —
   which device for each slot it binds. The consumer answers those and nothing
   else. A theme binding only `cpu.load` asks nothing; one binding a data-disk
   slot asks which drive.
4. **Forget about it.** The choice and the answers survive a restart. Reopening
   the dashboard shows the same theme with the same answers.

## Design

### Active theme is host state, not a URL parameter

`?theme=` stays supported for links and previews, but the host remembers an
active theme id. `/` resolves in this order: explicit `?theme=` → the stored
active theme → the only theme, if there is exactly one → the library, if there
are several → the first-run page, if there are none.

Owner: `host/src/settings/` beside the device store, since both are per-host
consumer state.

### The library is a consumer page, not an editor feature

Extend the existing `/settings` page rather than adding a second admin surface:
one page a consumer can be pointed at, with a Themes section above Devices.
Reusing it keeps one owner for consumer settings and one place to document.

- Listed by name/author from each package's metadata, which the envelope
  already carries.
- Selection is a button per theme; the active one is marked.
- A short line states what the theme will display, so a choice is informed.

### A theme declares the configuration it needs

A theme already binds semantic keys, and the device slots are derived from
those keys: a theme with any `disk.*` binding needs a system disk; one with
`disk.data.*` needs a data disk; any `gpu.*` needs a GPU when the machine has
more than one. So the required configuration is **derived, not authored** —
no new envelope field, and a theme carrying no such bindings asks nothing.

The settings page shows only the questions the active theme actually raises.

### A paired display follows the host

A phone loading `/` without an explicit theme gets the host's active theme. That
is what "save it and forget about it" means for the display: no per-device URL
to keep.

## Non-goals

- A theme store, ratings, downloads or remote catalogues.
- Editing a theme from the consumer page; that is the editor's job and the page
  links to it for anyone who wants it.
- Per-display theme overrides (one host, one active theme).
- Units/locale/timezone settings: real, but a separate slice with its own
  owners; this spec is the choose-configure-forget loop.

## Boundaries

- The host owns active-theme and device state, both in `host/src/settings/`.
- The consumer page stays dependency-free HTML served from source, consistent
  with the existing settings page.
- No new envelope field: required configuration is derived from bindings.
- `/settings` stays loopback-only; the active theme is a host fact, not a
  secret, and a paired display reads it over its session like any other read.

## Acceptance

- With several saved themes and one chosen, `/` shows the chosen one, and still
  shows it after restarting the host.
- With exactly one saved theme and none chosen, `/` shows it without asking.
- With none saved, `/` shows the first-run page.
- The library lists every saved theme by name, marks the active one, and
  choosing another changes what `/` shows.
- The devices section asks only for slots the active theme binds; a theme
  binding no device keys shows no device questions.
- A paired display loading `/` sees the active theme.
- Every control has an accessible name; the page works at phone width.

## Verification

Each acceptance line is checked by driving the running host in a browser, with
the state inspected after a restart rather than only in one session. The
existing unit suite plus the full local browser run remain the gate.
