### Task 7: Group entry

**Files:**
- Modify: `src/web/packages/editor/src/grouping-manager/index.ts`
- Create: `src/web/packages/editor/src/grouping-manager/group-entry.dom.test.ts`
- Modify: `src/web/packages/editor/src/canvas-nudge.ts` + `canvas-nudge.dom.test.ts` + `editor-session.dom.test.ts` (Step 3b — Task 6's latent plane bug)
- Modify: `src/web/packages/editor/src/editor-shell.ts` (Step 5 — the double-click binding)
- Modify: `src/web/packages/editor/src/shortcut-manager/index.ts` (`ProductShortcutId` + `CONTEXT_SHORTCUTS` — Step 5)
- Modify: `src/web/packages/editor/src/editor-session.ts` (Step 5 — the Escape handler)
- Modify: `src/web/tests/e2e/editor.spec.ts` (Step 6)

`editor-interaction.ts` is **not** edited: it only *consumes* `GroupingManager` (`:46`), so widening that
interface flows through it without a line changing there. An earlier revision listed it as "Modify", which
sends an implementer looking for an edit that does not exist — and the defect this replaced was worse:
`editor-shell.ts` was missing from both this block and Step 7's `git add`, so the file that actually binds
the event would have been left unstaged by a literal Step 7, committing a tree that does not compile.

**Interfaces:**
- Produces: `GroupingManager` gains
  ```ts
  enterGroup(options?: { readonly object?: FabricObject }): FabricObject | undefined;
  exitGroup(): readonly FabricObject[] | undefined;
  readonly groupContext: () => readonly FabricObject[];
  ```

- [ ] **Step 1: Write the failing test**

```ts
it("enters a group and selects the child under the object", () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const child = new Rect({ id: "child", width: 10, height: 10 });
  // `id` is not a `Partial<GroupProps>` key, so it needs `set` — the
  // constructor overload rejects it.
  const group = new Group([child]);
  group.set("id", "group");
  canvas.add(group);
  const manager = createGroupingManager({
    canvas, save: vi.fn(), suspend: () => () => undefined,
  });

  expect(manager.enterGroup({ object: group })).toBe(group);
  expect(manager.groupContext()).toEqual([group]);

  // A child's pointer target resolves to the child, not the group.
  const target = manager.enterGroup({ object: child });
  expect(target).toBe(child);
  expect(canvas.getActiveObject()).toBe(child);
  // Asserted on the flags themselves, so a failure names the mechanism rather
  // than only the symptom: Fabric retargets only when both are true.
  expect(group.subTargetCheck).toBe(true);
  expect(group.interactive).toBe(true);

  expect(manager.exitGroup()).toEqual([group]);
  expect(canvas.getActiveObject()).toBe(group);
  expect(manager.groupContext()).toEqual([]);
  expect(group.subTargetCheck).toBe(false);
  expect(group.interactive).toBe(false);
});
```

**The rule those assertions pin, stated once because the step is otherwise ambiguous.**
`enterGroup({ object })` sets the context to `[ownerGroup(object) ?? object]` and makes the active
object `object`; it does **not** push onto the context. That is why entering the group leaves the
context `[group]`, and why entering its child (`child`, whose owner is `group`) leaves the context
unchanged rather than making it `[group, child]` — so the single `exitGroup()` afterwards yields
`[]`, not `[group]`. Figma behaves this way: clicking a child inside an entered group selects the
child without deepening the context. `exitGroup()` returns the context **before** it popped
(`[group]` here) so a caller can restore a selection, and clears the through-selection flags as the
last two assertions show. An implementation that pushes instead fails the last three assertions
together — read them as the specification rather than adjusting them.

```ts
it("clears the context when the group is ungrouped", () => {
  // Step 3 says this guard "is asserted below" — it was not, in either this
  // test or Step 6, so the guard could be deleted with the suite green. This is
  // Review Focus item 4: a stale context re-selects a destroyed group.
  const canvas = new Canvas(document.createElement("canvas"));
  const child = new Rect({ id: "child", width: 10, height: 10 });
  // `id` is not a `Partial<GroupProps>` key, so it needs `set` — the
  // constructor overload rejects it.
  const group = new Group([child]);
  group.set("id", "group");
  canvas.add(group);
  canvas.setActiveObject(group);
  const manager = createGroupingManager({
    canvas, save: vi.fn(), suspend: () => () => undefined,
  });

  // `ungroup()` requires a Group to be active, so activate it before entering —
  // entering a group does not make it the canvas's active object.
  expect(manager.enterGroup({ object: child })).toBe(child);
  expect(manager.groupContext()).toEqual([group]);

  // `removeAll` normally bakes the transform into the children; this fixture's
  // child is plain geometry, so the members it returns are what matters.
  expect(manager.ungroup()).toEqual([child]);

  expect(manager.groupContext()).toEqual([]);
  // The real failure the guard prevents: an exit now would re-select a group
  // that is no longer on the canvas.
  expect(canvas.getObjects()).not.toContain(group);
  expect(manager.exitGroup()).toBeUndefined();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/grouping-manager/group-entry.dom.test.ts`
Expected: FAIL — `manager.enterGroup is not a function`.

- [ ] **Step 3: Implement entry and exit**

**`enterGroup` needs the pointer's scene point, not just the object.** Fabric hit-tests **before** your
handler runs, and a group is opaque to the pointer until `subTargetCheck`/`interactive` are set — so the
entering double-click's own `event.target` is always the **group**, never the child, and an implementation
that only armed the flags would need a *second* double-click to reach the child. Resolve the deepest target
from the event's `scenePoint` after arming, and take that as an optional `scenePoint` argument
(`enterGroup(options?: { object?: FabricObject; scenePoint?: Point })`). A Fabric scene point and a client
point are different planes; pass the scene point, and if you find yourself compensating with a canvas box
offset, stop — that is the mapping bug Task 10 exists to remove, not a thing to work around here.

`enterGroup` **records the ancestor path first, then** sets the child active — that order is required, not stylistic. Fabric's `setActiveObject` fires `selection:created` **synchronously**, the bridge subscribes to that event pair and calls `notify()`, and the layer store re-reads `bridge.layers()` on every notify. So the panel renders at the moment you set the active object, and if the context is recorded after, the tree renders once with the stale context and only corrects on the next unrelated notification — a one-notification-late tree that reads like a React batching bug. `exitGroup` pops one level and re-selects the group. Both record no history — group *context* is selection state, not authored content (§67), which is exactly why it is transient here rather than in the envelope. `ungroup()` must clear the context, or a later `exitGroup` re-selects a destroyed group. That is the Review Focus item, and it is asserted below.

Also add: `ungroup()` clears the context; `destroy`-time `stopGesture`-style cleanup is not needed since the context is plain state on the manager.

**`enterGroup({ object: child })` must also make the group selectable-through, and the plan previously never said so.** Fabric retargets a pointer inside a group to the child only when the group has **both** `subTargetCheck: true` and `interactive: true` — `searchPossibleTargets` requires `target.subTargetCheck` at `index.node.cjs:11246` to run the sub-search at all, and then `container.interactive` at `:11269` to adopt `subTargets[0]`. With either left at its default `false` the pointer keeps resolving to the group, Step 6's `expect.poll(...).toBe("child")` never settles, and a correct `enterGroup` fails its own browser test.

A flag at its **default** value is stripped from the document, so the pair is free while it is `false`. A flag set `true` **is** persisted — `persist.dom.test.ts`'s second case asserts the exact key list of a group constructed with them, and that list contains both — so a group left `true` at serialisation time carries editor state into a portable file. Setting them is safe only because you restore them: `enterGroup` sets them on the group it enters and remembers which ones it changed; `exitGroup` restores them. **A group already carrying them — a scene built by `createSceneAdapter` passes `subTargetCheck: false, interactive: false` explicitly (`fabric-nodes.ts:194-195`) — may be left alone and need not be restored.** The test above asserts the child is the resolved target, which is what pins this; assert the two flags directly too, so a failure names the mechanism rather than the symptom. Note also that `persist.dom.test.ts` builds its own fixtures, so it cannot catch a leaked flag — the assertions in the test above are this task's guard, and Step 4 says so.

**An earlier revision of this paragraph said the restore makes the pair safe, full stop. It does not — there is a third path out of an entered group, and it is the save.** Exit and undo both clear `flagsSet` before anything is serialised, but a save while the author is *inside* a group serialises the armed pair, because `Group.toObject` forces both keys into its output unconditionally (`fabric/dist/src/shapes/Group.mjs:375-384`) and `includeDefaultValues = false` (`persist.ts:58`) strips only keys whose value *equals its default* — both defaults are `false` (`Group.mjs:25-26`), so `true` survives. The reopened document then has a group that is permanently pointer-transparent, and a click inside it selects the child, bypassing the layer tree's own rule. `flagsSet` cannot help: it is transient and already empty when the serialiser runs.

The fix belongs in `persist.ts`, beside the existing `removeRuntimeText` walk: delete `subTargetCheck` and `interactive` from every object in the serialised tree. No type test is needed — Fabric forces those keys in only from `Group.toObject`, so delete-if-present cannot miss a nested group and cannot remove anything an author authored, because there is no way to author them: the grouping manager is the only writer (`grouping-manager/index.ts:54-63`, `:131-132`) and `fabric-nodes.ts:194-195` only seeds the default. **Do not instead clear the group context inside `shell.snapshot()`** — `snapshot` is a read path as well as a save path (`editor-session.ts:439`, `:466` return it from public methods), so that would silently drop an author out of their group when they merely read the envelope.

- [ ] **Step 3b: Fix Task 6's nudge plane, which only this task can reach**

`canvas-nudge.ts`'s `nudge()` reads `object.getCenterPoint()` and writes `setPositionByOrigin(...)`. For a
**grouped child** those are different planes: `getCenterPoint()` returns the centre **relative to the
canvas**, mapped through the group's transform (`index.node.cjs:5473-5476`), while `setPositionByOrigin`
writes the object's **local** `left`/`top`. Fabric's own typings say it plainly —
`ObjectGeometry.d.ts:306` calls `getCenterPoint()` "relative to canvas" and `:311` calls
`getRelativeCenterPoint()` "relative to it's parent".

So `ArrowRight` on a child inside an entered group moves it by the group's centre minus its own, not by one
unit. Observed in this task's own Step 6: `Expected: 1, Received: 41` — the child jumping to `left: 41`
instead of `1`, with the assertion written one line away from the nudge, which is what makes it look like a
nudge bug rather than a coordinate-plane bug.

**Change `getCenterPoint()` to `getRelativeCenterPoint()` in `canvas-nudge.ts`, and rename the same member in
its two test doubles** (`canvas-nudge.dom.test.ts`, `editor-session.dom.test.ts`). The two are identical for
an ungrouped object, so Task 6's own tests stay green either way — which is exactly why the defect survived
that task. **Do not weaken Step 6's assertion to accept `41`**: the assertion is right and the code is wrong,
and a nudge that moves a grouped child by the group's offset is a real failure the user would see.

This is the third time this bug class has appeared in this plan's area — `A10` exists for the same scene-vs-
screen confusion in the e2e helpers — so name the plane in the code comment you leave behind.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/editor/src/grouping-manager packages/scene-fabric/src/persist.dom.test.ts`
Expected: PASS. `persist.dom.test.ts` is a regression check on the serialiser's contract, not a catcher: its two cases build their own fixtures, so neither serialises a group the editor entered and neither can go red from a leaked flag. The flag assertions in Step 3 are what hold that line.

- [ ] **Step 5: Wire double-click and Escape**

Bind double-click on the canvas to `enterGroup` with the pointer's target. `text-manager` already owns this event — `canvas.on("mouse:dblclick")` at `text-manager/index.ts:30` — and its handler returns early for any non-`IText` target, so a group double-click reaches your handler untouched. Two listeners on one event is correct here; do not take the event over.

**Re-apply the flags after every history restore.** Undo runs `reviveScene` → `loadFromJSON` (`scene-fabric/persist.ts:87-93`), which builds **new** Group instances with the flags back at their defaults — probed: the post-revive group is a different object, and the stale pre-undo instance has `canvas === undefined`. Hook the re-apply to `editor:history-state-loaded` (`history-manager/index.ts:75`), the same point `editor-shell.ts:334` already uses to restore the artboard plate, and restore the context's object references from the revived tree **by id** at the same time. Step 6's `childLeft` after `Control+z` and its Escape assertion are what prove both halves.

Escape goes through `ShortcutManager`, not a raw window listener: it is already the owner of window-level keys, and a second global keydown listener would both duplicate that owner and race it. Add `"view.exit-group"` to `ProductShortcutId`, add `{ key: "escape", modifier: false, action: "view.exit-group" }` to `CONTEXT_SHORTCUTS` — the array for bindings that are dispatched but never displayed, which is why this one belongs there and not in `PRODUCT_SHORTCUTS` — and register the handler in `editor-session.ts` beside the other `#shortcuts.register` calls.

**Escape defers to a focused text field for free, and do not add it to the deferred set.** `escape` carries no `modifier`, so the dispatcher's `!binding.modifier` branch already defers it whenever `isTextEntryTarget(event.target)` — which is what keeps Fabric's own in-place editing case owning its own Escape. Adding `view.exit-group` to `MODIFIED_KEY_DEFERRED_ACTION_IDS` would be wrong twice: the set is consulted only for modifier bindings, and membership would not change this binding's behaviour. An earlier revision said to register it with `TEXT_ENTRY_DEFERRED_ACTIONS`; that name is superseded (see Task 6's rename ruling) and the instruction was never needed. Confirm the deferral in the browser instead of asserting it in code.

