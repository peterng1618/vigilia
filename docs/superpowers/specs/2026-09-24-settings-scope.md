# Settings scope — global and theme-specific

- **Status:** implemented — Tasks 1–4 landed; Task 5's gate and this spec's acceptance annotation open.
- **Plan:** [`2026-09-24-settings-scope.md`](../plans/2026-09-24-settings-scope.md)

## Why

Settings were being treated as one list attached to the active theme. They are
two different things, and conflating them is wrong in a way I introduced and
then caught:

- **Global** settings describe *this PC*: which GPU is preferred, which drive is
  the system one and which the data one, what each is called, and the
  measurement/locale context. They are true whatever theme is displayed, and a
  consumer sets them once for the machine.
- **Theme-specific** settings are the questions a *particular theme* raises. They
  belong to that theme, and only exist once it is chosen.

The bug: I filtered the global device groups by the active theme, so choosing a
theme that reads no disks would *hide* the consumer's disk choice and make a
machine-level setting unreachable. Global settings must never depend on a theme.

## What exists

- Device assignments and display names, stored per host
  (`host/src/settings/devices.ts`).
- The chosen theme, stored per host (`host/src/settings/active-theme.ts`).
- A derivation of which device slots a theme reads
  (`host/src/settings/required-devices.ts`), which is the right input for the
  theme-specific section and the wrong input for the global one.
- `/settings` renders themes then devices, with no notion of scope.

## Design

### Global settings — one section, no theme involvement

`/settings` keeps a Global section that is complete on its own: every device slot
the machine has, its consumer-chosen name, and the preference for each. It
renders the same controls whatever theme is chosen, and it is where a consumer
answers "which is my system drive?" once.

This section is the machine's description of itself. Nothing in it depends on
what is being displayed.

Also global, and listed here for sequencing rather than built now: measurement
system (metric/imperial), location, timezone. These need their own owners and
they are not this change.

### Theme-specific settings — asked when a theme first needs them

Choosing a theme that has requirements opens a short, focused set of questions:

- Only the slots *that theme* reads, derived from its bindings.
- Shown once, at the point the theme is first chosen, then not again unless
  something is missing.
- Answers persist between runs against that theme, so a consumer answers once and
  forgets — the whole point of the consumer journey.

A theme whose bindings ask nothing shows no questions at all.

### Where the answers live

Two layers, because they answer different questions:

- **Global** answers (this PC's system drive, this PC's preferred GPU) are stored
  per host, where they already are.
- **Theme-specific** answers are stored **per theme**, since "which GPU does this
  dashboard show" is a fact about the theme on this machine, not about the
  machine.

A theme-specific answer defaults to the global one: a consumer who has said "the
system disk is C:" is not asked again by a theme that just wants a system disk.
The theme-specific store records only where a theme *differs* from the global
choice, so the common case asks nothing and the global setting stays the single
place to change a machine-wide preference.

### Reusing the existing resolution

The providers already resolve through one assignment object
(`DeviceAssignment`). Per-theme answers compose over the global ones at read
time: theme value → global value → provider default. No second resolution path,
and an unconfigured theme behaves exactly as it does today.

## Non-goals

- Measurement/locale/timezone settings themselves (sequenced, not built here).
- A settings framework, schema or plugin surface.
- Moving provider configuration (URLs, credentials) into either section; §99's
  wizard owns that.
- Per-display overrides: a host has one answer per theme.

## Boundaries

- Global state stays in `host/src/settings/`; per-theme state is keyed by theme
  id beside it.
- The settings page stays dependency-free HTML served from source.
- Both sections are loopback-only, like every other consumer write.
- The derivation in `required-devices.ts` serves the theme-specific section; it
  must not filter the global one.

## Acceptance

- The Global section shows every device slot the machine has, unchanged by which
  theme is active.
- A consumer can set the system disk, the data disk, the preferred GPU and each
  display name without a theme being chosen at all.
- Choosing a theme that reads a disk asks only for a disk, and only when that
  theme has no answer yet.
- A theme that reads nothing shows no questions.
- Answering a theme's question persists across a host restart, and the question
  is not asked again.
- A theme-specific answer overrides the global one for that theme only; other
  themes keep the global answer.
- Rendered inspection of: no theme chosen, a theme needing nothing, a theme
  needing one slot, and a theme overridden from the global choice.

## Verification

Each line is driven in a browser against the real host, with the stored state
inspected after a restart for the persistence cases. The provider resolution is
checked by the sample values a theme receives, not only by what the page shows.
