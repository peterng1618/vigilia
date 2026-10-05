# 0016 — A path is normalised once, for both sides of a join

- **Date:** 2026-09-30
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/providers/library-devices.ts`

## The problem

`library-devices.ts:53` reads:

```ts
function pathOf(volume: VolumeLike): string {
  return (volume.fs ?? volume.mount ?? "").replace(/\/$/, "");
}
```

The drive→volume join at line 118 is `mount === pathOf(entry)`, where `mount`
came from `drivesFrom` pushing **`volume.mount` raw**. So one side of the
comparison is normalised and the other is not.

On Windows that is invisible: the path is `C:`, the regex is a no-op, and both
sides agree. **On POSIX the root volume's mount is `/`; the regex strips it to
`""`, and `"/" === ""` is false.** Every macOS and Linux root volume therefore
reports as belonging to no drive, and its `size`/`used` never reach a
`disk.volume.*` key. A whole platform's storage card reads empty, and the only
symptom is a missing number on a display.

The trailing-slash strip was not the mistake — it is right, and it is what makes
`/mnt/data/` and `/mnt/data` compare equal. **The mistake is that it
normalises a path to the empty string**, and that the answer is applied to one
side of a join instead of being the join's own definition.

## Rung 1 — Vigilia

Searched: `drivesFrom`, `volumesOf`, `pathOf`, `diskDeviceId`
(`renderer-core/src/data/semantic-keys.ts`), `lhm-captions.ts`,
`library-slots.ts`, and every producer of `VolumeLike`.
Found: `pathOf` is the **only** normaliser in the module, and it is called from
exactly one place — the join. `drivesFrom` does not call it, which is the whole
defect. `diskDeviceId` is unrelated: it slugs a *display name*, not a path.

## Rung 2 — dependencies

Searched: the direct dependencies of `@vigilia/host`.
Found: nothing that normalises paths for us, and nothing that should — this is
a three-way join between two provider records, and both sides are already
strings by the time we see them. **No new dependency is warranted.**

## Rung 3 — platform

Searched: `Node`'s `path` module — `path.normalize`, `path.resolve`, and
`path.parse().root`.
Found: `path.normalize("/")` returns `"/"`, not `""`, and it is the platform's
own answer to exactly this. But it also resolves `.` and `..` and separators
differently per platform, and **these are provider-supplied mount strings, not
filesystem paths we are opening** — normalising away a `..` in a mount name would
be inventing a path that does not exist. So `path` is the wrong tool: right
answer, wrong problem.

## Rung 4 — ecosystem

Searched: how path-comparison bugs of this shape are usually avoided — the
"canonicalise both sides" rule in filesystem comparison, `os.platform()`-gated
path handling, and mount-point normalisation in Linux/macOS tooling.
Found: **the consensus is that comparison keys are canonicalised once, at the
boundary, and both sides go through the same function** — the bug here is not
the regex, it is having a normaliser that only one side calls. Nothing in the
ecosystem solves "join two providers' spellings of the same thing" beyond that,
because there is no portable way to know whether `C:` and `/` mean comparable
things beyond normalising each the same way.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Make `drivesFrom` call `pathOf` too | fixes the join | two call sites to keep in step | drifts again the moment a third is added | **rejected** — fixes this join, not the class |
| `pathOf` returns `/` for the empty result | fixes the root volume | one branch | still two spellings, one of which is a special case | partial; a special case is where the next bug lives |
| **Compare through one shared normaliser, both sides** | fixes the class | a function both callers use | none — a normaliser is total | **chosen** |

## Rung 6 — probe

Read the code and traced both sides. `drivesFrom` pushes `volume.mount`; the
join compares it to `pathOf(entry)`, which prefers `fs` over `mount` and strips
a trailing slash. **`fs` and `mount` are not the same field**, so the two sides
were reading different properties before the regex ever ran — the normalisation
mismatch was the second defect, not the only one.

## Decision

**One normaliser, used by both sides of the join.** A mount path is compared as
a normalised value everywhere in this module, and the normaliser maps the root
to itself rather than to the empty string. The correctness test is the one the
Windows suite could never give: a volume at `/` on a device that also holds
`/data` must appear in `volumesOf` for that device, on a POSIX host.

The cost of being wrong: a mount string that genuinely differs only by a
trailing slash stops comparing equal — which is the case the original strip was
written for, and the one the new normaliser keeps.
