# Dead selectors

A reachability check **of** the two stylesheets the product ships, taken at
`a7ef0c3a` on 2026-10-12. It answers one question — which class and `data-*`
attribute selectors in those files are matched by nothing — so that the dead-code
sweep's removal phase has a list to act on instead of an instinct.

**Both files it reads are unchanged between `a7ef0c3a` and the commit this
document landed on**: `git diff --stat a7ef0c3a HEAD --
src/web/packages/editor/src/editor-shell/editor-shell.css
src/web/packages/host/public/vigilia-page.css` is empty. The commit history
around it moved `STATUS.md` and the register, not the stylesheets.

**This document modifies nothing.** Nothing here has been deleted, and the list
it produces is empty.

## 1. Why this lane needs naming at all

Only **two** CSS files ship (`editor-shell.css`, and the host's own pages'
`vigilia-page.css`), so this does not want a scanner framework. It wants naming
because nothing else can see the problem:

- `editor-shell.css` is the **largest hand-written, non-test source file in the
  repo** — 2,558 lines by `wc -l`, 2,559 by the line convention
  [`manager-census.md`](manager-census.md) states; the only larger files are the
  generated `font-trios.generated.ts` (28,284) and three e2e specs. `vg-274`
  records that it is in **no gate**: the design-token ratchet parses CSS, and its
  `gated` list names no `.css` file.
- `vg-266` records a dead selector in this very file, found by hand.
- A dead selector is invisible to `typecheck`, to Biome (which parses CSS but
  has no unused-selector rule) and to every test that does not query the class
  by name — and a test that queries a dead class by name only fails if it
  asserts a hit, not if it asserts a miss.

## 2. The instrument

One command, re-runnable, no script to keep in step with the file it reads. It
extracts every class and `data-*` attribute name from both stylesheets, then
looks for each one's spelling across the workspace, bucketing each hit by what
kind of file it landed in.

```sh
node -e 'const fs=require("fs"),path=require("path");const ROOT="D:/git-repos/vigilia";const CSS=ROOT+"/src/web/packages/editor/src/editor-shell/editor-shell.css";const CSS2=ROOT+"/src/web/packages/host/public/vigilia-page.css";const SKIP=["node_modules","dist",".git",".vite","coverage","test-results","playwright-report",".agent-scratch",".superpowers",".codegraph","build",".cache",".turbo",".e2e-host-app"];const EXTS=[".ts",".tsx",".js",".jsx",".mjs",".cjs",".html",".htm",".css",".md",".json",".jsonl",".svg",".txt"];const strip=s=>{let o="",i=0;for(;;){const a=s.indexOf("/*",i);if(a<0){o+=s.slice(i);break}o+=s.slice(i,a);const b=s.indexOf("*/",a+2);i=b<0?s.length:b+2}return o};const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(SKIP.includes(e.name))continue;const p=d+"/"+e.name;if(e.isDirectory()){w(p);continue}if(EXTS.includes(path.extname(e.name).toLowerCase()))files.push(p)}})(ROOT);const scan=f=>{const t=strip(fs.readFileSync(f,"utf8"));const n=[...t.matchAll(new RegExp("[.]([A-Za-z_-][A-Za-z0-9_-]*)","g"))].map(m=>m[1]);const a=[...t.matchAll(new RegExp("[[]data-[A-Za-z0-9_-]+","g"))].map(m=>m[0].slice(1));return [new Set(n),new Set(a)]};const [n1,a1]=scan(CSS),[n2,a2]=scan(CSS2);const items=[...n1].map(t=>({t,k:"class",o:CSS})).concat([...a1].map(t=>({t,k:"attr",o:CSS})),[...n2].map(t=>({t,k:"class",o:CSS2})),[...a2].map(t=>({t,k:"attr",o:CSS2})));const C=files.map(f=>[f,fs.readFileSync(f,"utf8")]);const bucket=p=>{const q=p.split(path.sep).join("/");if(q.startsWith("docs/")||q.indexOf("/docs/")>=0)return "DOC";if(q.indexOf("/tests/")>=0||q.indexOf(".test.")>=0||q.indexOf(".spec.")>=0||q.indexOf("test-stage")>=0||q.toLowerCase().indexOf("fixture")>=0)return "TEST";if(q.startsWith("scripts/"))return "SCRIPT";if(q.endsWith(".css")||q.endsWith(".svg")||q.endsWith(".html")||q.endsWith(".htm"))return "STYLE";return "PRODUCT"};console.log("editor-shell.css: classes="+n1.size+" dataAttrs="+a1.size+"  vigilia-page.css: classes="+n2.size+" dataAttrs="+a2.size+"  total="+items.length);const zero=[];for(const it of items){const re=new RegExp(it.t+"(?![A-Za-z0-9_-])");const b={PRODUCT:0,TEST:0,SCRIPT:0,DOC:0,STYLE:0};for(const [f,t] of C){if(path.normalize(f)===path.normalize(it.o))continue;if(re.test(t))b[bucket(path.relative(ROOT,f))]++}if(b.PRODUCT===0)zero.push(it.t+"  ("+it.k+", "+path.basename(it.o)+")  test="+b.TEST+" script="+b.SCRIPT+" doc="+b.DOC+" style="+b.STYLE)}console.log("tokens with ZERO production-source hits: "+zero.length);zero.forEach(z=>console.log("  "+z))'
```

