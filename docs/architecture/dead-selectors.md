# Dead selectors

A reachability check **of** the two stylesheets the product ships, in two
directions, run by `scripts/dead-selectors.mjs`. The **forward** direction asks
which class and `data-*` attribute selectors in those files are applied by
nothing; the **reverse** asks which classes the production source writes that
neither file defines. The first exists so the dead-code sweep's removal phase has
a list to act on instead of an instinct; the second so a class production writes
with no rule behind it is visible before an instance arrives that is not harmless.

**This document modifies nothing.** Nothing here has been deleted, and the
forward direction's dead list is empty.

**The instrument is a script and this document is its reasoning.** Until
2026-10-17 the instrument was a `node -e` command quoted here, on the argument
that a command has *"no script to keep in step with the file it reads"*. That
virtue is real, and it was bought at a price: `vg-380`'s ruling widens the
reading, and a widening owes a case that fails when it is disabled — which a
pasted command cannot carry. `scripts/dead-selectors.mjs` is now the one
executable copy; this document holds why the readings are what they are, and
`docs/decisions/0062` holds the decision. The reading below was taken on
2026-10-17 and is re-runnable:

```sh
node scripts/dead-selectors.mjs             # the report; exit 1 on a finding
node scripts/dead-selectors.mjs --self-test # 7 cases against a temporary fixture
```

## 1. Why this lane needs naming at all

Only **two** CSS files ship (`editor-shell.css`, and the host's own pages'
`yunari-page.css`), so this does not want a scanner framework. It wants naming
because nothing else can see the problem:

- `editor-shell.css` is the **largest hand-written, non-test source file in the
  repo** — 2,826 lines by `wc -l` at this reading; the only larger files are the
  generated `font-trios.generated.ts` and three e2e specs. `vg-274` records that
  it is in **no gate**: the design-token ratchet parses CSS, and its `gated` list
  names no `.css` file.
- `vg-266` records a dead selector in this very file, found by hand.
- A dead selector is invisible to `typecheck`, to Biome (which parses CSS but
  has no unused-selector rule) and to every test that does not query the class
  by name — and a test that queries a dead class by name only fails if it
  asserts a hit, not if it asserts a miss.
- **And the same is true of the opposite mistake.** A class the production source
  writes that no stylesheet defines is invisible to all four for the mirror-image
  reason: nothing looks at what the source applies, only at what it names.

## 2. The instrument

One script, two directions, one primitive. A **write** is a literal the
production source puts on an element, and only a write counts as an application:
`className="a b"`, `className={cond ? "a" : "b"}` (the literals inside the
expression), `className: "a"`, `class="a"`, `classList.add("a")`,
`setAttribute("class", "a")`. A name spelled in a comment, an identifier or a
string is not an application, which is what makes the `PRODUCT` column
independent of whether a name happens to appear in prose.

The forward direction reports each class and `data-*` token in the two files that
no production source applies, with the count of its spellings by bucket so a
reader can see where the name does appear. The reverse direction reports each
class the production source writes that neither file defines. Exit 1 on a
finding, 2 on a stylesheet it cannot read.

Its output at this reading, verbatim:

```
dead-selectors: editor-shell.css classes=80 dataAttrs=31  yunari-page.css classes=17 dataAttrs=2  tokens=130

FORWARD — a selector in either stylesheet that no production source applies
  data-popup-open  (attr, editor-shell.css)  test=0 script=0 doc=1 style=0
  data-checked  (attr, editor-shell.css)  test=1 script=0 doc=1 style=0
  data-active  (attr, editor-shell.css)  test=2 script=0 doc=1 style=0
  data-yunari-display-screen  (attr, editor-shell.css)  test=1 script=0 doc=3 style=0
  data-placeholder  (attr, yunari-page.css)  test=1 script=0 doc=1 style=0
  forward: 5 of 130 token(s) unapplied

REVERSE — a class production source writes that neither stylesheet defines
  editor-shell-about  src/web/packages/editor/src/editor-shell/settings.tsx
  editor-shell-dialog-close  src/web/packages/editor/src/components/ui/dialog.tsx
  editor-shell-publish-live  src/web/packages/editor/src/editor-shell/publish-control.tsx
  editor-shell-publish-reason  src/web/packages/editor/src/editor-shell/publish-control.tsx
  editor-shell-rail-slot  src/web/packages/editor/src/editor-shell/rail.tsx
  yunari-angle-indicator  src/web/packages/editor/src/indicator-manager/index.ts
  yunari-field-hint  src/web/packages/editor/src/editor-shell/controls/settings-field.ts
  yunari-run-label  src/web/packages/editor/src/selection-inspector/runs.tsx
  yunari-run-note  src/web/packages/editor/src/chart-manager/chart-fields.tsx src/web/packages/editor/src/selection-inspector/runs.tsx
  yunari-run-preview  src/web/packages/editor/src/selection-inspector/runs.tsx
  yunari-size-indicator  src/web/packages/editor/src/indicator-manager/index.ts
  reverse: 331 class(es) written by production source, 97 defined by the two stylesheets, 234 not — 11 in a stylesheet namespace (named above), 223 outside every namespace (editor- yunari- theme-), which is Tailwind's vocabulary or a third party's

dead-selectors: 16 finding(s)
```

**The live run is not a gate step and the `--self-test` is.** The live run exits
1 on this tree and would hold every commit red; what is chained into
`gates:self-test` is the self-test, which builds a temporary fixture so no case
pins a live file. The same distinction `0061` and Task 21.7 state for their own
instruments.

### Why this search is sufficient, and where it stops

- **Root and scope.** The whole checkout, not a package: `src/web/tests/e2e/`
  belongs to no package, and a package-scoped search cannot see it. `.mjs` files
  sit in no tsconfig and are in scope for the same reason.
- **Skipped:** `node_modules`, `dist`, `.git`, `.vite`, `coverage`,
  `test-results`, `playwright-report`, `.agent-scratch`, `.superpowers`,
  `.codegraph`, `.e2e-host-app` and build caches. `.superpowers` is skipped
  because plan prose is not evidence about the product; the plan workspace's own
  files are read by hand in section 5 instead.
- **The owning file is excluded per token**, so a stylesheet does not prove its
  own selector live. This matters here: `editor-shell.css` names
  `.editor-shell-palette-swatch` in a selector list it also defines, and
  `yunari-page.css` names `.theme-row` in two rules.
- **Comments are stripped before extraction.** The file's own prose names classes
  constantly, and a class named only in a comment is not a class the product
  applies. The file records that trap on itself: `@source inline("bg-shell-surface")`
  exists only because Tailwind emits a rule for a class it finds in a scanned
  source, and without the directive the rule would exist only because a *comment*
  in `editor-shell.tokens.test.ts` happens to contain the string.
- **The boundary is `(?![A-Za-z0-9_-])`, and it guards the right-hand side
  only.** `editor-shell-pane` is not counted inside `editor-shell-panel`, where
  prefix families share long stems; a bare substring count over-reports on this
  file for exactly that reason. But a token that *ends* a run while an identifier
  continues on its *left* still matches — `by` inside `labelledby` — so the
  forward direction over-reports, and the composition pass in section 5 is where
  the same one-sided guard is visible as seven named collisions.
- **Buckets.** `PRODUCT` is a source file the product ships that is not a test, a
  spec, a test stage or a fixture; `TEST` is `*.test.*`, `*.spec.*`, `/tests/`, a
  `test-stage` or a fixture; `SCRIPT` is `scripts/`; `DOC` is `docs/`; `STYLE` is
  another `.css` or `.svg`. **`.html` is `PRODUCT`**, and that is a correction:
  a host page writing `class="hint"` *is* the product applying it, and the
  previous reading, which put markup in `STYLE`, reported `.hint`, `.lead`,
  `.elsewhere` and `.theme-list` as unapplied while their only write was a host
  page's own markup. The `STYLE` bucket keeps its real job — another stylesheet,
  or an asset, naming a class does not prove the product applies it. See `0062`.
- **The reverse direction reads `PRODUCT` files only.** A test, a script or a
  drawing writing a class is not the product applying it, and reading them would
  make this instrument's own fixture strings findings.
