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

1. **Reordering a layer silently drops it out of its group.** A drag that lands between two groups must refuse, not restack — and a drag that lands *inside* a group must restack there without lifting the child out of it. The second half is not a hypothetical: it shipped once and the review caught it. → Task 6 Steps 1 (unit) and 6 (browser).
2. **Collapsing a group makes its children unselectable from the tree, and the current selection vanishes from view.** The parent must keep the child selected, or the panel must reveal the ancestor path. → Task 5 Steps 1 and 6.
3. **A rename that collides with an existing id, or is empty/whitespace.** Names are display-only, so a collision is survivable, but an empty name renders a blank row. → Task 4 Step 1 (blank name) and Task 5 Step 3 (the rename input).
4. **A lock/visibility toggle on a group child with a hidden or locked ancestor.** Toggling the child must not silently do nothing; the row shows effective state, so clicking must reconcile the path. → Task 5 Step 7.
5. **The two action surfaces drifting.** A dock button that is enabled while the layer row's twin is disabled, or vice versa, for the same selection. → Task 2 Step 6 and Task 6 Step 1.

*(Every arrow above was wrong in an earlier revision — items 2–5 pointed at Tasks 5, 7, 4 and 3 as a group, i.e. one task off from the coverage table below for three of them, and item 1 pointed at Task 6 while the item it describes is exactly the Critical that shipped. The list and the Self-Review's coverage table now agree.)*

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
- Produces: `EditorShellBridge.layers(): readonly LayerRow[]` and `EditorShellBridge.renameLayer(id: string, name: string): void`; `EditorActionFacade.layerNames(): Readonly<Record<string, string>>` and `setLayerNames(names: Readonly<Record<string, string>>): void`. (`setCollapsed` is **Task 5's**, not this task's.)

`editorMetadata` is validated and serialized today but has no reader or writer. It needs no shape change: `layerNames` is one key inside it.

- [ ] **Step 1: Write the failing test**

The existing `bridgeFor` helper (`bridge.dom.test.ts:43`) takes `(active, extra)` and spreads `extra` into the **editor**, not the bridge — so `{ layerNames: … }` would land in the wrong object. Its `facadeStub()` (`:20`) also has no `layerNames`/`setLayerNames`, and its canvas stub has no `getObjects()`, which `layers()` needs. Widen the helper first:

```ts
function bridgeFor(
  active: unknown,
  extra: Record<string, unknown> = {},
  sessionExtra: Record<string, unknown> = {},
) {
  const listeners = new Map<string, () => void>();
  const objects = active === undefined ? [] : [active];
  const canvas = {
    getActiveObject: () => active,
    getObjects: () => objects,
    on: vi.fn((name: string, listener: () => void) =>
      listeners.set(name, listener),
    ),
    off: vi.fn(),
  };
  const editor = { canvas, ...extra };
  const session = { ...facadeStub(), ...sessionExtra };
  // …unchanged below
```

Add the two members to `facadeStub()` as well: `layerNames: vi.fn(() => ({}))` and `setLayerNames: vi.fn()`.

Then append:

```ts
it("carries display names into the projection and back out again", () => {
  const rect = new Rect({ id: "header", width: 10, height: 10 });
  const { bridge, session } = bridgeFor(rect, {}, {
    layerNames: () => ({ header: "Header rule" }),
  });
  expect(bridge.layers()[0]?.name).toBe("Header rule");

  bridge.renameLayer("header", "Top rule");
  // The write goes to the facade, not to a local copy — assert it there. The
  // stub does not feed the value back, so re-reading layers() here would only
  // re-assert the seeded value.
  expect(session.setLayerNames).toHaveBeenCalledWith({ header: "Top rule" });
});

it("clears the stored name when a rename is blank", () => {
  const rect = new Rect({ id: "header", width: 10, height: 10 });
  const { bridge, session } = bridgeFor(rect);
  bridge.renameLayer("header", "   ");
  // Removing the key, not storing whitespace: Task 3's name ladder already
  // falls back to the id for a row with no stored name.
  expect(session.setLayerNames).toHaveBeenCalledWith({});
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

  const collapsedGroups = new Set<string>();

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

`collapsedGroups` stays a bridge-local `Set<string>` seeded empty: this task only *reads* it into the projection, and Task 5 adds the `setCollapsed(id, collapsed)` that mutates it. A rename is editor-only metadata, so it does **not** call `historyManager.saveState()` — it is not authored document content, and §67 keeps runtime state out of authored history.

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
  src/web/packages/editor/src/editor-shell.dom.test.ts \
  src/web/packages/editor/src/editor-session.ts \
  src/web/packages/editor/src/editor-main.ts \
  src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx \
  src/web/tests/e2e/editor.spec.ts \
  STATUS.md
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

Re-render on bridge events with a `SelectionStore`-shaped store, **not** by handing `bridge.layers()` straight to `useSyncExternalStore`. `getSnapshot` is called on every render and compared with `Object.is`, so a projection built fresh on each call re-renders forever. Cache the projection in a field of a small store object, return that cached field from `getSnapshot`, and recompute it (a) on every `subscribe` notification and (b) after any call that mutates the projection — `renameLayer` and `setCollapsed`. That store shape is what `shell-layout.tsx:88-118` already does for the snapshot; follow it rather than inventing a second one, and do not fall back to `useState` + `useEffect`, which is the React-mirroring pattern this shell avoids.

Delete `src/web/packages/editor/src/layer-panel.ts` and its mount in `editor-session.ts`; the shell's `hosts.layers` node is replaced by a React slot rendered inside `shell-layout.tsx`.

**Do this part first — it is the task's widest blast radius, and the file list above understates it.** `layer-panel.ts` is imported in more places than the panel itself, and each needs a decision:

| Site | What it needs |
|---|---|
| `editor-session.ts:26` | delete the `createLayerPanel, type LayerPanel` import |
| `editor-session.ts:113` | delete `readonly #layers: LayerPanel` |
| `editor-session.ts:146-149` | delete the `createLayerPanel(...)` call |
| `editor-session.ts:67-70` | `EditorPanelHosts.layers` becomes unused — remove the member and its doc comment |
| `editor-shell.ts` | the host creation for `hosts.layers` moves to the React slot |
| `editor-main.ts:124` | remove `layers: layout.hosts.layers` |
| `shell-layout.tsx:28,253` | drop the `layers` member from `ShellHosts` (`:28`) and its element creation (`:253`) |
| `shell-layout.tsx:316` | drop the `<Host node={hosts.layers} hidden={…} />`; the `"layers"` literal in `RailPane` (`:21`), the `useState` default (`:273`) and the rail entry (`:277`) stay — the pane itself survives, only its host node goes |
| `editor-session.dom.test.ts` | 7 occurrences — `vi.mock("./layer-panel.js")` at `:11` and a `layers:` member in each of the 6 `panelHosts` literals (lines ~90, 136, 193, 269, 352, 425) |
| `layer-panel.dom.test.ts` | delete with its source |
| `layer-manager/index.ts:3` | a doc comment pointing at `layer-panel.ts` as the projection owner — repoint it at the new file |

Remove the `layers` host from `ShellHosts` only if nothing else reads it; otherwise leave the node and render the tree into it, which is the smaller change. Decide from what compiles.

`editor-session.dom.test.ts` and `editor-session.ts` are **not** in the Files list above, which is a defect in the plan — add them to the commit's `git add` regardless.

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
  src/web/packages/editor/src/layer-panel.dom.test.ts \
  src/web/packages/editor/src/editor-shell.ts \
  src/web/packages/editor/src/editor-session.ts \
  src/web/packages/editor/src/editor-session.dom.test.ts \
  src/web/packages/editor/src/editor-main.ts \
  src/web/packages/editor/src/layer-manager/index.ts
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
  // Eligibility is expressed through `target()`: `actionEnabled` reads the
  // ActionGate, and the bridge has no `can` in that path. Overriding `can` here
  // would change nothing and the test would silently assert the unfiltered row.
  const none = () => ({ kind: "none", locked: false, memberCount: 0, isGroup: false });
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<LayerPanel bridge={bridge(rows, { target: none })} />));
  const empty = host.querySelector("[data-vigilia-layer-actions]");
  expect(empty?.querySelectorAll("button")).toHaveLength(0);

  // With the helper's default single unlocked object the row is the registry's
  // own answer, derived rather than hand-written — a literal count here would
  // only pass if the row re-derived eligibility, which Step 3 forbids.
  const host2 = document.createElement("div");
  const root2 = createRoot(host2);
  await act(async () => root2.render(<LayerPanel bridge={bridge(rows)} />));
  const gate = bridge(rows);
  const expected = OBJECT_ACTIONS
    .filter((action) => actionEnabled(gate, action.id))
    .map((action) => action.label);
  const rendered = [...(host2.querySelector("[data-vigilia-layer-actions]")
    ?.querySelectorAll("button") ?? [])].map((button) => button.getAttribute("aria-label"));
  expect(rendered.sort()).toEqual([...expected].sort());
  expect(expected.length).toBeGreaterThan(1);
});
```

Note there is deliberately **no** target that makes exactly one action eligible: `delete`, `copy`, `cut`, `duplicate`, `lock` and the four ordering actions all share `hasSelection && !locked`. A fixture asserting a single button cannot be built from the registry's real rules, so do not try.

**Also write `reorderLayer`'s unit tests here, before implementing it.** Step 4 adds the whole reorder operation with no test of its own — its parent check, its anchor lookup and its return value are the risky part, and Step 6's browser test cannot pin them.

These need a **real `Canvas`**, not `bridgeFor`'s stub: the stub canvas has no `moveObjectTo`, and the cross-group case needs real `Group` parentage for `ownerOf` to walk. That file imports `Group`, `Rect` and `ActiveSelection` from `fabric/es`; add `Canvas` to that import, and `vi` is already imported.

**`bridgeFor` lives in `bridge.dom.test.ts:45` and is not exported.** Either export it from there and import it here, or — better, since these three tests are bridge behaviour rather than panel behaviour — put all three in `bridge.dom.test.ts` beside it and keep `layer-panel.dom.test.tsx` for the two DOM tests above. Do not copy the factory; a duplicate would drift from the stub the rest of the suite uses.

**The factory's second parameter is spread into `editor`, and its canvas stub spreads your `canvasExtra` over the defaults, so `bridgeFor(undefined, { canvas, historyManager: { saveState } })` threads both.** Read `bridgeFor` at `:45-71` before relying on that: the `canvas.getObjects()` / `getActiveObject()` accessors are **not** overridable through it, which is why `bridgeFor(undefined, ...)` rather than a fake active object is what you want here.

```ts
it("reorders within one parent and reports the move", () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const alpha = new Rect({ left: 0, top: 0, width: 10, height: 10 });
  const beta = new Rect({ left: 20, top: 0, width: 10, height: 10 });
  alpha.set("id", "alpha");
  beta.set("id", "beta");
  canvas.add(alpha, beta);
  const saveState = vi.fn();
  const { bridge } = bridgeFor(undefined, { canvas, historyManager: { saveState } });

  const order = (): unknown[] =>
    canvas.getObjects().map((object) => object.get("id"));

  // Paint order is bottom-first; the panel reverses it for display.
  expect(order()).toEqual(["alpha", "beta"]);
  expect(bridge.reorderLayer("alpha", "beta")).toBe(true);
  expect(order()).toEqual(["beta", "alpha"]);
  // Reordering is authored state: without this the drop would not reach the
  // saved envelope, and the browser test below is the only other thing that
  // would notice.
  expect(saveState).toHaveBeenCalledTimes(1);
});

