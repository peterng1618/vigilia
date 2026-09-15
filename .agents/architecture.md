# Architecture

How Vigilia is put together, and **where each concept lives**.

This document exists to answer one question quickly: *does this already have a
home?* AGENTS.md's one-owner rule requires that nothing be declared twice and
that you search before adding anything; the [ownership
registry](#ownership-registry) below is what makes that search cheap.

Scope, so this file does not become a fourth copy of something:

| For | Read |
|---|---|
| Commands, traps, conventions | [`../AGENTS.md`](../AGENTS.md) |
| What a feature is *supposed* to do | [`../.agents/specs/`](../.agents/specs/) |
| Why a decision was made | [`decisions.md`](decisions.md) |
| Current state, what is next | [`status.md`](status.md) |
| What the product should do | [`design/plan.md`](design/plan.md) — goals from the user, the rest agent-owned |

---

## 1. The shape

One npm workspace at `src/web/`, six packages, TypeScript throughout — and
nothing else. The C# tree was deleted on 2026-09-13 (see
[`decisions.md`](decisions.md)); there is no second toolchain.

```text
                        ┌───────────────────────┐
                        │   renderer-core       │  the shared library
                        │   types · protocol    │  owns every shape both
                        │   semantic-keys       │  ends read
                        │   theme/ · scene/     │  NO fabric — the host is here
                        └───────────┬───────────┘
                    ┌───────────────┤
                    │               │
              ┌─────▼─────┐   ┌─────▼──────────┐
              │   host    │   │  scene-fabric  │  fabric/es · chart objects
              │ Node CLI  │   │  the applier   │  the ScenePlan → canvas half
              └─────┬─────┘   └───────┬────────┘
                    │           ┌─────┴─────────┐
                    │           │               │
                    │     ┌─────▼─────┐   ┌─────▼─────┐
                    │     │  player   │   │  editor   │
                    │     │ phones    │   │ desktop   │
                    │     └─────▲─────┘   └───────────┘
                    │  SSE, §111 │
                    └────────────┘
                         fake-source  (dev/test only — never shipped)
```

**`renderer-core` is the only package two others may share a concept through.**
If the host and a display both need to know something, it goes there. Defining
it in one and reading it in the other is the C#/TypeScript mirror rebuilt —
the exact thing ADR-0007 removed.

**`scene-fabric` exists to keep Fabric away from the host.** The host imports
runtime values from `renderer-core`'s barrel and runs in Node, so a Fabric
import reachable from there would put a browser scene graph in the host bundle.
Splitting the applier into its own package makes that boundary *structural* —
there is no dependency edge from `host` to `scene-fabric`, so no import
carelessness can create one. Verified: the host bundle stayed at 34.36 kB after
Fabric was added to the workspace.

## 2. Data flow, end to end

```text
node:os ──► OsSensorProvider.sample()      providers acquire, never schedule (§116)
              │
              ▼
        ProviderRegistry                   one poll per cycle for the UNION of
              │                            keys active displays need (§111)
              ▼
        SampleBatch  (protocol.ts)         versioned; an old client meets a
              │                            clear refusal, not a misparse (§141)
              ▼
        SSE  /ws?keys=…                     push-only, keep-latest for slow
              │                            clients (§122)
              ▼
        createLiveSource ──► SampleStore    bounded buffer, pull interface
              │
              ▼
        plan.ts   (pure — decides everything)
              │
              ▼
        mount.ts  (DOM — decides nothing)
```

Two rules this flow exists to enforce:

- **Status before value.** A non-`ok` sample carries no value, and a missing one
  renders as a **gap, never a zero** (§83). No layer may substitute a default.
- **Never fabricate.** `fake-source` is dev-and-test only and says so on screen.
  A display chooses its source explicitly (`?data=live`); it never falls back to
  synthetic data when the host dies, because a dashboard that quietly invents
  numbers is indistinguishable from one that works (§97).

