# Theme Store — Media Caps and the Normalizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a video's cost predictable to the store — a property check that refuses out-of-envelope media at every door a theme passes through, and an author-facing normalizer that re-encodes a source into that envelope without degrading an input already inside it.

**Architecture:** The **check** is a pure container parse in `theme-package` and needs no encoder: it reads an MP4's boxes into facts and compares them to the spec's envelope. The **normalizer** is a host command that spawns the bundled `ffmpeg` (decision `0091`), refuses a source it cannot fit rather than silently trimming it, and copies an already-conforming input byte-for-byte. The editor reaches it through one loopback route and replaces an asset's bytes only when the author presses the control.

**Tech Stack:** TypeScript, Vitest, `fflate` (present), `ffmpeg-static` (new, GPL-3.0-or-later), React 19 + Base UI (present), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-theme-store-design.md`, § "Media: two of three caps exist" and § "The publish-time normalizer"; landing-order row **F**.

## Global Constraints

- **The envelope, verbatim from the spec:** MP4 with `+faststart`; H.264 High, `yuv420p`; even width and height; constant frame rate ≤ 30fps; no audio track; single-pass CRF 20–23. Caps: **duration ≤ 30 seconds**, **1920 on the long edge**.
- **Verify by probe; never re-encode to validate.** The check reads the file. Nothing in the validation path spawns ffmpeg.
- **Idempotent pass-through:** a file already inside the envelope is returned byte-for-byte.
- **Refuse, never coerce:** a source over 30 s is refused, not truncated; an unreadable video is refused, not passed.
- Every refusal is a sentence naming the file and the bound, with no raw process output in it.
- New shipped dependency: `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md` update in the **same** task that adds it (decision `0091`).
- Loopback only, with the existing `isForeignOrigin` origin + loopback-`Host` guard on the new route.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on.
- 500 lines is a signal and 800 is a stop for normal source files.

## Review Focus

1. **A video the parser cannot read** — a WebM, a truncated MP4, an MP4 with `moov` after `mdat`, a fragmented MP4. Each must refuse with a sentence, never throw and never pass.
2. **A file exactly at a bound** — 30.0 s and 1920 px pass; 30.001 s and 1922 px refuse. Off-by-one on a cap is the bug a cap exists to prevent.
3. **A normalizer run on an input already inside the envelope** — must be a byte-for-byte copy, not a re-encode. A re-encode here degrades every resubmission.
4. **An ffmpeg that is missing or fails** — the author gets a sentence naming the cause, not a stack trace or an empty file.
5. **A source with an odd source dimension** — the normalizer's scale must land on even numbers, or the output fails its own check.

---

## Phase 1 — the check

### Task 1: The encoder is bundled, and its licence is recorded

**Files:**
- Modify: `src/web/packages/host/package.json` (add `ffmpeg-static`)
- Modify: `THIRD-PARTY-NOTICES.md`, `docs/engineering/dependencies.md`
- Test: none — this task adds no logic; its evidence is a run.

**Interfaces:**
- Produces: the module path `ffmpeg-static` resolves to (a string path to a binary), consumed by Task 4.

- [ ] **Step 1:** Add `ffmpeg-static@5.3.0` to `host`'s `dependencies`; run `npm install` from `src/web/`. Do not hand-edit `package-lock.json`.
- [ ] **Step 2:** Verify the binary exists and runs: resolve the module's default export and run it with `-version` through `execFile`; record the version banner line and the resolved path in the task report.

  **If the postinstall download is refused in this environment**, that is a finding to report, not to work around: `ffmpeg-static` fetches its platform build at install time, and an install that cannot fetch is a fact about the dependency, not about the code.

- [ ] **Step 3:** Add one row to `THIRD-PARTY-NOTICES.md`'s runtime table and one to `docs/engineering/dependencies.md`'s declared table: `ffmpeg-static 5.3.0 | GPL-3.0-or-later | re-encodes theme video | its source is offered at https://github.com/eugeneware/ffmpeg-static` — match the existing row format rather than inventing a column.
- [ ] **Step 4:** Commit.

### Task 2: A video's facts, read from its boxes

**Files:**
- Create: `src/web/packages/theme-package/src/video-envelope.ts`
- Test: `src/web/packages/theme-package/src/video-envelope.test.ts`
- Create fixtures under `src/web/packages/theme-package/test-fixtures/` (small MP4s, generated once with the binary from Task 1 and committed)

**Interfaces:**
- Produces (consumed by Tasks 3 and 4):

