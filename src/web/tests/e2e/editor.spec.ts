import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The editor, driven by real pointer and keyboard input.
 *
 * The pure modules already prove the *decisions* are right — what a click
 * selects, what a drag does to a transform, what undo restores. These tests
 * prove the wiring: that a pointer event reaches those functions with the right
 * coordinates, that the result reaches the renderer, and that the overlay ends
 * up on top of the thing it is describing.
 *
 * Absolute URLs because `baseURL` belongs to the player; see the note in
 * `playwright.config.ts`.
 */

const EDITOR = 'http://127.0.0.1:4174/';

/** Desktop only: these are mouse gestures, and the editor is desktop-hosted. */
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the editor is a desktop surface');
});

async function openEditor(page: Page): Promise<void> {
  await page.goto(EDITOR);
  await page.waitForSelector('[data-vigilia="artboard"]');
  await page.waitForSelector('[data-vigilia-overlay="root"]');
  // The first chart canvas is a good "scene is up" signal.
  await page.locator('[data-node-id="cpu-gauge"] canvas').first().waitFor();
}

/** Opens a named fixture theme instead of the showcase one. */
async function openTheme(page: Page, theme: string, ready: string): Promise<void> {
  await page.goto(`${EDITOR}?theme=${theme}`);
  await page.waitForSelector('[data-vigilia-overlay="root"]');
  await page.locator(`[data-node-id="${ready}"]`).waitFor();
}

/**
 * Double-clicks at one spot until `id` is what is selected.
 *
 * Entering a group is one double-click per level, and the fixture used below is
 * three deep. Driven by the status bar rather than a fixed count so the test
 * says what it wants instead of encoding the tree's depth.
 */
async function selectByEntering(page: Page, id: string, at: { x: number; y: number }): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (((await page.locator('#status').textContent()) ?? '').startsWith(id)) {
      return;
    }

    await page.mouse.click(at.x, at.y, { clickCount: 2 });
  }

  throw new Error(`could not select ${id}: status says ${await page.locator('#status').textContent()}`);
}

