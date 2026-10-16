# 0062 — The selector instrument is a script, and the reverse direction is a class-write reading

- **Date:** 2026-10-17
- **Status:** accepted
- **Paths:** `scripts/dead-selectors.mjs`
- **Task:** Phase 21.4 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (row `vg-380`)

## The problem

`vg-380`'s ruling is that **the reverse direction is in scope and the selector
instrument widens**: it reads `className` and `classList` writes alongside
`class=` literals, so a class production writes that no stylesheet defines
becomes visible, and the `PRODUCT` column stops depending on whether a name
happens to appear in prose.

The plan's `Files:` line for Task 21.4 says *"Modify: the sweep script's selector
instrument"*, and **there is no such thing to modify.** `scripts/dead-code-sweep.mjs`
is 1,200 lines and a case-insensitive `grep -ci 'selector\|className\|classList\|class='`
over it returns **0** — it is the module/export instrument, a different lane. The
selector instrument is a one-off `node -e` command quoted verbatim in
`docs/architecture/dead-selectors.md` §2, and nothing under `scripts/` or in
`src/web/package.json` reads or writes that document: `grep -rn dead-selectors`
over `scripts/`, `src/`, `.github/` and the manifests returns nothing outside
`docs/`.

So the question is not how to edit the instrument but **where it lives**, and the
document's own answer is a real position rather than an oversight: *"One command,
re-runnable, **no script to keep in step with the file it reads**."* That virtue
is exactly what Step 3 puts under pressure — it asks for *"a case that fails when
the widened reading is disabled"*, and a case implies something runnable with a
fixture. The shape of the problem: **a check whose virtue is that it has no file
to drift, now owing a runnable case that a pasted command cannot carry.**

## Rung 1 — Vigilia

Searched: every `scripts/*.mjs` for a selector instrument
(`grep -ci 'selector\|className\|classList\|class=' scripts/dead-code-sweep.mjs`
→ **0**); every `scripts/*.mjs` and `src/web/package.json` for a reader or writer
of `docs/architecture/dead-selectors.md` (`grep -rn dead-selectors` over
`scripts/`, `src/`, `.github/`, `*.json` → **nothing outside `docs/`**); the
sweep's three tiers; `scripts/reuse-gate.mjs`'s `WATCHLIST`; and the two
`node -e` commands the document quotes (instrument 1, and the composition pass in
§4).

Found:

- **The instrument exists once, as prose**, with its output pasted at
  `a7ef0c3a`. Nothing else in the repo asks either direction.
- **`scripts/capture-freshness.mjs` (Task 21.3, note `0061`) is the house shape**
  for a `scripts/` report: a docblock stating what it answers and every exit code,
  a `--self-test` that builds a temporary fixture, and a chaining into
  `gates:self-test` rather than a script nobody runs.
- **The document's two commands are not the same instrument.** §2's command is
  the reachability check; §4's is a second pass over backtick literals. Only the
  first is what this task widens.

## Rung 2 — dependencies

Searched: the workspace manifests and the installed tree for anything that
answers "is this string a class this stylesheet declares" or "is this string a
class the product applies" — `tailwindcss@4.3.3`, Biome, `@playwright/test`,
`canvas`, `jsdom`.

Found:

- **Tailwind is the only installed thing that knows which strings are utilities,
  and its public API does not expose the question.** `node_modules/tailwindcss/dist/lib.d.mts`
  exports `compile`, `compileAst`, `__unstable__loadDesignSystem` and the PostCSS
  plugin warning. A candidate's validity is reachable only through
  `__unstable__loadDesignSystem`, which needs the project's CSS compiled with
  `loadStylesheet`/`loadModule` resolvers inside the check — a build step for a
  question about two files.
