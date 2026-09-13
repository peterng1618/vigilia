# Proposed amendments to the design document

**For the author to paste or discard. No agent edits
[`pc-stats-display-agent-plan.md`](pc-stats-display-agent-plan.md).**

[Spec 0011](../.agents/specs/0011-editor-property-model.md) moves colour and
typography to the theme level and removes element literals for them. Two
passages of the design document say the opposite, so implementing 0011 leaves
the design document wrong until one of these is applied.

AGENTS.md §164 says the design document wins until a human says otherwise. You
have said otherwise; this file is the paperwork.

> ## Status: all four APPROVED by the author, 2026-09-13
>
> §73 agreed · §170 agreed · §75 agreed, with removal forcing reassignment and
> falling back to the no-fill value · §126 dropped.
>
> **What remains is the mechanical edit to
> [`pc-stats-display-agent-plan.md`](pc-stats-display-agent-plan.md), which only
> its author makes.** Until those paragraphs are pasted, the design document and
> spec 0011 disagree — but the deviation is now *authorised* rather than
> unresolved, which is the difference that matters when someone reads §164 and
> finds the code doing something else.

---

## 1. §73 — "Theme globals (v1)", line 73

### Currently

> Provide named, typed constants for palette colors, heading/body fonts, font
> sizes, spacing and asset references. Each compatible property chooses either a
> global reference or its own literal value; local values remain unchanged when
> globals change. Show that choice explicitly in inspectors, with "use global"
> and "make local" actions. Constants are author-defined values, not scripts or
> sensor expressions.

### Proposed

> Provide named, typed constants for palette colors, type presets, spacing and
> asset references. Palette entries are rgba. A type preset bundles font family,
> size, weight, letter spacing and line height as one named unit, because those
> five are only meaningful together.
>
> **Colour and typography are theme-level only.** A compatible property
> references a global and carries no literal of its own, so re-theming is one
> edit per token rather than a visit to every element. Inspectors show the token
> name, not the resolved value, so an author can always tell what an edit will
> affect. Properties that are genuinely per-instance — element opacity, geometry,
> stroke width — stay on the element.
>
> Constants are author-defined values, not scripts or sensor expressions.

### What changes, concretely

- The `⇲ make local` / `⇱ use global` pair disappears for colour and
  typography. It was implemented (spec 0007) and is covered end to end by a
  browser test, so that test changes with it.
- `fonts` and `fontSizes` are replaced by `typePresets`.
- "spacing" is retained as written, though nothing implements it yet.

## 2. §170 — "Dark/light variants", line 170

### Currently

> …Store sparse overrides for globals and compatible element styles, asset
> references and visibility, covering chart/text colors, drawable fills/strokes,
> backgrounds and UI artwork. Do not automatically invert bitmap colors. Resolve
> mode-specific globals first; then resolve a property's mode override or base
> value. Explicit element literals remain literal unless the author adds a mode
> override.

### Proposed

> …Store sparse overrides for **globals**, asset references and visibility,
> covering chart/text colors, drawable fills/strokes, backgrounds and UI
> artwork. Do not automatically invert bitmap colors. Resolve mode-specific
> globals first; then resolve a property's base value through them.
>
> Because colour and typography are theme-level only (§73), a dual-mode theme
> overrides **tokens, not elements** — so adding a light mode to an existing
> theme touches the palette and the type presets, and no element at all.

### What changes, concretely

The last sentence goes, because element literals for colour no longer exist.
This makes dual-mode *simpler* than designed rather than harder: there is one
override layer (globals) instead of two (globals plus per-element literals), and
the "explicit literals remain literal" exception — which would have made a
light mode silently skip any element an author had customised — has nothing to
apply to.

## 3. §75 — one identifier per node

### Currently

> Use stable IDs plus editable names. […] renaming preserves links […]

### Proposed addition

> For **theme globals**, a stable key and an editable display name are separate,
> because a reference is made from five places and renaming must not break one.
>
> For **nodes**, there is one identifier: an editable `id` of letters, numbers
> and dashes, unique within the document. Nothing inside the document references
> a node id, so the second field bought nothing and could disagree with the
> first — an element whose `id` and `name` tell different stories is a document
> lying about itself.

### What changes, concretely

`name` is removed from every node. The layer list and the inspector show the
`id`. Renaming rewrites any reference atomically if one is ever introduced,
which is what `rekeyGlobal` already does for globals.

## 4. §126 — performance budgets on named reference hardware

### Currently

> …budgets on named reference PCs/phones…

### Proposed

> Record budgets when there is a measured cost to bound. Until then, state the
> shape of the work instead: one poll per cycle for the union of keys active
> displays need, a bounded history buffer, and a bounded node count.

### What changes, concretely

Gate 0's performance section is dropped (see
[`gates/gate-0.md`](gates/gate-0.md)) on the grounds that nothing built so far
is resource intensive. **This is the amendment I am least comfortable drafting**,
because a budget's purpose is to catch the regression nobody predicted — so if
you would rather keep §126 as written, the gate entry should be reinstated as
blocked rather than dropped. Your call, and the gate file records the caveat
either way.

## 5. Not proposed, but worth your eye

Two further passages are consistent with 0011 and need no change; noting them so
you know they were checked rather than missed:

- **§75** ("Use stable IDs plus editable names… `{"ref":"palette.accent"}` or
  `{"value":"#00B8D9"}`… deletion requires reassignment or conversion to current
  literals"). The `{"value": …}` form survives for the properties that keep
  literals — opacity, stroke width, corner radius — so the sentence stays true.
  **But** "conversion to current literals" becomes impossible for a colour: with
  no element literals, deleting a referenced palette entry must *refuse* or
  demand reassignment rather than inline. Today it inlines. If you want that
  sentence to keep covering colour, it needs "reassignment" only.
- **§137** (child order is paint order) and **§57** (a group's children are
  positioned in its space) — §57 is the one D2 stresses: with no group
  transform, "its space" becomes the parent's space. The wording survives
  because a group still *has* a space; it is just always the identity.
