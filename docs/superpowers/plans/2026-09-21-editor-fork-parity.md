# Editor Fork Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the editor interaction and content behaviours the native-Fabric
migration dropped from the retired `fabricjs-image-editor` fork, and add image
import bounds, a per-image crop tool and a live background-media swap API.

**Architecture:** Each restored behaviour becomes one per-concern manager folder
under `src/web/packages/editor/src/`, matching the split `editor-shell.ts`
already uses for text/image/layer/lock/history. `createNativeEditor` composes
them behind the `EditorInteraction` contract that product panels consume. Ports
from the fork are adapted at their boundaries only: fork-specific post-clone
hooks are replaced with `object.setCoords()`, and fork-specific object types are
excluded rather than stubbed.

**Tech Stack:** TypeScript, `fabric/es` 7.4.0, Vite 8 (Rolldown), Vitest
(`jsdom` for DOM units), Playwright (desktop Chromium).

**Spec:** `.agents/specs/0017-editor-fork-parity.md`

**Fork source:** `D:\git-repos\fabricjs-image-editor`, pinned at commit
`9efdd78a342a29f169a8dbf1da78c95bbf1ffe77`. That commit is **not** the
repository's current `HEAD`; it lives on branch `codex/fabric-es`. Read fork
files without mutating that repository:

```bash
git -C D:/git-repos/fabricjs-image-editor show 9efdd78a:<path>
git -C D:/git-repos/fabricjs-image-editor ls-tree -r --name-only 9efdd78a
```

Never `git checkout`, `git switch` or `git restore` in the fork repository.

## Global Constraints

- Run every command from `src/web/`. Do not repeat `src/web/` in a path after
  changing into it.
- Node 22.12+, 24, or 26+. No .NET or Python toolchain.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled.
  Build optional object properties with conditional spreads
  (`...(x === undefined ? {} : { x })`), never `x: x ?? undefined`. Indexed
  reads return `T | undefined`; narrow before use.
- **One owner per concept.** Search before adding a type, key, default, action,
  helper, route, style property or schema value. Record new owners in
  `.agents/architecture.md`.
- No re-export wrappers after moves, except package public barrels.
- No licence headers in source files.
- Avoid generic folder names (`helpers`, `common`, `utils`, `internal`,
  `shared`); name folders by responsibility.
- 500 lines is a signal for a source file, 800 is a stop.
- Refuse invalid numeric input rather than coercing it to zero.
- Code comments are 1–3 lines and explain **why**, not what.
- All user-visible strings are English. The fork's demo config is Russian; every
  ported label must be replaced, not transliterated.
- Fabric is imported from `fabric/es`, never `fabric`.
- Commit with Conventional Commit titles. Stage explicit paths; never
  `git add -A` or `git commit -a`.
- Do not hand-edit `src/web/package-lock.json` or `packages/*/dist/**`.
- No new runtime dependency is introduced by this plan. If one becomes
  unavoidable, stop and seek review; adding it also requires updating
  `THIRD-PARTY-NOTICES.md` and `.agents/dependency-licences.md`.

## Conventions this codebase already uses

Read these before Task 1; every task assumes them.

**Manager folder shape.** `src/web/packages/editor/src/<name>-manager/index.ts`
exports an interface and a `create<Name>Manager(canvas, save)` factory. Tests sit
beside it as `index.dom.test.ts` (jsdom) or `index.test.ts` (pure). Existing
example, `object-lock-manager/index.ts`:

```typescript
import type { Canvas, FabricObject } from "fabric/es";

export interface ObjectLockManager {
  lockObject(input?: { readonly object?: FabricObject }): void;
  unlockObject(input?: { readonly object?: FabricObject }): void;
}

export function createObjectLockManager(
  canvas: Canvas,
  save: () => void,
): ObjectLockManager {
  return {
    lockObject: ({ object = canvas.getActiveObject() } = {}) => {
      object?.set({ selectable: false, evented: false, locked: true });
      save();
    },
    unlockObject: ({ object = canvas.getActiveObject() } = {}) => {
      object?.set({ selectable: true, evented: true, locked: false });
      save();
    },
  };
}
```

**DOM unit test shape.** First line is the environment pragma. Existing example,
`object-lock-manager/index.dom.test.ts`:

```typescript
// @vitest-environment jsdom
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createObjectLockManager } from "./index.js";

describe("ObjectLockManager", () => {
  it("locks and unlocks the active object and saves history", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape" });
    canvas.add(object);
    canvas.setActiveObject(object);
    const save = vi.fn();
    const manager = createObjectLockManager(canvas, save);

    manager.lockObject();
    expect(object.get("locked")).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
```

**Imports** use explicit `.js` extensions on relative paths.

**Composition point.** `editor-shell.ts`'s `createNativeEditor` builds every
manager and returns the `EditorInteraction` object. `save` is the shared
`() => history.save()` closure, and `canvas.on("object:modified", save)` is
already wired there — do not wire it a second time.

## File Structure

New owners under `src/web/packages/editor/src/`:

| Path | Responsibility |
|---|---|
| `error-manager/index.ts` | Structured `editor:error` / `editor:warning` canvas events plus console logging |
| `controls-manager/index.ts` | Selection/rotation handle styling applied to Fabric defaults |
| `deletion-manager/index.ts` | Delete the active object or `ActiveSelection` |
| `clipboard-manager/index.ts` | OS clipboard copy/cut/paste/duplicate, including external image and HTML paste |
| `grouping-manager/index.ts` | Group a selection into a Fabric `Group`; ungroup back to objects |
| `toolbar-manager/index.ts` | Floating DOM toolbar positioned below the active selection |
| `snap-manager/` | Drag-time line and equal-spacing smart-guide snapping (ported tree) |
| `indicator-manager/` | Rotation-angle and size tooltips over a shared cursor-following DOM primitive |
| `crop-manager/index.ts` | Interactive per-image crop session over the existing `clipPath` primitive |

Modified files:

| Path | Change |
|---|---|
| `editor-interaction.ts` | Extend the `EditorInteraction` contract with the new managers |
| `editor-shell.ts` | Compose the new managers in `createNativeEditor`; apply controls defaults once |
| `editor-session.ts` | Own toolbar/indicator/snapping lifecycle and disposal; register new shortcuts |
| `shortcut-manager/index.ts` | Support unmodified keys and the new product action ids |
| `image-manager/index.ts` | Downscale an oversized import before creating the Fabric image |
| `scene-fabric/src/scene.ts` | Add `updateArtboard(artboard)` to `FabricSceneHandle` |
| `.agents/architecture.md` | Record every new owner in the editor ownership table |
| `.agents/status.md` | Current evidence after the final verification |
| `.agents/specs/0017-editor-fork-parity.md` | Remove on completion (see Task 13) |
| `.agents/screenshots/README.md` | Add the new editor visual-action rows |
| `tests/e2e/editor-fork.spec.ts` | Browser proof for toolbar, handles, guides and crop |

### Decision: crop gets its own owner

Spec 0017 leaves crop placement open ("new `crop-manager/` or folded into
`image-manager/`"). **Decision: a separate `crop-manager/`.** `image-manager/`
owns one concept — turning a `File` into a canvas image — and stays ~40 lines. A
crop session owns different state with a different lifetime: an interactive
frame object, an optional aspect lock, and apply/cancel semantics that stay out
of undo history until committed. Those are two concepts, so they get two owners.

---

## Task 1: `updateArtboard()` on the Fabric scene handle

`FabricSceneHandle` mounts `backgroundMedia` once at mount and offers no way to
change it. `update(next: ScenePlan)` cannot help: `ScenePlan["artboard"]` carries
only `width`, `height`, `fitMode`, `background` and `barColor` — never
`backgroundMedia`, which exists only on the document-level `Artboard`. This adds
the missing typed API. It is in `scene-fabric`, has no editor dependency, and is
sequenced first so the rest of the plan starts from a clean verified build.

**Files:**
- Modify: `packages/scene-fabric/src/scene.ts`
- Test: `packages/scene-fabric/src/scene.dom.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `FabricSceneHandle.updateArtboard(artboard: Artboard): void`.

**Context you need.** `mountFabricScene` closes over `options`, and creates
`media` only when both `options.resolveAsset` and `options.artboard` are defined:

```typescript
  const media =
    options.resolveAsset === undefined || options.artboard === undefined
      ? undefined
      : mountBackgroundMedia({
          host,
          artboard: options.artboard,
          assets: options.assets,
          resolveAsset: options.resolveAsset,
        });
```

`BackgroundMediaHandle.update` takes `Omit<BackgroundMediaOptions, "host">`, that
is `{ artboard, assets, resolveAsset }`.

Scope stays narrow, matching the assumption `update()` already makes: `assets`
and `resolveAsset` remain whatever mount supplied. Do **not** lazily create
`media` when mount supplied no `resolveAsset`.

- [ ] **Step 1: Write the failing test**

Create `packages/scene-fabric/src/scene.dom.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Artboard, ScenePlan } from "@vigilia/renderer-core";
import { mountFabricScene } from "./scene.js";

function plan(): ScenePlan {
  return {
    artboard: {
      width: 400,
      height: 300,
      fitMode: "contain",
      background: "#000",
      barColor: "#000",
    },
    nodes: [],
    issues: [],
  };
}

function host(): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientWidth", { value: 400 });
  Object.defineProperty(element, "clientHeight", { value: 300 });
  document.body.append(element);
  return element;
}

