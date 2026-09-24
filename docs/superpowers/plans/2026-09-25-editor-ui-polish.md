# Editor UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the layer panel's six-full-text-buttons-per-row list and the inspector's one-value-per-row layout with a Figma-UI3-grade surface: a collapsible layer tree whose object actions come from one registry, rendered in a bottom action row and on the canvas dock.

**Architecture:** A pure projection (`layer-tree.ts`) turns Fabric objects into serializable `LayerRow` values; the React panel renders those values and never holds a `FabricObject`. A single `object-actions.ts` registry owns what each action is, whether it is eligible, and how it runs; the dock, the layer panel's bottom row and (later, spec A) the canvas context menu only render it. Density comes from one opt-in CSS field primitive plus React control components under `editor-shell/controls/`.

**Tech Stack:** TypeScript, React 19, Base UI (`@base-ui/react` 1.8), Tailwind v4.3.3 (utility classes only; the shell's own chrome stays in `editor-shell.css`), Fabric 7.4.0, Vitest + jsdom, Playwright, Biome. New dependency: `lucide-react` 1.48.0 (ISC).

**Spec:** `docs/superpowers/specs/2026-09-25-editor-ui-polish.md`

## Global Constraints

- Fabric is never mirrored in React. The panel renders serializable values only (§35, AGENTS.md).
- One owner per concept (§ ownership doc). Object actions get exactly one owner: the registry.
- Display names persist in `envelope.editorMetadata.layerNames`, which already validates and serializes. Collapsed and selection state are transient and never enter authored history (§67).
- Fabric is the sole order owner; reorder goes through the canvas.
- Visible copy lives in `ui-copy.ts` (§35); every control has an accessible name.
- Motion: 120–180 ms on colour/transform/opacity only; presses translate 1px; panels reveal with a short slide/fade; all of it behind `prefers-reduced-motion: reduce`. No stagger, parallax, springs or animated zoom.
- Every interactive control has a visible focus ring.
- Deliberate simplifications get a `ponytail:` comment naming the ceiling and the upgrade path.
- 500 lines is a signal, 800 is a stop for source files.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on: optional properties are omitted, not set to `undefined`.
- Run commands from `src/web/`.
- A new regression test must fail when the fix is disabled before it is trusted (AGENTS.md).
- Visible behaviour needs rendered/browser inspection, not object counts.

## Review Focus

The five failure modes most likely to bite an author, and where each is pinned:

1. **Reordering a layer silently drops it out of its group.** A drag that lands between two groups must refuse, not restack. → Task 6.
2. **Collapsing a group makes its children unselectable from the tree, and the current selection vanishes from view.** The parent must keep the child selected, or the panel must reveal the ancestor path. → Task 5.
3. **A rename that collides with an existing id, or is empty/whitespace.** Names are display-only, so a collision is survivable, but an empty name renders a blank row. → Task 7.
4. **A lock/visibility toggle on a group child with a hidden or locked ancestor.** Toggling the child must not silently do nothing; the row shows effective state, so clicking must reconcile the path. → Task 4.
5. **The two action surfaces drifting.** A dock button that is enabled while the layer row's twin is disabled, or vice versa, for the same selection. → Task 3.

---

### Task 1: Add Lucide and the action registry

**Files:**
- Modify: `src/web/packages/editor/package.json`
- Create: `src/web/packages/editor/src/object-actions.ts`
- Create: `src/web/packages/editor/src/object-actions.test.ts`
- Modify: `THIRD-PARTY-NOTICES.md`
- Modify: `docs/engineering/dependencies.md`

**Interfaces:**
- Consumes: `EditorInteraction` from `./editor-interaction.js`; `ArrangeAction`, `applyArrange`, `canArrange` from `./arrange.js`; `uiCopy` from `./ui-copy.js`.
- Produces:
  ```ts
  export type ObjectActionId =
    | "duplicate" | "copy" | "cut" | "delete"
    | "front" | "bring-forward" | "send-backward" | "back"
    | "lock" | "unlock" | "group" | "ungroup"
    | `arrange:${ArrangeAction}`;
  export interface ObjectAction {
    readonly id: ObjectActionId;
    readonly label: string;
    readonly icon: LucideIcon;
    readonly eligible: (target: ObjectTarget) => boolean;
    readonly run: (editor: EditorInteraction) => void;
  }
  export const OBJECT_ACTIONS: readonly ObjectAction[];
  export function objectAction(id: ObjectActionId): ObjectAction;
  export function arrangeActions(): readonly ObjectAction[];
  ```

- [ ] **Step 1: Install the dependency**

```bash
cd src/web/packages/editor && npm install lucide-react@1.48.0
```

Verify the licence from the installed package metadata, then add the entry to `THIRD-PARTY-NOTICES.md` (ISC) and `docs/engineering/dependencies.md` in the same commit.

- [ ] **Step 2: Write the failing test**

```ts
// src/web/packages/editor/src/object-actions.test.ts
import { describe, expect, it, vi } from "vitest";
import { type ObjectTarget, OBJECT_ACTIONS, objectAction } from "./object-actions.js";

function target(overrides: Partial<ObjectTarget> = {}): ObjectTarget {
  return { kind: "object", locked: false, memberCount: 1, ...overrides };
}

describe("object action registry", () => {
  it("answers eligibility from the projection alone", () => {
    const deleteAction = objectAction("delete");
    expect(deleteAction.eligible(target())).toBe(true);
    expect(deleteAction.eligible(target({ kind: "none" }))).toBe(false);
    expect(deleteAction.eligible(target({ locked: true }))).toBe(false);
  });

  it("reports every action exactly once", () => {
    const ids = OBJECT_ACTIONS.map((action) => action.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers group only for a real multi-selection", () => {
    expect(objectAction("group").eligible(target({ kind: "group", memberCount: 1 }))).toBe(false);
    expect(objectAction("group").eligible(target({ kind: "group", memberCount: 2 }))).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/object-actions.test.ts`
Expected: FAIL — `Failed to resolve import "./object-actions.js"`.

- [ ] **Step 4: Write the registry**

```ts
// src/web/packages/editor/src/object-actions.ts
import type { LucideIcon } from "lucide-react";
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal,
  AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal,
  AlignStartVertical, AlignVerticalDistributeCenter, ArrowDown, ArrowDownToLine,
  ArrowUp, ArrowUpToLine, Copy, Lock, Scissors, Trash2, Ungroup, Unlock,
} from "lucide-react";
import { type ArrangeAction, applyArrange } from "./arrange.js";
import type { EditorInteraction } from "./editor-interaction.js";
import { uiCopy } from "./ui-copy.js";

/** What a surface may render an action against. Serializable, Fabric-free. */
export interface ObjectTarget {
  readonly kind: "none" | "object" | "group" | "chart";
  readonly locked: boolean;
  readonly memberCount: number;
  /** True when the active object is a Group (ungroup), false for a bare selection. */
  readonly isGroup: boolean;
}

export type ObjectActionId =
  | "duplicate" | "copy" | "cut" | "delete"
  | "front" | "bring-forward" | "send-backward" | "back"
  | "lock" | "unlock" | "group" | "ungroup"
  | `arrange:${ArrangeAction}`;

export interface ObjectAction {
  readonly id: ObjectActionId;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly eligible: (target: ObjectTarget) => boolean;
  readonly run: (editor: EditorInteraction) => void;
}

const hasSelection = (target: ObjectTarget): boolean => target.kind !== "none";

/** One owner for object actions: what each is, when it applies, how it runs. */
export const OBJECT_ACTIONS: readonly ObjectAction[] = [
  { id: "duplicate", label: uiCopy.actions.duplicate, icon: Copy,
    eligible: hasSelection, run: (e) => void e.clipboardManager.duplicate() },
  { id: "copy", label: uiCopy.actions.copy, icon: Copy,
    eligible: hasSelection, run: (e) => void e.clipboardManager.copy() },
  { id: "cut", label: uiCopy.actions.cut, icon: Scissors,
    eligible: hasSelection, run: (e) => void e.clipboardManager.cut() },
  { id: "front", label: uiCopy.actions.front, icon: ArrowUpToLine,
    eligible: hasSelection, run: (e) => e.layerManager.bringToFront() },
  { id: "bring-forward", label: uiCopy.actions.bringForward, icon: ArrowUp,
    eligible: hasSelection, run: (e) => e.layerManager.bringForward() },
  { id: "send-backward", label: uiCopy.actions.sendBackward, icon: ArrowDown,
    eligible: hasSelection, run: (e) => e.layerManager.sendBackwards() },
  { id: "back", label: uiCopy.actions.back, icon: ArrowDownToLine,
    eligible: hasSelection, run: (e) => e.layerManager.sendToBack() },
  { id: "lock", label: uiCopy.actions.lock, icon: Lock,
    eligible: (t) => hasSelection(t) && !t.locked,
    run: (e) => e.objectLockManager.lockObject() },
  { id: "unlock", label: uiCopy.actions.unlock, icon: Unlock,
    eligible: (t) => hasSelection(t) && t.locked,
    run: (e) => e.objectLockManager.unlockObject() },
  { id: "group", label: uiCopy.actions.group, icon: Lock,
    eligible: (t) => t.kind === "group" && t.memberCount > 1 && !t.isGroup,
    run: (e) => e.groupingManager.group() },
  { id: "ungroup", label: uiCopy.actions.ungroup, icon: Ungroup,
    eligible: (t) => t.isGroup,
    run: (e) => e.groupingManager.ungroup() },
  { id: "delete", label: uiCopy.actions.delete, icon: Trash2,
    eligible: hasSelection, run: (e) => e.deletionManager.deleteActive() },
];

const ARRANGE_ICONS: Readonly<Record<ArrangeAction, LucideIcon>> = {
  "align-left": AlignStartVertical,
  "align-center-x": AlignCenterVertical,
  "align-right": AlignEndVertical,
  "align-top": AlignStartHorizontal,
  "align-center-y": AlignCenterHorizontal,
  "align-bottom": AlignEndHorizontal,
  "distribute-x": AlignHorizontalDistributeCenter,
  "distribute-y": AlignVerticalDistributeCenter,
};

/** Arrange is its own group: it needs two or more objects and its own owner. */
export function arrangeActions(): readonly ObjectAction[] {
  return (Object.keys(ARRANGE_ICONS) as ArrangeAction[]).map((action) => ({
    id: `arrange:${action}` as const,
    label: uiCopy.arrangeLabels[action],
    icon: ARRANGE_ICONS[action],
    eligible: (target) => target.memberCount > 1,
    run: (editor) => void applyArrange(editor, action),
  }));
}

export function objectAction(id: ObjectActionId): ObjectAction {
  const found =
    OBJECT_ACTIONS.find((action) => action.id === id) ??
    arrangeActions().find((action) => action.id === id);
  if (found === undefined) throw new Error(`Unknown object action: ${id}`);
  return found;
}
```

Add `arrangeLabels` to `ui-copy.ts` with the eight labels currently spelled out in `layer-panel.ts:191-200` (`align-left: "Align left"`, etc.), and add `groupIcon`-free `group` copy already present in `uiCopy.actions`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run packages/editor/src/object-actions.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Verify the registry has teeth**

Temporarily change `hasSelection` to `() => true` and rerun. Expected: the first test fails on the `"none"` case. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/package.json src/web/package-lock.json \
  src/web/packages/editor/src/object-actions.ts \
  src/web/packages/editor/src/object-actions.test.ts \
  src/web/packages/editor/src/ui-copy.ts \
  THIRD-PARTY-NOTICES.md docs/engineering/dependencies.md
git commit -m "feat(editor): own object actions in one registry"
```

---

### Task 2: Route the dock through the registry

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/canvas-dock.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/bridge.ts`
- Modify: `src/web/packages/editor/src/editor-shell/bridge.dom.test.ts`

**Interfaces:**
- Consumes: `OBJECT_ACTIONS`, `arrangeActions`, `ObjectTarget`, `ObjectActionId` (Task 1).
- Produces: `EditorShellSnapshot` gains `readonly isGroup: boolean`; `ShellAction` stays as it is so the menu bar keeps working, and `EditorShellBridge` gains `readonly target: () => ObjectTarget`.

- [ ] **Step 1: Write the failing test**

Append to `bridge.dom.test.ts`:

```ts
it("reports a Fabric-free target for the action registry", () => {
  const selection = new ActiveSelection([
    new Rect({ left: 0, top: 0, width: 10, height: 10 }),
    new Rect({ left: 20, top: 0, width: 10, height: 10 }),
  ]);
  const bridge = bridgeFor(selection);
  expect(bridge.target()).toEqual({
    kind: "group",
    locked: false,
    memberCount: 2,
    isGroup: false,
  });
});

it("agrees with the registry about eligibility", () => {
  const bridge = bridgeFor(new Group([new Rect({ width: 10, height: 10 })]));
  expect(bridge.can("ungroup")).toBe(true);
  expect(objectAction("ungroup").eligible(bridge.target())).toBe(true);
  expect(objectAction("group").eligible(bridge.target())).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/editor/src/editor-shell/bridge.dom.test.ts`
Expected: FAIL — `bridge.target is not a function`.

- [ ] **Step 3: Implement `target()` and delegate `can` to the registry**

In `bridge.ts`, add to the interface:

```ts
  /** The registry's view of the selection. Serializable; never a FabricObject. */
  target(): ObjectTarget;
```

Implement it beside `snapshot()`:

```ts
  const target = (): ObjectTarget => {
    const active = activeObject();
    const base = snapshot();
    return {
      kind: base.activeKind,
      locked: base.locked,
      memberCount: base.selectedCount,
      isGroup: active instanceof Group,
    };
  };
```

Then replace the hand-written `can` for the actions the registry owns, keeping `arrange` delegation as it is:

```ts
  const can = (action: ShellAction): boolean => {
    if (activeObject() === undefined) return false;
    if (typeof action === "object")
      return canArrange(input.editor, action.action);
    return objectAction(action).eligible(target());
  };
```

`ShellAction`'s string members are exactly the non-arrange `ObjectActionId` members, so `objectAction(action)` typechecks; if TypeScript cannot narrow it, add a small `isObjectActionId` guard rather than casting.

- [ ] **Step 4: Render the dock from the registry**

Replace `dockActions` in `canvas-dock.tsx` with a registry render. Delete the emoji table entirely:

```tsx
export function CanvasDock({ bridge, onVisibility }: {
  readonly bridge: EditorShellBridge | undefined;
  readonly onVisibility: (visible: boolean) => void;
}): React.JSX.Element {
  const [snapshot, setSnapshot] = useState(() => bridge?.snapshot() ?? noSelection);
  useEffect(() => {
    setSnapshot(bridge?.snapshot() ?? noSelection);
    return bridge?.subscribe(() => setSnapshot(bridge.snapshot()));
  }, [bridge]);
  useEffect(
    () => onVisibility(snapshot.selectedCount > 0),
    [onVisibility, snapshot.selectedCount],
  );

  const target = bridge?.target();
  const editor = bridge?.editor;
  const actions = target === undefined || editor === undefined
    ? []
    : [...OBJECT_ACTIONS, ...arrangeActions()].filter((action) =>
        action.eligible(target) &&
        (action.id.startsWith("arrange:")
          ? bridge.can({ type: "arrange", action: action.id.slice("arrange:".length) as ArrangeAction })
          : bridge.can(action.id)),
      );

  return (
    <>
      {actions.map(({ id, icon: Icon, label }) => (
        <Tooltip.Root key={id}>
          <Tooltip.Trigger aria-label={label} onClick={() => {
            if (id.startsWith("arrange:"))
              void editor?.session.arrange(id.slice("arrange:".length) as ArrangeAction);
            else bridge?.run(id);
          }}>
            <Icon aria-hidden size={15} strokeWidth={1.75} />
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" sideOffset={8}>
              <Tooltip.Popup className="editor-shell-tooltip" role="tooltip">{label}</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ))}
    </>
  );
}
```

`EditorShellBridge` gains `readonly editor: EditorInteraction`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run packages/editor/src/editor-shell`
Expected: PASS. The existing dock assertions in `shell-layout.dom.test.tsx` may name emoji; update them to assert `aria-label` instead — accessible names were always the contract.

- [ ] **Step 6: Verify the surfaces cannot drift**

In `bridge.dom.test.ts`, the second new test above already asserts `bridge.can("ungroup")` and `objectAction("ungroup").eligible(bridge.target())` agree. Temporarily make `can` return `true` unconditionally and confirm that test fails. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/canvas-dock.tsx \
  src/web/packages/editor/src/editor-shell/bridge.ts \
  src/web/packages/editor/src/editor-shell/bridge.dom.test.ts \
  src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx
git commit -m "refactor(editor): render the canvas dock from the action registry"
```

---

### Task 3: The layer projection

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/layer-tree.ts`
- Create: `src/web/packages/editor/src/editor-shell/layer-tree.test.ts`

**Interfaces:**
- Consumes: Fabric `Canvas`, `FabricObject`, `Group`.
- Produces:
  ```ts
  export type LayerKind = "text" | "shape" | "chart" | "group" | "image";
  export interface LayerRow {
    readonly id: string;
    readonly name: string;
    readonly kind: LayerKind;
    readonly depth: number;
    readonly parentId: string | undefined;
    readonly hasChildren: boolean;
    readonly visible: boolean;
    readonly locked: boolean;
    readonly selected: boolean;
  }
  export function projectLayers(input: {
    readonly root: readonly FabricObject[];
    readonly selected: readonly FabricObject[];
    readonly names: Readonly<Record<string, string>>;
    readonly collapsed: ReadonlySet<string>;
  }): readonly LayerRow[];
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/web/packages/editor/src/editor-shell/layer-tree.test.ts
import { Group, Rect, Textbox } from "fabric/es";
import { describe, expect, it } from "vitest";
import { projectLayers } from "./layer-tree.js";

const base = { names: {}, collapsed: new Set<string>(), selected: [] } as const;

describe("layer projection", () => {
  it("lists top-most first, matching paint order reversed", () => {
    const bottom = new Rect({ id: "bottom", width: 10, height: 10 });
    const top = new Rect({ id: "top", width: 10, height: 10 });
    const rows = projectLayers({ ...base, root: [bottom, top] });
    expect(rows.map((row) => row.id)).toEqual(["top", "bottom"]);
  });

  it("indents group children and marks the group as having children", () => {
    const child = new Textbox("hi", { id: "child" });
    const group = new Group([child], { id: "group" });
    const rows = projectLayers({ ...base, root: [group] });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "group", depth: 0, hasChildren: true, kind: "group" });
    expect(rows[1]).toMatchObject({ id: "child", depth: 1, parentId: "group", kind: "text" });
  });

  it("hides the children of a collapsed group but keeps the group", () => {
    const group = new Group([new Rect({ id: "child", width: 10, height: 10 })], { id: "group" });
    const rows = projectLayers({ ...base, root: [group], collapsed: new Set(["group"]) });
    expect(rows.map((row) => row.id)).toEqual(["group"]);
  });

  it("takes visibility and lock from the whole ancestor path", () => {
    const child = new Rect({ id: "child", width: 10, height: 10 });
    const group = new Group([child], { id: "group", visible: false });
    const rows = projectLayers({ ...base, root: [group] });
    expect(rows[1]).toMatchObject({ id: "child", visible: false, locked: false });
  });

  it("marks the row whose object is selected, resolving a child through its group", () => {
    const child = new Rect({ id: "child", width: 10, height: 10 });
    const group = new Group([child], { id: "group" });
    const rows = projectLayers({ ...base, root: [group], selected: [group] });
    expect(rows.find((row) => row.id === "group")?.selected).toBe(true);
    expect(rows.find((row) => row.id === "child")?.selected).toBe(false);
  });

  it("prefers a stored display name over the id", () => {
    const rect = new Rect({ id: "header", width: 10, height: 10 });
    const rows = projectLayers({ ...base, root: [rect], names: { header: "Header rule" } });
    expect(rows[0]?.name).toBe("Header rule");
  });

  it("does not crash on an object with no id", () => {
    const rows = projectLayers({ ...base, root: [new Rect({ width: 10, height: 10 })] });
    expect(rows[0]?.id).toBe("unidentified");
    expect(rows[0]?.name).toBe("unidentified");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/layer-tree.test.ts`
Expected: FAIL — import does not resolve.

- [ ] **Step 3: Write the projection**

Port `entriesFor`, `effectiveState` and `objectId` from `layer-panel.ts:96-116, 225-238`, then flatten the tree into rows during the walk rather than after:

```ts
// src/web/packages/editor/src/editor-shell/layer-tree.ts
import { type FabricObject, Group } from "fabric/es";
import { VigiliaChart } from "@vigilia/scene-fabric";

export type LayerKind = "text" | "shape" | "chart" | "group" | "image";

export interface LayerRow { /* as in Interfaces above */ }

/** Fabric type tags are lowercase class names; the envelope keeps "VigiliaChart". */
function kindOf(object: FabricObject): LayerKind {
  if (object instanceof VigiliaChart) return "chart";
  if (object instanceof Group) return "group";
  const type = (object as { type?: string }).type;
  if (type === "textbox" || type === "i-text" || type === "text") return "text";
  if (type === "image") return "image";
  return "shape";
}

export function projectLayers({ root, selected, names, collapsed }: {
  readonly root: readonly FabricObject[];
  readonly selected: readonly FabricObject[];
  readonly names: Readonly<Record<string, string>>;
  readonly collapsed: ReadonlySet<string>;
}): readonly LayerRow[] {
  const rows: LayerRow[] = [];
  const walk = (
    objects: readonly FabricObject[],
    depth: number,
    ancestors: readonly FabricObject[],
    parentId: string | undefined,
  ): void => {
    for (const object of [...objects].reverse()) {
      const id = (object as { id?: string }).id ?? "unidentified";
      const path = [...ancestors, object];
      const isGroup = object instanceof Group;
      rows.push({
        id,
        name: names[id] ?? id,
        kind: kindOf(object),
        depth,
        parentId,
        hasChildren: isGroup && object.getObjects().length > 0,
        visible: path.every((entry) => entry.visible),
        locked: path.some((entry) => (entry as { locked?: boolean }).locked === true),
        selected: selected.includes(object),
      });
      if (isGroup && !collapsed.has(id))
        walk(object.getObjects(), depth + 1, path, id);
    }
  };
  walk(root, 0, [], undefined);
  return rows;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/editor/src/editor-shell/layer-tree.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Verify teeth**

Change `visible` to read only the object's own flag and rerun. Expected: the ancestor-path test fails. Restore.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/layer-tree.ts \
  src/web/packages/editor/src/editor-shell/layer-tree.test.ts
git commit -m "feat(editor): project Fabric layers into serializable rows"
```

---

### Task 4: Read and write layer display names through `editorMetadata`

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/bridge.ts`
- Modify: `src/web/packages/editor/src/editor-shell/bridge.dom.test.ts`
- Modify: `src/web/packages/editor/src/editor-shell/session-facade.ts`
- Modify: `src/web/packages/editor/src/editor-shell.ts`

**Interfaces:**
- Consumes: `projectLayers`, `LayerRow` (Task 3).
- Produces: `EditorShellBridge.layers(): readonly LayerRow[]` and `EditorShellBridge.renameLayer(id: string, name: string): void`; `EditorActionFacade.layerNames(): Readonly<Record<string, string>>` and `setLayerNames(names: Readonly<Record<string, string>>): void`.

`editorMetadata` is validated and serialized today but has no reader or writer. It needs no shape change: `layerNames` is one key inside it.

- [ ] **Step 1: Write the failing test**

Append to `bridge.dom.test.ts`:

```ts
it("carries display names into the projection and back out again", () => {
  const rect = new Rect({ id: "header", width: 10, height: 10 });
  const bridge = bridgeFor(rect, { layerNames: { header: "Header rule" } });
  expect(bridge.layers()[0]?.name).toBe("Header rule");

  bridge.renameLayer("header", "Top rule");
  expect(bridge.layers()[0]?.name).toBe("Top rule");
});

it("falls back to the id when a rename is blank", () => {
  const rect = new Rect({ id: "header", width: 10, height: 10 });
  const bridge = bridgeFor(rect);
  bridge.renameLayer("header", "   ");
  expect(bridge.layers()[0]?.name).toBe("header");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/bridge.dom.test.ts`
Expected: FAIL — `bridge.layers is not a function`.

- [ ] **Step 3: Implement the façade methods**

In `session-facade.ts`:

```ts
  /** Editor-only display state; persisted in envelope.editorMetadata (§172). */
  layerNames(): Readonly<Record<string, string>>;
  setLayerNames(names: Readonly<Record<string, string>>): void;
```

In `editor-shell.ts`, hold the map beside `let globals` and expose it through the facade. `#snapshot` already spreads the envelope, so the value must be threaded into `snapshot(input)` as `editorMetadata: { ...input.editorMetadata, layerNames }` — check `serialiseThemeEnvelope`'s signature and pass it, since `editorMetadata` is currently never supplied by the editor.

- [ ] **Step 4: Implement `layers()` and `renameLayer()`**

```ts
  const names = (): Readonly<Record<string, string>> => input.session.layerNames();

  const layers = (): readonly LayerRow[] => {
    const active = canvas.getActiveObject();
    const selected =
      active instanceof ActiveSelection
        ? active.getObjects()
        : active === undefined ? [] : [active];
    return projectLayers({
      root: canvas.getObjects(),
      selected,
      names: names(),
      collapsed: collapsedGroups,
    });
  };

  const renameLayer = (id: string, name: string): void => {
    const trimmed = name.trim();
    const next = { ...names() };
    if (trimmed === "") delete next[id];
    else next[id] = trimmed;
    input.session.setLayerNames(next);
    notify();
  };
```

`collapsedGroups` is a bridge-local `Set<string>` for now (Task 5 lifts it into the shell). A rename is editor-only metadata, so it does **not** call `historyManager.saveState()` — it is not authored document content, and §67 keeps runtime state out of authored history.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run packages/editor/src/editor-shell`
Expected: PASS.

- [ ] **Step 6: Verify names survive a save/reopen**

Add to `tests/e2e/editor.spec.ts` a test that renames a layer, saves the package, reopens it and asserts the renamed row is still there. Run it:

Run: `VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep "keeps a layer's display name across save and reopen" --workers=1`
Expected: PASS. This is the evidence that `editorMetadata` actually round-trips; a unit test cannot show it.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/bridge.ts \
  src/web/packages/editor/src/editor-shell/bridge.dom.test.ts \
  src/web/packages/editor/src/editor-shell/session-facade.ts \
  src/web/packages/editor/src/editor-shell.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): persist layer display names in editorMetadata"
```

---

### Task 5: The layer tree panel

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/layer-panel.tsx`
- Create: `src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/bridge.ts`
- Delete: `src/web/packages/editor/src/layer-panel.ts`
- Modify: `src/web/packages/editor/src/editor-shell.ts` (panel wiring)
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`

**Interfaces:**
- Consumes: `LayerRow` (Task 3), `bridge.layers()`, `bridge.renameLayer()` (Task 4), `OBJECT_ACTIONS` (Task 1).
- Produces: `EditorShellBridge` gains `selectLayer(id)`, `setLayerVisible(id, visible)`, `setLayerLocked(id, locked)`, `setCollapsed(id, collapsed)`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx
// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { LayerPanel } from "./layer-panel.js";
import type { EditorShellBridge } from "./bridge.js";

function bridge(rows: readonly unknown[], overrides = {}): EditorShellBridge {
  return {
    snapshot: () => ({ selectedCount: 1, locked: false, activeKind: "object" }),
    can: () => true,
    target: () => ({ kind: "object", locked: false, memberCount: 1, isGroup: false }),
    layers: () => rows as never,
    selectLayer: vi.fn(),
    setLayerVisible: vi.fn(),
    setLayerLocked: vi.fn(),
    renameLayer: vi.fn(),
    setCollapsed: vi.fn(),
    subscribe: () => () => undefined,
    run: vi.fn(),
    session: { savePackage: vi.fn() } as never,
    editor: {} as never,
    destroy: vi.fn(),
    ...overrides,
  } as EditorShellBridge;
}

it("indents a group child and shows only its state icons", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<LayerPanel bridge={bridge([
    { id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined,
      hasChildren: true, visible: true, locked: false, selected: false },
    { id: "child", name: "Child", kind: "text", depth: 1, parentId: "group",
      hasChildren: false, visible: true, locked: true, selected: true },
  ])} />));

  const rows = host.querySelectorAll<HTMLElement>("[data-vigilia-layer]");
  expect(rows).toHaveLength(2);
  // One dense line, plus lock and visibility indicators — not six text buttons.
  expect(rows[1]?.style.getPropertyValue("--layer-depth")).toBe("1");
  expect(rows[1]?.querySelectorAll("button")).toHaveLength(2);
  expect(rows[1]?.querySelector('[aria-label="Unlock"]')).not.toBeNull();
});

it("collapses and expands a group from its twisty", async () => {
  const setCollapsed = vi.fn();
  const rows = [
    { id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined,
      hasChildren: true, visible: true, locked: false, selected: false },
  ];
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<LayerPanel bridge={bridge(rows, { setCollapsed })} />));
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Collapse Group"]')?.click(),
  );
  expect(setCollapsed).toHaveBeenCalledWith("group", true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
Expected: FAIL — import does not resolve.

- [ ] **Step 3: Implement the panel**

`LayerPanel` renders `bridge.layers()` into rows. Each row:

- sets `style={{ "--layer-depth": row.depth }}` and `paddingLeft: calc(6px + var(--layer-depth) * 13px)`;
- shows the kind icon, the name, and a `title={row.id}` so the raw id is on hover;
- shows exactly two buttons: visibility (`Eye`/`EyeOff`) and lock (`Lock`/`Unlock`), always present, `aria-pressed` reflecting effective state;
- is `aria-selected` and calls `selectLayer(row.id)` on click;
- on double-click swaps the name for an `<input>` with `aria-label={`${uiCopy.panels.rename} ${row.name}`}`, committing on Enter/blur via `renameLayer`, cancelling on Escape.

Re-render on bridge events using the same `useSyncExternalStore` pattern `shell-layout.tsx:116-118` already uses, with `bridge.layers()` as the snapshot. Keep the snapshot referentially stable: `useSyncExternalStore` requires `getSnapshot` to return an equal value when nothing changed, so cache the projection and only recompute inside the `subscribe` listener.

Delete `src/web/packages/editor/src/layer-panel.ts` and its mount in `editor-shell.ts`; the shell's `hosts.layers` node is replaced by a React slot rendered inside `shell-layout.tsx`.

- [ ] **Step 4: Implement the four commands**

In `bridge.ts`:

```ts
  selectLayer(id) {
    const target = findById(canvas.getObjects(), id);
    if (target === undefined) return;
    // A child of a group is selected through its owning group, as the DOM panel did.
    canvas.setActiveObject(ownerOf(target) ?? target);
    canvas.requestRenderAll();
    notify();
  },
  setLayerVisible(id, visible) {
    const target = findById(canvas.getObjects(), id);
    if (target === undefined) return;
    // Showing a descendant whose ancestor is hidden would show nothing, so the
    // whole path is revealed; hiding touches only the requested object.
    if (visible) for (const entry of pathTo(canvas.getObjects(), id)) entry.set("visible", true);
    else target.set("visible", false);
    target.setCoords();
    canvas.requestRenderAll();
    input.editor.historyManager.saveState();
    notify();
  },
  setLayerLocked(id, locked) {
    const target = findById(canvas.getObjects(), id);
    if (target === undefined) return;
    if (locked) input.editor.objectLockManager.lockObject({ object: target });
    else input.editor.objectLockManager.unlockObject({ object: target });
    notify();
  },
  setCollapsed(id, collapsed) {
    if (collapsed) collapsedGroups.add(id);
    else collapsedGroups.delete(id);
    notify();
  },
```

`findById`, `pathTo` and `ownerOf` are small helpers over the Fabric tree; `ownerOf` is what the old `entriesFor` computed as `select`. Put them in `layer-tree.ts` beside the projection so they stay testable, and export them.

- [ ] **Step 5: Replace the density CSS**

In `editor-shell.css`, replace the forcing rules at lines ~307-339 (`display: block` on labels/sections and `display: block; width: 100%` on inputs/selects) with the opt-in primitives:

```css
.vigilia-field     { display: grid; grid-template-columns: 72px 1fr; align-items: center; gap: 6px; }
.vigilia-field-row { display: flex; gap: 6px; align-items: center; }
.vigilia-numeric   { font-variant-numeric: tabular-nums; }
.vigilia-layer-row { display: flex; align-items: center; gap: 4px;
                     padding-left: calc(6px + var(--layer-depth, 0) * 13px); }
.vigilia-layer-row[data-selected="true"] { background: var(--shell-selected, rgba(255,255,255,0.08)); }
```

Remove `max-width: 100%` from controls only if nothing depends on it; check the inspector panels after the change.

- [ ] **Step 6: Run the tests and inspect the rendered panel**

Run: `npx vitest run packages/editor/src/editor-shell`
Expected: PASS.

Then verify in the browser — object counts are not evidence:

```bash
cd src/web && npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium \
  --grep "captures the mounted editor for visual review" --workers=1
```

Open the generated `docs/evidence/screenshots/editor-desktop-chromium.png` and confirm: group children are indented, each row has exactly two icon buttons, and no row shows text buttons.

- [ ] **Step 7: Verify the state-icon path test has teeth**

Change `setLayerVisible`'s reveal branch to set only the target and rerun the browser test for a nested hidden child. Expected: the child stays invisible and the capture shows it. Restore.

- [ ] **Step 8: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/layer-panel.tsx \
  src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx \
  src/web/packages/editor/src/editor-shell/layer-tree.ts \
  src/web/packages/editor/src/editor-shell/layer-tree.test.ts \
  src/web/packages/editor/src/editor-shell/bridge.ts \
  src/web/packages/editor/src/editor-shell/shell-layout.tsx \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/layer-panel.ts \
  src/web/packages/editor/src/editor-shell.ts
git commit -m "feat(editor): layer tree with per-row state icons"
```

---

### Task 6: The bottom action row and drag reorder

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/bridge.ts`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`

**Interfaces:**
- Consumes: `OBJECT_ACTIONS` (Task 1), `ObjectTarget` (Task 1), `projectLayers` (Task 3).
- Produces: `EditorShellBridge.reorderLayer(id: string, beforeId: string): boolean` — `true` when the move happened.

- [ ] **Step 1: Write the failing tests**

```tsx
it("renders object actions in a bottom row, not on the selected row", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<LayerPanel bridge={bridge(rows)} />));
  const row = host.querySelector('[data-vigilia-layer="child"]');
  expect(row?.querySelector('[aria-label="Duplicate"]')).toBeNull();
  expect(host.querySelector('[data-vigilia-layer-actions] [aria-label="Duplicate"]')).not.toBeNull();
});