## 3. Boundaries

Four, each with a mechanical guard rather than a convention.

| Boundary | Rule | Enforced by |
|---|---|---|
| **Pure ↔ DOM** | The pure half decides; the DOM half draws and decides nothing | Unit tests exist only for the pure half; a decision in the DOM half is untestable without a browser, which is the tell |
| **Player ↔ editor** | `renderer-core`, `scene-fabric` and `player` must not depend on editor UI or a component framework | `packages/player/src/boundaries.test.ts` fails on an editor specifier, on bare `fabric` and on the interactive `Canvas`. `check-size.mjs` is the backstop, not the guard — it has ~199 KB of slack |
| **Host ↔ browser** | The host must not reach a browser scene graph | No dependency edge from `host` to `scene-fabric`; `renderer-core` stays fabric-free |
| **Shared ↔ local** | A concept two packages read lives in `renderer-core` | Review, plus the registry below |

The pure/DOM split is repeated deliberately at every layer:

| Layer | Decides | Draws / does I/O |
|---|---|---|
| Renderer | `scene/plan.ts` | `scene/mount.ts` |
| Editor | `geometry` `hit-test` `selection` `snapping` `transform-gesture` `commands` `history` `arrange` `actions` `keyboard` `resize-children` | `overlay.ts`, the panels, `main.ts` wiring |
| Host | `cli/args` `serve/static-path` `transport/keep-latest` `providers/registry` and the `providers/os` arithmetic | `net.ts` `server.ts` `sse.ts` `main.ts` |

The editor row is the list [spec 0013](specs/0013-fabric-scene-migration.md)
shortens: `geometry`, `hit-test`, `transform-gesture`, `overlay` and
`resize-children` are generic graphics editing that Fabric owns, and
`scene/mount.ts` becomes a Fabric adapter both displays import. `plan.ts` and
everything in the Decides column that is Vigilia's — commands, history, arrange,
actions, keyboard — stays exactly where it is. **The pure/DOM discipline is not
what changes; who implements the drawing half is.**

Gesture maths in the overlay, a decision in `mount.ts`, and path-safety logic
inline in a request handler are all the same mistake, and they fail the same
way.

### Blast radius, in order

Which files radiate furthest when changed. Worth knowing before touching one,
and worth saying explicitly that the first is *not* the most dangerous — it is
the most far-reaching, and the compiler catches it.

1. `renderer-core/src/types.ts` and `data/protocol.ts` — the sample and wire
   contracts, single-sourced and imported by the host, both displays and the
   editor. Compiler-checked, so a break is loud.
2. `schema/theme-document.schema.json` — the persisted format, with real saved
   files behind it. Themes already saved must keep loading; bump
   `schemaVersion` and fail unsupported versions rather than quietly migrating
   (§141). `theme/schema-sync.test.ts` binds this file to the validator.
   **A Fabric major upgrade now belongs in this row**: the node tree is stored
   in Fabric's object format, so its serialiser is part of the persisted
   contract and bumping it is a schema migration (§134).
3. `renderer-core` as a whole — shared by editor *and* player, so a stray
   dependency here breaks the player's size budget (§47).
4. `host/src/providers/provider.ts` — the provider contract, and every provider
   behind it.

**A shape both ends read lives in the shared library**, never in one end with a
reader in the other. That arrangement was once a hand-mirrored C#/TypeScript
pair where a change compiled cleanly on both sides and produced wrong values at
runtime; the host is TypeScript now and imports the types directly, so the
defect class has nowhere left to live. Do not rebuild it by declaring a message
shape in `packages/host` and its reader in a display.

## 4. Editor module conventions

The editor is organised as **one manager per domain behind a composition root**
(ADR: *the editor is a manager architecture over the renderer*). The rules below
are what make that shape hold; they apply to `packages/editor` and are worth
copying anywhere else that grows a second stateful surface.

### The manager contract

Every manager is one class in `src/<domain>/index.ts`:

```ts
export class SelectionManager {
  public readonly editor: EditorCore;
  constructor({ editor }: { editor: EditorCore }) { … }
  public destroy(): void { … }
  private _bindEvents(): void { … }
}
```

- **Uniform construction.** `new XManager({ editor })` — an object literal, never
  positional arguments. New APIs follow suit; existing pure functions keep their
  signatures rather than being churned.
- **Peers at runtime, types at compile time.** Reach a peer as
  `this.editor.selection`; import the root as `import type`. A manager that
  imports a peer's *class* has created a cycle the next refactor pays for.
  Shared **contracts** may be imported directly; implementations may not.
- **Sub-controllers get a narrowed bag.** A controller receives
  `{ dependencies: { … } }` listing what it actually uses, not the root, so it
  unit-tests without an editor. Where construction order forbids resolving a
  peer eagerly, pass a lazy `resolveX: () => this.editor.x` thunk and make the
  cycle explicit.
- **`destroy()` mirrors construction**, and order is structural: managers are
  listed once in `core/registrations.ts`, `init()` walks that table forward and
  `destroy()` walks it in reverse. The table is keyed by a union of manager
  names, so adding a manager without registering it is a compile error — there
  is no second list and no order test to drift.
- **Events, not callbacks.** Managers emit through `core/events.ts`'s typed map;
  the UI subscribes. A panel redraws because something it draws changed, not
  because a caller remembered to ask.

### Three kinds of state, never confused

Every change must say which of these it touches, in code and in its tests:

| Kind | Lives in | Example |
|---|---|---|
| **Persisted** | the `ThemeDocument`, reachable only through `DocumentManager` | a node's transform |
| **Derived** | computed on demand from persisted state | a layer tree, an enablement snapshot |
| **Transient** | private on the manager owning the interaction | the live drag, snap guides, a marquee |

Transient state that reaches the document is the defect this taxonomy exists to
catch; it survives an undo and cannot be explained.

### Folder roles

A manager large enough to split uses **role folders**, named for what the code
*is*, never for what bucket it fell into:

`domain/` the shape of the thing, lookup, invariants · `mutation/` public
changes and the commit pipeline · `gesture/` live interaction · `layout/` sizes
and placement · `events/` subscriptions and routing · `lifecycle/` creation and
teardown.

**`helpers/`, `common/`, `utils/`, `internal/` and `shared/` are not used.** If a
generic word is the only name that fits, the file's role has not been decided
yet. Do not leave re-export wrapper files behind after a move, and do not add a
barrel to shorten an import — import from the file that owns the thing. The one
sanctioned barrel is a package's public surface (`editor/src/index.ts`).

### Filename vocabulary

The suffix says why the file exists, so a tree reads as a design:

| Suffix | Means |
|---|---|
| `factory` | creates one object |
| `pipeline` | assembles the whole next state before anything is applied |
| `commit` / `apply` | applies an already-prepared result |
| `controller` | owns one area of behaviour |
| `session` | holds the transient state of a single gesture |
| `reference` | resolves a target — by id, by selection, by hit |
| `runtime` | restores invariants after create, clone or load |
| `model` | projects state into what a surface draws |

### Size

**500 lines is a signal, 800 is a stop.** A file over 500 should be re-read for
a second responsibility; one at 800 may not grow further without being split. A
test enforces the ceiling with an explicit allowlist. The ceiling exists because
`main.ts` reached 1,349 lines holding nine unrelated concerns and nothing
objected.

Measured 2026-09-14, only two files are over 800: `editor/src/main.ts` (1,349 —
the subject of the restructure) and `renderer-core/src/theme/validate.ts`
(1,138). **Prefer splitting to allowlisting** — an entry on that list should
have to argue for itself, and "the format it validates is large" is an argument
for `validate/` role files, not for an exception. `scene/mount.ts` (767) and
`scene/plan.ts` (687) are over the signal and under the stop: worth re-reading,
not worth splitting today.

