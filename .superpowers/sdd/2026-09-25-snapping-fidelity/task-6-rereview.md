# Task 6 scoped re-review — fix commit `dd05235`

Scope: one fix round against one Important finding from the Task 6 review.
Task 6's port fidelity was verified clean previously and is not re-reviewed here.

Inputs used: the provided diff `review-da5f0b2..dd05235.diff` (1 commit, 1 file,
+4/−9), self-contained with no further git ranges derived.

## 1. Is the finding addressed? — Yes

`projectRectangularScaleBounds`
(`src/web/packages/editor/src/snap-manager/scaling/rectangular-scale-gesture-projection.ts:695-727`)
now passes the four corner coordinates inline. Independent confirmation:

- `grep -c "const topLeft = RECTANGULAR"` → `0`; all four hoisted constants are gone.
- The diff hunk is confined to `:695-726` (+4 added `coordinates:` lines, −4 hoisted
  consts, −4 `coordinates: <local>` lines, −1 blank line = the stated +4/−9).
- The only other lines in the hunk are context: the `Number.isFinite` early return,
  the `createProjectedBounds` call, and the closing braces. Nothing else changed.

The current body is now content-identical to the fork's `projectRectangularScaleBounds`
(fork line 609), differing only by formatting, exactly as the reviewer argued it should.

## 2. Is the fix correct rather than merely compliant? — Yes, and the tests could not
have caught a swap

Corner mapping preserved; each argument names the same corner as before:

| argument | before | after |
|---|---|---|
| `topLeft` | `RECTANGULAR_SCALE_CONTROL_COORDINATES.tl` | `.tl` |
| `topRight` | `.tr` | `.tr` |
| `bottomRight` | `.br` | `.br` |
| `bottomLeft` | `.bl` | `.bl` |

**Fixture symmetry / observability.** I checked this rather than accepting the suite.
The `expected` value in the bounds tests comes from `projectFixtureBounds`
(`gesture-projection.test.ts:407`), whose own corner order is `tl, tr, br, bl` — the
same order the production code uses — and the fixture's `topLeft` is derived from the
rectangle's centre (`:318`), so it is **not** mirror-symmetric. A swap **would** make
`projected` diverge from `expected`.

But there is a shared blind spot, and it is worth stating: the two bounds tests that
assert against `expected` (`"projects a rotated drag on the object's own axes"` `:658`
and the `"holds the anchor-side edges"` case at `:713`) do **not** enumerate corners via
`expected` at all:

- `:713` asserts only two `baselineBounds` edges (one horizontal, one vertical). At
  `angle: 0`, `u = (w, 0)` and `v = (0, h)`, so the `tl`/`tr` x and `bl`/`br` y are
  degenerate; a `tl↔tr` or `bl↔br` swap leaves the asserted extrema unchanged.
- `:658` (`angle: 45`, `controlKey: "br"`) is the one case where all four corners are
  distinct and it does compare all four sides against `expected` — so it **would** fail
  on a swap.
- `projectFixtureBounds`'s four `expected.{left,right,top,bottom}` reads are then
  swallowed by `createBoundsFromCorners` (`:398-424`), which is `Math.min`/`Math.max`
  over the corner coordinates, i.e. permutation-invariant. Direct probe:
  `TEMP/perm.mjs` reduced a fixed 4-point set under 6 permutations of corner order and
  every result was identical.

Net: the fix is correct, mapping preserved, and the `angle: 45` case alone makes a swap
observable. No swap was introduced. **Observation (not a blocking finding):** the suite's
general tolerance to any *within-order* rotation of the corner list is inherent to
reducing corners to bounds, so bounds assertions cannot be the only guard against corner
mix-ups. The fork-comparison rule in the port is the real protection here, and the code
now matches the fork text.

## 3. Does the fork comparison hold? — Yes

Read-only verification against the pinned fork commit
(`git -C D:/git-repos/fabricjs-image-editor show 9efdd78a...:src/editor/snapping-manager/scaling/rectangular-scale-gesture-projection.ts`),
no checkout/switch/clean/reset and no writes to that repository:

```ts
  return createProjectedBounds({
    topLeft: projectScaledPoint({ projection, multipliers, coordinates: RECTANGULAR_SCALE_CONTROL_COORDINATES.tl }),
    topRight: projectScaledPoint({ projection, multipliers, coordinates: RECTANGULAR_SCALE_CONTROL_COORDINATES.tr }),
    bottomRight: projectScaledPoint({ projection, multipliers, coordinates: RECTANGULAR_SCALE_CONTROL_COORDINATES.br }),
    bottomLeft: projectScaledPoint({ projection, multipliers, coordinates: RECTANGULAR_SCALE_CONTROL_COORDINATES.bl })
  })
```