it("renders the bottom row from the registry, so eligibility matches the dock", async () => {
  const can = vi.fn((action: string) => action === "delete");
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<LayerPanel bridge={bridge(rows, { can })} />));
  const row = host.querySelector("[data-vigilia-layer-actions]");
  expect(row?.querySelectorAll("button")).toHaveLength(1);
  expect(row?.querySelector("button")?.getAttribute("aria-label")).toBe("Delete");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
Expected: FAIL — no `[data-vigilia-layer-actions]` element.

- [ ] **Step 3: Implement the bottom row**

Below the tree, render one row of icon buttons from `bridge.target()`:

```tsx
const target = bridge?.target();
<footer data-vigilia-layer-actions="">
  {[...OBJECT_ACTIONS, ...arrangeActions()]
    .filter((action) => target !== undefined && action.eligible(target) && eligibleInShell(action.id))
    .map(({ id, icon: Icon, label }) => (
      <button key={id} type="button" aria-label={label} onClick={() => runAction(id)}>
        <Icon aria-hidden size={15} strokeWidth={1.75} />
      </button>
    ))}
</footer>
```

`eligibleInShell` is the one shared predicate: extract it from `canvas-dock.tsx` (Task 2) into `object-actions.ts` as `export function actionEnabled(bridge, id): boolean` so the dock and this row call the same function. Seeing the same function in both places is the point of the task — do not re-implement the check here.

