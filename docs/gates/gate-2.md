# Gate 2 — Authoring

**Status:** in progress · **Human approval required** to exit (§157)

Per §159, Gate 2 covers "complete chart/style matrices, typography/rich sensor
text, visual style presets, globals inspector and core editor controls", tested
against "global/local overrides, rename/delete, font fidelity, gesture undos,
grouping/alignment and snapping".

Per §33, nothing here is complete until there is observable behaviour and a
test. This file records what was **measured or observed**; what the editor is
*supposed* to do lives in
[`.agents/specs/0004`](../../.agents/specs/0004-editor-selection-and-gestures.md),
[`0005`](../../.agents/specs/0005-editor-editing-and-history.md) and
[`0006`](../../.agents/specs/0006-editor-inspector.md).

---

## Blocked — needs a human decision

### G2-D1 — Chart colours cannot reference a global

**Observed 2026-09-12**, while building the globals panel: the panel reported
`palette.accent` as having **0 uses** in the demo theme, despite both gauges
being accent-coloured on screen.

That count is correct. A chart's colour is a `Fill`, and `Fill.color` is
declared in the schema as a plain `string`:

```json
{ "kind": "solid", "color": { "type": "string" } }
```

So there is nowhere for a `{ "ref": "palette.accent" }` to go. Every chart colour
in every theme is necessarily a hardcoded literal, and changing the palette
leaves every chart unchanged.

**Why this matters beyond tidiness.** Two design-document requirements appear to
assume otherwise:

- **§73** — "Each *compatible* property chooses either a global reference or its
  own literal value." Whether a chart colour is "compatible" is exactly the
  question; nothing in the document says it is not.
- **§170** (dark/light variants) — sparse overrides must cover "**chart/text
  colors**, drawable fills/strokes, backgrounds and UI artwork". A theme cannot
  currently declare a dark and a light gauge colour at all, so dual-mode themes
  are unreachable for anything containing a chart.

§170 is the stronger of the two: text colours already support refs, and the
sentence lists chart colours alongside them as one category.

**Why this was not simply fixed.** It is a change to
`schema/theme-document.schema.json`, which AGENTS.md ranks as the second-highest
blast radius in the repository, and §164 requires human review for a schema
change. It is additive — every existing theme stays valid — but it is still the
persisted format, and the choice between the options below is a design decision
rather than an implementation detail.

**Options, cheapest first:**

1. **Allow `StyleValue` wherever `Fill` holds a colour** — `Fill.color`, and each
   `gradientStop.color` in `thresholds` and `gradient` fills. Consistent with
   every other colour in the format, and the resolution already exists
   (`charts/fill.ts` resolves a `Fill` to an engine colour, so it would resolve
   the ref there). Costs a `schemaVersion` decision: old documents load
   unchanged, so a bump is arguably unnecessary, but a theme *using* the new
   form would silently lose its colours on an older build.
2. **A separate `colorRef` sibling field** on the same objects, leaving `color`
   alone. Avoids touching an existing field's type, at the cost of two ways to
   say one thing — which §75 exists to prevent.
3. **Leave it, and document that chart colours are always literal.** Honest and
   free, but it means §170 cannot be satisfied for charts, and a theme author who
   recolours a palette has to hunt every chart by hand.

**Recommendation: option 1**, with no `schemaVersion` bump and a note in §141's
version rules that a theme using a ref in a chart fill requires this build or
later. Deferred pending a decision — the globals panel ships with the count
correct and this gap recorded rather than papered over.

---

## What the authoring surface has demonstrated

Measured on 2026-09-12 unless stated. Windows 11, Chromium via Playwright
1.63, desktop viewport 1280×720. **The editor is a desktop surface**, so the
phone project skips every editor test deliberately.

| §159 criterion | State |
|---|---|
| Core editor controls | **Observed.** Click, shift-click, marquee, drag, resize, rotate, snap, nudge, delete, group entry/exit — driven by real pointer input |
| Gesture undos | **Observed.** One entry per gesture (§67), verified by count, not by eye |
| Snapping | **Observed.** Node-to-node start/centre/end on both axes, ctrl to disable |
| Globals inspector | **Observed.** Value, display name, key (rewriting references) and delete, with a live use count per token |
| Global/local overrides | **Observed.** §75 as a per-row switch, both directions, in a browser |
| Rename/delete of globals | **Observed.** Rename preserves links; delete inlines the value at every reference site so nothing dangles (§75's "conversion to current literals") |
| Grouping and alignment | **Not started.** Group/ungroup, align, distribute |
| Visual style presets | **Not started** |
| Complete chart/style matrices | **Partial.** Four families render; the styling matrix lives in [gate-0.md](gate-0.md) |
| Font fidelity | **Not started.** §91's multilingual, digit-width and baseline checks need real font packaging |
| Typography/rich sensor text | **Observed** in the renderer (§89 runs, overflow, precision); not yet editable in the panel |

### What these measurements do NOT establish

- **Nothing here is a visual pass.** Every editor assertion is structural — a
  box moved by 100 px, a handle sits on a corner, a row shows a token. The
  screenshots in `screenshots/` are evidence for a human to look at, never
  baselines; see the note in [gate-0.md](gate-0.md) on why chart frames are not
  byte-reproducible.
- **No real authoring session has happened.** Every theme in the repository was
  written as JSON by hand. The editor has never been used to build one from
  nothing, which is the only test that finds the missing-affordance class of
  problem.
- **No open or save**, so §139's "saving marks history clean without clearing
  it" is unit-tested and has never run in the product.
- **Trackpad and high-DPI are unverified.** Handle hit areas are 18 px and were
  sized by argument, not by measurement on a trackpad.