it("refuses to move a layer across a group boundary", () => {
  // Crossing owners changes membership, which is a different operation.
  const canvas = new Canvas(document.createElement("canvas"));
  const child = new Rect({ left: 0, top: 0, width: 10, height: 10 });
  child.set("id", "child");
  const group = new Group([child]);
  group.set("id", "grp");
  const sibling = new Rect({ left: 60, top: 0, width: 10, height: 10 });
  sibling.set("id", "sibling");
  canvas.add(group, sibling);
  const { bridge } = bridgeFor(undefined, { canvas, historyManager: { saveState: vi.fn() } });

  const before = canvas.getObjects().map((object) => object.get("id"));
  expect(bridge.reorderLayer("child", "sibling")).toBe(false);
  expect(canvas.getObjects().map((object) => object.get("id"))).toEqual(before);
  // The refusal must not have reparented the child either.
  expect(child.group).toBe(group);
});

it("reorders inside a group without lifting the child out of it", () => {
  // The regression this test exists for: `siblings` is the group's array while
  // the move was issued on the canvas, so the child landed in the canvas root
  // *and* stayed in the group. `canvas.getObjects()` is the assertion that
  // catches it — the same-parent test above cannot, because its siblings are
  // canvas-root and the two arrays happen to be the same one.
  const canvas = new Canvas(document.createElement("canvas"));
  const child = new Rect({ left: 0, top: 0, width: 10, height: 10 });
  const peer = new Rect({ left: 20, top: 0, width: 10, height: 10 });
  child.set("id", "child");
  peer.set("id", "peer");
  const group = new Group([child, peer]);
  group.set("id", "grp");
  canvas.add(group);
  const saveState = vi.fn();
  const { bridge } = bridgeFor(undefined, { canvas, historyManager: { saveState } });

  const ids = (objects: readonly { get(key: string): unknown }[]): unknown[] =>
    objects.map((object) => object.get("id"));

  expect(ids(canvas.getObjects())).toEqual(["grp"]);
  expect(ids(group.getObjects())).toEqual(["child", "peer"]);
  expect(bridge.reorderLayer("child", "peer")).toBe(true);
  // The group is still the only canvas-root object, and the child is still in it.
  expect(ids(canvas.getObjects())).toEqual(["grp"]);
  expect(ids(group.getObjects())).toEqual(["peer", "child"]);
  expect(child.group).toBe(group);
  expect(saveState).toHaveBeenCalledTimes(1);
});

it("refuses an unknown id instead of moving something else", () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const alpha = new Rect();
  const beta = new Rect();
  alpha.set("id", "alpha");
  beta.set("id", "beta");
  canvas.add(alpha, beta);
  const { bridge } = bridgeFor(undefined, { canvas, historyManager: { saveState: vi.fn() } });

  const before = canvas.getObjects().map((object) => object.get("id"));
  expect(bridge.reorderLayer("nope", "beta")).toBe(false);
  expect(bridge.reorderLayer("alpha", "nope")).toBe(false);
  expect(canvas.getObjects().map((object) => object.get("id"))).toEqual(before);
});
```

Confidence notes, so you do not spend the round re-deriving them: `moveObjectTo(object, index): boolean` is confirmed on `StaticCanvas` (`node_modules/fabric/dist/src/canvas/StaticCanvas.d.ts:56`; the implementation is `createCollectionMixin`'s at `node_modules/fabric/dist/index.mjs:1162-1168`, which `:1978` and `:9132` apply to both `StaticCanvas` and `Group`). It does its own remove + splice, so a real `Canvas` needs no hand-maintained splice. `ownerOf` walks the object tree via `pathTo` (`layer-tree.ts:139-152`), so real `Group` nesting is what makes it resolve.

**Measured against Fabric 7.4.0, not reasoned about.** Four probes were run during planning; all four results are below, because three of them contradict what this step used to say.

1. **`Group.getObjects()` returns a copy.** `getObjects(...types)` is `return [...this._objects]` (`index.mjs:1037`). Never mutate it; use `moveObjectTo` on the owning `Group`. **The sketch originally called `canvas.moveObjectTo` here, which is the defect in result 3 — corrected below.**

2. **The cross-group case is refused by the owner comparison, not by the index guard.** *(Corrected after implementation. This result previously claimed the opposite — that `grp.getObjects().indexOf(sibling)` being `-1` meant the guard "already refuses" and "the `ownerOf` line is not what makes this test pass". Measured on a real `Canvas`, that is false: with the owner comparison removed, the implementer's cross-group test passes with the guard still in place, and only fails once the guard is deleted **too**. So the owner comparison is load-bearing, and the teeth check below is written to match.)*

3. **A silent reparent is possible, and it is the same-parent case — which is exactly what `reorderLayer` exists to serve.** `moveObjectTo` returns `false` when `object === this._objects[index]`, and `removeFromArray` leaves the array alone when the object is absent, so `splice` still runs at a stale index. **This is a real defect, not a hypothetical: the shipped code had it.** `siblings` is correctly taken from the owning group while `canvas.moveObjectTo` splices `canvas._objects` — so reordering `child` among its group siblings returned `true`, inserted the child into the canvas root, left it inside `grp`, and gave `getObjects()` and the group's own array each their own copy of one object. A review reproduced it on a real `Canvas` (`grp` = [`child`,`peer`]; `reorderLayer("child","peer")` → `true`, root `["grp","child"]`, `grp` still `["child","peer"]`), and the same-parent test missed it only because its siblings happen to be canvas-root.

   **The fix is the container, not the guard: reorder on the object that owns the array.** `moveObjectTo` is `createCollectionMixin`'s and applies to `Group` as well as `StaticCanvas` (`:1978`, `:9132`), so `parent ?? canvas` is the right receiver. The index guard stays, but it is defence in depth against an inconsistent read and **no longer the thing that prevents reparenting** — with the container correct, a group child cannot leave its group by this path at all.

**Teeth check — three steps, all required. The single check this step used to name does not work.** It said "delete the `ownerOf` comparison and confirm the cross-group test fails". Measured: deleting that line alone leaves the cross-group test **passing** (the guard refuses instead), so the named check proves nothing. Both halves must go together.

1. **Break the scoping.** Change `const parent = ownerOf(moved)` to `const parent = undefined` **and delete the index guard** (`if (from < 0 || anchorAt < 0) return false;`). The cross-group test must now fail with `canvas.getObjects()` containing the **child** at the root beside `grp` and `sibling`. Restore both lines, and restore the owner comparison if you removed it to check the claim above.
2. **Break the arithmetic.** In the same-parent test, change `let target = anchorAt + 1;` to `target = from;`. Fabric returns `false` (the object already sits there), so `reorderLayer` returns `false` and the test fails on `expect(...).toBe(true)`. Restore.
3. **Break the container — the regression this step now exists to catch.** Put `canvas.moveObjectTo(moved, target)` back in place of `parent ?? canvas`, and confirm the **new intra-group test fails** with the child present in both the canvas root and the group. Without this step the Critical defect this plan shipped once can ship again with a green suite, because every existing test's siblings are canvas-root.

Report both exact assertions. A teeth check that passes on the correct code *and* on the broken code is worse than none, because it reads as coverage.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
Expected: FAIL — no `[data-vigilia-layer-actions]` element.

- [ ] **Step 3: Implement the bottom row**

Below the tree, render one row of icon buttons, filtered by the **one** shared predicate:

```tsx
<footer data-vigilia-layer-actions="">
  {OBJECT_ACTIONS
    .filter((action) => bridge !== undefined && actionEnabled(bridge, action.id))
    .map(({ id, icon: Icon, label }) => (
      <button key={id} type="button" aria-label={label} onClick={() => bridge.run(id)}>
        <Icon aria-hidden size={15} strokeWidth={1.75} />
      </button>
    ))}