```ts
export interface VideoLimits {
  readonly maxDurationMs: number;   // 30_000
  readonly maxLongEdge: number;     // 1920
  readonly maxFrameRate: number;    // 30
}
export const VIDEO_LIMITS: VideoLimits;

export interface VideoFacts {
  readonly width: number;
  readonly height: number;
  readonly durationMs: number;
  readonly frameRate: number;          // measured; a variable cadence is not reported as one number
  readonly constantFrameRate: boolean;
  readonly codec: string | undefined;  // sample entry fourcc, e.g. "avc1"
  readonly profile: number | undefined;// avcC profile_idc
  readonly chromaFormat: number | undefined; // SPS chroma_format_idc; 0 is 4:2:0
  readonly hasAudio: boolean;
  readonly faststart: boolean;         // `moov` before the first `mdat`
}
/** `undefined` means the bytes are not an MP4 this parser can read. */
export function readVideoFacts(bytes: Uint8Array): VideoFacts | undefined;
/** Every way `facts` breaks the envelope, as sentences, in a fixed order. Empty means conforming. */
export function videoRefusals(path: string, facts: VideoFacts): string[];
```

- [ ] **Step 1: Generate the fixtures** with the Task-1 binary — one conforming file and one file per refusal: over 30 s, a 2048-wide file, an odd-dimension file (e.g. 641×360), an audio-bearing file, a file without `+faststart`, a variable-frame-rate file, a 4:2:2 file (`-pix_fmt yuv422p`), and a WebM. Keep each file under 200 KB (tiny dimensions, high CRF) so the repository stays small; record each fixture's generating command in a comment file beside them.
- [ ] **Step 2: Write the failing test** — one assertion per fact and one per refusal, over the fixtures, e.g.:

```ts
it("reads duration, dimensions and faststart from a conforming file", () => {
  const facts = readVideoFacts(conforming);
  expect(facts?.width).toBe(320);
  expect(facts?.height).toBe(180);
  expect(facts?.faststart).toBe(true);
  expect(videoRefusals("assets/bg.mp4", facts!)).toEqual([]);
});
```

plus: a WebM and a truncated MP4 return `undefined`; a 4:2:2 file refuses with the chroma sentence; a variable-cadence file refuses with the frame-rate sentence.

- [ ] **Step 3: Run it, confirm it fails.**
- [ ] **Step 4: Implement the parser** — walk boxes with a bounds-checked reader (`ftyp`, `moov`, `mdat`, `trak/mdia/hdlr`, `mdhd`, `stbl/stsd`→`avc1`→`avcC`, `stts`, `tkhd`); parse the SPS inside `avcC` for `chroma_format_idc` with a bounded exp-Golomb reader. Every read is bounds-checked and every loop has a box count or byte budget, so a crafted file cannot hang or throw. A `stts` with more than one entry, or one whose deltas differ, is not a constant frame rate.
- [ ] **Step 5: Run the tests; they pass.** Then run the same assertions over a **live** re-encode from Task 4 when it lands (the plan records this as the cross-check; do not block Task 2 on it).
- [ ] **Step 6: Commit.**

### Task 3: The caps refuse at all three doors

**Files:**
- Modify: `src/web/packages/host/src/themes/validate-item.ts`
- Modify: `src/web/packages/host/src/themes/install.ts`
- Modify: `src/web/packages/host/src/themes/github-item.ts`
- Test: each file's existing test file

**Interfaces:**
- Consumes: `readVideoFacts`, `videoRefusals` from Task 2.
- Produces: no new exported symbol — each door refuses with its own existing shape.

- [ ] **Step 1: Write the failing tests** — one per door:
  - `validate-item` on a catalogue directory whose package carries a 31-second video exits 1 with `Refused catalogue/<id>: <the duration sentence>`;
  - `installCatalogueItem` on the same package returns `{ ok: false }` naming it, and **writes nothing to the library** (assert the library is unchanged);
  - `submissionFiles` refuses before any network call.
- [ ] **Step 2: Run them, confirm they fail.**
- [ ] **Step 3: Implement** — in each door, after the package has been read and its envelope validated, run the check over every `assets` entry whose declared kind is `video`, and refuse on the first sentence. One shared helper in `theme-package` does the iteration:

```ts
export function themeVideoRefusals(
  envelope: FabricThemeEnvelope,
  assets: Readonly<Record<string, Uint8Array>>,
): string[];
```

- [ ] **Step 4: Run the tests and the affected package suites; they pass.**
- [ ] **Step 5: Commit.**

## Phase 2 — the normalizer

### Task 4: Re-encode into the envelope, or copy it untouched

