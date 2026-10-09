// @vitest-environment jsdom
import type { FabricGlobals, TextRun } from "@vigilia/renderer-core";
import { act } from "react";
import { describe, expect, it } from "vitest";
import {
  blur,
  clickHook,
  mountRunEditor,
  press,
  typeInto,
} from "./runs.test-stage.js";

/**
 * The run-editor cases that need the editor's *own* state, rather than what a
 * control writes.
 *
 * All four are about the same mechanism, which is why they are one file:
 * React's row identity is what keeps a draft and the caret alive across a
 * commit, a re-publish and a removal, and what discards the draft when the
 * described object changes. The case for a selection that moves under a draft
 * lives with the column in `index.dom.test.ts`, because that is where a
 * selection can move.
 */

const globals = {
  typePresets: {
    plain: { name: "Plain", value: { family: "Inter", size: 16 } },
    caption: { name: "Caption", value: { family: "Inter", size: 12 } },
    title: { name: "Title", value: { family: "Inter", size: 24 } },
  },
  palette: {
    text: { name: "Text", value: { kind: "solid", color: "#fff" } },
  },
} as unknown as FabricGlobals;

const twoRuns: readonly TextRun[] = [
  { kind: "literal", text: "CPU ", typePreset: "typePresets.plain" },
  { kind: "literal", text: "%", typePreset: "typePresets.plain" },
];

describe("the run editor's own state", () => {
  it("keeps the caret in the field being typed into across a re-publish", async () => {
    const box = mountRunEditor({ runs: twoRuns, globals });
    const field = box.pick<HTMLInputElement>('[data-vigilia-run-text="0"]');
    field.focus();
    expect(document.activeElement).toBe(field);

    await typeInto(field, "GPU ");
    await act(async () => {
      // The re-publish an unrelated edit or a selection re-read causes.
      box.render();
    });

    // The row is the same element, so the caret was never lost and the
    // half-typed draft was not replaced by the published value.
    const after = box.pick<HTMLInputElement>('[data-vigilia-run-text="0"]');
    expect(after).toBe(field);
    expect(document.activeElement).toBe(after);
    expect(after.value).toBe("GPU ");

    await blur(after);
    expect(box.runs()[0]).toMatchObject({ kind: "literal", text: "GPU " });
    return box.dispose();
  });

  it("keeps the caret when Enter commits a literal's text", async () => {
    const box = mountRunEditor({ runs: twoRuns, globals });
    const field = box.pick<HTMLInputElement>('[data-vigilia-run-text="0"]');
    field.focus();

    await typeInto(field, "GPU ");
    // Enter, not blur: it is the primary commit gesture, and it commits while
    // the field still holds focus. A row key carrying the run's text would
    // remount the input here and drop focus to the document body — the caret
    // rule in `index.ts` cannot recover it, because the row's identity is the
    // very thing that changed.
    await press(field, "Enter");

    expect(box.runs()[0]).toMatchObject({ kind: "literal", text: "GPU " });
    expect(document.activeElement).toBe(field);
    expect(field.isConnected).toBe(true);
    expect(field.value).toBe("GPU ");
    return box.dispose();
  });

  it("adds and removes a run without the editor losing its own state", async () => {
    const box = mountRunEditor({ runs: twoRuns, globals });
    const field = box.pick<HTMLInputElement>('[data-vigilia-run-text="0"]');
    await typeInto(field, "GPU ");

    // Adding a run re-publishes: the draft in a row that did not change has to
    // survive it, or the author loses what they were typing to somebody else's
    // click.
    await clickHook(box.host, "data-vigilia-run-add");
    expect(box.runs()).toHaveLength(3);
    expect(field.value).toBe("GPU ");

    // ...and removing one does too, which is the harder half: the row list
    // shrinks under the draft.
    await clickHook(box.host, 'data-vigilia-run-remove="2"');
    expect(box.runs()).toHaveLength(2);
    expect(field.value).toBe("GPU ");

    await blur(field);
    expect(box.runs()[0]).toMatchObject({ kind: "literal", text: "GPU " });
    expect(box.runs()[1]).toMatchObject({ kind: "literal", text: "%" });
    return box.dispose();
  });

  it("keeps a draft on its own run when an earlier one is removed", async () => {
    // The three runs carry distinct presets on purpose. The row identity is the
    // run's preset (and never its text, so an Enter cannot remount the row
    // under the caret), which means this case is covered for runs the identity
    // tells apart. Two literals sharing a preset are the residual `projectRuns`
    // names: their keys are positional among themselves and can still shift.
    const box = mountRunEditor({
      runs: [
        { kind: "literal", text: "A", typePreset: "typePresets.plain" },
        { kind: "literal", text: "B", typePreset: "typePresets.caption" },
        { kind: "literal", text: "C", typePreset: "typePresets.title" },
      ],
      globals,
    });
    const field = box.pick<HTMLInputElement>('[data-vigilia-run-text="1"]');
    await typeInto(field, "GPU ");

    // Removing a run that is not the last renumbers every row after it. Keyed
    // by index, this draft would stay in its element and be re-pointed at C,
    // while C's own row showed B's text: hence both halves of the assertion,
    // the draft that followed its run and the row that moved up.
    await clickHook(box.host, 'data-vigilia-run-remove="0"');
    expect(box.runs()).toHaveLength(2);
    expect(
      box.pick<HTMLInputElement>('[data-vigilia-run-text="0"]').value,
    ).toBe("GPU ");
    expect(
      box.pick<HTMLInputElement>('[data-vigilia-run-text="1"]').value,
    ).toBe("C");

    await blur(field);
    expect(box.runs()[0]).toMatchObject({ kind: "literal", text: "GPU " });
    expect(box.runs()[1]).toMatchObject({ kind: "literal", text: "C" });
    return box.dispose();
  });
});
