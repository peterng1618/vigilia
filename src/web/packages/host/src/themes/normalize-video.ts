import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  readVideoFacts,
  VIDEO_LIMITS,
  type VideoFacts,
  videoRefusals,
} from "@vigilia/theme-package";
import ffmpegStatic from "ffmpeg-static";

/**
 * Brings a source video inside the publish envelope, or copies it untouched.
 *
 * A conforming file is returned as the same bytes object: re-encoding an asset
 * that already passes would degrade it a little on every resubmission. A file
 * longer than the envelope is refused rather than truncated, because a cut
 * background loop is not the one the author made.
 */

const USAGE = "usage: vigilia normalize-video <input.mp4> <output.mp4>";
/** ffmpeg's own progress output goes to stderr; a hang or a runaway log must
 *  not outgrow the child-process buffer. */
const MAX_STDERR_BYTES = 4 * 1024 * 1024;

type Run = (
  args: readonly string[],
) => Promise<{ code: number; stderr: string }>;

export type NormalizeResult =
  | {
      readonly ok: true;
      readonly bytes: Uint8Array;
      readonly reencoded: boolean;
    }
  | { readonly ok: false; readonly message: string };

/** The framing shape `cover` crops to, e.g. 16:9. */
export interface NormalizeAspect {
  readonly width: number;
  readonly height: number;
}

