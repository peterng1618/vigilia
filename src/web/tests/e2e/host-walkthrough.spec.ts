import { expect, type Page, test } from "@playwright/test";
import { HOST_PORT, HOST_THEME_ID } from "./host-theme.js";

/**
 * §13.1's keyboard-only walkthrough, on the real host.
 *
 * The editor is driven through the host's own `/editor/` mount, never a preview
 * server: the walkthrough's own round trip ends by asking whether the document
 * came back unchanged, and the document is the host's file. `desktop-host`
 * boots that host through its `webServer`.
 *
 * **This file is a host spec for the reason the others are**, and
 * `playwright.config.ts`'s `HOST_SPECS` admits it by name for the same reason.
 *
 * This task's own job is the census: does every region of the shell have a
 * focus target a keyboard can reach, and does each of those targets have a
 * name. A later task cannot be written on an answer of no.
 *
 * **The census is red, and the red is its result — not a broken test.** The
 * walk reaches the rail, the pane and the stage and never reaches the
 * inspector, because with nothing selected the column renders one paragraph
 * and a paragraph is not a focus target. That is `vg-362`, and it is the answer
 * this task existed to produce: the plan says in advance that an unreachable
 * region is the deliverable and that `REGIONS` must not be trimmed to the
 * regions that pass. So a red here means "the census ran and found what it
 * found", and a *green* here would mean `REGIONS` had been weakened.
 *
 * **The red is one of two readings of §13.1, and this file asserts that one
 * deliberately.** §13.1 says "Each region has a reachable focus target"
 * without saying when — the shell's opening state, or the region's populated
 * state. The inspector is empty at mount and full of controls once a selection
 * exists, so the two readings disagree about exactly one region of the four.
 * This test takes the unqualified reading, which is why it is red today. The
 * other reading — the populated region, which is what the walkthrough itself
 * reaches after it selects through Composition — is equally open, and §13.1
 * has not been ruled on. `vg-362` names both and neither is settled here.
 * Nothing in this file should be read as having settled it.
 */

const HOST = `http://127.0.0.1:${HOST_PORT}`;

/**
 * The shell's regions.
 *
 * **Taken from DESIGN.md §7's own drawing, not invented to fit a result.** Its
 * labelled bands are `header · rail · pane · stage · inspector · status bar`.
 * The four here are the body's — the ones §13.1's interactions move through,
 * and the ones that own a focusable surface: the rail chooses a pane, the pane
 * holds the scene tree, the stage holds the canvas and its dock, the inspector
 * holds the selection's own column.
 *
 * The header and the status bar are outside the set because nothing in
 * §13.1's order lands in either: the header's menus and publish control are
 * commands about a finished document, and the status bar is a readout. That is
 * a reading of the drawing, so it is written down here rather than left
 * implicit — if a later task reaches a control in one of them, the region
 * belongs in this list and the list is what moves.
 *
 * Each region's selector is the shell's own class or id, the same ones
 * `shell-appearance.spec.ts`, `inspector-sections.spec.ts` and
 * `editor-rail.spec.ts` browse by. A region whose element was renamed would
 * fail here rather than quietly stop being censused.
 *
 * **A second, independent statement of the same four**: `vg-231` in the
 * register calls `.editor-shell-body`'s children "the shell's four body
 * regions", and names them rail, pane, stage and inspector. Two documents and
 * the drawing agree, which is why this list is a reading rather than a guess.
 */
const REGIONS = ["rail", "pane", "stage", "inspector"] as const;

type Region = (typeof REGIONS)[number];

const REGION_SELECTOR: Record<Region, string> = {
  rail: ".editor-shell-rail",
  pane: ".editor-shell-panel",
  stage: "#stage",
  inspector: ".editor-shell-inspector",
};

/**
 * How far the census will walk before it gives up.
 *
 * The bound exists so a shell that never returns focus to a seen node ends as a
 * reported count rather than a hung run. It is generous on purpose: the count
 * the walk actually took is the evidence, and this only says when the walk
 * stopped being one.
 */
const TAB_BOUND = 200;

/** The attribute a walk writes on each element it reached, so the stop
 *  condition is "focus came back to something already seen" rather than a
 *  count. A test-owned name: no shell style or selector reads it.
 *
 *  **Per walk, not per page.** It is cleared at the start of every walk
 *  ({@link clearWalkMarks}), because a mark left behind is what a *previous*
 *  walk saw: the next `Tab` from the document body lands on `File`, tagged by
 *  the walk before, and `tabUntil` would throw on its first press. */
const SEEN = "data-walkthrough-seen";
/** The first element reached in each region during the current walk, which is
 *  the one whose name is asserted. Cleared with {@link SEEN}, so the marks left
 *  on the page are always the current walk's. */
