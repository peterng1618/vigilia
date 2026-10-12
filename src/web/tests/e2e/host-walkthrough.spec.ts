import { expect, test } from "@playwright/test";
import {
  FIRST,
  keyboardReach,
  REGIONS,
  type Region,
  tabUntil,
} from "./walkthrough-focus.js";
import {
  chooseRailPane,
  editCommits,
  editFieldThenCancel,
  FIELD_SELECTOR,
  layerTree,
  openDocumentByKeyboard,
  openWalkthrough,
  STARTER_DOCUMENT_NAME,
  selectInComposition,
  selectInPaneByKeyboard,
  surroundingState,
  WALKTHROUGH_LAYER_NAME,
  watchEditCommits,
} from "./walkthrough-shell.js";

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
 * **The census was red, and the red was its result — not a broken test.** The
 * walk reached the rail, the pane and the stage and never the inspector, because
 * with nothing selected the column renders one paragraph and a paragraph is not
 * a focus target. That is `vg-362`.
 *
 * **The user ruled on 2026-10-12 that §13.1's "each region has a reachable focus
 * target" means a region that has CONTENT.** The empty inspector therefore
 * contributes no tab stop legitimately, no product change is owed, and what
 * changed is this census: it walks the shell as it opens, makes a selection with
 * the keyboard alone, and walks it a second time, reporting both walks. `REGIONS`
 * is still the same four — trimming it to the regions an opening-state walk
 * reaches remains the forbidden move, and a green here does not license it.
 *
 * **The primitives are `walkthrough-focus.ts`'s and the shell's vocabulary is
 * `walkthrough-shell.ts`'s** (Ruling L): the split is by responsibility because
 * the file had passed AGENTS.md's 800-line stop, and what is left here is the
 * tests, which is what the walkthrough's acceptance is read from.
 */

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
      await page.locator(FIELD_SELECTOR),
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