- **It is a literal search and it says so.** A name assembled at run time is
  invisible to it: `` className={`${x} flex`} ``'s fixed part is read and its
  variable is not, and a name built with `+` is invisible entirely. `cssguard`,
  the closest prior art (`0062`, Rung 4), states the same limit in the same
  words. The boundary guard above checks only the right-hand side. Section 5
  hunts the assembled case in a second pass and states the two limits that pass
  has of its own; the clearance rate there is the evidence that the search was
  run against the right shape, because a report that lists only hits makes its
  own misses unreadable.
- **A `className` on a non-element is a false positive.** The reading takes the
  literal, not the receiver. On this tree the one `className:` object-property
  site turned out to be a real DOM write, which was checked rather than assumed;
  a future one need not be.

## 3. The count

| | `editor-shell.css` | `yunari-page.css` | total |
|---|---|---|---|
| Class selectors | 80 | 17 | **97** |
| `data-*` attribute selectors | 31 | 2 | **33** |
| **Tokens in scope** | **111** | **19** | **130** |

**No token is dead.** 125 of the 130 are applied by production source, and the
class half is the stronger claim: **0 of the 97 class tokens is unapplied** —
every class either file defines is written by production source somewhere. The
remaining **5** are all attributes and none is a class; all five are live
(section 5). One further token, `data-template`, has a production hit only inside
a JSDoc comment and is the same case as the five.

**Clearance rate: 130 of 130 live, 0 dead.** The one removal a reader might
expect from this file already exists and is not a class: `vg-266`'s two `select`
arms (section 7).

**The counts moved since the first reading, and the stylesheet is why.** The
previous table read 84 + 32 + 17 + 2 = 135 at `a7ef0c3a`; Phase 20's token and
elevation work rewrote `editor-shell.css` and retired four classes and one
attribute. The five-token dead list is unchanged.

## 4. The reverse direction: eleven classes production writes that neither file defines

`vg-380` was filed on **one** instance and the row's own detail says the string
`yunari-field-hint` occurs exactly once in the checkout. That is true of the
string. It is not true of the direction: the widened reading finds **eleven**
classes at this reading, and every one is a real DOM class write. The row's
instance is one of them, and the other ten had never been counted.

| Class | Written at | Where its styling comes from instead |
|---|---|---|
| `editor-shell-about` | `settings.tsx` | the same element carries `flex flex-col gap-[…]` |
| `editor-shell-dialog-close` | `components/ui/dialog.tsx` | an unstyled hook; `settings.dom.test.tsx` queries it |
| `editor-shell-publish-live` | `editor-shell/publish-control.tsx` | an unstyled hook inside `.editor-shell-publish-popup`'s column |
| `editor-shell-publish-reason` | `editor-shell/publish-control.tsx` | the same, plus `role="alert"` |
| `editor-shell-rail-slot` | `editor-shell/rail.tsx` | an unstyled hook; `shell-layout.dom.test.tsx` queries it |
| `yunari-angle-indicator` | `indicator-manager/index.ts`, written by `cursor-indicator.ts` | every property is set inline from `CURSOR_INDICATOR_STYLES` |
| `yunari-field-hint` | `controls/settings-field.ts` | **the row's instance** — hidden by the inline `cssText` beside it |
| `yunari-run-label` | `selection-inspector/runs.tsx` | the same element carries `text-xs text-muted` |
| `yunari-run-note` | `runs.tsx` (three sites), `chart-manager/chart-fields.tsx` | utilities on three of its four sites |
| `yunari-run-preview` | `selection-inspector/runs.tsx` | the same element carries `text-xs text-muted` |
| `yunari-size-indicator` | `indicator-manager/index.ts` | the same as the angle indicator |

**Not one of the eleven is a visible defect at this reading**, and that is worth
stating precisely rather than reassuringly: four are unstyled hooks whose layout
comes from a parent rule and which a test queries by name, two are painted
entirely by inline style, one is hidden by the inline `cssText` six lines below
it, and four carry Tailwind utilities on the same element. **The class is
redundant in every case, which is not the same as harmless** — the row's own
argument is that `yunari-field-hint` is harmless *by accident*, because of a
style written six lines away.