const FIRST = "data-walkthrough-first";

/** What a focused element is, before the census numbers the step. */
interface Landed {
  /** The region the focused element sits in, or `null` for one outside all
   *  four — a header menu, the status bar, the document itself. */
  readonly region: Region | null;
  /** The element's tag, lowercased, so a step is readable in a failure. */
  readonly tag: string;
  /** Its spoken name, approximated — see {@link focusProbe}. */
  readonly name: string;
}

/** One step of the census: where focus landed, and when. */
interface Focus extends Landed {
  /** The census's own index, in Tab order. */
  readonly press: number;
}

/** Opens the editor on the real host and waits for the shell to be complete.
 *
 * The wait is for the stage's zoom cluster, not for `.editor-shell`: the shell
 * element exists before its hosts do, and a census taken then would be a census
 * of a half-built focus order. The cluster is a stage control that only renders
 * once the bridge is set, which is the same fact as "the shell is wired".
 *
 * **`?theme=` names the document rather than letting the boot choose one.** A
 * bare `/editor/` resumes the author's most recent save (`boot-theme.ts`), and
 * with the host fixture's ten themes written in one pass several of them share
 * an mtime — compared at millisecond precision, so a tie is ordinary rather
 * than exotic. Two runs of this very test opened `E2E missing` and then
 * `E2E deliberate bleed`: one object in the tree against three, and a census
 * whose press count moved from 18 to 26 for a reason that is not the finder's.
 * The fixture that is seeded for it, `HOST_THEME_ID`, is the one the settings
 * spec works against, and naming it makes the tree, the dock and the count the
 * same on every run. That a bare mount resumes arbitrarily among themes with
 * equal mtimes is `vg-363`, filed rather than repaired here. */
async function openWalkthrough(page: Page): Promise<void> {
  await page.goto(`${HOST}/editor/?theme=${HOST_THEME_ID}`);
  await expect(page.locator(".editor-shell-zoom")).toBeVisible();
}

/** The census's probe, serialised into the page by `page.evaluate`.
 *
 * It names no module constant — everything arrives through `args` — because
 * `evaluate` ships the function's own source and a closure over {@link SEEN} or
 * {@link FIRST} would arrive undefined.
 *
 * The name is an **approximation** — `aria-label`, else the text
 * `aria-labelledby` points at, else the element's own text, else `title`. It is
 * the census's running record and the thing a failure prints. The
 * *authoritative* name — the one a screen reader would say — is asserted with
 * Playwright's own `toHaveAccessibleName`. The two mechanisms are deliberately
 * different: an approximation that agreed with itself would prove nothing about
 * what a voice user hears.
 *
 * Answers `null` when there is no element to describe, and `{ repeat: true }`
 * when the element already carries `args.seen` — the census's stop condition. */
function focusProbe(args: {
  readonly selectors: Record<string, string>;
  readonly seenRegions: readonly string[];
  readonly seen: string;
  readonly first: string;
}): Landed | { repeat: true } | null {
  const active: Element | null = document.activeElement;
  if (active === null) return null;
  if (active.hasAttribute(args.seen)) return { repeat: true };
  active.setAttribute(args.seen, "");

  let region: string | null = null;
  for (const [name, selector] of Object.entries(args.selectors)) {
    if (active.closest(selector) !== null) {
      region = name;
      break;
    }
  }
  if (region !== null && !args.seenRegions.includes(region)) {
    active.setAttribute(args.first, region);
  }

  const label = active.getAttribute("aria-label");
  const labelledBy = active.getAttribute("aria-labelledby");
  const byId =
    labelledBy === null
      ? ""
      : labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
  const own = (active.textContent ?? "").replace(/\s+/g, " ").trim();
  const name =
    label !== null && label.trim() !== ""
      ? label.trim()
      : byId !== ""
        ? byId
        : own !== ""
          ? own
          : (active.getAttribute("title") ?? "").trim();

  return {
    region: region as Region | null,
    tag: active.tagName.toLowerCase(),
    name,
  };
}

/**
 * Removes the marks a walk leaves on the page, so the next walk starts from the
 * same place this one did.
 *
 * A walk's marks are its own record of what *it* has seen; keeping them across
 * walks would make the second walk's first press land on an element the first
 * walk had already tagged, which reads as a closed focus cycle when nothing has
 * closed. Every walk therefore opens by clearing both marks — a walk is a
 * question about the shell, and it must not be able to answer it with the
 * previous question's notes.
 */
