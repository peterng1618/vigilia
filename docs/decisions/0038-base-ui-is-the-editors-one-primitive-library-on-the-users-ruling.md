# 0038 — Base UI is the editor's one primitive library, on the user's ruling

- **Date:** 2026-10-08
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/components/ui/` (`dialog.tsx`,
  `popover.tsx`, `colour-picker.tsx`),
  `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- **Supersedes:** `0037-react-aria-is-the-editors-one-primitive-library.md`
  and `0036-base-ui-is-the-editors-single-primitive-library.md`

## The problem

The editor runs two primitive libraries at once: five `@base-ui/react` menu surfaces and three
Radix wrapper files. Spec §8 ruled Radix should be the one; that failed on capability. Decision
0036 answered with Base UI; decision 0037 answered with React Aria after the user asked for the
field to be widened beyond the two incumbents. **The user then ruled: Base UI.**

This note records that ruling and the measurements it was made against. It does not re-derive
them — **0037's rungs 4 and 6 are the survey, and they remain valid as measurements**; only its
decision is superseded. What follows is the part a reader needs to act on this today.

## What was measured, and what it settles

**Pointer anchoring eliminates Radix and nothing else.** The surface that stopped Phase 1 — the
canvas context menu, anchored to a raw pointer coordinate rather than to an element — is expressed
by four libraries, each verified against a published artefact rather than a summary:

| Library | Mechanism |
|---|---|
| **Base UI** | `Positioner anchor` accepts a virtual element; **this repo's own code already does it**, `canvas-context-menu.tsx:146-157` |
| React Aria | `MenuTrigger trigger="contextMenu"`; `getTargetRect` on `usePopover` |
| Ark UI | `anchorPoint` — the machine builds the zero-size rect itself |
| Ariakit | `getAnchorRect`, with a shipped context-menu example |
| **Radix** | **none** |

So 0036's premise — that Base UI was *"the only one of the two that can express every surface"* —
was wrong in a way that did not change its answer, and 0037's claim that this was the reason to
leave Base UI was wrong in the same way. **The pointer anchor is a reason to reject Radix; it is
not a reason to leave Base UI.**

**The genuine difference is the colour primitive, and it is a cost this decision accepts.** Base UI
1.8.0 ships no colour component, verified by listing the installed package. React Aria ships eight;
Ark UI ships an equivalent. The editor's 221-line hand-rolled picker therefore **stays hand-rolled**,
and **`vg-194` stays ours to fix** — its tracks render `role="slider"`, `tabIndex={0}` and
`aria-valuenow` with no `onKeyDown`, so they announce a control the keyboard cannot operate. That is
now a keyboard-path task in Phase 1 rather than something a library removes.

**Two corrections to the earlier notes stand, and neither is favourable to Radix.** 0036's
10-month stable release gap (2025-08-13 → 2026-06-06) is real, and it has since **reversed** —
`1.2.0` shipped 2026-10-05 with a `1.3.0` RC line publishing daily. And 0036's claim that the
original Radix authors now work on Base UI is **struck**: the publish metadata shows MUI staff and
Floating UI's author on Base UI, with a Radix maintainer still on the Radix side.

**Ariakit and Ark UI were rejected on the future-proofing axis, and that reasoning is unaffected by
this ruling:** Ariakit on a bus factor of one (91.7% of non-bot merges in 18 months by one person,
still `0.4.x`), Ark UI on a pending v6 breaking migration whose own target date has already passed.
Neither is revived by choosing Base UI.

## Decision

**Base UI is the editor's one primitive library, and it is the user's call rather than an agent's.**
The ruling was made with the widened survey in front of it, including the two costs named above —
that Base UI ships no colour primitive, and that `vg-194` therefore remains the editor's own work.

What follows for the code:

- **The five menu surfaces do not move.** They already run on Base UI and need no migration at all.
- **The three Radix files do move** — `components/ui/dialog.tsx`, `popover.tsx` and
  `colour-picker.tsx` are re-implemented on Base UI's `Dialog` and `Popover`.
- **`@radix-ui/react-dialog` and `@radix-ui/react-popover` leave the manifest**, and with them the
  22 `@radix-ui/*` packages two components currently pull in. `@base-ui/react` stays.
- **The native `<dialog>`s and the inspector's `<details>` stay native.** They are the platform, not
  a third library, and 0033's tooltip argument still holds for them.

**This is the third ruling on the same question, so the thing to check before acting on any note in
this series is the status line.** 0036 and 0037 are both history; this is the one that binds.