Its output at `a7ef0c3a`, verbatim:

```
editor-shell.css: classes=84 dataAttrs=32  vigilia-page.css: classes=17 dataAttrs=2  total=135
tokens with ZERO production-source hits: 5
  data-popup-open  (attr, editor-shell.css)  test=0 script=0 doc=0 style=0
  data-checked  (attr, editor-shell.css)  test=1 script=0 doc=0 style=0
  data-active  (attr, editor-shell.css)  test=2 script=0 doc=0 style=0
  data-vigilia-display-screen  (attr, editor-shell.css)  test=1 script=0 doc=2 style=0
  data-placeholder  (attr, vigilia-page.css)  test=1 script=0 doc=0 style=0
```

Two notes for a reader reproducing it: run it under a POSIX shell (Git Bash,
`sh`), not `cmd.exe`, which does not quote with `'`; and the `doc` column counts
documents *including this one*, so it reads one higher now than it did when the
run was taken. The `PRODUCT` column — the one the finding rests on — is
unaffected.

### Why this search is sufficient, and where it stops

- **Root and scope.** The whole checkout, not a package: `src/web/tests/e2e/`
  belongs to no package, and a package-scoped search cannot see it. `.mjs` files
  sit in no tsconfig and are in scope for the same reason.
- **Skipped:** `node_modules`, `dist`, `.git`, `.vite`, `coverage`,
  `test-results`, `playwright-report`, `.agent-scratch`, `.superpowers`,
  `.codegraph`, `.e2e-host-app` and build caches. `.superpowers` is skipped
  because plan prose is not evidence about the product; the plan workspace's own
  files are read by hand in section 4 instead.
- **The owning file is excluded per token**, so a stylesheet does not prove its
  own selector live. This matters here: `editor-shell.css` names
  `.editor-shell-palette-swatch` in a selector list it also defines, and
  `vigilia-page.css` names `.theme-row` in two rules.
- **Comments are stripped before extraction and before matching.** The file's
  own prose names classes constantly, and a class named only in a comment is not
  a class the product applies — the same trap `editor-shell.css:517-524` records
  for the `bg-shell-surface` utility, which exists only because a comment
  happens to contain the string.
- **The boundary is `(?![A-Za-z0-9_-])`**, so `editor-shell-pane` is not
  counted inside `editor-shell-panel`, and `data-drop` is not counted inside
  `data-dragging`. A bare substring count over-reports on this file, where
  prefix families share long stems.
- **Buckets.** `PRODUCT` is a source file in `src/web` that is not a test, a
  spec, a test stage or a fixture; `TEST` is `*.test.*`, `*.spec.*`, `/tests/`,
  a `test-stage` or a fixture; `SCRIPT` is `scripts/`; `DOC` is `docs/`;
  `STYLE` is another `.css`, `.svg` or `.html`. The bucket is what separates
  "the product applies this" from "a document mentions this".
- **It is a literal search and it says so.** A name assembled at run time is
  invisible to it. Section 4 is that gap closed by hand; the clearance rate there is
  the evidence that the search was run against the right shape, because a report
  that lists only hits makes its own misses unreadable.

## 3. The count

| | `editor-shell.css` | `vigilia-page.css` | total |
|---|---|---|---|
| Class selectors | 84 | 17 | **101** |
| `data-*` attribute selectors | 32 | 2 | **34** |
| **Tokens in scope** | **116** | **19** | **135** |

**No token is dead.** 130 of the 135 are named by a production source file
outright. The remaining **5** — every one an attribute, none a class — have no
production-source spelling at all, and **all five are live** (section 4). One further
token, `data-template`, has a production hit only inside a JSDoc comment and is
the same case as the five.