describe("mountFabricScene updateArtboard", () => {
  it("swaps background media without remounting the scene", () => {
    const element = host();
    const artboard: Artboard = { width: 400, height: 300 };
    const scene = mountFabricScene({
      host: element,
      plan: plan(),
      artboard,
      assets: [
        { id: "a", kind: "image", path: "assets/a.png", sha256: "x" },
        { id: "b", kind: "image", path: "assets/b.png", sha256: "y" },
      ],
      resolveAsset: (assetId) => ({ url: `blob:${assetId}` }),
    });

    scene.updateArtboard({
      ...artboard,
      backgroundMedia: { assetId: "b", fit: "cover" },
    });

    const media = element.querySelector<HTMLImageElement>(
      "[data-vigilia-background-media] img",
    );
    expect(media?.src).toBe("blob:b");

    scene.dispose();
    element.remove();
  });

  it("is inert when the scene mounted without an asset resolver", () => {
    const element = host();
    const scene = mountFabricScene({ host: element, plan: plan() });

    expect(() =>
      scene.updateArtboard({
        width: 400,
        height: 300,
        backgroundMedia: { assetId: "b", fit: "cover" },
      }),
    ).not.toThrow();
    expect(
      element.querySelector("[data-vigilia-background-media]"),
    ).toBeNull();

    scene.dispose();
    element.remove();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run packages/scene-fabric/src/scene.dom.test.ts`
Expected: FAIL — `scene.updateArtboard is not a function`, and a TypeScript
error that `updateArtboard` does not exist on `FabricSceneHandle`.

- [ ] **Step 3: Add the API to the handle interface**

In `packages/scene-fabric/src/scene.ts`, extend the interface:

```typescript
export interface FabricSceneHandle extends SceneHandle {
  readonly canvas: StaticCanvas;
  readonly adapter: SceneAdapter;
  /**
   * `ScenePlan` never carries `backgroundMedia`, so a document-level artboard
   * change cannot travel through `update()`.
   */
  updateArtboard(artboard: Artboard): void;
}
```

- [ ] **Step 4: Track the current artboard and implement the method**

Still in `packages/scene-fabric/src/scene.ts`, replace the `const media = ...`
declaration with a tracked artboard plus `let media`:

```typescript
  let currentArtboard = options.artboard;
  let media =
    options.resolveAsset === undefined || currentArtboard === undefined
      ? undefined
      : mountBackgroundMedia({
          host,
          artboard: currentArtboard,
          assets: options.assets,
          resolveAsset: options.resolveAsset,
        });
```

Add the method to the returned object, beside `update`:

```typescript
    updateArtboard(artboard: Artboard): void {
      currentArtboard = artboard;
      if (media === undefined || options.resolveAsset === undefined) return;
      media.update({
        artboard,
        assets: options.assets,
        resolveAsset: options.resolveAsset,
      });
    },
```

`media` stays `let` only so the initialiser can read `currentArtboard`; nothing
reassigns it. If Biome reports `media` as never reassigned, change it back to
`const` and keep `currentArtboard` as the sole `let`.

- [ ] **Step 5: Run the test and verify it passes**

Run: `npx vitest run packages/scene-fabric/src/scene.dom.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Typecheck and confirm the player size gate is unmoved**

Run: `npm run typecheck`
Expected: seven projects clean.

Run: `npx vite build packages/player && npm run size`
Expected: the gate passes. Record the reported gzip number; it should sit within
a few tenths of a KB of the 269.3 KB baseline in `.agents/status.md`.

- [ ] **Step 7: Commit**

```bash
git add packages/scene-fabric/src/scene.ts packages/scene-fabric/src/scene.dom.test.ts
git commit -m "feat(scene-fabric): add updateArtboard for live background-media swap"
```

---

## Task 2: `error-manager/` — structured editor diagnostics

Every manager added by this plan needs one way to report a failure. This is
**rebuilt, not ported**: the fork's categories name subsystems Vigilia does not
have (background, crop frame and so on). The categories here name Vigilia's
actual managers.

**Files:**
- Create: `packages/editor/src/error-manager/index.ts`
- Test: `packages/editor/src/error-manager/index.dom.test.ts`
- Modify: `packages/editor/src/editor-interaction.ts`
- Modify: `packages/editor/src/editor-shell.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type EditorErrorCategory = "clipboard" | "deletion" | "grouping" | "controls" | "toolbar" | "snapping" | "crop" | "image"`
  - `interface EditorDiagnostic { readonly category: EditorErrorCategory; readonly message: string; readonly cause?: unknown }`
  - `interface ErrorManager { error(category, message, cause?): void; warn(category, message, cause?): void }`
  - `function createErrorManager(canvas: Canvas): ErrorManager`
  - `EditorInteraction.errorManager: ErrorManager`
  - Canvas events `"editor:error"` and `"editor:warning"`, each carrying an
    `EditorDiagnostic` payload.

Fabric's typed event map does not know these names, so firing and subscribing
uses the `as never` cast that `chart-manager/index.ts` already uses for
`"editor:history-state-loaded"`.

- [ ] **Step 1: Write the failing test**

Create `packages/editor/src/error-manager/index.dom.test.ts`:

```typescript
// @vitest-environment jsdom
import { Canvas } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createErrorManager, type EditorDiagnostic } from "./index.js";

describe("ErrorManager", () => {
  it("emits a structured editor:error event and logs it", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const seen: EditorDiagnostic[] = [];
    canvas.on("editor:error" as never, ((diagnostic: EditorDiagnostic) => {
      seen.push(diagnostic);
    }) as never);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const manager = createErrorManager(canvas);

    const cause = new Error("no permission");
    manager.error("clipboard", "Could not read the clipboard.", cause);

    expect(seen).toEqual([
      { category: "clipboard", message: "Could not read the clipboard.", cause },
    ]);
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });

  it("emits editor:warning without a cause and omits the key entirely", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const seen: EditorDiagnostic[] = [];
    canvas.on("editor:warning" as never, ((diagnostic: EditorDiagnostic) => {
      seen.push(diagnostic);
    }) as never);
    const logged = vi.spyOn(console, "warn").mockImplementation(() => {});
    const manager = createErrorManager(canvas);

    manager.warn("snapping", "Ignored a non-finite anchor.");

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({
      category: "snapping",
      message: "Ignored a non-finite anchor.",
    });
    expect("cause" in seen[0]!).toBe(false);
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run packages/editor/src/error-manager/index.dom.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/editor/src/error-manager/index.ts`:

```typescript
import type { Canvas } from "fabric/es";

/** Named for Vigilia's own managers, not the retired fork's subsystems. */
export type EditorErrorCategory =
  | "clipboard"
  | "deletion"
  | "grouping"
  | "controls"
  | "toolbar"
  | "snapping"
  | "crop"
  | "image";

export interface EditorDiagnostic {
  readonly category: EditorErrorCategory;
  readonly message: string;
  readonly cause?: unknown;
}

export interface ErrorManager {
  error(category: EditorErrorCategory, message: string, cause?: unknown): void;
  warn(category: EditorErrorCategory, message: string, cause?: unknown): void;
}

/** Fabric's typed event map does not declare Vigilia's own event names. */
function emit(
  canvas: Canvas,
  event: "editor:error" | "editor:warning",
  diagnostic: EditorDiagnostic,
): void {
  canvas.fire(event as never, diagnostic as never);
}

export function createErrorManager(canvas: Canvas): ErrorManager {
  const build = (
    category: EditorErrorCategory,
    message: string,
    cause: unknown,
  ): EditorDiagnostic => ({
    category,
    message,
    ...(cause === undefined ? {} : { cause }),
  });

  return {
    error(category, message, cause) {
      console.error(`[vigilia:${category}] ${message}`, cause);
      emit(canvas, "editor:error", build(category, message, cause));
    },
    warn(category, message, cause) {
      console.warn(`[vigilia:${category}] ${message}`, cause);
      emit(canvas, "editor:warning", build(category, message, cause));
    },
  };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run packages/editor/src/error-manager/index.dom.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Compose it into the editor contract**

In `packages/editor/src/editor-interaction.ts` add the import at the top:

```typescript
import type { ErrorManager } from "./error-manager/index.js";
```

and inside `interface EditorInteraction`, directly above `destroy(): void;`:

```typescript
  readonly errorManager: ErrorManager;
```

In `packages/editor/src/editor-shell.ts` add the import:

```typescript
import { createErrorManager } from "./error-manager/index.js";
```

and inside `createNativeEditor`'s returned object, beside the other managers:

```typescript
    errorManager: createErrorManager(canvas),
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: seven projects clean.

- [ ] **Step 7: Commit**

```bash
git add packages/editor/src/error-manager packages/editor/src/editor-interaction.ts packages/editor/src/editor-shell.ts
git commit -m "feat(editor): add structured editor diagnostics owner"
```

---

## Task 3: unmodified-key product shortcuts

`ShortcutManager` is the single window-level dispatcher for Vigilia product
actions, but it recognises only `Ctrl`/`Meta` combinations: it computes an
action only when `event.ctrlKey || event.metaKey`. Delete and Backspace carry no
modifier, and `Ctrl+Shift+G` must select a different action from `Ctrl+G`. Three
later tasks (deletion, clipboard, grouping) depend on this, so the dispatcher
changes once here. Letting each manager add its own `window` listener would
create a second owner for the same concept.

**Files:**
- Modify: `packages/editor/src/shortcut-manager/index.ts`
- Test: `packages/editor/src/shortcut-manager/index.dom.test.ts` (extend)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `ProductShortcutId` additionally accepts `"edit.delete"`,
  `"edit.copy"`, `"edit.cut"`, `"edit.duplicate"`, `"edit.group"` and
  `"edit.ungroup"`. `register(action, handler)` and `destroy()` keep their
  existing signatures.

**There is deliberately no `edit.paste` binding.** `Ctrl+V` must reach the
browser so it fires a `paste` event carrying `ClipboardEvent.clipboardData`,
which is the only way to read an image the user copied from another
application. Intercepting and calling `preventDefault()` here would suppress
that event. Task 8 makes the document-level `paste` event the single owner of
pasting. Do not add a `v` row to the table below.

**Behaviour to preserve.** An unmodified key must never fire while the user is
typing. Fabric's text editing uses a hidden `textarea`, which the existing
`isTextEntryTarget` already recognises. So a binding that requires no modifier
is *always* deferred to a text-entry target, on top of the existing
`TEXT_ENTRY_DEFERRED_ACTIONS` set for modifier shortcuts.

- [ ] **Step 1: Write the failing tests**

Append to `packages/editor/src/shortcut-manager/index.dom.test.ts`. If the file
does not already import `ShortcutManager`, `describe`, `expect`, `it` and `vi`,
extend its existing import statements rather than adding duplicates.

```typescript
describe("ShortcutManager unmodified keys", () => {
  it("fires edit.delete for Delete and Backspace with no modifier", () => {
    const manager = new ShortcutManager();
    const handler = vi.fn();
    manager.register("edit.delete", handler);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" }));

    expect(handler).toHaveBeenCalledTimes(2);
    manager.destroy();
  });

  it("never fires an unmodified shortcut while a text field has focus", () => {
    const manager = new ShortcutManager();
    const handler = vi.fn();
    manager.register("edit.delete", handler);
    const field = document.createElement("textarea");
    document.body.append(field);

    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true }),
    );

    expect(handler).not.toHaveBeenCalled();
    field.remove();
    manager.destroy();
  });

  it("separates group and ungroup by the shift modifier", () => {
    const manager = new ShortcutManager();
    const group = vi.fn();
    const ungroup = vi.fn();
    manager.register("edit.group", group);
    manager.register("edit.ungroup", ungroup);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "g", ctrlKey: true }),
    );
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "G", ctrlKey: true, shiftKey: true }),
    );

    expect(group).toHaveBeenCalledOnce();
    expect(ungroup).toHaveBeenCalledOnce();
    manager.destroy();
  });

  it("leaves an unregistered shortcut's default behaviour alone", () => {
    const manager = new ShortcutManager();
    const event = new KeyboardEvent("keydown", {
      key: "Delete",
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    manager.destroy();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run packages/editor/src/shortcut-manager/index.dom.test.ts`
Expected: FAIL — `"edit.delete"` is not assignable to `ProductShortcutId`, and
the Delete handler is never called.

- [ ] **Step 3: Replace the binding table**

In `packages/editor/src/shortcut-manager/index.ts`, replace the
`ProductShortcutId` type and the `PRODUCT_SHORTCUTS` map with the following.
Keep `TEXT_ENTRY_DEFERRED_ACTIONS`, `isTextEntryTarget`, the constructor,
`register` and `destroy` exactly as they are.

```typescript
export type ProductShortcutId =
  | "file.new"
  | "file.open"
  | "file.save"
  | "edit.undo"
  | "edit.redo"
  | "edit.delete"
  | "edit.copy"
  | "edit.cut"
  | "edit.duplicate"
  | "edit.group"
  | "edit.ungroup";

interface ShortcutBinding {
  readonly key: string;
  /** A binding with no modifier always defers to a focused text field. */
  readonly modifier: boolean;
  readonly shift?: boolean;
  readonly action: ProductShortcutId;
}

const PRODUCT_SHORTCUTS: readonly ShortcutBinding[] = [
  { key: "n", modifier: true, action: "file.new" },
  { key: "o", modifier: true, action: "file.open" },
  { key: "s", modifier: true, action: "file.save" },
  { key: "z", modifier: true, action: "edit.undo" },
  { key: "y", modifier: true, action: "edit.redo" },
  { key: "c", modifier: true, action: "edit.copy" },
  { key: "x", modifier: true, action: "edit.cut" },
  { key: "d", modifier: true, action: "edit.duplicate" },
  { key: "g", modifier: true, shift: true, action: "edit.ungroup" },
  { key: "g", modifier: true, action: "edit.group" },
  { key: "delete", modifier: false, action: "edit.delete" },
  { key: "backspace", modifier: false, action: "edit.delete" },
];

/** Shift-qualified bindings precede their plain form, so first match wins. */
function bindingFor(event: KeyboardEvent): ShortcutBinding | undefined {
  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;
  return PRODUCT_SHORTCUTS.find(
    (binding) =>
      binding.key === key &&
      binding.modifier === modifier &&
      (binding.shift === undefined || binding.shift === event.shiftKey),
  );
}
```

- [ ] **Step 4: Replace the dispatcher body**

Replace the `#onKeyDown` field in the same file:

```typescript
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const binding = bindingFor(event);
    const handler =
      binding === undefined ? undefined : this.#handlers.get(binding.action);

    const deferred =
      binding !== undefined &&
      (!binding.modifier || TEXT_ENTRY_DEFERRED_ACTIONS.has(binding.action)) &&
      isTextEntryTarget(event.target);

    if (handler === undefined || deferred) {
      return;
    }

    event.preventDefault();
    handler();
  };
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run packages/editor/src/shortcut-manager/index.dom.test.ts`
Expected: PASS. Every pre-existing test in the file must still pass; the
`Ctrl+S`/`Ctrl+O`/`Ctrl+N`/`Ctrl+Z`/`Ctrl+Y` behaviour is unchanged.

- [ ] **Step 6: Disable the change and confirm the new tests can fail**

Temporarily set `modifier: true` on the `delete` and `backspace` entries and
re-run the file. The two unmodified-key tests must fail. Restore `false` and
re-run to confirm they pass again. A regression test that cannot fail is not
evidence.

- [ ] **Step 7: Typecheck and commit**

Run: `npm run typecheck`
Expected: seven projects clean.

```bash
git add packages/editor/src/shortcut-manager
git commit -m "feat(editor): support unmodified-key product shortcuts"
```

---

## Task 4: image import bounds (product-requirements §171)

An imported image is downscaled to a maximum edge before it becomes a Fabric
image object, preserving aspect ratio. Main thread, no Web Worker: Vigilia
dashboards are not a bulk photo-editing workload. Revisit worker offloading only
if resize becomes a measured performance problem.

**A Fabric image's width and height come from its element.** `AssetManager.hydrate`
re-attaches a full-resolution element on reopen with
`object.setElement(hydrated.getElement())`. If import bounded the element but
hydrate did not, an oversized image would change geometry on every Open. The
bound therefore has **one owner** applied at both attachment points. This is not
scope creep; bounding import alone would be a round-trip geometry bug.

**Chosen bound: 4096 px on the longest edge.** It passes 4K source art through
untouched, sits at the common GPU maximum-texture-size floor, and is far above
any dashboard's needs. It is unrelated to `MAX_ARTBOARD_DIMENSION` (16384), which
bounds document geometry rather than decoded pixels, so it gets its own constant.

**Files:**
- Modify: `packages/editor/src/image-manager/index.ts`
- Modify: `packages/editor/src/asset-manager/index.ts`
- Test: `packages/editor/src/image-manager/index.dom.test.ts` (extend)

**Interfaces:**
- Consumes: `EditorInteraction.errorManager` exists (Task 2). Not used here;
  an unreadable image already rejects through `importImage`'s promise.
- Produces:
  - `const MAX_IMPORT_IMAGE_EDGE = 4096`
  - `function boundedImportSize(width: number, height: number, maxEdge?: number): { readonly width: number; readonly height: number }`
  - `function boundedImageElement(source: HTMLImageElement, maxEdge?: number): HTMLImageElement | HTMLCanvasElement`
  - `createImageManager(canvas, save)` keeps its existing signature and
    `ImageManager` interface.

- [ ] **Step 1: Write the failing tests for the pure size decision**

Append to `packages/editor/src/image-manager/index.dom.test.ts`. Extend the
file's existing import statements rather than duplicating them.

```typescript
describe("boundedImportSize", () => {
  it("leaves an image within the bound untouched", () => {
    expect(boundedImportSize(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  });

  it("scales the longest edge down to the bound and preserves aspect", () => {
    expect(boundedImportSize(8192, 4096)).toEqual({ width: 4096, height: 2048 });
    expect(boundedImportSize(4096, 8192)).toEqual({ width: 2048, height: 4096 });
  });

  it("never rounds a bounded edge below one pixel", () => {
    expect(boundedImportSize(10000, 1)).toEqual({ width: 4096, height: 1 });
  });

  it("refuses a non-finite or non-positive dimension", () => {
    expect(() => boundedImportSize(Number.NaN, 100)).toThrow();
    expect(() => boundedImportSize(0, 100)).toThrow();
    expect(() => boundedImportSize(100, -1)).toThrow();
  });

  it("honours an explicit bound", () => {
    expect(boundedImportSize(1000, 500, 100)).toEqual({
      width: 100,
      height: 50,
    });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run packages/editor/src/image-manager/index.dom.test.ts`
Expected: FAIL — `boundedImportSize` is not exported from `./index.js`.

- [ ] **Step 3: Implement the bound**

Replace the whole of `packages/editor/src/image-manager/index.ts`:

```typescript
import { FabricImage, type Canvas, type FabricObject } from "fabric/es";

/**
 * Decoded-pixel ceiling for imported and rehydrated images. Unrelated to
 * `MAX_ARTBOARD_DIMENSION`, which bounds document geometry, not pixels.
 */
export const MAX_IMPORT_IMAGE_EDGE = 4096;

export interface ImageManager {
  importImage(options: {
    readonly source: File;
    readonly scale?: "image-contain" | "image-cover" | "scale-montage";
    readonly withoutAdding?: boolean;
    readonly withoutSave?: boolean;
  }): Promise<{ readonly image: FabricObject } | null>;
}

/** The MIME subtype (e.g. "png" from "image/png"); empty when unrecognised. */
function formatOf(mimeType: string): string {
  return /^[^/]+\/([^+;]+)/.exec(mimeType)?.[1] ?? "";
}

export function boundedImportSize(
  width: number,
  height: number,
  maxEdge: number = MAX_IMPORT_IMAGE_EDGE,
): { readonly width: number; readonly height: number } {
  for (const value of [width, height, maxEdge]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(
        "An image bound needs finite, positive width, height and maximum edge.",
      );
    }
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * Both attachment points bound the element, so Open cannot change the geometry
 * import produced.
 */
export function boundedImageElement(
  source: HTMLImageElement,
  maxEdge: number = MAX_IMPORT_IMAGE_EDGE,
): HTMLImageElement | HTMLCanvasElement {
  const natural = {
    width: Math.max(1, source.naturalWidth),
    height: Math.max(1, source.naturalHeight),
  };
  const bounded = boundedImportSize(natural.width, natural.height, maxEdge);
  if (bounded.width === natural.width && bounded.height === natural.height) {
    return source;
  }
  const canvas = document.createElement("canvas");
  canvas.width = bounded.width;
  canvas.height = bounded.height;
  const context = canvas.getContext("2d");
  // A context is unavailable only when the browser refuses one; the unbounded
  // element still renders correctly, so import proceeds rather than failing.
  if (context === null) return source;
  context.drawImage(source, 0, 0, bounded.width, bounded.height);
  return canvas;
}

async function decode(url: string): Promise<HTMLImageElement> {
  const element = document.createElement("img");
  element.alt = "";
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    element.addEventListener("load", () => resolve(element), { once: true });
    element.addEventListener(
      "error",
      () => reject(new Error("Could not decode the selected image.")),
      { once: true },
    );
  });
  element.src = url;
  return loaded;
}

export function createImageManager(
  canvas: Canvas,
  save: () => void,
): ImageManager {
  return {
    async importImage(options) {
      const url = URL.createObjectURL(options.source);
      try {
        const decoded = await decode(url);
        const image = new FabricImage(boundedImageElement(decoded));
        image.set({
          id: `image-${crypto.randomUUID()}`,
          format: formatOf(options.source.type),
        });
        if (!options.withoutAdding) {
          canvas.add(image);
          canvas.setActiveObject(image);
          if (!options.withoutSave) save();
        }
        return { image };
      } finally {
        URL.revokeObjectURL(url);
      }
    },
  };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run packages/editor/src/image-manager/index.dom.test.ts`
Expected: PASS, including every pre-existing test in the file. `importImage`
keeps its contract: same `id` prefix, same `format`, same add/activate/save
behaviour and the same `URL.revokeObjectURL` cleanup.

- [ ] **Step 5: Apply the same bound on rehydrate**

In `packages/editor/src/asset-manager/index.ts` add the import:

```typescript
import { boundedImageElement } from "../image-manager/index.js";
```

and in `hydrate`, replace the `setElement` call:

```typescript
      const hydrated = await FabricImage.fromURL(this.#preview(asset));
      const element = hydrated.getElement();
      object.setElement(
        element instanceof HTMLImageElement
          ? boundedImageElement(element)
          : element,
      );
```

- [ ] **Step 6: Write the round-trip regression test**

Append to `packages/editor/src/asset-manager/index.dom.test.ts`:

```typescript
it("bounds a rehydrated oversized image to the import bound", async () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const object = new FabricImage(document.createElement("img"), {
    id: "image-1",
  });
  setObjectAssetReference(object, { assetId: "big", kind: "image" });
  canvas.add(object);

  const manager = new AssetManager();
  manager.load(
    { assets: [{ id: "big", kind: "image", path: "assets/big.png", sha256: "x" }] },
    { "assets/big.png": new Uint8Array([1]) },
  );
  vi.spyOn(FabricImage, "fromURL").mockResolvedValue(
    new FabricImage(oversizedImage(8192, 4096)),
  );

  await manager.hydrate(canvas);

  const element = object.getElement();
  expect(element.width).toBe(4096);
  expect(element.height).toBe(2048);
  manager.destroy();
});
```

with this helper at the bottom of that file:

```typescript
/** jsdom reports zero natural size, so declare it the way a decode would. */
function oversizedImage(width: number, height: number): HTMLImageElement {
  const element = document.createElement("img");
  Object.defineProperty(element, "naturalWidth", { value: width });
  Object.defineProperty(element, "naturalHeight", { value: height });
  return element;
}
```

Extend that file's existing imports to cover `Canvas`, `FabricImage`, `vi` and
`setObjectAssetReference` (from `@vigilia/scene-fabric`) rather than duplicating
import statements. If jsdom's 2D canvas context is unavailable in this suite,
`boundedImageElement` returns the source element and the assertion will read
8192 — in that case stub `HTMLCanvasElement.prototype.getContext` with
`vi.fn(() => ({ drawImage: vi.fn() }))` for this test only.

- [ ] **Step 7: Run both suites and verify they pass**

Run: `npx vitest run packages/editor/src/image-manager packages/editor/src/asset-manager`
Expected: PASS.

- [ ] **Step 8: Disable the bound and confirm the tests can fail**

Temporarily change `MAX_IMPORT_IMAGE_EDGE` to `65536` and re-run both suites.
The bound tests and the rehydrate test must fail. Restore `4096` and re-run.

- [ ] **Step 9: Typecheck and commit**

Run: `npm run typecheck`
Expected: seven projects clean.

```bash
git add packages/editor/src/image-manager packages/editor/src/asset-manager
git commit -m "feat(editor): bound imported and rehydrated image pixels"
```

---

## Task 5: `crop-manager/` — per-image crop session (product-requirements §171)

An interactive crop session for a selected `FabricImage`, built on Vigilia's own
`clipPath` primitive — the `cover` branch of `fitImage` in
`scene-fabric/src/fabric-image.ts` already clips an image with a centred
unscaled-local `Rect`. This is **not** a port of the fork's 3,600-line
`CropFrame`.

**Crop-frame visibility.** The frame is a real Fabric `Rect` so Fabric supplies
dragging and resize handles, but it must not reach history or the saved package.
Two mechanisms, both required:
- `excludeFromExport = true`. `serialiseScene` calls
  `canvas.toObject([...SCENE_PERSISTED_PROPERTIES])`, and Fabric omits excluded
  objects — so the frame stays out of both undo snapshots and Save. Envelope
  validation demands a stable `id` on every scene object, which the frame has
  not got, so leaking it would fail validation outright.
- History suspension for the session's duration, so intermediate frame drags do
  not create undo entries through the `object:modified` handler that
  `createNativeEditor` wires.

**Rotation is refused, not approximated.** `clipPath` coordinates are
image-local and unrotated. Mapping a canvas-space frame through a rotated
image's inverse transform is a larger problem than §171 asks for, so a rotated
image refuses the session with a warning rather than cropping incorrectly.
Record this in `.agents/specs/0014-editor-behaviour-review.md` in Task 13.

**Files:**
- Create: `packages/editor/src/crop-manager/index.ts`
- Test: `packages/editor/src/crop-manager/index.dom.test.ts`
- Modify: `packages/editor/src/history-manager/index.ts`
- Modify: `packages/editor/src/editor-interaction.ts`
- Modify: `packages/editor/src/editor-shell.ts`

**Interfaces:**
- Consumes: `createErrorManager` / `ErrorManager` with category `"crop"`
  (Task 2).
- Produces:
  - `EditorHistory.suspend(): () => void` — increments the existing private
    suspension counter and returns an idempotent release.
  - `EditorInteraction.historyManager.suspend(): () => void`
  - `interface CropRect { readonly width: number; readonly height: number; readonly left: number; readonly top: number }`
  - `function cropClipRect(input: { readonly imageCentreX: number; readonly imageCentreY: number; readonly scaleX: number; readonly scaleY: number; readonly frame: { readonly centreX: number; readonly centreY: number; readonly width: number; readonly height: number } }): CropRect`
  - `interface CropManager { readonly active: boolean; begin(image?: FabricObject): boolean; setAspect(ratio: number | undefined): void; apply(): void; cancel(): void }`
  - `function createCropManager(options: { readonly canvas: Canvas; readonly save: () => void; readonly suspend: () => () => void; readonly errors: ErrorManager }): CropManager`
  - `EditorInteraction.cropManager: CropManager`

- [ ] **Step 1: Write the failing tests**

Create `packages/editor/src/crop-manager/index.dom.test.ts`:

```typescript
// @vitest-environment jsdom
import { Canvas, FabricImage, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createErrorManager } from "../error-manager/index.js";
import { createCropManager, cropClipRect } from "./index.js";

function imageObject(options: Record<string, unknown> = {}): FabricImage {
  const element = document.createElement("img");
  Object.defineProperty(element, "naturalWidth", { value: 400 });
  Object.defineProperty(element, "naturalHeight", { value: 200 });
  const image = new FabricImage(element, { id: "image-1", ...options });
  image.set({ width: 400, height: 200 });
  return image;
}

function manager(canvas: Canvas, save = vi.fn()) {
  return createCropManager({
    canvas,
    save,
    suspend: () => () => {},
    errors: createErrorManager(canvas),
  });
}

describe("cropClipRect", () => {
  it("converts a centred frame to unscaled image-local units", () => {
    expect(
      cropClipRect({
        imageCentreX: 100,
        imageCentreY: 100,
        scaleX: 2,
        scaleY: 2,
        frame: { centreX: 100, centreY: 100, width: 200, height: 100 },
      }),
    ).toEqual({ width: 100, height: 50, left: 0, top: 0 });
  });

  it("offsets a frame that is not centred on the image", () => {
    expect(
      cropClipRect({
        imageCentreX: 100,
        imageCentreY: 100,
        scaleX: 2,
        scaleY: 4,
        frame: { centreX: 140, centreY: 60, width: 80, height: 40 },
      }),
    ).toEqual({ width: 40, height: 10, left: 20, top: -10 });
  });

  it("refuses a non-finite or non-positive scale", () => {
    const base = {
      imageCentreX: 0,
      imageCentreY: 0,
      scaleY: 1,
      frame: { centreX: 0, centreY: 0, width: 10, height: 10 },
    };
    expect(() => cropClipRect({ ...base, scaleX: 0 })).toThrow();
    expect(() => cropClipRect({ ...base, scaleX: Number.NaN })).toThrow();
  });
});

describe("CropManager", () => {
  it("adds an export-excluded frame over the active image", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const image = imageObject();
    canvas.add(image);
    canvas.setActiveObject(image);
    const crop = manager(canvas);

    expect(crop.begin()).toBe(true);
    expect(crop.active).toBe(true);
    const frame = canvas.getObjects().find((object) => object !== image);
    expect(frame).toBeInstanceOf(Rect);
    expect(frame?.excludeFromExport).toBe(true);
  });

  it("refuses to crop a rotated image and warns", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const image = imageObject({ angle: 30 });
    canvas.add(image);
    canvas.setActiveObject(image);
    const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
    const crop = manager(canvas);

    expect(crop.begin()).toBe(false);
    expect(crop.active).toBe(false);
    expect(canvas.getObjects()).toEqual([image]);
    expect(warned).toHaveBeenCalledOnce();
    warned.mockRestore();
  });

  it("refuses to start when the active object is not an image", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const shape = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(shape);
    canvas.setActiveObject(shape);
    const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
    const crop = manager(canvas);

    expect(crop.begin()).toBe(false);
    warned.mockRestore();
  });

  it("commits a clipPath and one history entry on apply", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const image = imageObject();
    canvas.add(image);
    canvas.setActiveObject(image);
    const save = vi.fn();
    const crop = manager(canvas, save);
    crop.begin();

    crop.apply();

    expect(image.clipPath).toBeInstanceOf(Rect);
    expect(crop.active).toBe(false);
    expect(canvas.getObjects()).toEqual([image]);
    expect(save).toHaveBeenCalledOnce();
  });

  it("leaves the image untouched and saves nothing on cancel", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const image = imageObject();
    canvas.add(image);
    canvas.setActiveObject(image);
    const save = vi.fn();
    const crop = manager(canvas, save);
    crop.begin();

    crop.cancel();

    expect(image.clipPath).toBeUndefined();
    expect(crop.active).toBe(false);
    expect(canvas.getObjects()).toEqual([image]);
    expect(save).not.toHaveBeenCalled();
  });

  it("releases history suspension exactly once per session", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const image = imageObject();
    canvas.add(image);
    canvas.setActiveObject(image);
    const release = vi.fn();
    const crop = createCropManager({
      canvas,
      save: vi.fn(),
      suspend: () => release,
      errors: createErrorManager(canvas),
    });

    crop.begin();
    crop.apply();
    crop.apply();

    expect(release).toHaveBeenCalledOnce();
  });

  it("locks the frame to an aspect ratio", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const image = imageObject();
    canvas.add(image);
    canvas.setActiveObject(image);
    const crop = manager(canvas);
    crop.begin();

    crop.setAspect(1);

    const frame = canvas
      .getObjects()
      .find((object): object is Rect => object !== image) as Rect;
    expect(frame.getScaledWidth()).toBeCloseTo(frame.getScaledHeight(), 5);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run packages/editor/src/crop-manager/index.dom.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 3: Add public history suspension**

In `packages/editor/src/history-manager/index.ts`, add this method to
`EditorHistory` directly below `reset()`. The private `#suspended` counter and
its use in `#restore` already exist; this only exposes it.

```typescript
  /** Interactive sessions mutate the canvas before the user commits. */
  suspend(): () => void {
    this.#suspended += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#suspended -= 1;
    };
  }
```

- [ ] **Step 4: Write the crop manager**

Create `packages/editor/src/crop-manager/index.ts`:

```typescript
import { FabricImage, Rect, type Canvas, type FabricObject } from "fabric/es";
import type { ErrorManager } from "../error-manager/index.js";

export interface CropRect {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
}

export interface CropManager {
  readonly active: boolean;
  /** False when the active object cannot host a crop session. */
  begin(image?: FabricObject): boolean;
  setAspect(ratio: number | undefined): void;
  apply(): void;
  cancel(): void;
}

export interface CropManagerOptions {
  readonly canvas: Canvas;
  readonly save: () => void;
  readonly suspend: () => () => void;
  readonly errors: ErrorManager;
}

/**
 * Fabric positions a non-absolute clipPath from the object's centre in unscaled
 * image units, the same convention `fitImage`'s cover branch uses.
 */
export function cropClipRect(input: {
  readonly imageCentreX: number;
  readonly imageCentreY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly frame: {
    readonly centreX: number;
    readonly centreY: number;
    readonly width: number;
    readonly height: number;
  };
}): CropRect {
  const { scaleX, scaleY } = input;
  for (const value of [scaleX, scaleY]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("A crop needs finite, positive image scales.");
    }
  }
  return {
    width: input.frame.width / scaleX,
    height: input.frame.height / scaleY,
    left: (input.frame.centreX - input.imageCentreX) / scaleX,
    top: (input.frame.centreY - input.imageCentreY) / scaleY,
  };
}

export function createCropManager(options: CropManagerOptions): CropManager {
  const { canvas, save, errors } = options;
  let image: FabricImage | undefined;
  let frame: Rect | undefined;
  let release: (() => void) | undefined;
  let aspect: number | undefined;

  const end = (): void => {
    if (frame !== undefined) canvas.remove(frame);
    frame = undefined;
    image = undefined;
    aspect = undefined;
    release?.();
    release = undefined;
    canvas.requestRenderAll();
  };

  return {
    get active(): boolean {
      return frame !== undefined;
    },

    begin(target = canvas.getActiveObject() ?? undefined): boolean {
      if (frame !== undefined) return false;
      if (!(target instanceof FabricImage)) {
        errors.warn("crop", "Select an image before starting a crop.");
        return false;
      }
      if ((target.angle ?? 0) !== 0) {
        errors.warn("crop", "A rotated image cannot be cropped yet.");
        return false;
      }
      const bounds = target.getBoundingRect();
      image = target;
      frame = new Rect({
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        fill: "rgba(0,0,0,0)",
        stroke: "#3b82f6",
        strokeWidth: 1,
        strokeUniform: true,
        excludeFromExport: true,
        hasRotatingPoint: false,
        lockRotation: true,
      });
      release = options.suspend();
      canvas.add(frame);
      canvas.setActiveObject(frame);
      canvas.requestRenderAll();
      return true;
    },

    setAspect(ratio): void {
      aspect = ratio;
      if (frame === undefined || ratio === undefined) return;
      if (!Number.isFinite(ratio) || ratio <= 0) {
        errors.warn("crop", "A crop aspect ratio must be finite and positive.");
        aspect = undefined;
        return;
      }
      frame.set({ scaleY: 1, scaleX: 1, height: frame.getScaledWidth() / ratio });
      frame.setCoords();
      canvas.requestRenderAll();
    },

    apply(): void {
      if (frame === undefined || image === undefined) return;
      const frameBounds = frame.getBoundingRect();
      const imageBounds = image.getBoundingRect();
      const rect = cropClipRect({
        imageCentreX: imageBounds.left + imageBounds.width / 2,
        imageCentreY: imageBounds.top + imageBounds.height / 2,
        scaleX: image.scaleX,
        scaleY: image.scaleY,
        frame: {
          centreX: frameBounds.left + frameBounds.width / 2,
          centreY: frameBounds.top + frameBounds.height / 2,
          width: frameBounds.width,
          height: frameBounds.height,
        },
      });
      image.set(
        "clipPath",
        new Rect({ ...rect, originX: "center", originY: "center" }),
      );
      image.set("dirty", true);
      const cropped = image;
      end();
      canvas.setActiveObject(cropped);
      // Committing is the only point a crop enters undo history.
      save();
    },

    cancel(): void {
      const cancelled = image;
      end();
      if (cancelled !== undefined) canvas.setActiveObject(cancelled);
    },
  };
}
```

`aspect` is assigned so a later resize handler can read it; if Biome reports it
as written-but-never-read, delete the field and keep `setAspect` operating on
the frame directly.

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run packages/editor/src/crop-manager/index.dom.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Compose the manager into the editor contract**

In `packages/editor/src/editor-interaction.ts` add the import:

```typescript
import type { CropManager } from "./crop-manager/index.js";
```

add `suspend(): () => void;` to the `historyManager` member, and add above
`destroy(): void;`:

```typescript
  readonly cropManager: CropManager;
```

In `packages/editor/src/editor-shell.ts` add the import:

```typescript
import { createCropManager } from "./crop-manager/index.js";
```

and inside `createNativeEditor`, extend the returned `historyManager` with
`suspend: () => history.suspend(),` and add, after `errorManager`:

```typescript
    cropManager: createCropManager({
      canvas,
      save,
      suspend: () => history.suspend(),
      errors,
    }),
```

This requires hoisting the error manager above the returned object so both it
and the shell can use it:

```typescript
  const errors = createErrorManager(canvas);
```

and changing the `errorManager:` member to `errorManager: errors,`.

- [ ] **Step 7: Prove the crop frame stays out of persistence**

Append to `packages/editor/src/editor-shell.dom.test.ts`:

```typescript
it("keeps an open crop frame out of the serialised scene", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const shell = await mountEditorShell({
    host,
    artboard: { width: 400, height: 300 },
  });
  const element = document.createElement("img");
  Object.defineProperty(element, "naturalWidth", { value: 100 });
  Object.defineProperty(element, "naturalHeight", { value: 100 });
  const image = new FabricImage(element, { id: "image-1" });
  image.set({ width: 100, height: 100 });
  shell.editor.canvas.add(image);
  shell.editor.canvas.setActiveObject(image);

  expect(shell.editor.cropManager.begin()).toBe(true);
  const scene = serialiseScene(shell.editor.canvas);

  expect(scene.objects).toHaveLength(1);
  expect(scene.objects[0]?.["id"]).toBe("image-1");

  shell.destroy();
  host.remove();
});
```

Extend that file's imports with `FabricImage` from `fabric/es` and
`serialiseScene` from `@vigilia/scene-fabric`.

- [ ] **Step 8: Run the suites and verify they pass**

Run: `npx vitest run packages/editor/src/crop-manager packages/editor/src/editor-shell.dom.test.ts packages/editor/src/history-manager`
Expected: PASS.

- [ ] **Step 9: Disable the exclusion and confirm the test can fail**

Temporarily remove `excludeFromExport: true` from the frame and re-run
`editor-shell.dom.test.ts`. The persistence test must fail with two objects.
Restore it and re-run.

- [ ] **Step 10: Typecheck and commit**

Run: `npm run typecheck`
Expected: seven projects clean.

```bash
git add packages/editor/src/crop-manager packages/editor/src/history-manager packages/editor/src/editor-interaction.ts packages/editor/src/editor-shell.ts packages/editor/src/editor-shell.dom.test.ts
git commit -m "feat(editor): add per-image crop session over the clipPath primitive"
```

---

## Task 6: `deletion-manager/` — delete the active object or selection

Deliberately minimal relative to the fork: **no** group-ungroup-on-delete
recursion and **no** delete-guard hook, because neither concept exists in
Vigilia today. Build what Vigilia has, not what the fork had.

**Files:**
- Create: `packages/editor/src/deletion-manager/index.ts`
- Test: `packages/editor/src/deletion-manager/index.dom.test.ts`
- Modify: `packages/editor/src/editor-interaction.ts`
- Modify: `packages/editor/src/editor-shell.ts`
- Modify: `packages/editor/src/editor-session.ts`

**Interfaces:**
- Consumes: `ProductShortcutId` accepts `"edit.delete"` (Task 3);
  `EditorInteraction.errorManager` (Task 2).
- Produces:
  - `interface DeletionManager { deleteActive(): boolean }` — true when
    something was removed.
  - `function createDeletionManager(canvas: Canvas, save: () => void): DeletionManager`
  - `EditorInteraction.deletionManager: DeletionManager`

**Behaviour.** An `ActiveSelection` removes every object it holds, not the
selection wrapper. A locked object is skipped: `objectLockManager` sets
`selectable: false, evented: false, locked: true`, and deleting through a
keyboard shortcut would otherwise bypass the lock. Deleting while Fabric is
editing text must not fire at all — Task 3's dispatcher already guarantees that,
because `edit.delete` has no modifier.

- [ ] **Step 1: Write the failing tests**

Create `packages/editor/src/deletion-manager/index.dom.test.ts`:

```typescript
// @vitest-environment jsdom
import { ActiveSelection, Canvas, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createDeletionManager } from "./index.js";

describe("DeletionManager", () => {
  it("removes the active object and saves once", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape" });
    canvas.add(object);
    canvas.setActiveObject(object);
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(true);

    expect(canvas.getObjects()).toEqual([]);
    expect(canvas.getActiveObject()).toBeUndefined();
    expect(save).toHaveBeenCalledOnce();
  });

  it("removes every member of an active selection, not the wrapper", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const first = new Rect({ id: "a" });
    const second = new Rect({ id: "b" });
    canvas.add(first, second);
    canvas.setActiveObject(new ActiveSelection([first, second], { canvas }));
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(true);

    expect(canvas.getObjects()).toEqual([]);
    expect(save).toHaveBeenCalledOnce();
  });

  it("skips a locked object and reports that nothing was deleted", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", locked: true });
    canvas.add(object);
    canvas.setActiveObject(object);
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(false);

    expect(canvas.getObjects()).toEqual([object]);
    expect(save).not.toHaveBeenCalled();
  });

  it("deletes the unlocked members of a mixed selection", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const free = new Rect({ id: "a" });
    const locked = new Rect({ id: "b", locked: true });
    canvas.add(free, locked);
    canvas.setActiveObject(new ActiveSelection([free, locked], { canvas }));
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(true);

    expect(canvas.getObjects()).toEqual([locked]);
    expect(save).toHaveBeenCalledOnce();
  });

  it("does nothing and saves nothing with an empty selection", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const save = vi.fn();

    expect(createDeletionManager(canvas, save).deleteActive()).toBe(false);

    expect(save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run packages/editor/src/deletion-manager/index.dom.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/editor/src/deletion-manager/index.ts`:

```typescript
import { ActiveSelection, type Canvas, type FabricObject } from "fabric/es";

export interface DeletionManager {
  /** True when at least one object was removed. */
  deleteActive(): boolean;
}

/** A keyboard delete must respect the same lock the panels honour. */
function deletable(object: FabricObject): boolean {
  return object.get("locked") !== true;
}

export function createDeletionManager(
  canvas: Canvas,
  save: () => void,
): DeletionManager {
  return {
    deleteActive(): boolean {
      const active = canvas.getActiveObject();
      if (active === undefined) return false;
      const targets = (
        active instanceof ActiveSelection ? active.getObjects() : [active]
      ).filter(deletable);
      if (targets.length === 0) return false;

      canvas.discardActiveObject();
      canvas.remove(...targets);
      canvas.requestRenderAll();
      save();
      return true;
    },
  };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run packages/editor/src/deletion-manager/index.dom.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Compose it into the editor contract**

In `packages/editor/src/editor-interaction.ts` add the import:

```typescript
import type { DeletionManager } from "./deletion-manager/index.js";
```

and above `destroy(): void;`:

```typescript
  readonly deletionManager: DeletionManager;
```

In `packages/editor/src/editor-shell.ts` add the import:

```typescript
import { createDeletionManager } from "./deletion-manager/index.js";
```

and in `createNativeEditor`'s returned object:

```typescript
    deletionManager: createDeletionManager(canvas, save),
```

- [ ] **Step 6: Bind the shortcut**

In `packages/editor/src/editor-session.ts`, beside the existing
`this.#shortcuts.register("edit.undo", ...)` calls in the constructor:

```typescript
    this.#shortcuts.register("edit.delete", () => {
      options.shell.editor.deletionManager.deleteActive();
    });
```

- [ ] **Step 7: Run the editor suite and typecheck**

Run: `npx vitest run packages/editor`
Expected: PASS.

Run: `npm run typecheck`
Expected: seven projects clean.

- [ ] **Step 8: Disable the lock guard and confirm the test can fail**

Temporarily make `deletable` return `true` unconditionally and re-run the
deletion suite. The two lock tests must fail. Restore the guard and re-run.

- [ ] **Step 9: Commit**

```bash
git add packages/editor/src/deletion-manager packages/editor/src/editor-interaction.ts packages/editor/src/editor-shell.ts packages/editor/src/editor-session.ts
git commit -m "feat(editor): add selection deletion with a Delete shortcut"
```

---

## Task 7: `controls-manager/` — selection and rotation handle styling

Ported from the fork's `ControlsCustomizer.apply()`
(`src/editor/customized-controls/index.ts:79-104`). The fork's own `apply()`
is, verbatim:

```ts
  public static apply(): void {
    const objectControls = controlsUtils.createObjectDefaultControls()
    ControlsCustomizer.applyControlOverrides(objectControls)
    InteractiveFabricObject.ownDefaults.controls = objectControls

    const textboxControls = controlsUtils.createTextboxDefaultControls()
    ControlsCustomizer.applyControlOverrides(textboxControls)
    if (textboxControls.mt) { textboxControls.mt.visible = false }
    if (textboxControls.mb) { textboxControls.mb.visible = false }
    ControlsCustomizer.wrapWidthControl(textboxControls.ml)
    ControlsCustomizer.wrapWidthControl(textboxControls.mr)
    Textbox.ownDefaults.controls = textboxControls

    ControlsCustomizer.patchActiveSelectionBounds()

    InteractiveFabricObject.ownDefaults.snapAngle = 1
  }
```

**Two paths are excluded, as spec 0017 requires.**
- `patchActiveSelectionBounds()` monkey-patches two *private* Fabric internals
  (`ActiveSelection.prototype._calcBoundsFromObjects`,
  `_onAfterObjectsChange`) and `FitContentLayout.prototype.calcBoundingBox`
  globally. It exists to serve the fork's shape-composite types, which Vigilia
  does not have. Excluding it also drops its dependency on the fork's
  shape-manager.
- `wrapWidthControl()` guards the fork's `BackgroundTextbox` width handles.
  Vigilia has no such type. Note the coupling carefully: dropping the wrapper
  removes only the two `wrapWidthControl` calls. The rest of the textbox block,
  including hiding `mt` and `mb`, is independent and **is** ported.

**The fork sets no `cornerStyle`.** Handle appearance comes entirely from
per-control `render` functions. The fork's rotation glyph is an inline base64
SVG; this port draws the glyph with canvas path operations instead, so no
opaque binary blob enters source.

**Files:**
- Create: `packages/editor/src/controls-manager/index.ts`
- Create: `packages/editor/src/controls-manager/renderers.ts`
- Test: `packages/editor/src/controls-manager/index.test.ts`
- Modify: `packages/editor/src/editor-shell.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `function applyEditorControls(): void` — idempotent, safe to call
  on every editor mount.

Fabric reads `ownDefaults` when an object is constructed, so this must run
before any object exists. `createNativeEditor` calls it before
`new Canvas(...)`, matching the fork, which calls it at
`src/editor/index.ts:254` immediately before `new Canvas(...)` on line 256.

- [ ] **Step 1: Write the failing test**

Create `packages/editor/src/controls-manager/index.test.ts`:

```typescript
import { ActiveSelection, InteractiveFabricObject, Textbox } from "fabric/es";
import { describe, expect, it } from "vitest";
import { applyEditorControls } from "./index.js";

describe("applyEditorControls", () => {
  it("snaps rotation to whole degrees", () => {
    applyEditorControls();
    expect(InteractiveFabricObject.ownDefaults.snapAngle).toBe(1);
  });

  it("sizes corner handles square and edge handles as rects", () => {
    applyEditorControls();
    const controls = InteractiveFabricObject.ownDefaults.controls;

    expect(controls?.["tl"]).toMatchObject({ sizeX: 12, sizeY: 12 });
    expect(controls?.["br"]).toMatchObject({ sizeX: 12, sizeY: 12 });
    expect(controls?.["ml"]).toMatchObject({ sizeX: 8, sizeY: 20 });
    expect(controls?.["mt"]).toMatchObject({ sizeX: 20, sizeY: 8 });
  });

  it("gives the rotation handle a grab cursor and an offset", () => {
    applyEditorControls();
    const rotate = InteractiveFabricObject.ownDefaults.controls?.["mtr"];

    expect(rotate?.cursorStyle).toBe("grab");
    expect(rotate).toMatchObject({ sizeX: 32, sizeY: 32, offsetY: -32 });
  });

  it("hides the textbox vertical-resize handles", () => {
    applyEditorControls();
    const controls = Textbox.ownDefaults.controls;

    expect(controls?.["mt"]?.visible).toBe(false);
    expect(controls?.["mb"]?.visible).toBe(false);
    expect(controls?.["ml"]?.visible).not.toBe(false);
  });

  it("leaves Fabric's ActiveSelection internals unpatched", () => {
    const before = ActiveSelection.prototype.onDeselect;
    applyEditorControls();

    // The fork patched private layout internals for its shape-composite types.
    expect(ActiveSelection.prototype.onDeselect).toBe(before);
  });

  it("is idempotent", () => {
    applyEditorControls();
    const first = InteractiveFabricObject.ownDefaults.controls;
    applyEditorControls();

    expect(InteractiveFabricObject.ownDefaults.controls).toBe(first);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run packages/editor/src/controls-manager/index.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 3: Write the renderers**

Create `packages/editor/src/controls-manager/renderers.ts`:

```typescript
import { degreesToRadians, type Control } from "fabric/es";

/** Editor chrome, deliberately not theme palette: handles are not document paint. */
const STROKE = "#3D8BF4";
const FILL = "#FFFFFF";
const ROTATE_BACKGROUND = "#2B2D33";
const LINE_WIDTH = 1;

export const SQUARE_SIZE = 12;
export const SQUARE_RADIUS = 2;
export const VERTICAL_WIDTH = 8;
export const VERTICAL_HEIGHT = 20;
export const HORIZONTAL_WIDTH = 20;
export const HORIZONTAL_HEIGHT = 8;
export const PILL_RADIUS = 100;
export const ROTATE_DIAMETER = 32;

type Renderer = NonNullable<Control["render"]>;

/** `roundRect` is unavailable in jsdom, where handles are never painted. */
function roundedPath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(-width / 2, -height / 2, width, height, radius);
  } else {
    ctx.rect(-width / 2, -height / 2, width, height);
  }
}

export function roundedHandle(
  width: number,
  height: number,
  radius: number,
): Renderer {
  return (ctx, left, top, _styleOverride, fabricObject) => {
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(degreesToRadians(fabricObject.angle));
    ctx.fillStyle = FILL;
    ctx.strokeStyle = STROKE;
    ctx.lineWidth = LINE_WIDTH;
    roundedPath(ctx, width, height, radius);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
}

/** Drawn rather than embedded so no base64 asset enters source. */
export const renderRotationHandle: Renderer = (
  ctx,
  left,
  top,
  _styleOverride,
  fabricObject,
) => {
  const radius = ROTATE_DIAMETER / 2;
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate(degreesToRadians(fabricObject.angle));
  ctx.fillStyle = ROTATE_BACKGROUND;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = FILL;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius / 2, Math.PI * 0.25, Math.PI * 1.75);
  ctx.stroke();
  ctx.fillStyle = FILL;
  ctx.beginPath();
  ctx.moveTo(radius / 2 + 3, -3);
  ctx.lineTo(radius / 2 - 3, -3);
  ctx.lineTo(radius / 2, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};
```

- [ ] **Step 4: Write the control application**

Create `packages/editor/src/controls-manager/index.ts`:

```typescript
import {
  InteractiveFabricObject,
  Textbox,
  controlsUtils,
  type Control,
} from "fabric/es";
import {
  HORIZONTAL_HEIGHT,
  HORIZONTAL_WIDTH,
  PILL_RADIUS,
  ROTATE_DIAMETER,
  SQUARE_RADIUS,
  SQUARE_SIZE,
  VERTICAL_HEIGHT,
  VERTICAL_WIDTH,
  renderRotationHandle,
  roundedHandle,
} from "./renderers.js";

const CORNER = {
  render: roundedHandle(SQUARE_SIZE, SQUARE_SIZE, SQUARE_RADIUS),
  sizeX: SQUARE_SIZE,
  sizeY: SQUARE_SIZE,
  offsetX: 0,
  offsetY: 0,
} as const satisfies Partial<Control>;

const VERTICAL_EDGE = {
  render: roundedHandle(VERTICAL_WIDTH, VERTICAL_HEIGHT, PILL_RADIUS),
  sizeX: VERTICAL_WIDTH,
  sizeY: VERTICAL_HEIGHT,
  offsetX: 0,
  offsetY: 0,
} as const satisfies Partial<Control>;

const HORIZONTAL_EDGE = {
  render: roundedHandle(HORIZONTAL_WIDTH, HORIZONTAL_HEIGHT, PILL_RADIUS),
  sizeX: HORIZONTAL_WIDTH,
  sizeY: HORIZONTAL_HEIGHT,
  offsetX: 0,
  offsetY: 0,
} as const satisfies Partial<Control>;

const ROTATION = {
  render: renderRotationHandle,
  sizeX: ROTATE_DIAMETER,
  sizeY: ROTATE_DIAMETER,
  offsetX: 0,
  offsetY: -ROTATE_DIAMETER,
  cursorStyle: "grab",
} as const satisfies Partial<Control>;

const OVERRIDES: Readonly<Record<string, Partial<Control>>> = {
  tl: CORNER,
  tr: CORNER,
  bl: CORNER,
  br: CORNER,
  ml: VERTICAL_EDGE,
  mr: VERTICAL_EDGE,
  mt: HORIZONTAL_EDGE,
  mb: HORIZONTAL_EDGE,
  mtr: ROTATION,
};

function applyOverrides(controls: Record<string, Control>): void {
  for (const [key, override] of Object.entries(OVERRIDES)) {
    const control = controls[key];
    if (control === undefined) continue;
    Object.assign(control, override);
  }
  const rotate = controls["mtr"];
  if (rotate === undefined) return;
  rotate.mouseDownHandler = (_eventData, transform) => {
    const { target } = transform;
    if (target.get("locked") !== true && !target.lockRotation) {
      target.canvas?.setCursor("grabbing");
    }
    return true;
  };
}

let applied = false;

/**
 * Fabric reads `ownDefaults` when an object is constructed, so this runs before
 * the canvas exists. Excludes the fork's ActiveSelection bounds patch and its
 * Textbox width-control wrapping; neither has a Vigilia type to serve.
 */
export function applyEditorControls(): void {
  if (applied) return;
  applied = true;

  const objectControls = controlsUtils.createObjectDefaultControls();
  applyOverrides(objectControls);
  InteractiveFabricObject.ownDefaults.controls = objectControls;

  const textboxControls = controlsUtils.createTextboxDefaultControls();
  applyOverrides(textboxControls);
  // Vertical resize would fight Textbox's own height derivation.
  if (textboxControls["mt"] !== undefined)
    textboxControls["mt"].visible = false;
  if (textboxControls["mb"] !== undefined)
    textboxControls["mb"].visible = false;
  Textbox.ownDefaults.controls = textboxControls;

  InteractiveFabricObject.ownDefaults.snapAngle = 1;
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npx vitest run packages/editor/src/controls-manager/index.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Apply the defaults at mount**

In `packages/editor/src/editor-shell.ts` add the import:

```typescript
import { applyEditorControls } from "./controls-manager/index.js";
```

and make it the first statement of `createNativeEditor`, above
`const element = document.createElement("canvas");`:

```typescript
  applyEditorControls();
```

- [ ] **Step 7: Run the editor suite and typecheck**

Run: `npx vitest run packages/editor`
Expected: PASS. Watch for pre-existing tests that assert default Fabric control
geometry; if one fails, the handle sizes are now Vigilia's, and the assertion
should be updated to the new values rather than the defaults restored.

Run: `npm run typecheck`
Expected: seven projects clean.

- [ ] **Step 8: Commit**

```bash
git add packages/editor/src/controls-manager packages/editor/src/editor-shell.ts
git commit -m "feat(editor): restore fork selection and rotation handle styling"
```

---

## Task 8: `clipboard-manager/` — copy, cut, paste and duplicate

Adapted from the fork's `ClipboardManager`
(`src/editor/clipboard-manager/index.ts`, 744 lines). Read the original with:

```bash
git -C D:/git-repos/fabricjs-image-editor show 9efdd78a:src/editor/clipboard-manager/index.ts
```

**Adaptations, each with its reason.**

| Fork behaviour | Vigilia | Why |
|---|---|---|
| `_materializeCloneGeometry` calls `textManager.commitStandaloneTextScale` (`:379`, `:390`) and `shapeManager.commitRehydratedShapeLayout` (`:382`, `:393`) | `object.setCoords()` | Neither concept exists in Vigilia's plain-object model. Spec 0017 requires this substitution. |
| `nanoid()` for new ids | `crypto.randomUUID()` | Already Vigilia's id source in `text-manager` and `chart-manager`; adds no dependency. |
| `CLIPBOARD_CLONE_OBJECT_KEYS` (fork's own ~45-prop list incl. `shapeComposite`) | `SCENE_PERSISTED_PROPERTIES` from `@vigilia/scene-fabric` | Already the single owner of "what survives a round trip". A clone that carries less would silently drop paint, text and asset references. |
| `editor.options.prepareObjectClone` hook and `customData` deep-clone | dropped | No such option or property in Vigilia. |
| `FileReader.readAsDataURL` then import from a data URL | pass the `File` straight to `importImage` | `DataTransferItem.getAsFile()` already returns a `File`, which is what `importImage` takes. The data-URL hop is pure overhead. |
| Russian error messages | English | Global constraint. |

**Paste is owned by the document `paste` event, not a shortcut.** Task 3
deliberately leaves `Ctrl+V` unbound so the browser fires `paste` with
`clipboardData`; that is the only way to read an image copied from another
application. Copy, cut and duplicate go through `ShortcutManager`.

**Pasted charts must rehydrate.** A cloned `VigiliaChart` carries no engine or
samples, exactly like a revived one. `ChartManager` already owns that repair and
already runs it on `editor:history-state-loaded`. This task makes it also listen
for `editor:object-pasted` rather than inventing a second hydration path.

**Files:**
- Create: `packages/editor/src/clipboard-manager/index.ts`
- Test: `packages/editor/src/clipboard-manager/index.dom.test.ts`
- Modify: `packages/editor/src/editor-interaction.ts`
- Modify: `packages/editor/src/editor-shell.ts`
- Modify: `packages/editor/src/editor-session.ts`
- Modify: `packages/editor/src/chart-manager/index.ts`

**Interfaces:**
- Consumes: `ErrorManager` with category `"clipboard"` (Task 2);
  `ProductShortcutId` accepting `"edit.copy"`, `"edit.cut"`,
  `"edit.duplicate"` (Task 3); `ImageManager.importImage` (Task 4);
  `DeletionManager.deleteActive` (Task 6).
- Produces:
  - `interface ClipboardManager { copy(): Promise<boolean>; cut(): Promise<boolean>; paste(): Promise<boolean>; duplicate(object?: FabricObject): Promise<boolean>; destroy(): void }`
  - `function createClipboardManager(options: { readonly canvas: Canvas; readonly save: () => void; readonly errors: ErrorManager; readonly deletion: DeletionManager; readonly importImage: ImageManager["importImage"] }): ClipboardManager`
  - `EditorInteraction.clipboardManager: ClipboardManager`
  - Canvas event `"editor:object-pasted"`.

- [ ] **Step 1: Write the failing tests**

Create `packages/editor/src/clipboard-manager/index.dom.test.ts`:

```typescript
// @vitest-environment jsdom
import { ActiveSelection, Canvas, Rect } from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createErrorManager } from "../error-manager/index.js";
import { createDeletionManager } from "../deletion-manager/index.js";
import { createClipboardManager } from "./index.js";

function setup() {
  const canvas = new Canvas(document.createElement("canvas"));
  const save = vi.fn();
  const importImage = vi.fn(async () => null);
  const clipboard = createClipboardManager({
    canvas,
    save,
    errors: createErrorManager(canvas),
    deletion: createDeletionManager(canvas, save),
    importImage,
  });
  return { canvas, clipboard, save, importImage };
}

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async () => {}), write: vi.fn(async () => {}) },
  });
});

describe("ClipboardManager", () => {
  it("pastes a clone offset by ten on both axes with a fresh id", async () => {
    const { canvas, clipboard } = setup();
    const object = new Rect({ id: "shape", left: 20, top: 30, width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);

    expect(await clipboard.copy()).toBe(true);
    expect(await clipboard.paste()).toBe(true);

    const objects = canvas.getObjects();
    expect(objects).toHaveLength(2);
    const pasted = objects[1]!;
    expect(pasted.left).toBe(30);
    expect(pasted.top).toBe(40);
    expect(pasted.get("id")).not.toBe("shape");
    expect(pasted.get("id")).toMatch(/^rect-/);
  });

  it("duplicates in one action without touching the clipboard", async () => {
    const { canvas, clipboard } = setup();
    const object = new Rect({ id: "shape", left: 0, top: 0, width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);

    expect(await clipboard.duplicate()).toBe(true);

    expect(canvas.getObjects()).toHaveLength(2);
    expect(canvas.getObjects()[1]?.left).toBe(10);
  });

  it("cuts by copying then deleting", async () => {
    const { canvas, clipboard } = setup();
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);

    expect(await clipboard.cut()).toBe(true);
    expect(canvas.getObjects()).toEqual([]);

    expect(await clipboard.paste()).toBe(true);
    expect(canvas.getObjects()).toHaveLength(1);
  });

  it("refuses to copy a locked object", async () => {
    const { canvas, clipboard } = setup();
    const object = new Rect({ id: "shape", locked: true });
    canvas.add(object);
    canvas.setActiveObject(object);

    expect(await clipboard.copy()).toBe(false);
  });

  it("pastes every member of a copied selection", async () => {
    const { canvas, clipboard } = setup();
    const first = new Rect({ id: "a", width: 10, height: 10 });
    const second = new Rect({ id: "b", left: 40, width: 10, height: 10 });
    canvas.add(first, second);
    canvas.setActiveObject(new ActiveSelection([first, second], { canvas }));

    expect(await clipboard.copy()).toBe(true);
    expect(await clipboard.paste()).toBe(true);

    expect(canvas.getObjects()).toHaveLength(4);
    const ids = canvas.getObjects().map((object) => object.get("id"));
    expect(new Set(ids).size).toBe(4);
  });

  it("fires editor:object-pasted so charts can rehydrate", async () => {
    const { canvas, clipboard } = setup();
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);
    const pasted = vi.fn();
    canvas.on("editor:object-pasted" as never, pasted as never);

    await clipboard.copy();
    await clipboard.paste();

    expect(pasted).toHaveBeenCalledOnce();
  });

  it("imports an image file pasted from another application", async () => {
    const { canvas, importImage } = setup();
    const file = new File([new Uint8Array([1])], "shot.png", {
      type: "image/png",
    });
    const event = new Event("paste") as Event & { clipboardData: unknown };
    Object.defineProperty(event, "clipboardData", {
      value: {
        items: [{ type: "image/png", getAsFile: () => file }],
        getData: () => "",
      },
    });

    document.dispatchEvent(event);
    await vi.waitFor(() => expect(importImage).toHaveBeenCalledOnce());

    expect(importImage).toHaveBeenCalledWith({ source: file });
    canvas.dispose();
  });

  it("stops listening for paste after destroy", async () => {
    const { clipboard, importImage } = setup();
    clipboard.destroy();
    const file = new File([new Uint8Array([1])], "shot.png", {
      type: "image/png",
    });
    const event = new Event("paste") as Event;
    Object.defineProperty(event, "clipboardData", {
      value: {
        items: [{ type: "image/png", getAsFile: () => file }],
        getData: () => "",
      },
    });

    document.dispatchEvent(event);

    expect(importImage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run packages/editor/src/clipboard-manager/index.dom.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 3: Write the manager**

Create `packages/editor/src/clipboard-manager/index.ts`:

```typescript
import {
  ActiveSelection,
  Group,
  type Canvas,
  type FabricObject,
} from "fabric/es";
import { SCENE_PERSISTED_PROPERTIES } from "@vigilia/scene-fabric";
import type { ErrorManager } from "../error-manager/index.js";
import type { DeletionManager } from "../deletion-manager/index.js";
import type { ImageManager } from "../image-manager/index.js";

const PASTE_OFFSET = 10;

export interface ClipboardManager {
  copy(): Promise<boolean>;
  cut(): Promise<boolean>;
  paste(): Promise<boolean>;
  duplicate(object?: FabricObject): Promise<boolean>;
  destroy(): void;
}

export interface ClipboardManagerOptions {
  readonly canvas: Canvas;
  readonly save: () => void;
  readonly errors: ErrorManager;
  readonly deletion: DeletionManager;
  readonly importImage: ImageManager["importImage"];
}

/** A pasted object needs its own id; a duplicate id fails envelope validation. */
function reassignIds(object: FabricObject): void {
  object.set("id", `${object.type}-${crypto.randomUUID()}`);
  if (object instanceof Group) {
    for (const child of object.getObjects()) reassignIds(child);
  }
}

/** Replaces the fork's text/shape commit hooks; Vigilia objects only need coords. */
function settle(object: FabricObject): void {
  if (object instanceof ActiveSelection || object instanceof Group) {
    for (const child of object.getObjects()) child.setCoords();
  }
  object.setCoords();
}

async function cloneOf(object: FabricObject): Promise<FabricObject> {
  const clone = await object.clone([...SCENE_PERSISTED_PROPERTIES]);
  settle(clone);
  return clone;
}

export function createClipboardManager(
  options: ClipboardManagerOptions,
): ClipboardManager {
  const { canvas, save, errors, deletion } = options;
  let held: FabricObject | undefined;

  const add = (clone: FabricObject): void => {
    canvas.discardActiveObject();
    if (clone instanceof ActiveSelection) {
      for (const child of clone.getObjects()) canvas.add(child);
      clone.canvas = canvas;
    } else {
      canvas.add(clone);
    }
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
    canvas.fire("editor:object-pasted" as never, { object: clone } as never);
    save();
  };

  const place = async (source: FabricObject): Promise<boolean> => {
    const clone = await cloneOf(source);
    reassignIds(clone);
    clone.set({
      left: clone.left + PASTE_OFFSET,
      top: clone.top + PASTE_OFFSET,
    });
    settle(clone);
    add(clone);
    return true;
  };

  const onPaste = (event: Event): void => {
    const data = (event as ClipboardEvent).clipboardData;
    const items = data?.items;
    if (data === null || data === undefined || items === undefined) {
      void manager.paste();
      return;
    }
    const file = [...items]
      .map((item) => (item.type.startsWith("image/") ? item.getAsFile() : null))
      .find((candidate): candidate is File => candidate !== null);
    if (file !== undefined) {
      event.preventDefault();
      void options.importImage({ source: file }).catch((error: unknown) => {
        errors.error("clipboard", "Could not paste that image.", error);
      });
      return;
    }
    void manager.paste();
  };

  const manager: ClipboardManager = {
    async copy(): Promise<boolean> {
      const active = canvas.getActiveObject();
      if (active === undefined || active.get("locked") === true) return false;
      try {
        held = await cloneOf(active);
        return true;
      } catch (error) {
        errors.error("clipboard", "Could not copy that selection.", error);
        return false;
      }
    },

    async cut(): Promise<boolean> {
      if (!(await manager.copy())) return false;
      return deletion.deleteActive();
    },

    async paste(): Promise<boolean> {
      if (held === undefined) return false;
      try {
        return await place(held);
      } catch (error) {
        errors.error("clipboard", "Could not paste the clipboard.", error);
        return false;
      }
    },

    async duplicate(object = canvas.getActiveObject() ?? undefined): Promise<boolean> {
      if (object === undefined || object.get("locked") === true) return false;
      try {
        return await place(object);
      } catch (error) {
        errors.error("clipboard", "Could not duplicate that selection.", error);
        return false;
      }
    },

    destroy(): void {
      document.removeEventListener("paste", onPaste);
      held = undefined;
    },
  };

  document.addEventListener("paste", onPaste);
  return manager;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run packages/editor/src/clipboard-manager/index.dom.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Compose it into the editor contract**

In `packages/editor/src/editor-interaction.ts` add the import and the member:

```typescript
import type { ClipboardManager } from "./clipboard-manager/index.js";
```
```typescript
  readonly clipboardManager: ClipboardManager;
```

In `packages/editor/src/editor-shell.ts` add the import and build it after the
deletion and image managers, reusing the hoisted `errors` from Task 5:

```typescript
import { createClipboardManager } from "./clipboard-manager/index.js";
```
```typescript
  const deletion = createDeletionManager(canvas, save);
  const images = createImageManager(canvas, save);
```

then replace the `deletionManager:` and `imageManager:` members with
`deletionManager: deletion,` and `imageManager: images,`, and add:

```typescript
    clipboardManager: createClipboardManager({
      canvas,
      save,
      errors,
      deletion,
      importImage: (input) => images.importImage(input),
    }),
```

Add `editor.clipboardManager.destroy();` to the shell's `destroy()`, before
`editor.destroy()`.

- [ ] **Step 6: Bind the shortcuts**

In `packages/editor/src/editor-session.ts`, beside the other registrations:

```typescript
    this.#shortcuts.register("edit.copy", () => {
      void options.shell.editor.clipboardManager.copy();
    });
    this.#shortcuts.register("edit.cut", () => {
      void options.shell.editor.clipboardManager.cut();
    });
    this.#shortcuts.register("edit.duplicate", () => {
      void options.shell.editor.clipboardManager.duplicate();
    });
