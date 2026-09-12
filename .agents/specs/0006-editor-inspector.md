# 0006 — The editor inspector

- **Status:** implemented
- **Design document sections:** §61, §67, §75, §77, §89, §93
- **Specs superseded:** none

## Problem

Gestures reach geometry only. Everything else a theme can express — fills,
shadows, fonts, bindings, precision, visibility — was editable only by hand in
JSON.

The hard part is not rendering fields. It is §75: a style property is **either**
a reference to a global token **or** a literal, never both. An inspector that
shows a resolved colour makes a themed property indistinguishable from a
hardcoded one, so an author cannot tell what changing the palette will affect,
and "edit the colour" silently detaches it from the theme.

## Behaviour

### Three layers, two of them pure

| Module | Role |
|---|---|
| `inspector-model.ts` | Document + selected ids → sections of `FieldDescriptor`. Pure |
| `inspector-apply.ts` | `(document, ids, key, change)` → next document. Pure |
| `inspector-panel.ts` | Renders descriptors, reports `(key, change)`. Decides nothing |

Field keys are **strings**: `style.fill`, `transform.x`, `binding.b1.precision`.
So the DOM layer carries no knowledge of the document shape, and a new field is
one entry in the model plus one case in apply. The cost is that an unknown key is
a runtime possibility rather than a compile error — which is why `applyFieldChange`
returns the document **unchanged** for one instead of throwing. A typo in a field
key must not take down the editor mid-edit.

### Sections

`Element` (or `N elements`), `Transform`, `Style`, and one `Binding N` per
binding. `id` and `type` are read-only: the id identifies the node in bindings
and in the selection, and the type determines which other fields exist at all.

### §75, as a per-row mode switch

Each style row reports `source: 'ref' | 'literal' | 'unset'`.

- **`ref`** shows the **token name** and a resolved swatch — never the colour
  alone. And **no literal input for the same property**: §75 is a XOR, and a
  literal beside a ref invites setting a value the ref then overrides.
- **`⇲ make local`** freezes the token's *current* resolved value into the
  element. The rendering does not change, which is what the author expects:
  the element keeps looking the same and stops following the token.
- **`⇱ use global`** only **opens a picker**. It does not commit.
- A reference to a token that **no longer exists** is shown as
  `name (missing)`, selected. The picker must not silently jump to the first
  valid token — an edit would then "fix" the theme without anyone noticing that
  it was broken.
- `use global` is offered only when the document defines tokens of that group.
  A picker that opens an empty list is worse than no button.

#### Why switching to a global is two steps

The obvious implementation writes `{ ref: 'palette.' }` immediately and lets the
row re-render as a picker. That is wrong twice: it puts a **dangling reference**
in the document, and it puts an **undo entry** in the history for a choice the
author has not finished making — so an interrupted click leaves the theme
referring to a token that does not exist.

The pending state therefore lives in the panel, not the document. Nothing is
committed until a token is chosen; backing out is a redraw, not an edit; and a
pending row is abandoned when the selection changes, because it belonged to the
node it was opened on.

### Editing rules

- Edits commit on **`change`**, not `input`. One field edit is one undo entry
  (§67). On `input`, typing "100" would be three entries *and* would apply 1
  then 10 to the scene.
- Values are **clamped to what the schema allows** on entry, so an edit cannot
  produce a document that fails to save later: rotation normalises (400 → 40),
  width and height clamp at 0, precision must be an integer 0–6.
  - Width/height clamp at 0 rather than at the gesture layer's `MIN_SIZE = 1`.
    That floor is a usability choice about handles; an author typing a number
    may legitimately want 0.
- **Clearing writes absence, not emptiness.** `''` would persist as
  `fill: ""`, which the renderer treats as absent anyway — so the document says
  absent. The row then shows a `default` placeholder.
- A binding's `semanticKey` cannot be cleared: an empty key is a binding that
  can never resolve (§93). Refused rather than stored.
- Bindings are addressed by **binding id**, not by index. An index means "the
  second binding of whichever node", which across a multi-selection writes one
  node's sensor into another's.

### Multi-selection

- A field appears when **every** selected node could have it.
- Values that agree show the value. Values that differ show an **empty field
  with a `mixed` placeholder** — never one node's value, which looks like
  agreement that is not there. A mixed boolean uses `indeterminate`, which says
  "neither" and sets all of them when clicked.
- An edit applies to every selected node.

### Locked (§61)

A locked node stays fully inspectable, and `locked` itself stays editable —
otherwise locking would be irreversible. Only its transform handles disappear.

### Redrawing

The panel is rebuilt wholesale, and the caller only calls `render` when the
sections would actually differ (compared as a serialised key). The scene ticks
at 1 Hz on live data; an unguarded rebuild would steal focus mid-typing once a
second.

## Out of scope

- **Editing the globals themselves.** An author can point a property at a token
  but cannot add, rename or recolour one. §75 is half usable until that exists;
  it is the next milestone item.
- Widget instance parameters (§77) beyond what the node fields already cover.
- Typed chart settings. Charts are configured by the theme, not yet by the
  panel, and raw ECharts options must never reach the theme format.
- A diffing panel that preserves focus across a live-data redraw. The render
  guard solves the problem that actually bites.

## Acceptance

| Behaviour | Test |
|---|---|
| Descriptors, read-only fields, mixed detection, unset vs literal vs ref | `inspector.test.ts` |
| Apply clamps, refuses bad values, and returns the same document for a no-op | `inspector.test.ts` |
| A ref shows the token, and no literal input beside it (§75) | `tests/e2e/editor.spec.ts` — "a style bound to a global shows the token, not the colour (§75)" |
| Detach seeds the resolved value; reattaching needs a choice | "…'make local' copies the resolved colour in, and 'use global' puts it back" |
| Opening the picker commits nothing; backing out commits nothing | "backing out of 'use global' without choosing changes nothing" |
| A literal edit repaints the node | "editing a literal colour repaints the node" |
| Clearing returns to the default, and undo restores it | "clearing a property returns it to the default, and undo restores it" |
| Rotation out of range wraps rather than failing to save | "rotation past the schema range wraps instead of failing to save" |
| Shared values show; differing values show `mixed` | "a multi-selection shows shared values and marks the rest mixed" |
| Locked is inspectable but not transformable (§61) | "a locked node is inspectable but not transformable (§61)" |

Not verified: no binding field has been exercised through the browser — the
apply rules for `semanticKey`, `precision` and `unitDisplay` are unit-tested
only. The panel renders them, and nothing has clicked one.