Matches the post-fix local body exactly modulo formatting. The `RECTANGULAR_SCALE_CONTROL_COORDINATES`
record itself is value-identical on both sides (`tl 0,0 / tr 1,0 / bl 0,1 / br 1,1 /
ml 0,.5 / mr 1,.5 / mt .5,0 / mb .5,1`).

## 4. Is the remaining difference acceptable? — Yes, both deltas are inside the declared rule

- **Whole-file formatting (local 985 lines vs fork 849).** Expected and unavoidable.
  Verified empirically, not assumed: running the project's own Biome 2.5.14 over the
  file (`src/web/node_modules/.bin/biome format --stdin-file-path=...`) is a **no-op** —
  the output is byte-identical to the file on disk. I proved the check has teeth with the
  same invocation by appending `const   y=1`, which it rewrote to `const y = 1;`. (My
  first two attempts used `npx biome`, which resolved to an unrelated `biome@0.3.3` and
  produced empty output in every case — that probe was worthless; the local binary is the
  valid one.) A file whose formatting is exactly the formatter's fixed point is precisely
  the "whatever the formatter imposes on both sides" allowance.
- **Russian → English JSDoc.** Both sides carry **61** `/**` doc comments, so nothing was
  dropped or invented; the fork's `/** Рассчитывает bounds для заданных множителей, не
  изменяя объект. */` → `/** Calculates the bounds for the given multipliers without
  touching the object. */`. "English comments" is an explicitly named allowed edit.

Neither delta is a deviation from the port's rule, so the file-size exception's rationale
(byte-comparability for cheap future diffs) is not undermined — it was already spending
the formatter's unavoidable reformat on both sides.

## 5. Tests and typecheck

From `src/web/`:

- `npx vitest run packages/editor/src/snap-manager/scaling` → **3 files passed, 98 tests
  passed** (matches the expected 3/98).
- `npm run typecheck` → **clean**; all six workspace projects (`theme-package`,
  `scene-fabric`, `player`, `editor`, `fake-source`, `host`) ran `tsc --noEmit` with no
  diagnostics. This matters because this file's imports are type-only and would resolve
  green under vitest while failing `tsc`.

## 6. Adjudication of the refuted second finding — the refutation is correct

Original second finding: the `abd5713` message "describes the hoist as one of the two
`noUncheckedIndexedAccess` guards", called false for this file.

The message's actual noun phrase is *"two `noUncheckedIndexedAccess` guards (a destructured
corner and the first effective value)"*. Against the fork, there are exactly two such
guards, and both are tuple destructures, so the description is literal and complete:

1. **"the first effective value"** — `rectangular-scale-gesture-projection.ts:196-197`,
   `const [first, second] = effectiveValues;` then `if (first === undefined || !Number.isFinite(first))`.
   The fork's line 184-185 is `if (!Number.isFinite(first))` only; the `first === undefined`
   disjunct is the added guard.
2. **"a destructured corner"** — `:340-341`, `const [topLeft, topRight, bottomRight, bottomLeft] = sourceCorners;`
   then `if (!topLeft || !topRight || !bottomRight || !bottomLeft) return null;`. The fork's
   line 305 destructures and does not null-check.

The hoist destructures nothing and is not a guard, so it is not what the message names. The
finding is **false as stated**, no documentation change is owed, and the refutation stands.
The question is also moot after `dd05235`: the hoist no longer exists, so there is no
remaining object for the wording to misdescribe.

## New issues introduced by the fix

**None — no Critical, no Important.** The change is a pure revert of four hoisted aliases
to inline reads; it removes four local bindings and adds no new behavior, no new imports
and no new identifiers. `RECTANGULAR_SCALE_CONTROL_COORDINATES` is still referenced, so no
unused-variable diagnostic is left behind (typecheck and Biome both clean).

Only the non-blocking observability observation in §2 is noted, and it describes a
pre-existing property of the bounds-reduction tests, not something the fix introduced.

## Verdict

Both findings resolved. The Important finding is genuinely addressed: the four inline
reads are restored, the four hoisted constants are gone, no other code in the function
changed, the corner mapping is preserved, and the resulting body matches the fork verbatim
modulo formatter-imposed whitespace. The refutation of the second finding is correct.
3 files / 98 tests pass and typecheck is clean.