```

- [ ] **Step 7: Rehydrate pasted charts**

In `packages/editor/src/chart-manager/index.ts`, beside the existing
`editor:history-state-loaded` subscription in the constructor:

```typescript
    this.#editor.canvas.on(
      "editor:object-pasted" as never,
      this.#hydrateRevivedCharts,
    );
```

and the matching `off` in `destroy()`:

```typescript
    this.#editor.canvas.off(
      "editor:object-pasted" as never,
      this.#hydrateRevivedCharts,
    );
```

- [ ] **Step 8: Prove a pasted chart rehydrates**

Append to `packages/editor/src/chart-manager/index.dom.test.ts`, following the
listener-capture pattern the file already uses for
`editor:history-state-loaded`:

```typescript
it("rehydrates charts when an object is pasted", () => {
  listeners.get("editor:object-pasted")!();

  expect(setOption).toHaveBeenCalled();
});
```

Match the surrounding test's setup exactly; if that file captures listeners
under a different local name, use the name it already defines.

- [ ] **Step 9: Run the editor suite and typecheck**

Run: `npx vitest run packages/editor`
Expected: PASS.

Run: `npm run typecheck`
Expected: seven projects clean.

- [ ] **Step 10: Disable the id reassignment and confirm the test can fail**

Temporarily make `reassignIds` a no-op and re-run the clipboard suite. The
fresh-id and selection-paste tests must fail. Restore it and re-run.

- [ ] **Step 11: Commit**

```bash
git add packages/editor/src/clipboard-manager packages/editor/src/chart-manager packages/editor/src/editor-interaction.ts packages/editor/src/editor-shell.ts packages/editor/src/editor-session.ts
git commit -m "feat(editor): add OS clipboard copy, cut, paste and duplicate"
```

---

## Task 9: `grouping-manager/` — group and ungroup

Ported from the fork's `GroupingManager`
(`src/editor/grouping-manager/index.ts`, 232 lines):

```bash
git -C D:/git-repos/fabricjs-image-editor show 9efdd78a:src/editor/grouping-manager/index.ts
```

Required by product-requirements §57 (groups keep and compose transforms;
group/ungroup preserves world appearance) and §61.

**Adaptations.** The fork's `_materializeUngroupedObject` calls
`textManager.commitStandaloneTextScale` (`:111`) and
`shapeManager.commitRehydratedShapeLayout` (`:114`), and already falls back to
`object.setCoords()` at `:118` when neither commits. The whole method therefore
collapses to that one call, and the `shapeComposite` / `textScale` computation
at `:100-109` goes with it. `group()` has no hook call sites. `nanoid()` becomes
`crypto.randomUUID()`. The fork's `historyManager.suspendHistory()` /
`resumeHistory()` pair becomes the `suspend()` release function added in Task 5.

**Files:**
- Create: `packages/editor/src/grouping-manager/index.ts`
- Test: `packages/editor/src/grouping-manager/index.dom.test.ts`
- Modify: `packages/editor/src/editor-interaction.ts`
- Modify: `packages/editor/src/editor-shell.ts`
- Modify: `packages/editor/src/editor-session.ts`

**Interfaces:**
- Consumes: `EditorInteraction.historyManager.suspend()` (Task 5);
  `ProductShortcutId` accepting `"edit.group"` / `"edit.ungroup"` (Task 3).
- Produces:
  - `interface GroupingManager { group(): Group | undefined; ungroup(): readonly FabricObject[] | undefined }`
  - `function createGroupingManager(options: { readonly canvas: Canvas; readonly save: () => void; readonly suspend: () => () => void }): GroupingManager`
  - `EditorInteraction.groupingManager: GroupingManager`

- [ ] **Step 1: Write the failing tests**

Create `packages/editor/src/grouping-manager/index.dom.test.ts`:

```typescript
// @vitest-environment jsdom
import { ActiveSelection, Canvas, Group, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createGroupingManager } from "./index.js";

