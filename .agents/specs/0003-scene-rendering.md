# 0003 — Scene rendering: plan, mount and sample sources

- **Status:** implemented; the mount layer is being replaced — see
  [0013](0013-fabric-scene-migration.md)
- **Design document sections:** §31, §51, §57, §83, §87, §89, §91, §93, §97, §116, §122, §124, §137, §141
- **Specs superseded:** none

> **Amended by [0013](0013-fabric-scene-migration.md).** The plan/mount split
> below is the reason this migration is tractable, and `plan.ts` survives it
> untouched. What changes is the **Mounting** section: the DOM applier becomes a
> Fabric adapter shared by the editor and the player. Read the two together —
> everything here about plan purity, status-before-value and formatting still
> holds.

## Problem

The chart adapters could each emit an option object and the theme document could
be validated, but nothing turned a document plus live data into a rendered
dashboard. There was also no way to develop or test any of it: the host does not
exist, so there was no source of samples.

## Behaviour

### Two layers, split on testability

| Layer | Decides | Tested by |
|---|---|---|
| `scene/plan.ts` | Everything: geometry, resolved globals, formatted text, chart options, per-frame issues | vitest, in Node |
| `scene/mount.ts` | Nothing — writes a plan to the DOM | Playwright |

The split is the point. Anything that could be *wrong* about a frame is decided
in pure code, so it is unit-testable without a browser; the DOM layer is a dumb
applier. It also satisfies §31 directly: the editor and the player run the same
plan builder, so they cannot drift, and the editor adds interaction rather than
rendering its own scene.

That the applier decides *nothing* is what lets spec 0013 swap it for a Fabric
adapter without touching the tested half.

`buildScenePlan` takes the clock as a parameter and never reads it. Two callers
at the same instant get identical plans.

### Status before value, decided once

§83 is applied in the plan layer rather than per element type:

- A value run whose sample is not `ok` renders `MISSING_VALUE_TEXT` (`—`) and
  carries `status`, so a theme can style a stale reading differently.
- A semantic key with **no sample at all** is a `PlanIssue` with code
  `unmapped-key`. That is a different condition from a `missing` status: nothing
  is mapped, which calls for explicit remapping (§141), not a retry.
- An `ok` sample carrying no value of any type is reported as an error rather
  than rendering an empty box. That combination is a provider bug.
- A binding's `scale`/`offset` apply to **charts as well as text**, so a gauge
  ranged 0–100 can read a 0–1 ratio.

### Formatting

- Explicit `precision` is honoured exactly, trailing zeroes included: §89 asks
  for tabular readouts and a digit count that changes with the value makes a
  readout jitter.
- With no precision, values round to at most one decimal and drop a trailing
  `.0`. A fixed default would be wrong for percentages, temperatures or RPM — at
  least one of the three.
- Unit spacing follows typographic convention: no space before `%` or `°`, one
  space before a word-like unit.
- `unitDisplay: 'long'` falls back to the short symbol rather than inventing a
  name. Long names will come from the sensor catalog (§93).

### Mounting

- One CSS transform on the artboard element (§51). Nothing inside is scaled
  individually, so strokes, glyphs and shadows scale together and nothing
  reflows (§57).
- The host is positioned **only if it is still `static`**. Writing `position:
  relative` unconditionally overrode a host styled `absolute; inset: 0`, which
  collapsed its height to zero and hid the whole scene. The artboard needs *a*
  positioned ancestor, not a specific one.
- Text renders as real `<span>` elements per run — §91 permits a native overlay
  and forbids a bitmap label.
- `update(plan)` writes text and calls `setOption`; nothing is recreated, so
  ECharts keeps its animation state. A plan whose node **ids** differ is
  **rejected**, because a theme switch should not look like an update.
- Only a fixed list of style properties is written. Passing arbitrary keys to
  `element.style` would make the theme format depend on whatever CSS a browser
  happens to accept.

### Sample sources

`SampleSource` is a **pull** interface — `latest(key)` and
`history(key, windowSeconds)`. Pull is what keeps §116 enforceable: a push
interface invites a source that fetches, polls or subscribes, and on the phone
acquisition is exactly what must not happen.

`SampleStore` bounds history by **age and by count**. A time bound is a bound on
age, not on memory; a provider sampling faster than the 1 s baseline would
otherwise grow it without limit on a phone. `reset()` exists for reconnect,
because merging a server backlog into what the client still held would
interleave two timelines.

`@vigilia/fake-source` is a separate package because it fabricates numbers.
Every value is a pure function of `(semanticKey, timestamp)`, which buys
determinism for screenshots, history that is full on the first frame, and one
value shared by every client asking at the same instant. It supports forced
statuses, deterministic outage windows and explicitly unmapped keys, so the
failure paths appear in real frames instead of only in tests.

While it is wired up, the player states on screen that the data is synthetic.
§97 forbids presenting a fabricated reading as real, and a convincing screenshot
is the likeliest way that happens by accident.

## Out of scope

- **The transport.** No SignalR client, no pairing, no theme delivery. The
  renderer only sees a `SampleSource`, so this is a two-line change in
  `main.ts`.
- **Text measurement and font loading** (§89–§91): reserved boxes during font
  load, wrapping, ellipsis and multilingual glyph checks. `TextContent` carries
  `wrap` and `overflow`, but the mount layer only clips.
- **Outlines, dashes and shadows** on any element or chart.
- **Assets.** `image` and `video` nodes plan and mount, but nothing resolves an
  asset ID to a URL yet, so any such node reports `unresolved-asset`.
- **The diagnostics surface.** `PlanIssue`s are logged, not drawn. §141 wants
  remapping surfaced in UI; that UI has not been designed.
- **Editor interaction.** Hit-testing, selection overlays, undo.

## Acceptance

- `scene/plan.test.ts` — geometry defaults, group-local coordinates, style
  resolution and its failure, all text formatting rules, per-family chart data,
  unmapped-key reporting.
- `fake-source/src/demo.test.ts` — the checked-in fixture validates, exercises
  all four families, reports exactly the one deliberately unmapped key, and
  produces a gap during the simulated outage.
- `tests/e2e/display.spec.ts` — browser tests: every node mounts, all four
  families paint non-transparent pixels, the placeholder and status attribute
  appear, the artboard transform behaves at three viewport shapes, and chart
  canvases survive updates.

**Not verified:** no pixel baselines (CI is Linux, development is Windows —
§126's reference hardware decision comes first). `mount.ts` has no unit tests by
design. Nothing has run on a real phone.