**How the denominator was narrowed, because it is the risk.** The reverse
direction's population is every class the production source writes, and at this
reading that is **331** classes. **234** of them are defined by neither file, and
naming all 234 would be a report nobody reads — 223 are outside every namespace
the two stylesheets use, which is Tailwind's vocabulary and other people's hooks,
not a missing stylesheet rule. So a class is in scope when it begins with a
**namespace the two files themselves use**: a leading hyphen-separated segment
appearing on more than one of their class names — `editor-`, `yunari-`,
`theme-`. That is the one thing this repo can do that the prior art cannot
(`0062`, Rung 4: `cssguard` skips expressions, `gulp-check-unused-css` takes an
`ignore` array, `blok` predicates on Tailwind — all hand-kept lists). The 223 are
counted in the report and not named, and the reason is printed with them.

**`data-*` is not covered by the reverse direction, deliberately.** The ruling
names `className`, `classList` and `class=`, which are classes; the forward
direction's attribute half keeps the spelling reading for the reason section 5
gives — an attribute is written through `dataset`'s camelCase form as often as
through its kebab spelling. The asymmetry is recorded in `0062` rather than left
for a reader to find.

## 5. The six cleared as composed or dependency-written

This is Review Focus 1 — the literal is absent and the selector is live. Each is
cleared by a named producer, not by a guess.

| Token | Where the name comes from | Why the search could not see it |
|---|---|---|
| `data-popup-open` | `@base-ui/react@1.8.0` `menu/trigger/MenuTriggerDataAttributes` emits `data-popup-open` / `data-pressed` / `data-disabled`; `shell-layout.tsx`'s `MenuGroup` renders `<Menu.Trigger>` inside `<nav className="editor-shell-menubar">` | the attribute is written by a dependency's own DOM code, so no file in this repo holds the spelling outside the stylesheet |
| `data-checked` | the same package, `menu/radio-item-indicator/MenuRadioItemIndicatorDataAttributes`; `display-switch.tsx` renders `<Menu.RadioItemIndicator className="editor-shell-menu-tick" keepMounted>` | as above; `keepMounted` is what makes the `:not([data-checked])` rule reachable at all |
| `data-active` | the same package, `tabs/tab/TabsTabDataAttributes`; `settings.tsx` renders `<Tabs.Tab className="editor-shell-settings-tab">` | as above |
| `data-yunari-display-screen` | `editor-shell.ts` — `screen.dataset["yunariDisplayScreen"] = ""` | the attribute is written through `dataset`'s camelCase form, so the kebab spelling exists nowhere but the stylesheet and the specs |
| `data-placeholder` | `host/public/theme-list.js` — `box.dataset.placeholder = ""` | as above |
| `data-template` | `host/public/theme-list.js` — `row.dataset.template = template.id` | as above. Its only literal hit in production source is a JSDoc comment in `host/src/themes/templates.ts`, which is why it does not appear in the command's zero list |

### The composition search, so the clearance rate is visible

The instrument cannot see a name assembled at run time, so the assembled ones
were hunted separately rather than assumed absent. **This pass is still a pasted
command rather than part of the script**: it is a second pass, not the
instrument, and widening it was not ruled. It reads every backtick string in
`src/web` that contains an interpolation and reports the ones holding any of the
130 tokens:

```sh
node -e 'const fs=require("fs"),path=require("path");const ROOT="D:/git-repos/yunari";const CSS=[ROOT+"/src/web/packages/editor/src/editor-shell/editor-shell.css",ROOT+"/src/web/packages/host/public/yunari-page.css"];const SKIP=["node_modules","dist",".git",".vite","coverage","test-results","playwright-report",".agent-scratch",".superpowers",".codegraph",".e2e-host-app"];const strip=s=>{let o="",i=0;for(;;){const a=s.indexOf("/*",i);if(a<0){o+=s.slice(i);break}o+=s.slice(i,a);const b=s.indexOf("*/",a+2);i=b<0?s.length:b+2}return o};const toks=[];for(const f of CSS){const t=strip(fs.readFileSync(f,"utf8"));for(const m of t.matchAll(new RegExp("[.]([A-Za-z_-][A-Za-z0-9_-]*)","g")))toks.push(m[1]);for(const m of t.matchAll(new RegExp("[[]data-[A-Za-z0-9_-]+","g")))toks.push(m[0].slice(1))}const set=[...new Set(toks)];const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(SKIP.includes(e.name))continue;const p=d+"/"+e.name;if(e.isDirectory()){w(p);continue}const x=path.extname(e.name).toLowerCase();if([".ts",".tsx",".js",".jsx",".mjs",".cjs",".html",".htm"].includes(x))files.push(p)}})(ROOT+"/src/web");let hits=0;for(const f of files){const t=fs.readFileSync(f,"utf8");let i=0;for(;;){const a=t.indexOf("`",i);if(a<0)break;const b=t.indexOf("`",a+1);if(b<0)break;i=b+1;const lit=t.slice(a+1,b);if(lit.indexOf("${")<0)continue;for(const k of set){const idx=lit.indexOf(k);if(idx<0)continue;const after=lit.slice(idx+k.length,idx+k.length+1);if(after&&/[A-Za-z0-9_-]/.test(after))continue;console.log("COMPOSED "+k+"   in "+path.relative(ROOT,f).split(path.sep).join("/")+"   literal: "+lit.slice(0,110).split("\n").join(" "));hits++}}}console.log("composed-name sites reaching a token in the two files: "+hits)'
```

Output at the first reading: **38 sites, and not one of them composes a name.**
They are three shapes, all three read, and the command prints the token, file and
literal for each so the split below can be re-derived from its output:

- **18 spell the token as ordinary vocabulary** — the token is a common English
  word (`by`, `current`, `hint`) inside a message: `describes itself by its
  hint`, `"${id}" was changed by someone else…`, `the panel matched the current
  frame on …`. One is a JS identifier
  (`uiCopy.diagnostics[current.severity]`, `diagnostic-message.tsx`) and one a
  path segment (`docs/design/mockups/current/${entry}`, `mockup-values.ts`).
- **13 are a selector template whose fixed part is the token and whose
  interpolation is a VALUE** — `[data-yunari-panel="${panel}"]`,
  `.editor-shell-rail button[data-rail-slot="${id}"]`,
  `[data-yunari-layer="${id}"] .yunari-layer-role`,
  `button.theme-option[data-theme="${id}"]`, `[data-shell-palette="${palette}"]`.
  The name is written whole; the variable is what the attribute is set to, so
  the token is live by the fixed part.
- **7 are boundary collisions — this pass's own false positives.** The guard
  `(?![A-Za-z0-9_-])` checks the right-hand side only, so a token that *ends*
  the matched run while an identifier continues on its *left* matches anyway:
  `control-well.tsx`'s `${control}-hint`, `settings-field.ts`'s `${id}-hint` and
  `chart-fields.dom.test.tsx`'s `${control.id}-hint` (twice) match the token
  `hint` inside a generated `-hint` id; `kind-mark.dom.test.tsx`'s
  `[data-yunari-layer-mark="${mark.kind}"]` (twice) matches `yunari-layer-mark`
  inside the longer attribute name; `glass.dom.test.ts`'s `[id="${labelledby}"]`
  matches `by` inside the variable name. None of the seven composes a stylesheet
  name: the `-hint` sites build an `aria-describedby` id, not a class.

**The two limits of this pass, stated rather than left to the reader.** It reads
**backtick literals only** — a name built with `+`, or by any other route that
never spells it whole in a backtick, is invisible to it. And its boundary guard
is **right-side-only**, which is exactly the seven collisions above. Both gaps
are unexercised on this tree, and those are searches rather than an impression.
Over `src/web` (no `node_modules`, no `dist`), with the source extensions the
sweep itself reads:

