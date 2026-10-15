# Settings becomes a pane — design

**Status:** draft for review. Written 2026-10-16 for `vg-330`.

**What this is.** `vg-330` is a commissioned brainstorm → spec → plan of its own: Settings stops
being a modal and becomes a pane in the rail, like Composition, Add, Tokens and Document. Three of
the seven questions this design had to answer were ruled by the user on 2026-10-15 and are marked
**[ruled]** below; the other four are answered here as **recommendations**, and each says what it
costs if the recommendation is wrong.

## 1. Intent

An author changes the editor's appearance, keyboard and About facts from a modal that covers the
canvas. Every other author-facing surface in this editor is a pane beside the rail. The modal is the
exception, and it is the wrong shape for the content: a pane is 246px and scrolls (§7.3), which is
what three lists of settings want, where a 560px modal is wide enough to put the three sections side
by side and therefore has to.

**What success looks like:** the rail's gear opens a pane, the pane's own header names the surface,
the three sections are reachable at 246px without sideways scroll, and a drawing of the pane exists
that the parity instrument can read.

## 2. What is already ruled, and is not a question

Quoted from `vg-330`'s own `detail`, which carries the user's words:

1. **Settings becomes a pane, not a modal** — "Setting should not be a modal but a panel like add,
   composition."
2. **It opens from the rail's gear, and the rail keeps its four slots.** A fifth slot was offered
   and declined: it would change the drawing's 46px rail and leave the gear redundant with the slot.
3. **The pane's header names the surface** — which is also `vg-328`'s answer, so one name serves both.
4. **`docs/design/mockups/current/settings.html` is redrawn** without the scrim and the modal frame,
   as a pane at the shell's pane width, committed beside the shipped pane. The user was told this
   edits the gold artefact and chose it, because a panel not drawn as a panel cannot be compared
   against anything.
5. **[ruled] The three tab headings become a vertical list** inside the pane.
6. **[ruled] The pane is named `Editor Settings`**, in the drawing and in the product.
7. **[ruled] `vg-322` closes with this change** — see §6.
8. **Sequencing:** after plan 6, long since done; the row was unparked 2026-10-14, so this is
   commissioned work rather than a wait.

## 3. The pane

**Structure follows §7.3 exactly**, because a Settings pane that invents its own frame is a second
pane shape:

| §7.3 part | Here |
|---|---|
| Title bar — glyph, title, and the count or a single pane-level action | The gear's own glyph and the title `Editor Settings`. **No count and no pane-level action**: there is no "number of settings", and the one action a settings surface might carry (reset) is per-section, not per-pane. |
| Body — scrolls, sections use the §2 eyebrow | The section list, then the selected section's body. |
| Footer toolbar — optional, where a pane's items have a set of actions | **Absent.** Settings items have no set of actions; a reset belongs to the section it resets. |

**The section list is the ruled change, and it is what a pane expresses that a modal could not.** A
modal is wide, so its three sections sit side by side as tabs and the body is whatever is left. A
pane is 246px, so side-by-side sections cannot fit; the sections become a **vertical list** at the
top of the body and the selected one's content follows it, scrolling together. The list is three
rows, each the section's name, one of them current.

**Consequence for the product, stated because it is the visible half:** today `settings.tsx` renders
`Tabs` from `@base-ui/react/tabs` with `SETTINGS_TABS` (`appearance`, `keyboard`, `about`) and one
glyph per tab. The three names and their order survive; the **tab widget does not**, because a
horizontal tab strip is the modal's shape. `SETTINGS_TABS` stays the one owner of "which sections
there are" — the list and the bodies both read it — so a fourth section still cannot appear with a
body and no word, or the reverse.

## 4. The rail, and the gear

§7.2 gives a 46px rail, four slots, a gear pinned to the foot, and one rule: "**At most one slot is
open at a time.** Asking for the open slot closes it; asking for another replaces it."

**[recommendation] The gear becomes a fifth rail control that opens a pane, and the one-at-a-time
rule covers it.** The four slots are unchanged, the gear still occupies no slot, and the rule's
subject widens from "slot" to "rail pane":