### Where this does *not* apply

`renderer-core` is stateless — pure functions plus one `mountScene`. It has no
interactions, no lifecycle and no cross-domain mutable state, so it has nothing
for a manager to own, and wrapping its modules in classes would be the pattern
worn as costume. What applies there is everything in this section *except* the
manager contract: the size ceiling, the folder roles, the filename vocabulary,
the ban on re-export facades, and one owner per concept.

## 5. Ownership registry

**Search here first.** Each row is a concept with exactly one home. If what you
are about to add resembles a row, import it instead.

### Shapes and contracts

| Concept | Owner | Read by |
|---|---|---|
| Sample, status, sensor shapes | `renderer-core/src/types.ts` | host, displays, editor |
| Theme document shape | `renderer-core/src/theme/document.ts` | everything |
| Persisted format | `schema/theme-document.schema.json` | guarded against the validator by `theme/schema-sync.test.ts` |
| Wire frame, event name, stream path, version | `renderer-core/src/data/protocol.ts` | host **and** displays |
| Semantic key vocabulary, `SensorTier` | `renderer-core/src/data/semantic-keys.ts` | host providers, editor pickers |
| Schema version | `document.ts` `SUPPORTED_SCHEMA_VERSION` | validator |
| Provider contract | `host/src/providers/provider.ts` | every provider |

### Rules and decisions

| Concept | Owner |
|---|---|
| Is a sample plottable (§83) | `types.ts` `hasPlottableValue` |
| Node placement, matrices, bounds | `editor/src/geometry.ts` |
| What a click selects | `editor/src/selection/domain/hit-test.ts`, `selection/domain/selection-state.ts` |
| What a drag does to a transform | `editor/src/transform-gesture.ts` |
| Group resize → children | `editor/src/resize-children.ts` |
| What undo restores | `editor/src/document/history.ts` |
| Document edits | `editor/src/commands.ts`, `arrange/commands.ts` |
| **Every editor action** — label, shortcut, glyph, enablement | `editor/src/actions.ts` |
| What a focused control keeps | `editor/src/keyboard.ts` |
| **Node display label fallback** | `editor/src/node-label.ts` (`nodeLabel`) |
| **Editor panel chrome and button styles** | `editor/src/button.ts` (`createButton`, `buttonStyle`, `inputStyle`, `scrollAreaStyle`, `sectionHeadingStyle`); colour tokens in `editor/index.html` CSS variables |
| **Layer panel tree projection** | `editor/src/layers/tree.ts` (`buildLayerTree`) |
| **Scene graph, hit testing, transforms, controls** | `fabric` (7.4.0), consumed **only** via `fabric/es`, and only from `packages/scene-fabric`. Migrating; until then `editor/src/geometry.ts` and friends |
| **A chart as a scene object** | `scene-fabric/src/chart-object.ts` (`VigiliaChart`) — owns the detached canvas, the ECharts instance, invalidation and disposal |
| **What a chart object persists** | same file — `CHART_SERIALISED_KEYS`, and `toObject` is derived from it so the two cannot drift |
| **The engine-option cast** | `renderer-core/src/charts/engine-option.ts` (`toEngineOption`) — the only `as unknown as EChartsCoreOption` in the codebase |
| **`ScenePlan` → Fabric objects** | `scene-fabric` — one owner, imported by editor *and* player. Not written yet (stage 2) |
| **Player import boundary** | `player/src/boundaries.test.ts` — `fabric/es` only, no interactive `Canvas`, no editor specifier |
| **Which entity may carry which property** | `renderer-core/src/theme/capabilities.ts` — the spec 0011 matrix, keyed by `NodeType` so a new type is a compile error |
| **Style property vocabulary** | same file — `STYLE_PROPERTIES`, `isKnownStyleProperty`; validator rejects unknown names and schema-sync tests bind the schema enum to this owner |
| Inspector field types and ranges; numeric parsing | `editor/src/inspector/model.ts` |
| URL path safety, mount trailing slash | `host/src/serve/static-path.ts` |
| Slow-client policy | `host/src/transport/keep-latest.ts` |
| CLI flags | `host/src/cli/args.ts` |
| Build/typecheck project list | `src/web/package.json` workspaces — via `npm run build` / `npm run typecheck`, never a hand-written list |