- [ ] **Step 6: Verify in the browser, including the undo case**

```ts
test("enters a group, steps back out, and survives an undo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
  await page.goto(EDITOR);
  await setThemePackage(page, "grouping.vigilia-theme", {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "grouping",
    artboard: { width: 320, height: 180 },
    // A raw `fill` with no `vigiliaPaint` is rejected by the validator:
    // "fill must reference an existing palette token through vigiliaPaint."
    // Every fixture in this file declares the palette it paints from.
    globals: {
      palette: {
        none: { name: "None", value: { kind: "solid", color: "transparent" } },
        accent: { name: "Accent", value: { kind: "solid", color: "#00b8d9" } },
      },
    },
    scene: {
      version: "7.4.0",
      objects: [
        // `width`/`height` are load-bearing: without them the group revives 0x0,
        // its `aCoords` collapse to a single point, and the pointer never finds
        // a target — the gesture does not start at all.
        { type: "Group", id: "grp", left: 40, top: 40, width: 30, height: 30,
          objects: [
            { type: "Rect", id: "child", left: 0, top: 0, width: 30, height: 30,
              fill: "#00b8d9", vigiliaPaint: { fill: "palette.accent" },
              originX: "left", originY: "top" },
          ] },
        { type: "Rect", id: "outside", left: 240, top: 40, width: 30, height: 30,
          fill: "#00b8d9", vigiliaPaint: { fill: "palette.accent" },
          originX: "left", originY: "top" },
      ],
    },
  });
  await expect(page.locator("#status")).toHaveText("Opened grouping.vigilia-theme");

  // Points are derived from the camera, never from the canvas box: the canvas is
  // host-sized, so its box says nothing about where the artboard is.
  const rect = await page.evaluate(() => {
    const b = (window as unknown as {
      vigiliaEditorBridge: {
        editor: {
          viewport: {
            artboardScreenRect(): { left: number; top: number; width: number; height: number };
          };
        };
      };
    }).vigiliaEditorBridge;
    return b.editor.viewport.artboardScreenRect();
  });
  // `rect` is canvas-relative, so the canvas box offset is added here. Task 10
  // assembles this same pair into one `sceneToClient` helper; this test is the
  // first consumer and the local form is deliberate, not a second owner.
  const canvasBox = (await page
    .locator("#vigilia-fabric-editor canvas.upper-canvas")
    .boundingBox())!;
  const at = (x: number, y: number): [number, number] => [
    canvasBox.x + rect.left + (x / 320) * rect.width,
    canvasBox.y + rect.top + (y / 180) * rect.height,
  ];

  const state = (): Promise<{
    active: string | undefined;
    childLeft: number | undefined;
    groupPresent: boolean;
  }> =>
    page.evaluate(() => {
      const b = (window as unknown as {
        vigiliaEditorBridge: {
          editor: {
            canvas: {
              getActiveObject(): { id?: string } | undefined;
              getObjects(): Array<{
                id?: string;
                getObjects?(): Array<{ id?: string; left?: number }>;
              }>;
            };
          };
        };
      }).vigiliaEditorBridge;
      const canvas = b.editor.canvas;
      const group = canvas.getObjects().find((object) => object.id === "grp");
      return {
        active: canvas.getActiveObject()?.id,
        childLeft: group
          ?.getObjects?.()
          .find((object) => object.id === "child")?.left,
        groupPresent: group !== undefined,
      };
    });

  // Double-click inside the child: the pointer's target resolves to the child,
  // which becomes the active object while the group stays in the context.
  const [cx, cy] = at(55, 55);
  await page.mouse.dblclick(cx, cy);
  await expect.poll(async () => (await state()).active).toBe("child");

  const before = (await state()).childLeft;
  // Playwright's `expect` has no `toBeTypeOf` — that is Vitest's matcher.
  expect(typeof before).toBe("number");

  // Nudge (Task 6's binding), then undo it. The undo must not leave the context
  // pointing at a destroyed object.
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await state()).childLeft).toBe((before ?? 0) + 1);
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await state()).childLeft).toBe(before);

  // Escape is the assertion that survives the undo — but only if it reads
  // identity rather than id. Every read above is by `id`, and a revived object
  // keeps its `id`: a context still holding the *pre-undo* instance satisfies
  // `active === "grp"` just as well as a re-resolved one, and `groupPresent`
  // reads the revived canvas either way. Neither can tell the two apart.
  //
  // `exitGroup` is the one path that reads the group off the canvas, so assert
  // what it actually put there.
  const inCanvas = (): Promise<boolean> =>
    page.evaluate(() => {
      const b = (window as unknown as {
        vigiliaEditorBridge: {
          editor: { canvas: { getActiveObject(): unknown; getObjects(): unknown[] } };
        };
      }).vigiliaEditorBridge;
      return b.editor.canvas
        .getObjects()
        .includes(b.editor.canvas.getActiveObject());
    });

  await page.keyboard.press("Escape");
  // For a one-object selection Fabric sets `activeObject` to that object, so
  // `setActiveObject(target)` makes `getActiveObject() === target`. Identity is
  // therefore readable here, and is the only thing that separates a live group
  // from the destroyed instance.
  await expect.poll(inCanvas).toBe(true);
  await expect.poll(async () => (await state()).active).toBe("grp");
  expect((await state()).groupPresent).toBe(true);
});
```

