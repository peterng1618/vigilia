# Architecture

How Vigilia is put together, and **where each concept lives**.

This document exists to answer one question quickly: *does this already have a
home?* AGENTS.md §2 requires that nothing be declared twice and that you search
before adding anything; the [ownership registry](#ownership-registry) below is
what makes that search cheap.

Scope, so this file does not become a fourth copy of something:

| For | Read |
|---|---|
| Commands, traps, conventions | [`../AGENTS.md`](../AGENTS.md) |
| What a feature is *supposed* to do | [`../.agents/specs/`](../.agents/specs/) |
| Why a decision was made | [`decisions.md`](decisions.md) |
| Current state, what is next | [`handoff.md`](handoff.md) |
| What the product should do | [`design/plan.md`](design/plan.md) — goals from the user, the rest agent-owned |

---

## 1. The shape

One npm workspace at `src/web/`, five packages, TypeScript throughout — and
nothing else. The C# tree was deleted on 2026-09-13 (see
[`decisions.md`](decisions.md)); there is no second toolchain.

```text
                        ┌───────────────────────┐
                        │   renderer-core       │  the shared library
                        │   types · protocol    │  owns every shape both
                        │   semantic-keys       │  ends read
                        │   theme/ · scene/     │
                        └───────────┬───────────┘
                    ┌───────────────┼───────────────┐
                    │               │               │
              ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
              │   host    │   │  player   │   │  editor   │
              │ Node CLI  │   │ phones    │   │ desktop   │
              └─────┬─────┘   └─────▲─────┘   └───────────┘
                    │  SSE, §111    │
                    └───────────────┘
                         fake-source  (dev/test only — never shipped)
```

**`renderer-core` is the only package two others may share a concept through.**
If the host and a display both need to know something, it goes there. Defining
it in one and reading it in the other is the C#/TypeScript mirror rebuilt —
the exact thing ADR-0007 removed.

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

Three, each with a mechanical guard rather than a convention.

| Boundary | Rule | Enforced by |
|---|---|---|
| **Pure ↔ DOM** | The pure half decides; the DOM half draws and decides nothing | Unit tests exist only for the pure half; a decision in the DOM half is untestable without a browser, which is the tell |
| **Player ↔ editor** | `renderer-core` and `player` must not depend on editor UI or a component framework | `packages/player/scripts/check-size.mjs` fails the build |
| **Shared ↔ local** | A concept two packages read lives in `renderer-core` | Review, plus the registry below |

The pure/DOM split is repeated deliberately at every layer:

| Layer | Decides | Draws / does I/O |
|---|---|---|
| Renderer | `scene/plan.ts` | `scene/mount.ts` |
| Editor | `geometry` `hit-test` `selection` `snapping` `transform-gesture` `commands` `history` `arrange` `actions` `keyboard` `resize-children` | `overlay.ts`, the panels, `main.ts` wiring |
| Host | `cli/args` `serve/static-path` `transport/keep-latest` `providers/registry` and the `providers/os` arithmetic | `net.ts` `server.ts` `sse.ts` `main.ts` |

Gesture maths in the overlay, a decision in `mount.ts`, and path-safety logic
inline in a request handler are all the same mistake, and they fail the same
way.

## 4. Ownership registry

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
| What a click selects | `editor/src/hit-test.ts`, `selection.ts` |
| What a drag does to a transform | `editor/src/transform-gesture.ts` |
| Group resize → children | `editor/src/resize-children.ts` |
| What undo restores | `editor/src/history.ts` |
| Document edits | `editor/src/commands.ts`, `arrange.ts` |
| **Every editor action** — label, shortcut, glyph, enablement | `editor/src/actions.ts` |
| What a focused control keeps | `editor/src/keyboard.ts` |
| **Node display label fallback** | `editor/src/node-label.ts` (`nodeLabel`) |
| **Editor panel chrome and button styles** | `editor/src/button.ts` (`createButton`, `buttonStyle`, `inputStyle`, `sectionHeadingStyle`); colour tokens in `editor/index.html` CSS variables |
| **Layer panel tree projection** | `editor/src/layers-model.ts` (`buildLayerTree`) |
| **Which entity may carry which property** | `renderer-core/src/theme/capabilities.ts` — the spec 0011 matrix, keyed by `NodeType` so a new type is a compile error |
| **Style property vocabulary** | same file — `STYLE_PROPERTIES`, `isKnownStyleProperty`; validator rejects unknown names and schema-sync tests bind the schema enum to this owner |
| Inspector field types and ranges; numeric parsing | `editor/src/inspector-model.ts` |
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

## 5. Patterns worth copying

1. **Providers acquire; the host schedules.** A provider never starts a timer,
   caches history, or pushes. That is what makes "a second phone must not double
   upstream polling" a property of one scheduler instead of a hope about every
   provider.
2. **Themes bind to semantic keys, never to provider instances** (§93), so
   changing what supplies a quantity never edits a theme.
3. **Typed chart settings only.** Raw ECharts options never enter the theme
   format. There is exactly one engine-boundary cast, in
   `player/src/main.ts` — if that cast appears in feature code, the boundary has
   been breached.
4. **Two sensor tiers**, discovered and reported, never hardcoded (ADR-0004).
5. **Declare, then generate.** `actions.ts` declares each action once and the
   keyboard, toolbars and menus generate from it. The alternative — a surface
   per copy — produced tooltips that disagreed with their own bindings.
6. **Refuse rather than coerce.** A numeric control reports `''` for anything it
   cannot parse, and `Number('') === 0`, so coercion committed zeros that made
   elements vanish. `parseNumeric` refuses; `validity.badInput` distinguishes
   garbage from a deliberate clear.

## 6. What the tests actually cover

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