**Files:**
- Create: `src/web/packages/host/src/themes/normalize-video.ts`
- Test: `src/web/packages/host/src/themes/normalize-video.test.ts`
- Modify: `src/web/packages/host/src/main.ts` (a `normalize-video` command, following `validate-item`'s shape)
- Modify: `src/web/packages/host/src/server.ts` (one route)

**Interfaces:**
- Consumes: `readVideoFacts`, `videoRefusals`, `VIDEO_LIMITS`.
- Produces:

```ts
export type NormalizeResult =
  | { readonly ok: true; readonly bytes: Uint8Array; readonly reencoded: boolean }
  | { readonly ok: false; readonly message: string };

export function normalizeVideo(
  bytes: Uint8Array,
  options?: {
    readonly fit?: "cover" | "contain";      // default "contain"
    readonly ffmpegPath?: string;            // default: the `ffmpeg-static` module
    readonly run?: (args: readonly string[]) => Promise<{ code: number; stderr: string }>;
  },
): Promise<NormalizeResult>;
```

and the route `POST /api/themes/normalize-video`, body `{ bytesBase64, fit? }`, answering `{ ok: true, bytesBase64, reencoded }` or `{ ok: false, message }`.

- [ ] **Step 1: Write the failing tests** with an injected `run`:
  - an already-conforming input returns `reencoded: false` **and the same bytes** (identity, not equality of length);
  - a 31-second input refuses and does not spawn (`run` is never called);
  - an out-of-envelope input spawns once, and the returned bytes are what `run` produced (stub);
  - `run` answering non-zero refuses with a sentence that **does not contain the raw stderr**;
  - no `ffmpegPath` and no module → a sentence naming the missing encoder.
- [ ] **Step 2: Run, confirm they fail.**
- [ ] **Step 3: Implement** — command building: `-hide_banner -nostdin -y -i <tmp in> -an -vf <scale filter> -r 30 -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 22 -movflags +faststart -f mp4 <tmp out>`. The scale filter caps the long edge at 1920 and rounds to even: `contain` → `scale=w:h:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=…`; `cover` → `scale=…:increase:force_divisible_by=2,crop=…`. Temp files go under `os.tmpdir()`, never a literal `/tmp`.
- [ ] **Step 4: Prove it end to end** with the real binary: normalize a fixture out of envelope (a 2048-wide file), then feed the **output** back through `readVideoFacts` and assert `videoRefusals` is empty. Record both the input and output facts in the report — this is the only proof the encoder and the parser agree.
- [ ] **Step 5:** Add the route, guarded exactly as the install route is; the body cap is the existing upload cap. Test: a foreign origin is refused, and an oversized body is refused.
- [ ] **Step 6: Run the host suite; commit.**

### Task 5: The author presses normalize and sees the result

**Files:**
- Modify: `src/web/packages/editor/src/panes/add/file-section.tsx`
- Modify: `src/web/packages/editor/src/asset-manager/index.ts` (a `replace` path that takes bytes it did not read from a file)
- Modify: `src/web/packages/editor/src/store-mode/ui-copy.ts` (or the pane's existing copy owner if that is where pane copy lives — do not create a second owner)
- Test: `src/web/packages/editor/src/panes/add/file-section.dom.test.tsx` (existing or created), `src/web/tests/e2e/editor-rail.spec.ts`
- Modify: `docs/evidence/screenshots/README.md` (register the capture **before** taking it)

**Interfaces:**
- Consumes: the route from Task 4.

- [ ] **Step 1: Write the failing DOM test** — for a declared **video** asset only, a `Normalize` control exists; pressing it posts the asset's bytes, and on `{ ok: true }` the asset's bytes are replaced with the answer; on `{ ok: false }` the host's sentence is shown beside the control and the asset is unchanged.
- [ ] **Step 2: Run it, confirm it fails.**
- [ ] **Step 3: Implement** the control in the row's existing action group, using the pane's existing busy/refused shape. Copy: `Normalize video`, `Normalizing…`, and `Use the normalized copy` as the press that replaces. **Never replace without that press** — the master stays until the author says otherwise.
- [ ] **Step 4: Run the DOM tests; they pass.**
- [ ] **Step 5: Browser claim** — build (`npm run build`), then one Playwright claim in `tests/e2e/editor-rail.spec.ts` with `/api/themes/normalize-video` routed to a stubbed answer: the control appears for a video asset, the press shows the refusal sentence, and the press with a good answer replaces and the preview re-renders. Register the capture row in `docs/evidence/screenshots/README.md`, then take it with `VIGILIA_CAPTURE=1 --workers=1` and **look at it**.
- [ ] **Step 6: Run the gate components individually**, write the exit codes into the report, commit.

---

## Acceptance

- A package carrying a 31-second or 2048-wide video is refused by `validate-item`, by install, and before a submission opens a pull request.
- The normalizer's output passes its own check on a real re-encode.
- An already-conforming input is copied byte-for-byte.
- The two licence records name `ffmpeg-static` as `GPL-3.0-or-later`.