async function clearWalkMarks(page: Page): Promise<void> {
  await page.evaluate(
    (marks: readonly string[]) => {
      for (const mark of marks) {
        for (const element of document.querySelectorAll(`[${mark}]`)) {
          element.removeAttribute(mark);
        }
      }
    },
    [SEEN, FIRST],
  );
}

/** Puts focus back at the top of the document, which is where
 *  {@link keyboardReach} claims its walks begin.
 *
 * Clearing the marks is not enough to make two censuses agree, and the way the
 * first attempt at this failed is worth keeping. A walk's *closing* press is
 * the one that lands on an element it has already seen, so the walk ends with
 * focus on that element — `File`, the document's first tab stop. And a blur is
 * not a reset: the browser keeps a **sequential focus navigation starting
 * point**, set to the element that last lost focus, so the next Tab resumes
 * *after* it. Measured on this shell: blur `File` and the next Tab lands on
 * `Edit`; blur `Edit` and it lands on `View`. The second census therefore came
 * back one press short on every step while passing every test of "did it
 * move".
 *
 * Focusing the body instead puts the starting point back at the top, and the
 * body needs a `tabindex` to be focusable at all. The attribute is removed in
 * the same evaluate, so nothing of the page is left changed — the walk wants
 * the document's focus, not a modified document. Nothing here is clicked: a
 * `focus()` is not a pointer action, and the plan's rule is about how focus is
 * *reached*, not about which of the two keyboard-adjacent verbs resets it.
 *
 * Only the census calls this. {@link tabUntil} deliberately does not: a later
 * task opens a popup and then walks *inside* it, and a reset to the document
 * would take focus out of the very surface being proved. */
async function focusDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    const body = document.body;
    body.setAttribute("tabindex", "-1");
    body.focus();
    body.removeAttribute("tabindex");
  });
}

/**
 * Tabs from the document's own focus, recording each element focus lands on.
 *
 * Keyboard only: `Tab` is the one thing that moves focus. The walk stops when
 * focus returns to an element already seen — which is what a focus order that
 * has closed its cycle looks like — or at {@link TAB_BOUND} presses, whichever
 * comes first. The returned length is the press count.
 *
 * Re-entrant: it clears the previous walk's marks and returns focus to the
 * document first, so two walks in one test are two whole walks from the same
 * starting point rather than one truncated second one.
 */
async function keyboardReach(page: Page): Promise<readonly Focus[]> {
  await clearWalkMarks(page);
  await focusDocument(page);
  const reached: Focus[] = [];
  const seenRegions: Region[] = [];

  for (let press = 0; press < TAB_BOUND; press++) {
    await page.keyboard.press("Tab");
    const step = await page.evaluate(focusProbe, {
      selectors: REGION_SELECTOR,
      seenRegions,
      seen: SEEN,
      first: FIRST,
    });
    if (step === null) break;
    if ("repeat" in step) break;
    reached.push({ ...step, press });
    if (step.region !== null && !seenRegions.includes(step.region)) {
      seenRegions.push(step.region);
    }
  }

  return reached;
}

/**
 * Selects a layer with the keyboard alone, so the inspector has content.
 *
 * The census's fourth region is the inspector, and §13.1's requirement is a
 * region **with content** — the user's ruling of 2026-10-12, which is what
 * `vg-362` was filed to settle. While nothing is selected the column renders one
 * paragraph and legitimately contributes no tab stop; the populated walk
 * therefore needs a selection first, and it is made the way an author makes it,
 * with no pointer.
 *
 * **Space selects; Enter renames.** A composition row gives `Enter` and `F2` to
 * its rename field and selection takes `Space` (`composition-pane.tsx`), the key
 * a list has always used for it. A helper pressing Enter would open a rename
 * input and leave the inspector empty — indistinguishable, from the census's
 * side, from the defect this walk exists to disprove.
 *
 * Waits on the column having a control rather than on the bridge, because the
 * region the next walk has to reach is a DOM fact and `bridge.selectLayer` is
 * not on this mount's window.
 */
async function selectInPaneByKeyboard(page: Page): Promise<void> {
  await tabUntil(page, (focus) => focus.region === "pane");
  await focusLayerRow(page, undefined);
  await page.keyboard.press(" ");
  await expect(
    page.locator(
      ".editor-shell-inspector input, .editor-shell-inspector button",
    ),
    "the inspector has no control after a keyboard selection",
  ).not.toHaveCount(0);
}

/**
 * Tabs inside the pane until focus is on a layer row, and answers its id.
 *
 * `name` is the row's own `.vigilia-layer-name`; `undefined` accepts the first
 * row focus reaches, which is what {@link selectInPaneByKeyboard} — the
 * census's unnamed selection — asks for. The search is by **name, not by a Tab
 * count**, so nothing here bakes in a position the shell is free to change, and
 * the bound reports how many presses it spent rather than hanging.
 */
