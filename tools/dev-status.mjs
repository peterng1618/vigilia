#!/usr/bin/env node
/**
 * Generates `dev-status.html` — a single self-contained page describing where
 * this project actually is.
 *
 * ## Why it is generated, not written
 *
 * A hand-maintained status page drifts within a commit or two, and a status page
 * that is wrong is worse than none: it invites decisions based on numbers nobody
 * re-checked. Everything here comes from something executable or from the
 * repository itself — the test suites are run, the bundle is measured on disk,
 * the commit list comes from git.
 *
 * Two numbers cannot be produced cheaply on every run:
 *
 * - **Browser tests** take about a minute, so they are read from the JSON
 *   summary Playwright writes, and the page prints **when that run happened**.
 *   Stale is fine as long as it says so.
 * - **Bundle size** needs a build. It is measured from `dist/` if present, and
 *   the page says when that was built.
 *
 * Anything the page cannot establish is printed as "not measured" rather than
 * guessed or carried over.
 *
 * Usage, from the repository root:
 *
 *   node tools/dev-status.mjs            # runs unit tests, reads the rest
 *   node tools/dev-status.mjs --no-tests # skip running anything
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// fileURLToPath, not URL.pathname: on Windows the latter yields "/D:/..." and
// every fs call then fails to resolve it.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'src', 'web');
const SKIP_TESTS = process.argv.includes('--no-tests');

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/**
 * Runs a Node CLI from `node_modules` and returns stdout **and** stderr.
 *
 * Three details here, each of them from a failure rather than a preference:
 *
 * - **Both streams.** vitest prints its summary to stderr, so reading stdout
 *   alone found nothing and this script reported "could not parse the output" —
 *   a worse message than "the suite failed".
 * - **`node <entry>` rather than `npx`.** On Windows the npx shim is a `.cmd`,
 *   and Node 25 refuses to spawn a `.cmd` without a shell (EINVAL) while also
 *   deprecating `shell: true` with an argument array. Naming the tool's own JS
 *   entry point needs no shell and skips npx's resolution entirely.
 * - **No throw.** A failing suite is a result this page should show, not a
 *   crash that leaves it unwritten.
 */
