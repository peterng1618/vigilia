#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const path = resolve(root, "STATUS.md");
const text = await readFile(path, "utf8");
const lines = text.replace(/\r\n/g, "\n").split("\n");

const required = [
  "## Current objective",
  "## Active work",
  "## Last completed change",
  "## Next",
  "## Blockers / unverified",
];

const fail = (message) => {
  console.error(`STATUS.md: ${message}`);
  process.exitCode = 1;
};

const headings = lines.filter((line) => line.startsWith("## "));
for (const heading of required) {
  if (headings.filter((value) => value === heading).length !== 1) {
    fail(`required heading must appear exactly once: ${heading}`);
  }
}

for (const heading of headings) {
  if (!required.includes(heading)) {
    fail(`unexpected section "${heading}"; do not turn STATUS.md into a diary`);
  }
}

const section = (heading) => {
  const start = lines.indexOf(heading) + 1;
  const next = lines.findIndex(
    (line, index) => index >= start && line.startsWith("## "),
  );
  return lines.slice(start, next === -1 ? lines.length : next);
};

const bulletCount = (heading) =>
  section(heading).filter((line) => /^\s*(?:[-*]|\d+\.)\s+/.test(line)).length;

/**
 * The limit is bullet count, not line count. A line cap was being gamed: each
 * pass preserved every fact and only re-wrapped the prose, so the file read
 * like a diary and every edit wasted tokens compressing it. Bullet count bounds
 * how much there is to say; the single-line rule bounds how long each item may
 * be, and pushes the work of choosing what to drop to the point of writing.
 */
const LIMITS = [
  ["## Active work", 6],
  ["## Last completed change", 5],
  ["## Next", 5],
  ["## Blockers / unverified", 5],
];

for (const [heading, max] of LIMITS) {
  const count = bulletCount(heading);
  if (count > max) {
    fail(`${heading} is limited to ${max} bullets (found ${count}); drop the oldest or least actionable`);
  }
}

/**
 * A wrapped bullet's continuation line is indented but does not itself start
 * with a marker, so the test is "indented and not a bullet" — not "indented and
 * a bullet". The first version required a marker and therefore never fired.
 */
const isBullet = (line) => /^\s*(?:[-*]|\d+\.)\s+/.test(line);

for (const [heading] of LIMITS) {
  const wrapped = section(heading).filter(
    (line) => /^\s+\S/.test(line) && !isBullet(line),
  );
  if (wrapped.length > 0) {
    fail(`${heading} has ${wrapped.length} wrapped line(s); keep one item per line`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