</footer>
```

**Ruled: `OBJECT_ACTIONS` only — the registry already holds `actionEnabled` and the dock already calls it.** `actionEnabled(gate, id)` lives in `object-actions.ts` and `canvas-dock.tsx` is already a pure registry render (`onClick={() => bridge?.run(id)}`) as of Task 2, so there is nothing to extract and nothing to re-implement. `arrangeActions()` is **not** in this row: the spec's defect table moves arrange out of the layer panel to the top toolbar, and Task 7 owns it. The dock and this row therefore render the same list for the same gate — which is the property the test above pins — and arrange appears in exactly one place.

- [ ] **Step 4: Implement reorder**

In `bridge.ts`:

```ts
  reorderLayer(id, beforeId) {
    const root = canvas.getObjects();
    const moved = findById(root, id);
    const anchor = findById(root, beforeId);
    if (moved === undefined || anchor === undefined) return false;
    // v1 restacks inside one parent only: crossing a group boundary changes
    // membership, which is a different operation with different semantics.
    if (ownerOf(root, id) !== ownerOf(root, beforeId)) return false;
    const parent = ownerOf(root, id);
    const siblings = parent === undefined ? root : parent.getObjects();
    const from = siblings.indexOf(moved);
    const anchorAt = siblings.indexOf(anchor);
    // Defence in depth, NOT the thing that stops a reparent: with the receiver
    // below chosen from the same `parent` these indices came from, a mismatch
    // can no longer cross arrays. Keep it for an inconsistent read.
    if (from < 0 || anchorAt < 0) return false;
    // `beforeId` means directly above that row in the panel, and the panel paints
    // topmost-first, so in Fabric's bottom-first paint order the target is one
    // past the anchor. Fabric's `moveObjectTo` removes the object and then
    // splices at `index` in the *post-removal* array, so an upward move in paint
    // order shifts down by one.
    let target = anchorAt + 1;
    if (from < target) target -= 1;
    // The receiver must be the collection `siblings` came from. `moveObjectTo` is
    // `createCollectionMixin`'s and exists on `Group` too (`index.mjs:1978`,
    // `:9132`), but it splices `this._objects` — so calling it on the canvas while
    // indexing the group's array inserts the child into the canvas root and
    // leaves it inside the group, giving Fabric's paint and serialization arrays
    // one object each. Its boolean return is the move's own verdict — it answers
    // false when the object already sits at `target` — so keep checking it.
    if (!(parent ?? canvas).moveObjectTo(moved, target)) return false;
    canvas.requestRenderAll();
    input.editor.historyManager.saveState();
    notify();
    return true;
  },
```

**Four details that decide whether this compiles and behaves:**

- **`ownerOf` takes `(root, id)`, not an object** (`layer-tree.ts:139-146`). The earlier sketch wrote `ownerOf(moved)` / `ownerOf(anchor)`; that does not compile. `findById` is also `(root, id)` (`:125`, `:133`). Pass `root` and the **id**, and hold `root` in a local so the three reads cannot see different arrays.
- **The receiver is `parent ?? canvas`, and this is the one line that decides correctness.** `moveObjectTo` lives on `createCollectionMixin`, so `Group` and `StaticCanvas` both have it (`index.mjs:1978`, `:9132`) — but each splices **its own** `_objects`. Compute `siblings` from one collection and move in the other and the object ends up in both. Shipped once; review reproduced it. Do not "simplify" it back to `canvas`.
- **`canvas.requestRenderAll()` is redundant but harmless.** `moveObjectTo` calls `_onStackOrderChanged`, which for a canvas is `this.renderOnAddRemove && this.requestRenderAll()` (`index.mjs:2041`). Keep the explicit call: it is how the rest of `bridge.ts` ends a mutation (`selectLayer` at `:145`, `setLayerVisible` at `:158`), and depending on `renderOnAddRemove` being left at its default is a coupling nobody would remember.
- **The index arithmetic is the whole bug surface besides the receiver, and it is already resolved above.** Read from Fabric 7.4.0's own source (`node_modules/fabric/dist/index.mjs:1162-1168`): `moveObjectTo` returns `false` when `object === this._objects[index]`, otherwise removes the object and splices at `index` **in the post-removal array**. Probed the shipped computation against a real `Canvas`: `["alpha","beta"]` with `from = 0, anchorAt = 1` gives `target = 1` and yields `["beta","alpha"]`, which is what the same-parent test asserts. Do not re-derive it; the unit tests are the contract and one run will confirm it.

Wire HTML5 drag events on rows (`draggable`, `onDragStart`, `onDragOver` to show the drop line, `onDrop` → `reorderLayer`). A refused drop shows no line and changes nothing.

**Ruled: the drop line's row pitch is named once on each side, and the row is fixed-height.** The panel positions the line with `index * 24` while the CSS gave the row `min-height: 24px` — two independent 24s, and `min-height` let a row grow taller than the line assumed, which would put the marker in the wrong slot with no test noticing. Change the CSS rule to `height: 24px` (with `overflow: hidden`, so a long name truncates instead of wrapping past it) and hoist the panel's literal to a module constant — `const ROW_HEIGHT = 24;` — with a comment naming `.vigilia-layer-row`'s height as the pair. `min-height` was the defect, not the duplication: a fixed row height is what makes `index * pitch` true. `layer-panel.dom.test.tsx:274-275` already pins both numbers, so it is the check.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run packages/editor/src/editor-shell`
Expected: PASS.

- [ ] **Step 6: Add the browser test and verify it has teeth**

```ts
test("reorders a layer and refuses a cross-group drop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");

  await page.goto(EDITOR);
  // A fixture with both shapes the rule distinguishes: two plain siblings, and a
  // group whose child must not be movable across the boundary.
  // `vigiliaPaint` and `globals.palette` are not decoration: a literal `fill`
  // with no paint ref is `unresolved-global-ref` and `setThemePackage` asserts
  // `writeThemePackage` returned ok, so a fixture without them fails before the
  // editor opens. Copied from the `movable.vigilia-theme` fixture at `:1322`.
  const paint = {
    palette: {
      none: { name: "None", value: { kind: "solid", color: "transparent" } },
      accent: { name: "Accent", value: { kind: "solid", color: "#00b8d9" } },
    },
  };
  const rect = (id: string, left: number, top: number) => ({
    type: "Rect",
    id,
    left,
    top,
    width: 40,
    height: 40,
    fill: "#00b8d9",
    vigiliaPaint: { fill: "palette.accent" },
    originX: "left",
    originY: "top",
  });
  await setThemePackage(page, "reorder.vigilia-theme", {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "reorder",
    artboard: { width: 320, height: 180 },
    globals: paint,
    scene: {
      version: "7.4.0",
      objects: [
        rect("alpha", 20, 20),
        rect("beta", 80, 20),
        {
          type: "Group",
          id: "grp",
          left: 20,
          top: 90,
          objects: [{ ...rect("child", 0, 0), width: 30, height: 30 }],
        },
      ],
    },
  });
  await expect(page.locator("#status")).toHaveText("Opened reorder.vigilia-theme");

  const panelOrder = (): Promise<(string | null)[]> =>
    page.locator("[data-vigilia-layer]").evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-vigilia-layer")),
    );
  // The panel paints topmost-first, so its row order is the reverse of the
  // serialized paint order. Compare the pair's *relative* order, never an
  // absolute index, so this holds whichever direction the projection uses.
  const idsIn = (envelope: unknown): string[] =>
    ((envelope as { scene: { objects: Array<{ id?: string }> } }).scene.objects)
      .map((object) => object.id ?? "");
  const pairRelativeTo = (ids: string[]): boolean =>
    ids.indexOf("alpha") < ids.indexOf("beta");

  const beforeIds = idsIn(await saveEnvelope(page));
  const beforePanel = await panelOrder();
  expect(beforeIds).toContain("alpha");
  expect(beforeIds).toContain("beta");

  // Same parent: drop alpha on beta's row.
  await page
    .locator('[data-vigilia-layer="alpha"]')
    .dragTo(page.locator('[data-vigilia-layer="beta"]'));
  const afterPanel = await panelOrder();
  expect(afterPanel).not.toEqual(beforePanel);

  // Reordering is authored state (Step 4 calls `saveState`), so it must reach
  // the saved envelope — a panel-only change would be a projection bug.
  const afterIds = idsIn(await saveEnvelope(page));
  expect(pairRelativeTo(afterIds)).toBe(!pairRelativeTo(beforeIds));

  // Cross-group: a child dropped on a top-level sibling changes membership,
  // which this operation must refuse outright.
  await page
    .locator('[data-vigilia-layer="child"]')
    .dragTo(page.locator('[data-vigilia-layer="alpha"]'));
  expect(await panelOrder()).toEqual(afterPanel);
  expect(idsIn(await saveEnvelope(page))).toEqual(afterIds);
});
```