/** Centre of a node's rendered box, in page coordinates. */
async function centreOf(node: Locator): Promise<{ x: number; y: number }> {
  const box = await node.boundingBox();

  if (box === null) {
    throw new Error('node has no box');
  }

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 8,
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // Several steps rather than one jump: a single move would not exercise the
  // preview path, which is where §67's one-entry-per-gesture rule lives.
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

/**
 * Selects `cpu-panel-bg`, a node INSIDE the CPU group.
 *
 * The interesting case for both the overlay and the inspector: its `x`/`y` are
 * group-relative, so anything that confuses parent space with document space is
 * wrong here and correct for every top-level node.
 */
async function selectPanelBackground(page: Page): Promise<void> {
  const box = await page.locator('[data-node-id="cpu-panel-bg"]').boundingBox();

  if (box === null) {
    throw new Error('cpu-panel-bg has no box');
  }

  // Near the corner, not the centre: the gauge and the readout are painted
  // above the background and fill the middle, so a centre click correctly
  // selects `cpu-readout` instead (§137, topmost wins).
  const spot = { x: box.x + 10, y: box.y + 10 };

  // Two presses at the same spot: the first selects the group, the second
  // enters it and takes the leaf under the cursor.
  await page.mouse.click(spot.x, spot.y);
  await page.mouse.click(spot.x, spot.y);

  // The status bar names the selected node, so this asserts the leaf was
  // reached rather than merely that something is selected — landing on the
  // enclosing group would silently make every assertion below vacuous.
  await expect(page.locator('#status')).toContainText('cpu-panel-bg');
}

test.describe('selection', () => {
  test('clicking a node selects it and draws an outline with handles', async ({ page }) => {
    await openEditor(page);

    await expect(page.locator('#status')).toContainText('Nothing selected');

    await page.mouse.click(...Object.values(await centreOf(page.locator('[data-node-id="title"]'))) as [number, number]);

    await expect(page.locator('#status')).toContainText('title');
    await expect(page.locator('[data-vigilia-overlay="outline"]')).toHaveCount(1);
    // Eight resize handles plus rotate.
    await expect(page.locator('[data-vigilia-handle]')).toHaveCount(9);
  });

  test('clicking a grouped node selects the group, not the leaf', async ({ page }) => {
    await openEditor(page);

    const gauge = await centreOf(page.locator('[data-node-id="cpu-gauge"]'));
    await page.mouse.click(gauge.x, gauge.y);

    // cpu-gauge lives inside cpu-panel; a widget should behave like one object.
    await expect(page.locator('#status')).toContainText('cpu-panel');
  });

  test('double-clicking enters the group and selects what is under the cursor', async ({ page }) => {
    await openEditor(page);

    const gauge = await centreOf(page.locator('[data-node-id="cpu-gauge"]'));
    await page.mouse.dblclick(gauge.x, gauge.y);

    await expect(page.locator('#status')).toContainText('inside cpu-panel');
    // The gauge's centre is also where the value readout sits, and the readout
    // is painted on top — so the topmost node there is `cpu-readout`, not the
    // gauge. That is the hit-test rule working (§137), and the first version of
    // this test asserted the wrong node.
    await expect(page.locator('#status')).toContainText('cpu-readout');
    await expect(page.locator('#status')).not.toContainText('Nothing selected');
  });

  test('escape leaves the group and selects it', async ({ page }) => {
    await openEditor(page);

    const gauge = await centreOf(page.locator('[data-node-id="cpu-gauge"]'));
    await page.mouse.dblclick(gauge.x, gauge.y);
    await page.keyboard.press('Escape');

    await expect(page.locator('#status')).toContainText('cpu-panel');
    await expect(page.locator('#status')).not.toContainText('inside');
  });

  test('clicking empty canvas deselects', async ({ page }) => {
    await openEditor(page);

    await page.mouse.click(...Object.values(await centreOf(page.locator('[data-node-id="title"]'))) as [number, number]);
    await expect(page.locator('#status')).toContainText('title');

    // Bottom-right of the stage, well clear of the dashboard's content.
    const stage = await page.locator('#stage').boundingBox();
    await page.mouse.click(stage!.x + stage!.width - 12, stage!.y + stage!.height - 12);

    await expect(page.locator('#status')).toContainText('Nothing selected');
    await expect(page.locator('[data-vigilia-overlay="outline"]')).toHaveCount(0);
  });

  test('a marquee selects several nodes', async ({ page }) => {
    await openEditor(page);

    const stage = (await page.locator('#stage').boundingBox())!;

    // Drag across the whole artboard from a corner of empty canvas.
    await drag(
      page,
      { x: stage.x + 4, y: stage.y + 4 },
      { x: stage.x + stage.width - 4, y: stage.y + stage.height - 4 },
    );

    await expect(page.locator('#status')).toContainText('selected');
    const outlines = await page.locator('[data-vigilia-overlay="outline"]').count();
    expect(outlines).toBeGreaterThan(1);
  });
});

test.describe('gestures', () => {
  test('dragging moves the selected node, and it stays moved', async ({ page }) => {
    await openEditor(page);

    const title = page.locator('[data-node-id="title"]');
    const before = (await title.boundingBox())!;
    const centre = { x: before.x + before.width / 2, y: before.y + before.height / 2 };

    await page.mouse.click(centre.x, centre.y);
    await drag(page, centre, { x: centre.x + 120, y: centre.y + 60 });

    const after = (await title.boundingBox())!;

    // Approximate because snapping may pull the drop a few pixels onto an
    // alignment — which is the feature working, not an error.
    expect(after.x - before.x).toBeGreaterThan(100);
    expect(after.y - before.y).toBeGreaterThan(40);
  });

  test('a drag is one undo step, not one per pointer move (§67)', async ({ page }) => {
    await openEditor(page);

    const title = page.locator('[data-node-id="title"]');
    const before = (await title.boundingBox())!;
    const centre = { x: before.x + before.width / 2, y: before.y + before.height / 2 };

    await page.mouse.click(centre.x, centre.y);
    // 20 intermediate moves. If each were recorded, one undo would step back a
    // few pixels and the box would not return to where it started.
    await drag(page, centre, { x: centre.x + 200, y: centre.y }, 20);

    await expect(page.locator('#status')).toContainText('unsaved');

    await page.keyboard.press('Control+z');

    const after = (await title.boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    await expect(page.locator('#status')).toContainText('saved');
  });

  test('redo replays the move', async ({ page }) => {
    await openEditor(page);

    const title = page.locator('[data-node-id="title"]');
    const before = (await title.boundingBox())!;
    const centre = { x: before.x + before.width / 2, y: before.y + before.height / 2 };

    await page.mouse.click(centre.x, centre.y);
    await drag(page, centre, { x: centre.x + 150, y: centre.y });

    const moved = (await title.boundingBox())!;

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+Shift+z');

    const redone = (await title.boundingBox())!;
    expect(Math.abs(redone.x - moved.x)).toBeLessThan(2);
  });

  test('a resize handle changes the size and keeps the opposite edge', async ({ page }) => {
    await openEditor(page);

    const panel = page.locator('[data-node-id="thermals-panel"]');
    const before = (await panel.boundingBox())!;

    await page.mouse.click(before.x + before.width / 2, before.y + 20);
    await expect(page.locator('[data-vigilia-handle="e"]')).toHaveCount(1);

    const handle = (await page.locator('[data-vigilia-handle="e"]').boundingBox())!;
    await drag(
      page,
      { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
      { x: handle.x + handle.width / 2 + 80, y: handle.y + handle.height / 2 },
    );

    const after = (await panel.boundingBox())!;

    expect(after.width).toBeGreaterThan(before.width + 40);
    // The west edge is the anchor for an east-handle drag.
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  });

  test('arrow keys nudge the selection', async ({ page }) => {
    await openEditor(page);

    const title = page.locator('[data-node-id="title"]');
    const before = (await title.boundingBox())!;

    await page.mouse.click(before.x + before.width / 2, before.y + before.height / 2);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    const after = (await title.boundingBox())!;
    expect(after.x - before.x).toBeGreaterThan(0.5);

    // Shift nudges further.
    await page.keyboard.press('Shift+ArrowDown');
    const nudged = (await title.boundingBox())!;
    expect(nudged.y - after.y).toBeGreaterThan(5);
  });

  test('escape cancels a drag in progress', async ({ page }) => {
    await openEditor(page);

    const title = page.locator('[data-node-id="title"]');
    const before = (await title.boundingBox())!;
    const centre = { x: before.x + before.width / 2, y: before.y + before.height / 2 };

    await page.mouse.click(centre.x, centre.y);
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + 200, centre.y + 100, { steps: 6 });
    await page.keyboard.press('Escape');
    await page.mouse.up();

    const after = (await title.boundingBox())!;

    // Abandoned, not committed: the node is where it started and nothing is
    // dirty.
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    await expect(page.locator('#status')).toContainText('saved');
  });
});

test.describe('deletion', () => {
  test('delete removes the selection and undo brings it back', async ({ page }) => {
    await openEditor(page);

    const title = page.locator('[data-node-id="title"]');
    const box = (await title.boundingBox())!;

    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.press('Delete');

    await expect(title).toHaveCount(0);
    await expect(page.locator('#status')).toContainText('unsaved');

    await page.keyboard.press('Control+z');

    // Back, and the scene was rebuilt to include it — which is the path
    // `mountScene.update` deliberately refuses, since it is for new data rather
    // than a new document.
    await expect(page.locator('[data-node-id="title"]')).toHaveCount(1);
  });
});

test.describe('the scene is the renderer\'s, not a placeholder', () => {
  test('charts render live in the editor, exactly as in the player', async ({ page }) => {
    // ADR-0005's decisive point: chart fidelity in the editor costs nothing
    // here, because the editor mounts the same renderer the player does. If
    // this ever fails, the editor has grown a second rendering path.
    await openEditor(page);

    for (const id of ['cpu-gauge', 'history-chart', 'thermals-bars', 'memory-donut']) {
      const canvas = page.locator(`[data-node-id="${id}"] canvas`).first();
      await expect(canvas, `chart ${id} is not rendered in the editor`).toBeVisible();

      const painted = await canvas.evaluate((element) => {
        const source = element as HTMLCanvasElement;
        const context = source.getContext('2d');
        if (context === null) {
          return false;
        }
        const { data } = context.getImageData(0, 0, source.width, source.height);
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] !== 0) {
            return true;
          }
        }
        return false;
      });

      expect(painted, `chart ${id} drew no pixels in the editor`).toBe(true);
    }
  });

  test('the overlay never swallows a click', async ({ page }) => {
    // The overlay covers the whole stage. If it took pointer events, every node
    // would be unselectable — so only the handle hit areas may.
    await openEditor(page);

    await expect(page.locator('[data-vigilia-overlay="root"]')).toHaveCSS(
      'pointer-events',
      'none',
    );
  });
});

