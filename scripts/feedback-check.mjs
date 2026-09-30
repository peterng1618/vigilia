#!/usr/bin/env node
/**
 * Feedback registry check.
 *
 * Two agents on 2026-09-30 reported fixes that were not fixes, and one was
 * reported *verified* having been tested on a neighbouring field — clamping
 * proven on a bounded field, reported as fixing an unbounded one. The registry
 * that would have caught it did not exist; this is it.
 *
 * The rule: **an item may only be `verified` with a check named alongside it,
 * and a check that mentions nothing from the item's own wording is a check of a
 * capability nearby rather than of the finding.** A commit sha is not a check.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const FILE = resolve(ROOT, "docs/product/feedback.md");

const STATES = ["open", "in progress", "unverified", "verified", "withdrawn"];

/** Words that carry no meaning for a two-way comparison. */
const NOISE =
  /^(that|this|with|from|then|than|them|they|their|there|here|what|when|which|while|only|also|just|like|does|should|could|would|have|been|into|over|each|some|more|most|very|much|make|made|really|thing|things|still|every|before|after|because|instead|another|same|used|using|were|being|does|being|than|about|into|after)$/;

function wordsOf(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !NOISE.test(w)),
  );
}

/**
 * Only the item tables, never the prose that documents them.
 *
 * The "states" table at the top of the file lists the state words as its own
 * first column, and a rule that read it would demand that the definition of
 * `open` be a valid item. Tables are delimited by a header whose first cell is
 * `#` or a state name; everything outside one is ignored.
 */
function rows(source) {
  const out = [];
  let inTable = false;
  for (const [i, raw] of source.split(/\r?\n/).entries()) {
    const text = raw.replace(/\r$/, "");
    if (/^\s*\|/.test(text)) {
      // `(?:#|item)\s*\|` rather than a `\b` after it: `#` is not a word
      // character, so `\b` never matches after one and every table read as empty.
      if (!inTable && /^\s*\|\s*(?:#|item)\s*\|/i.test(text)) inTable = true;
      if (!inTable) continue;
      // The header row opens the table; it is not itself an item.
      const isHeader = /^\s*\|\s*(?:#|item)\s*\|/i.test(text);
      if (isHeader || /^\s*\|[\s:|-]+\|\s*$/.test(text)) continue;
      out.push({ line: i + 1, text });
    } else if (text.trim() === "") {
      inTable = false;
    }
  }
  return out;
}

/** The rule, over any source. Returns the problems it finds. */
export function check(source) {
  const problems = [];
  for (const row of rows(source)) {
    const cells = row.text.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const [id, ...rest] = cells;
    const stateCell = rest.find((c) => STATES.includes(c.toLowerCase()));
    if (stateCell === undefined) {
      problems.push(`${id}: no state from [${STATES.join(", ")}]`);
      continue;
    }
    if (stateCell.toLowerCase() !== "verified") continue;

    const said = wordsOf(`${id} ${rest[0] ?? ""}`);
    if (said.size === 0) {
      problems.push(`${id}: verified, but the item has no wording of its own to check against`);
      continue;
    }
    const verification = rest[rest.indexOf(stateCell) + 1] ?? "";
    if (verification.trim() === "") {
      problems.push(`${id}: verified with no check named — name the test or the hand-check that ran`);
      continue;
    }
    const checked = wordsOf(verification);
    if ([...said].every((w) => !checked.has(w))) {
      problems.push(
        `${id}: verified, but the check names nothing from the item itself —\n` +
          `      item: ${[...said].slice(0, 8).join(", ")}\n` +
          `      check: ${[...checked].slice(0, 8).join(", ")}\n` +
          `      a check of a capability nearby is not a check of this finding`,
      );
      continue;
    }

    // Overlap on a shared verb is not enough. The mistake this exists to catch
    // shared "clamps" and "slider" between the item and a check performed on a
    // *different field*, so the check must name a **noun** the item names — the
    // thing inspected, not the property inspected. "the polygon sides field
    // clamps onto 32" overlaps U21 on verbs alone and is still the wrong check.
    const nouns = (text) =>
      [...wordsOf(text)].filter(
        (w) =>
          !/^(clamps|clamped|clamping|slides|shows|renders|reads|reads|gives|opens|works|holds|keeps|carries|named|lands|fails|prints|disappears|lists|asks|takes|makes|turns|draws|serves|reports)$/.test(w) &&
          // Generic container words name no specific thing. "the glass blur
          // field" and "the polygon sides field" share only `field`, and that
          // is precisely the pair this must reject.
          !/^(field|fields|control|controls|button|buttons|panel|panels|value|values|thing|item|items|one|thing|state)$/.test(w),
      );
    const saidNouns = new Set(nouns(`${id} ${rest[0] ?? ""}`));
    const checkedNouns = new Set(nouns(verification));
    if (saidNouns.size > 0 && [...saidNouns].every((w) => !checkedNouns.has(w))) {
      problems.push(
        `${id}: the check shares only a verb with the item — it names a different thing —\n` +
          `      item names: ${[...saidNouns].slice(0, 6).join(", ")}\n` +
          `      check names: ${[...checkedNouns].slice(0, 6).join(", ")}\n` +
          `      verifying a capability is not verifying this finding`,
      );
    }
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("feedback-check.mjs")) {
  const source = readFileSync(FILE, "utf8");
  const problems = check(source);

  if (process.argv.includes("--self-test")) {
    const table = (row) =>
      `\n# Fixture\n\n| # | in the user's words | state | check |\n|---|---|---|---|\n${row}\n`;
    const cases = [
      ["a valid registry passes", check(table(`| A | the circle reads stronger than the rect | verified | read the circle's glass beside the rect's glass |`)).length === 0],
      [
        "THE MISTAKE: clamping proven on one field, claimed for another",
        check(
          table(
            `| A | the glass blur field clamps and has a slider | verified | the polygon sides field clamps onto 32 | \`4fd582c\` |`,
          ),
        ).length > 0,
      ],
      ["verified with no check fails", check(table(`| A | the circle reads stronger | verified | |`)).length > 0],
      ["a check naming nothing from the item fails", check(table(`| A | the circle reads stronger | verified | ran the linter |`)).length > 0],
      ["an unknown state fails", check(table(`| A | the circle reads stronger | done | |`)).length > 0],
      ["an open item needs no check", check(table(`| A | the circle reads stronger | open | |`)).length === 0],
    ];
    const failed = cases.filter(([, ok]) => !ok);
    for (const [name, ok] of cases) process.stdout.write(`${ok ? "  ok  " : "  FAIL"} ${name}\n`);
    if (failed.length > 0) {
      process.stderr.write("\nfeedback-check self-test failed\n");
      process.exit(1);
    }
    process.stdout.write("\nfeedback-check self-test passed\n");
  }

  if (problems.length > 0) {
    process.stderr.write(`docs/product/feedback.md:\n  ${problems.join("\n  ")}\n\n`);
    process.exit(1);
  }
  process.stdout.write(`feedback-check: ${rows(source).length} items, all states valid\n`);
}