- **The gear reads as active while its pane is open**, using the same selected treatment the slots
  use. The alternative — a gear that opens a pane while showing no state — is the defect this repo
  keeps filing: a control whose state a person cannot see.
- **The rail's selected state means "the control whose pane is showing is lit"**, and it stays true
  when the pane is Settings. So there are five controls that can be lit and at most one lit at a
  time.
- **The gear's own comments are wrong and this change corrects them.** `rail.tsx` says in two places
  that the gear "is not a slot and opens no pane" and that its prop "opens the settings modal" —
  both accurate today, both contradicted the moment this lands, and both in the file whose subject
  this is.

*If this recommendation is wrong* — if the gear should not light, or if its pane should coexist with
a slot's — the cost is one rule in §7.2 and one class in `rail.tsx`, and the pane itself is
unaffected.

## 5. The modal host, and what stays a dialog

**The modal host stays; only Settings leaves it.** Checked at source rather than assumed: the shared
host is `components/ui/dialog.tsx`, and `.editor-shell-dialog` is consumed by six surfaces besides
Settings — `draft-recovery-prompt.tsx`, `new-document-chooser.tsx`,
`persistence-manager/replace-document-prompt.tsx`, `theme-library-dialog.tsx`, plus the host's own
rules and `editor-shell.control-rules.test.ts`. "The settings modal goes away" is therefore **not**
"the modal host goes away", and this spec takes the narrow reading: Settings stops being a dialog
consumer, the host and the five other consumers are untouched.

**What happens to the settings-specific CSS.** `editor-shell.css` is gated by the ratchet (`vg-274`),
so rules that only ever matched the settings modal become dead entries in a gated file — which is the
one thing the ratchet's own rule forbids. They retire **in the same change** that removes their last
consumer, and the gated count moves down rather than being left for a later sweep to find.

**A second dialog question this spec deliberately does not take.** `shortcut-reference.tsx` renders
the `?` sheet through the same host. It is a *reference*, opened from a keystroke over whatever is
showing, and nothing in `vg-330`'s ruling reaches it. It stays a dialog.

## 6. `vg-322`, and the width question

**[ruled] `vg-322` closes with this change.** Its whole subject is the modal's width: fixed 560px as
drawn, content-sized in the product — 405px on Appearance, 507px on Keyboard, 393px on About, with
the palette cards rendering about 58px against the drawing's about 120px. The mismatch exists because
a modal's width is decided by its content while the drawing fixed it.

**A pane's width is not a different question; it is the absence of the question.** A pane takes the
shell's 246px (§7.3) unconditionally — it is a layout track, not a box sized to its content — so
there is no content-sized width left to disagree with the drawing, and the four measurements above
stop describing anything. That is why the row closes rather than narrowing: the subject is gone, not
re-answered.

**The palette-card half is the one piece that could outlive it.** About 58px rendered against about
120px drawn is a *card* mismatch, not a *modal* one, and a 246px pane makes cards narrower rather
than wider. So the redraw must decide the card at the pane's width, and the parity row that reads it
is written against the redrawn sheet. If the cards cannot be drawn at 246px without a second row,
that is a finding for the redraw and not a reason to reopen `vg-322`.

## 7. The drawings, and the instrument

**All three settings drawings are modal-framed, so all three are redrawn.** `docs/design/mockups/README.md`
describes `settings.html` as "The settings surface on its own, with §7's three tabs and the six-palette
grid", and `settings-keyboard.html` and `settings-about.html` as "**The same modal** with §7's Keyboard
/ About panel showing". So the set is one modal drawn three times, and a pane cannot be one drawing:
the change is three sheets showing the pane with a different section's body.

**The README's own count is part of this change.** It states the current set as "those **six** files"
with a table of exactly six, and `tests/e2e/design-language.spec.ts` reads every literal the drawings
declare. A redraw therefore obliges the README's count and table to be edited in the same change, and
puts a new literal set under the instrument's rules.