```sh
grep -rnE '"[a-z][a-z-]*"[[:space:]]*\+|[[:space:]]\+[[:space:]]*"[a-z][a-z-]*"' src/web --include=*.ts --include=*.tsx --include=*.js --include=*.jsx --include=*.mjs --include=*.cjs --include=*.html --include=*.htm --exclude-dir=node_modules --exclude-dir=dist
grep -rnE 'classList\.(add|remove|toggle)' src/web --include=*.ts --include=*.tsx --include=*.js --include=*.jsx --include=*.mjs --include=*.cjs --exclude-dir=node_modules --exclude-dir=dist
```

Both return nothing — no `+` composes a name here, and nothing calls
`classList.add`/`remove`/`toggle` at all (every `classList` use in the repo is
`classList.contains` inside a `*.dom.test.*` file). So the rate below stands for
these shapes on this tree — not because the pass covers them. The instrument
reads `classList` writes all the same: the ruling names them, and a reading that
only worked on a tree with none would be untested the day one arrives.

Nothing in production builds one of these 130 names from fragments. The other
`dataset[…]` writes in production — `shellPalette`, `yunariPanel`,
`yunariChartSetting`, `yunariText`, `nodeId` — produce attributes this file
does not style, except `data-shell-palette` and `data-yunari-panel`, which the
literal search already sees; and the `className={\`…${…}\`}` sites compose
Tailwind utilities owned by the `components/ui/` layer, none of them a name in
either stylesheet.

## 6. The second instrument: the attribute *values*

A token can be live while the selector that uses it still matches nothing,
because the attribute is written but never with that value. A second command —
still a pasted one, not part of the script, for the same reason as the
composition pass — extracts every `[name="value"]` pair from both files and asks
whether the value literal occurs in production source. It searches **no
stylesheet**, for the reason the forward direction gives: a file must not prove
its own selector live.

```sh
node -e 'const fs=require("fs"),path=require("path");const Q=String.fromCharCode(34);const ROOT="D:/git-repos/yunari";const CSS=[ROOT+"/src/web/packages/editor/src/editor-shell/editor-shell.css",ROOT+"/src/web/packages/host/public/yunari-page.css"];const SKIP=["node_modules","dist",".git",".vite","coverage","test-results","playwright-report",".agent-scratch",".superpowers",".codegraph",".e2e-host-app"];const strip=s=>{let o="",i=0;for(;;){const a=s.indexOf("/*",i);if(a<0){o+=s.slice(i);break}o+=s.slice(i,a);const b=s.indexOf("*/",a+2);i=b<0?s.length:b+2}return o};const pairs=new Set();for(const f of CSS){const t=strip(fs.readFileSync(f,"utf8"));let i=0;for(;;){const a=t.indexOf("[",i);if(a<0)break;const b=t.indexOf("]",a);i=b<0?t.length:b+1;const seg=t.slice(a+1,b);if(seg.indexOf("=")>0)pairs.add(seg)}}const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(SKIP.includes(e.name))continue;const p=d+"/"+e.name;if(e.isDirectory()){w(p);continue}const x=path.extname(e.name).toLowerCase();if([".ts",".tsx",".js",".jsx",".mjs",".cjs",".html",".htm"].includes(x))files.push(p)}})(ROOT+"/src/web");const prod=files.filter(f=>{const q=path.relative(ROOT,f).split(path.sep).join("/");return !(q.indexOf("/tests/")>=0||q.indexOf(".test.")>=0||q.indexOf(".spec.")>=0||q.toLowerCase().indexOf("fixture")>=0)});const body=prod.map(f=>fs.readFileSync(f,"utf8"));console.log("attribute-value selector pairs in the two files: "+pairs.size);for(const pr of [...pairs].sort()){const i=pr.indexOf("=");const nm=pr.slice(0,i);let v=pr.slice(i+1);if(v.slice(0,1)===Q)v=v.slice(1,-1);let n=0;const where=[];for(let k=0;k<body.length;k++){if(body[k].indexOf(v)>=0){n++;if(where.length<3)where.push(path.relative(ROOT,prod[k]).split(path.sep).join("/"))}}console.log((n===0?"  NONE  ":"  live  ")+(nm+"="+Q+v+Q).padEnd(42)+" production files with the bare value: "+n+(n&&n<12?"   "+where.join(" "):""))}'
```

Output: **26 pairs, two with zero hits.**

