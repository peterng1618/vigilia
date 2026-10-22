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

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const REQUIRED = [
  "## Current objective",
  "## Active work",
  "## Last completed change",
  "## Next",
  "## Blockers / unverified",
];

const LIMITS = [
  ["## Active work", 6],
  ["## Last completed change", 5],
  ["## Next", 5],
  ["## Blockers / unverified", 5],
];

const isBullet = (line) => /^\s*(?:[-*]|\d+\.)\s+/.test(line);

// The active-plan bullet is machine-read by scripts/sdd-checkpoint.mjs (the
// compaction banner), which degrades silently to "names no active plan" when the
// form is not exact — once telling every resumed session its running plan was
// unowned (vg-378). Asserting the real file here, next to the bullet-limit check
// that already reads STATUS.md, removes the class rather than the instance.
const ACTIVE_PLAN = /^\s*[-*]\s*\*\*Active plan:\*\*\s*`([^`]+)`/m;

// `exists(path)` is injected so the rule is provable against a fixture rather
// than only against the live tree.
function checkActivePlan(text, exists) {
  const match = ACTIVE_PLAN.exec(text);
  if (!match) {
    return /active plan/i.test(text)
      ? [
          "no `- **Active plan:** `<path>`` marker; the compaction banner reads only that form",
        ]
      : [];
  }
  const path = match[1].trim();
  return exists(path)
    ? []
    : [`active plan \`${path}\` names no existing plan file or .superpowers/sdd ledger`];
}

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
    "# Yunari status",
    "## Current objective",
    "One line.",
    "## Active work",
    "- a",
    "- b",
    "## Last completed change",
    "- c",
    "## Next",
    "1. d",
    "## Blockers / unverified",
    "- e",
    "",
  ].join("\n");
  // Many bullets, none over its section's limit: length alone must not fail.
  const longButLegal = [
    "# Yunari status",
    "## Current objective",
    "One line.",
    "## Active work",
    ...Array.from({ length: 6 }, (_, i) => `- active ${i}`),
    "## Last completed change",
    ...Array.from({ length: 5 }, (_, i) => `- change ${i}`),
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
    ["rejects a wrapped bullet", good.replace("- c", "- c\n  continued here"), 1],
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
  // The active-plan rule, proven against fixtures through an injected `exists`.
  const markerCases = [
    ["accepts a marker naming an existing plan", "- **Active plan:** `x.md`", () => true, 0],
    ["rejects a reworded marker", "The active plan is [x](x.md).", () => true, 1],
    ["rejects a marker naming no plan", "- **Active plan:** `gone.md`", () => false, 1],
    ["accepts a file that names no plan", "No plans yet.", () => true, 0],
  ];
  for (const [name, input, exists, expected] of markerCases) {
    const found = checkActivePlan(input, exists);
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
const planExists = (path) => {
  const slug = path.split("/").pop().replace(/\.md$/, "");
  return (
    existsSync(resolve(root, path)) ||
    existsSync(resolve(root, "docs/superpowers/plans", `${slug}.md`)) ||
    existsSync(resolve(root, ".superpowers/sdd", slug, "progress.md"))
  );
};
errors.push(...checkActivePlan(text, planExists));
for (const error of errors) console.error(`STATUS.md: ${error}`);
if (errors.length > 0) process.exit(1);