**The redraw lands with the pane, not after it.** The user's ruling 4 says the drawing is committed
beside the shipped pane, and the reason is in the same sentence: a panel not drawn as a panel cannot
be compared against anything.

## 8. What this owes the sixteenth acceptance item

Settings is one of the surfaces the parity item measures, and **a pane that no drawing shows is
outside the instrument until the redraw lands**. So the sequencing inside this change is:

1. The pane and the redrawn sheets land together.
2. The parity rows that read the settings sheets are written against the redrawn ones — the old rows
   describe a modal and are not repointed, because the shape they measured is gone.
3. `vg-322` closes on the same commit, with its `check` naming the pane's unconditional width and its
   `artefacts` naming that commit.

## 9. Edits to the durable documents

- **`DESIGN.md` §7.2** — the gear's sentence gains that it opens a pane, and the one-at-a-time rule
  widens from "at most one slot" to "at most one rail pane", so the gear's pane obeys it. The 46px
  rail and the four slots are unchanged, per ruling 2.
- **`DESIGN.md`'s control table** — its **Rail slot** row reads "One of §7.2's four panes; at most one
  is open". The count and the rule both change: the row names the four slots, and the gear's pane is
  named separately as a rail control that is not a slot.
- **`rail.tsx`'s two comments** — corrected, as §4 says.
- **`docs/architecture/ownership.md`** — **one claim in the brainstorm input is wrong and this is the
  correction**: the rail, the pane chrome and the settings surface do **not** each have an owner
  there. The file has no row for `settings.tsx`, `shortcut-reference.tsx`, the dialog host or
  `pane.tsx`; its only relevant row is "Shell chrome, rail and panes … `editor-shell/shell-layout.tsx`",
  which already covers the rail and the panes. So **this change moves nothing between rows** and adds
  no row, because Settings joining the pane set is already inside that row's scope. If the plan finds
  it needs a row for the pane set, that is a separate decision.
- **Plan 6 Task 8 Step 3's acceptance item** — "the rail's gear opens the settings modal rather than a
  fifth pane" — is superseded by ruling 2. It is archived text and stays as the record of what was
  true; what must not survive is a *current* document repeating it.
- **`vg-318`** is already `withdrawn`, so this change inherits a settled row and touches nothing.
- **`vg-328`** is `verified` and is not reopened; its answer (the drawing names the surface as an
  eyebrow) is what the pane's title bar inherits.

## 10. Testing and evidence

- **A browser case** for the visible change: the gear opens the pane, the pane's title bar reads
  `Editor Settings`, and each of the three sections is reachable at 246px with **no sideways scroll**
  in the pane's column — the same instrument shape `vg-270` landed for the rail's other panes, reused
  rather than written again.
- **A case for the one-at-a-time rule** extended to the gear: opening the gear's pane with a slot's
  pane open replaces it, and asking for the gear again closes it.
- **A unit case** for `SETTINGS_TABS` remaining the one owner: the list and the bodies both read it,
  so a section with a body and no name fails to compile.
- **Rendered evidence**: captures of the pane on each of its three sections, committed beside the
  redrawn sheets, per `docs/evidence/screenshots/README.md`'s refresh rule.
- **Red-proof**: the no-sideways-scroll case must fail with the pane's column constraint removed
  before it is trusted, and the file restored byte-identical (`cmp` against a copy taken first).

## 11. The four recommendations, collected

Each is a place where the user's rulings do not reach and this design chose. All four are cheap to
reverse and none changes the pane's existence:

1. **§3 — no pane-level action and no footer.** Reversal: one title-bar action, one footer toolbar.
2. **§4 — the gear lights like a slot, and one-at-a-time covers it.** Reversal: one §7.2 rule, one
   `rail.tsx` class.
3. **§5 — the modal host and the five other dialog consumers are untouched**, and the settings-only
   CSS retires with its last consumer. Reversal: none needed; this is the narrow reading.
4. **§6 — `vg-322` closes rather than narrowing**, with the palette-card half handed to the redraw.
   Reversal: reopen `vg-322` as a row about the drawing alone, which is the third branch the row
   itself names.
