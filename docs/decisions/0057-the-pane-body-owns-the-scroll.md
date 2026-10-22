# 0057 — The pane's body owns the scroll, not the column around it

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- **Task:** Phase 19.3 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (row `vg-208`)

## The problem

A pane is `aside.editor-shell-panel` > `section.editor-shell-pane` >
`header.editor-shell-pane-title` + `div.editor-shell-pane-body` + footer. One
shared rule put the shell's `overflow: auto` on the **column** (the `aside`), so
the column scrolled the title bar and the footer along with the list.
`DESIGN.md` §7.7 says the opposite — "Pane title and footer stay outside the
scrolling body" — and `vg-208`'s ruling settles which of the two wins.

The non-obvious part is not "put `overflow: auto` on the body". Three things
make it a decision rather than a one-line fix:

- **The box that scrolls is the box the shell reads each pane's offset off.**
  `choosePane` (`shell-layout.tsx:255`) saves the offset before a swap and
  restores it in a later frame, and it does both through one `paneBody` ref that
  is attached to the column "despite the name". There are four panes and four
  bodies under that one ref, and only one of them is a scrollable box at a time.
- **A scrolling flex child needs the height model or the container grows
  instead**, and that failure renders wrong while throwing nothing: the body
  would be full content height, the column would overflow, and the chrome would
  be pushed off-screen — the same defect, wearing the fix.
- **The collapse path has to survive.** The column goes `hidden` on collapse, so
  a body inside it is `display: none` and its `scrollTop` reads 0. The save must
  still happen before that, which is the one assertion in
  `shell-layout-scroll.dom.test.ts` that can fail.

## Rung 1 — Yunari

**Searched:** `editor-shell/` for every `overflow` declaration and every scroll
owner; `paneBody` / `choosePane` / `scrollOf` in `shell-layout.tsx`; `pane.tsx`'s
frame; `shell-layout-scroll.dom.test.ts`; `editor-rail.spec.ts`;
`editor-shell.control-rules.test.ts`; every e2e reference to
`.editor-shell-panel`; `docs/decisions/` for a note already claiming this path.

**Found:**

- **The scroll owner is one shared rule**, `editor-shell.css:1154-1157`:
  `.editor-shell-panel, .editor-shell-inspector { min-height: 0; overflow: auto; }`.
- **`.editor-shell-pane-body` has no rule at all.** The element §7.7 wants as
  the scroller already exists in the React tree (`pane.tsx:52`) and is a plain
  unstyled block, so the work is *which box scrolls*, not a new element.
- **The height model is already this file's own idiom, twice.**
  `.editor-shell-body` is `grid-template-rows: minmax(0, 1fr)` with
  `min-height: 0` (`:1030-1031`), and the panel/inspector rule carries
  `min-height: 0` for the same reason (`:1156`). Nothing new is being invented.
- **`paneBody` is the shortcut's signature**: declared at `:233`, attached at
  `:321` to the `aside`, read at `:263`, written at `:278`.
- **Four other browser cases treat the column as the scroller** and are
  therefore contradicted by this change, not merely stale:
  `editor-rail.spec.ts`'s collapse case and sideways case,
  `composition-panel.spec.ts`'s `rowInScroller` and its wheel case, and
  `shell-palette-tokens.spec.ts`'s scrollbar-token case.
  `design-language-layout.spec.ts:323` names the column as "the scroll owner
  (§7.7)" in a comment while using it as the screenshot box, which stays correct
  — only its reason changes.
- **`layer-panel.dom.test.tsx:628`** claims the footer "stays put while the tree
  scrolls beneath it" — the property the structure did not have. It becomes true
  with this change and needs no edit.
- **No decision note claimed this path.** `0056` claims `components/ui/`.

## Rung 2 — dependencies

**Searched:** `packages/editor/package.json`'s direct dependencies, and the whole
`package-lock.json` for any package whose name contains `scroll`, `sticky`,
`virtual` or `overflow`.

**Found:** nothing. The editor's dependency set is Base UI, Tailwind, React,
echarts, lucide, `clsx` / `cva` / `tailwind-merge` and the three workspace
packages; the lockfile match set for those four words is empty. There is no
scroll-area, virtualiser or scrollbar package installed, and no layout or form
library that owns a frame.

## Rung 3 — platform

**Searched:** what CSS gives for a fixed-chrome, scrolling-body frame, and what
it leaves to the caller.

**Found:** `overflow: auto` on the body is what makes it a scroll container and
its `scrollTop` the offset `choosePane` needs — the platform half is genuinely
free. What is *not* free is the **automatic minimum size**: a flex or grid item's
`min-height` initial value is `auto`, which resolves to a content-based minimum,
so a scrolling child refuses to shrink below its content and the container grows
instead of the child scrolling. `min-height: 0` on the ancestor is what kills it,
and this file already relies on exactly that rule at `:1030` and `:1156`.

The platform's other route to "chrome stays still" is `position: sticky` on the
header and footer. That is rejected by the ruling rather than by the platform:
sticky leaves the **column** as the scroll owner, which is the shortcut §7.7's
sentence and `vg-208`'s ruling both name, and a second scroll-linked owner is
what §7.7 calls a scroll-jacking owner.

## Rung 4 — ecosystem

