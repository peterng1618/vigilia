# 0039 — The editor UI is React end to end; only the canvas stays imperative

- **Date:** 2026-10-08
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/editor-shell/bridge.ts`,
  `editor-shell/layer-tree.ts`, `editor-shell/shell-layout.tsx`,
  `editor/src/editor-session.ts`, `editor/src/components/ui/`,
  `editor/src/selection-inspector/style.ts`

## The problem

The editor's UI is split by accident rather than by design: 17 surfaces are
React, and the panel family that most of the product's *controls* live in is
imperative DOM built with `document.createElement` — `selection-inspector`
2,714 lines, `asset-manager` 684, `palette-manager` 567, `type-preset-manager`
327, plus the shared `controls/` primitives. The split is invisible until a
design language has to be applied to both halves at once. Then it is the whole
problem: the control vocabulary in `docs/design/design-language.md` §5 has to be
built twice, or the panels have to keep native `<select>`s and
`input type=range` (23 of them) that no stylesheet can bring into the language.

The non-obvious part is not "should we use React" — it is **where the boundary
between React and Fabric sits**, and that is a decision with a wrong answer that
fails invisibly: mirror Fabric objects into React state and the editor develops
two sources of truth for the scene, with the stale one rendering.

## Rung 1 — Vigilia

Searched: `find . -name "*.tsx"` across `packages/editor/src`, and a line count
over the imperative panel families; `shell-layout.tsx`'s menubar; `panelHosts`
mounting in `editor-session.ts:292-388`; `editor-shell/bridge.ts`.

Found: **17 React surfaces already exist** — `shell-layout`, `layer-panel`,
`canvas-dock`, `canvas-context-menu`, `insert-popover`, `palette-menu`,
`pane-bar`, `publish-control`, `qr-symbol`, `save-state`, `shortcut-reference`,
`diagnostic-message`, `display-switch`, `font-picker`, and the three
`components/ui/` primitives. The imperative half is the four panel families
above. **The split already cost us once:** `vg-149` records that Biome lints and
formats no `.tsx` file at all, so the React surfaces were outside both gates
while the imperative ones were inside them — a difference nobody chose.

## Rung 2 — dependencies

Searched: the editor's `package.json` and the workspace manifests; the existing
primitive library in `components/ui/`; the 22 `@radix-ui/*` packages.

Found: `0038` already rules Base UI the editor's one primitive library, and the
dialog and colour picker run on it. **No dependency is added by this decision** —
React 19 is present, Base UI is present, and the imperative panels are the
outlier rather than the React ones.

## Rung 3 — platform

Searched: Fabric 7's `Canvas` class and its React guidance; whether a Fabric
object can be rendered as a React child.

Found: Fabric exposes an imperative canvas that owns its own render loop,
serialization and interaction. It gives nothing that renders an object tree as
elements, and its internal state (`aCoords`, the object cache, `setCoords()`)
is exactly the state a React mirror would go stale on — the failure mode this
repo has already filed twice (`vg-124`'s stale cached boxes, `vg-112`'s
pre-pass `aCoords`). Rung 3 gives no path to a declarative object tree.

## Rung 4 — ecosystem

Searched: `fabric.js` issue **#3192 "Support for React?"**, the maintainer's
position on a React renderer; issue **#5951 "How can I use Fabric.js in
something like React?"**; the current React guidance in Fabric's own README and
core-concepts docs; `fabricjs-document-engine`'s React entry point as a
comparable library's answer.

Found: **the maintainer's answer is no.** Fabric ships no React renderer and
declines to build one — "there is no reason to do that"; the recommended shape
is a canvas initialised once in an effect, made reachable to components, with a
**store beside it** updated from Fabric's own events, components reading the
store. Issue #5951's thread converges on the same architecture from several
independent implementers, and adds the failure mode explicitly: storing fabric
objects in React state is "redundant" and re-renders must be gated. The
comparable library `fabricjs-document-engine` ships exactly this: a
`useFabricCanvas` effect hook, an engine created once, and React components that
read a document *state* (can-undo, save status) rather than the objects.

**The counter-shape is `react-konva`**, which renders canvas objects as React
elements. It works because Konva's node tree is declarative by construction.
Fabric's is not, and adopting react-konva's shape over Fabric is how the two
sources of truth appear.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Keep the split; style both halves | None — the control vocabulary lands twice, or not at all on the imperative half | Low now, unbounded later | The language degrades into two dialects | **Rejected** |
| Render Fabric objects through React (`react-konva` shape) | Wrong primitive; Fabric is imperative by construction | High | Two sources of truth for the scene; the `aCoords` class of defect becomes structural | **Rejected** |
| **React for all UI, Fabric imperative behind the boundary** | Matches upstream's own guidance and the existing 17 surfaces | The panel rewrite (4,518 lines + `controls/`) | Behaviour drift during the rewrite | **Chosen** |

## Rung 6 — probe

Not a spike: the architecture being adopted is the one **the editor already uses
for its React half** — `bridge.ts` projects the live selection on demand and
subscribes for notification, and `CanvasDock` renders from it without holding a
copy. That is the reference implementation, it is in the repo, and it is
already proven by the shell's own tests. The measurement this decision needs is
a behaviour-parity one, and it belongs to the rewrite's acceptance rather than
to this note: the recorded evidence is the panel's existing browser tests, which
must pass unchanged after each panel moves.

## Decision

**Every editor surface is React. The canvas is imperative, and no Fabric object
is ever mirrored into React state.**

The boundary is the one that already exists and already works: React renders UI
and reads a **projected** view of the scene through the bridge; Fabric owns
objects and the render loop; changing a Fabric object notifies the bridge and
React re-reads. The specific reason is not "React is nicer" — it is that the
design language in `docs/design/design-language.md` **is one control set**, and
a control set cannot be built once across two rendering models. Styling the
imperative half would mean either two implementations of every control or a
language that quietly excludes the panels where most of the product's controls
live.

Consequences accepted:

- The panel rewrite is plan-scale, not a phase, and supersedes the panels'
  existing DOM locators where they reach imperative internals.
- `vg-149` ceases to be a quirk and becomes a blocker: Biome must lint and format
  `.tsx` before the rewrite lands, or the newly-React panels sit outside the gate
  the old ones were inside.
- Behaviour does not drift. Same fields, same eligibility gates, same refusals;
  the rewrite replaces rendering, not rules, and the completeness test that pins
  descriptor coverage is what holds that line.
