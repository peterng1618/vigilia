# Triage B2 — `vg-160` … `vg-210`

Reproduction pass, batch B2. **Ids owned: 40. Verdicts written: 40.** Every row sorted into
`closes` / `decision` / `work` / `parked`. Nothing here is fixed and nothing is closed — this is a
read pass whose every verdict carries the command or `file:line` that produced it. Written at
`87cc2311`. **No browser run was made** (Ruling B): rows whose verdict needs one are `work`, with the
spec path, `--grep` value and build command recorded, and marked *not run — deferred*.

Ruling B ruling: build command for every deferred row is `cd src/web && npm run build` (builds the
player, editor and host bundles the Playwright `webServer` previews at 4173/4174 and the host app).

## Summary

| Verdict | Count | Ids |
|---|---|---|
| `closes` | 5 | vg-169, vg-179, vg-196, vg-206, vg-209 |
| `decision` | 18 | vg-163, vg-167, vg-168, vg-171, vg-174, vg-178, vg-182, vg-184, vg-185, vg-186, vg-188, vg-190, vg-191, vg-192, vg-198, vg-201, vg-202, vg-208 |
| `work` | 17 | vg-160, vg-161, vg-162, vg-164, vg-166, vg-170, vg-172, vg-175, vg-177, vg-181, vg-189, vg-195, vg-197, vg-199, vg-203, vg-204, vg-210 |
| `parked` | 0 | — |

**Deferred to a serialised browser follow-up: 6** — vg-164, vg-172, vg-195, vg-197, vg-204, vg-210.

## The table