```
attribute-value selector pairs in the two files: 26
  live  aria-pressed="true"                        production files with the bare value: 164
  live  data-collapsed="true"                      production files with the bare value: 164
  live  data-context="false"                       production files with the bare value: 144
  live  data-dirty="true"                          production files with the bare value: 164
  live  data-drop="refused"                        production files with the bare value: 68
  live  data-drop="slot"                           production files with the bare value: 29
  live  data-fitted="true"                         production files with the bare value: 164
  live  data-hidden="true"                         production files with the bare value: 164
  live  data-kind="group"                          production files with the bare value: 90
  live  data-selected="true"                       production files with the bare value: 164
  live  data-severity="error"                      production files with the bare value: 79
  live  data-shell-palette="editorial"             production files with the bare value: 2   src/web/packages/editor/src/editor-shell/palette.ts src/web/packages/editor/src/font-trios.generated.ts
  live  data-shell-palette="ember"                 production files with the bare value: 41
  live  data-shell-palette="graphite"              production files with the bare value: 3   src/web/packages/editor/index.html src/web/packages/editor/src/components/ui/control-slider.tsx src/web/packages/editor/src/editor-shell/palette.ts
  live  data-shell-palette="light"                 production files with the bare value: 22
  live  data-shell-palette="moss"                  production files with the bare value: 1   src/web/packages/editor/src/editor-shell/palette.ts
  live  data-shell-palette="plum"                  production files with the bare value: 1   src/web/packages/editor/src/editor-shell/palette.ts
  live  data-yunari-panel="layers"                production files with the bare value: 9   src/web/packages/editor/src/components/ui/control-select.tsx src/web/packages/editor/src/editor-shell/bridge.ts src/web/packages/editor/src/editor-shell/shell-layout.tsx
  live  data-visible="true"                        production files with the bare value: 164
  live  role="alert"                               production files with the bare value: 4   src/web/packages/editor/src/editor-shell/controls/number-field.ts src/web/packages/editor/src/editor-shell/publish-control.tsx src/web/packages/editor/src/editor-shell/settings-keyboard.tsx
  live  role="menuitem"                            production files with the bare value: 1   src/web/packages/editor/src/viewport-manager/navigation.ts
  NONE  role="menuitemradio"                       production files with the bare value: 0
  NONE  role="tabpanel"                            production files with the bare value: 0
  live  role="tree"                                production files with the bare value: 50
  live  type="number"                              production files with the bare value: 187
  live  type="range"                               production files with the bare value: 31
```

The two zero rows are **`role="menuitemradio"`** and **`role="tabpanel"`**, and
section 7 carries them: they are written by Base UI on the element it renders,
not spelled in this repo, so no search over source can find them.

The remaining counts are only evidence for the distinctive values; for `true`,
`false`, `error`, `group`, `number` and `range` the bare string is ordinary
vocabulary and the count is noise. The pairs that carry weight were read at
their producer instead of counted:

- The six `data-shell-palette` values are the six members of `SHELL_PALETTES`
  (`editor-shell/src/palette.ts`), written by `palette.ts`
  (`document.documentElement.dataset["shellPalette"] = palette`).
- `data-yunari-panel="layers"` — the value is the pane `id`: `shell-layout.tsx`
  passes `id="layers"` to `<Pane>`, and `pane.tsx` writes
  `data-yunari-panel={id}`. `references.tsx` and `selection-inspector/index.ts`
  write the other two (`style`, `selection`) through `dataset["yunariPanel"]`.
- The React boolean writes — `data-dirty={dirty}`, `data-hidden={!row.visible}`,
  `data-selected={row.selected}`, `data-collapsed={collapsed}`,
  `data-visible={bridge !== undefined}`, `data-fitted={fitted}` — serialise to
  the `"true"` / `"false"` literals the stylesheet names, so no source line
  spells them.
- `data-drop="slot"` / `"refused"` — the parameter is typed
  `state: "slot" | "refused" | undefined` and written at `composition-pane.tsx`.
- `data-kind="group"` — `row.kind`, whose union includes `"group"`
  (`composition-pane.tsx`, `kind-mark.tsx`).