Run: `npx playwright test --project=desktop-chromium --grep "enters a group" --workers=1`
Expected: PASS. Then run two teeth checks and restore after each:

1. Drop the post-restore re-apply from Step 5 and confirm the `inCanvas` poll fails. **Verify this one by actually breaking it.** An earlier revision named the `Control+z` step as the witness, and that step cannot witness it: `childLeft` is a property of an object the *scene* rebuilt, so it equals `before` whether or not the context was re-resolved, and the id-only `active`/`groupPresent` reads are equally blind. The identity check is the only assertion above that separates a re-resolved group from the destroyed one.
2. Remove the context-clearing in `ungroup()` and confirm the unit test's final `expect(manager.exitGroup()).toBeUndefined()` fails. **The undo case above is not the witness for this one** — this e2e test never calls `ungroup()`, so a change confined to `ungroup` cannot redden it, and an implementer told to break `ungroup` and watch this test fail would conclude a correct fix was ineffective.

**The undo case is the one that matters and the unit test above cannot reach it**, because only the browser path goes through real history restore — a restored scene builds *new* Fabric objects, so a context holding the pre-undo instances points at objects that are no longer on the canvas. That is Review Focus item 4.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/grouping-manager \
  src/web/packages/editor/src/canvas-nudge.ts \
  src/web/packages/editor/src/canvas-nudge.dom.test.ts \
  src/web/packages/editor/src/editor-session.dom.test.ts \
  src/web/packages/editor/src/editor-shell.ts \
  src/web/packages/editor/src/shortcut-manager \
  src/web/packages/editor/src/editor-session.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): enter and exit a group from the canvas"
```

---