async function focusLayerRow(
  page: Page,
  name: string | undefined,
): Promise<string> {
  for (let press = 0; press < TAB_BOUND; press++) {
    const id = await page.evaluate((wanted: string | undefined) => {
      const active = document.activeElement;
      const row = active?.getAttribute("data-vigilia-layer");
      if (row === null || row === undefined) return null;
      if (wanted === undefined) return row;
      const shown = active?.querySelector(".vigilia-layer-name")?.textContent;
      return (shown ?? "") === wanted ? row : null;
    }, name);
    if (id !== null) return id;
    await page.keyboard.press("Tab");
  }
  throw new Error(
    name === undefined
      ? `no layer row took focus in ${TAB_BOUND} presses`
      : `no layer row named ${name} took focus in ${TAB_BOUND} presses`,
  );
}

/**
 * Selects a named layer through the Composition pane, with no pointer.
 *
 * The pane is named first, because "through Composition" is part of the claim:
 * the row is the one that pane draws, and a run that had left another pane
 * showing would be selecting through something else. `Space` selects — a
 * composition row gives `Enter` and `F2` to its rename field
 * (`composition-pane.tsx`) — and the row's own `aria-selected` is the shell's
 * statement that the selection landed rather than a claim made here.
 *
 * Answers the row's object id, which is what addresses that row afterwards.
 */
async function selectInComposition(page: Page, name: string): Promise<string> {
  await expect(
    page.locator('[data-vigilia-panel="layers"]'),
    "the Composition pane the row is selected through",
  ).toBeVisible();
  await tabUntil(page, (focus) => focus.region === "pane");
  const id = await focusLayerRow(page, name);
  await page.keyboard.press(" ");
  await expect(
    page.locator(`[data-vigilia-layer="${id}"]`),
    `the row named ${name} after Space`,
  ).toHaveAttribute("aria-selected", "true");
  return id;
}

/** Copy a spec names as literals — the File menu, the row this walk creates its
 *  document with, and the name that document gives itself. A renamed row or an
 *  upgraded starter reddens here rather than quietly stopping to be about the
 *  document. `STARTER_DOCUMENT_NAME` is the starter's own metadata name, which
 *  is what tells the created document apart from the fixture (`?theme=`). */
const FILE_MENU_NAME = "File";
const NEW_FROM_STARTER_ROW = "New from starter";
const STARTER_DOCUMENT_NAME = "System dashboard";
/** Bounds for the two searches — the File menu's rows and the rail's slots —
 *  which report a count rather than hang. */
const FILE_MENU_BOUND = 12;
const RAIL_BOUND = 40;

/** The Composition row this task's walk selects. It is the starter's own
 *  `wordmark` — a top-level text object — so the walk selects something that
 *  sits inside no group; a row whose group had to be entered first is a
 *  different interaction, and Task 4's. */
const WALKTHROUGH_LAYER_NAME = "wordmark";

/** The draft a cancelled edit is given. Any string but the authored one leaves
 *  the field having really held it, which is what makes the cancel mean
 *  something: a field that never took the text would revert to the same value
 *  while proving nothing. */
const FIELD_DRAFT = "walkthrough draft";

/** The hook the selection's own name field carries (`nameField`,
 *  `selection-inspector/appearance.ts`), on the focus target rather than a
 *  wrapper. */
const FIELD_HOOK = "[data-vigilia-name]";

/** The canvas event `EditorHistory.save()` fires at the one place an entry is
 *  appended to the history (`history-manager/index.ts`) and nowhere else.
 *
 *  **There is no history length to read from the browser.** `#entries` is a
 *  private field and `EditorShellBridge` publishes no accessor — only
 *  `saveState`, `resetHistory`, `undo`, `redo` and `suspend` cross it — so this
 *  event is the application's own statement that an entry landed, which is the
 *  strongest thing actually observable rather than a count this file invents. */
const EDIT_COMMITTED = "editor:edit-committed";

/** Where the count lives on the page while the listener is attached. A
 *  test-owned name: no shell style or script reads it. */
const WALKTHROUGH_COMMITS = "__vigiliaWalkthroughEditCommits";

/** Creates a document through the shell's own File menu, with no pointer.
 *
 * **"Create or open" is discharged by creating**, on the row that creates a
 * document **with content**: `New theme` is blank, and a blank document is a
 * different walkthrough — the Composition pane it lands on has nothing to
 * select, and selection is §13.1's next interaction.
 *
 * The route is the menu's own keyboard model, not an invented order: Tab reaches
 * the `File` trigger (the census's own first press), `ArrowDown` opens a menu on
 * its first row the way a menu button does, `ArrowDown` moves between rows and
 * `Enter` activates the row it is on. Which row is answered by its own name, so
 * no press count is baked in.
 *
 * It ends on the document naming itself, which is what makes it safe to call
 * before the next step: the create remounts the shell, and the identity chip can
 * only say the created name once the new shell is wired. */