- `data-severity="error"` — `type DiagnosticSeverity = "error" | "warning"`
  (`diagnostic-message.tsx`).

## 7. Adjacent selectors, reported but not itemised

The forward direction is scoped to classes and `data-*` attributes. Three kinds
of selector sit beside them in the same file, and a reader arriving with one
should know what was and was not measured.

- **Element selectors.** Not counted above. **The two known-dead terms of
  `vg-266` are no longer in the file**: no selector mentioning
  `editor-shell-inspector` or `editor-shell-panel` carries a `select`. What
  survives is four arms: `.editor-shell select`, the `select` arm of the `:is(…)`
  focus rule, and `.yunari-field select` and `.yunari-field-row select`.
  `settings-field.ts` holds the only `document.createElement("select")` **under
  `.editor-shell`**: `grep -rn 'createElement("select")'` over
  `src/web/packages/editor/src` returns it alone. The same search over
  `src/web/packages` returns two more, `host/public/settings.html`, the host's
  own settings page, which loads `yunari-page.css`, not this stylesheet. The
  material point is the import graph: `settingsField` is imported by
  `controls.dom.test.ts` and `copy-defects.test.ts` alone, and its production
  importers (`chart-manager/panel.ts`) take only the `isSettingVisible` predicate.
  That is a read of the import graph, **not** a browser measurement; `vg-266`
  owns the browser half, and the four surviving arms are recorded there.
- **`role=` selectors.** `[role="menuitemradio"]` and `[role="tabpanel"]` have
  no literal producer in this repo either; both are emitted by Base UI
  (`menu/radio-item/MenuRadioItem.js`, `tabs/panel/TabsPanel.js`), the same
  mechanism as section 5. These two are also the two rows section 6 records as
  zero hits — that instrument is what found them, and this section is what
  clears them. `[role="tree"]`, `[role="alert"]` and `[role="menuitem"]` are
  written by the product.
- **`id` selectors.** All three are live: `#app` (`editor/index.html`),
  `#canvas-host` (`shell-layout.tsx`), `#yunari-fabric-editor`
  (`editor-shell.ts`).

**Out of scope by the brief's own instruction:** the `--yunari-*` / `--shell-*`
custom properties. They are design tokens with their own owner and their own
gate (`scripts/design-tokens.mjs`), and `vg-357` owns an open defect in them.

## 8. What could not be established

- **Whether live code ever renders some of these elements.** This check proves
  a class is *applied* by production source, not that the element carrying it is
  mounted. A class applied on a branch nothing reaches would pass it. Only a
  rendered inspection can settle that, and this task ran no browser.
- **Whether a written class that no stylesheet defines is a defect.** The
  reverse direction reports eleven; whether any of them *should* have a rule is a
  judgement per site, and section 4 gives the per-site reason each is currently
  redundant rather than deciding for a future one.
- **A class applied only by a `className` expression this cannot read.** A name
  built at run time is invisible (section 2), so the reverse direction's 331 is a
  floor rather than a count of everything the product applies.
- **Whether a compound is dead while its class is live.** The unit here is the
  class or attribute name. `[data-drop="refused"]` and `"slot"` were checked at
  their producer, but no other compound selector was decomposed; a
  `.editor-shell-keyboard [data-armed] kbd`-shaped rule whose middle term never
  co-occurs would not be caught.
- **Two files only.** Any class in a Tailwind utility, in a `@theme` block, or
  generated by `@source inline("bg-shell-surface")` is outside the extraction:
  that directive asks Tailwind for a class no source file writes, and it is live
  by construction, not by this search.
- **A dependency writing a name it does not declare in its own source.** The
  three Base UI attributes were confirmed against the installed package's
  `*DataAttributes` modules (`@base-ui/react@1.8.0`) rather than against
  behaviour; a library that emitted a name from a table would not be visible
  there either.
- **The literals in `yunari-page.css` are reached through the host's own DOM
  code** (`host/public/theme-list.js`), which is not TypeScript and is in no
  tsconfig. Its three `dataset` writes were read in full — `placeholder`,
  `template`, `theme` — and `data-theme` is styled by neither stylesheet.