function runNodeTool(relativeEntry, args, cwd) {
  const entry = join(WEB, 'node_modules', relativeEntry);

  if (!existsSync(entry)) {
    return { output: '', missing: true };
  }

  const result = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: 'utf8' });

  return { output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`, missing: false };
}

function unitTests() {
  if (SKIP_TESTS) {
    return { state: 'skipped', detail: 'not run for this page' };
  }

  // The default reporter, deliberately: vitest 5 removed `basic`, and passing
  // it makes the run fail outright — which this script then reported as
  // "could not parse", the least useful possible message.
  const { output, missing } = runNodeTool('vitest/vitest.mjs', ['run'], WEB);

  if (missing) {
    return { state: 'unknown', detail: 'vitest is not installed — run npm install' };
  }

  const match = /Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed\s+\((\d+)\)/.exec(output);

  if (match === null) {
    return { state: 'unknown', detail: 'could not parse the vitest output' };
  }

  const failed = Number(match[1] ?? 0);

  return {
    state: failed === 0 ? 'pass' : 'fail',
    passed: Number(match[2]),
    total: Number(match[3]),
    failed,
    detail: `${match[2]} of ${match[3]} passing`,
  };
}

function browserTests() {
  const path = join(WEB, 'test-results', 'summary.json');

  if (!existsSync(path)) {
    return { state: 'unknown', detail: 'no Playwright summary on disk — run npx playwright test' };
  }

  const summary = JSON.parse(readFileSync(path, 'utf8'));
  const counts = { passed: 0, failed: 0, skipped: 0 };

  const walkSuites = (suites) => {
    for (const suite of suites ?? []) {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          const status = test.results?.at(-1)?.status ?? 'unknown';
          if (test.status === 'skipped' || status === 'skipped') {
            counts.skipped += 1;
          } else if (status === 'passed') {
            counts.passed += 1;
          } else {
            counts.failed += 1;
          }
        }
      }
      walkSuites(suite.suites);
    }
  };

  walkSuites(summary.suites);

  // A run narrowed by `-g` or a single project would otherwise report its own
  // small total as the project's browser-test count, which looks like a
  // regression and is worse than admitting the number is unknown. Playwright
  // records the command line, so the filter is detectable.
  const argv = summary.config?.argv ?? [];
  const filters = ['-g', '--grep', '--project', '--shard'];
  const filtered = argv.some((argument) => filters.some((flag) => argument.startsWith(flag)));

  if (filtered) {
    return {
      state: 'unknown',
      when: statSync(path).mtime,
      detail: `the last run was filtered (${counts.passed} of the suite) — run npx playwright test`,
    };
  }

  return {
    state: counts.failed === 0 ? 'pass' : 'fail',
    ...counts,
    when: statSync(path).mtime,
    detail: `${counts.passed} passing, ${counts.skipped} skipped`,
  };
}

function typechecks() {
  if (SKIP_TESTS) {
    return [{ name: 'all', state: 'skipped', detail: 'not run for this page' }];
  }

  return ['renderer-core', 'player', 'fake-source', 'editor'].map((name) => {
    const { output } = runNodeTool(
      'typescript/bin/tsc',
      ['--noEmit', '-p', `packages/${name}/tsconfig.json`],
      WEB,
    );
    // tsc prints diagnostics and nothing else, so any non-blank output is a
    // failure. Trimmed because tryRun joins two streams with a newline, which
    // would otherwise read as output and mark every clean check as failing.
    const diagnostics = output.trim();

    return {
      name,
      state: diagnostics === '' ? 'pass' : 'fail',
      detail: diagnostics === '' ? 'clean' : diagnostics.split('\n')[0],
    };
  });
}

function bundleSize() {
  const dist = join(WEB, 'packages', 'player', 'dist');

  if (!existsSync(dist)) {
    return { state: 'unknown', detail: 'no dist/ — run npx vite build packages/player' };
  }

  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        files.push(full);
      }
    }
  };
  walk(dist);

  const gzipKb = (extension) =>
    files
      .filter((file) => extname(file) === extension)
      .reduce((total, file) => total + gzipSync(readFileSync(file)).byteLength, 0) / 1024;

  const js = gzipKb('.js');

  return {
    state: js <= 400 ? 'pass' : 'fail',
    js,
    css: gzipKb('.css'),
    when: statSync(dist).mtime,
    detail: `${js.toFixed(1)} KB of a 400 KB budget`,
  };
}

function screenshots() {
  const dir = join(ROOT, 'docs', 'gates', 'screenshots');

  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .filter((name) => name.endsWith('.png'))
    .map((name) => ({
      name,
      path: `docs/gates/screenshots/${name}`,
      when: statSync(join(dir, name)).mtime,
    }));
}

function commits() {
  const log = git('log', '-25', '--pretty=format:%h\u0001%s\u0001%ad', '--date=iso');

  return log === ''
    ? []
    : log.split('\n').map((line) => {
        const [hash, subject, date] = line.split('\u0001');
        return { hash, subject, date };
      });
}

/**
 * Milestone state.
 *
 * Hand-maintained, because no artefact encodes it: whether Gate 1 is "done"
 * is a judgement about acceptance criteria, not something a script can read.
 * Kept next to the generator so updating it is part of the same edit that
 * changes the code — and each entry has to say what is *missing*, which is the
 * part a status page usually quietly drops.
 */
const RECENT = [
  {
    what: 'Editor specs written (0004–0006)',
    why: 'Selection and gestures, document editing and history, and the inspector now have committed specs — the edge cases that were only encoded in test names. Each one ends with what has NOT been verified, which is the part worth reading: §139 is unit-tested but has no caller, no binding field has been clicked in a browser, and nothing has dragged a child of a rotated group through real pointer input.',
  },
  {
    what: 'Switching a property to a global no longer writes a broken document',
    why: 'Clicking “use global” used to commit a placeholder reference immediately, so an unfinished click left the theme pointing at a token that does not exist — plus an undo entry for a choice nobody made. The pending row now lives in the panel; nothing is committed until a token is picked.',
  },
  {
    what: 'Editor: the inspector panel, and handles that know about groups',
    why: 'Every selected property is editable, and §75’s global-or-literal choice is a per-row control rather than something an author edits by hand: a style bound to a token shows the token and a swatch, with one button to detach it into a local value and one to put it back. Nine browser tests cover it. The panel immediately exposed a real bug — transform handles were placed from a node’s group-relative transform, so anything inside a group had its handles near the artboard origin while its outline was correct.',
  },
  {
    what: 'Re-fit before paint, and a resize that stops killing animation',
    why: 'The player now re-fits the artboard from a ResizeObserver, which runs after layout and BEFORE paint — so no frame is ever painted at the old scale when a window is dragged or a phone rotates. Charts are only re-laid-out when the artboard’s own size changes: chart.resize() interrupts a running animation, and an observer fires once on subscribe, so the unguarded version silently removed the appear animation. Two browser tests caught that within a minute.',
  },
  {
    what: 'Editor: a working canvas',
    why: 'Click, marquee, drag, resize, rotate, snap, nudge, delete, undo and redo — driven by real pointer input in 15 browser tests. It renders the LIVE dashboard through the same renderer the player uses, so ADR-0005 is now demonstrated rather than argued.',
  },
  {
    what: 'Editor foundation decided (ADR-0005)',
    why: 'Both Fabric candidates rejected: they are canvas editors, and this renderer is DOM plus ECharts. Adopting one meant rendering the scene twice, which §31 forbids and Gate 0 rejects outright. Unblocks Gate 2.',
  },
  {
    what: 'Host sequenced after the frontend (ADR-0006)',
    why: 'No .NET code here has ever compiled, so a mid-sequence Gate 3 stalled three milestones that do not depend on it. Gate content is unchanged; only the queue order moved.',
  },
  {
    what: 'Determinism boundary measured',
    why: 'Our own rendering is byte-identical at a fixed clock; any frame containing an ECharts chart never is, on either renderer. Settles whether pixel baselines can cover charts — they cannot.',
  },
  {
    what: 'Static rendering and reduced motion',
    why: 'The player honours prefers-reduced-motion, and ?static=1 renders without animation. An accessibility requirement first, and what makes a reproducible capture possible second.',
  },
  {
    what: 'Assets: resolver, image rendering, monochrome recolouring',
    why: 'The image node type could be authored and validated but never drawn. Also revealed that a declared asset always resolves, so "absent from the package" is only detectable when the load fails.',
  },
  {
    what: 'Widget insertion with fresh ids and provenance',
    why: 'Renames node AND binding ids through one map, so a text run cannot end up pointing at a binding that no longer exists. Globals are mapped explicitly, never merged by name (§77).',
  },
  {
    what: 'Four theme fixtures, five invalid ones',
    why: 'One showcase theme only proves the renderer works on the layout it was designed against. The stress fixture immediately found a real bug: a node marked invisible rendered anyway.',
  },
  {
    what: 'Unknown-field rejection and two drift guards',
    why: 'A typo like "visable": false used to be valid and silently did nothing. Schema↔validator and C#↔TypeScript now both fail a test on drift.',
  },
];

const NEXT = [
  {
    what: 'Editor specs',
    why: 'The renderer half has .agents/specs/0003; the editor half has none, so the pure modules are the only contract. Writing 0004-0006 (selection and gestures, document editing and history, the inspector) pins down the edge cases that are currently only in test names.',
  },
  {
    what: 'Globals surface',
    why: 'An author can point a property at a token but cannot yet add, rename or recolour one. §75 is only half usable until the palette itself is editable.',
  },
  {
    what: 'Grouping, alignment and multi-node resize',
    why: 'Group/ungroup, align and distribute, and resizing several nodes at once. The last one is refused today rather than done wrongly: a proportional box scale is not expressible as a per-node width change for rotated children.',
  },
  {
    what: 'Open and save',
    why: 'The editor loads a checked-in fixture and cannot persist. Needs the §139 rule that saving marks history clean without clearing it, so undo still reaches before the save.',
  },
  {
    what: 'Theme packages (Gate 4)',
    why: 'ZIP import and export with the §141 security rules: path traversal, absolute paths, symlinks and zip bombs all rejected, and no secret ever inside a package (§143).',
  },
];

const MILESTONES = [
  {
    gate: '0 — Feasibility',
    state: 'blocked',
    done: 'Four chart families, minimal shapes, independent display bundle measured, styling matrix authored, licences inventoried, dependencies pinned.',
    missing:
      'Human-only: name reference hardware (§126), run the elevation and anti-cheat probes on real hardware, decide the two engine-gap alternatives (§85), approve the editor strategy (ADR-0001).',
  },
  {
    gate: '1 — Document/rendering',
    state: 'nearly',
    done: 'Schema, typed globals and references, shared renderer, contain/cover, nested transforms, byte-stable JSON round-trip, deterministic screenshot capture.',
    missing:
      'Screenshots are deterministic per platform but there are no committed pixel baselines — that waits on §126 reference hardware, since CI is Linux and development is Windows.',
  },
  {
    gate: '2 — Authoring',
    state: 'started',
    done: 'Chart and style matrices, typography with styled runs and explicit overflow, widget insertion. Editor canvas working: selection, marquee, group entry, move/resize/rotate with snapping, nudge, delete, and gesture-scoped undo — all over the shared renderer (ADR-0005).',
    missing:
      'Inspectors, the globals surface, grouping and ungrouping, style presets, multi-node resize, alignment and distribution tools, open and save.',
  },
  {
    gate: '4 — Reuse/packages',
    state: 'started',
    done: 'Widget insertion with fresh IDs, provenance and explicit global mapping (§77/§138).',
    missing:
      'Theme packs: the ZIP container, manifest, import staging, decompression-bomb and traversal limits, SVG importer (host-side), draft recovery.',
  },
  {
    gate: '3 — Live display',
    state: 'deferred',
    done: 'Client-side sample source contract, bounded history with reconnect replacement, deterministic fake source, unmapped-key and status handling end to end.',
    missing:
      'Everything host-side: provider registry, Windows and API providers, the custom-sensor wizard, pairing, the SignalR transport. Re-sequenced after the frontend by ADR-0006, because no .NET code here has ever been compiled and a mid-sequence Gate 3 stalled three milestones that do not depend on it.',
  },
  {
    gate: '5 — Release',
    state: 'not started',
    done: 'Nothing.',
    missing: 'Installer, tray, recovery, permissions review, soak and game benchmarks.',
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function ago(date) {
  if (!(date instanceof Date)) {
    return 'unknown';
  }

  const minutes = Math.round((Date.now() - date.getTime()) / 60000);

  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  if (minutes < 60 * 24) {
    return `${Math.round(minutes / 60)} h ago`;
  }
  return `${Math.round(minutes / 1440)} d ago`;
}

function badge(state) {
  const label = {
    pass: 'passing',
    fail: 'FAILING',
    unknown: 'not measured',
    skipped: 'skipped',
    blocked: 'blocked',
    deferred: 'deferred',
    nearly: 'nearly done',
    started: 'started',
    'not started': 'not started',
  }[state] ?? state;

  return `<span class="badge ${escapeHtml(state).replace(' ', '-')}">${escapeHtml(label)}</span>`;
}

function render(data) {
  const { unit, browser, checks, bundle, shots, log, head, branch, dirty } = data;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Vigilia — development status</title>
<!--
  GENERATED FILE. Do not edit: run \`node tools/dev-status.mjs\` from the
  repository root. Every number here comes from an execution or from git; the
  milestone table is the one hand-maintained part and lives in that script.
-->
<style>
  :root { color-scheme: dark light; --bg:#0c0e13; --panel:#151922; --line:#232a36;
          --ink:#e8ecf3; --dim:#8a97ab; --ok:#36b37e; --bad:#ff5630; --warn:#ffab00; --accent:#00b8d9; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 system-ui, sans-serif; }
  main { max-width:1100px; margin:0 auto; padding:32px 24px 80px; }
  h1 { font-size:28px; margin:0 0 4px; }
  h2 { font-size:19px; margin:40px 0 12px; padding-bottom:8px; border-bottom:1px solid var(--line); }
  p.sub { color:var(--dim); margin:0 0 24px; }
  .grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px; }
  .card h3 { margin:0 0 6px; font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:var(--dim); font-weight:600; }
  .big { font-size:26px; font-weight:700; }
  .note { color:var(--dim); font-size:13px; margin-top:4px; }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; }
  .badge.pass { background:#0d3b2a; color:var(--ok); }
  .badge.fail { background:#45160f; color:var(--bad); }
  .badge.unknown, .badge.skipped { background:#2a2f3a; color:var(--dim); }
  .badge.blocked { background:#45160f; color:#ff8f73; }
  .badge.deferred { background:#2a2438; color:#b39ddb; }
  .badge.nearly { background:#3b3410; color:var(--warn); }
  .badge.started { background:#0d3242; color:var(--accent); }
  .badge.not-started { background:#2a2f3a; color:var(--dim); }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:10px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--dim); font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
  td.missing { color:var(--dim); }
  code { font-family:ui-monospace, monospace; font-size:13px; background:#00000040; padding:1px 5px; border-radius:4px; }
  .shots { display:grid; gap:16px; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); }
  figure { margin:0; background:var(--panel); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  figure img { display:block; width:100%; height:auto; background:#000; }
  figcaption { padding:10px 12px; font-size:13px; color:var(--dim); }
  ol.log { padding-left:20px; }
  ol.log li { margin-bottom:6px; }
  ol.log span { color:var(--dim); font-size:13px; }
  .warn-banner { background:#3b3410; border:1px solid #6b5a15; color:var(--warn);
                 padding:12px 16px; border-radius:10px; margin-bottom:24px; font-size:14px; }
</style>
</head>
<body>
<main>
  <h1>Vigilia — development status</h1>
  <p class="sub">
    Generated ${escapeHtml(new Date().toISOString())} ·
    branch <code>${escapeHtml(branch)}</code> ·
    commit <code>${escapeHtml(head)}</code>${dirty ? ' · <strong>uncommitted changes present</strong>' : ''}
  </p>

  <div class="warn-banner">
    <strong>No .NET code in this repository has ever been compiled.</strong>
    There is no .NET SDK on the development machine, only the EOL 6.0.35 runtime, so everything
    under <code>src/Vigilia.*</code> is authored-but-unbuilt and the backend CI job is paused.
    The display path below is real and executed; the host is not.
  </div>

  <h2>Verified now</h2>
  <div class="grid">
    <div class="card">
      <h3>Unit tests</h3>
      <div class="big">${escapeHtml(unit.passed ?? '—')}</div>
      <div>${badge(unit.state)}</div>
      <div class="note">${escapeHtml(unit.detail)}</div>
    </div>
    <div class="card">
      <h3>Browser tests</h3>
      <div class="big">${escapeHtml(browser.passed ?? '—')}</div>
      <div>${badge(browser.state)}</div>
      <div class="note">${escapeHtml(browser.detail)}${browser.when ? ` · ${escapeHtml(ago(browser.when))}` : ''}</div>
    </div>
    <div class="card">
      <h3>Player bundle, gzip</h3>
      <div class="big">${bundle.js === undefined ? '—' : escapeHtml(bundle.js.toFixed(1))} KB</div>
      <div>${badge(bundle.state)}</div>
      <div class="note">${escapeHtml(bundle.detail)}${bundle.when ? ` · built ${escapeHtml(ago(bundle.when))}` : ''}</div>
    </div>
    <div class="card">
      <h3>Typechecks</h3>
      <div class="big">${checks.filter((c) => c.state === 'pass').length}/${checks.length}</div>
      <div>${badge(checks.every((c) => c.state === 'pass') ? 'pass' : checks.some((c) => c.state === 'fail') ? 'fail' : 'skipped')}</div>
      <div class="note">${escapeHtml(checks.map((c) => `${c.name}: ${c.detail}`).join(' · '))}</div>
    </div>
  </div>

  <h2>Recently completed</h2>
  <table>
    <thead><tr><th>What</th><th>Why it mattered</th></tr></thead>
    <tbody>
      ${RECENT.map(
        (item) =>
          `<tr><td><strong>${escapeHtml(item.what)}</strong></td><td class="missing">${escapeHtml(item.why)}</td></tr>`,
      ).join('\n      ')}
    </tbody>
  </table>

  <h2>Next up</h2>
  <p class="sub">In order. Anything marked blocked is waiting on something outside this repository.</p>
  <table>
    <thead><tr><th>#</th><th>What</th><th>Why now</th><th>State</th></tr></thead>
    <tbody>
      ${NEXT.map(
        (item, index) =>
          `<tr><td>${index + 1}</td><td><strong>${escapeHtml(item.what)}</strong></td>` +
          `<td class="missing">${escapeHtml(item.why)}</td>` +
          `<td>${badge(item.blocked ? 'blocked' : 'started')}</td></tr>`,
      ).join('\n      ')}
    </tbody>
  </table>

  <h2>Milestones</h2>
  <p class="sub">
    Listed in working order, which ADR-0006 re-sequenced: the gates whose content needs no .NET SDK
    come first. Gate numbering and every gate's acceptance criteria are unchanged from the design
    document — only the queue order moved.
  </p>
  <table>
    <thead><tr><th>Gate</th><th>State</th><th>Done</th><th>Missing</th></tr></thead>
    <tbody>
      ${MILESTONES.map(
        (m) => `<tr>
        <td><strong>${escapeHtml(m.gate)}</strong></td>
        <td>${badge(m.state)}</td>
        <td>${escapeHtml(m.done)}</td>
        <td class="missing">${escapeHtml(m.missing)}</td>
      </tr>`,
      ).join('\n      ')}
    </tbody>
  </table>

  <h2>Rendered evidence</h2>
  <p class="sub">
    Captured from the built player bundle with a frozen clock and animation disabled, so a frame is a
    pure function of the clock. These are <strong>evidence, not baselines</strong>: nothing compares
    against them, and glyph rasterisation differs between this machine and CI.
  </p>
  ${
    shots.length === 0
      ? '<p class="sub">No screenshots on disk.</p>'
      : `<div class="shots">
    ${shots
      .map(
        (shot) => `<figure>
      <img src="${escapeHtml(shot.path)}" alt="${escapeHtml(shot.name)}" loading="lazy" />
      <figcaption>${escapeHtml(shot.name)} · ${escapeHtml(ago(shot.when))}</figcaption>
    </figure>`,
      )
      .join('\n    ')}
  </div>`
  }

  <h2>Recent commits</h2>
  <ol class="log">
    ${log
      .map(
        (entry) =>
          `<li><code>${escapeHtml(entry.hash)}</code> ${escapeHtml(entry.subject)}<br /><span>${escapeHtml(entry.date)}</span></li>`,
      )
      .join('\n    ')}
  </ol>
</main>
</body>
</html>
`;
}

const data = {
  unit: unitTests(),
  browser: browserTests(),
  checks: typechecks(),
  bundle: bundleSize(),
  shots: screenshots(),
  log: commits(),
  head: git('rev-parse', '--short', 'HEAD') || 'unknown',
  branch: git('rev-parse', '--abbrev-ref', 'HEAD') || 'unknown',
  dirty: git('status', '--porcelain') !== '',
};

writeFileSync(join(ROOT, 'dev-status.html'), render(data), 'utf8');

console.log(
  `dev-status.html written — unit ${data.unit.state}, browser ${data.browser.state}, ` +
    `bundle ${data.bundle.state}, ${data.shots.length} screenshots`,
);