**Clearance rate: 135 of 135 live, 0 dead.** The one removal a reader might
expect from this file already exists and is not a class: `vg-266`'s two
`select` arms (section 6).

## 4. The six cleared as composed or dependency-written

This is Review Focus 1 — the literal is absent and the selector is live. Each is
cleared by a named producer, not by a guess.

| Token | Where the name comes from | Why the search could not see it |
|---|---|---|
| `data-popup-open` | `@base-ui/react@1.8.0` `menu/trigger/MenuTriggerDataAttributes` emits `data-popup-open` / `data-pressed` / `data-disabled`; `shell-layout.tsx`'s `MenuGroup` renders `<Menu.Trigger>` inside `<nav className="editor-shell-menubar">` | the attribute is written by a dependency's own DOM code, so no file in this repo holds the spelling outside the stylesheet |
| `data-checked` | the same package, `menu/radio-item-indicator/MenuRadioItemIndicatorDataAttributes`; `display-switch.tsx:271` renders `<Menu.RadioItemIndicator className="editor-shell-menu-tick" keepMounted>` | as above; `keepMounted` is what makes the `:not([data-checked])` rule reachable at all |
| `data-active` | the same package, `tabs/tab/TabsTabDataAttributes`; `settings.tsx:363` renders `<Tabs.Tab className="editor-shell-settings-tab">` | as above |
| `data-vigilia-display-screen` | `editor-shell.ts:536` — `screen.dataset["vigiliaDisplayScreen"] = ""` | the attribute is written through `dataset`'s camelCase form, so the kebab spelling exists nowhere but the stylesheet and the specs |
| `data-placeholder` | `host/public/theme-list.js:26` — `box.dataset.placeholder = ""` | as above |
| `data-template` | `host/public/theme-list.js:175` — `row.dataset.template = template.id` | as above. Its only literal hit in production source is a JSDoc comment in `host/src/themes/templates.ts:20`, which is why it does not appear in the command's zero list |

### The composition search, so the clearance rate is visible

The command above cannot see a name assembled at run time, so the assembled ones
were hunted separately rather than assumed absent. This command reads every
backtick string in `src/web` that contains an interpolation and reports the ones
holding any of the 135 tokens:

```sh
node -e 'const fs=require("fs"),path=require("path");const ROOT="D:/git-repos/vigilia";const CSS=[ROOT+"/src/web/packages/editor/src/editor-shell/editor-shell.css",ROOT+"/src/web/packages/host/public/vigilia-page.css"];const SKIP=["node_modules","dist",".git",".vite","coverage","test-results","playwright-report",".agent-scratch",".superpowers",".codegraph",".e2e-host-app"];const strip=s=>{let o="",i=0;for(;;){const a=s.indexOf("/*",i);if(a<0){o+=s.slice(i);break}o+=s.slice(i,a);const b=s.indexOf("*/",a+2);i=b<0?s.length:b+2}return o};const toks=[];for(const f of CSS){const t=strip(fs.readFileSync(f,"utf8"));for(const m of t.matchAll(new RegExp("[.]([A-Za-z_-][A-Za-z0-9_-]*)","g")))toks.push(m[1]);for(const m of t.matchAll(new RegExp("[[]data-[A-Za-z0-9_-]+","g")))toks.push(m[0].slice(1))}const set=[...new Set(toks)];const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(SKIP.includes(e.name))continue;const p=d+"/"+e.name;if(e.isDirectory()){w(p);continue}const x=path.extname(e.name).toLowerCase();if([".ts",".tsx",".js",".jsx",".mjs",".cjs",".html",".htm"].includes(x))files.push(p)}})(ROOT+"/src/web");let hits=0;for(const f of files){const t=fs.readFileSync(f,"utf8");let i=0;for(;;){const a=t.indexOf("`",i);if(a<0)break;const b=t.indexOf("`",a+1);if(b<0)break;i=b+1;const lit=t.slice(a+1,b);if(lit.indexOf("${")<0)continue;for(const k of set){const idx=lit.indexOf(k);if(idx<0)continue;const after=lit.slice(idx+k.length,idx+k.length+1);if(after&&/[A-Za-z0-9_-]/.test(after))continue;console.log("COMPOSED "+k+"   in "+path.relative(ROOT,f).split(path.sep).join("/")+"   literal: "+lit.slice(0,110).split("\n").join(" "));hits++}}}console.log("composed-name sites reaching a token in the two files: "+hits)'
```

