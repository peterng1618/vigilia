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

if (lines.length > 70) {
  fail(`keep the handoff at 70 lines or fewer (found ${lines.length})`);
}

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

if (bulletCount("## Last completed change") > 5) {
  fail("Last completed change is limited to 5 bullets");
}
if (bulletCount("## Next") > 5) {
  fail("Next is limited to 5 items");
}
if (bulletCount("## Blockers / unverified") > 5) {
  fail("Blockers / unverified is limited to 5 bullets");
}

if (process.exitCode) process.exit(process.exitCode);