- [ ] **Step 4: Implement reorder**

In `bridge.ts`:

```ts
  reorderLayer(id, beforeId) {
    const moved = findById(canvas.getObjects(), id);
    const anchor = findById(canvas.getObjects(), beforeId);
    if (moved === undefined || anchor === undefined) return false;
    // v1 restacks inside one parent only: crossing a group boundary changes
    // membership, which is a different operation with different semantics.
    if (ownerOf(moved) !== ownerOf(anchor)) return false;
    const parent = ownerOf(moved);
    const siblings = parent === undefined ? canvas.getObjects() : parent.getObjects();
    const target = siblings.indexOf(anchor);
    if (target < 0) return false;
    // Fabric is the sole order owner; moveObjectTo reorders the array Fabric paints.
    canvas.moveObjectTo(moved, target);
    canvas.requestRenderAll();
    input.editor.historyManager.saveState();
    notify();
    return true;
  },
```

Wire HTML5 drag events on rows (`draggable`, `onDragStart`, `onDragOver` to show the drop line, `onDrop` → `reorderLayer`). A refused drop shows no line and changes nothing.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run packages/editor/src/editor-shell`
Expected: PASS.

- [ ] **Step 6: Add the browser test and verify it has teeth**

```ts
test("reorders a layer and refuses a cross-group drop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
  await page.goto(EDITOR);
  // Drag the text row above the shape row inside the same parent, then assert
  // the new order in the panel and that a save/reopen keeps it.
  // Then drag a child onto a sibling in another group and assert nothing moved.
});
```

Run: `npx playwright test --project=desktop-chromium --grep "reorders a layer" --workers=1`
Expected: PASS. Then make `reorderLayer` ignore the parent check and confirm the cross-group case fails. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/layer-panel.tsx \
  src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx \
  src/web/packages/editor/src/editor-shell/bridge.ts \
  src/web/packages/editor/src/editor-shell/canvas-dock.tsx \
  src/web/packages/editor/src/editor-shell/shell-layout.tsx \
  src/web/packages/editor/src/object-actions.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): layer panel bottom action row and drag reorder"
```

