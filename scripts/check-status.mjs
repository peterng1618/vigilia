#!/usr/bin/env node

/**
 * Keeps the handoff short without demanding a rewrite pass to do it.
 *
 * The limit is bullet count plus one-item-per-line, not line count. A line cap
 * was being gamed: each pass kept every fact and only re-wrapped the prose, so
 * the file accreted into a diary while every edit spent tokens compressing it.
 * Bullets bound how much there is to say; the one-line rule bounds each item,
 * and forces the choice of what to drop at the moment of writing.
 *
 * `node scripts/check-status.mjs --self-test` proves every rule still refuses.
 * Both scripts in this directory shipped a version that silently passed
 * everything, so a rule that cannot fail is treated as a defect.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const REQUIRED = [
  "## Current objective",
  "## Active work",
  "## Next",
  "## Blockers / unverified",
];

// "Last completed change" was dropped on 2026-10-01: it was a hand-maintained
// duplicate of `git log`, charged to every commit and gone stale silently. "Next"
// stays, but as backlog row ids — priority is a decision, and a decision belongs
// in a handoff rather than in a registry row.
const LIMITS = [
  ["## Active work", 6],
  ["## Next", 5],
  ["## Blockers / unverified", 5],
];

const isBullet = (line) => /^\s*(?:[-*]|\d+\.)\s+/.test(line);

function check(text) {
  const errors = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  const section = (heading) => {
    const start = lines.indexOf(heading) + 1;
    const next = lines.findIndex((line, index) => index >= start && line.startsWith("## "));
    return lines.slice(start, next === -1 ? lines.length : next);
  };

  const headings = lines.filter((line) => line.startsWith("## "));
  for (const heading of REQUIRED) {
    if (headings.filter((value) => value === heading).length !== 1) {
      errors.push(`required heading must appear exactly once: ${heading}`);
    }
  }
  for (const heading of headings) {
    if (!REQUIRED.includes(heading)) {
      errors.push(`unexpected section "${heading}"; do not turn STATUS.md into a diary`);
    }
  }

  for (const [heading, max] of LIMITS) {
    const count = section(heading).filter(isBullet).length;
    if (count > max) {
      errors.push(
        `${heading} is limited to ${max} bullets (found ${count}); drop the oldest or least actionable`,
      );
    }
    // A wrapped bullet's continuation line is indented and is not itself a
    // bullet. The first version required a marker here and so never fired.
    const wrapped = section(heading).filter((line) => /^\s+\S/.test(line) && !isBullet(line));
    if (wrapped.length > 0) {
      errors.push(`${heading} has ${wrapped.length} wrapped line(s); keep one item per line`);
    }
  }
  return errors;
}

const SELF_TEST = process.argv.includes("--self-test");

if (SELF_TEST) {
  const good = [
    "# Vigilia status",
    "## Current objective",
    "One line.",
    "## Active work",
    "- a",
    "- b",
    "## Next",
    "1. d",
    "## Blockers / unverified",
    "- e",
    "",
  ].join("\n");
  // Many bullets, none over its section's limit: length alone must not fail.
  const longButLegal = [
    "# Vigilia status",
    "## Current objective",
    "One line.",
    "## Active work",
    ...Array.from({ length: 6 }, (_, i) => `- active ${i}`),
    "## Next",
    ...Array.from({ length: 5 }, (_, i) => `${i + 1}. step ${i}`),
    "## Blockers / unverified",
    ...Array.from({ length: 5 }, (_, i) => `- blocker ${i}`),
    "",
  ].join("\n");
  // The same shape with one section over its limit must fail.
  const longAndIllegal = longButLegal.replace(
    "## Blockers / unverified",
    `${Array.from({ length: 30 }, (_, i) => `- blocker ${i}`).join("\n")}\n## Blockers / unverified`,
  );

  const cases = [
    ["accepts a conforming file", good, 0],
    ["rejects a missing heading", good.replace("## Next", "## Later"), 1],
    ["rejects an unexpected section", good.replace("## Next", "## Diary"), 1],
    ["rejects too many bullets", good.replace("- e", "- e\n- f\n- g\n- h\n- i\n- j"), 1],
    ["rejects a wrapped bullet", good.replace("- e", "- e\n  continued here"), 1],
    ["accepts a long file within the bullet limits", longButLegal, 0],
    ["rejects a long file over a bullet limit", longAndIllegal, 1],
  ];
  let failed = 0;
  for (const [name, input, expected] of cases) {
    const found = check(input);
    const ok = (found.length > 0) === (expected > 0);
    if (!ok) failed += 1;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` (expected ${expected ? "a failure" : "success"}, got ${found.length} error(s))`}`,
    );
  }
  if (failed > 0) {
    console.error(`check-status self-test: ${failed} case(s) wrong`);
    process.exit(1);
  }
  console.log("check-status self-test: all cases behave");
  process.exit(0);
}

const root = resolve(import.meta.dirname, "..");
const text = await readFile(resolve(root, "STATUS.md"), "utf8");
const errors = check(text);
for (const error of errors) console.error(`STATUS.md: ${error}`);
if (errors.length > 0) process.exit(1);