Run: `npx playwright test --project=desktop-chromium --grep "reorders a layer" --workers=1`
Expected: PASS.

**Teeth check — the same two breaks as Step 1, because this test asserts the same rules one layer up.** Step 1's named check was toothless and is replaced there; do not reintroduce it here. In `reorderLayer`, first change `const parent = ownerOf(root, id)` to `const parent = undefined` **and** delete `if (from < 0 || anchorAt < 0) return false;` — the cross-group block must fail. Restore, then change `let target = anchorAt + 1;` to `target = from;` — the same-parent block must fail on `expect(afterPanel).not.toEqual(beforePanel)`. Restore both and confirm the test is green again.

**Note the vacuity guard this test does and does not have.** `expect(afterPanel).not.toEqual(beforePanel)` fails if the drag did nothing, so a dead HTML5 drag path cannot pass silently — provided `panelOrder()` returns rows at all. It returns an empty array if the panel is not rendered, and `[] !== []` is false, so `not.toEqual` catches that too. What it does **not** catch is a drag that *fires* but reaches `reorderLayer` with the wrong ids; the envelope assertion on the next line is what pins that, since it compares the pair's relative order before and after.

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

Task 5 replaced `layer-panel.tsx` entirely, so the old 6-buttons-per-row panel that used to carry an arrange block no longer exists — nothing here needs deleting. Following Figma, arrange belongs on a toolbar above the canvas, where it applies to a multi-selection. (The line range this sentence used to cite, `layer-panel.ts:183-212`, now points at the visibility and lock buttons of a row.)

- [ ] **Step 1: Write the failing test**

```tsx
it("puts arrange on the canvas toolbar, disabled without a multi-selection", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const toolbar = root.querySelector("[data-vigilia-arrange-toolbar]");
  expect(toolbar).not.toBeNull();
  // Derived, not a literal: `ARRANGE_ICONS` holds eight today, and a ninth
  // added to the registry must fail here rather than be silently dropped by
  // the toolbar. Same rule as Task 9's context menu.
  expect(toolbar?.querySelectorAll("button")).toHaveLength(arrangeActions().length);
  for (const button of toolbar?.querySelectorAll("button") ?? [])
    expect(button.disabled).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/editor/src/editor-shell/shell-layout.dom.test.tsx`
Expected: FAIL — no toolbar element.

- [ ] **Step 3: Implement the toolbar**

Add a `<div className="editor-shell-arrange" data-vigilia-arrange-toolbar="">` inside `.editor-shell-stage`, above the dock. Render every `arrangeActions()` entry, each an icon button with `aria-label` and `title`.

**`disabled` comes from the snapshot's `memberCount`, not from `actionEnabled`.** This is the one place this task's original text was wrong, and it is wrong in a way that fails the test above.

- `actionEnabled(bridge, id)` calls `bridge.target()`. The bridge passed to the stage is `EditorShellBridge | undefined` — `Shell()` reads `store.bridge` (`shell-layout.tsx:317` passes exactly that to `LayerPanel`), and `store.bridge` is `undefined` until `setBridge` runs (`SelectionStore.set`, `shell-layout.tsx:90-93`; this read `:89-92`). `createShellLayout(root)` alone leaves it undefined, so `disabled={!actionEnabled(bridge, id)}` **throws** on the very fixture Step 1 uses: `matchMedia` is already stubbed for this test file, so the layout renders, then the toolbar dereferences `undefined`.
- The existing dock solves this by **not** asking the question when there is no bridge: `bridge === undefined ? [] : OBJECT_ACTIONS.filter(...)` (`canvas-dock.tsx:32-35`).

Read the selection through the store's own hook, exactly as `Shell()` already does — `useSelection(store)` (`shell-layout.tsx:118-120`) returns the cached `EditorShellSnapshot`, whose `memberCount` is the snapshot's `selectedCount` field and whose default is `{ selectedCount: 0, locked: false, activeKind: "none" }` (`:83-87`, re-applied at `:101`). So with no bridge the count is `0` and every button is disabled, which is Step 1's expectation, with no `undefined` to guard.

```tsx
const selection = useSelection(store);
// Arrange stays visible and greyed rather than being filtered out, so the
// controls are discoverable before a multi-selection exists — Figma's
// behaviour, and what Step 1's length assertion pins.
const canArrange = selection.selectedCount > 1 && !selection.locked;
{arrangeActions().map(({ id, icon: Icon, label }) => (
  <button key={id} type="button" aria-label={label} title={label}
    disabled={!canArrange} onClick={() => store.bridge?.run(id)}>
    <Icon aria-hidden size={15} strokeWidth={1.75} />
  </button>
))}
```

(`store` is in scope in `Shell()` — the same binding `:317` passes to `LayerPanel`.)

