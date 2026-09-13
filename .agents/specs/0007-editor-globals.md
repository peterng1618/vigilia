# 0007 — Editing the theme's globals

- **Status:** implemented
- **Design document sections:** §73, §75, §159, §170
- **Specs superseded:** none

## Problem

§75 was half usable. The inspector could point a property at a token, but
nothing could add, rename, recolour or remove one — so the set of tokens was
whatever the hand-written JSON happened to contain.

Two of §75's own requirements had nowhere to live: "renaming preserves links"
and "deletion requires reassignment or conversion to current literals".

## Behaviour

### A tab, not a section

Globals are document-level, so they sit beside the inspector rather than inside
it: the inspector says "nothing selected" exactly when an author most wants to
look at the palette. One right-hand column, two tabs — `Element` and `Theme`.

Both panels guard their redraws against what they last rendered, because the
scene ticks at 1 Hz on live data and an unguarded rebuild steals focus
mid-typing. Two consequences that are easy to get wrong and are both handled:

- Switching tabs clears both guards, or the re-shown panel would be stale.
- **A refused edit clears the guard too.** A refusal changes no document, so the
  guard would skip the redraw and the author's rejected input would stay on
  screen looking accepted. Observed with an invalid token key: `not a key`
  remained in the field.

### Every group is listed, including empty ones

Seeing `Spacing — None yet.` with an add button is how an author discovers that
spacing tokens exist. The alternative is reading the schema.

### The key is the first column

A reference is `group.key`, so the key is what identifies a token in a ref
picker. Showing only the display name hides the thing that matters. The display
name is a second row, with the use count beside it.

### Every row shows a use count

Changing a token changes every element that follows it, and nothing else on the
row says so. "6 uses" is the blast radius, shown where the decision is made, and
it is what makes deletion comprehensible. The count's tooltip lists the sites.

### Operations

| Operation | Rule |
|---|---|
| Add | One click. Generates a free key (`token`, `token-2`, …) for the author to rename, rather than opening a form |
| Set value | Every reference follows it — no reference is rewritten, which is what "follows" means |
| Rename (display name) | Touches **no** references. This is why §75 separates name from key |
| Change key | Rewrites **every** reference. Keeps the token's position in the group, because a reordering list makes the row jump away from the cursor |
| Delete | **Inlines** the current value at every reference site |

Refusals, each returning the document unchanged so no undo entry appears:
an invalid key (`^[A-Za-z0-9_-]{1,64}$`), a duplicate key, an empty display
name, a value identical to the current one, an unknown token. An add never
overwrites an existing token — that would change every element referencing it,
which is a different operation deserving a different undo label.

Deleting the last token of a group drops the group; deleting the last group
drops `globals` entirely. `"palette": {}` is valid and says nothing.

#### Why delete inlines

§75 says deletion "requires reassignment or conversion to current literals".
Three options existed:

- *Refuse while referenced* makes removal a manual hunt, and no UI lists the
  sites.
- *Delete and leave the references* writes a theme that renders wrong.
- *Inline the resolved value* — nothing changes visually, nothing dangles, and
  the properties that followed the token now hold their own copy.

The third is the inspector's "make local" applied to every site at once, so an
author who understands one understands the other.

### A global is referenced from five places

Taken from the schema's `$defs/styleValue` and `$defs/styleMap` call sites, not
from memory:

| Site |
|---|
| `artboard.background` |
| `artboard.barColor` |
| `node.style[property]`, every node, recursively |
| `node.content.runs[].style[property]` — text runs (§89) |
| `node.content.monochrome` — image recolouring (§111) |

Missing one makes every operation wrong in the same direction: a count reads
low, a rekey leaves a dangling reference, a delete silently breaks an element
that still looks fine. One walk (`mapStyleValues`) serves counting, rekeying and
inlining, so a sixth site is one function to change — and the unit fixture
references a single token from all five at once, because a fixture that only
styles top-level rectangles cannot catch this.

## Out of scope

- **Chart colours.** A chart's `Fill.color` is a plain string in the schema, so
  it cannot reference a global at all — which is why the demo theme's
  accent-coloured gauges report `palette.accent` as unused. That is a gap
  against §73 and blocks §170 for any theme containing a chart. It needs a
  schema change and therefore a human decision (§164), recorded as **G2-D1** in
  [`.agents/decisions.md`](../decisions.md).
- **Reassignment on delete** — the other half of §75's sentence. Inlining is
  implemented; "reassign every use to a different token" is not, and is more
  useful once a token picker exists outside the inspector.
- **Where-used navigation.** The count's tooltip lists the sites; clicking one
  does not select that node.
- Dark/light mode overrides (§170), which need the schema question above settled
  first.

## Acceptance

| Behaviour | Test |
|---|---|
| Every reference site is found | `globals-commands.test.ts` — "finds every site the schema allows" |
| A literal holding the same value is not counted | "does not count a literal that happens to hold the same value" |
| Rename preserves links (§75) | "changes the display name and no references (§75)" |
| Rekey rewrites every reference, and keeps position | "rewrites every reference", "keeps the token in place…" |
| Delete inlines at every site, including runs and monochrome | "inlines the value everywhere it was referenced" |
| An unused token's delete shares every node by reference | "shares branches that held no reference" |
| Empty group and empty globals are dropped | "drops the group when its last token goes…" |
| Refusals leave the document untouched | `globals-commands.test.ts`, add/rekey/rename/value cases |
| Changing a token repaints every referencing element, undoably | `tests/e2e/editor.spec.ts` — "changing a token repaints every element that references it" |
| Deleting is visually identity | "deleting a token inlines its value, so nothing changes visually" |
| An invalid key is refused and the field snaps back | "an invalid key is refused without touching the document" |
| Both panels survive a tab switch | "switching tabs keeps both panels working" |

Not verified: the `fonts` and `assets` groups are rendered as plain text fields
and have never been edited in a browser — the demo theme has one font token and
no asset tokens. Nothing validates that an `assets` token's value names a real
asset, so a typo there is currently silent until something tries to resolve it.