async function openDocumentByKeyboard(page: Page): Promise<void> {
  await tabUntil(
    page,
    (focus) => focus.tag === "button" && focus.name === FILE_MENU_NAME,
  );
  await page.keyboard.press("ArrowDown");
  for (let press = 0; press < FILE_MENU_BOUND; press++) {
    const onRow = await page.evaluate(
      (wanted: string) =>
        (document.activeElement?.textContent ?? "").includes(wanted),
      NEW_FROM_STARTER_ROW,
    );
    if (onRow) {
      await page.keyboard.press("Enter");
      await expect(
        page.locator(".editor-shell-identity-name"),
        "the created document's own name",
      ).toHaveText(STARTER_DOCUMENT_NAME);
      return;
    }
    await page.keyboard.press("ArrowDown");
  }
  throw new Error(
    `no menu row naming ${NEW_FROM_STARTER_ROW} in ${FILE_MENU_BOUND} presses`,
  );
}

/** Chooses a rail pane by its spoken name, with no pointer.
 *
 * Tab reaches the rail's slot button of that name — the census's own region, in
 * the shell's own tab order — and `Enter` presses it. The claim it makes for
 * itself is that the shell took the choice (`aria-pressed`), because a press
 * that did nothing would leave the next step measuring the pane the walk was
 * already on. Which pane is now *showing* is the caller's: the slot's label and
 * the pane's DOM name are two vocabularies and the shell owns the mapping. */
async function chooseRailPane(page: Page, name: string): Promise<void> {
  await tabUntil(
    page,
    (focus) =>
      focus.region === "rail" && focus.tag === "button" && focus.name === name,
    RAIL_BOUND,
  );
  const slot = await page.evaluate(() =>
    document.activeElement?.getAttribute("data-rail-slot"),
  );
  if (slot === null || slot === undefined) {
    throw new Error(`the rail button named ${name} carries no slot`);
  }
  await page.keyboard.press("Enter");
  await expect(
    page.locator(`button[data-rail-slot="${slot}"]`),
    `the rail slot ${name} after Enter`,
  ).toHaveAttribute("aria-pressed", "true");
}

/**
 * Tabs until the focused element satisfies `matches`, and answers with it.
 *
 * The helper later tasks reach a control with. It asks what a control *is*
 * rather than where it sits in an order the shell is free to change, and it
 * fails saying how many presses it spent rather than running out of a loop.
 *
 * Re-entrant for the reason {@link keyboardReach} is: it clears the marks of
 * whatever walk came before it, so a `tabUntil` after a `keyboardReach` — which
 * is how a later task asserts that a region can be left as well as reached — is
 * not tripped by the earlier walk's notes.
 */
async function tabUntil(
  page: Page,
  matches: (focus: Focus) => boolean,
  limit = TAB_BOUND,
): Promise<Focus> {
  await clearWalkMarks(page);
  const seenRegions: Region[] = [];
  let pressed = 0;
  for (; pressed < limit; pressed++) {
    await page.keyboard.press("Tab");
    const step = await page.evaluate(focusProbe, {
      selectors: REGION_SELECTOR,
      seenRegions,
      seen: SEEN,
      first: FIRST,
    });
    if (step === null) {
      throw new Error(`focus left the document after ${pressed + 1} presses`);
    }
    if ("repeat" in step) {
      throw new Error(
        `focus returned to a seen element after ${pressed + 1} presses`,
      );
    }
    if (step.region !== null && !seenRegions.includes(step.region)) {
      seenRegions.push(step.region);
    }
    const focus: Focus = { ...step, press: pressed };
    if (matches(focus)) return focus;
  }
  throw new Error(`nothing matched in ${limit} presses`);
}

/**
 * Opens the selection's name field, drafts a value into it, and cancels it.
 *
 * The field is reached the way a keyboard user reaches one — by Tab, from
 * wherever the walk left focus — never by `focus()`. So the edit is the
 * interaction §13.1 names, not a call to the control behind it.
 *
 * **Escape is the cancel and the value coming back is the assertion.**
 * `ControlText` keeps the draft in its own state and commits on Enter or blur,
 * so a cancelled edit writes nothing: the field shows the authored value again.
 * The draft is asserted to have landed *first* (`not.toHaveValue`), or a field
 * that never took the text would pass while proving nothing.
 *
 * Answers the value the field went back to, which is what the caller can then
 * assert about the document without re-deriving it from a second surface.
 */