---

### Task 7: Arrange on the top toolbar

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/packages/editor/src/ui-copy.ts`

**Interfaces:**
- Consumes: `arrangeActions()`, `actionEnabled` (Tasks 1, 6).
- Produces: nothing consumed by later tasks.

The layer panel's arrange block (`layer-panel.ts:183-212`) is deleted with the file in Task 5. Following Figma, arrange belongs on a toolbar above the canvas, where it applies to a multi-selection.

- [ ] **Step 1: Write the failing test**

```tsx
it("puts arrange on the canvas toolbar, disabled without a multi-selection", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const toolbar = root.querySelector("[data-vigilia-arrange-toolbar]");
  expect(toolbar).not.toBeNull();
  expect(toolbar?.querySelectorAll("button")).toHaveLength(8);
  for (const button of toolbar?.querySelectorAll("button") ?? [])
    expect(button.disabled).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/shell-layout.dom.test.tsx`
Expected: FAIL — no toolbar element.

- [ ] **Step 3: Implement the toolbar**

Add a `<div className="editor-shell-arrange" data-vigilia-arrange-toolbar="">` inside `.editor-shell-stage`, above the dock, rendering `arrangeActions()` filtered by `actionEnabled(bridge, action.id)` and `target.memberCount > 1`, each an icon button with `aria-label` and a `title`.

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/editor/src/editor-shell/shell-layout.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/shell-layout.tsx \
  src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/ui-copy.ts
git commit -m "feat(editor): move arrange to the canvas toolbar"
```

---

### Task 8: Dense field controls

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/controls/number-field.tsx`
- Create: `src/web/packages/editor/src/editor-shell/controls/linked-pair.tsx`
- Create: `src/web/packages/editor/src/editor-shell/controls/color-swatch.tsx`
- Create: `src/web/packages/editor/src/editor-shell/controls/controls.dom.test.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/packages/editor/src/artboard-panel.ts`

**Interfaces:**
- Consumes: Base UI `Popover`, `Collapsible`.
- Produces:
  ```ts
  export function NumberField(props: {
    label: string; value: number; step?: number; min?: number; max?: number;
    onCommit: (value: number) => void; invalidMessage?: string;
  }): React.JSX.Element;
  export function LinkedPair(props: {
    label: string; first: { label: string; value: number };
    second: { label: string; value: number };
    onCommit: (first: number, second: number) => void;
  }): React.JSX.Element;
  export function ColorSwatch(props: {
    label: string; value: string; tokens: readonly { key: string; label: string; css: string }[];
    onPick: (key: string) => void;
  }): React.JSX.Element;
  ```

- [ ] **Step 1: Write the failing tests**

```tsx
it("rejects an out-of-range number instead of coercing it to zero", async () => {
  const onCommit = vi.fn();
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(
    <NumberField label="Width" value={100} min={1} max={4096} onCommit={onCommit} />,
  ));
  const input = host.querySelector("input")!;
  await act(async () => {
    input.value = "abc";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(onCommit).not.toHaveBeenCalled();
  expect(host.querySelector("[role=alert]")).not.toBeNull();
});

it("emits one commit for a linked pair", async () => {
  const onCommit = vi.fn();
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(
    <LinkedPair label="Position" first={{ label: "X", value: 1 }} second={{ label: "Y", value: 2 }}
      onCommit={onCommit} />,
  ));
  const [x, y] = host.querySelectorAll("input");
  await act(async () => {
    x!.value = "10"; x!.dispatchEvent(new Event("change", { bubbles: true }));
    y!.value = "20"; y!.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(onCommit).toHaveBeenCalledTimes(2);
  expect(onCommit).toHaveBeenLastCalledWith(10, 20);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run packages/editor/src/editor-shell/controls/controls.dom.test.tsx`
Expected: FAIL — imports do not resolve.

- [ ] **Step 3: Implement the three controls**

Each uses the `.vigilia-field` / `.vigilia-field-row` / `.vigilia-numeric` classes from Task 5 and never a full-width control. Refusing invalid input rather than coercing is an existing project rule — `artboard-panel.ts`'s `isDimension` already does this; reuse that predicate rather than writing a second one.

- [ ] **Step 4: Regroup the artboard panel**

`artboard-panel.ts:119-147` appends eleven flat siblings. Group them into field rows: width/height as a `LinkedPair`, name/author/description as text fields, and the three selects on `vigilia-field-row`s. It stays an imperative DOM panel for now — a `ponytail:` comment records that only the markup changed, with React migration as a later step if that panel grows.

- [ ] **Step 5: Run the tests and inspect**

Run: `npx vitest run packages/editor/src/editor-shell/controls`
Expected: PASS.

Then rebuild and capture, and inspect the image:

```bash
cd src/web && npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium \
  --grep "captures changed artboard controls" --workers=1
```

Confirm width and height share one row and no control spans the panel width. Add a `docs/evidence/screenshots/README.md` row if the capture is new.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/controls \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/artboard-panel.ts \
  docs/evidence/screenshots
git commit -m "feat(editor): dense field controls for document panels"
```

---

### Task 9: Motion and focus rings

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.tsx`

**Interfaces:**
- Consumes: nothing. Produces: nothing.

- [ ] **Step 1: Add the motion rules**

```css
.editor-shell button,
.editor-shell input,
.editor-shell select,
.editor-shell [role="tab"],
.editor-shell [role="menuitem"] {
  transition: background-color 140ms ease, border-color 140ms ease,
              color 140ms ease, transform 140ms ease, opacity 140ms ease;
}
.editor-shell button:active { transform: translateY(1px); }
.editor-shell :is(button, input, select, [role="tab"], [role="menuitem"], [tabindex]):focus-visible {
  outline: 2px solid var(--shell-accent, #7dd3fc);
  outline-offset: 1px;
}
/* Panel reveal: a short slide/fade on mount only — no list stagger. */
.editor-shell-panel,
.editor-shell-inspector { animation: vigilia-panel-in 160ms ease-out; }
@keyframes vigilia-panel-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .editor-shell * { transition: none !important; animation: none !important; }
}
```

Only `background-color`, `border-color`, `color`, `transform` and `opacity` are transitioned — never `top`/`left`/`width`/`height`.

- [ ] **Step 2: Verify in the browser**

Run: `cd src/web && npm run build && VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep "captures the mounted editor for visual review" --workers=1`
Expected: PASS, and the capture still renders (motion must not leave a panel invisible).

- [ ] **Step 3: Verify the reduced-motion guard**

```ts
test("suppresses motion when the user asks for reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(EDITOR);
  const duration = await page.locator(".editor-shell-panel").evaluate(
    (el) => getComputedStyle(el).animationDuration,
  );
  expect(duration).toBe("0s");
});
```

Run: `npx playwright test --project=desktop-chromium --grep "suppresses motion" --workers=1`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): restrained motion and visible focus rings"
```

---

### Task 10: Full gate

**Files:** none created; verification only.

- [ ] **Step 1: Run the broad gate**

```bash
cd src/web
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run size
```

`format:check` currently reports unrelated formatting in `tests/e2e/host-settings.spec.ts`; if that is still the only failure, record it rather than reformatting an untouched file.

- [ ] **Step 2: Run the browser suite**

```bash
npx playwright install chromium   # if needed
npm run test:e2e
```

`display-fabric.spec.ts` has two known pre-existing phone-chromium failures ("keeps repainting as samples arrive", "is byte-stable at a fixed clock on one platform"). Confirm they are unchanged and report them; do not absorb them into this change.

- [ ] **Step 3: Inspect the rendered editor**

Rebuild and capture the editor, then open the image and check each spec acceptance item by eye: indentation and collapse, two state icons per row, actions in the bottom row only, arrange on the toolbar, paired geometry fields, focus rings.

- [ ] **Step 4: Update STATUS.md**

Replace the "Last completed change" section with a 1–5 bullet summary of this work, update "Next" and "Blockers / unverified", then run `npm run status:check`.

- [ ] **Step 5: Commit**

```bash
git add STATUS.md
git commit -m "docs(status): record the editor UI polish"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Action registry, one owner two surfaces | 1, 2, 6 |
| Layer tree: indent, collapse, dense row | 3, 5 |
| Per-row lock and visibility indicators | 5 |
| Bottom action row | 6 |
| Drag reorder, within one parent | 6 |
| Inline rename | 5 |
| Arrange moves to the top toolbar | 7 |
| Three homes for state | 3 (projection), 4 (`editorMetadata`), 6 (order) |
| Projection, not mirroring (`LayerRow`) | 3 |
| Bridge `layers()` and commands | 4, 5, 6 |
| Density CSS primitive and field components | 5, 8 |
| `artboard-panel` regrouping | 8 |
| Motion and focus rings | 9 |
| Lucide dependency and notices | 1 |
| Acceptance: full gate | 10 |

**Placeholder scan:** no "TBD"/"handle edge cases"/"similar to Task N". Every implementation step carries code or an exact predicate. Task 4 Step 3 and Task 5 Step 4 name behaviour to implement rather than reproducing a whole file, because the surrounding file is the owner and duplicating it here would drift; each names the exact function and the exact call.

**Type consistency:** `ObjectTarget` fields (`kind`, `locked`, `memberCount`, `isGroup`) are the same in Tasks 1, 2, 6. `LayerRow` fields are the same in Tasks 3, 4, 5. `actionEnabled(bridge, id)` is defined once (Task 2, extracted in Task 6) and used by both surfaces. `reorderLayer` returns `boolean` in Task 6 and is asserted as such.

**Review Focus coverage:** item 1 → Task 6 Step 6; item 2 → Task 5 Step 1 and Step 7; item 3 → Task 4 Step 1 (blank name) and Task 5 Step 3 (rename input); item 4 → Task 5 Step 7; item 5 → Task 2 Step 6 and Task 6 Step 1.

**Known ordering constraint:** Task 4's `collapsedGroups` starts bridge-local and is moved to the shell in Task 5. If an executor takes the tasks out of order, Task 5's re-render subscription is what makes collapse visible; nothing else depends on the move.