### Known gaps — concepts with **no** owner yet

Recorded honestly, because an unrecorded gap becomes a duplicate. Fix the owner
before building anything that would add another copy.

| Concept | Currently spelled in | Why it matters |
|---|---|---|
| New-node defaults | nowhere | The add-element UI needs "what does a new rect/text start with". `capabilities.ts` is where it belongs, so this is now a small addition rather than a sixth copy |
| `?keys=` and `?data=live` handshakes | host route **and** display client, independently | Rename either side and the display shows gaps forever, or silently shows fabricated data |
| Hex colour parsing | `charts/fill.ts`, `inspector-panel.ts`, `globals-panel.ts` | Already divergent: `#0cf` renders correctly but shows black in the inspector |
| Asset path safety | `document.ts` pattern, `validate.ts`, `assets.ts` | Already divergent on `.`; blames the author for the wrong thing |
| Shortcut prose | `actions.ts` **and** `packages/editor/index.html`'s banner | The banner lies the moment anything is rebound |
| Theme enums (`fitMode`, asset `kind`, `unitDisplay`, …) | schema + `document.ts` union + `validate.ts` array, unguarded | A value added to two of three is rejected on import with a misleading error |
| Licence check | CI greps a fixed list of three names | Four real dev dependencies have no notice entry and CI is green |
| **What a stale reading looks like** | `mount.ts` writes `data-status` and lets CSS decide | A Fabric scene has no CSS hook, so something must own the decision instead of deferring it |

## 6. Patterns worth copying

1. **Providers acquire; the host schedules.** A provider never starts a timer,
   caches history, or pushes. That is what makes "a second phone must not double
   upstream polling" a property of one scheduler instead of a hope about every
   provider.
2. **Themes bind to semantic keys, never to provider instances** (§93), so
   changing what supplies a quantity never edits a theme.
3. **Typed chart settings only.** Raw ECharts options never enter the theme
   format. There is exactly one engine-boundary cast, `setOption(… as unknown as
   EChartsCoreOption)` at `renderer-core/src/scene/mount.ts:474` — if that cast
   appears in feature code, the boundary has been breached. (This file and
   AGENTS.md both named `player/src/main.ts` until 2026-09-15, which has no cast
   in it; a rule pointing at the wrong file cannot be checked.)
4. **Two sensor tiers**, discovered and reported, never hardcoded (ADR-0004).
5. **Declare, then generate.** `actions.ts` declares each action once and the
   keyboard, toolbars and menus generate from it. The alternative — a surface
   per copy — produced tooltips that disagreed with their own bindings.
6. **Refuse rather than coerce.** A numeric control reports `''` for anything it
   cannot parse, and `Number('') === 0`, so coercion committed zeros that made
   elements vanish. `parseNumeric` refuses; `validity.badInput` distinguishes
   garbage from a deliberate clear.

## 7. What the tests actually cover

Worth knowing before trusting a green run:

- **Unit tests** cover the pure halves, and that is where a logic break shows
  up first.
- **Browser tests preview the built bundles directly, on their own ports. They
  never exercise the host.** A serving bug — a mount prefix, an asset path, a
  redirect — is invisible to a fully green gauntlet. The editor once shipped
  unable to boot through the host with all five checks passing.
- **There is no HTTP test of the host at all.** Its whole route surface is
  unexecuted by CI.
- **No pixel baselines.** Assertions are structural on purpose: CI is Linux,
  development is Windows, glyph rasterisation differs. Committed screenshots are
  *evidence*, not baselines.
