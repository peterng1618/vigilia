# 0047 — The canonical cite range is a stated list, extended per subdivision

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `scripts/design-md.mjs`

## The problem

`scripts/design-md.mjs` holds `CITE_NUMBERS`, described in its own comment as
"the single source of truth for what a citation may resolve against". A marker in
`DESIGN.md` whose number is **not** in that list is invisible to all three
citation rules at once, and the code shows why rather than the prose:

- the loop requiring every canonical number to carry a marker iterates
  `CITE_NUMBERS`, so such a marker is not required to exist;
- the loop requiring every marker to be claimed by a citation skips any number
  where `!known.has(number)`, so it is never required to be cited;
- `UNCITED_OK` cannot record it, because that list exists to name markers the
  rules *would* have caught.

So `<!-- §7.9 -->` was in `DESIGN.md` and checkable in **neither** direction: a
future deletion of the marker, and a future `§7.9` that nothing cites, both read
green. Only the placement check still saw it, because that one walks the markers
rather than the range — which is why `design:check` was red until the mapping row
landed.

The shape is the inverse of the one already handled: a marker *over*-claimed by
another document's numbering was refused, and this is a marker nothing can claim.

## Rung 1 — Vigilia

**Searched:** `scripts/design-md.mjs` for the range, its consumers and its
self-test; `DESIGN.md` for the marker; `docs/`, `src/` and `scripts/` for a
`§7.9` citation; `docs/decisions/` for a note already claiming this path.

**Found:** the range is a module constant with three prose sites naming it
(`:47`, `:57`, `:481`). **`<!-- §7.9 -->` already exists** at `DESIGN.md:403`,
and **a `§7.9` citation already exists in source** —
`src/web/packages/editor/src/grouping-manager/index.ts:52`, beside `DIM_OPACITY`,
the constant that implements the section. The self-test drives `cite()` with an
explicit `numbers` option, so it does not assert the range and needs no edit.
No decision note claimed this path, which is why the gate refused the first write.

**The precedent is in this file.** The range is deliberately a stated constant
rather than read from `DESIGN.md`: if it were read from the file, deleting a
marker would shrink the range it is checked against and the deletion would pass.
That is the same argument the ruling makes, and it is already written at `:56-59`.

## Rung 2 — dependencies

**Searched:** `src/web/package.json` and every `packages/*/package.json` for
anything that models a document's section numbering (`markdown`, `remark`,
`mdast`, `unified`, `section`, `anchor`).

**Found:** nothing. `scripts/` is plain Node with no markdown dependency, and
`design-md.mjs` parses `DESIGN.md` with its own regexes. Adding a parser to
extend a one-element list would be the dependency-for-a-few-lines case.

## Rung 3 — platform

**Searched:** what Node or JavaScript natively give "is this number in the
project's canonical range".

**Found:** a `Set` and an array literal — which is what the file already uses.
The platform question is not the mechanism but **the shape of the claim**: a
predicate (`/^7\.\d+$/`) would derive membership, and a list states it.

## Rung 4 — ecosystem

**Not run, and the distinction matters.** No web tool was available in this
session, so this is **not** a finding that nobody solved this shape — it is an
unrun rung. What can be said without it: the question is "how does *this*
project's checker decide which section numbers its own design document may
contain", which is a question about one repo's numbering convention rather than
about a technique, and the file already answers it deliberately.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Extend the list by one, per subdivision | States the claim the range already makes; matches the file's own stated reason for being a constant | One `CITE_NUMBERS` entry, three prose sites, one citation, one note per new `§7.N` | Each new subdivision obliges three edits and a note; `scripts/` is watchlisted | **chosen** |
| A `§7.N` predicate instead of a list | Removes the per-subdivision edit | Makes the range derived, so a subdivision could be added by writing only the marker | The range stops being a claim someone made and becomes whatever the file happens to contain | rejected |
| Read the range from `DESIGN.md` | No edit when a subdivision is added | Deleting a marker shrinks the range that checks it | The deletion the check exists to catch passes | rejected — already rejected at `:56-59` |
| Leave `§7.9` uncheckable and record it in `UNCITED_OK` | No code change | `UNCITED_OK` is for markers the rules *would* have caught | Misuses the list, and leaves the marker uncheckable in both directions | rejected |

## Rung 6 — probe

`node scripts/design-md.mjs --self-test` and `npm run design:check` at the edit.
The self-test's `cite()` cases pass an explicit `numbers` option, so the range is
not asserted anywhere and the extension cannot break a case that does not name
it — checked by reading the calls rather than by assuming it.

## Decision

**The canonical range is extended per subdivision and stays a stated list.**
`"7.9"` joins `CITE_NUMBERS`, and the citation the ruling requires **already
exists** in source at `grouping-manager/index.ts:52`, so the marker is now
required to exist *and* required to be claimed — both directions the row measured
as open are closed by the one edit.

The cost is taken knowingly: each new `§7.N` obliges a `CITE_NUMBERS` edit, a
citation and a note here, because `scripts/` is on `scripts/reuse-gate.mjs`'s
watchlist. That is the price of the range staying a claim rather than a
derivation, and the row's own ruling chose it.