`memberCount > 1 && !snapshot.locked` is not a re-derivation of the registry's rule, it is the same rule read from the surface that owns it: `arrangeActions()`' own `eligible` is `(target) => target.memberCount > 1 && !target.locked` (`object-actions.ts:194`, inside the factory at `:187-196`; this read `:187-192`, which lands on the factory's `id`/`label`/`icon` lines and not on `eligible` at all), and `ActionGate` deliberately has no non-arrange `can` precisely so nothing re-enters `actionEnabled`. Exporting the predicate from `object-actions.ts` and calling it with the snapshot is acceptable and slightly better if the shape is a clean fit — prefer it if so, since it keeps one owner of the rule.

Note the dock's filter stays a filter: it renders only *enabled* object actions today, so it will now render **no** arrange entries at all while this toolbar renders eight disabled ones. That is the intended split — the dock is "what you can do now", the toolbar is "what arrange offers" — and Step 1's assertion is the one that pins the toolbar half.

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
- Create: `src/web/packages/editor/src/editor-shell/controls/number-field.ts`
- Create: `src/web/packages/editor/src/editor-shell/controls/linked-pair.ts`
- Create: `src/web/packages/editor/src/editor-shell/controls/controls.dom.test.ts`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/packages/editor/src/artboard-panel.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: framework-free DOM factories, not React components — see the ruling in Step 3.
  ```ts
  export function numberField(options: {
    label: string; value: number; step?: number; min?: number; max?: number;
    invalidMessage?: string; data: string;
    onCommit: (value: number) => void;
  }): { readonly row: HTMLElement; readonly input: HTMLInputElement;
        setValue(value: number): void };
  export function linkedPair(options: {
    rowLabel: string;
    first: { label: string; value: number; data: string };
    second: { label: string; value: number; data: string };
    min?: number; max?: number; invalidMessage?: string;
    onCommit: (first: number, second: number) => void;
  }): { readonly row: HTMLElement;
        readonly first: HTMLInputElement; readonly second: HTMLInputElement;
        setValues(first: number, second: number): void };
  ```

- [ ] **Step 1: Write the failing tests**

Clear `document.body` in an `afterEach`, as `artboard-panel.dom.test.ts` does — the factories
append to it.

```ts
it("rejects an out-of-range number instead of coercing it to zero", () => {
  const onCommit = vi.fn();
  const field = numberField({
    label: "Width", value: 100, min: 1, max: 4096,
    data: "vigiliaArtboardWidth", onCommit,
  });
  document.body.append(field.row);
  const input = field.row.querySelector("input")!;

  input.value = "abc";
  input.dispatchEvent(new Event("change"));
  expect(onCommit).not.toHaveBeenCalled();
  expect(field.row.querySelector("[role=alert]")).not.toBeNull();
  // The field shows the last value it accepted, not the rejected text. This is
  // not cosmetic: `artboard-panel.dom.test.ts:44-52` already requires it, and
  // that test has to keep passing once the panel's own `render(current)`
  // rollback disappears with this refactor.
  expect(input.value).toBe("100");

  // The assertion above is only meaningful if a valid edit does commit —
  // otherwise "no handler ran" and "invalid input was refused" look identical.
  input.value = "200";
  input.dispatchEvent(new Event("change"));
  expect(onCommit).toHaveBeenCalledWith(200);
  expect(field.row.querySelector("[role=alert]")).toBeNull();

  // Out of range is refused the same way as unparseable, not clamped.
  input.value = "99999";
  input.dispatchEvent(new Event("change"));
  expect(onCommit).toHaveBeenCalledTimes(1);

  // A rejected edit must not become the new "last valid": the field still shows
  // 200, so a second rejection restores 200 rather than the 99999 it refused.
  expect(input.value).toBe("200");

  // `setValue` is the only other writer of the input, and it is what the panel's
  // `render()` calls; it must not fire `onCommit`, or a re-render would look
  // like an edit and dirty the document on every refresh.
  field.setValue(320);
  expect(input.value).toBe("320");
  expect(onCommit).toHaveBeenCalledTimes(1);
});

it("emits a commit carrying both values for a linked pair", () => {
  const onCommit = vi.fn();
  const pair = linkedPair({
    rowLabel: "Size",
    first: { label: "W", value: 100, data: "vigiliaArtboardWidth" },
    second: { label: "H", value: 200, data: "vigiliaArtboardHeight" },
    min: 1, max: 4096, onCommit,
  });
  document.body.append(pair.row);

  pair.first.value = "10";
  pair.first.dispatchEvent(new Event("change"));
  // The pair commits both current values, so the untouched field still reads 200.
  expect(onCommit).toHaveBeenLastCalledWith(10, 200);
  pair.second.value = "20";
  pair.second.dispatchEvent(new Event("change"));
  expect(onCommit).toHaveBeenLastCalledWith(10, 20);
});
```

**Step 1's third assertion block is not decoration — it closes a live regression the refactor would otherwise open.** `artboard-panel.dom.test.ts:44-52` requires that rejecting an invalid dimension leaves the input showing the **last valid value** (`expect(width.value).toBe("1280")`). Today the panel achieves that itself: `submit()` calls `render(current)` on rejection (`artboard-panel.ts:70-73`) and `render` writes `input.value`. Once the panel reads values through `linkedPair` and `submit` no longer parses raw input, that rollback lives **nowhere** unless the factory owns it. So: the control keeps its last accepted value and restores it to the input on rejection, and `setValue` is the writer `render()` uses. Both are asserted above, because a suite that only checked "no commit happened" would pass on a field left displaying `"99999"`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run packages/editor/src/editor-shell/controls/controls.dom.test.ts`
Expected: FAIL — imports do not resolve.

- [ ] **Step 3: Implement the two controls**

**Ruled: these are DOM factories, not React components, and the spec's `ColorSwatch` is not built here.** The spec calls all of this "field surfaces become React components under `editor-shell/controls/`", but only `NumberField` and `LinkedPair` have a consumer, and that consumer is `artboard-panel.ts` — an imperative panel mounted into a plain host div (`editor-session.ts:160`, `panelHosts.document`), which the spec itself says stays as it is: *"`artboard-panel.ts:119-147` must regroup its eleven flat siblings into field wrappers; that is the one consequence outside CSS."* Writing React components would force a `createRoot` inside an imperative panel whose whole test file (`artboard-panel.dom.test.ts`, 7 `createArtboardPanel` call sites) asserts synchronously right after the call — a React root renders asynchronously, so that file would have to be rewritten for a rendering-model change no requirement asks for.

`ColorSwatch` is cut for the same reason read the other way: it has **no consumer in this plan**. Nothing in Tasks 8–10 renders it, and the one surface that would — the selection inspector's colour fields — is imperatively built too (`selection-inspector/index.ts`). A dependency-free swatch earns its place when a panel consumes it.

Both factories use the `.vigilia-field` / `.vigilia-field-row` / `.vigilia-numeric` classes from Task 5 and never a full-width control.

**The `data` option is the camelCase dataset KEY, not the kebab attribute name** — an implementer who passes `"data-vigilia-artboard-width"` gets `data-data-vigilia-artboard-width` and every existing selector silently stops matching. The factories do `input.dataset[options.data] = ""`, exactly as `artboard-panel.ts:197` does today, so pass `"vigiliaArtboardWidth"`. The keys, and the attributes they produce: `vigiliaArtboardWidth` → `data-vigilia-artboard-width`, `vigiliaArtboardHeight` → `data-vigilia-artboard-height`, `vigiliaArtboardFitMode` → `data-vigilia-artboard-fit-mode`, `vigiliaArtboardBackground` → `data-vigilia-artboard-background`, `vigiliaArtboardBarColor` → `data-vigilia-artboard-bar-color`, `vigiliaBackgroundAsset` → `data-vigilia-background-asset`, `vigiliaBackgroundMediaFit` → `data-vigilia-background-media-fit`, `vigiliaThemeName` → `data-vigilia-theme-name`, `vigiliaThemeAuthor` → `data-vigilia-theme-author`, `vigiliaThemeDescription` → `data-vigilia-theme-description`. The browser tests at `editor.spec.ts:277-278` and `:642-643` and the three `artboard-panel.dom.test.ts` lookups are what break if this is wrong, and they break loudly — but only after the panel has been rewritten, so get it right the first time.

Commit on `change`, as the panel does today — not on every keystroke. A half-typed `1` of `1000` must not be committed as a resize.

**Refusing invalid input rather than coercing it is an existing project rule, but `isDimension` is not reusable here and `NumberField` must not import it.** `isDimension` is **module-private** at `artboard-panel.ts:302` and compares against `MAX_ARTBOARD_DIMENSION`, which `artboard-panel.ts:5` imports from another module. `controls/` is a generic sibling of `artboard-panel.ts`, so importing the artboard panel from it inverts the dependency, and an artboard-shaped predicate inside a generic numeric control is wrong even if the panel exported it.

**The control takes the rule, it does not know it.** `NumberField` is already specified with `min`, `max` and `invalidMessage` props; rejection is `Number.isInteger(value) && value >= min && value <= max` plus the existing "refuse rather than coerce" behaviour. The **artboard panel** keeps `isDimension` and passes `min={1} max={MAX_ARTBOARD_DIMENSION}`, which is where that knowledge belongs. Do not add a second `isDimension` and do not widen the private one.

**Which of the two then reports an out-of-range value is not a free choice, and the brief must not leave it to the implementer.** `isDimension` is exactly `Number.isInteger(value) && value > 0 && value <= MAX_ARTBOARD_DIMENSION` (`artboard-panel.ts:302-306`) and `numberField`'s check is the same predicate with `min`/`max` supplied — so the two **cannot both fire**, and the factory's is always the one that fires first. That has a visible consequence: the `[role=alert]` message is the factory's `invalidMessage`, and `isDimension` in `submit` becomes unreachable for anything the control accepted. Keep it as the panel's own guard on values arriving from anywhere else, and **do not write an artboard-specific regression test for it** — a test asserting "a dimension of 0 is refused" exercises the factory's range check and passes whether or not `isDimension` exists, which is the green-and-wrong shape AGENTS.md's teeth rule exists to prevent. The factory's range-rejection case in Step 1 is what covers this behaviour.

**The factory also owns the rejected-edit rollback, and each factory holds its last accepted value.** On rejection the row shows `[role=alert]` with `invalidMessage` and the input is restored to the last value it accepted; on acceptance that value is updated. `setValue(v)` / `setValues(a, b)` overwrite the displayed value *and* that last-accepted value without calling `onCommit`. This is what lets the panel drop its `render(current)` rollback (`artboard-panel.ts:70-73`) without breaking `artboard-panel.dom.test.ts:44-52` — the requirement lives in the control now, and it is asserted in Step 1. A `linkedPair` rejection restores **that** field and leaves the other alone.

- [ ] **Step 4: Regroup the artboard panel**

`artboard-panel.ts:119-147` appends `root.append(...)` **23 top-level arguments** — counted by parsing
the call, not by eye: `heading`, eight pairs of label-plus-control (name, author, description, version,
width, height, preview fit, background, bar colour), two of which are built inline via
`Object.assign(document.createElement("label"), …)`, plus `version`'s `output`, `select`,
`background.select`, `bars.select`, `media` and `mediaFit`. The exact number is not load-bearing and has
been written as 22 and 24 in earlier revisions; what matters is the shape: **group the label/control pairs
into field rows.** If you need the count, derive it — do not trust any figure in this paragraph. Width and height become one `linkedPair`; name, author and description keep their existing `textField`-built inputs and move onto a `.vigilia-field` row each; the four selects (preview fit, background, bar colour, media fit) get a `.vigilia-field` row each, with their existing inline `Object.assign` label replaced by the row's own label element. The version label and its `output` stay as they are — a read-only readout is not a field.

**There is no new text-field factory in this plan, and that is deliberate.** `numberField` parses and range-checks a number and owns a rejected-edit rollback; the metadata fields already come from `textField` (`artboard-panel.ts:193-199`), which builds a label and an input and needs no parse step at all. Its one real fault is that the label is a separate `root.append` argument rather than part of a row — so pass `textField`'s `label` into the new row alongside its `input` and leave the helper alone. Do not generalise `numberField` into a union-typed control to cover both: the two have different failure modes and only one of them can fail.

It stays an imperative DOM panel — a `ponytail:` comment records that only the markup changed, with React migration as a later step if that panel grows.

`submit()` reads `Number(width.input.value)` and then rejects with `isDimension`. Once the inputs come from `linkedPair`, that raw read is gone: `numberField`/`linkedPair` own parsing and pass the **already-validated** numbers to `onCommit`, so `submit` keeps only the artboard-shaped half — `isDimension` over each value it is handed. `isDimension` stays private here and compares against `MAX_ARTBOARD_DIMENSION`; the factory is told `min={1} max={MAX_ARTBOARD_DIMENSION}` and does not know why. `render()` calls `setValue`/`setValues` rather than writing `.value`, so the displayed value and the factory's last committed value cannot disagree.

**`render()` does not only get called on refresh, and the refactor must keep that true.** It is the rejection path *and* the `setGlobals` repaint: `submit` calls `render(current)` on a refused edit (`artboard-panel.ts:71`) and `setGlobals` calls `render(current)` after refreshing the palette options (`:175`). So `setValue`/`setValues` is written on every globals change — the "does not fire `onCommit`" rule in Step 1 is what stops a palette refresh from looking like a dimension edit and dirtying the document. The two call sites are the reason that assertion exists; keep both.

One consequence to check in Step 5: `width.input.value = String(artboard.width)` today writes `"1000"`; the factory's `type="number"` input must show the same string, or the existing e2e `fill("1000")` assertion drifts.

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
- Modify: `src/web/tests/e2e/editor.spec.ts`

**Interfaces:**
- Consumes: nothing. Produces: nothing.

- [ ] **Step 1: Add the motion rules**

```css
/* Restrained motion: only compositor-owned properties, never a layout one. The
   root is listed because a palette switch restyles its color/background. */
.editor-shell,
.editor-shell button,
.editor-shell input,
.editor-shell select,
.editor-shell [role="tab"],
.editor-shell [role="menuitem"] {
  transition: background-color 140ms ease, border-color 140ms ease,
              color 140ms ease, transform 140ms ease, opacity 140ms ease;
}
.editor-shell button:active { transform: translateY(1px); }
/* The popup is portalled outside `.editor-shell`, so this rule misses it — that
   portal is the only protection, since Base UI marks menu items `tabindex="-1"`
   and one moved in-shell would match through `[tabindex]`. `:where` drops the
   tabpanel without raising this rule's specificity. */
.editor-shell
:is(
  button,
  input,
  select,
  [role="tab"],
  [tabindex]:not(:where([role="tabpanel"]))
):focus-visible {
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
/* Base UI portals the menu popup, its positioner and the tooltip to `body`, so
   the descendant selector below cannot reach them; name those classes too. */
@media (prefers-reduced-motion: reduce) {
  .editor-shell,
  .editor-shell *,
  .editor-shell-menu-popup,
  .editor-shell-menu-popup *,
  .editor-shell-positioner,
  .editor-shell-positioner *,
  .editor-shell-tooltip,
  .editor-shell-tooltip * {
    transition: none !important;
    animation: none !important;
  }
}
```

Only `background-color`, `border-color`, `color`, `transform` and `opacity` are transitioned — never `top`/`left`/`width`/`height`.

**Three things about that block are load-bearing and each is a way to get it subtly wrong:**

- **`.editor-shell` is in the transition list on its own line**, because `.editor-shell *` never matches the root, so without it the root's own transition would survive reduced motion. A palette switch restyles the root's `color` and `background-color` (measured: `rgb(20, 18, 14)` → `rgb(238, 249, 244)` editorial→graphite), so this is a real animated surface, not a defensive extra.
- **The reduced-motion block names the three portalled classes** — `.editor-shell-menu-popup`, `.editor-shell-positioner`, `.editor-shell-tooltip` — and their descendants. Base UI portals all three to `body` (measured: `popup.closest(".editor-shell") === null`, chain `DIV.editor-shell-menu-popup → DIV.editor-shell-positioner → DIV → BODY`), so `.editor-shell *` **structurally cannot reach them**, and a popup animation would keep running under reduced motion. This is the half of the guard that no test covers by default — see Step 3.
- **`[role="menuitem"]` must stay out of the focus rule's `:is()` list.** `editor-shell.css:223-228` already sets `outline: none` on `.editor-shell-menu-popup [role="menuitem"]:focus-visible` and `[role="menuitemradio"]:focus-visible`, because a popup menu shows focus through its own highlight background. The old rationale here was that excluding those roles keeps the popup out of this rule — **that is false, do not repeat it.** Base UI marks menu items `tabindex="-1"` (measured on the live portalled item), `[tabindex]` matches `-1`, so an in-shell popup item still matches this rule. The portal is the *only* thing protecting today's behaviour; the role exclusion is belt-and-braces for the case where the popup moves in-shell, and the specificity story is a tie the popup rule loses on source order.
- **Narrow `[tabindex]` with `:not(:where([role="tabpanel"]))`.** A tabpanel carries `tabindex` and would otherwise take the 2px ring around the whole inspector column (measured: 254×1200) instead of the UA default. `:where()` has zero specificity, so the exclusion does not raise the rule's specificity — measured in Chromium, the `:is()` argument stays (0,1,0) with `:where` and becomes (0,2,0) without it. Verify against the live DOM that `document.querySelectorAll(rule)` excludes the tabpanel and that a keyboard walk never lands a `role="tabpanel"` stop.

- [ ] **Step 2: Verify in the browser**

Run: `cd src/web && npm run build && VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep "captures the mounted editor for visual review" --workers=1`
Expected: PASS, and the capture still renders (motion must not leave a panel invisible).

**Check the grep matched something before trusting the PASS.** A `--grep` that matches no test exits successfully having run nothing — a green result for having run nothing, which is the failure shape the sibling snapping plan's Task 9 exists to remove. The string above is the real title (`editor.spec.ts:145`, and `docs/evidence/screenshots/README.md:23` registers the shorter `captures the mounted editor`); confirm the reported count is non-zero rather than reading the exit code. Then open the capture and confirm the panels are visible, not mid-animation at zero opacity.

- [ ] **Step 3: Verify the reduced-motion guard**

**An `animationDuration` assertion alone is not enough, and neither is adding a `transitionDuration` one.** Three separate deletions leave a green suite unless each is pinned by the right probe — all three were measured, not reasoned:

| deletion | the one-line test's result | why |
|---|---|---|
| the whole `prefers-reduced-motion` block | FAILS | correct, the one case the short form catches |
| `transition: none !important;` only | **passes** | the test never reads a transition |
| `@keyframes vigilia-panel-in { … }`, shorthand kept | **passes** | `animationDuration` stays `0.16s` off the shorthand alone |
| the `transition:` shorthand block | **passes** | `transition: none !important` sets the duration regardless |
| all six portalled-class selectors from the media block | **passes** | nothing reads a portalled element |

So the test has to read four things: that motion is suppressed, that the reveal is a *real* animation with keyframes, that the shorthand's five properties exist, and that the suppression reaches portalled chrome. Write it in full:

```ts
test("suppresses motion when the user asks for reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(EDITOR);
  const duration = await page.locator(".editor-shell-panel").evaluate(
    (el) => getComputedStyle(el).animationDuration,
  );
  expect(duration).toBe("0s");

  // The media block suppresses transitions as well as animations, so read a
  // control too: the animation assertion alone cannot see that half.
  const controlTransition = await page.locator(".editor-shell button").first()
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(controlTransition).toBe("0s");

  // Base UI portals the popup, its positioner and the dock tooltip to `body`,
  // where `.editor-shell *` cannot reach them, so the media block names those
  // classes too. Without the injection each reads 0s either way and would pass
  // with its selectors deleted; with it, only the media block can produce the
  // 0s below.
  //
  // Each portalled element gets its own assertion. A single "delete every
  // portalled selector" teeth check is what let the tooltip go uncovered
  // through two review rounds — the popup assertion kept passing.
  const injectedTransition = (locator: Locator) =>
    locator.evaluate((el) => {
      el.style.transition = "opacity 200ms ease";
      return getComputedStyle(el).transitionDuration;
    });

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "View", exact: true }).click();
  // The zoom readout's portal is `keepMounted`, so its popup is in the DOM
  // before any menu opens; `:visible` selects the open one.
  const popup = page.locator(".editor-shell-menu-popup:visible");
  // Anchored to the View popup's own item, not merely to "a visible popup":
  // the zoom menu also satisfies `:visible`, so a popup-agnostic locator would
  // let the positive control pass while measuring the wrong menu.
  await expect(popup.getByRole("menuitem", { name: /Value runs/ })).toBeVisible();
  await expect.poll(() => injectedTransition(popup)).toBe("0.2s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => injectedTransition(popup)).toBe("0s");

  // The menu item is the element a hover transition would land on, and it is
  // outside `.editor-shell`, so the in-shell shorthand
  // `.editor-shell [role="menuitem"]` cannot reach it — the popup's own `*`
  // line is its only suppression. Without this assertion, adding a transition
  // to a menu row and deleting the `*` lines leaves the suite green under
  // `reduce`.
  const menuItem = popup.getByRole("menuitem", { name: /Value runs/ });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => injectedTransition(menuItem)).toBe("0.2s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => injectedTransition(menuItem)).toBe("0s");

  // The positioner is a separate portalled element, styled in its own right
  // (`z-index: 60`), and it is NOT covered by the popup's selectors — the popup
  // nests inside it, not the reverse. A popup-position animation lands here.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const positioner = page.locator(".editor-shell-positioner:visible");
  await expect(positioner).toBeVisible();
  await expect.poll(() => injectedTransition(positioner)).toBe("0.2s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => injectedTransition(positioner)).toBe("0s");

  // The dock tooltip, portalled under its own class. The dock renders no
  // triggers until something is selected, so select the starter chart first.
  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await selectStarterChart(page);
  const dock = page.locator('[aria-label="Selected object actions"]');
  await dock.getByRole("button", { name: "Duplicate" }).hover();
  const tooltip = page.locator(".editor-shell-tooltip");
  await expect(tooltip).toBeVisible();
  await expect.poll(() => injectedTransition(tooltip)).toBe("0.2s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => injectedTransition(tooltip)).toBe("0s");

  // With the guard absent the reveal must be a real animation. Duration alone
  // stays 0.16s when the @keyframes block is deleted, so read the effect.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const reveal = await page.locator(".editor-shell-panel").evaluate((el) => {
    // The reveal runs once on mount and leaves getAnimations() when it ends,
    // so restart it before sampling.
    el.style.animation = "none";
    el.getBoundingClientRect();
    el.style.animation = "";
    const effect = el.getAnimations()[0]?.effect;
    return {
      duration: getComputedStyle(el).animationDuration,
      keyframes: effect instanceof KeyframeEffect ? effect.getKeyframes().length : 0,
    };
  });
  expect(reveal.duration).not.toBe("0s");
  expect(reveal.keyframes).toBeGreaterThanOrEqual(2);

  // The suppression assertion reads 0s whether or not the shorthand exists, so
  // pin the shorthand itself: five compositor-owned properties, never a layout
  // one. Assert the names, not the count — the count stays 5 if `transform` is
  // swapped for `width`, which is the regression the comment forbids.
  //
  // A `button`, deliberately: the shorthand's selector list is
  // `.editor-shell, button, input, select, [role="tab"], [role="menuitem"]`, and
  // `.editor-shell-panel` is in **none** of them, so reading it here would assert
  // the UA default rather than this rule.
  const motion = await page.locator(".editor-shell button").first().evaluate((el) => ({
    properties: getComputedStyle(el).transitionProperty,
    duration: getComputedStyle(el).transitionDuration,
  }));
  expect(motion.properties).toBe(
    "background-color, border-color, color, transform, opacity",
  );
  expect(motion.duration).toBe("0.14s, 0.14s, 0.14s, 0.14s, 0.14s");
});
```

**The import line needs `type Locator`** — `editor.spec.ts:1` currently reads
`import { expect, type Page, type TestInfo, test } from "@playwright/test";`. Add it, or inline the helper's
parameter type and skip the import.

`expect.poll` for both reads because `emulateMedia` and the inline style both settle asynchronously; a one-shot
read there is the flake shape this test cannot afford. The `0.2s` lines are not decoration — each is the positive
control proving its element exists and the injection applied, so the `0s` line cannot pass because the element was
missing.

**Why the positioner and tooltip assertions exist at all.** The portalled-chrome guard names three classes, and a
teeth check that deletes all of them at once cannot tell which one is pinned: the popup assertion keeps passing
and the others' absence goes unnoticed. That is not hypothetical — it is how the positioner and tooltip stayed
uncovered through two review rounds of this task, and the tooltip half is a real accessibility gap, since
`canvas-dock.tsx:47-53` portals the dock tooltip and a future transition or animation on it would run under
reduced motion with every test green.

**Each class's assertion is justified by a different fact about its markup, and the popup's is the weakest of the
three.** The popup nests inside the positioner, so it inherits that element's suppression and needs no selector of
its own; the positioner is a styled element in its own right (`z-index: 60`) and is where a popup-position
animation would land; the tooltip's `Tooltip.Positioner` (`canvas-dock.tsx:48`) carries no class at all, so
`.editor-shell-tooltip` is the whole of its coverage.

The selectors are real. The two `<aside>` elements in `shell-layout.tsx` carry `editor-shell-panel` and `editor-shell-inspector` (cite them by class, not by line — that file has moved three times and Task 9 of the sibling viewport plan moves it again), and exactly one element matches `.editor-shell-panel`, so the locator is not strict-mode ambiguous.

**Teeth checks — seven, and each must fail in its broken state.** Delete, rebuild (`npx vite build packages/editor`), run the grep, restore:

1. the whole `prefers-reduced-motion` block → fails at `expect(duration).toBe("0s")`
2. `transition: none !important;` only → `Expected: "0s"` / `Received: "0.14s, 0.14s, 0.14s, 0.14s, 0.14s"` at the control read
3. `@keyframes vigilia-panel-in { … }` only, shorthand kept → `Expected: >= 2` / `Received: 0`, and note `reveal.duration` still reads non-zero — that is what makes the keyframes probe the assertion that carries this case
4. **both** `.editor-shell-positioner` selectors → must fail on the **positioner** assertion — the `injectedTransition(positioner)` poll that expects `"0s"`, the last of the three positioner lines. **Not the popup assertion** — the popup element still matches its own `.editor-shell-menu-popup` selector, so that one passes. Deleting the popup's pair on its own is green (the popup is covered through its parent); deleting both pairs fails one block earlier, on the popup assertion. An earlier revision of this check named the popup assertion, from a time before the positioner assertion existed.
5. the two `.editor-shell-tooltip` selectors → must fail on the tooltip assertion, the same way
6. `transform 140ms ease,` from the shorthand → `Expected: "background-color, border-color, color, transform, opacity"` / `Received: "background-color, border-color, color, opacity"`
7. **both `*` descendant lines together** — `.editor-shell-menu-popup *` and `.editor-shell-positioner *` → must fail on the **menu-item** assertion, the `injectedTransition(menuItem)` poll that expects `"0s"`, with `0.2s` received. Delete them one at a time and the suite stays green: either line alone still reaches the item, since the popup nests inside the positioner. `.editor-shell-tooltip *` is deliberately **not** part of this check — it matches no element at all (see below), so deleting it can change nothing.

**Delete each class's pair separately, never as one "delete all six" — and expect checks 4, 5 and 7 to be the only three that fail.** Two facts about this block are counter-intuitive enough that a reader will otherwise conclude the test is broken when it is the check that is:

- **The popup is a child of the positioner** (`shell-layout.tsx:175-177`: `Menu.Positioner` wraps `Menu.Popup`), so `.editor-shell-positioner *` already matches the popup. **Deleting the two `.editor-shell-menu-popup` selectors on their own leaves the suite GREEN, and that is correct** — the popup is still suppressed through its parent. Do not read that as a vacuous test and do not add a deletion that "fixes" it. Deleting the positioner pair alone still fails at the **positioner** assertion, not the popup's — that is why check 4 is the positioner's and there is no popup-only check. Only deleting **both** pairs reaches the popup assertion, one block earlier, because by then nothing covers the popup at all.
- **The tooltip is the reverse case**: `canvas-dock.tsx:48`'s `Tooltip.Positioner` carries **no class at all**, so `.editor-shell-tooltip` is the whole of the tooltip's coverage and check 5 fails as specified.
- **`.editor-shell-tooltip *` matches nothing, and that is a fact about the markup rather than a defect to fix.** `canvas-dock.tsx:49-51` renders `<Tooltip.Popup …>{label}</Tooltip.Popup>`, and `label` is a plain string — the popup's only child is a text node, so no element descendant exists to match. The line is harmless but unreachable. The popup's and the positioner's `*` lines are the load-bearing two, because both of those render `{children}` — ReactNode containing the menu items. Do not delete the tooltip's `*` line as dead code without also deciding the tooltip popup should carry markup; and do not add a teeth check that deletes it, because it cannot fail.

That is also why the batched "delete all six" check this step originally carried proved nothing: it could not distinguish "the popup is covered by its own selectors" from "the popup is covered by its parent's", and it left the positioner and tooltip unguarded through two review rounds.

**One more check, and it is a "wrong element" check rather than a deletion.** The `Value runs` anchor exists so the
positive control cannot pass while measuring the zoom menu. Prove it by opening the **zoom** menu with the View
menu never opened — focus `.editor-shell-zoom`, press `ArrowDown` — and confirm the run **fails on the `Value runs`
assertion**. Deleting the View click instead does *not* test this: the run then fails on the earlier
`expect(popup).toBeVisible()`, because no menu opened at all, so it never reaches the anchor. Confirm the anchor is
load-bearing by removing it under the zoom-menu scenario and seeing the suite go green — that counterfactual is
what shows the assertion is doing work rather than riding along behind `toBeVisible()`.

If a check passes in its broken state, report it rather than adjusting the test until it fails.

Run: `npx playwright test --project=desktop-chromium --grep "suppresses motion" --workers=1`
Expected: PASS. **Confirm the reported count is non-zero** — a `--grep` matching no test exits successfully having run nothing.

- [ ] **Step 4: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): restrained motion and visible focus rings"
```

---

### Task 10: Full gate

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx` (Step 0 — the held fix from Task 7)

