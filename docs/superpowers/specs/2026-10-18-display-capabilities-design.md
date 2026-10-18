# Display capabilities — design

- **Status:** design for review, 2026-10-18. **Not queued**, no plan, and not
  approved for one. It cannot be built before the per-display plan's Phase 1.
- **Register:** no row. Nothing here is a defect against shipped behaviour.
- **Depends on:** `2026-10-18-per-display-themes-design.md`, whose Task 4.1
  creates `host/src/settings/displays.ts`. Until that lands there is no display
  record to hang a capability on.

## What this is, and is not

**It is** the answer to one question — *what can this display render, and who
decides?* — so that a display which cannot do something degrades by a single
rule instead of every feature growing its own branch.

**It is not** a device driver layer, and it is not panel support. A panel
becomes **expressible and assignable** under this model and remains
**undriven**: the host has still never drawn a pixel
(`2026-10-18-turzx-panel-displays-design.md`). If this spec reads as "panels
work now", it has failed.

**Two approaches were considered and are deliberately not taken.** A
`DisplayDriver` interface with `capabilities()` / `present(frame)` /
`geometry()` is the fuller decoupling, and it is the natural next step — but it
forces the host to own a renderer, which is the entire panel project, so today
it is scaffolding for a device that does not exist. The trigger to build it is
**a panel being approved**, not this design landing. Degrading by transforming
the scene at mount (a video object becoming a still object) is elegant and
walks toward a second scene tree, which the guardrails forbid.

## The model

**A capability is one boolean per feature a theme can cost.** The vocabulary
already exists: `performanceCostsOf(envelope)` returns `PerformanceCost`, which
is `"glass-over-video" | "video-background"` today. The two features named in
the original request are those two.

```ts
export type DisplayCapabilities = Readonly<Record<PerformanceCost, boolean>>;
```

Keying by the existing union rather than by a fresh string list is deliberate:
the record is total, so **adding a third `PerformanceCost` breaks the build
until every profile and every reader declares it**. The one-owner rule is
enforced by the compiler rather than by review.

**Off does not mean absent. It means the static rendering of that feature, with
the composition untouched.**

- `video-background: false` → the first frame, as a still image.
- `glass-over-video: false` → glass sampled once, and never repainted.

That split is what keeps ownership clean: **the theme decides what is in the
composition; the display decides how much of it animates.** A consumer who
wants no background removes it in the editor, where that decision belongs.

**The profile carries three states, and the renderer carries two.** The wall
did not disappear when the rendering ladder collapsed to on/off; it moved into
the profile, where it is a different axis:

```ts
/** What a display offers, and whether the choice is the consumer's. */
export type FeatureOffer = "default-on" | "default-off" | "unavailable";

export interface DisplayProfile {
  readonly id: string;
  readonly label: string;
  readonly offers: Readonly<Record<PerformanceCost, FeatureOffer>>;
}
```

- `default-on` / `default-off` — the best configuration for a known model,
  set as its default and changeable by the consumer either way.
- `unavailable` — physically cannot, so it cannot be changed. The surface shows
  it disabled **with the reason**, never hidden: a consumer who cannot find the
  setting cannot learn why it is absent.

`unavailable` and `default-off` are both "off" at paint time, so the renderer
sees one boolean and the wall is expressible only where it belongs.

**A display the host has no profile for is permissive**: every feature
`default-on`, so a client nobody has characterised behaves exactly as it does
today. Unknown is the common case rather than the edge — a browser is not a
model, and nothing identifies one — so this is the path almost every display
takes, and the table's real content arrives with panels.

## One rung of the ladder is already built

`glass-over-video: false` needs no new code. `background-media.ts` already
guards on the element type, and its own comment says why:

```ts
// background-media.ts, abridged to the guard that matters
if (!(element instanceof HTMLVideoElement) || onFrame === undefined) return;
```

Mount an `<img>` instead of a `<video>` and `followFrames` returns `undefined`,
so nothing subscribes and the glass never repaints — *"sampled once and that's
it"* is the behaviour that already exists for a still background.
`BackgroundMediaOptions.onFrame`'s own comment states it: *"Nothing subscribes
unless a video is the media, so an image background starts no loop at all."*

**So the whole of the feature is one choice of element, and the glass
degradation is free.** Only the background needs code, and only to pick between
two `document.createElement` calls.

## A deliberate wrinkle, recorded so nobody "fixes" it

`glass-over-video: false` while `video-background: true` means the glass holds
a frozen backdrop while the video moves behind it. That is exactly the state
`followFrames`'s comment calls a bug — *"the glass keeps a still frame of a
moving background"*. Here it is a **chosen cheap mode**, and the spec says so
because a later reader will otherwise read it as a regression.

## Where each piece lives

| Piece | Where | Note |
|---|---|---|
| `FeatureOffer`, `DisplayProfile`, `resolveDisplayFeatures` | `host/src/settings/display-features.ts` (create) | Pure, no DOM |
| The known-model table | `host/src/settings/display-profiles.ts` (create) | Constants, not a store |
| A display's own choices | `host/src/settings/displays.ts` | The record Task 4.1 creates |
| The one bit the player acts on | `scene-fabric/src/background-media.ts` | One new `BackgroundMediaOptions` member |
| The toggles | `library.html`, `settings.html`, `theme-list.js` | The display column Task 4.3 adds |

**The resolver is in the host, not `renderer-core`**, and that is a revision
made while writing this: `renderer-core` owns `PerformanceCost` — what a *theme*
costs — and the host owns displays. The intersection of the two is the host's
question, and putting it there keeps one owner per concept, avoids a second
concept in a Fabric-free theme package, and costs one fewer decision note.
`PerformanceCost` is imported, not redefined.

