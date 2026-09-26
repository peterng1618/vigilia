# Task 7 — fix round 1 report

Finding: **Important** — saving while inside a group persisted `subTargetCheck` and
`interactive`, leaking transient editor selection state (§67) into the portable
document and leaving the reopened group permanently pointer-transparent.

## What changed

### `src/web/packages/scene-fabric/src/persist.ts`

- Added `removeGroupEntryFlags(objects)`, a recursive walk beside the existing
  `removeRuntimeText` walk. It `delete`s `subTargetCheck` and `interactive` from
  every object in the serialised tree and recurses into `object["objects"]`
  exactly as `removeRuntimeText` does. Called from `serialiseScene` immediately
  after `removeRuntimeText`.
- No type test: Fabric forces those two keys in only from `Group.toObject`, so
  delete-if-present cannot miss a nested group and cannot remove anything an
  author authored. Verified by grep: the grouping manager
  (`packages/editor/src/grouping-manager/index.ts:54-63`, `:131`) is the only
  writer, and `packages/scene-fabric/src/fabric-nodes.ts:194` only seeds the
  `false` default.
- Extended the module docblock (`persist.ts:28-45`) to name `subTargetCheck` and
  `interactive` as the **contrast case** against the authored
  `selectable`/`evented`/`locked` paragraph: Fabric forces both into every
  `Group.toObject`, group entry arms them, and `includeDefaultValues = false`
  cannot strip an armed `true` because it differs from Fabric's `false` default.

### `src/web/packages/scene-fabric/src/persist.dom.test.ts`

Rewrote the tripwire at `:244-268` (was *"lets them straight back in once the
editor enables group entry"*). It now pins the opposite and is named
**"strips them again when a save happens while the editor has group entry
on"**: it constructs the same `Group` with `subTargetCheck: true,
interactive: true` and asserts the exact persisted key list **without** either
flag. Not deleted — the inverted case is a real regression test that fails the
moment the strip is removed.

Both neighbours unchanged and passing:

- `:230-242` "keeps editor interaction state and engine internals out of a
  display scene" — `subTargetCheck`/`interactive`/`layoutManager` absence for an
  ordinary group.
- The `toEqual` exact-key discipline in the sibling `it.each(CASES)` block.

`layoutManager` absence is unrelated to this change and did not regress.

Alternative ruled out as instructed: the group context was **not** cleared in
`shell.snapshot()`; `snapshot` is a read path too (`editor-session.ts:439`,
`:466`), so clearing there would drop an author out of their group on a mere
read.

## Commands and results

All run from `src/web/`.

| Step | Command | Result |
|---|---|---|
| Fixed, focused file | `npx vitest run packages/scene-fabric/src/persist.dom.test.ts` | 31 passed, 0 failed (31 total) |
| Strip commented out | same | 30 passed, **1 failed** — the rewritten case |
| Strip restored | same | 31 passed, 0 failed (31 total) |
| Types | `npm run typecheck` | clean (all packages: renderer-core, scene-fabric, player, editor, fake-source, host) |
| Format | `npm run format:check` | `Checked 320 files … No fixes applied.` (one wrap fix applied to the new `if` in `persist.ts` first) |
| Lint | `npm run lint` | `Checked 320 files in 479ms. No fixes applied.` |
| Status | `npm run status:check` | clean, no output |

Not run, per scope: full unit suite, `npm run build`, `npm run test:e2e`.

## Teeth check — raw output

### Step 1 — strip in place, green

```
$ npx vitest run packages/scene-fabric/src/persist.dom.test.ts
total 31 passed 31 failed 0
```

### Step 2 — strip commented out, RED (verbatim failure text)

`persist.ts` with `// removeGroupEntryFlags(scene.objects);`:

```
 FAIL  packages/scene-fabric/src/persist.dom.test.ts > Fabric’s own keys are held to the same rule > strips them again when a save happens while the editor has group entry on
AssertionError: expected [ 'height', 'id', 'interactive', …(7) ] to deeply equal [ 'height', 'id', 'left', …(5) ]

- Expected
+ Received

  [
    "height",
    "id",
+   "interactive",
    "left",
    "objects",
+   "subTargetCheck",
    "top",
    "type",
    "version",
    "width",
  ]

 ❯ packages/scene-fabric/src/persist.dom.test.ts:256:53
    254|     group.set("id", "group-1");
    255|
    256|     expect(keysOf(serialiseScene(canvasOf(group)))).toEqual([
     |                                                     ^
    257|       "height",
    258|       "id",

 Test Files  1 failed (1)
      Tests  1 failed | 30 passed (31)
   Start at  13:16:50
   Duration  3.97s
```

The failure names both `interactive` and `subTargetCheck` explicitly, in the diff
body, not only in the truncated one-line matcher summary.

### Step 3 — strip restored, green

```
$ npx vitest run packages/scene-fabric/src/persist.dom.test.ts
total 31 passed 31 failed 0
```

## Not verified

- No browser/e2e evidence. This fix is proven at the serialization unit
  boundary only (the exact persisted key list), not through a browser save while
  inside a group. The gate task owns `test:e2e`.
- Nothing was checked under `packages/*/dist/**` or in `package-lock.json`; both
  were left untouched as instructed.
- The `persist.ts` change was not exercised against a chart nested inside an
  entered group specifically — only a plain `Group`. The recursion is shared
  with `removeRuntimeText`, which is already covered for nesting.
