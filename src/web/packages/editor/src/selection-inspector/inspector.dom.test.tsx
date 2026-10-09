// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { createInspectorRoot } from "./inspector.js";
import type { SelectionEdits, SelectionView } from "./view.js";

/**
 * The React root and its store. The invariant this file can see is the one the
 * value walk cannot: what crosses the boundary into React is the serialized view
 * and the edit port, and a publish is what makes React re-render — nothing else.
 */

const edits: SelectionEdits = { commit: () => false };

function view(overrides: Partial<SelectionView> = {}): SelectionView {
  return {
    targetRevision: 1,
    subject: { name: "CPU card", kindLine: "Group · cpu.load" },
    locked: false,
    sections: [],
    ...overrides,
  };
}

describe("createInspectorRoot", () => {
  it("renders the subject the published view carries", () => {
    const host = document.createElement("div");
    const root = createInspectorRoot(host);

    root.publish(view(), edits);

    expect(host.textContent).toContain("CPU card");
    expect(host.textContent).toContain("Group · cpu.load");
    expect(host.querySelector("[data-vigilia-nothing-selected]")).toBeNull();
    root.destroy();
  });

  it("names where to choose from when the view has no subject", () => {
    const host = document.createElement("div");
    const root = createInspectorRoot(host);

    root.publish(view({ subject: undefined }), edits);

    expect(
      host.querySelector("[data-vigilia-nothing-selected]")?.textContent,
    ).toBe(uiCopy.inspectorFields.nothingSelected);
    root.destroy();
  });

  it("prints the locked note under the hook the browser suite reads it by", () => {
    const host = document.createElement("div");
    const root = createInspectorRoot(host);

    root.publish(view({ locked: true }), edits);

    // The hook is the locator contract (vg-148): the e2e spec finds the note by
    // `[data-vigilia-locked]`, so losing it would leave that spec passing on a
    // stale locator while the column stopped saying anything.
    expect(host.querySelector("[data-vigilia-locked]")?.textContent).toBe(
      uiCopy.inspectorFields.locked,
    );
    root.destroy();
  });

  it("has no locked note on an unlocked subject", () => {
    const host = document.createElement("div");
    const root = createInspectorRoot(host);

    root.publish(view(), edits);

    expect(host.querySelector("[data-vigilia-locked]")).toBeNull();
    root.destroy();
  });

  it("re-renders on the next publish, and only on a publish", () => {
    const host = document.createElement("div");
    const root = createInspectorRoot(host);
    root.publish(view(), edits);

    root.publish(
      view({
        targetRevision: 2,
        subject: { name: "Header", kindLine: "Shape" },
      }),
      edits,
    );

    expect(host.textContent).toContain("Header");
    expect(host.textContent).not.toContain("CPU card");
    root.destroy();
  });

  it("does not call the edit port from a render", () => {
    const commit = vi.fn(() => false);
    const host = document.createElement("div");
    const root = createInspectorRoot(host);

    root.publish(view(), { commit });

    // The port is a value the surface writes through; rendering it is not a
    // write, and a render that reached the funnel would save history per paint.
    expect(commit).not.toHaveBeenCalled();
    root.destroy();
  });

  it("unmounts its tree on destroy", () => {
    const host = document.createElement("div");
    const root = createInspectorRoot(host);
    root.publish(view(), edits);

    root.destroy();

    expect(host.textContent).toBe("");
  });
});