| id | verdict | evidence | theme |
|---|---|---|---|
| vg-160 | `work` | `Grep vigiliaPanel src/web/packages/editor` → `panes/document/references.tsx:80` `root.dataset["vigiliaPanel"] = "style"`; `Grep vigiliaPanel src/web/tests` → **no matches** (the spec consumer the row named is gone) | a rename is now available and nothing depends on the old name; one-product-file edit |
| vg-161 | `work` | `Grep 2026-10-03-editor-left-column` → the plan is still live at `docs/superpowers/plans/2026-10-03-editor-left-column-and-header.md` (not archived); `STATUS.md:31` queues only the reproduction pass and the keyboard walkthrough | unlanded plan still unqueued; bookkeeping, plus measuring its true state |
| vg-162 | `work` | `Grep CARD_LIBRARY\|cardLibrary\|card-library docs/architecture/ownership.md` → only `:116` (as a **user** of `createWidgetIdAllocator`), no owner row | ownership-map gap; `new-object-defaults.ts`+`SHAPE_KINDS` is the precedent to copy |
| vg-163 | `decision` | spec `docs/superpowers/specs/2026-10-03-dashboard-authoring-design.md:383` still reads "text, shape, chart, image, video"; `Grep isPlaceable` → `panes/add/file-section.tsx:262-266` allowlists `image\|svg` only | spec promises a primitive no object kind can carry |
| vg-164 | `work` | spec `src/web/tests/e2e/host-settings.spec.ts:249` (test "asks a theme's disk question once, and remembers the answer"); run `npx playwright test host-settings --project=desktop-host --workers=1 --grep "asks a theme's disk question once, and remembers the answer"`; build `cd src/web && npm run build` | load/ordering-sensitive red; **not run — deferred** |
| vg-166 | `work` | `scripts/backlog-check.mjs:45` `const FILE = …backlog.jsonl`; `:171` reads only FILE; `:175` self-test runs on fixtures; `Grep backlog-archive scripts/ .claude/` → **no reader** | a gate that never sees the archive; gate change with blast radius |
| vg-167 | `decision` | `src/web/packages/editor/src/card-library.test.ts:186` `if (object["type"] === "Group") continue;` still skips every group | closing needs a test-design call (walk a constructed nested group), not another assertion |
| vg-168 | `decision` | `card-library.ts:94-136` `label: uiCopy.cardLibrary.*`; builders pass the same `uiCopy.cardLibrary` refs | both sides resolve one object, so the "pin" is a tautology; closing means a source-shape assertion |
| vg-169 | `closes` | `ls src/web/packages/editor/src/editor-shell/insert-popover.tsx` → absent; `git log -- …insert-popover.tsx` → deleted (`2eeb4516`, `b0e2eb73`); `Grep InsertPopover src/web/packages/editor/src` → not present | surface rebuilt: the `+` popover the row is about no longer exists |
| vg-170 | `work` | `src/web/tests/e2e/insert-popover.spec.ts` → **absent**; `Grep card-group-time-card src/web` → `tests/e2e/add-pane.spec.ts:71` hardcodes the copy id | citation moved, substance survives: a spec still restates an allocator-chosen id |
| vg-171 | `decision` | `src/web/packages/host/src/cli/net.ts:89-91` returns the first non-internal IPv4 | which adapter wins, and how to rank them, is the decision |
| vg-172 | `work` | spec `src/web/tests/e2e/publish-header.spec.ts:200-206` reads the surface at 390 px and its comment names this row; run `npx playwright test publish-header --grep "the control carries the address and a code for it"`; build `cd src/web && npm run build` | phone-width header overflow is unasserted; **not run — deferred** |
| vg-174 | `decision` | `src/web/packages/host/src/server.ts:799` `await binding?.idle()`; `packages/host/src/cli/hosting.ts:85` `server.closeIdleConnections()` | two asymmetric hazards; somebody must choose which to trade |
| vg-175 | `work` | `src/web/packages/host/src/themes/store.test.ts` present (55.5 KB); row is a full-suite load-sensitivity, not run here | measure which reading is true before touching the timeout |
| vg-177 | `work` | node byte scan → `renderer-core/src/scene/plan.ts` holds **2 NUL bytes**, the only such source file under `src/web/packages` | one owner, no behaviour change, no test; a source-hygiene write |
| vg-178 | `decision` | `Grep radix THIRD-PARTY-NOTICES.md` → 0; `Grep radix docs/engineering/dependencies.md` → 0 | direct-only or installed closure? — a scope convention neither file states |
| vg-179 | `closes` | `components/ui/colour-picker.tsx:1` now imports `@base-ui/react/popover`; `Grep @radix-ui src/web/packages/editor/src` → **no matches** | the two-wrapper/two-library incoherence ended (plan 9 Base UI migration); subject gone |
| vg-181 | `work` | `ui-copy.ts:1-2` and `ui-copy.ts:85-86` carry the identical doc comment | duplicate module contract; delete one |
| vg-182 | `decision` | `shortcut-manager/display.ts:50,57` `NAMED_KEYS` `escape:"Esc"`; `index.ts:89` `CONTEXT_SHORTCUTS` binds `view.exit-group`; `display.test.ts:71` `shortcutLabel("view.exit-group")===""` | whether a context-only binding should be labelable at all |
| vg-184 | `decision` | `scripts/ownership-sweep.mjs:84` regex `"([a-z][a-z0-9]*(?:-[a-z0-9]+)+)"` requires ≥1 hyphen; `:89` `exportedVocabularies` reads only array/record shapes | widen the sweep (precision vs recall) — a gate decision |
| vg-185 | `decision` | `editor-session.ts:469/472/475` register `file.save/open/new` → `#save/#open/#new`; `:582-585` bridge `savePackage/openPackage/newDocument` reach the same | the plan's own rule yields 9 chorded rows, not 6: whether a File row teaches Ctrl+S is product |
| vg-186 | `decision` | `shell-layout.dom.test.tsx` sheet test carries the ordering-dependency comment; re-measured 2026-10-08 | which mechanism to change (isolate DOM / own file / drive unmount / find the leak) — multi-owner |
| vg-188 | `decision` | `grouping-manager/index.ts:92-96` `makeSelectableThrough` sets `subTargetCheck`/`interactive`; comment at `:77` covers only `selectable`/`evented` | the general question vg-041 owns: which Fabric props serialisation excludes |
| vg-189 | `work` | `src/web/packages/host/src/server.ts:394` `group: "gpu" \| "system-disk" \| "data-disk"` (and `:397-399` literals) | host re-spells a union the settings module owns; small export-location fix |
| vg-190 | `decision` | `packages/player/src/main.ts:121-122` `mountFabricScene` inside `startHostedTheme`; catch at `:70` calls `showLoadFailure` | what a wall display should do when a theme breaks after mount |
| vg-191 | `decision` | `tests/e2e/host-theme.ts:32` `HOST_MISSING_THEME_ID = "e2e-missing-sensor"`; `tests/e2e/host-bleed.spec.ts` binds real keys | closing means adding a bleed+missing-sensor fixture — a fixture-inventory call |
| vg-192 | `decision` | no `src/web/tsconfig.json` and no `tests/tsconfig.json`; `package.json:8-16` workspaces omit `tests/`; `:24` `typecheck --workspaces`; 33 `tests/e2e/*.spec.ts` unchecked | adding `tests/` to a program pulls `@playwright/test` + DOM+Node libs into one project — a decision |
| vg-195 | `work` | spec `src/web/tests/e2e/editor-context-menu.spec.ts:86,113` `popupTop` only inside `readMenu()`, no `expect` consumes it; run `npx playwright test editor-context-menu --grep "the last entry is reachable in a window too short to hold the menu"`; build `cd src/web && npm run build` | needs a new case in a tall window; **not run — deferred** |
| vg-196 | `closes` | `git show --name-status ad94e5ed` → `D src/web/tests/e2e/display-fabric.spec.ts`; `git ls-files` → no `display-fabric`/`*fabric*` spec at HEAD; `grep -rln page.clock` → **none** | subject deleted in a refactor; the standing red cannot reproduce (a repaint-coverage row may be worth refiling — not this one) |
| vg-197 | `work` | spec `src/web/tests/e2e/clip-parity.spec.ts`; fixture install in `tests/e2e/host-*.ts`; run `npx playwright test clip-parity --workers=1`; build `cd src/web && npm run build` | EPERM staging-rename race needs a bounded retry; **not run — deferred** |
| vg-198 | `decision` | `docs/README.md:17` map row now points at `decisions/` (map half done); `docs/adr/` still holds 0002-0010, `docs/decisions/` 0019-0039 | whether `docs/adr/` is merged, kept, or removed |
| vg-199 | `work` | node scan of `docs/product/backlog-archive.jsonl` → 149 rows: **8** carry `artefacts` as a string (vg-173, vg-176, vg-187, vg-180, vg-157, vg-295, vg-294, vg-303), 15 carry none | the family grew since filing (row said 5); wrap the strings + guard, judge the 3 verified artefacts-less rows |
| vg-201 | `decision` | `editor-shell.css:299/330/358` `--shell-warm: #ff7e6e / #e8c56a / #ffb2a1` on light paper | a hue decision: `--vigilia-accent` aliases `--shell-warm`, so the fix moves the canvas accent |
| vg-202 | `decision` | `components/ui/control-well.tsx:83` `px-[var(--space-6)]` = 6 px | three authorities disagree (4/6/8); a design ruling, not an edit |
| vg-203 | `work` | `components/ui/control-number.tsx:75-77` draft/composing ref; the same decision re-implemented in `control-text.tsx` | duplication survived plan 3; needs a new owner (plan 4 is the next work over the pair) |
| vg-204 | `work` | spec `src/web/tests/e2e/keyboard.spec.ts:426` "the palette picker lands beside its trigger, and its tracks answer the arrow keys"; run `npx playwright test keyboard --grep "the palette picker lands beside its trigger, and its tracks answer the arrow keys"`; build `cd src/web && npm run build` | popup unpositioned at base, green 2026-10-11; needs a sample; **not run — deferred** |
| vg-206 | `closes` | `editor-shell.css:2345` `.editor-shell-dock { display: none }` + `:2350` `.editor-shell-dock[data-visible="true"] { display: flex }`; `canvas-dock.tsx:135 data-visible={bridge !== undefined}` | the false state is handled by the base rule; the comment agrees with the code — no defect |
| vg-208 | `decision` | `editor-shell.css:1044-1047` `overflow: auto` on `.editor-shell-panel` (the aside holds header, body, footer) | layout decision spanning the bible (§7.7) and the single-scroller constraint |
| vg-209 | `closes` | `wc -l src/web/packages/editor/src/editor-shell/layer-panel.tsx` → **41** (the 838-line file was split; this is now only `LayerActions`) | the over-stop file is gone; structure changed, not "fixed" |
| vg-210 | `work` | spec `src/web/tests/e2e/composition-panel.spec.ts:902` "a group entered inside a large document" (`enterLayer` at `:931`); run `npx playwright test composition-panel --grep "a group entered inside a large document"`; build `cd src/web && npm run build` | deterministic red at base; **not run — deferred** |