test.describe('evidence', () => {
  test('captures the editor with a selection, for human review', async ({ page }, testInfo) => {
    // Committed to docs/gates/screenshots/ with VIGILIA_CAPTURE=1, like the
    // player captures. Shows what the authoring surface actually looks like —
    // including that the charts under the selection are live, which is the part
    // ADR-0005 turns on.
    const directory =
      process.env['VIGILIA_CAPTURE'] === undefined
        ? 'test-results/screenshots'
        : '../../docs/gates/screenshots';

    await openEditor(page);

    // Select a panel so the outline and handles are in frame.
    const panel = await centreOf(page.locator('[data-node-id="cpu-panel-bg"]'));
    await page.mouse.click(panel.x, panel.y);
    await expect(page.locator('[data-vigilia-handle]')).toHaveCount(9);

    const screenshot = await page.screenshot({
      path: `${directory}/editor-${testInfo.project.name}.png`,
    });

    await testInfo.attach(`editor-${testInfo.project.name}.png`, {
      body: screenshot,
      contentType: 'image/png',
    });

    expect(screenshot.byteLength).toBeGreaterThan(1000);
  });

  test('captures the globals panel', async ({ page }, testInfo) => {
    const directory =
      process.env['VIGILIA_CAPTURE'] === undefined
        ? 'test-results/screenshots'
        : '../../docs/gates/screenshots';

    await openEditor(page);
    await page.locator('[data-vigilia-tab="theme"]').click();
    await expect(page.locator('[data-vigilia-global="palette.panel"]')).toBeVisible();

    const screenshot = await page.screenshot({
      path: `${directory}/editor-globals-${testInfo.project.name}.png`,
    });

    await testInfo.attach(`editor-globals-${testInfo.project.name}.png`, {
      body: screenshot,
      contentType: 'image/png',
    });

    expect(screenshot.byteLength).toBeGreaterThan(1000);
  });

  test('captures a grouped node with the inspector open', async ({ page }, testInfo) => {
    // The evidence for two things that are only observable together: handles
    // sitting on a node whose coordinates are group-relative, and §75 showing
    // `style.fill` as the global token it points at rather than a raw colour.
    const directory =
      process.env['VIGILIA_CAPTURE'] === undefined
        ? 'test-results/screenshots'
        : '../../docs/gates/screenshots';

    await openEditor(page);
    await selectPanelBackground(page);

    // The handles must be on the panel, not at the artboard origin — which is
    // exactly the bug this capture was added after. Compared by CENTRE: a
    // handle's element is a hit area centred on the corner, so its box origin
    // sits half the hit size away and comparing origins fails by 9 px on a
    // perfectly placed handle.
    const handle = await page.locator('[data-vigilia-handle="nw"]').boundingBox();
    const target = await page.locator('[data-node-id="cpu-panel-bg"]').boundingBox();

    expect((handle?.x ?? 0) + (handle?.width ?? 0) / 2).toBeCloseTo(target?.x ?? 0, 0);
    expect((handle?.y ?? 0) + (handle?.height ?? 0) / 2).toBeCloseTo(target?.y ?? 0, 0);

    const screenshot = await page.screenshot({
      path: `${directory}/editor-inspector-${testInfo.project.name}.png`,
    });

    await testInfo.attach(`editor-inspector-${testInfo.project.name}.png`, {
      body: screenshot,
      contentType: 'image/png',
    });

    expect(screenshot.byteLength).toBeGreaterThan(1000);
  });
});