- [ ] **Step 0: Land Task 7's held cast fix**

Task 7's review left one Minor open and held it: a **double cast** in `shell-layout.dom.test.tsx` that bypasses structural checking. It was held rather than run because no task between there and here touches that file — this step is its owner, and it must not outlive the plan silently.

The cast is at `shell-layout.dom.test.tsx:60-65`: a stub supplying only `viewport: { zoom, onChange }`, closed with `} as unknown as EditorShellBridge["editor"]`, under a comment at `:57-59` claiming "the shell only reaches `viewport`".

**The comment is right about reach, and the cast is still the defect.** `shell-layout.tsx` touches `store.bridge.editor` at exactly one place — `:393`, `bridge.editor.viewport` passed to `ZoomReadout` — so `viewport` really is the only member reached. What the `as unknown as` erases is narrower and is the actual risk: the **`viewport` stub itself is unchecked**. Its two members are the shape `ZoomReadout` needs (which is a `ViewportManager`, the same type `zoom-readout.dom.test.tsx:14-32` already pins with `satisfies ViewportManager`).

**The defect is real, and the fix moves the check inside the cast rather than removing the cast:**

```ts
editor: {
  viewport: {
    zoom: () => 1,
    onChange: () => () => undefined,
  } satisfies Pick<ViewportManager, "zoom" | "onChange">,
} as unknown as EditorInteraction,
```