## Decision sentences (one per `decision` row)

- **vg-163** — Should §5's primitive list drop "video" to match the product, or should video gain an object kind?
- **vg-167** — Should the stamp coverage walk a constructed document that actually contains a nested group?
- **vg-168** — Does this suite want source-shape assertions, or is the tautology acceptable as-is?
- **vg-171** — Which network interface should `lanAddress()` prefer, and how should three plausible addresses be ranked?
- **vg-174** — On a LAN move, should the host destroy in-flight connections (bounded empty reply) or bound the GET's wait?
- **vg-178** — Do the two licence files list direct dependencies only, or the installed closure?
- **vg-182** — Should a context-only binding (`view.exit-group`) be labelable at all?
- **vg-184** — Should the ownership sweep widen to union/dotted vocabularies, accepting the precision cost?
- **vg-185** — Should the File menu rows (`file.new`/`file.open`/`file.save`) teach their chords?
- **vg-186** — Which mechanism should fix the ordering stall: DOM isolation, a separate file, or the leak?
- **vg-188** — Which Fabric properties are derived/editor-only, and how does serialisation exclude them?
- **vg-190** — What should a wall display do when a theme rejects after it has already mounted?
- **vg-191** — Should a fixture that both bleeds and binds an unreportable key be added?
- **vg-192** — Should `tests/e2e/` join a tsconfig program, given the DOM/Node lib conflict?
- **vg-198** — Should `docs/adr/` be merged into `decisions/`, kept as a second class, or removed?
- **vg-201** — What colour should `--shell-warm` take on ember/moss/plum so warnings reach 4.5:1?
- **vg-202** — Which authority wins for a well's horizontal padding — the bible's 4, the mockup's 8, or 6?
- **vg-208** — Should the pane frame move to a fixed header/footer with a scrolling body (against the single-scroller constraint)?

## Notes for the synthesis

- The three repo-wide "is it still the right row" rows: **vg-192** holds against all 33 `tests/e2e/*.spec.ts`;
  **vg-198**'s map half is already fixed (`docs/README.md:17`), only the `adr/` disposition is left;
  **vg-199**'s family grew from 5 to 8 string-`artefacts` rows since it was filed.
- `vg-169`, `vg-179`, `vg-196`, `vg-209` close because the surface/file the row named no longer exists —
  "the surface was rebuilt", not "the defect was fixed". Each is stated as such above.
- `vg-196` closes on a deletion, and the coverage it named (the update loop reaching the canvas) may now be
  absent entirely; a fresh coverage row could be warranted but is not this row.
- No row in B2 is a user park, so `parked` is 0 for this batch.
