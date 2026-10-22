import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readVideoFacts, VIDEO_LIMITS, videoRefusals } from "./video-envelope";

const fixture = (name: string): Uint8Array =>
  new Uint8Array(
    readFileSync(
      fileURLToPath(new URL(`../test-fixtures/${name}`, import.meta.url)),
    ),
  );

const conforming = fixture("conforming.mp4");
const long = fixture("long.mp4");
const wide = fixture("wide.mp4");
const odd = fixture("odd.mp4");
const audio = fixture("audio.mp4");
const noFaststart = fixture("nofaststart.mp4");
const vfr = fixture("vfr.mp4");
const chroma422 = fixture("chroma422.mp4");
const webm = fixture("other.webm");
const truncated = fixture("truncated.mp4");

const PATH = "assets/bg.mp4";

describe("readVideoFacts", () => {
  it("reads duration, dimensions, cadence and faststart from a conforming file", () => {
    const facts = readVideoFacts(conforming);
    expect(facts).toEqual({
      width: 320,
      height: 180,
      durationMs: 2_000,
      frameRate: 30,
      constantFrameRate: true,
      codec: "avc1",
      profile: 100,
      chromaFormat: 1,
      hasAudio: false,
      faststart: true,
    });
    expect(videoRefusals(PATH, facts!)).toEqual([]);
  });

  it("sees an audio track", () => {
    const facts = readVideoFacts(audio);
    expect(facts?.hasAudio).toBe(true);
    expect(facts?.width).toBe(320);
    expect(facts?.height).toBe(180);
  });

  it("sees moov after mdat", () => {
    expect(readVideoFacts(noFaststart)?.faststart).toBe(false);
    expect(readVideoFacts(conforming)?.faststart).toBe(true);
  });

  it("reads a 4:2:2 chroma format from the SPS", () => {
    expect(readVideoFacts(chroma422)?.chromaFormat).toBe(2);
    expect(readVideoFacts(chroma422)?.profile).toBe(122);
  });

  it("marks a variable cadence as not constant, and averages its rate", () => {
    const facts = readVideoFacts(vfr);
    expect(facts?.constantFrameRate).toBe(false);
    expect(facts?.frameRate).toBe(20);
  });

  it("returns undefined for a WebM", () => {
    expect(readVideoFacts(webm)).toBeUndefined();
  });

  it("returns undefined for a truncated MP4", () => {
    expect(readVideoFacts(truncated)).toBeUndefined();
  });

  it("returns undefined for hostile bytes rather than throwing", () => {
    expect(readVideoFacts(new Uint8Array(0))).toBeUndefined();
    expect(readVideoFacts(new Uint8Array(4096))).toBeUndefined();
    // A box whose declared size runs past the buffer.
    const lying = new Uint8Array([
      0xff, 0xff, 0xff, 0xff, 0x6d, 0x6f, 0x6f, 0x76,
    ]);
    expect(readVideoFacts(lying)).toBeUndefined();
    // A top-level box that claims to be everything, with nothing inside.
    const empty = new Uint8Array(8);
    empty.set([0x6d, 0x6f, 0x6f, 0x76], 4);
    expect(readVideoFacts(empty)).toBeUndefined();
  });
});

describe("videoRefusals", () => {
  it("names the file and the duration bound", () => {
    const facts = readVideoFacts(long)!;
    expect(facts.durationMs).toBe(31_500);
    expect(videoRefusals(PATH, facts)).toEqual([
      `${PATH}: duration 31500 ms exceeds the 30000 ms maximum`,
    ]);
  });

  it("names the file and the long-edge bound", () => {
    const facts = readVideoFacts(wide)!;
    expect(facts.width).toBe(2048);
    expect(videoRefusals(PATH, facts)).toEqual([
      `${PATH}: long edge 2048 px exceeds the 1920 px maximum`,
    ]);
  });

  it("refuses odd dimensions, and says so in the fixed order", () => {
    const facts = readVideoFacts(odd)!;
    expect(facts.width).toBe(641);
    expect(facts.height).toBe(360);
    expect(videoRefusals(PATH, facts)).toEqual([
      `${PATH}: H.264 profile 244; High (100) is required`,
      `${PATH}: chroma format 3; 4:2:0 is required`,
      `${PATH}: odd dimensions 641x360; even width and height are required`,
    ]);
  });

  it("refuses a 4:2:2 file with the chroma sentence", () => {
    const facts = readVideoFacts(chroma422)!;
    const refusals = videoRefusals(PATH, facts);
    expect(refusals).toContain(`${PATH}: chroma format 2; 4:2:0 is required`);
  });

  it("refuses an audio-bearing file", () => {
    expect(videoRefusals(PATH, readVideoFacts(audio)!)).toEqual([
      `${PATH}: audio track present; video must be silent`,
    ]);
  });

  it("refuses a file without +faststart", () => {
    expect(videoRefusals(PATH, readVideoFacts(noFaststart)!)).toEqual([
      `${PATH}: moov comes after mdat; +faststart is required`,
    ]);
  });

  it("refuses a variable cadence with the frame-rate sentence", () => {
    expect(videoRefusals(PATH, readVideoFacts(vfr)!)).toEqual([
      `${PATH}: variable frame rate; a constant frame rate is required`,
    ]);
  });

  it("refuses a measured rate above the cap", () => {
    const facts = { ...readVideoFacts(conforming)!, frameRate: 60 };
    expect(videoRefusals(PATH, facts)).toEqual([
      `${PATH}: frame rate 60 fps exceeds the 30 fps maximum`,
    ]);
  });

  it("lists every breach in one fixed order", () => {
    const facts = readVideoFacts(odd)!;
    expect(videoRefusals(PATH, { ...facts, hasAudio: true })).toEqual([
      `${PATH}: H.264 profile 244; High (100) is required`,
      `${PATH}: chroma format 3; 4:2:0 is required`,
      `${PATH}: odd dimensions 641x360; even width and height are required`,
      `${PATH}: audio track present; video must be silent`,
    ]);
  });

  it("publishes the envelope bounds", () => {
    expect(VIDEO_LIMITS).toEqual({
      maxDurationMs: 30_000,
      maxLongEdge: 1920,
      maxFrameRate: 30,
    });
  });
});