test.describe('the inspector', () => {
  test('shows the selected node, and nothing before there is one', async ({ page }) => {
    await openEditor(page);

    const inspector = page.locator('[data-vigilia-inspector="root"]');
    await expect(inspector).toContainText('Nothing selected.');

    await page.locator('[data-node-id="title"]').click();

    await expect(inspector).not.toContainText('Nothing selected.');
    await expect(page.locator('[data-vigilia-input="name"]')).toBeVisible();
    // Read-only: the id identifies the node in the document and in bindings.
    await expect(page.locator('[data-vigilia-field="id"] input')).toBeDisabled();
  });

  test('editing keys typed into a field do not reach the document', async ({ page }) => {
    await openEditor(page);
    await page.locator('[data-node-id="title"]').click();

    const node = page.locator('[data-node-id="title"]');
    const before = await node.boundingBox();
    const name = page.locator('[data-vigilia-input="name"]');

    await name.click();
    await name.fill('Heading');

    // The shortcuts are bound on `window`, so without a guard this Backspace
    // deletes the selected element rather than a character, and these arrows
    // nudge it rather than moving the caret.
    await page.keyboard.press('Backspace');
    await expect(name).toHaveValue('Headin');

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');

    await expect(node).toBeVisible();
    const after = await node.boundingBox();
    expect(after?.x).toBeCloseTo(before?.x ?? 0, 1);
    expect(after?.y).toBeCloseTo(before?.y ?? 0, 1);
    // Nothing was committed, so the history is still where it started.
    await expect(page.locator('#status')).not.toContainText('undo: Nudge');
    await expect(page.locator('#status')).not.toContainText('undo: Delete');
  });

  test('typing a transform value moves the node', async ({ page }) => {
    await openEditor(page);
    await page.locator('[data-node-id="title"]').click();

    const before = await page.locator('[data-node-id="title"]').boundingBox();
    const x = page.locator('[data-vigilia-input="transform.x"]');

    await x.fill('200');
    // Committed on `change`, not on every keystroke: an edit per character
    // would put 3 entries in the history for "200" and fight the 1 Hz redraw.
    await x.blur();

    await expect(page.locator('#status')).toContainText('undo: Set x');

    const after = await page.locator('[data-node-id="title"]').boundingBox();
    expect(after?.x).toBeGreaterThan(before?.x ?? 0);
  });

  test('rotation past the schema range wraps instead of failing to save', async ({ page }) => {
    await openEditor(page);
    await page.locator('[data-node-id="title"]').click();

    const rotation = page.locator('[data-vigilia-input="transform.rotation"]');
    await rotation.fill('400');
    await rotation.blur();

    // 400 is outside the schema's −360…360, so it is normalised rather than
    // stored and rejected later by the validator.
    await expect(rotation).toHaveValue('40');
  });

  test('a style bound to a global shows the token, not the colour (§75)', async ({ page }) => {
    await openEditor(page);
    await selectPanelBackground(page);

    // The demo theme fills this panel from `palette.panel`.
    const ref = page.locator('[data-vigilia-ref="style.fill"]');
    await expect(ref).toBeVisible();
    // And no literal input for the same property — §75 is a XOR, and showing
    // both would invite an author to set a value that the ref then overrides.
    await expect(page.locator('[data-vigilia-input="style.fill"]')).toHaveCount(0);
  });

  test('"make local" copies the resolved colour in, and "use global" puts it back', async ({ page }) => {
    await openEditor(page);
    await selectPanelBackground(page);

    await page.locator('[data-vigilia-mode="literal:style.fill"]').click();

    const input = page.locator('[data-vigilia-input="style.fill"]');
    // Seeded with what the ref resolved to, so detaching does not change the
    // rendering — the author sees the same pixels and can now edit them.
    await expect(input).toHaveValue(/^#[0-9a-fA-F]{3,8}$/);
    await expect(page.locator('[data-vigilia-ref="style.fill"]')).toHaveCount(0);

    // "Use global" opens a picker with nothing chosen. It must NOT commit yet:
    // writing a placeholder ref would put a dangling reference in the document
    // and an undo entry in the history for an unfinished choice.
    //
    // The status already says "Set fill" from the detach above, so this
    // compares the whole line for *no change* rather than looking for a label.
    const detached = await page.locator('#status').textContent();

    await page.locator('[data-vigilia-mode="ref:style.fill"]').click();

    const picker = page.locator('[data-vigilia-ref="style.fill"]');
    await expect(picker).toBeVisible();
    await expect(picker).toHaveValue('');
    await expect(page.locator('#status')).toHaveText(detached ?? '');

    await picker.selectOption('palette.panel');
    // Back to a ref row, showing the token rather than a value.
    await expect(page.locator('[data-vigilia-input="style.fill"]')).toHaveCount(0);
  });

  test('backing out of "use global" without choosing changes nothing', async ({ page }) => {
    await openEditor(page);
    await selectPanelBackground(page);

    await page.locator('[data-vigilia-mode="literal:style.fill"]').click();
    const before = await page.locator('#status').textContent();

    // Open the picker, then back out with the same button.
    await page.locator('[data-vigilia-mode="ref:style.fill"]').click();
    await page.locator('[data-vigilia-mode="literal:style.fill"]').click();

    await expect(page.locator('[data-vigilia-input="style.fill"]')).toBeVisible();
    // No extra history entry: the pending state was never in the document.
    await expect(page.locator('#status')).toHaveText(before ?? '');
  });

  test('editing a literal colour repaints the node', async ({ page }) => {
    await openEditor(page);
    await selectPanelBackground(page);

    await page.locator('[data-vigilia-mode="literal:style.fill"]').click();

    const input = page.locator('[data-vigilia-input="style.fill"]');
    await input.fill('#ff0000');
    await input.blur();

    await expect(page.locator('[data-node-id="cpu-panel-bg"]')).toHaveCSS(
      'background-color',
      'rgb(255, 0, 0)',
    );
  });

  test('clearing a property returns it to the default, and undo restores it', async ({ page }) => {
    await openEditor(page);
    await selectPanelBackground(page);

    const shadow = page.locator('[data-vigilia-input="style.shadowColor"]');
    await expect(shadow).toHaveValue('#00000066');

    await page.locator('[data-vigilia-clear="style.shadowColor"]').click();
    // Cleared means absent, which the panel shows as the placeholder rather
    // than as an empty value that would round-trip as `shadowColor: ""`.
    await expect(shadow).toHaveValue('');
    await expect(shadow).toHaveAttribute('placeholder', 'default');

    await page.keyboard.press('Control+z');
    await expect(shadow).toHaveValue('#00000066');
  });

  test('a multi-selection shows shared values and marks the rest mixed', async ({ page }) => {
    await openEditor(page);

    await page.locator('[data-node-id="title"]').click();
    await page.locator('[data-node-id="cpu-panel"]').click({ modifiers: ['Shift'] });

    // Both sit at x 48 and differ in y. A field is only mixed when the values
    // actually differ — showing "mixed" for an agreed value would be as
    // misleading as showing one node's value for a disagreement.
    await expect(page.locator('[data-vigilia-input="transform.x"]')).toHaveValue('48');
    await expect(page.locator('[data-vigilia-input="transform.y"]')).toHaveValue('');
    await expect(page.locator('[data-vigilia-input="transform.y"]')).toHaveAttribute(
      'placeholder',
      'mixed',
    );
  });

  test('a locked node is inspectable but not transformable (§61)', async ({ page }) => {
    await openEditor(page);
    await page.locator('[data-node-id="title"]').click();

    const locked = page.locator('[data-vigilia-input="locked"]');
    await locked.check();

    // §61: still selected, still inspectable — the panel stays populated.
    await expect(page.locator('[data-vigilia-input="name"]')).toBeVisible();
    // But the transform handles are gone, so it cannot be dragged.
    await expect(page.locator('[data-vigilia-handle="se"]')).toHaveCount(0);
  });
});

test.describe('a child of a transformed group', () => {
  /**
   * The case the pure tests cover and no fixture had ever driven with a real
   * pointer: `nest-leaf` in the stress theme sits inside a group scaled to 0.9
   * inside a group rotated 4°.
   *
   * A node's `x`/`y` are in its parent's space (§57) while a pointer delta
   * arrives in document space, so the delta has to be converted. Without that
   * conversion the node moves by the parent's scale factor — it lags the
   * pointer — and under rotation it travels at an angle to it. Both are
   * invisible for every top-level node, which is why this needs its own test.
   */
  test('follows the pointer exactly, despite a scaled and rotated ancestry', async ({ page }) => {
    await openTheme(page, 'stress', 'nest-leaf');

    const leaf = page.locator('[data-node-id="nest-leaf"]');
    const start = await centreOf(leaf);

    await selectByEntering(page, 'nest-leaf', start);

    const before = await leaf.boundingBox();

    // Ctrl disables snapping. Without it the drop lands on whatever alignment
    // is within threshold — which is correct behaviour and ruins the
    // measurement: the first run came back 1.73 px off on y for exactly that
    // reason. This test is about the delta conversion, nothing else.
    await page.keyboard.down('Control');
    await drag(page, start, { x: start.x + 100, y: start.y + 40 });
    await page.keyboard.up('Control');

    const after = await leaf.boundingBox();

    // Screen pixels in, screen pixels out. Scale-independent, so the artboard
    // fit does not enter the assertion: drag the mouse 100 px and the element
    // moves 100 px. The unconverted version moves 0.9 × that, ~90 px, and
    // additionally drifts a few px off-axis from the 4° rotation.
    expect((after?.x ?? 0) - (before?.x ?? 0)).toBeCloseTo(100, 0);
    expect((after?.y ?? 0) - (before?.y ?? 0)).toBeCloseTo(40, 0);
  });

  test('a selection holding a group and its child moves the child once', async ({ page }) => {
    await openTheme(page, 'stress', 'nest-leaf');

    const leaf = page.locator('[data-node-id="nest-leaf"]');
    const start = await centreOf(leaf);

    await selectByEntering(page, 'nest-leaf', start);
    // Shift-click adds the enclosing group, so both an ancestor and its
    // descendant are selected — reachable in three clicks, and the reason
    // gestures transform the outermost node only.
    await page.locator('[data-node-id="nest-1"]').click({
      modifiers: ['Shift'],
      position: { x: 4, y: 4 },
    });
    await expect(page.locator('#status')).toContainText('2 selected');

    const before = await leaf.boundingBox();
    await page.keyboard.down('Control');
    await drag(page, start, { x: start.x + 60, y: start.y });
    await page.keyboard.up('Control');
    const after = await leaf.boundingBox();

    // Once, not twice. Moving the group already moves the child.
    expect((after?.x ?? 0) - (before?.x ?? 0)).toBeCloseTo(60, 0);
  });
});

test.describe('the globals panel', () => {
  async function openTheme_(page: Page): Promise<void> {
    await openEditor(page);
    await page.locator('[data-vigilia-tab="theme"]').click();
    await expect(page.locator('[data-vigilia-globals="root"]')).toBeVisible();
  }

  test('lists every token with a use count', async ({ page }) => {
    await openTheme_(page);

    // Document-level, so it is populated with nothing selected — which is the
    // reason it is a tab rather than a section of the inspector.
    await expect(page.locator('#status')).toContainText('Nothing selected');

    await expect(page.locator('[data-vigilia-global="palette.panel"]')).toBeVisible();
    await expect(page.locator('[data-vigilia-global-uses="palette.panel"]')).toHaveText('5 uses');

    // Empty groups are shown too: seeing "Spacing — None yet" with an add
    // button is how an author discovers the group exists.
    await expect(page.locator('[data-vigilia-globals-group="spacing"]')).toContainText('None yet.');
  });

  test('changing a token repaints every element that references it', async ({ page }) => {
    await openTheme_(page);

    const value = page.locator('[data-vigilia-global-value="palette.panel"]');
    await value.fill('#ff0000');
    await value.blur();

    // Two nodes in different groups, both bound to the same token.
    await expect(page.locator('[data-node-id="cpu-panel-bg"]')).toHaveCSS(
      'background-color',
      'rgb(255, 0, 0)',
    );
    await expect(page.locator('[data-node-id="gpu-panel-bg"]')).toHaveCSS(
      'background-color',
      'rgb(255, 0, 0)',
    );

    await page.keyboard.press('Control+z');
    await expect(page.locator('[data-node-id="cpu-panel-bg"]')).not.toHaveCSS(
      'background-color',
      'rgb(255, 0, 0)',
    );
  });

  test('renaming the display name leaves references intact (§75)', async ({ page }) => {
    await openTheme_(page);

    const name = page.locator('[data-vigilia-global-name="palette.panel"]');
    await name.fill('Card surface');
    await name.blur();

    await expect(page.locator('#status')).toContainText('undo: Rename token');
    // The key is what a reference uses, so the count cannot change.
    await expect(page.locator('[data-vigilia-global-uses="palette.panel"]')).toHaveText('5 uses');
  });

  test('changing the key rewrites every reference', async ({ page }) => {
    await openTheme_(page);

    const key = page.locator('[data-vigilia-global-key="palette.panel"]');
    await key.fill('surface');
    await key.blur();

    await expect(page.locator('#status')).toContainText('undo: Change token key');
    // Same five references, now under the new key — not five broken ones.
    await expect(page.locator('[data-vigilia-global-uses="palette.surface"]')).toHaveText('5 uses');
    await expect(page.locator('[data-vigilia-global="palette.panel"]')).toHaveCount(0);

    // And the panel still renders: a dangling reference would show as a
    // missing global in the inspector instead.
    const box = page.locator('[data-node-id="cpu-panel-bg"]');
    await expect(box).toBeVisible();
  });

  test('an invalid key is refused without touching the document', async ({ page }) => {
    await openTheme_(page);

    const before = await page.locator('#status').textContent();
    const key = page.locator('[data-vigilia-global-key="palette.panel"]');
    await key.fill('not a key');
    await key.blur();

    // No undo entry, and the field snaps back to the real key rather than
    // leaving rejected input on screen.
    await expect(page.locator('#status')).toHaveText(before ?? '');
    await expect(page.locator('[data-vigilia-global-key="palette.panel"]')).toHaveValue('panel');
  });

  test('deleting a token inlines its value, so nothing changes visually', async ({ page }) => {
    await openTheme_(page);

    const box = page.locator('[data-node-id="cpu-panel-bg"]');
    const painted = await box.evaluate((element) => getComputedStyle(element).backgroundColor);

    await page.locator('[data-vigilia-global-delete="palette.panel"]').click();

    await expect(page.locator('[data-vigilia-global="palette.panel"]')).toHaveCount(0);
    // §75: "deletion requires reassignment or conversion to current literals".
    // This is the conversion, and the element is pixel-identical after it.
    await expect(box).toHaveCSS('background-color', painted);

    await page.keyboard.press('Control+z');
    await expect(page.locator('[data-vigilia-global="palette.panel"]')).toBeVisible();
  });

  test('adding a token gives it a free key, ready to rename', async ({ page }) => {
    await openTheme_(page);

    await page.locator('[data-vigilia-global-add="spacing"]').click();

    await expect(page.locator('[data-vigilia-global="spacing.token"]')).toBeVisible();
    await expect(page.locator('[data-vigilia-global-uses="spacing.token"]')).toHaveText('0 uses');
    await expect(page.locator('#status')).toContainText('undo: Add token');
  });

  test('switching tabs keeps both panels working', async ({ page }) => {
    await openTheme_(page);

    await page.locator('[data-vigilia-tab="element"]').click();
    await expect(page.locator('[data-vigilia-inspector="root"]')).toBeVisible();
    await expect(page.locator('[data-vigilia-globals="root"]')).toBeHidden();

    // A redraw guard that compared against the last rendered content would
    // leave the re-shown panel stale, so this asserts it comes back populated.
    await page.locator('[data-node-id="title"]').click();
    await expect(page.locator('[data-vigilia-input="name"]')).toBeVisible();

    await page.locator('[data-vigilia-tab="theme"]').click();
    await expect(page.locator('[data-vigilia-global="palette.panel"]')).toBeVisible();
  });
});

test.describe('grouping and alignment', () => {
  test('Ctrl+G groups the selection and selects the new group', async ({ page }) => {
    await openEditor(page);

    // Two top-level panels, so they share a parent.
    await page.locator('[data-node-id="cpu-panel"]').click({ position: { x: 4, y: 4 } });
    await page.locator('[data-node-id="gpu-panel"]').click({
      modifiers: ['Shift'],
      position: { x: 4, y: 4 },
    });
    await expect(page.locator('#status')).toContainText('2 selected');

    const before = await page.locator('[data-node-id="cpu-panel-bg"]').boundingBox();

    await page.keyboard.press('Control+g');

    await expect(page.locator('#status')).toContainText('undo: Group');
    // Grouping is structural, never visual: the contents must not move a pixel.
    expect(await page.locator('[data-node-id="cpu-panel-bg"]').boundingBox()).toEqual(before);

    await page.keyboard.press('Control+z');

    // Both panels are back at the document root. The selection is EMPTY, not
    // restored to the two panels: the group it held no longer exists, and
    // history stores documents rather than selections. Undo restoring the
    // previous selection is a real gap, recorded in spec 0008 — asserted here
    // so it is a decision rather than a surprise.
    await expect(page.locator('[data-node-id="cpu-panel"]')).toBeVisible();
    await expect(page.locator('[data-node-id="gpu-panel"]')).toBeVisible();
    await expect(page.locator('#status')).toContainText('Nothing selected');
  });

  test('Ctrl+Shift+G ungroups, leaving the children where they were', async ({ page }) => {
    await openEditor(page);
    await page.locator('[data-node-id="cpu-panel"]').click({ position: { x: 4, y: 4 } });

    const before = await page.locator('[data-node-id="cpu-gauge"]').boundingBox();

    await page.keyboard.press('Control+Shift+g');

    await expect(page.locator('#status')).toContainText('undo: Ungroup');
    await expect(page.locator('[data-node-id="cpu-panel"]')).toHaveCount(0);
    // The gauge's coordinates were group-relative and are now document-level.
    // Same pixels either way, which is the only thing an author can see.
    expect(await page.locator('[data-node-id="cpu-gauge"]').boundingBox()).toEqual(before);
  });

  test('grouping across two parents refuses, and says why', async ({ page }) => {
    await openEditor(page);

    await page.locator('[data-node-id="title"]').click();
    // Enter the CPU panel and add one of its children, so the selection spans
    // the document root and a group.
    await selectPanelBackground(page);
    await page.locator('[data-node-id="title"]').click({ modifiers: ['Shift'] });
    await expect(page.locator('#status')).toContainText('2 selected');

    await page.keyboard.press('Control+g');

    await expect(page.locator('#status')).toContainText('Select elements from one group at a time');
    // Refused means untouched: no undo entry, nothing renamed.
    await expect(page.locator('#status')).not.toContainText('undo: Group');
  });

  test('align left moves the selection to its own leftmost edge', async ({ page }) => {
    await openEditor(page);

    await page.locator('[data-node-id="cpu-panel"]').click({ position: { x: 4, y: 4 } });
    await page.locator('[data-node-id="gpu-panel"]').click({
      modifiers: ['Shift'],
      position: { x: 4, y: 4 },
    });

    const cpu = await page.locator('[data-node-id="cpu-panel"]').boundingBox();

    await page.locator('[data-vigilia-arrange="align-left"]').click();

    const gpu = await page.locator('[data-node-id="gpu-panel"]').boundingBox();

    // To the selection's own bounds, not the artboard's: the left-most member
    // does not move, and the other joins it.
    expect(await page.locator('[data-node-id="cpu-panel"]').boundingBox()).toEqual(cpu);
    expect(gpu?.x).toBeCloseTo(cpu?.x ?? 0, 0);
  });

  test('the toolbar says when a button is usable', async ({ page }) => {
    await openEditor(page);

    // Nothing selected: align needs two, distribute needs three.
    await expect(page.locator('[data-vigilia-arrange="align-left"]')).toBeDisabled();

    await page.locator('[data-node-id="cpu-panel"]').click({ position: { x: 4, y: 4 } });
    await expect(page.locator('[data-vigilia-arrange="align-left"]')).toBeDisabled();

    await page.locator('[data-node-id="gpu-panel"]').click({
      modifiers: ['Shift'],
      position: { x: 4, y: 4 },
    });
    await expect(page.locator('[data-vigilia-arrange="align-left"]')).toBeEnabled();
    await expect(page.locator('[data-vigilia-arrange="distribute-x"]')).toBeDisabled();

    await page.locator('[data-node-id="history-panel"]').click({
      modifiers: ['Shift'],
      position: { x: 4, y: 4 },
    });
    await expect(page.locator('[data-vigilia-arrange="distribute-x"]')).toBeEnabled();
  });

  test('distributing three panels equalises the gaps', async ({ page }) => {
    await openEditor(page);

    for (const [index, id] of ['cpu-panel', 'gpu-panel', 'history-panel'].entries()) {
      await page.locator(`[data-node-id="${id}"]`).click({
        ...(index === 0 ? {} : { modifiers: ['Shift' as const] }),
        position: { x: 4, y: 4 },
      });
    }

    await page.locator('[data-vigilia-arrange="distribute-x"]').click();

    const boxes = await Promise.all(
      ['cpu-panel', 'gpu-panel', 'history-panel'].map((id) =>
        page.locator(`[data-node-id="${id}"]`).boundingBox(),
      ),
    );

    const first = boxes[0]!;
    const second = boxes[1]!;
    const third = boxes[2]!;

    // Equal GAPS, which with unequal widths is not equal centre spacing.
    expect(second.x - (first.x + first.width)).toBeCloseTo(
      third.x - (second.x + second.width),
      0,
    );
  });
});

test.describe('open and save', () => {
  test('saving downloads the theme, and marks history clean without clearing it (§139)', async ({
    page,
  }) => {
    await openEditor(page);

    // Make an edit, so "clean" is something that had to be established rather
    // than the initial state.
    await page.locator('[data-node-id="title"]').click();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#status')).toContainText('unsaved');

    const download = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    const saved = await download;

    expect(saved.suggestedFilename()).toMatch(/\.json$/);
    await expect(page.locator('#status')).toContainText('saved');
    await expect(page.locator('#status')).not.toContainText('unsaved');

    // §139: the history is NOT cleared, so undo still reaches before the save.
    await expect(page.locator('#status')).toContainText('undo:');
    await page.keyboard.press('Control+z');
    // And undoing away from the saved document makes it dirty again.
    await expect(page.locator('#status')).toContainText('unsaved');
  });

  test('the saved file is a valid theme that round-trips', async ({ page }) => {
    await openEditor(page);

    const download = page.waitForEvent('download');
    await page.locator('[data-vigilia-file="save"]').click();
    const stream = await (await download).createReadStream();

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const text = Buffer.concat(chunks).toString('utf8');
    const parsed = JSON.parse(text) as { schemaVersion: number; nodes: unknown[] };

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.nodes.length).toBeGreaterThan(0);
    // Canonical output, ending in exactly one newline.
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  test('opening a file replaces the document and resets the history', async ({ page }) => {
    await openEditor(page);

    await page.locator('[data-node-id="title"]').click();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#status')).toContainText('undo:');

    await page.locator('[data-vigilia-open="input"]').setInputFiles({
      name: 'tiny.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          id: 'tiny',
          artboard: { width: 200, height: 100, background: { value: '#123456' } },
          nodes: [
            {
              id: 'only',
              type: 'rectangle',
              transform: { x: 10, y: 10, width: 50, height: 50 },
              style: { fill: { value: '#ff0000' } },
            },
          ],
        }),
      ),
    });

    await expect(page.locator('[data-node-id="only"]')).toBeVisible();
    // The old document is gone, scene and all.
    await expect(page.locator('[data-node-id="cpu-gauge"]')).toHaveCount(0);
    // An undo that crossed a file boundary would restore half of another theme,
    // so opening resets the history rather than appending to it.
    await expect(page.locator('#status')).not.toContainText('undo:');
    await expect(page.locator('#status')).toContainText('Opened tiny.json');
  });

  test('a file that is not a theme is refused, and the open document survives', async ({
    page,
  }) => {
    await openEditor(page);

    await page.locator('[data-vigilia-open="input"]').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"schemaVersion":1,"id":"x"}'),
    });

    await expect(page.locator('#status')).toContainText('Could not open');
    // Still the demo theme: §141's refusal must not half-apply.
    await expect(page.locator('[data-node-id="cpu-gauge"]')).toBeVisible();
  });

  test('a newer schema version is refused on the version alone (§141)', async ({ page }) => {
    await openEditor(page);

    await page.locator('[data-vigilia-open="input"]').setInputFiles({
      name: 'future.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"schemaVersion":99,"id":"x","artboard":{"width":1,"height":1},"nodes":[]}'),
    });

    // The message is about the version, not about the rest of the document —
    // anything else said about a format we do not understand is speculation.
    await expect(page.locator('#status')).toContainText('Could not open');
    await expect(page.locator('#status')).toContainText('version');
  });

  test('an edited theme survives a save and reopen unchanged', async ({ page }) => {
    await openEditor(page);

    // Recolour a global, which touches the part of the format most likely to
    // be dropped by a serialiser: the globals map.
    await page.locator('[data-vigilia-tab="theme"]').click();
    const value = page.locator('[data-vigilia-global-value="palette.panel"]');
    await value.fill('#010203');
    await value.blur();

    const download = page.waitForEvent('download');
    await page.locator('[data-vigilia-file="save"]').click();
    const stream = await (await download).createReadStream();

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    await page.locator('[data-vigilia-open="input"]').setInputFiles({
      name: 'roundtrip.json',
      mimeType: 'application/json',
      buffer: Buffer.concat(chunks),
    });

    await expect(page.locator('#status')).toContainText('Opened roundtrip.json');
    await expect(page.locator('[data-node-id="cpu-panel-bg"]')).toHaveCSS(
      'background-color',
      'rgb(1, 2, 3)',
    );
  });
});