**Searched:** `flexbox min-height 0 scrolling child header footer stay fixed pane
body overflow auto`; `CSS grid item min-height auto prevents scrolling child
overflow auto min-height 0`; the CSS Flexbox spec's §4.5 "Automatic Minimum Size
of Flex Items" at `drafts.csswg.org/css-flexbox-1/#min-size-auto`; MDN's
`min-height` page; `react-resizable-panels` on npm.

**Found — and the limitation first.** **This environment had no live web
search**: the search tool answered that it cannot run, and both spec fetches
came back truncated before the section they were asked for. So rung 4 rests on
the rule as MDN's `min-height` page restates it (`auto` on a flex/grid item
resolves to a content-based minimum, and the documented workaround for a child
that should scroll is `min-height: 0` + `overflow: auto`), plus what is
installed. That is a thinner rung 4 than the gate wants and it is recorded as
the gap it is rather than dressed up.

What it does establish: **the shape needs no library.** It is the standard flex
frame, and the ecosystem's products in this area are not frame libraries — they
are scroll-**bar** components (Radix `ScrollArea`, `overlayscrollbars`) and
virtualisers. Both are ruled out here by §7.7's own words, "no custom scrollbar
and no scroll-jacking owner", and neither is installed (rung 2).
`react-resizable-panels` was checked for this shape and could not be read (HTTP
403); it is a panel-*sizing* library and is not installed either.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Keep the column the scroller and pin the chrome with `position: sticky` | No structural change; the ref stays on the column | Two sticky declarations | The column is still the scroll owner, so §7.7 and `vg-208`'s ruling are broken while *looking* fixed; it adds the second scroll-linked owner §7.7 names | rejected |
| Radix `ScrollArea` / `overlayscrollbars` | A ready-made scroller | A new shipped dependency | §7.7 forbids a custom scrollbar by name, and the pane would paint a second bar beside the shell's own tokens (`vg-458`) | rejected |
| **A `bodyRef` prop on `Pane`, carried by the showing pane's body** | The ref names the box React actually renders; no selector coupling; the height model is the file's existing idiom | One optional prop on a shared frame and four call sites | `Pane` must attach it only while it is showing, or a hidden pane's body claims it — one comment and one conditional | **chosen** |
| Keep the ref on the column and query the showing pane's body out of it | No `Pane` API change | A class selector inside `shell-layout` | Couples the shell to the pane's class names, and the lookup can silently match nothing | rejected |

## Rung 6 — probe

Measured on the built bundle at `607c9623`, **before any change**, by the new
browser case (`tests/e2e/editor-rail.spec.ts`, "a pane's title bar and footer
stay put while its body scrolls"), desktop-chromium, every layer group opened so
the tree overflows. Reading:

```
atTop        title 54    footer 1643
column.scrollTop = 300  →  offset 300   title -246   footer 1343
body.scrollTop  = 300   →  offset 0     title 54     footer 1643
column: overflow 1026 of client 652, bottom 694
body:   overflow 0, client 1560, bottom 1631
```

Four facts, and they are the whole premise:

- The **column** is the scroll owner: it overflows by 1026px and accepts an
  offset of 300.
- The **body** is not: zero overflow, and writing its `scrollTop` is a no-op.
- Scrolling the column by 300 moves **both** the title bar and the footer by
  exactly 300px (54 → -246, 1643 → 1343). That is the titled defect, measured.
- The footer's resting position, 1643, is 949px below the column's own bottom
  edge (694) — it is not on screen at all until the list is scrolled to its end.

## Decision

**The pane's body becomes the scroll container and the column stops being one.**
Concretely: `overflow: auto` and `min-height: 0` move from
`.editor-shell-panel, .editor-shell-inspector` onto `.editor-shell-pane-body`;
the pane section becomes the flex column that gives the body its slack
(`display: flex; flex-direction: column; height: 100%`), with `flex: none` on
the chrome so the title bar and footer cannot be squeezed by the body's content;
and the column takes `overflow: hidden` so it can never become a scrollbar owner
again by accident.

The `paneBody` ref moves to the body it is named for, as an optional `bodyRef`
on `Pane` that only the showing pane attaches — the other three panes are
`hidden`, so their bodies are not scrollable boxes and must not claim it. The
save still happens before the collapse, because that ordering is the assertion
`shell-layout-scroll.dom.test.ts` exists to make.

**Why this and not the sticky shortcut:** the ruling's sentence is about *which
element owns the scroll*, not about where the chrome appears to sit. Sticky would
satisfy the eye and leave the mechanism exactly as `vg-208` records it, with the
column still the offset's owner and a second scroll-linked owner inside the pane.
The reason to move the scroll rather than hide it is that the offset and the
scroll have to belong to the same element, or the next pane-frame change repeats
this row.

**`layer-tree.ts` is not touched.** The plan's `Files:` line names it and the
controller could not find a reason for it. Confirmed: it carries no scroll
comment, no scroll code and no `stays put` text (433 lines, checked), and the
comment the row cites at `layer-panel.tsx:809-810` is not there either — that
file is 60 lines and the claim now lives at `layer-panel.dom.test.tsx:628`,
where it is already true of this change. Nothing in `layer-tree.ts` refers to the
scroller, so nothing in it is made false.