Output: **38 sites, and not one of them composes a name.** They fall into two
groups, and both were read:

- **English prose inside a template** — `${label}: ${current}`,
  `"${id}" was changed by someone else…`, `describes itself by its hint`. The
  token is a word in a sentence, in `hint`, `by` and `current`'s case.
- **A test selector whose fixed part is the token and whose interpolation is a
  VALUE** — `[data-vigilia-panel="${panel}"]`,
  `.editor-shell-rail button[data-rail-slot="${id}"]`,
  `[data-vigilia-layer="${id}"] .vigilia-layer-role`. The name is written whole;
  the variable is what the attribute is set to, so the token is live by the
  fixed part.

Nothing in production builds one of these 135 names from fragments. The other
`dataset[…]` writes in production — `shellPalette`, `vigiliaPanel`,
`vigiliaChartSetting`, `vigiliaText`, `nodeId` — produce attributes this file
does not style, except `data-shell-palette` and `data-vigilia-panel`, which the
literal search already sees; and the `className={\`…${…}\`}` sites compose
Tailwind utilities owned by the `components/ui/` layer, none of them a name in
either stylesheet.

## 5. The second instrument: the attribute *values*

A token can be live while the selector that uses it still matches nothing,
because the attribute is written but never with that value. A second command
extracts every `[name="value"]` pair from both files and asks whether the value
literal occurs in production source:

```sh
node -e 'const fs=require("fs"),path=require("path");const Q=String.fromCharCode(34);const ROOT="D:/git-repos/vigilia";const CSS=[ROOT+"/src/web/packages/editor/src/editor-shell/editor-shell.css",ROOT+"/src/web/packages/host/public/vigilia-page.css"];const SKIP=["node_modules","dist",".git",".vite","coverage","test-results","playwright-report",".agent-scratch",".superpowers",".codegraph",".e2e-host-app"];const strip=s=>{let o="",i=0;for(;;){const a=s.indexOf("/*",i);if(a<0){o+=s.slice(i);break}o+=s.slice(i,a);const b=s.indexOf("*/",a+2);i=b<0?s.length:b+2}return o};const pairs=new Set();for(const f of CSS){const t=strip(fs.readFileSync(f,"utf8"));let i=0;for(;;){const a=t.indexOf("[",i);if(a<0)break;const b=t.indexOf("]",a);i=b<0?t.length:b+1;const seg=t.slice(a+1,b);if(seg.indexOf("=")>0)pairs.add(seg)}}const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(SKIP.includes(e.name))continue;const p=d+"/"+e.name;if(e.isDirectory()){w(p);continue}const x=path.extname(e.name).toLowerCase();if([".ts",".tsx",".js",".jsx",".mjs",".cjs",".html",".htm",".css"].includes(x))files.push(p)}})(ROOT+"/src/web");const prod=files.filter(f=>{const q=path.relative(ROOT,f).split(path.sep).join("/");return !(q.indexOf("/tests/")>=0||q.indexOf(".test.")>=0||q.indexOf(".spec.")>=0||q.toLowerCase().indexOf("fixture")>=0)});const body=prod.map(f=>fs.readFileSync(f,"utf8"));console.log("attribute-value selector pairs in the two files: "+pairs.size);for(const pr of [...pairs].sort()){const i=pr.indexOf("=");const nm=pr.slice(0,i);let v=pr.slice(i+1);if(v.slice(0,1)===Q)v=v.slice(1,-1);let n=0;const where=[];for(let k=0;k<body.length;k++){if(body[k].indexOf(v)>=0){n++;if(where.length<3)where.push(path.relative(ROOT,prod[k]).split(path.sep).join("/"))}}console.log((n===0?"  NONE  ":"  live  ")+(nm+"="+Q+v+Q).padEnd(42)+" production files with the bare value: "+n+(n&&n<12?"   "+where.join(" "):""))}'
```

Output: **26 pairs, none with zero hits.** The counts are only evidence for the
distinctive values; for `true`, `false`, `error`, `group`, `number` and `range`
the bare string is ordinary vocabulary and the count is noise. The pairs that
carry weight were read at their producer instead of counted:

- The six `data-shell-palette` values are the six members of `SHELL_PALETTES`
  (`editor-shell/src/palette.ts:4-9`), written by `palette.ts:106`
  (`document.documentElement.dataset["shellPalette"] = palette`).