async function editFieldThenCancel(page: Page): Promise<string> {
  const field = page.locator(`.editor-shell-inspector ${FIELD_HOOK}`);
  await tabUntil(page, (focus) => focus.region === "inspector");
  for (let press = 0; press < TAB_BOUND; press++) {
    const onField = await page.evaluate(
      (hook: string) => document.activeElement?.matches(hook) ?? false,
      FIELD_HOOK,
    );
    if (onField) break;
    await page.keyboard.press("Tab");
    if (press === TAB_BOUND - 1) {
      throw new Error(
        `no ${FIELD_HOOK} field took focus in ${TAB_BOUND} presses`,
      );
    }
  }

  const original = await field.inputValue();
  await page.keyboard.press("End");
  await page.keyboard.type(FIELD_DRAFT);
  await expect(field, "the draft before it is cancelled").not.toHaveValue(
    original,
  );
  await page.keyboard.press("Escape");
  await expect(field, "the field after Escape").toHaveValue(original);
  return original;
}

/** The document as the application projects it: the very rows the Composition
 *  pane renders, read back from the bridge. Selection is part of the
 *  projection, so a row that lost its selection moves this as well as a row
 *  that lost its name.
 *
 *  Comparing this before and after is what "the document is unchanged" means
 *  for a cancelled edit **from the state the document was created in** — the
 *  walk's own baseline, not the fixture it booted on. */
async function layerTree(page: Page): Promise<readonly unknown[]> {
  return page.evaluate(() => {
    const bridge = (
      window as unknown as {
        vigiliaEditorBridge?: { layers(): readonly unknown[] };
      }
    ).vigiliaEditorBridge;
    if (bridge === undefined) {
      throw new Error("no editor bridge on this mount");
    }
    return bridge.layers();
  });
}

/** Attaches the history-commit listener, or fails saying it could not.
 *
 *  A mount with no canvas would leave the count at its sentinel and a "no
 *  entries were added" assertion would pass having observed nothing — so the
 *  attach answers whether it happened and this throws when it did not. */
async function watchEditCommits(page: Page): Promise<void> {
  const attached = await page.evaluate(
    (names: { readonly event: string; readonly key: string }) => {
      const scope = window as unknown as Record<string, number | undefined> & {
        vigiliaEditorBridge?: {
          readonly editor?: {
            readonly canvas?: {
              on(name: string, listener: () => void): void;
            };
          };
        };
      };
      const canvas = scope.vigiliaEditorBridge?.editor?.canvas;
      if (canvas === undefined) return false;
      scope[names.key] = 0;
      canvas.on(names.event, () => {
        scope[names.key] = (scope[names.key] ?? 0) + 1;
      });
      return true;
    },
    { event: EDIT_COMMITTED, key: WALKTHROUGH_COMMITS },
  );
  if (!attached) {
    throw new Error(
      "no editor canvas on this mount: a cancelled edit's history cannot be observed",
    );
  }
}

/** How many history entries the application has recorded since
 *  {@link watchEditCommits}. `-1` when nothing was ever attached, which no
 *  assertion here reads as zero. */
async function editCommits(page: Page): Promise<number> {
  return page.evaluate(
    (key: string) =>
      (window as unknown as Record<string, number | undefined>)[key] ?? -1,
    WALKTHROUGH_COMMITS,
  );
}

/** What a cancelled Escape must have left open, as one object, so three
 *  moments — before the edit, after the first Escape, after the second — can be
 *  compared for being the same rather than asserted one line at a time.
 *
 *  The four are the field's own surroundings and nothing else: the Composition
 *  pane the selection was made through, the selection itself, the document the
 *  shell names, and the field the draft lived in. */
async function surroundingState(
  page: Page,
  id: string,
): Promise<{
  readonly pane: boolean;
  readonly selected: string | null;
  readonly document: string | null;
  readonly field: boolean;
}> {
  return {
    pane: await page.locator('[data-vigilia-panel="layers"]').isVisible(),
    selected: await page
      .locator(`[data-vigilia-layer="${id}"]`)
      .getAttribute("aria-selected"),
    document: await page.locator(".editor-shell-identity-name").textContent(),
    field: await page
      .locator(`.editor-shell-inspector ${FIELD_HOOK}`)
      .isVisible(),
  };
}

