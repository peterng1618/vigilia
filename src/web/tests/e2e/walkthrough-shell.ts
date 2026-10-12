import { expect, type Page } from "@playwright/test";
import { HOST_PORT, HOST_THEME_ID } from "./host-theme.js";
import { REGION_SELECTOR, TAB_BOUND, tabUntil } from "./walkthrough-focus.js";

/**
 * The shell's own keyboard vocabulary: the gestures §13.1's order is made of,
 * and the projecting reads they are asserted against.
 *
 * Split out of `host-walkthrough.spec.ts` under Ruling L. Where a control is and
 * how focus reaches it is `walkthrough-focus.ts`'s; what a control *means* —
 * a document, a rail pane, a selected row, a field — is this module's, and the
 * spec holds the tests and nothing else.
 */

const HOST = `http://127.0.0.1:${HOST_PORT}`;

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
export async function openWalkthrough(page: Page): Promise<void> {
  await page.goto(`${HOST}/editor/?theme=${HOST_THEME_ID}`);
  await expect(page.locator(".editor-shell-zoom")).toBeVisible();
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
export async function selectInPaneByKeyboard(page: Page): Promise<void> {
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
export async function focusLayerRow(
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
export async function selectInComposition(
  page: Page,
  name: string,
): Promise<string> {
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
export const STARTER_DOCUMENT_NAME = "System dashboard";
/** Bounds for the two searches — the File menu's rows and the rail's slots —
 *  which report a count rather than hang. */
const FILE_MENU_BOUND = 12;
const RAIL_BOUND = 40;

/** The Composition row this task's walk selects. It is the starter's own
 *  `wordmark` — a top-level text object — so the walk selects something that
 *  sits inside no group; a row whose group had to be entered first is a
 *  different interaction, and Task 4's. */
export const WALKTHROUGH_LAYER_NAME = "wordmark";

/** The draft a cancelled edit is given. Any string but the authored one leaves
 *  the field having really held it, which is what makes the cancel mean
 *  something: a field that never took the text would revert to the same value
 *  while proving nothing. */
export const FIELD_DRAFT = "walkthrough draft";

/** The hook the selection's own name field carries (`nameField`,
 *  `selection-inspector/appearance.ts`), on the focus target rather than a
 *  wrapper. */
const FIELD_HOOK = "[data-vigilia-name]";

/** That field **inside the inspector**, which is what the three places that
 *  reach for it mean. Scoped because the hook is the inspector's own convention
 *  and nothing stops a second surface from carrying it: an unscoped match would
 *  find the other one and report a confusing mismatch rather than a clean
 *  failure. */
export const FIELD_SELECTOR = `${REGION_SELECTOR.inspector} ${FIELD_HOOK}`;

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

/** The canvas the listener above attached to, kept so {@link editCommits} can
 *  tell a live attach from one the editor has outlived. */
const WALKTHROUGH_CANVAS = "__vigiliaWalkthroughCanvas";

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
export async function openDocumentByKeyboard(page: Page): Promise<void> {
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
export async function chooseRailPane(page: Page, name: string): Promise<void> {
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
export async function editFieldThenCancel(page: Page): Promise<string> {
  const field = page.locator(FIELD_SELECTOR);
  await tabUntil(page, (focus) => focus.region === "inspector");
  for (let press = 0; press < TAB_BOUND; press++) {
    const onField = await page.evaluate(
      (sel: { readonly hook: string; readonly scope: string }) => {
        const active = document.activeElement;
        return (
          active !== null &&
          active.matches(sel.hook) &&
          active.closest(sel.scope) !== null
        );
      },
      { hook: FIELD_HOOK, scope: REGION_SELECTOR.inspector },
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
export async function layerTree(page: Page): Promise<readonly unknown[]> {
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
 *  attach answers whether it happened and this throws when it did not. The
 *  other half of that liveness is {@link editCommits}: an attach that happened
 *  and then went stale reads 0 forever. */
export async function watchEditCommits(page: Page): Promise<void> {
  const attached = await page.evaluate(
    (names: {
      readonly event: string;
      readonly key: string;
      readonly canvasKey: string;
    }) => {
      const scope = window as unknown as Record<string, unknown> & {
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
      // The instance itself, so the reader can tell a live attach from a stale
      // one rather than trusting that a listener it cannot see still fires.
      scope[names.canvasKey] = canvas;
      canvas.on(names.event, () => {
        scope[names.key] = ((scope[names.key] as number | undefined) ?? 0) + 1;
      });
      return true;
    },
    {
      event: EDIT_COMMITTED,
      key: WALKTHROUGH_COMMITS,
      canvasKey: WALKTHROUGH_CANVAS,
    },
  );
  if (!attached) {
    throw new Error(
      "no editor canvas on this mount: a cancelled edit's history cannot be observed",
    );
  }
}

/** How many history entries the application has recorded since
 *  {@link watchEditCommits}. `-1` when nothing was ever attached, which no
 *  assertion here reads as zero.
 *
 *  **Reading throws when the watched canvas is no longer the published one.** A
 *  listener attached to a canvas the editor has since replaced would count 0
 *  forever, and "no history entry was added" would pass having observed
 *  nothing — the same silent green the attach guard exists to prevent, one step
 *  later. The bridge is re-published on every remount, so the comparison is
 *  cheap and the failure is the honest one. */
export async function editCommits(page: Page): Promise<number> {
  return page.evaluate(
    (names: { readonly key: string; readonly canvasKey: string }) => {
      const scope = window as unknown as Record<string, unknown> & {
        vigiliaEditorBridge?: {
          readonly editor?: { readonly canvas?: unknown };
        };
      };
      const count = scope[names.key];
      if (count === undefined) return -1;
      if (
        scope[names.canvasKey] !== scope.vigiliaEditorBridge?.editor?.canvas
      ) {
        throw new Error(
          "the watched canvas is no longer the one the editor publishes: a cancelled edit's history cannot be observed",
        );
      }
      return count as number;
    },
    { key: WALKTHROUGH_COMMITS, canvasKey: WALKTHROUGH_CANVAS },
  );
}

/** What a cancelled Escape must have left open, as one object, so three
 *  moments — before the edit, after the first Escape, after the second — can be
 *  compared for being the same rather than asserted one line at a time.
 *
 *  The four are the field's own surroundings and nothing else: the Composition
 *  pane the selection was made through, the selection itself, the document the
 *  shell names, and the field the draft lived in. */
export async function surroundingState(
  page: Page,
  id: string,
): Promise<{
  readonly pane: boolean;
  readonly selected: string | null;
  readonly document: string | null;
  readonly field: boolean;
}> {
  const chip = page.locator(".editor-shell-identity-name");
  return {
    pane: await page.locator('[data-vigilia-panel="layers"]').isVisible(),
    selected: await page
      .locator(`[data-vigilia-layer="${id}"]`)
      .getAttribute("aria-selected"),
    // Visibility is part of the reading, not a separate assertion: a hidden
    // chip still answers `textContent()`, so the leg would hold while the shell
    // said nothing where a reader can see it. The other three legs read state
    // the same way, and `null` is what a hidden one contributes.
    document: (await chip.isVisible()) ? await chip.textContent() : null,
    field: await page.locator(FIELD_SELECTOR).isVisible(),
  };
}
