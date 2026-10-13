# Your feedback list, verified item by item — 2026-09-30

You tested items I had reported as landed and they were not. You were right, and
**verifying them turned up an error of my own that the pass had not caught.**

## The error I made, first, because it is the important one

**"No slider & no clamping" — you are right about the field you complained
about, and my verification tested the wrong field.**

I verified a **Polygon's Sides** field: typed 60, it landed on 32, slider
present, `min=3 max=32`. That was true, and it proved the *mechanism* works. But
your finding was *"took me a while to figure out **blur** only accepts 48
maximum"*, and the **glass blur field passes `min: 0` and no `max`**:

```ts
const blur = numberField({
  label: uiCopy.inspectorFields.glassBlur,
  value: treatment.blurRadius,
  min: 0,                    // ← and no max
```

So it gets **no slider** — `number-field.ts` only adds a range when *both*
bounds are present — and with no upper bound there is **nothing to clamp onto**,
so 60 is still refused rather than landing on 48. **The exact field the finding
names has neither, and has not changed since before the fix.**

`MAX_GLASS_BLUR_RADIUS = 48` has been exported from `renderer-core` all along
and is on the barrel today. **The constant was never the problem — nobody wired
it to the field.** My own brief said the bounded fields were "Sides (3–32) and
glass blur (0–48)" and I never opened `glass.ts` to check the second one had its
ceiling.

**The rule, now written down: verifying that a capability exists is not verifying
that the finding's field has it.** I have now made that mistake twice in one day.

## The items you spot-checked

| your item | verdict | evidence |
|---|---|---|
| **Group context** | **partially met** | Entering a group does make outside objects unselectable — that landed (`56af977`). But **the canvas does not dim them.** The dim is `data-context="false"` in the **layer panel**, with a CSS rule at `editor-shell.css:602`. The canvas dim was *deliberately declined* in that fix, because `opacity` is in Fabric's `stateProperties` and would be serialised into the save. Your standard is the industry one and the reason it was declined is real — so this is a decision to revisit, not an oversight. |
| **Double-click outside a group should exit it** | **not met, and not recorded** | `editor-shell.ts:236` binds `mouse:dblclick` to `enterGroupOnDoubleClick` — enter only. Only Escape leaves. |
| **Slider & clamping** | **not met on glass blur** | as above. The mechanism exists and is proven on bounded fields; the field in the finding is not bounded. |
| **Glass disclosure** | **partially met** | The control renders, is `aria-disabled`, and **focus** reaches the reason — a screen reader gets *"A Line is an open path, so there is no interior to sample the backdrop through."* But **hover does not**: `pointerenter` fires 3 times on the checkbox and no tooltip appears, while **the dock's tooltip, the same control, hovers correctly**. Real, narrow, exactly what you saw. |

## From your earlier list, not landed

| item | state |
|---|---|
| **U14 — a Line needs two end handles plus a rotate handle** | **not landed, but fully recorded** — `41c208d`, with your correction that end handles alone would leave a Line unrotatable. Owner: `controls-manager/renderers.ts`. |
| **Artboard clips the render; selection handles still show in full** | **partially met.** `299c0bf` fixed the artboard clip and paint being *destroyed* on revival, which had let objects paint over the letterbox bars. **Whether selection handles escape the clip I have not tested** — so I am not claiming it. |
| **Asset handling is broken** — its own panel, replace adds instead, inconsistent in the layer list, some unremovable | **not landed, not recorded as a set.** You are right that it is a mess and it is the biggest outstanding structural item. It is now entangled with the asset-ownership spec, which is the right place to take it. |

## Your new list, organised

**Real defects, small and dispatchable**
1. The drag-to-select overlay flashes and vanishes when the mouse *stops* rather than releases
2. Locked vs unlocked icons are hard to tell apart; locked should be a filled lock
3. A locked object should stay selectable in the canvas, just not movable or transformable
4. The dirty guard fires on a freshly opened, untouched theme — something is polluting the dirty state, and your telemetry guess is worth testing

**Real defects, larger**
5. The line chart occasionally slides left as if correcting a position
6. Preview data fluctuates too fast to be realistic, and distracts the author
7. Asset handling (from the old list) — the whole area

**Your decisions, which I will not guess**
8. **The top bar's direction.** File and View are legitimate and findable nowhere else; Edit and Insert duplicate actions that live in their rightful places. *Verdict: make it a real toolbar of icon buttons acting on the theme document.*
9. **The button set.** Save Package → **Activate** (instruct the player to switch to this theme); Release Package → **Export theme**; Open Package → **Import theme**; Open library → **Open**; Save to library → **Save**; add **Save as**; New from starter → **New from template**.
10. **The whole editor UI needs a Base UI + shadcn/ui + Tailwind pass** — panels included — rather than micro-adjustments. **This is the same question as the colour picker, one level up, and it has the same answer:** the ecosystem search was run against Base UI alone, and shadcn/ui was never consulted.

## The honest summary

Of what I reported as landed, **three are partial or wrong** — the slider and
clamp, the glass tooltip on hover, and the group dimming. **One is not recorded
at all** — double-click to exit a group. **One I claimed verified and did not**
— whether selection handles escape the artboard clip.

I verified capabilities where I should have verified findings, twice now. That is
the failure, and it is mine.