test.describe("the shell, reached by keyboard alone", () => {
  /**
   * **Two walks, and the union is what the region list is read against.**
   *
   * §13.1's sentence — "Each region has a reachable focus target" — does not
   * itself fix *when*, and the census found the difference: walked as the shell
   * opens, three of the four regions take focus and the inspector never does,
   * because it renders one paragraph while nothing is selected and a paragraph
   * is not a focus target. That was `vg-362`, filed as a rule question rather
   * than repaired.
   *
   * **The user ruled on 2026-10-12 that the requirement means a region with
   * content**, so an empty inspector legitimately contributes no tab stop and
   * no product change is owed. The census is what changes: it takes the opening
   * walk, makes a keyboard selection, and takes a second walk over the shell
   * where each region now has content. `REGIONS` is unchanged at four — a red
   * here still means the census ran and found what it found, and trimming the
   * list to the regions that pass is still the forbidden move. What changed is
   * *which walk* the fourth region is asserted in.
   *
   * **Both walks are reported and only their union is asserted**, because which
   * regions the opening state reaches is evidence about the shell that a merged
   * list cannot answer, and a failure should print both.
   *
   * The name half is proved to have teeth: with the region list reduced to the
   * three reached ones and the name assertion pointed at an element with no
   * accessible name, the run gets past the reachability assertion and fails on
   * the name — so neither half is vacuous.
   */
  test("the shell's regions each have a reachable, named focus target", async ({
    page,
  }) => {
    await openWalkthrough(page);
    const opening = await keyboardReach(page);
    // The inspector has content from here on, which is the state §13.1's
    // requirement is read in.
    await selectInPaneByKeyboard(page);
    const populated = await keyboardReach(page);

    const regionsReached = [
      ...new Set(
        [...opening, ...populated]
          .map((step) => step.region)
          .filter((region): region is Region => region !== null),
      ),
    ];

    expect(
      regionsReached,
      `the census, in Tab order:\nopening:\n${JSON.stringify(opening, null, 2)}\n` +
        `populated:\n${JSON.stringify(populated, null, 2)}`,
    ).toEqual(expect.arrayContaining([...REGIONS]));

    // **The second walk is the one that carries the fourth region.** Stated
    // separately so the union above cannot pass on the opening walk alone: the
    // opening state reaches three regions, and this is the claim the §13.1
    // ruling turns on — a populated inspector has a tab stop and an empty one
    // need not.
    expect(
      [...new Set(populated.map((step) => step.region))],
      `the populated walk should reach the inspector:\n${JSON.stringify(populated, null, 2)}`,
    ).toContain("inspector");

    // Reachable is not reachable if nothing can say its name (Review Focus 4),
    // so the first target in each region is asked what it is called.
    for (const region of REGIONS) {
      await expect(
        page.locator(`[${FIRST}="${region}"]`),
        `the first ${region} focus target`,
      ).toHaveAccessibleName(/\S/);
    }
  });

  /**
   * Two walks in one test, both of them whole.
   *
   * A walk marks every element it lands on and stops when it meets a mark, so a
   * mark left on the page makes the *next* walk stop on its first press — and
   * `tabUntil` throws on it rather than returning nothing. Every later task
   * runs more than one walk in a test (reach a region, then assert it can be
   * left), so the harness has to answer the same question twice on one page and
   * get the same answer.
   *
   * The regression is the second walk: with the marks not cleared between
   * walks, `keyboardReach` returns an empty record and this fails on the length
   * rather than on the agreement. It is asserted as an equality and not just as
   * "not empty", because a walk that skipped its first elements would also be
   * non-empty.
   */
  test("a second walk on the same page is a whole walk too", async ({
    page,
  }) => {
    await openWalkthrough(page);
    const first = await keyboardReach(page);
    const second = await keyboardReach(page);

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  /**
   * A `tabUntil` after a `keyboardReach`, which is the shape every later task
   * has: census where focus can go, then go somewhere on purpose.
   *
   * This is the case the defect was reported against — `tabUntil` *throws* on a
   * mark rather than returning an empty record, so without the clear it dies on
   * its first press with "focus returned to a seen element after 1 presses".
   *
   * The destination is the pane, and that is the only claim here: the predicate
   * accepts the pane whenever it arrives, so nothing is asserted about what
   * sits between the rail and it. The rail-then-pane route happens to be what
   * the census walks; that it *is* the next region is not this test's business.
   */
  test("a tabUntil can follow a walk on the same page", async ({ page }) => {
    await openWalkthrough(page);
    const walk = await keyboardReach(page);
    const landed = await tabUntil(page, (focus) => focus.region === "pane");

    expect(walk.some((step) => step.region === "pane")).toBe(true);
    expect(landed.region).toBe("pane");
  });

  /**
   * §13.1's first two interactions, and both halves of Review Focus 1.
   *
   * A document is created and a rail pane is chosen, after which the pane is
   * asked the two questions a keyboard user needs answered: **can focus get
   * in**, and **can it get out**. Reached is not enough — a pane that traps Tab
   * is reachable and useless, and a trap is what a focus-order bug produces — so
   * one continuous walk looks for a *later* region (the stage) after the pane.
   * Arriving somewhere later is what "left" means; a second walk would prove
   * nothing about the order.
   *
   * The name half is Review Focus 4: the first pane element the walk reached is
   * asked for its accessible name by Playwright's own `toHaveAccessibleName`,
   * since a target nobody can name is not a target a voice user has.
   *
   * **Tokens is a deliberate pane.** It is not the one the shell opens on, so
   * the walk cannot pass on the opening state, and it holds controls of its own
   * whatever is selected. `layers` is asserted hidden beside it, because "the
   * pane I asked for is showing" is half an answer without "and the one I left
   * is not".
   */
  test("a document is created and a rail pane is chosen with no pointer", async ({
    page,
  }) => {
    await openWalkthrough(page);
    await openDocumentByKeyboard(page);
    await chooseRailPane(page, "Tokens");

    await expect(
      page.locator('[data-vigilia-panel="tokens"]'),
      "the Tokens pane after the rail choice",
    ).toBeVisible();
    await expect(
      page.locator('[data-vigilia-panel="layers"]'),
      "the Composition pane after the rail choice",
    ).toBeHidden();

    const walk = await keyboardReach(page);
    const paneAt = walk.findIndex((step) => step.region === "pane");
    expect(
      paneAt,
      `the walk never reached the pane:\n${JSON.stringify(walk, null, 2)}`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      walk.slice(paneAt + 1).some((step) => step.region === "stage"),
      `focus did not leave the pane:\n${JSON.stringify(walk, null, 2)}`,
    ).toBe(true);

    await expect(
      page.locator(`[${FIRST}="pane"]`),
      "the first pane focus target",
    ).toHaveAccessibleName(/\S/);
  });

  /**
   * §13.1's third and fourth interactions: select through Composition, and edit
   * and cancel a field. Both halves of Review Focus 5 live here, because "the
   * document is unchanged" is the whole claim a cancelled edit makes — a field
   * that reverted while the document moved is a cancel that did not happen.
   *
   * The walk's document is the one the step before it created from the starter,
   * so the state it is unchanged from is that document's own, read once the
   * selection is in place: the field's surroundings and the layer projection the
   * Composition pane renders.
   *
   * **Review Focus 2 is the second claim, and it is not the same one.** §13.1
   * says Escape affects one innermost owner, so what this test asks after the
   * first Escape is not "did the field revert" — the helper answers that — but
   * what is still open: the field sits inside the inspector, inside the shell,
   * beside the pane the selection was made through, and all four are still
   * there. The second Escape is the other half: a cancel that needed two would
   * fail the first comparison, and one that reached a further owner on the way
   * out would fail the second.
   */
  test("a field is edited and cancelled, and the document is unchanged", async ({
    page,
  }) => {
    await openWalkthrough(page);
    await openDocumentByKeyboard(page);
    const id = await selectInComposition(page, WALKTHROUGH_LAYER_NAME);

    const before = await layerTree(page);
    // An empty projection would make "unchanged" mean nothing, so the state the
    // cancelled edit must leave alone is asserted to have something in it.
    expect(
      before.length,
      "the projection the Composition pane renders",
    ).toBeGreaterThan(0);
    const opened = await surroundingState(page, id);
    expect(opened, "the field's surroundings before it is edited").toEqual({
      pane: true,
      selected: "true",
      document: STARTER_DOCUMENT_NAME,
      field: true,
    });

    await watchEditCommits(page);
    const original = await editFieldThenCancel(page);

    expect(
      await editCommits(page),
      "history entries the cancelled edit recorded",
    ).toBe(0);
    expect(
      await layerTree(page),
      "the document after the cancelled edit",
    ).toEqual(before);
    await expect(
      page.locator(`[data-vigilia-layer="${id}"] .vigilia-layer-name`),
      "the row still reads the name the cancelled edit did not take",
    ).toHaveText(original);

    // One Escape, and exactly one owner closed: the field's draft.
    expect(
      await surroundingState(page, id),
      "Escape closed something above the field",
    ).toEqual(opened);
    expect(
      await page.locator(`.editor-shell-inspector ${FIELD_HOOK}`),
      "the field focus stayed in",
    ).toBeFocused();

    // A second Escape is not needed, and reaches nothing further.
    await page.keyboard.press("Escape");
    expect(
      await surroundingState(page, id),
      "a second Escape changed something",
    ).toEqual(opened);
    expect(await editCommits(page), "history after a second Escape").toBe(0);
    expect(await layerTree(page), "the document after a second Escape").toEqual(
      before,
    );
  });
});