**The `as unknown as` stays, and an earlier revision of this step that told you to replace it with
`as Pick<EditorInteraction, "viewport">` does not compile — probed, both halves.** `editor` is typed
`EditorInteraction` (`bridge.ts:57`), a thirteen-member interface, and the stub supplies one member. So:

- An **assertion** to `Pick<EditorInteraction, "viewport">` fails `TS2352` ("neither type sufficiently
  overlaps") and, even if it were allowed, the result is missing `canvas`, `imageManager`, `textManager`,
  `layerManager` and eight more — `TS2740` at the site that passes it to `createShellLayout`. The `unknown`
  hop is not what B10 said it was; it is the honest shape for "one member of thirteen", and it is
  unavoidable.
- What actually fixes the defect is the **`satisfies`**, which is a *checked* narrowing and needs no cast:
  it pins the two members the readout uses against `ViewportManager` and rejects a wrong type at the
  literal. That is the assertion the `as unknown as` alone was erasing, and adding it is the whole change.

Use `satisfies Pick<ViewportManager, "zoom" | "onChange">` and **change nothing else**. Do not widen the
stub to a full `ViewportManager`: `ZoomReadout` is the only consumer, a full stub would fabricate members
nothing exercises, and `zoom-readout.dom.test.tsx:14-32` is where the complete shape belongs — it already
has it.

If, while doing this, you find the shell reaching a second member of `editor`, stop and report it — that
would mean the comment at `:57-59` is wrong, which is a finding in its own right rather than a reason to
widen the stub.

**Teeth check, and report the output verbatim:** add `satisfies Pick<ViewportManager, "zoom" | "onChange">`
first and confirm `npm run typecheck` is **clean** — that is the state the fix ships in. Then change
`zoom: () => 1` to `zoom: "1"` and confirm it now **fails to compile**, with `TS2322: Type 'string' is not
assignable to type '() => number'` pointing at the `satisfies`. Restore afterwards. If the clean run is not
clean, or the broken run is not broken, the `satisfies` is not doing the work and the step has not been
done.

- [ ] **Step 1: Run the broad gate**

```bash
cd src/web
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run size
```

The "unrelated formatting in `tests/e2e/host-settings.spec.ts`" line that used to sit here was stale and has been removed from `STATUS.md`; if `format:check` fails now, it is this change's doing and must be fixed, not recorded. (An earlier revision also cited a file count here. It was wrong when written and staler by the time you read it — the command's own output is the number, and there is no value in restating it.)

