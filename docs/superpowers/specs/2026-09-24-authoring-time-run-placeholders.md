# Authoring-time run placeholders

- **Status:** queued — Tasks 1–3 landed at `51023c2`; Task 4 and the gate open.
- **Plan:** [`2026-09-24-authoring-time-run-placeholders.md`](../plans/2026-09-24-authoring-time-run-placeholders.md)

## Why

While editing, a value run shows either a live number or `—`. Neither tells an
author what the run *is*. Building a gauge label, they see `— °C` and must
remember which binding they attached; with preview data on they see `42 °C` and
cannot tell authored text from live text.

Proposed (user's idea): while authoring, a value run renders as its data token
name — prefixed so it cannot be mistaken for data, e.g. `@cpu.temp`.

## What exists

- A value run carries `bindingId`; the binding carries `semanticKey`.
- `resolveTextSegments` returns `MISSING_VALUE_TEXT` (`—`) both for an undeclared
  binding and for an unmapped sensor, so "misconfigured" and "no data" look
  identical today.
- The editor has two data modes: **preview** (synthetic) and **live**. Neither is
  the author's content.

## Design

### The placeholder is editor surface, not document content

The token name must never be persisted, exported or seen by a display. It is
editor chrome, like selection handles: a way to see the structure you are
building. §67 already states authored and runtime state stay apart; this adds a
third, purely transient view.

### Where it applies

- **The editor canvas**, while authoring, in both data modes: a value run renders
  its token name (`@cpu.temp`) instead of a sample or a dash.
- **Not the player.** A display always shows the value or a gap; it never shows a
  token name.
- **Not the persisted scene.** The Fabric object's authored text stays the run
  list; only what is painted differs.

### Misconfiguration stays distinguishable

Three states must not collapse into one:

| State | Authoring shows | Because |
|---|---|---|
| Bound and resolvable | `@cpu.temp` | The token, so the structure is visible |
| Declared but no sensor | `@cpu.temp ⚠` (or equivalent) | The author must see the binding is unmapped |
| Run references no binding | `@(no binding)` | The run is incomplete, not merely unmapped |

Today the last two both render `—`, which is the ambiguity worth removing.

### Reconciliation with live preview

Preview exists so an author can see the design *with* values. Both are useful, so
keep both: a small editor control switches how value runs render —

- **Tokens** (default while authoring): `@cpu.temp`.
- **Values**: the current behaviour, live or synthetic.

Default to **tokens**. Seeing the structure is the more common need while laying
out; values matter when judging fit, which is when the author switches.

### The marker must be unmistakable

The prefix is part of the design, not decoration: an author must never confuse a
token name for a reading. A distinguishable prefix (`@`), and a differentiated
style (muted or outlined), so a glance separates structure from data.

## Non-goals

- Any change to the player, the envelope or the run model.
- Showing token names in exported screenshots or the display.
- Inline editing of a token name on the canvas (the binding picker owns that).
- A general "authoring annotations" system; this is runs only.

## Boundaries

- The substitution happens in the editor's render path, after plan resolution and
  only for the editor's canvas: `scene-fabric` gains a mode, the player never
  sets it.
- The binding picker remains the only way a binding is chosen or changed (§93).
- No persisted field records which mode is active; it is editor transient state
  like selection.

## Acceptance

- With tokens mode on, a bound value run's canvas text reads `@<semanticKey>`,
  and the persisted envelope still holds the run list unchanged.
- Switching to values mode restores the current behaviour, live or preview.
- A declared-but-unmapped binding is visibly distinct from a resolvable one.
- A run with no binding is visibly distinct from both.
- A display never shows a token name, in any mode.
- Switching modes produces no history entry and no dirty state.
- Rendered inspection of all four states, plus the full local browser suite.

## Verification

Each acceptance line is driven in a browser, with the **persisted envelope
inspected after** a mode change to prove nothing entered authored state. The
player check runs through the host, so the display path is exercised rather than
assumed.

## Open question for the maintainer

Should the token marker also appear in the **editor's layer panel and run list**
for consistency, or stay canvas-only? The run list already names each run
(`describeRun`), so the canvas is where it is missing; but a single convention
across both surfaces is easier to teach. Recommendation: canvas only for now,
since the run list already disambiguates, and one surface is less to keep
consistent.