- **Biome parses CSS and has no unused-selector rule** (the document records this
  already, and Biome's CSS lint set has not grown one).
- **`@playwright/test` can answer both questions** by rendering the product and
  querying the DOM — which is a browser run, and the document refuses a browser
  measurement for the same reason this task does.

Nothing to add. The check is a regex over text, and the only dependency question
worth recording is the one Tailwind is asked below (Rung 5).

## Rung 3 — platform

Searched: what Node and the DOM give for "which classes does this source apply".

Found: **nothing.** There is no platform API for this — the question is over
text, and the only platform primitive that answers it is a DOM query against a
rendered page. `node:fs` plus a regex is the whole mechanism, which is why the
document could state the check as one command in the first place.

## Rung 4 — ecosystem

Searched (2026-10-17): *"tool that finds class names used in source code that no
stylesheet defines, reverse direction of unused CSS detection"*, *"PurgeCSS
default extractor dynamic class names safelist limitation"*, and read the
results' own READMEs.

Found — **the shape is solved, and the prior art is explicit about the same two
limits this instrument has**:

- **`JCorners68/cssguard`** is the same tool and says so: *"Bidirectional CSS/HTML
  class validator… Existing tools find unused CSS. CSSGuard finds the
  **opposite**: HTML classes with no CSS definition."* It describes itself as
  *"string-literal harvesting, not framework parsing"*, extracts `class=`/
  `className=` and `clsx`/`classnames`/`cva` string arguments, and states the
  blind spot in the same words this note has to: *"template literals with `${}`
  and conditional expressions are skipped to avoid false positives."*
- **`zalando/gulp-check-unused-css`** answers both directions and fails the build
  on either. Its answer to the vendor-class false positive is an explicit
  `ignore` array and named `globals`, with the reason stated: *"most of us do not
  write 100% of the CSS ourselves but rely on frameworks such as Bootstrap."*
- **`malinindev/check-unused-css`** reports *"non-existent class references"* and
  documents that *"dynamic class access cannot be detected"* — it marks those as
  passed.
- **`JackUait/blok`'s `scripts/unused-css-finder/cli.mjs`** is an in-repo script
  of exactly this shape (a `classList.(add|remove|toggle|contains)` regex, a
  `className=` regex, template-literal and ternary extraction), and it carries an
  `ignoreTailwind`/`isTailwindUtility` predicate — the narrowing problem solved by
  a utility predicate.
- **The negative result is a comparison table** in `cssguard`'s own README:
  PurgeCSS and Chrome Coverage find unused CSS only, `html-inspector` finds
  orphans but needs PhantomJS, and stylelint is CSS-only.

**The comparison.** Every one of them narrows the reverse direction with a
**list** — `cssguard` skips expressions, `gulp-check-unused-css` takes an
`ignore` array, `blok` predicates on Tailwind. **None infers scope from the
stylesheet it is checking.** That is the one thing this repo can do and they
cannot: our two stylesheets declare their own namespaces (Rung 5).

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **A script under `scripts/` with `--self-test`, chained into `gates:self-test`** | The ruling's shape; Step 3's case needs a fixture, and the fixture is the script's | ~300 lines, one npm-script edit, one document rewrite | A script that drifts from the document — the drift the document avoided | **chosen** |
| Keep the `node -e` in the document and widen it there | No new file; nothing to drift | One longer command | Step 3's case cannot exist, so the widening lands unproven — and the command is already at the edge of what a reader can check | rejected |
| An `npm run dead:selectors` alias around the same `node -e` | Names the check | No fixture, so still no case; and the command is the thing that grows | Same as above, with a name that suggests otherwise | rejected |
| Tailwind's `__unstable__loadDesignSystem` as the utility predicate | Would answer "is this a utility" exactly rather than by inference | A Tailwind build inside the check, plus an `__unstable__` API | The `__unstable__` prefix is the vendor saying it may move; and it answers a question the namespace rule already answers on this tree | rejected |
| An `ignore`/`globals` list of utilities (`cssguard`, `gulp-check-unused-css` shape) | Direct prior art | A second list of Tailwind's vocabulary, maintained by hand | The same habit in a new file: it drifts from the Tailwind version and nobody notices | rejected |
| Report every class the source writes (no narrowing) | No rule to get wrong | Nothing | **234 findings at HEAD, 223 of them outside every namespace the stylesheets use** — Tailwind's vocabulary and other people's hooks, i.e. a report nobody reads, which is the failure the row's severity note warns about from the other side | rejected |

## Rung 6 — probe

Measured 2026-10-17 at `caa7ee86`, by the instrument itself
(`node scripts/dead-selectors.mjs` and its `--self-test`):

| Measurement | Value | How |
|---|---|---|
| Stylesheet tokens | `editor-shell.css` **80** classes + **31** `data-*`; `vigilia-page.css` **17** + **2**; **130** total | the script's first line |
| The document's §3 table, at `a7ef0c3a` | 84 + 32 + 17 + 2 = **135** | the document — **stale**, `editor-shell.css` moved under Phase 20's token work |
| Classes production source writes (whole literals) | **331** | the script |
| Of those, defined by one of the two stylesheets | **97** | the script |
| Not defined | **234** — **11** in a stylesheet namespace, **223** outside every one | the script |
| Forward, write-keyed: class tokens nothing applies | **0 of 97** | the script |
| Forward, spelling-keyed: `data-*` tokens nothing spells | **5 of 33** — the same five the document lists | the script |
| Forward delta under the document's own bucket | **4** class tokens — `hint`, `lead`, `elsewhere`, `theme-list`, whose `PRODUCT` column reads 0 while `test`/`doc`/`style` read 18/14/3, 7/21/2, 17/28/2 and 4/8/2 | the same script with the bucket reverted |
| The live run | `16 finding(s)`, **exit 1** | `node scripts/dead-selectors.mjs` |
| The `--self-test` | **7 cases, exit 0** | `node scripts/dead-selectors.mjs --self-test` |
| The red proof | **5 of 7 cases FAIL, exit 1** | `classWrites` returning an empty `Map` |

**What the probe shows, and it is not what the brief predicted.** The brief
expected *"one finding"*. The reverse direction finds **eleven** classes at HEAD,
and every one is a real DOM class write:

| Class | Written at | Why no rule costs nothing visible |
|---|---|---|
| `editor-shell-about` | `settings.tsx` | the same element carries `flex flex-col gap-[…]` |
| `editor-shell-dialog-close` | `components/ui/dialog.tsx` | an unstyled hook; a test queries it |
| `editor-shell-publish-live` | `publish-control.tsx` | an unstyled hook inside `.editor-shell-publish-popup`'s column |
| `editor-shell-publish-reason` | `publish-control.tsx` | the same |
| `editor-shell-rail-slot` | `rail.tsx` | an unstyled hook; `shell-layout.dom.test.tsx` queries it |
| `vigilia-angle-indicator` | `indicator-manager/index.ts` → `cursor-indicator.ts` | every property is set inline from `CURSOR_INDICATOR_STYLES` |
| `vigilia-field-hint` | `controls/settings-field.ts` | **the row's instance** — hidden by the inline `cssText` beside it |
| `vigilia-run-label` | `selection-inspector/runs.tsx` | the same element carries `text-xs text-muted` |
| `vigilia-run-note` | `runs.tsx` ×3, `chart-manager/chart-fields.tsx` | utilities on three of its four sites |
| `vigilia-run-preview` | `selection-inspector/runs.tsx` | the same element carries `text-xs text-muted` |
| `vigilia-size-indicator` | `indicator-manager/index.ts` | the same as the angle indicator |

The row's instance is one of eleven, and the row's own "occurs exactly ONCE in
the entire checkout" is a statement about the *string* `vigilia-field-hint`, not
about the direction. **The direction had ten other instances nobody had counted**,
which is the argument for the widening rather than against it.

## Decision

**The instrument becomes `scripts/dead-selectors.mjs`, its `--self-test` chains
into `gates:self-test`, and the live run stays a command.** Four choices, each
with its reason.

**1. A script, not the document's one-liner.** The document's virtue is real —
*"no script to keep in step with the file it reads"* — and it is bought at the
price Step 3 names: a case cannot be pasted, and a case is what proves the
widening. The drift the document avoided is answered rather than ignored:
`docs/architecture/dead-selectors.md` keeps the **reasoning** and loses the
command, pointing at the script for both the reading and the recipe, so there is
one executable copy and no second one to fall out of step. The live run is **not**
in `gate`, for Task 21.3's and Task 21.7's reason: it exits 1 at HEAD (16
findings) and gating on it would hold every commit red until the eleven are
adjudicated. `--self-test` is the part that is chained, and it runs against a
temporary fixture so no case pins a live file.

**2. The widened reading is the class write, and the four forms are named.** A
class is applied by `className="a b"`, `className={cond ? "a" : "b"}` (the
literals inside the expression), `className: "a"`, `class="a"`, `classList.add("a")`
and `setAttribute("class", "a")`. Everything else is a *spelling*, and a spelling
is not an application — that is what makes the `PRODUCT` column independent of a
comment.

**3. `.html` is PRODUCT, and that is a correction to the document's bucket.** The
document's §2 prose already defines `PRODUCT` as *"a source file in `src/web` that
is not a test, a spec, a test stage or a fixture"* — and its code put `.html` in
`STYLE`, which contradicted that and which §7 then recorded as a limit: `.hint`,
`.lead` and `.elsewhere` *"are live, and **not** by the route 'spelled in a
production source file' implies."* A host page writing `class="hint"` **is** the
product applying it, so `.html`/`.htm` under `src/web` is `PRODUCT`; `.css` and
`.svg` stay `STYLE`, which is what that bucket is actually for (another
stylesheet, or an asset, naming a class does not prove the product applies it),
and the per-token own-file exclusion carries the rest. **Measured effect: under
the document's bucket the widened reading names four class tokens (`hint`,
`lead`, `elsewhere`, `theme-list`) whose only write is a host page's markup; under
the correction it names none, and the forward list is the same five attributes as
before.** The four are still *visible* — the `style=` column on every forward line
says where the write is.