export async function normalizeVideo(
  bytes: Uint8Array,
  options: {
    readonly fit?: "cover" | "contain";
    readonly aspect?: NormalizeAspect;
    readonly ffmpegPath?: string;
    readonly run?: Run;
  } = {},
): Promise<NormalizeResult> {
  const facts = readVideoFacts(bytes);
  if (facts === undefined)
    return {
      ok: false,
      message: "That video cannot be read; an H.264 MP4 is required.",
    };
  if (videoRefusals("video", facts).length === 0)
    return { ok: true, bytes, reencoded: false };
  // Refused before the encoder is even resolved: a 31-second loop is not made
  // conforming by re-encoding it, and trimming it would discard the author's
  // footage silently.
  if (facts.durationMs > VIDEO_LIMITS.maxDurationMs)
    return {
      ok: false,
      message:
        `That video is ${facts.durationMs} ms long; the maximum is ` +
        `${VIDEO_LIMITS.maxDurationMs} ms. Trim it and try again.`,
    };

  const fit = options.fit ?? "contain";
  if (fit === "cover" && !validAspect(options.aspect))
    return {
      ok: false,
      message:
        "cover needs an aspect (a positive width and height) to crop to; " +
        "contain preserves the source aspect.",
    };

  const executable = options.ffmpegPath ?? ffmpegStatic;
  if (executable === null)
    return {
      ok: false,
      message:
        "No ffmpeg encoder is available on this host, so the video cannot be re-encoded.",
    };
  const run = options.run ?? encoderRun(executable);

  // A directory per run, under the OS temp root: two normalizations at once
  // cannot overwrite each other's files, and nothing is left behind either way.
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilia-normalize-"));
  try {
    const input = path.join(directory, "in.mp4");
    const output = path.join(directory, "out.mp4");
    await writeFile(input, bytes);
    const outcome = await run(
      ffmpegArgs(input, output, facts, fit, options.aspect),
    );
    // The child's stderr can carry paths and encoder internals; the sentence
    // names the failure without echoing them.
    if (outcome.code !== 0)
      return {
        ok: false,
        message: `That video could not be re-encoded; ffmpeg exited with code ${outcome.code}.`,
      };
    return {
      ok: true,
      bytes: new Uint8Array(await readFile(output)),
      reencoded: true,
    };
  } catch {
    return { ok: false, message: "That video could not be re-encoded." };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function ffmpegArgs(
  input: string,
  output: string,
  facts: VideoFacts,
  fit: "cover" | "contain",
  aspect?: NormalizeAspect,
): string[] {
  return [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    input,
    "-an",
    "-vf",
    scaleFilter(facts, fit, aspect),
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "22",
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
    output,
  ];
}

/**
 * The capped, even box a re-encode lands in.
 *
 * `contain` derives the box from the source, so the whole frame survives and
 * only the long edge is capped. `cover` derives it from the requested aspect,
 * fills it and crops the centre: the one mode that changes framing. Both stay
 * off the live artboard, because a bake to today's shape is wrong after the
 * next artboard edit (spec, "four rules").
 */
function scaleFilter(
  facts: VideoFacts,
  fit: "cover" | "contain",
  aspect: NormalizeAspect | undefined,
): string {
  const box =
    fit === "cover" && validAspect(aspect)
      ? boxForAspect(aspect)
      : boxForSource(facts.width, facts.height);
  return fit === "cover"
    ? `scale=${box.width}:${box.height}:force_original_aspect_ratio=increase:force_divisible_by=2,crop=${box.width}:${box.height}`
    : `scale=${box.width}:${box.height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${box.width}:${box.height}:(ow-iw)/2:(oh-ih)/2:color=black`;
}

/** The source box, capped at the long edge and never upscaled. */
function boxForSource(
  width: number,
  height: number,
): { readonly width: number; readonly height: number } {
  const longEdge = Math.max(width, height);
  const factor =
    longEdge > VIDEO_LIMITS.maxLongEdge
      ? VIDEO_LIMITS.maxLongEdge / longEdge
      : 1;
  return {
    width: evenAtMost(width * factor),
    height: evenAtMost(height * factor),
  };
}

/** The requested ratio, always mapped to the full long edge: a cover box is a
 *  framing, so it is the same wherever the source started. */
function boxForAspect(aspect: NormalizeAspect): {
  readonly width: number;
  readonly height: number;
} {
  const factor =
    VIDEO_LIMITS.maxLongEdge / Math.max(aspect.width, aspect.height);
  return {
    width: evenAtMost(aspect.width * factor),
    height: evenAtMost(aspect.height * factor),
  };
}

function validAspect(
  aspect: NormalizeAspect | undefined,
): aspect is NormalizeAspect {
  return (
    aspect !== undefined &&
    Number.isFinite(aspect.width) &&
    Number.isFinite(aspect.height) &&
    aspect.width > 0 &&
    aspect.height > 0
  );
}

function evenAtMost(value: number): number {
  return Math.max(2, Math.floor(value / 2) * 2);
}

function encoderRun(executable: string): Run {
  return (args) =>
    new Promise((resolve) => {
      execFile(
        executable,
        [...args],
        { windowsHide: true, maxBuffer: MAX_STDERR_BYTES },
        (error, _stdout, stderr) => {
          if (error === null) {
            resolve({ code: 0, stderr: "" });
            return;
          }
          // `error.code` is a number for a non-zero exit and a string (ENOENT,
          // EACCES) for a spawn failure; both are a failure here.
          const code = (error as { code?: unknown }).code;
          resolve({
            code: typeof code === "number" ? code : 1,
            stderr: typeof stderr === "string" ? stderr : "",
          });
        },
      );
    });
}

/** `undefined` for every command line that is not this one, so `run` falls
 *  through to its own parser untouched. */
export async function normalizeVideoCommand(
  argv: readonly string[],
): Promise<number | undefined> {
  if (argv[0] !== "normalize-video") return undefined;

  const input = argv[1];
  const output = argv[2];
  if (input === undefined || output === undefined || argv.length > 3) {
    console.error(
      `normalize-video needs <input.mp4> and <output.mp4>.\n${USAGE}`,
    );
    return 1;
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(input));
  } catch (error) {
    console.error(`Cannot read ${input}: ${messageOf(error)}`);
    return 1;
  }

  const normalized = await normalizeVideo(bytes);
  if (!normalized.ok) {
    console.error(normalized.message);
    return 1;
  }
  try {
    await writeFile(output, normalized.bytes);
  } catch (error) {
    console.error(`Cannot write ${output}: ${messageOf(error)}`);
    return 1;
  }
  console.log(
    `${output}: ${normalized.reencoded ? "re-encoded" : "already conforms"}`,
  );
  return 0;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