- [ ] **Step 2: Run the browser suite**

```bash
npx playwright install chromium   # if needed
npm run test:e2e
```

**No known-failing tests are carried into this gate — a red suite is a failure to investigate, not to accept.** This step previously named two pre-existing phone-chromium failures in `display-fabric.spec.ts`; both were measured and **both pass**:

```
npx playwright test --project=phone-chromium --grep "keeps repainting as samples arrive" --workers=1
  ✓ 1 passed (32.4s)
npx playwright test --project=phone-chromium --grep "is byte-stable at a fixed clock" --workers=1
  ✓ 1 passed (32.9s)
```

Report any red test with its output and a base-commit run proving when it started. Do not classify a failure as pre-existing without that proof.

- [ ] **Step 3: Inspect the rendered editor**

Rebuild, then re-capture and open:

```bash
cd src/web && npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --workers=1 \
  --grep "captures the mounted editor for visual review"
```

`captureVisualReview` returns immediately unless `VIGILIA_CAPTURE` is set, so a plain run writes no file and this step becomes "open an image that is not there". Confirm the run reported a non-zero test count — a `--grep` matching nothing exits successfully having run nothing.

In the image, check each spec acceptance item by eye: indentation and collapse, two state icons per row, actions in the bottom row only, arrange on the toolbar, paired geometry fields, focus rings. The capture is the whole editor at default zoom; if a specific control is too small to judge there, open the host (`node packages/host/bin/vigilia.js`, built first) and look at it directly rather than zooming a PNG.

- [ ] **Step 4: Update STATUS.md**

Replace the "Last completed change" section with a 1–5 bullet summary of this work, update "Next" and "Blockers / unverified", then run `npm run status:check`.

- [ ] **Step 5: Commit**

```bash
git add STATUS.md src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx
git commit -m "docs(status): record the editor UI polish"
```

Step 0's test file is in the `git add` deliberately: a code change that cannot be committed alongside the commit that records it is the failure this step would otherwise have shipped.

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
| `Slider` and `ColorSwatch` | **not built** — no consumer in this plan; see Task 8 Step 3 |
| Motion and focus rings | 9 |
| Lucide dependency and notices | 1 |
| Acceptance: full gate | 10 |

**Placeholder scan:** no "TBD"/"handle edge cases"/"similar to Task N". Every implementation step carries code or an exact predicate. Task 4 Step 3 and Task 5 Step 4 name behaviour to implement rather than reproducing a whole file, because the surrounding file is the owner and duplicating it here would drift; each names the exact function and the exact call.

**Type consistency:** `ObjectTarget` fields (`kind`, `locked`, `memberCount`, `isGroup`) are the same in Tasks 1, 2, 6. `LayerRow` fields are the same in Tasks 3, 4, 5. `actionEnabled(gate: ActionGate, id)` is defined once, in `object-actions.ts` alongside `OBJECT_ACTIONS` — there is nothing to extract and no second owner, which is why Task 6's earlier "extract it from `canvas-dock.tsx`" instruction was removed; `EditorShellBridge` satisfies `ActionGate` structurally (its `target()` at `bridge.ts:34` and `canArrange` at `:36`), which is how a bridge is passed where a gate is expected. It is used by the dock and by the layer panel's bottom row — **not** by Task 7's toolbar, which reads eligibility from the snapshot instead, because the bridge in that scope is `EditorShellBridge | undefined` and `actionEnabled` dereferences its gate. `reorderLayer` returns `boolean` in Task 6 and is asserted as such.

**Review Focus coverage:** item 1 → Task 6 Step 6; item 2 → Task 5 Step 1 and Step 7; item 3 → Task 4 Step 1 (blank name) and Task 5 Step 3 (rename input); item 4 → Task 5 Step 7; item 5 → Task 2 Step 6 and Task 6 Step 1.

**Known ordering constraint:** Task 4's `collapsedGroups` starts bridge-local and is moved to the shell in Task 5. If an executor takes the tasks out of order, Task 5's re-render subscription is what makes collapse visible; nothing else depends on the move.
