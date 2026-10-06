# 0029 — A persistent host is moved into its slot, not rendered into it

- **Date:** 2026-10-07
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/editor-shell/shell-layout.tsx`

## The problem

The shell's chrome is React; the panels are not. `createShellLayout` builds seven
bare `HTMLElement`s outside React — `element()` and two `document.createElement`
calls, `shell-layout.tsx:414–423` — hands them out as `ShellLayout.hosts`, and a
non-React module fills each one: `EditorSession`'s constructor mounts the
artboard, palette, type-preset, selection, style, new-object and asset panels
into them (`editor-session.ts:292, 317, 332, 352, 387, 406, 446`), and
`editor-main.ts` writes the status text and appends its `<input type="file">`
picker into `hosts.status` / `hosts.canvas` (`editor-main.ts:111, 127`). Those
panels are long-lived and hold DOM state: a scrolled list, a focused field, a
Fabric canvas child, a live file input.

The shape is not "a panel". It is **a long-lived DOM subtree, created outside
React, whose position in the React tree changes with UI state, and which must not
be remounted when it moves** — moving it is the point; rebuilding it loses the
scroll, the focus and everything else the DOM was holding. React's `createPortal`
points the other way: it renders *React's* children into a foreign node. Here the
node is the foreign thing being moved *into* React's tree.

Two implementations of that one idea sit in the same file and this note has to
account for both: `Host` (a component, `shell-layout.tsx:66–82`, used by six
hosts) and the dock's inline `ref` callback with `replaceChildren`
(`shell-layout.tsx:555–564`).

## Rung 1 — Vigilia

Searched: `shell-layout.tsx` in full (`Host`, `element`, `ShellHosts`,
`ShellLayout`, `Shell`, `createShellLayout`); `editor-main.ts` (the `layout.hosts`
reads, `panelHosts`, the picker append); `editor-session.ts` (`EditorPanelHosts`
and every `options.panelHosts.*` construction site);
`editor-shell.ts` (`mountEditorShell`, `host.replaceChildren(container)` at :501);
`palette-manager/panel.ts` (`mountPicker`, `mountGradient`); the tests
`shell-layout.dom.test.tsx`, `shell-layout-scroll.dom.test.ts`,
`editor-shell.dom.test.ts`; `rg` over `src/web` for `replaceChildren`,
`createRoot`, `parentElement !==`, `createPortal`, `StrictMode`.

Found:

- **The host-slot mechanism exists once, in this file.** Nothing else in the repo
  moves an externally-created node into a React slot. The ~30 other
  `replaceChildren` call sites are element-local re-renders — `select.replaceChildren()`
  in a panel, `document.body.replaceChildren()` in a test's `afterEach` — and
  never cross an owner boundary.
- **Two places already put a React root inside a non-React owner's host, and both
  are the inverse of this problem**: `createRoot(hosts.dock)` here
  (`shell-layout.tsx:624`) and `createRoot(host)` twice in
  `palette-manager/panel.ts:304, 325` (the colour picker and the gradient editor).
  React renders *into* a foreign node and nothing moves.
- `editor-shell.ts:501` is the same shape one level down and one owner over: the
  Fabric canvas container replaces the host's children. It **replaces** rather
  than moves, so it is a deliberate remount — a new document means a new canvas.
- **The move is already pinned by a test.** `shell-layout.dom.test.tsx:338–385`
  asserts the moved host is inside the left column's slot, that the inspector no
  longer contains it, and that it occurs **exactly once** in the root
  (`toHaveLength(1)`, lines 351–355 — see rung 6).
- **No `StrictMode` and no `createPortal` anywhere in `src/web`.** Both failure
  modes rung 4 turns up are latent here rather than active.

Also relevant, from `AGENTS.md`: React is present for the shell only. The editor
manifest's own note (`packages/editor/package.json`) — *"Still no UI framework:
one is worth adding when the inspector surface is real enough to judge the
trade"* — is why "re-render the panels in React" is not an option on the table.

## Rung 2 — dependencies

Searched: `src/web/package.json`, `packages/editor/package.json`, and the
workspace's seven package manifests; the installed tree for a portal or
DOM-move helper.

Found: `react` and `react-dom` `^19.3.0` in the editor, plus `@base-ui/react`,
`@radix-ui/react-popover`, `lucide-react`, `clsx`,
`class-variance-authority`, `tailwind-merge`, `echarts`, `fabric`. Workspace
devDependencies are `@biomejs/biome`, `@playwright/test`, `@playwright/mcp`,
`canvas`, `jsdom`, `typescript`, `vite`, `vitest`.

**Nothing addresses this problem**: no `react-reverse-portal`, no
`@lit/react` or web-component wrapper, no portal helper, no DOM-mutation library,
no state library. The mechanism is built from `react`, `react-dom/client` and
three DOM methods, and every candidate below would be a new shipped dependency
with a licence review.

## Rung 3 — platform

Searched: React's escape hatches — `createPortal`, ref callbacks and React 19's
ref cleanup, `createRoot` — and the DOM's insertion APIs, `appendChild` /
`insertBefore` / `replaceChildren`, against the `moveBefore()` primitive.

Found — **what React gives**:

- `createPortal` renders React's children into a foreign node. It cannot be
  handed a node React did not create, so it cannot express this direction at all.
  (React also uses it here already, for Base UI's menus.)
- **A ref callback is the only hook React offers at the moment it owns an
  element**, and React 19 lets it return a cleanup function; returning anything
  else is a compile error (React v19 blog, *Cleanup functions for refs*).
- React does **not** offer "move this node here". There is no primitive for it.

Found — **what the DOM gives, and what it leaves to us**:

- `appendChild`/`replaceChildren` with an already-attached node *is* a move: the
  spec's pre-insert removes the node from its old parent first. That is what makes
  one call serve as both "place it" and "re-place it", and it is also why a node
  can never be in two places — the DOM resolves the conflict for us.
- The state such a move resets is enumerated by the `moveBefore()` explainer:
  iframes reload, focus and selection clear, fullscreen/popover/`<dialog>` close,
  CSS animations restart, pointer events cancel. `Element.moveBefore()` (Chrome
  133, Firefox 144, **not Safari**) exists to keep that state, and throws if the
  node would move between a connected and a disconnected parent.
- Left to us, and given by nothing in the platform: **which slot owns a node,
  what happens when two slots claim it, and how a second run over a node that is
  already in place is made a no-op.** That is the whole of what `Host` and the
  dock's ref callback are for.

## Rung 4 — ecosystem

The searches are the evidence. Five queries were run through the Exa MCP web
search; the sites read are recorded so the sweep is re-runnable.

**Query 1 — `blog post or Stack Overflow answer comparing createPortal vs
useEffect appendChild vs ref callback for hosting vanilla imperative DOM inside
React`.** Read: React's *Refs and the DOM* (the callback-ref caveats section),
SO *React — append-only behavior with createPortal or appendChild?*, SO *Is it
safe to render a react portal into another component DOM?*, tkdodo *Avoiding
useEffect with callback refs*, jayfreestone *React Portals with Hooks*.
**Found: the ecosystem splits the question by direction and only answers one
half.** The portal (React children → foreign node) is the first-class answer, and
the docs say plainly that React "won't touch the internals of a rendered div,
assuming it's always empty at the end of render". The mirror case — a node React
did not create — has no library answer; it is answered with a ref and imperative
code. The recurring advice is to use a callback ref rather than `useRef` +
`useEffect`, because the callback is bound to the DOM node's lifecycle and "will
not execute twice in strict mode".

**Query 2 — `React 19 ref callback cleanup function return refs codemod release
notes`.** Read: `react.dev` *React v19* and *React 19 Upgrade Guide*, and the
`facebook/react` CHANGELOG. **Found: React 19 changed the contract under exactly
this code.** A ref callback may now return a cleanup function, and React calls
that instead of calling the ref with `null` on unmount; returning anything else is
rejected by TypeScript. The changelog additionally records the StrictMode
behaviour: *"Refs are now attached/detached/attached in StrictMode"* and
*"StrictMode will now double-invoke ref callback functions on initial mount"*, and
`react.dev/reference/react/StrictMode` documents *"one extra setup+cleanup cycle
in development for every callback `ref`"* and the same for effects. The dock's
inline callback returns nothing, so React 19 reads it as "no cleanup", and its own
`firstChild` guard is what makes the extra cycle harmless.

**Query 3 — `moving an existing DOM node to another parent resets iframe video
scroll focus appendChild vs moveBefore`.** Read: Chrome for Developers *Preserve
state during DOM mutations with moveBefore()*, MDN *Element.moveBefore()*, the
DOM Standards `moveBefore` explainer, SO *How to prevent iframe to reload when
moving it to a different parent with appendChild*. **Found: the move primitive is
new, and the reset is documented rather than folklore.** The explainer lists the
state a remove+insert destroys (iframe reload, focus loss, selection cleared,
fullscreen/popover/modal closed, animations reset, pointer events cancelled) and
states that `moveBefore` throws unless both nodes are connected or both are
disconnected. That is the constraint list this mechanism's single-owner rule is
built on.

**Query 4 — `@lit/react createComponent wrap web component in React ref callbacks
StrictMode`.** Read: `lit.dev/docs/frameworks/react/` and the `@lit/react` npm
README. **Found: not this problem, and it says why.** `createComponent` maps
React props onto custom-element *properties* and wires `addEventListener` for
events; it never places or moves a node. Its own motivation repeats the React
docs' limitation verbatim — *"to properly use more complex web components you
often have to use `ref()` and imperative code"* — i.e. even the library built for
React-plus-DOM-owning-elements leaves host placement to `ref`.

**Query 5 — `react-reverse-portal move rendered React subtree between two places
without remount OutPortal limitations`.** Read: `httptoolkit/react-reverse-portal`
README, npm page, and issues #22 and #33. **Found: the closest published analogue
to the problem statement, pointed the other way, and its limitations are the
useful part.** Reverse portals *"pull a rendered element from elsewhere into a
target location within your React tree … reparent DOM nodes … without
re-rendering them"* — the same goal, but the thing being moved is React-rendered.
Its README states: *"Nodes should be rendered to at most one OutPortal at any
time. Rendering a node in two OutPortals simultaneously will make bad things
happen, rendering the node in a random one or maybe none of the OutPortals"*, and
that iframes always reload when moved. Issue #22 is the structural cost: React
called `insertBefore` against a placeholder the library's own mechanism had
already replaced, throwing `NotFoundError: Failed to execute 'insertBefore' … the
new node is to be inserted is not a child of this node`, and the fixes offered are
workarounds (an empty text node, or a wrapping `div`) because React's reconciler
is holding a picture of the slot that no longer matches.

*How the shapes compare to ours:* **same statement, opposite owner, and the
mechanism we need is the half nobody ships.** Reverse portals move React's
content between two React positions; we move a node React never rendered into one
React-owned position. Its two-out-portal hazard is precisely what the DOM already
prevents for us — a node has one parent, so the second slot wins and the first is
left empty (measured, rung 6) — and its `insertBefore` crash is the risk of the
opposite approach, where React believes it owns a slot whose child it did not
create. `@lit/react` does not address placement at all. The React portal's own
caveats (events and context follow the *React* tree, not the DOM tree) are about
React children living in a foreign tree; the moved node here has no React children
in it at all.

**Plainly: nobody solves this exact shape.** The ecosystem's three directions are
(a) portal React's children out — React's own, already used here for menus;
(b) wrap a custom element as a React component — `@lit/react`, which leaves
placement to `ref`; (c) move React-rendered content between two React slots —
`react-reverse-portal`, which carries a dependency and React-internals risk to
solve the direction we do not have. What the ecosystem does supply is the
*constraints*: one owner at a time, a move is remove+insert, and do not put
React's reconciler in the position of owning a slot whose child it did not create.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **`Host`: React-owned `div`, node moved in by an effect** | the node is never React's child, only positioned by React — exactly the shape; already the incumbent for six of seven hosts | `useRef`, one effect, one `replaceChildren`; an anonymous wrapper `div` per host | the effect's `[node]` deps mean it runs on mount and on a node swap, not per render; a second run over a node already in place is guarded | **chosen** |
| **Inline `ref` callback with `replaceChildren`** (the dock) | needed where the slot element must itself be React's — the dock's `className`, `aria-label` and `data-visible` live on it and `createShellLayout` reads it back out of the DOM | one inline arrow, re-created per render, so React detaches/attaches the ref on every re-render | no `hidden` prop and no `node` dependency; idempotence rests on the callback's own `firstChild` check | **chosen for the dock only** |
| **`createPortal`** | no — it renders *React's* children into a foreign node | would require re-implementing seven imperative panels as React components | puts a framework boundary where the editor manifest explicitly declines one, to move nodes React did not create | rejected |
| **`createRoot` per host** (render React *into* each host) | inverts the problem; it moves nothing | six more React roots, one per panel, plus the panel's own imperative DOM kept alive alongside | a root per panel is a lifetime to mount, unmount and leak — and it re-renders content the modules already own | rejected |
| **`react-reverse-portal`** | solves the *neighbouring* shape: moving React-rendered content between two React positions | a new shipped dependency (2.5 kB) and its licence review, to move a node React never rendered | its README's own "two OutPortals at once" hazard is what the DOM gives us free, and issue #22 shows the class of bug it carries — React reconciling a slot it does not really own | rejected |
| **`Element.moveBefore()`** | the platform primitive that preserves precisely the state a move destroys (focus, selection, animation, iframe) | one line, feature-detected, with `replaceChildren` as the fallback | **not in Safari**, and it throws when a node would move between a connected and a disconnected parent | rejected today — revisit if a host ever carries a `<video>`, iframe or fullscreen element across a move |

## Rung 6 — probe

**The repo's pin, read rather than assumed.** `shell-layout.dom.test.tsx:338–385`
("shows the theme's own panels in the left column, and toggles them like a pane")
asserts the moved host is inside `.editor-shell-panel`, that the inspector does not
contain it, and — lines 351–355 — that filtering every node in the root for
identity with `layout.hosts.document` yields **exactly one**. Its comment names the
failure it guards: *"`Host` reparents one node, so the tab left holding a copy
would leave one of the two slots empty and the panel gone from whichever mounted
second."* So the pinned claim is that the move is a **place**, not a copy, and that
a slot cannot hold a duplicate.

**jsdom probe of the DOM contract `Host` relies on** (`node --input-type=module`
against the workspace's own `jsdom`, no file written into the repo):

- `slot1.replaceChildren(node)` → slot1 has 1 child, slot2 has 0,
  `node.parentElement === slot1`, `node.isConnected === true`.
- then `slot2.replaceChildren(node)` → slot1 has **0** children, slot2 has 1,
  `node.parentElement === slot2`.
- `replaceChildren` with the node **already** the only child → **0** added and
  **0** removed mutation records in jsdom.

Two readings follow. First, "the same node handed to two slots at once" is not a
conflict the code has to resolve — a node has one parent, so the second slot takes
it and the first is left empty; that is the whole of `Host`'s ownership rule.
Second, that third measurement is **where jsdom and a browser can diverge**: the
DOM spec's pre-insert removes and re-inserts, which is the reset the `moveBefore`
explainer enumerates, and jsdom short-circuits it to a no-op. jsdom cannot measure
that, so the guard's value in a real browser is taken from the spec, not from this
number.

**React probe, replicating `Host` verbatim** — including the
`node.parentElement !== parent` guard — against the workspace's `react` /
`react-dom` under jsdom:

- two `Host`s, two nodes in one render: each node sits in its own slot, the moved
  node occurs **once** in the document, and the effect ran **2** times for **2**
  hosts (once each).
- **one node handed to two `Host`s in the same render**: slot1 has **0** children,
  slot2 has **1**, `node.parentElement === slot2`, occurrences **1**. Effects run
  in child order, so the last `Host` to run takes the node — the loser does not
  throw, it is simply empty. That ordering is a real, if narrow, behaviour: the
  same node in two slots resolves to whichever slot renders last.
- re-render with the **same** node object: effect runs **1** time before and **1**
  after (`[node]` deps), node still placed. So the guard is not for re-renders. It
  is for a **second effect run over a node that is already in place** — which is
  what StrictMode's extra setup+cleanup+setup cycle produces (rung 4, query 2).
  The repo mounts no `StrictMode` and uses no `createPortal`, so both that hazard
  and the doc's ref-detach/reattach are latent here, not active.
- the dock's inline variant was **not** probed separately. It makes the same call
  on a node already inside the element it belongs to, guarded by
  `node.firstChild !== hosts.dock` instead of `parentElement !== parent`; the
  guard's job is identical and its position differs only in that a ref callback
  fires at the commit that creates the element, before effects.

**Not measured, and said so rather than padded.** That a move preserves the
scroll, focus and subscriptions this mechanism exists to protect is asserted from
the DOM spec and the `moveBefore` explainer (rung 3), not from a browser run. The
repo's own scroll test (`shell-layout-scroll.dom.test.ts`) models the browser's
`scrollTop` because jsdom does not lay out — it pins the *pane's* scroll across a
swap, not the host move. A browser measurement of the host move is the task that
would need one.

## Decision

**Keep the effect-based `Host` for hosts whose slot is a wrapper, and the inline
ref callback for the one slot element that must itself be React's. Do not adopt a
portal, a reverse portal, or `moveBefore()`.**

The specific reasons:

- **A portal cannot express the direction.** `createPortal` renders React's
  children into a foreign node; the moved node here is never React's child. The
  only way to use it would be to re-implement seven imperative panels as React
  components, which is the framework boundary `packages/editor/package.json`
  explicitly declines.
- **`Host`'s effect and guard are what keep the call off the render path.** With
  `[node]` deps the `replaceChildren` runs once per (node, slot) rather than once
  per render (measured: 1 run for 1 host, unchanged across a re-render), and the
  `node.parentElement !== parent` check makes a second run over a node already in
  place a no-op — the hazard the DOM spec creates by making an insert a
  remove+insert, and the one StrictMode would surface the moment it were switched
  on.
- **The dock needs a different shape, and it is the same rule.** Its element must
  be the one React authored: it carries `className="editor-shell-dock editor-glass"`,
  `aria-label` and `data-visible`, and `createShellLayout` reads it back out of the
  DOM (`root.querySelector(".editor-shell-dock")`, line 618) to hand it to callers
  as `ShellLayout.dock`. `Host` renders an anonymous `div` with no `className`, so
  wrapping would interpose a node between `.editor-shell-dock` and its buttons —
  and that element is `display: flex; gap: 3px` (editor-shell.css:1198–1211). The
  ref callback puts the node onto that element at the commit that creates it, with
  no wrapper and no effect.
- **`moveBefore()` is the right primitive and the wrong moment.** It preserves
  exactly the state a move destroys, but it is absent from Safari and throws when
  a node moves between a connected and a disconnected parent. Today the one host
  that can carry movable state — `hosts.canvas`, whose container holds the
  background-media `<video>` — is placed once and never moved, so the reset has
  never been observed. Revisit if a host ever carries a `<video>`, iframe or
  fullscreen element across a move; the check would be `'moveBefore' in
  Element.prototype` with the current `replaceChildren` as the fallback.

**The cost of being wrong is two implementations of one idea in one file**, and
the rule that keeps them from drifting is the one above: `Host` where the slot is
a wrapper, the inline ref where the slot *is* the styled, read-back element. A
third host that needs a class or an `aria-label` is a third instance of that rule,
not a fourth mechanism.