**`scene-fabric/src/background-media.ts` is a watchlisted path**, so its first
write needs a decision note claiming it (`docs/decisions/NNNN-*.md`), and the
seven reuse rungs recorded. `host/src/settings/` is not watchlisted.

## The flow

A display record stores **only deviations from its profile**, exactly as
`theme-answers.json` stores only the answers where a theme differs from
`devices.json`. A default is free; a deviation is explicit.

```ts
export function resolveDisplayFeatures(input: {
  readonly costs: readonly PerformanceCost[];
  readonly profile: DisplayProfile;
  readonly chosen: Readonly<Partial<Record<PerformanceCost, boolean>>>;
}): DisplayCapabilities;
```

For each cost the theme asks for: `unavailable` → `false`; otherwise the
consumer's choice, else the offer's default. A feature the theme does not cost
is not in the result at all.

The result rides `/api/themes/active` beside the theme, which already carries
the costs that Task 4.8 reads from the envelope. The player derives one value —
`background: "video" | "still"` — and hands it to `mountFabricScene` →
`mountBackgroundMedia`.

**The host resolves rather than the player** because that gives one
implementation, and a panel later reads the same value from the same place.
That is the whole point of one model: the second reader costs nothing.

## Acceptance

1. A display whose profile offers `video-background: unavailable` renders a
   still first frame and never mounts a `<video>`.
2. A display with `video-background: false` chosen by the consumer does the
   same, and its glass is sampled once.
3. A theme that does not cost a feature is unaffected by that feature's
   setting, and no toggle for it is shown.
4. `unavailable` cannot be turned on from any surface, and is shown disabled
   with its reason rather than hidden.
5. An unknown display resolves to every feature on, so nothing changes for a
   client the host has no profile for.
6. A browser proof names the display it ran on and shows the background
   actually still across frames, not merely that an `<img>` was mounted.

## Testing

- **Pure, in the host.** `resolveDisplayFeatures` against the four cases that
  decide it: an offer's default, a consumer deviation, `unavailable` ignoring a
  deviation, and a cost the theme does not ask for. This is the whole decision
  and it needs no DOM.
- **DOM, in `scene-fabric`.** `background-media.dom.test.ts` already exists and
  is where the element choice is proved: with `"still"`, the mounted element is
  an `<img>` and `onFrame` is never called after mount; with `"video"`, it is a
  `<video>` and frames follow. **The test must fail when the choice is
  disabled** before it is trusted.
- **Visible, in the browser.** Per the evidence rules a rendered check is
  required, not an element count: the artboard shows the video's first frame
  and the pixels are identical across two samples. Screenshots are evidence,
  not goldens.
- **The toggle surface** gets a DOM test for the disabled-with-reason state,
  because that is the one place the wall is visible to a consumer.

## Open questions

1. **Does a phone actually struggle?** The whole present-day motivation is that
   a video background plus glass is expensive on a phone, and **nothing has
   measured it**. If it does not struggle, this design has no present-day user
   and belongs with the panel work instead. This is the first thing to settle,
   and it is a measurement rather than a decision.
2. **What is a display "known" by?** The per-display spec identifies a display
   by `kind` and, for a local monitor, a `MonitorHint`. Neither names a model.
   A panel would be known by VID/PID; a browser is not a model at all. So
   `display-profiles.ts` has **exactly one useful row today** — a browser, all
   features `default-on` — and its real content arrives with panels. Whether the
   table should exist before it has a second row is a fair question.
3. **Is `chartFps` a capability?** The per-display spec already gives a display
   a repaint cadence. A cadence is not a boolean and does not fit this model, so
   it stays where it is — but the two are both "what this display can afford",
   and a later reader will ask why one is a toggle and the other a number.
4. **What happens to a theme's cost warning now?** The per-display spec puts a
   cost warning on the host's theme row. A display that has switched a feature
   off no longer pays that cost, so the warning and the toggle can disagree.
   Neither this design nor that one resolves it.

## Not verified

- **That any display differs from any other today.** Every display this product
  has is a browser, and every browser does video and glass. The model has no
  observable effect until a profile says `unavailable` or a consumer flips a
  toggle, and the phone case in open question 1 is assumed rather than measured.
- **That the still-frame path renders the first frame.** It renders whatever
  the `<img>` decodes to, and nothing here establishes that an `<img>` sourced
  from a video file shows frame 1 rather than failing or showing nothing. That
  is a property of the browser and the format, and it must be proved in the
  visible test before acceptance item 1 is claimed.
- **That `Record<PerformanceCost, boolean>` is the right key.** It assumes the
  two features stay the whole vocabulary. A capability that is not a theme cost
  — a repaint cadence, a colour depth — has no place in it.

## The reuse gate has not been run

**Required before the first write**, for `scene-fabric/src/background-media.ts`
and for whatever the host files turn out to touch. What is already known, and
what is not:

- **Rung 1, owner: partly discharged.** The behaviour exists —
  `followFrames`'s guard and `BackgroundMediaOptions.onFrame` are the mechanism,
  and `PerformanceCost` is the vocabulary. This design adds a choice between two
  existing branches rather than a new rendering path.
- **Rung 2, dependencies: discharged.** No new dependency. The change reads an
  option that is already passed down.
- **Rung 3, platform: discharged for the still path, not for the first frame.**
  An `<img>` over a video file is native. That it shows the *first frame* is the
  unverified claim above.
- **Rungs 4 and 5, ecosystem and comparison: not run.** Whether anyone has
  modelled per-display capability degradation, and what they learned, has not
  been searched.
- **Rung 6, probe: not run.** The visible test is the probe, and it has not
  been taken.
- **Rung 7, build: not applicable yet.** Nothing is being built.
