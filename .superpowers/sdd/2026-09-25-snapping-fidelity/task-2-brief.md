### Task 2: ActiveSelection eligibility

**Files:**
- Create: `src/web/packages/editor/src/snap-manager/selection-eligibility.ts`
- Create: `src/web/packages/editor/src/snap-manager/selection-eligibility.test.ts`
- Modify: `src/web/packages/editor/src/snap-manager/index.ts:120-133` (the `startGesture` guard)

**Interfaces:**
- Consumes: Fabric `ActiveSelection`, `FabricObject`, `Group`, `Textbox`.
- Produces:
  ```ts
  /** Whether a composed selection may snap as a unit. Mirrors the fork's
   * `_isSupportedActiveSelection` (movement-snapping-controller.ts:180-197). */
  export function isSupportedActiveSelection(input: {
    readonly selection: ActiveSelection;
  }): boolean;
  ```

The fork refused a multi-selection when any child was parented, when the selection scale was not unit and a child was text, or when the children were of an unsupported kind. Vigilia's comment claims "Vigilia has no composite type to allow-list" — true for the *kind* clause, since every Vigilia object is text, shape, chart, group or image, but not for the other two clauses.

- [ ] **Step 1: Write the failing test**

```ts
// src/web/packages/editor/src/snap-manager/selection-eligibility.test.ts
import { ActiveSelection, Group, Rect, Textbox } from "fabric/es";
import { describe, expect, it } from "vitest";
import { isSupportedActiveSelection } from "./selection-eligibility.js";

describe("active selection eligibility", () => {
  it("accepts two plain objects", () => {
    const selection = new ActiveSelection([
      new Rect({ width: 10, height: 10 }),
      new Rect({ width: 10, height: 10 }),
    ]);
    expect(isSupportedActiveSelection({ selection })).toBe(true);
  });

  it("refuses a single-object selection", () => {
    const selection = new ActiveSelection([new Rect({ width: 10, height: 10 })]);
    expect(isSupportedActiveSelection({ selection })).toBe(false);
  });

  it("refuses a selection containing a parented object", () => {
    const group = new Group([new Rect({ width: 10, height: 10 })]);
    const selection = new ActiveSelection([
      group.getObjects()[0]!,
      new Rect({ width: 10, height: 10 }),
    ]);
    expect(isSupportedActiveSelection({ selection })).toBe(false);
  });

  it("refuses a scaled selection containing text", () => {
    // The fork's comment: otherwise the text finalization path could
    // reinterpret movement as unfinished scaling.
    const selection = new ActiveSelection([
      new Textbox("hi", { width: 40, height: 20 }),
      new Rect({ width: 10, height: 10 }),
    ]);
    selection.set({ scaleX: 1.5, scaleY: 1.5 });
    expect(isSupportedActiveSelection({ selection })).toBe(false);
  });

  it("accepts a unit-scale selection containing text", () => {
    const selection = new ActiveSelection([
      new Textbox("hi", { width: 40, height: 20 }),
      new Rect({ width: 10, height: 10 }),
    ]);
    expect(isSupportedActiveSelection({ selection })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/snap-manager/selection-eligibility.test.ts`
Expected: FAIL — module does not resolve.

- [ ] **Step 3: Port the guard**

Adapt the fork's `_isSupportedActiveSelection`. Keep the member-count, no-parented-child and unit-scale-with-text clauses; drop the kind allow-list clause (every Vigilia object is supported) and record that decision in the file's header comment, since §175 requires the dropped clause to be accounted for rather than silently missing:

```ts
// src/web/packages/editor/src/snap-manager/selection-eligibility.ts
// Ported: fork 9efdd78a src/editor/snapping-manager/movement/movement-snapping-controller.ts:180-197
// Dropped clause: the fork's per-child kind allow-list, because every Vigilia
// scene object is text, shape, chart, group or image, all of which support
// movement snapping.
```

- [ ] **Step 4: Apply it in `startGesture`**

After `const active = canvas.getActiveObject()` and before the bounds read:

```ts
    // A composed selection the fork declined must not join a gesture: a scaled
    // text selection would let the movement path be reinterpreted as an
    // unfinished scale.
    if (active instanceof ActiveSelection && !isSupportedActiveSelection({ selection: active }))
      return;
```

`ActiveSelection` must be a **value** import, not a type import: `instanceof` needs the runtime class, and `import type` is erased. `index.ts:1` currently reads `import type { Canvas, FabricObject } from "fabric/es";` — split it:

```ts
import { ActiveSelection } from "fabric/es";
import type { Canvas, FabricObject } from "fabric/es";
```

Getting this wrong does not fail to compile and does not fail any test: the `TypeError: Right-hand side of 'instanceof' is not an object` lands inside `guard` (`index.ts:278-286`), which turns it into a swallowed `errors.error("snapping", …)`, so the gesture silently never starts. Step 6's browser check is what catches it.

**Also import `isSupportedActiveSelection`** into `index.ts` from `./selection-eligibility.js` in the same edit — the guard calls it, and no step otherwise says where it comes from. This one *is* caught by the compiler.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run packages/editor/src/snap-manager`
Expected: PASS.

- [ ] **Step 6: Verify in the browser**

Rebuild and check that dragging a two-object marquee selection still snaps to a neighbour, and that a deliberately scaled text selection does not join a snap gesture. Record both as browser tests in `tests/e2e/editor.spec.ts`; a jsdom test cannot show that Fabric never fires `object:moving` for the refused case.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/snap-manager/selection-eligibility.ts \
  src/web/packages/editor/src/snap-manager/selection-eligibility.test.ts \
  src/web/packages/editor/src/snap-manager/index.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): refuse a snap gesture for an unsupported selection"
```

---