**4. The reverse direction is narrowed to the stylesheets' own namespaces.** A
namespace is a leading hyphen-separated segment the two stylesheets use on more
than one class — `editor-`, `vigilia-`, `theme-`. The reason is Rung 4's: a
Tailwind utility is not a missing stylesheet rule, it is generated, and
`cssguard`'s own table shows every other tool in this space needing a hand-kept
list to say so. **A class outside every namespace is counted and not named** —
223 of the 234 at HEAD — and the report says why. This is the narrowing the brief
asked for, stated rather than hidden: without it the report is 234 findings, 223
of them Tailwind's vocabulary or a third party's.

**The `data-*` half keeps the spelling reading, deliberately.** The ruling names
`className`, `classList` and `class=`, which are classes. An attribute has no
single write form: it is written through `dataset`'s camelCase form
(`screen.dataset["vigiliaDisplayScreen"]`), through `setAttribute`, through JSX
`data-x={…}` and through a spread object, and §4 of the document clears five of
them by hand for exactly that reason. Covering it is a separate design, and this
note records it as an open asymmetry rather than pretending the halves are
symmetric.

**Known limits, recorded rather than solved.**

- **A name assembled at run time is invisible.** `` className={`${x} flex`} ``'s
  literal parts are read and its variable is not; a name built with `+` is
  invisible entirely. `cssguard` states the same limit in the same words, and the
  document's §2 already states it for its own direction.
- **`className` on a non-element is a false positive.** The write reading takes
  the literal, not the receiver. On this tree the one `className:` object-property
  site (`indicator-manager/index.ts`) turned out to be a real DOM write, which was
  checked rather than assumed; a future one need not be.
- **The forward direction proves an application, not a render.** A class written
  on a branch nothing reaches passes it — the document's §7 already says this.
- **`editor-shell.css` is in no gate** (`vg-274`), so this instrument is one of
  the few things reading it at all. It reports; nothing blocks on it.
- **The namespace rule is inference, and inference can be wrong in both
  directions**: a Tailwind utility beginning `editor-`, `vigilia-` or `theme-`
  would be named as a finding, and a stylesheet-namespaced class written by a
  third party would be named as one too. Both are visible in the report's own
  output rather than silent.

`ponytail:` the reverse direction reads whole string literals and one level of
brace nesting; upgrade it to a real parse (or to Tailwind's
`__unstable__loadDesignSystem`) when a false finding or a miss is actually
observed, not before.