function setup() {
  const canvas = new Canvas(document.createElement("canvas"));
  const save = vi.fn();
  const release = vi.fn();
  const grouping = createGroupingManager({
    canvas,
    save,
    suspend: () => release,
  });
  return { canvas, grouping, save, release };
}

describe("GroupingManager", () => {
  it("groups the active selection into one identified group", () => {
    const { canvas, grouping, save, release } = setup();
    const first = new Rect({ id: "a", width: 10, height: 10 });
    const second = new Rect({ id: "b", left: 40, width: 10, height: 10 });
    canvas.add(first, second);
    canvas.setActiveObject(new ActiveSelection([first, second], { canvas }));

    const group = grouping.group();

    expect(group).toBeInstanceOf(Group);
    expect(group?.get("id")).toMatch(/^group-/);
    expect(canvas.getObjects()).toEqual([group]);
    expect(group?.getObjects()).toHaveLength(2);
    expect(save).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it("refuses to group fewer than two objects", () => {
    const { canvas, grouping, save } = setup();
    const only = new Rect({ id: "a", width: 10, height: 10 });
    canvas.add(only);
    canvas.setActiveObject(only);

    expect(grouping.group()).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });

  it("ungroups the active group back onto the canvas", () => {
    const { canvas, grouping, save } = setup();
    const first = new Rect({ id: "a", width: 10, height: 10 });
    const second = new Rect({ id: "b", left: 40, width: 10, height: 10 });
    const group = new Group([first, second], { id: "group-1" });
    canvas.add(group);
    canvas.setActiveObject(group);

    const released = grouping.ungroup();

    expect(released).toHaveLength(2);
    expect(canvas.getObjects()).toHaveLength(2);
    expect(canvas.getObjects()).not.toContain(group);
    expect(save).toHaveBeenCalledOnce();
  });

  it("preserves world position through a group and ungroup round trip", () => {
    const { canvas, grouping } = setup();
    const first = new Rect({ id: "a", left: 10, top: 20, width: 10, height: 10 });
    const second = new Rect({ id: "b", left: 60, top: 80, width: 10, height: 10 });
    canvas.add(first, second);
    canvas.setActiveObject(new ActiveSelection([first, second], { canvas }));

    grouping.group();
    grouping.ungroup();

    const byId = new Map(
      canvas.getObjects().map((object) => [object.get("id"), object]),
    );
    expect(byId.get("a")?.getCenterPoint().x).toBeCloseTo(15, 3);
    expect(byId.get("a")?.getCenterPoint().y).toBeCloseTo(25, 3);
    expect(byId.get("b")?.getCenterPoint().x).toBeCloseTo(65, 3);
    expect(byId.get("b")?.getCenterPoint().y).toBeCloseTo(85, 3);
  });

  it("returns undefined when the active object is not a group", () => {
    const { canvas, grouping, save } = setup();
    const object = new Rect({ id: "a", width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);

    expect(grouping.ungroup()).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run packages/editor/src/grouping-manager/index.dom.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 3: Write the manager**

Create `packages/editor/src/grouping-manager/index.ts`:

```typescript
import {
  ActiveSelection,
  Group,
  type Canvas,
  type FabricObject,
} from "fabric/es";

export interface GroupingManager {
  group(): Group | undefined;
  ungroup(): readonly FabricObject[] | undefined;
}

export interface GroupingManagerOptions {
  readonly canvas: Canvas;
  readonly save: () => void;
  readonly suspend: () => () => void;
}

export function createGroupingManager(
  options: GroupingManagerOptions,
): GroupingManager {
  const { canvas, save } = options;

  return {
    group(): Group | undefined {
      const active = canvas.getActiveObject();
      if (!(active instanceof ActiveSelection)) return undefined;
      const members = [...active.getObjects()];
      if (members.length < 2) return undefined;

      const release = options.suspend();
      try {
        canvas.discardActiveObject();
        const group = new Group(members, {
          id: `group-${crypto.randomUUID()}`,
        });
        for (const member of members) canvas.remove(member);
        canvas.add(group);
        canvas.setActiveObject(group);
        canvas.requestRenderAll();
        return group;
      } finally {
        release();
        save();
      }
    },

    ungroup(): readonly FabricObject[] | undefined {
      const active = canvas.getActiveObject();
      if (!(active instanceof Group)) return undefined;

      const release = options.suspend();
      try {
        // `removeAll` bakes the group transform into each child.
        const members = active.removeAll();
        canvas.remove(active);
        for (const member of members) {
          member.setCoords();
          canvas.add(member);
        }
        canvas.setActiveObject(new ActiveSelection(members, { canvas }));
        canvas.requestRenderAll();
        return members;
      } finally {
        release();
        save();
      }
    },
  };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run packages/editor/src/grouping-manager/index.dom.test.ts`
Expected: PASS, 5 tests. The world-position test is the §57 acceptance check; if
it fails, the transform composition is wrong and must be fixed here rather than
compensated for by a caller.

- [ ] **Step 5: Compose it into the editor contract**

In `packages/editor/src/editor-interaction.ts`:

```typescript
import type { GroupingManager } from "./grouping-manager/index.js";
```
```typescript
  readonly groupingManager: GroupingManager;
```

In `packages/editor/src/editor-shell.ts`:

```typescript
import { createGroupingManager } from "./grouping-manager/index.js";
```
```typescript
    groupingManager: createGroupingManager({
      canvas,
      save,
      suspend: () => history.suspend(),
    }),
```

- [ ] **Step 6: Bind the shortcuts**

In `packages/editor/src/editor-session.ts`:

```typescript
    this.#shortcuts.register("edit.group", () => {
      options.shell.editor.groupingManager.group();
    });
    this.#shortcuts.register("edit.ungroup", () => {
      options.shell.editor.groupingManager.ungroup();
    });
```

- [ ] **Step 7: Typecheck and commit**

Run: `npx vitest run packages/editor && npm run typecheck`
Expected: PASS; seven projects clean.

```bash
git add packages/editor/src/grouping-manager packages/editor/src/editor-interaction.ts packages/editor/src/editor-shell.ts packages/editor/src/editor-session.ts
git commit -m "feat(editor): add group and ungroup over Fabric groups"
```

---

## Task 10: `toolbar-manager/` — floating selection toolbar

Ported from the fork's `ToolbarManager`
(`src/editor/ui/toolbar-manager/index.ts`, 433 lines, plus
`default-config.ts`, 149 lines):

```bash
git -C D:/git-repos/fabricjs-image-editor show 9efdd78a:src/editor/ui/toolbar-manager/index.ts
git -C D:/git-repos/fabricjs-image-editor show 9efdd78a:src/editor/ui/toolbar-manager/default-config.ts
```

**Owned by the session, not the shell.** It is canvas chrome built from the
`EditorInteraction` contract, exactly like `layer-panel.ts`. `editor-shell.ts`
owns mechanics; `editor-session.ts` owns composition and disposal.

**The fork's positioning math is ported unchanged, and it is correct.** The
fork computes X from `getCenterPoint()` and Y from `getBoundingRect()`, then
applies zoom and pan to both. That looks like a coordinate-space mismatch, and
it was flagged as a suspected bug during the source audit. It is not one. In
Fabric 7.4, `getBoundingRect()` is `makeBoundingBoxFromPoints(this.getCoords())`
and `getCoords()` derives from `calcACoords()`, which applies the object's own
transform and its parent group's, but **never** the viewport transform. Both
axes are therefore scene-space and both correctly need zoom and pan applied.
Do not "fix" this.

**Adaptations.** English labels replace the fork's Russian demo config. Text
buttons with `data-` attributes replace its base64 SVG icons, matching
`layer-panel.ts`. `resolveShapeGroupFromTarget` is dropped with the fork's
shape subsystem, so the target is simply the active object.

**Files:**
- Create: `packages/editor/src/toolbar-manager/index.ts`
- Test: `packages/editor/src/toolbar-manager/index.dom.test.ts`
- Modify: `packages/editor/src/editor-session.ts`

**Interfaces:**
- Consumes: `EditorInteraction` with `clipboardManager` (Task 8),
  `groupingManager` (Task 9), `deletionManager` (Task 6), plus the existing
  `layerManager` and `objectLockManager`.
- Produces:
  - `interface SelectionToolbar { readonly root: HTMLElement; destroy(): void }`
  - `function createSelectionToolbar(editor: EditorInteraction): SelectionToolbar`

**Actions.** Unlocked selection, in order: Duplicate, Lock, Bring to front,
Bring forward, Send backward, Send to back, Group, Ungroup, Delete. A locked
selection shows only Unlock, matching the fork's `lockedActions`. Group is
disabled unless the selection holds two or more objects; Ungroup is disabled
unless the active object is a `Group`.

- [ ] **Step 1: Write the failing tests**

Create `packages/editor/src/toolbar-manager/index.dom.test.ts`:

```typescript
// @vitest-environment jsdom
import { ActiveSelection, Canvas, Group, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createSelectionToolbar } from "./index.js";
import type { EditorInteraction } from "../editor-interaction.js";

function editorFor(canvas: Canvas): EditorInteraction {
  return {
    canvas,
    imageManager: { importImage: vi.fn(async () => null) },
    textManager: { addText: vi.fn() },
    layerManager: {
      bringToFront: vi.fn(),
      bringForward: vi.fn(),
      sendToBack: vi.fn(),
      sendBackwards: vi.fn(),
    },
    objectLockManager: { lockObject: vi.fn(), unlockObject: vi.fn() },
    deletionManager: { deleteActive: vi.fn(() => true) },
    clipboardManager: {
      copy: vi.fn(async () => true),
      cut: vi.fn(async () => true),
      paste: vi.fn(async () => true),
      duplicate: vi.fn(async () => true),
      destroy: vi.fn(),
    },
    groupingManager: { group: vi.fn(), ungroup: vi.fn() },
    cropManager: {
      active: false,
      begin: vi.fn(() => true),
      setAspect: vi.fn(),
      apply: vi.fn(),
      cancel: vi.fn(),
    },
    errorManager: { error: vi.fn(), warn: vi.fn() },
    historyManager: {
      saveState: vi.fn(),
      resetHistory: vi.fn(),
      undo: vi.fn(async () => {}),
      redo: vi.fn(async () => {}),
      suspend: vi.fn(() => () => {}),
    },
    destroy: vi.fn(),
  } as unknown as EditorInteraction;
}

function visible(root: HTMLElement): boolean {
  return root.style.display !== "none";
}

describe("SelectionToolbar", () => {
  it("stays hidden until something is selected", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const toolbar = createSelectionToolbar(editorFor(canvas));

    expect(visible(toolbar.root)).toBe(false);
    toolbar.destroy();
  });

  it("shows the unlocked action set for a selected object", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    const toolbar = createSelectionToolbar(editorFor(canvas));

    canvas.setActiveObject(object);
    canvas.fire("selection:created", { selected: [object] });

    expect(visible(toolbar.root)).toBe(true);
    const actions = [...toolbar.root.querySelectorAll("[data-vigilia-toolbar-action]")].map(
      (button) => button.getAttribute("data-vigilia-toolbar-action"),
    );
    expect(actions).toEqual([
      "duplicate",
      "lock",
      "front",
      "forward",
      "backward",
      "back",
      "group",
      "ungroup",
      "delete",
    ]);
    toolbar.destroy();
  });

  it("shows only unlock for a locked object", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10, locked: true });
    canvas.add(object);
    const toolbar = createSelectionToolbar(editorFor(canvas));

    canvas.setActiveObject(object);
    canvas.fire("selection:created", { selected: [object] });

    const actions = [...toolbar.root.querySelectorAll("[data-vigilia-toolbar-action]")].map(
      (button) => button.getAttribute("data-vigilia-toolbar-action"),
    );
    expect(actions).toEqual(["unlock"]);
    toolbar.destroy();
  });

  it("hides during a transform and returns afterwards", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);
    const toolbar = createSelectionToolbar(editorFor(canvas));
    canvas.fire("selection:created", { selected: [object] });

    canvas.fire("object:moving", { target: object });
    expect(visible(toolbar.root)).toBe(false);

    canvas.fire("object:modified", { target: object });
    expect(visible(toolbar.root)).toBe(true);
    toolbar.destroy();
  });

  it("hides when the selection clears", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);
    const toolbar = createSelectionToolbar(editorFor(canvas));
    canvas.fire("selection:created", { selected: [object] });

    canvas.discardActiveObject();
    canvas.fire("selection:cleared", {});

    expect(visible(toolbar.root)).toBe(false);
    toolbar.destroy();
  });

  it("enables group only for a multi-object selection", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const first = new Rect({ id: "a", width: 10, height: 10 });
    const second = new Rect({ id: "b", width: 10, height: 10 });
    canvas.add(first, second);
    const toolbar = createSelectionToolbar(editorFor(canvas));

    canvas.setActiveObject(first);
    canvas.fire("selection:created", { selected: [first] });
    expect(
      toolbar.root.querySelector<HTMLButtonElement>('[data-vigilia-toolbar-action="group"]')
        ?.disabled,
    ).toBe(true);

    canvas.setActiveObject(new ActiveSelection([first, second], { canvas }));
    canvas.fire("selection:updated", { selected: [first, second] });
    expect(
      toolbar.root.querySelector<HTMLButtonElement>('[data-vigilia-toolbar-action="group"]')
        ?.disabled,
    ).toBe(false);
    toolbar.destroy();
  });

  it("enables ungroup only for a group", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const group = new Group([new Rect({ id: "a", width: 10, height: 10 })], {
      id: "group-1",
    });
    canvas.add(group);
    const toolbar = createSelectionToolbar(editorFor(canvas));

    canvas.setActiveObject(group);
    canvas.fire("selection:created", { selected: [group] });

    expect(
      toolbar.root.querySelector<HTMLButtonElement>('[data-vigilia-toolbar-action="ungroup"]')
        ?.disabled,
    ).toBe(false);
    toolbar.destroy();
  });

  it("routes each action to its owning manager", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    canvas.setActiveObject(object);
    const editor = editorFor(canvas);
    const toolbar = createSelectionToolbar(editor);
    canvas.fire("selection:created", { selected: [object] });

    const click = (action: string): void => {
      toolbar.root
        .querySelector<HTMLButtonElement>(`[data-vigilia-toolbar-action="${action}"]`)
        ?.click();
    };
    click("duplicate");
    click("lock");
    click("front");
    click("delete");

    expect(editor.clipboardManager.duplicate).toHaveBeenCalledOnce();
    expect(editor.objectLockManager.lockObject).toHaveBeenCalledOnce();
    expect(editor.layerManager.bringToFront).toHaveBeenCalledOnce();
    expect(editor.deletionManager.deleteActive).toHaveBeenCalledOnce();
    toolbar.destroy();
  });

  it("detaches every listener on destroy", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10 });
    canvas.add(object);
    const toolbar = createSelectionToolbar(editorFor(canvas));

    toolbar.destroy();
    canvas.setActiveObject(object);

    expect(() => canvas.fire("selection:created", { selected: [object] })).not.toThrow();
    expect(toolbar.root.isConnected).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run packages/editor/src/toolbar-manager/index.dom.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 3: Write the toolbar**

Create `packages/editor/src/toolbar-manager/index.ts`:

```typescript
import { ActiveSelection, Group, type FabricObject } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";

const OFFSET_TOP = 50;

export interface SelectionToolbar {
  readonly root: HTMLElement;
  destroy(): void;
}

interface ToolbarAction {
  readonly id: string;
  readonly label: string;
  readonly run: (editor: EditorInteraction) => void;
  readonly enabled?: (target: FabricObject) => boolean;
}

const UNLOCKED: readonly ToolbarAction[] = [
  {
    id: "duplicate",
    label: "Duplicate",
    run: (editor) => void editor.clipboardManager.duplicate(),
  },
  {
    id: "lock",
    label: "Lock",
    run: (editor) => editor.objectLockManager.lockObject(),
  },
  {
    id: "front",
    label: "Bring to front",
    run: (editor) => editor.layerManager.bringToFront(),
  },
  {
    id: "forward",
    label: "Bring forward",
    run: (editor) => editor.layerManager.bringForward(),
  },
  {
    id: "backward",
    label: "Send backward",
    run: (editor) => editor.layerManager.sendBackwards(),
  },
  {
    id: "back",
    label: "Send to back",
    run: (editor) => editor.layerManager.sendToBack(),
  },
  {
    id: "group",
    label: "Group",
    run: (editor) => editor.groupingManager.group(),
    enabled: (target) =>
      target instanceof ActiveSelection && target.getObjects().length > 1,
  },
  {
    id: "ungroup",
    label: "Ungroup",
    run: (editor) => editor.groupingManager.ungroup(),
    enabled: (target) => target instanceof Group,
  },
  {
    id: "delete",
    label: "Delete",
    run: (editor) => void editor.deletionManager.deleteActive(),
  },
];

const LOCKED: readonly ToolbarAction[] = [
  {
    id: "unlock",
    label: "Unlock",
    run: (editor) => editor.objectLockManager.unlockObject(),
  },
];

export function createSelectionToolbar(
  editor: EditorInteraction,
): SelectionToolbar {
  const { canvas } = editor;
  const root = document.createElement("div");
  root.dataset["vigiliaToolbar"] = "";
  root.style.cssText =
    "position:absolute;display:none;gap:8px;align-items:center;padding:0 8px;" +
    "height:32px;border-radius:8px;background:#2B2D33;z-index:10;";
  (canvas.wrapperEl ?? document.body).append(root);

  let renderedFor: FabricObject | undefined;
  let renderedLocked: boolean | undefined;
  let transforming = false;

  const render = (target: FabricObject, locked: boolean): void => {
    root.replaceChildren();
    for (const action of locked ? LOCKED : UNLOCKED) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset["vigiliaToolbarAction"] = action.id;
      button.textContent = action.label;
      button.disabled = action.enabled !== undefined && !action.enabled(target);
      // The canvas would otherwise start a drag under the pointer.
      button.addEventListener("mousedown", (event) => {
        event.stopPropagation();
        event.preventDefault();
      });
      button.addEventListener("click", () => action.run(editor));
      root.append(button);
    }
  };

  const position = (target: FabricObject): void => {
    target.setCoords();
    const zoom = canvas.getZoom();
    const [, , , , panX, panY] = canvas.viewportTransform;
    // `getCenterPoint` and `getBoundingRect` are both scene-space in Fabric 7.
    const { x: centreX } = target.getCenterPoint();
    const { top, height } = target.getBoundingRect();
    root.style.left = `${centreX * zoom + panX - root.offsetWidth / 2}px`;
    root.style.top = `${(top + height) * zoom + panY + OFFSET_TOP}px`;
    root.style.display = "flex";
  };

  const update = (): void => {
    if (transforming) return;
    const target = canvas.getActiveObject();
    if (target === undefined) {
      root.style.display = "none";
      renderedFor = undefined;
      return;
    }
    const locked = target.get("locked") === true;
    if (target !== renderedFor || locked !== renderedLocked) {
      renderedFor = target;
      renderedLocked = locked;
      render(target, locked);
    }
    position(target);
  };

  const startTransform = (): void => {
    transforming = true;
    root.style.display = "none";
  };
  const endTransform = (): void => {
    transforming = false;
    update();
  };
  const clear = (): void => {
    root.style.display = "none";
    renderedFor = undefined;
  };

  const bindings = [
    ["object:moving", startTransform],
    ["object:scaling", startTransform],
    ["object:rotating", startTransform],
    ["mouse:up", endTransform],
    ["object:modified", endTransform],
    ["selection:created", update],
    ["selection:updated", update],
    ["after:render", update],
    ["selection:cleared", clear],
  ] as const;

  for (const [event, handler] of bindings)
    canvas.on(event as never, handler as never);

  return {
    root,
    destroy() {
      for (const [event, handler] of bindings)
        canvas.off(event as never, handler as never);
      root.remove();
    },
  };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run packages/editor/src/toolbar-manager/index.dom.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Own it from the session**

In `packages/editor/src/editor-session.ts` add the import:

```typescript
import {
  createSelectionToolbar,
  type SelectionToolbar,
} from "./toolbar-manager/index.js";
```

add the field beside the other panels:

```typescript
  readonly #toolbar: SelectionToolbar;
```

assign it in the constructor after `this.#layers` is built:

```typescript
    this.#toolbar = createSelectionToolbar(options.shell.editor);
```

and destroy it in `destroy()`, beside `this.#layers.destroy();`:

```typescript
    this.#toolbar.destroy();
```

- [ ] **Step 6: Run the editor suite and typecheck**

Run: `npx vitest run packages/editor`
Expected: PASS. `editor-session.dom.test.ts` may assert an exact panel count or
disposal set; update it to include the toolbar rather than skipping it.

Run: `npm run typecheck`
Expected: seven projects clean.

- [ ] **Step 7: Commit**

```bash
git add packages/editor/src/toolbar-manager packages/editor/src/editor-session.ts
git commit -m "feat(editor): add floating selection toolbar"
```

---

# Movement snapping (Tasks 11–13)

## What the source audit changed about this work

Spec 0017 describes this port as "~2,900 lines" of "the fork's own
'migrated'/complete, fully generic path, with zero
`CropFrame`/`BackgroundTextbox`/`shapeComposite` coupling". A file-by-file
audit of the pinned commit contradicts both halves. **Implement what is written
below, not the spec's sizing.** Task 15 corrects the spec.

**Actual size.** `movement/` plus `guides/` is **4,400 lines** across 13 files,
before the out-of-tree helpers they import.

**The generic claim holds for the core and fails for the edges.** 13 of 15
files are genuinely free of fork types; `movement-snapping-resolver.ts` (1,340
lines) and `spacing.ts` (1,323 lines) do not even import `fabric/es`. The
coupling is concentrated in exactly three places:

| Where | Coupling | Handling |
|---|---|---|
| `guides/snap-target-resolver.ts:23-26, 65-92` | Duck-typed `cropSource` for CropFrame | Strip the type and the `_isActiveCropSource` branch, ~15 lines (Task 12) |
| `movement/movement-snapping-controller.ts:40, 195` | `isShapeGroup` from the fork's shape-manager, which tests `shapeComposite` | Rewrite the controller against a Vigilia predicate (Task 13) |
| `movement/movement-snapping-controller.ts:12, 280-304` | Whole `ImageEditor` god-object, for `canvas` and `montageArea` | Rewrite against `{ canvas, bounds }` (Task 13) |
| `src/editor/utils/object-filter.ts:3` | `IGNORED_IDS = ['montage-area', 'background', 'interaction-blocker']` | Mechanism is generic, default is fork-specific; port with a Vigilia default (Task 13) |
| `pixel-grid.ts:40` | String-matches `'background-textbox'` | Not in this port's scope; `pixel-grid.ts` is excluded |

**Not ported.** `snapping-manager/index.ts` (1,450 lines) is the fork's
orchestrator and is saturated with `cropManager`, `textManager` and
`montageArea` calls; Task 13 writes a fresh one. `pixel-grid.ts` (487) is
excluded with it. Resize/scale snapping stays out of scope per spec 0017 and
remains a spec-0014 item.

**Snapping has no enablement flag in the fork** — it is unconditionally on,
constructed at `src/editor/index.ts:276` with `{ editor }` and nothing else.
Tuning lives in compile-time module constants. Vigilia keeps that shape.

## File-size exemption

`movement-snapping-resolver.ts` and `spacing.ts` are each over 1,300 lines,
against AGENTS.md's "500 is a signal, 800 is a stop". **Decision: port both
verbatim anyway.** Re-cutting proven geometry during transcription is exactly
where silent numerical bugs enter, and the transcription is worth far more as a
reviewable byte-for-byte diff against a known-good original. Task 15 records
this exemption in `.agents/decisions.md` and files the split as a spec-0014
follow-up, so it is an owned exception rather than a silent violation. Do not
restructure these two files while porting them.

## Naming

AGENTS.md forbids generic folder names, so the fork's `utils/` helpers are
renamed by responsibility as they land in `packages/editor/src/snap-manager/`:

| Fork path | Vigilia path |
|---|---|
| `utils/geometry.ts` (only `ObjectBounds`, `getObjectBounds`, `getObjectExactBounds`) | `snap-manager/bounds.ts` |
| `utils/distance.ts` | `snap-manager/distance.ts` |
| `utils/render-utils.ts` | `snap-manager/guide-painting.ts` |
| `utils/object-filter.ts` | `snap-manager/excluded-objects.ts` |

---

## Task 11: snapping geometry core

Port the 13 fork-clean files plus the two pure helpers they need. This task
adds **no** canvas wiring and changes no editor behaviour; it lands a tested,
self-contained geometry library. That is deliberate — it is the half that can
be verified without a browser.

**Files:**
- Create under `packages/editor/src/snap-manager/`: `constants.ts`,
  `types.ts`, `bounds.ts`, `distance.ts`, `anchor-buckets.ts`,
  `line-snapping.ts`, `movement-snap-candidates.ts`,
  `movement-snapping-resolver.ts`, `movement-snapping-runtime.ts`,
  `movement-spacing-correction.ts`, `movement-spacing-verification.ts`,
  `spacing-chains.ts`, `spacing-patterns.ts`, `spacing.ts`
- Test: `packages/editor/src/snap-manager/movement-snapping-resolver.test.ts`,
  `packages/editor/src/snap-manager/spacing.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the fork's exported symbols, unchanged in name and signature, from
  the Vigilia paths above. Tasks 12 and 13 import from here.

- [ ] **Step 1: Copy the fork's clean files**

Run each of these from `src/web/`, writing the fork blob straight to its
Vigilia path. The `guides/` and `movement/` subfolders are flattened; only the
import specifiers change, in Step 2.

```bash
FORK=D:/git-repos/fabricjs-image-editor
OUT=packages/editor/src/snap-manager
mkdir -p "$OUT"
git -C "$FORK" show 9efdd78a:src/editor/snapping-manager/constants.ts > "$OUT/constants.ts"
git -C "$FORK" show 9efdd78a:src/editor/snapping-manager/types.ts > "$OUT/types.ts"
git -C "$FORK" show 9efdd78a:src/editor/snapping-manager/guides/anchor-buckets.ts > "$OUT/anchor-buckets.ts"
for f in line-snapping movement-snap-candidates movement-snapping-resolver \
         movement-snapping-runtime movement-spacing-correction \
         movement-spacing-verification spacing-chains spacing-patterns spacing; do
  git -C "$FORK" show "9efdd78a:src/editor/snapping-manager/movement/$f.ts" > "$OUT/$f.ts"
done
git -C "$FORK" show 9efdd78a:src/editor/utils/distance.ts > "$OUT/distance.ts"
git -C "$FORK" show 9efdd78a:src/editor/utils/geometry.ts > "$OUT/bounds.ts"
```

Do not run `git checkout`, `git switch` or `git restore` against the fork.

- [ ] **Step 2: Rewrite import specifiers and trim `bounds.ts`**

Every relative import in the copied files must resolve inside the flat folder
and carry an explicit `.js` extension, which the fork omits:

- `from '../types'` and `from './types'` → `from "./types.js"`
- `from '../constants'` → `from "./constants.js"`
- `from '../../utils/geometry'` → `from "./bounds.js"`
- `from '../../utils/distance'` → `from "./distance.js"`
- `from '../../utils/render-utils'` → `from "./guide-painting.js"` (Task 12
  creates it; leave the specifier, the file arrives before typecheck passes)
- every remaining `from './<name>'` → `from "./<name>.js"`

In `bounds.ts`, keep only `ObjectBounds`, `getObjectBounds`,
`getObjectExactBounds` and whatever they transitively need from the original
`geometry.ts`, and delete the rest. Keep the `getObjectSnappingBounds?.()`
escape hatch it calls: the audit identifies it as the intended seam, and
Vigilia's crop work may use it later. Declare it locally rather than
module-augmenting Fabric:

```typescript
/** Objects may report their own snapping extent; the fork's crop frame did. */
interface SnappingBoundsSource {
  getObjectSnappingBounds?: () => ObjectBounds | undefined;
}
```

Convert the fork's single-quoted strings and semicolon-free style to the
repository's own formatting by running Biome in Step 5 rather than by hand.

- [ ] **Step 3: Translate the Russian comments**

Every copied file carries Russian JSDoc and inline comments. Replace them with
English that says **why**, in 1–3 lines, per the global constraints. Delete
comments that only restate the code. Do not leave any Cyrillic in source; the
check in Task 15 fails the build on it.

- [ ] **Step 4: Port the fork's unit specs**

Copy the two highest-value specs and convert them from Jest to Vitest:

```bash
FORK=D:/git-repos/fabricjs-image-editor
OUT=packages/editor/src/snap-manager
git -C "$FORK" show 9efdd78a:specs/src/editor/snapping-manager/movement/movement-snapping-resolver.spec.ts \
  > "$OUT/movement-snapping-resolver.test.ts"
git -C "$FORK" show 9efdd78a:specs/src/editor/snapping-manager/movement/spacing.spec.ts \
  > "$OUT/spacing.test.ts"
```

If the second path does not exist at this commit, list what does with
`git -C "$FORK" ls-tree -r --name-only 9efdd78a | grep 'specs/.*snapping'`
and port the spacing-related spec it names instead.

Conversion, mechanically:
- Add `import { describe, expect, it, vi } from "vitest";` at the top.
- `jest.fn(` → `vi.fn(`, `jest.spyOn(` → `vi.spyOn(`, `jest.mock(` → `vi.mock(`.
- Rewrite import paths to `./<name>.js`.
- Translate the Russian `describe`/`it` titles to English.
- These are pure-geometry specs, so they need no `// @vitest-environment jsdom`
  pragma. Add one only if a converted test touches the DOM.

- [ ] **Step 5: Format, typecheck and run the ported specs**

Run: `npx biome format --write packages/editor/src/snap-manager`
Run: `npm run typecheck`
Expected: seven projects clean. `noUncheckedIndexedAccess` will flag indexed
reads the fork did unguarded — narrow each with an explicit `undefined` check.
Do not reach for `!` to silence them; a non-null assertion on a snapping
candidate array is exactly the bug class these tests exist to catch.

Run: `npx vitest run packages/editor/src/snap-manager`
Expected: PASS. The resolver spec carries 24 tests. Any failure here is a
transcription error, not a design question — diff your file against
`git -C $FORK show 9efdd78a:<original path>` before changing behaviour.

- [ ] **Step 6: Commit**

```bash
git add packages/editor/src/snap-manager
git commit -m "feat(editor): port fork movement-snapping geometry core"
```

---

## Task 12: guide rendering and snap-target resolution

**Files:**
- Create: `packages/editor/src/snap-manager/guide-painting.ts`
- Create: `packages/editor/src/snap-manager/guide-renderer.ts`
- Create: `packages/editor/src/snap-manager/snap-target-resolver.ts`
- Test: `packages/editor/src/snap-manager/guide-renderer.dom.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `constants.ts`, `bounds.ts`, `distance.ts` (Task 11).
- Produces: `renderSnappingGuides({ canvas, guideBounds, guides, spacingGuides })`
  and the snap-target resolver class, both with the fork's own signatures.

**How the fork draws.** `renderSnappingGuides` (`guides/renderer.ts:16`) takes
the context from `canvas.getSelectionContext()` — the Fabric upper canvas —
saves it, applies the viewport transform, then sets `lineWidth = 1 / zoom`,
`strokeStyle = '#3D8BF4'` and `setLineDash([4, 4])`, draws, and restores in a
`finally`. The orchestrator clears `contextTop` on `before:render` and calls
the renderer on `after:render`. Spacing labels are rounded-rect badges,
`12 / zoom` px sans-serif, white on the guide colour, padding 4, radius 4.

- [ ] **Step 1: Copy the three files**

```bash
FORK=D:/git-repos/fabricjs-image-editor
OUT=packages/editor/src/snap-manager
git -C "$FORK" show 9efdd78a:src/editor/utils/render-utils.ts > "$OUT/guide-painting.ts"
git -C "$FORK" show 9efdd78a:src/editor/snapping-manager/guides/renderer.ts > "$OUT/guide-renderer.ts"
git -C "$FORK" show 9efdd78a:src/editor/snapping-manager/guides/snap-target-resolver.ts > "$OUT/snap-target-resolver.ts"
```

Apply the same import-specifier and comment-translation passes as Task 11
Steps 2 and 3.

- [ ] **Step 2: Strip the CropFrame coupling**

In `snap-target-resolver.ts`, delete the `CropFrameSnapTarget` type
(fork lines 23–26) and the `_isActiveCropSource` method (fork lines 81–92),
then reduce `_resolveBounds` (fork lines 65–79) to the mode switch that
remains:

```typescript
  private _resolveBounds({ mode, object }: {
    readonly mode: "exact" | "visual";
    readonly object: FabricObject;
  }): ObjectBounds | null {
    return mode === "exact"
      ? getObjectExactBounds({ object })
      : getObjectBounds({ object });
  }
```

Remove `activeObject` from the call sites that only fed the deleted branch. If
the surrounding signature names the mode union differently, keep the fork's
spelling rather than renaming it.

- [ ] **Step 3: Write the rendering test**

Create `packages/editor/src/snap-manager/guide-renderer.dom.test.ts`:

```typescript
// @vitest-environment jsdom
import { Canvas } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { renderSnappingGuides } from "./guide-renderer.js";

function contextSpy(canvas: Canvas) {
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    transform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    fillText: vi.fn(),
    translate: vi.fn(),
    rect: vi.fn(),
    closePath: vi.fn(),
    arcTo: vi.fn(),
    lineWidth: 0,
    strokeStyle: "",
    fillStyle: "",
    font: "",
    textAlign: "" as CanvasTextAlign,
    textBaseline: "" as CanvasTextBaseline,
  };
  vi.spyOn(canvas, "getSelectionContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  return context;
}

describe("renderSnappingGuides", () => {
  it("strokes a dashed guide and always restores the context", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const context = contextSpy(canvas);

    renderSnappingGuides({
      canvas,
      guideBounds: { left: 0, top: 0, right: 100, bottom: 100 },
      guides: [{ axis: "vertical", position: 50 }],
      spacingGuides: [],
    });

    expect(context.save).toHaveBeenCalledOnce();
    expect(context.setLineDash).toHaveBeenCalledWith([4, 4]);
    expect(context.strokeStyle).toBe("#3D8BF4");
    expect(context.stroke).toHaveBeenCalled();
    expect(context.restore).toHaveBeenCalledOnce();
  });

  it("draws nothing but still restores when there are no guides", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const context = contextSpy(canvas);

    renderSnappingGuides({
      canvas,
      guideBounds: { left: 0, top: 0, right: 100, bottom: 100 },
      guides: [],
      spacingGuides: [],
    });

    expect(context.stroke).not.toHaveBeenCalled();
    expect(context.restore).toHaveBeenCalledOnce();
  });
});
```

Adjust the `guides` and `guideBounds` literals to the exact shapes `types.ts`
declares after Task 11 — read them there rather than guessing; the property
names above are the expected spelling but the ported types are authoritative.

- [ ] **Step 4: Run the tests, format and typecheck**

Run: `npx biome format --write packages/editor/src/snap-manager`
Run: `npx vitest run packages/editor/src/snap-manager`
Run: `npm run typecheck`
Expected: PASS; seven projects clean.

- [ ] **Step 5: Confirm the CropFrame strip is complete**

Run: `grep -rniE "cropsource|cropframe|shapecomposite|backgroundtextbox|montage" packages/editor/src/snap-manager`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add packages/editor/src/snap-manager
git commit -m "feat(editor): port snapping guide rendering and target resolution"
```

---

## Task 13: Vigilia snapping controller and canvas wiring

The fork's `movement-snapping-controller.ts` (359 lines) and its orchestrator
`snapping-manager/index.ts` (1,450 lines) are **rewritten, not ported** — they
hold every remaining coupling. This task makes snapping actually work on the
editor canvas.

**Files:**
- Create: `packages/editor/src/snap-manager/excluded-objects.ts`
- Create: `packages/editor/src/snap-manager/index.ts`
- Test: `packages/editor/src/snap-manager/index.dom.test.ts`
- Modify: `packages/editor/src/editor-session.ts`
- Modify: `tests/e2e/editor-fork.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 11 and 12.
- Produces:
  - `interface SnapManager { destroy(): void }`
  - `function createSnapManager(options: { readonly canvas: Canvas; readonly bounds: () => ObjectBounds; readonly errors: ErrorManager }): SnapManager`

**What replaces each coupling.**
- `isShapeGroup` / the `ActiveSelection | FabricImage | Group | Textbox`
  allow-list becomes: any object that is `selectable`, not `locked`, and not
  excluded by id. Vigilia has no composite shape type, and an allow-list would
  silently exclude `VigiliaChart`.
- `editor.montageArea` bounds become the `bounds()` callback, which the session
  supplies from the artboard.
- `IGNORED_IDS` keeps the mechanism and takes a Vigilia default of `[]`;
  Vigilia has no montage-area, background or interaction-blocker object.

- [ ] **Step 1: Port the object filter with a Vigilia default**

```bash
git -C D:/git-repos/fabricjs-image-editor show 9efdd78a:src/editor/utils/object-filter.ts \
  > packages/editor/src/snap-manager/excluded-objects.ts
```

Change the fork's `export const IGNORED_IDS = ['montage-area', 'background', 'interaction-blocker']`
to:

```typescript
/** Vigilia has no montage-area, background or blocker objects to skip. */
export const IGNORED_IDS: readonly string[] = [];
```

Keep `collectExcludedObjects` and `shouldIgnoreObject` as they are, apply the
import and comment passes, and translate any Russian.

- [ ] **Step 2: Write the failing wiring test**

Create `packages/editor/src/snap-manager/index.dom.test.ts`:

```typescript
// @vitest-environment jsdom
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createErrorManager } from "../error-manager/index.js";
import { createSnapManager } from "./index.js";

function setup() {
  const canvas = new Canvas(document.createElement("canvas"));
  const snapping = createSnapManager({
    canvas,
    bounds: () => ({ left: 0, top: 0, right: 400, bottom: 300 }),
    errors: createErrorManager(canvas),
  });
  return { canvas, snapping };
}

describe("SnapManager", () => {
  it("nudges a dragged object onto a neighbour's edge", () => {
    const { canvas, snapping } = setup();
    const anchor = new Rect({ id: "a", left: 100, top: 20, width: 40, height: 40 });
    const dragged = new Rect({ id: "b", left: 98, top: 150, width: 40, height: 40 });
    canvas.add(anchor, dragged);
    canvas.setActiveObject(dragged);

    canvas.fire("mouse:down", { target: dragged });
    canvas.fire("object:moving", { target: dragged });

    expect(dragged.left).toBe(100);
    snapping.destroy();
  });

  it("leaves an object alone when no neighbour is within the threshold", () => {
    const { canvas, snapping } = setup();
    const anchor = new Rect({ id: "a", left: 0, top: 20, width: 40, height: 40 });
    const dragged = new Rect({ id: "b", left: 250, top: 150, width: 40, height: 40 });
    canvas.add(anchor, dragged);
    canvas.setActiveObject(dragged);

    canvas.fire("mouse:down", { target: dragged });
    canvas.fire("object:moving", { target: dragged });

    expect(dragged.left).toBe(250);
    snapping.destroy();
  });

  it("skips a locked neighbour as a snap target", () => {
    const { canvas, snapping } = setup();
    const locked = new Rect({ id: "a", left: 100, top: 20, width: 40, height: 40, locked: true });
    const dragged = new Rect({ id: "b", left: 98, top: 150, width: 40, height: 40 });
    canvas.add(locked, dragged);
    canvas.setActiveObject(dragged);

    canvas.fire("mouse:down", { target: dragged });
    canvas.fire("object:moving", { target: dragged });

    expect(dragged.left).toBe(98);
    snapping.destroy();
  });

  it("detaches every listener on destroy", () => {
    const { canvas, snapping } = setup();
    const dragged = new Rect({ id: "b", left: 98, top: 150, width: 40, height: 40 });
    canvas.add(new Rect({ id: "a", left: 100, top: 20, width: 40, height: 40 }), dragged);
    canvas.setActiveObject(dragged);

    snapping.destroy();
    canvas.fire("mouse:down", { target: dragged });
    canvas.fire("object:moving", { target: dragged });

    expect(dragged.left).toBe(98);
  });
});
```

- [ ] **Step 3: Write the orchestrator**

Create `packages/editor/src/snap-manager/index.ts`. It replaces the fork's
1,450-line orchestrator with only the movement path. Bind exactly the events
the fork's `_bindEvents` uses for movement, which are `mouse:down` (start the
gesture and cache anchors), `object:moving` (run one step), `mouse:up`,
`selection:created`, `selection:updated`, `selection:cleared` and
`object:removed` (tear down), and `before:render` / `after:render` (draw).
Also mirror its `window` listeners for `pointercancel`, `touchcancel` and
`blur`, which cancel an interrupted gesture.

Structure it as:

```typescript
import type { Canvas, FabricObject } from "fabric/es";
import type { ErrorManager } from "../error-manager/index.js";
import type { ObjectBounds } from "./bounds.js";
import { renderSnappingGuides } from "./guide-renderer.js";
import { shouldIgnoreObject } from "./excluded-objects.js";

export interface SnapManager {
  destroy(): void;
}

export interface SnapManagerOptions {
  readonly canvas: Canvas;
  /** Artboard extent; replaces the fork's montage area. */
  readonly bounds: () => ObjectBounds;
  readonly errors: ErrorManager;
}

/** Any movable object snaps; Vigilia has no composite type to allow-list. */
function isSnapTarget(object: FabricObject): boolean {
  return (
    object.selectable === true &&
    object.get("locked") !== true &&
    !shouldIgnoreObject({ object })
  );
}
```

then a `createSnapManager` that holds the resolver runtime from Task 11,
caches candidate anchors on `mouse:down`, calls the resolver on
`object:moving` and writes the returned position back onto the target, stores
the returned guides, clears `canvas.contextTop` on `before:render`, calls
`renderSnappingGuides` on `after:render`, and unbinds everything in
`destroy()`. Wrap each step in `try`/`catch` and report through
`errors.error("snapping", ...)`: a throw inside `object:moving` would
otherwise leave a drag wedged.

Read the exact resolver and runtime entry-point signatures from the files
Task 11 produced — `movement-snapping-runtime.ts` is the intended façade — and
match them rather than inventing wrappers. Keep this file under 500 lines; if
it grows past that, the candidate-caching half belongs in its own
responsibility-named file.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run packages/editor/src/snap-manager/index.dom.test.ts`
Expected: PASS, 4 tests. The threshold that makes the first test snap and the
second not is `SNAP_THRESHOLD` in `constants.ts`; read the ported value and
adjust the literal offsets in the test to sit clearly inside and outside it
rather than changing the constant.

- [ ] **Step 5: Own it from the session**

In `packages/editor/src/editor-session.ts` add the import, a `#snapping` field,
construction in the constructor and disposal in `destroy()`. The bounds
callback reads the current artboard:

```typescript
    this.#snapping = createSnapManager({
      canvas: options.shell.editor.canvas,
      bounds: () => ({
        left: 0,
        top: 0,
        right: this.#envelope.artboard.width,
        bottom: this.#envelope.artboard.height,
      }),
      errors: options.shell.editor.errorManager,
    });
```

- [ ] **Step 6: Prove guides render during a real drag**

Snapping is visible behaviour, so geometry assertions are not sufficient
evidence. Add to `tests/e2e/editor-fork.spec.ts`:

```typescript
test("snaps a dragged object to a neighbour and shows a guide", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "the editor is a desktop surface",
  );

  await page.goto(EDITOR);
  const canvas = page.locator("#vigilia-fabric-editor canvas.upper-canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;

  await page.mouse.move(box.x + 120, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 200, { steps: 12 });

  await captureVisualReview(page, testInfo, "editor-fork-snap-guides");
  await page.mouse.up();
});
```

Then build and capture, and **open the PNG and look at it**: a dashed blue
guide must be visible along the aligned edge while the pointer is still down.

```bash
npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep 'snaps a dragged object' --workers=1
```

If the starter document's objects do not land near an alignment at those
coordinates, adjust the drag target until they do, and record the coordinates
you used in the test as a comment.

- [ ] **Step 7: Run the full browser suite**

Run: `npm run test:e2e`
Expected: PASS. Snapping alters drag outcomes globally, so any existing test
that drags an object may now land on a snapped position. Fix such a test by
asserting the snapped value, not by disabling snapping.

- [ ] **Step 8: Disable the fix and confirm the test can fail**

Temporarily make `isSnapTarget` return `false` and re-run
`packages/editor/src/snap-manager/index.dom.test.ts`. The first test must fail.
Restore it, re-run, and rebuild before any further Playwright run — Playwright
previews built bundles.

- [ ] **Step 9: Commit**

```bash
git add packages/editor/src/snap-manager packages/editor/src/editor-session.ts tests/e2e/editor-fork.spec.ts
git commit -m "feat(editor): wire drag-time snapping and smart guides"
```

---

## Task 14: `indicator-manager/` — rotation angle and size tooltips

Ported from `src/editor/ui/cursor-indicator/` (28 + 184 lines),
`ui/angle-indicator/` (14 + 168) and `ui/object-size-indicator/` (4 + 258),
656 lines in total:

```bash
FORK=D:/git-repos/fabricjs-image-editor
git -C "$FORK" show 9efdd78a:src/editor/ui/cursor-indicator/index.ts
git -C "$FORK" show 9efdd78a:src/editor/ui/cursor-indicator/constants.ts
git -C "$FORK" show 9efdd78a:src/editor/ui/angle-indicator/index.ts
git -C "$FORK" show 9efdd78a:src/editor/ui/object-size-indicator/index.ts
```

`CursorIndicator` has zero fork coupling and lifts verbatim. The two managers
couple only to `ImageEditor`, `editor.options` and `editor.montageArea.id`, so
each takes `{ canvas, enabled }` instead.

**Both are gated, matching the fork's own pattern:** `showRotationAngle` and
`showObjectSizeOnScale`, both defaulting to `true`
(`src/editor/defaults.ts:83`, `:87`). The fork reads each flag twice — once to
decide whether to construct the manager, once per event — and this port keeps
both checks.

**The size label is translated.** The fork renders
`ширина: <W> высота: <H>` (`_formatSize`, `:223-228`). Vigilia renders
`<W> × <H>`. Number formatting is ported exactly: `Math.round(value + 1e-6)`,
where the epsilon forces `.5` boundaries up despite float error, then thousands
separated by a plain space via `\B(?=(\d{3})+(?!\d))`. The angle label
`` `${angle}°` `` is already language-neutral and is kept, including its
normalisation to `[-180, 180]` and `Math.round`.

**Two fork behaviours are dropped.** The `montageArea.id` suppression has no
Vigilia equivalent. The `mouse:move` second pass in the size indicator reaches
into Fabric's private `_currentTransform` and exists only because the fork's
`TextManager` materialises text dimensions late; Vigilia has no such pipeline.
If the size label proves stale at the end of a text resize during Step 6's
visual check, restore that pass rather than leaving a wrong number on screen.

**Files:**
- Create: `packages/editor/src/indicator-manager/cursor-indicator.ts`
- Create: `packages/editor/src/indicator-manager/index.ts`
- Test: `packages/editor/src/indicator-manager/index.dom.test.ts`
- Modify: `packages/editor/src/editor-session.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `interface CursorIndicator { showAtPointer(input: { readonly text: string; readonly event: MouseEvent | TouchEvent }): void; hide(): void; destroy(): void }`
  - `function createCursorIndicator(options: { readonly className: string; readonly parent: HTMLElement }): CursorIndicator`
  - `function formatAngle(angle: number): string`
  - `function formatSize(size: { readonly width: number; readonly height: number }): string | undefined`
  - `interface IndicatorManager { destroy(): void }`
  - `function createIndicatorManager(options: { readonly canvas: Canvas; readonly showRotationAngle?: boolean; readonly showObjectSizeOnScale?: boolean }): IndicatorManager`

- [ ] **Step 1: Write the failing tests**

Create `packages/editor/src/indicator-manager/index.dom.test.ts`:

```typescript
// @vitest-environment jsdom
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it } from "vitest";
import { createIndicatorManager, formatAngle, formatSize } from "./index.js";

function pointer(): MouseEvent {
  return new MouseEvent("mousemove", { clientX: 40, clientY: 60 });
}

describe("formatAngle", () => {
  it("rounds to a whole degree with the degree sign", () => {
    expect(formatAngle(12.4)).toBe("12°");
    expect(formatAngle(0)).toBe("0°");
  });

  it("normalises to the range -180 to 180", () => {
    expect(formatAngle(190)).toBe("-170°");
    expect(formatAngle(-190)).toBe("170°");
    expect(formatAngle(720)).toBe("0°");
  });

  it("keeps a negative sign and never prepends a plus", () => {
    expect(formatAngle(-45)).toBe("-45°");
    expect(formatAngle(45)).toBe("45°");
  });
});

describe("formatSize", () => {
  it("rounds each dimension and joins them", () => {
    expect(formatSize({ width: 100.4, height: 50.6 })).toBe("100 × 51");
  });

  it("rounds a .5 boundary up despite float error", () => {
    expect(formatSize({ width: 0.5, height: 1.5 })).toBe("1 × 2");
  });

  it("separates thousands with a space", () => {
    expect(formatSize({ width: 1234, height: 12345 })).toBe("1 234 × 12 345");
  });

  it("takes the absolute value so a flip still reads correctly", () => {
    expect(formatSize({ width: -100, height: 50 })).toBe("100 × 50");
  });

  it("is undefined for a non-finite dimension", () => {
    expect(formatSize({ width: Number.NaN, height: 50 })).toBeUndefined();
    expect(formatSize({ width: Number.POSITIVE_INFINITY, height: 5 })).toBeUndefined();
  });
});

describe("IndicatorManager", () => {
  it("shows the angle while rotating and hides it when modified", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10, angle: 30 });
    canvas.add(object);
    const indicators = createIndicatorManager({ canvas });

    canvas.fire("object:rotating", { target: object, e: pointer() });
    const element = document.querySelector<HTMLElement>(
      ".vigilia-angle-indicator",
    );
    expect(element?.textContent).toBe("30°");
    expect(element?.style.display).not.toBe("none");

    canvas.fire("object:modified", { target: object });
    expect(element?.style.display).toBe("none");
    indicators.destroy();
  });

  it("shows the scaled size while scaling", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 100, height: 50 });
    canvas.add(object);
    const indicators = createIndicatorManager({ canvas });

    canvas.fire("object:scaling", { target: object, e: pointer() });

    expect(
      document.querySelector<HTMLElement>(".vigilia-size-indicator")?.textContent,
    ).toBe("100 × 50");
    indicators.destroy();
  });

  it("stays silent when its option is off", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10, angle: 30 });
    canvas.add(object);
    const indicators = createIndicatorManager({
      canvas,
      showRotationAngle: false,
    });

    canvas.fire("object:rotating", { target: object, e: pointer() });

    expect(
      document.querySelector<HTMLElement>(".vigilia-angle-indicator")?.style.display,
    ).toBe("none");
    indicators.destroy();
  });

  it("suppresses the size indicator for a locked object", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10, locked: true });
    canvas.add(object);
    const indicators = createIndicatorManager({ canvas });

    canvas.fire("object:scaling", { target: object, e: pointer() });

    expect(
      document.querySelector<HTMLElement>(".vigilia-size-indicator")?.style.display,
    ).toBe("none");
    indicators.destroy();
  });

  it("removes both elements on destroy", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const indicators = createIndicatorManager({ canvas });

    indicators.destroy();

    expect(document.querySelector(".vigilia-angle-indicator")).toBeNull();
    expect(document.querySelector(".vigilia-size-indicator")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run packages/editor/src/indicator-manager/index.dom.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 3: Port the cursor indicator**

```bash
git -C D:/git-repos/fabricjs-image-editor show 9efdd78a:src/editor/ui/cursor-indicator/index.ts \
  > packages/editor/src/indicator-manager/cursor-indicator.ts
```

Inline the four constants from the fork's `cursor-indicator/constants.ts` at
the top of the file rather than keeping a second file for 28 lines. Convert
the default-exported class to the `createCursorIndicator` factory named in the
Interfaces block, matching the repository's factory style. Translate the
Russian comments. Keep its pointer-position maths and its `MouseEvent` /
`TouchEvent` handling exactly as they are.

- [ ] **Step 4: Write the indicator manager**

Create `packages/editor/src/indicator-manager/index.ts` exporting
`formatAngle`, `formatSize` and `createIndicatorManager`.

```typescript
const SIZE_FORMAT_EPSILON = 0.000001;

/** Minus is kept for negatives; no plus is prepended for positives. */
export function formatAngle(angle: number): string {
  let normalised = angle % 360;
  if (normalised > 180) normalised -= 360;
  if (normalised < -180) normalised += 360;
  return `${Math.round(normalised)}°`;
}

/** The epsilon forces a .5 boundary up despite floating-point error. */
function formatDimension(value: number): string {
  return Math.round(Math.abs(value) + SIZE_FORMAT_EPSILON)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatSize(size: {
  readonly width: number;
  readonly height: number;
}): string | undefined {
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) {
    return undefined;
  }
  return `${formatDimension(size.width)} × ${formatDimension(size.height)}`;
}
```

`createIndicatorManager` builds one `createCursorIndicator` per indicator, with
class names `vigilia-angle-indicator` and `vigilia-size-indicator`, parented to
`canvas.wrapperEl ?? document.body`. Bind the fork's event sets exactly:

- angle: `object:rotating` shows, `mouse:up`, `object:modified` and
  `selection:cleared` hide;
- size: `object:scaling` and `object:resizing` show, `mouse:up`,
  `object:modified` and `selection:cleared` hide.

Suppression rules, per the fork minus the montage-area check. Angle: option
off, no target, or `lockRotation || lockMovementX || lockMovementY`. Size:
option off, no target, `locked`, or `lockScalingX && lockScalingY`. The size
value comes from `target.getObjectDisplaySize?.()` when present, else
`target.getScaledWidth()` / `getScaledHeight()` — scene units, deliberately not
multiplied by zoom. `destroy()` unbinds every event and destroys both
indicators.

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run packages/editor/src/indicator-manager/index.dom.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Own it from the session and see it on screen**

In `packages/editor/src/editor-session.ts` add a `#indicators` field, construct
it with `createIndicatorManager({ canvas: options.shell.editor.canvas })`, and
destroy it in `destroy()`.

Indicators are visible behaviour, so add a capture to
`tests/e2e/editor-fork.spec.ts` that rotates an object and screenshots
mid-gesture, following the drag pattern Task 13 Step 6 established but using
the rotation handle, and named `editor-fork-rotation-indicator`. Then:

```bash
npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep 'rotation indicator' --workers=1
```

**Open the PNG and confirm** a degree readout is visible beside the pointer
while the handle is still held. A passing test with no visible tooltip is not
evidence.

- [ ] **Step 7: Typecheck and commit**

Run: `npm run typecheck`
Expected: seven projects clean.

```bash
git add packages/editor/src/indicator-manager packages/editor/src/editor-session.ts tests/e2e/editor-fork.spec.ts
git commit -m "feat(editor): add rotation-angle and size indicators"
```

---

## Task 15: attribution, ownership records and full verification

Nothing here is optional bookkeeping. Two items are correctness gates: the
licence attribution, and the spec corrections that stop a future reader
trusting figures this plan disproved.

**Files:**
- Modify: `THIRD-PARTY-NOTICES.md`
- Modify: `.agents/dependency-licences.md`
- Modify: `.agents/architecture.md`
- Modify: `.agents/decisions.md`
- Modify: `.agents/specs/0014-editor-behaviour-review.md`
- Modify: `.agents/screenshots/README.md`
- Modify: `.agents/status.md`
- Delete: `.agents/specs/0017-editor-fork-parity.md`

- [ ] **Step 1: Record the vendored-code attribution — do this first**

Tasks 11, 12 and 14 copy roughly 5,000 lines from
`@anu3ev/fabric-image-editor`. That package is **MIT, Copyright (c) 2025
Alexander Anufriev** (`LICENSE` at the pinned commit). MIT requires the
copyright and permission notice to travel with any substantial portion, so the
port is permitted **only** with attribution.

AGENTS.md forbids licence headers in source files, so the notice goes in
`THIRD-PARTY-NOTICES.md` instead. Add an entry naming the package, its version
(`0.10.32`), the pinned commit `9efdd78a342a29f169a8dbf1da78c95bbf1ffe77`, the
MIT licence with its full text and copyright line, and the fact that
`packages/editor/src/snap-manager/` and
`packages/editor/src/indicator-manager/` contain adapted copies rather than a
dependency.

Add a matching provenance row to `.agents/dependency-licences.md`, which today
states only that the image-editor package was removed. Vendored source is a
different situation from a removed dependency and must not be left implied.

**Stop and get human sign-off on this step before continuing.** AGENTS.md puts
licensing changes on the human side of the review boundary. The work is
permitted by MIT and the attribution above discharges it, but the decision to
vendor a third party's code into this repository is not the agent's to make
alone.

- [ ] **Step 2: Record the new owners**

In `.agents/architecture.md`, add one row per new owner to the editor concept
ownership table:

| Concept | Owner |
|---|---|
| Structured editor diagnostics | `editor/src/error-manager/` |
| Selection and rotation handle styling | `editor/src/controls-manager/` |
| Active-object and selection deletion | `editor/src/deletion-manager/` |
| OS clipboard copy/cut/paste/duplicate | `editor/src/clipboard-manager/` |
| Group and ungroup | `editor/src/grouping-manager/` |
| Floating selection toolbar | `editor/src/toolbar-manager/` |
| Drag-time snapping and smart guides | `editor/src/snap-manager/` |
| Rotation-angle and size indicators | `editor/src/indicator-manager/` |
| Per-image crop session | `editor/src/crop-manager/` |
| Imported and rehydrated image pixel bound | `editor/src/image-manager/` |

Also note in the editor-boundary prose that `scene-fabric`'s
`FabricSceneHandle` now exposes `updateArtboard` for document-level artboard
changes that a `ScenePlan` cannot carry.

- [ ] **Step 3: Record the decisions**

Add to `.agents/decisions.md`, one short entry each with its reason:

1. **Snapping geometry files exceed the 800-line stop.**
   `movement-snapping-resolver.ts` and `spacing.ts` are vendored verbatim at
   over 1,300 lines each, because re-cutting proven geometry during
   transcription is where silent numerical bugs enter, and a byte-comparable
   diff against the original is worth more than the line budget. Splitting is
   a spec-0014 follow-up.
2. **Pasting is owned by the document `paste` event, not a shortcut.**
   `Ctrl+V` stays unbound so the browser delivers `clipboardData`, which is the
   only route to an image copied from another application.
3. **The image pixel bound applies on import and on rehydrate.** A Fabric
   image's size follows its element, so bounding only one attachment point
   would change geometry on reopen.
4. **A rotated image refuses a crop session.** `clipPath` coordinates are
   image-local and unrotated; refusing is honest where approximating is not.

- [ ] **Step 4: Correct the spec record**

Add to `.agents/specs/0014-editor-behaviour-review.md`, which is the review
backlog and not accepted requirements:

- Crop of a rotated image, currently refused with a warning.
- Splitting `movement-snapping-resolver.ts` and `spacing.ts` below the
  800-line stop.
- The fork's `pixel-grid.ts` pixel snapping, excluded from this port.
- The size indicator's `mouse:move` refresh pass, dropped as text-pipeline
  specific and unverified.

Resize/scale snapping is already tracked there; do not duplicate it.

- [ ] **Step 5: Record the new visual actions**

Add rows to the checklist in `.agents/screenshots/README.md` for the captures
Tasks 13 and 14 produced, and for the toolbar and handle styling:

| Domain | Visible action | Capture / title regex |
|---|---|---|
| Snapping | Drag an object onto a neighbour's edge | `editor-fork-snap-guides` / `snaps a dragged object` |
| Indicators | Rotate an object and read the angle | `editor-fork-rotation-indicator` / `rotation indicator` |
| Selection toolbar | Select an object and expose its toolbar | `editor-fork-toolbar` / `captures the selection toolbar` |

Add the toolbar capture to `tests/e2e/editor-fork.spec.ts` if Task 10 did not,
and replace the existing "Fork mechanics" row's "add when integration changes"
with these concrete entries.

- [ ] **Step 6: Confirm no untranslated strings survived**

Run: `grep -rnP "[\x{0400}-\x{04FF}]" packages/editor/src packages/scene-fabric/src`
Expected: no matches. Every ported comment and label must be English.

- [ ] **Step 7: Run the full verification gate**

From `src/web/`, in this order, and record the actual numbers:

```bash
npm run typecheck
npm test
npm run build
npm run size
npm run test:e2e
```

Expected: seven projects clean; the unit suite green, having grown by the
roughly 100 tests this plan writes plus whatever the two ported fork specs
contribute; three bundles built; the player size gate passing within a
few tenths of a KB of 269.3 KB gzip, since every change but Task 1 is
editor-only; and the browser suite green.

Then run `vigilia:verify` as AGENTS.md requires before commit or push.

If any gate fails, fix the cause and re-run it. Do not record a partial pass.

- [ ] **Step 8: Remove the completed spec**

AGENTS.md requires removing a completed spec once its durable rules have moved
into the plan, architecture and tests. Delete
`.agents/specs/0017-editor-fork-parity.md`, having first confirmed that its
two contested claims are corrected where a reader will meet them: the snapping
sizing and coupling now live in this plan's Tasks 11–13 preamble, and the
residual items live in spec 0014.

- [ ] **Step 9: Update the status handoff**

Rewrite the relevant rows of `.agents/status.md` with **current evidence only**
and the real numbers from Step 7, keeping the file under 250 lines. Replace the
"Next" item that points at writing this plan. State plainly anything that
stayed unverified, including whether the fork's own Playwright snapping suite
was ported (it was not; only its unit specs were).

- [ ] **Step 10: Commit**

```bash
git add THIRD-PARTY-NOTICES.md .agents/dependency-licences.md .agents/architecture.md .agents/decisions.md .agents/specs .agents/screenshots/README.md .agents/status.md
git commit -m "docs: record editor fork-parity owners, decisions and attribution"
```

---

## Self-review record

Checked after writing, against `.agents/specs/0017-editor-fork-parity.md`.

**Spec coverage.** Every scoped item maps to a task: `controls-manager` → 7,
`toolbar-manager` → 10, `deletion-manager` → 6, `clipboard-manager` → 8,
`grouping-manager` → 9, movement snapping → 11–13, indicators → 14,
`error-manager` → 2, image import bounds → 4, crop tool → 5,
`updateArtboard` → 1, spec testing requirements → the unit tests in each task
plus the browser captures in 13, 14 and 15.

**Deliberate departures from the spec, each argued where it occurs.**
1. Snapping is 4,400 lines, not ~2,900, and is not coupling-free; Tasks 11–13
   carry the evidence and the handling.
2. The image bound also applies on rehydrate, because bounding import alone is
   a round-trip geometry bug.
3. Crop gets its own owner rather than folding into `image-manager`, which the
   spec left to this plan to decide.
4. Two extra owners the spec did not name are required by its own scope: the
   `ShortcutManager` extension (Task 3) and the licence attribution (Task 15).

**Type consistency.** `EditorInteraction` gains `errorManager`, `cropManager`,
`deletionManager`, `clipboardManager` and `groupingManager`, plus
`historyManager.suspend`. Every task that adds a member also adds it to the
Task 10 test double, which is the one place a missed member would surface late.
`save: () => void` and `suspend: () => () => void` keep one spelling
throughout.