- `data-vigilia-panel="layers"` — the value is the pane `id`: `shell-layout.tsx:804`
  passes `id="layers"` to `<Pane>`, and `pane.tsx:41` writes
  `data-vigilia-panel={id}`. `references.tsx:80` and
  `selection-inspector/index.ts:154` write the other two (`style`, `selection`)
  through `dataset["vigiliaPanel"]`.
- The React boolean writes — `data-dirty={dirty}`, `data-hidden={!row.visible}`,
  `data-selected={row.selected}`, `data-collapsed={collapsed}`,
  `data-visible={bridge !== undefined}`, `data-fitted={fitted}` — serialise to
  the `"true"` / `"false"` literals the stylesheet names, so no source line
  spells them.
- `data-drop="slot"` / `"refused"` — the parameter is typed
  `state: "slot" | "refused" | undefined` and written at
  `composition-pane.tsx:288`.
- `data-kind="group"` — `row.kind`, whose union includes `"group"`
  (`composition-pane.tsx:36`, `kind-mark.tsx:128`).
- `data-severity="error"` — `type DiagnosticSeverity = "error" | "warning"`
  (`diagnostic-message.tsx:7`).

## 6. Adjacent selectors, reported but not itemised

The brief scopes this check to classes and `data-*` attributes. Three kinds of
selector sit beside them in the same file, and a reader arriving with one should
know what was and was not measured.

- **Element selectors.** Not counted above. **The two known-dead terms of
  `vg-266` are no longer in the file**: `grep -n 'editor-shell-inspector'
  editor-shell.css | grep -i select` and the same for `editor-shell-panel` both
  return nothing at HEAD. What survives is shell-wide: `.editor-shell select`
  (`:1321`), the `select` arm of the `:is(…)` focus rule (`:1341`),
  `.vigilia-field select` and `.vigilia-field-row select` (`:1763`, `:1766`).
  `settings-field.ts:196` still holds the only `document.createElement("select")`
  in the packages, and its production importers take only the `isSettingVisible`
  predicate — `settingsField` itself is imported by `controls.dom.test.ts` and
  `copy-defects.test.ts` alone. That is a read of the import graph, **not** a
  browser measurement; `vg-266` owns the browser half and should be retitled to
  the shell-wide arms rather than closed.
- **`role=` selectors.** `[role="menuitemradio"]` and `[role="tabpanel"]` have
  no literal producer in this repo either; both are emitted by Base UI
  (`menu/radio-item/MenuRadioItem.js`, `tabs/panel/TabsPanel.js`), the same
  mechanism as section 4. `[role="tree"]`, `[role="alert"]` and `[role="menuitem"]` are
  written by the product.
- **`id` selectors.** All three are live: `#app` (`editor/index.html:41`),
  `#canvas-host` (`shell-layout.tsx:603`), `#vigilia-fabric-editor`
  (`editor-shell.ts:149`).

**Out of scope by the brief's own instruction:** the `--vigilia-*` / `--shell-*`
custom properties. They are design tokens with their own owner and their own
gate (`scripts/design-tokens.mjs`), and `vg-357` owns an open defect in them.

## 7. What could not be established

- **Whether live code ever renders some of these elements.** This check proves
  a class is *spelled* in production source, not that the element carrying it is
  mounted. A class applied on a branch nothing reaches would pass it. Only a
  rendered inspection can settle that, and this task ran no browser.
- **Whether a compound is dead while its class is live.** The unit here is the
  class or attribute name. `[data-drop="refused"]` and `"slot"` were checked at
  their producer, but no other compound selector was decomposed; a
  `.editor-shell-keyboard [data-armed] kbd`-shaped rule whose middle term never
  co-occurs would not be caught.
- **Two files only.** Any class in a Tailwind utility, in a `@theme` block, or
  generated by `@source inline("bg-shell-surface")` (`editor-shell.css:525`) is
  outside the extraction: that directive asks Tailwind for a class no source
  file writes, and it is live by construction, not by this search.
- **A dependency writing a name it does not declare in its own source.** The
  three Base UI attributes were confirmed against the installed package's
  `*DataAttributes` modules (`@base-ui/react@1.8.0`) rather than against
  behaviour; a library that emitted a name from a table would not be visible
  there either.
- **The literals in `vigilia-page.css` are reached through the host's own DOM
  code** (`host/public/theme-list.js`), which is not TypeScript and is in no
  tsconfig. Its three `dataset` writes were read in full — `:26`
  (`placeholder`), `:175` (`template`), `:190` (`theme`) — and `data-theme` is
  styled by neither stylesheet.
