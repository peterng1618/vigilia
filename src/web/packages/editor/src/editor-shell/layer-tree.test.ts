// @vitest-environment jsdom
import { Group, Rect, Textbox } from "fabric/es";
import { describe, expect, it } from "vitest";
import { projectLayers } from "./layer-tree.js";

const base = { names: {}, collapsed: new Set<string>(), selected: [] } as const;

describe("layer projection", () => {
  it("lists top-most first, matching paint order reversed", () => {
    const bottom = new Rect({ id: "bottom", width: 10, height: 10 });
    const top = new Rect({ id: "top", width: 10, height: 10 });
    const rows = projectLayers({ ...base, root: [bottom, top] });
    expect(rows.map((row) => row.id)).toEqual(["top", "bottom"]);
  });

  it("indents group children and marks the group as having children", () => {
    const child = new Textbox("hi", { id: "child" });
    // Group's constructor is typed to Partial<GroupProps>, which carries no id.
    const group = new Group([child]);
    group.set("id", "group");
    const rows = projectLayers({ ...base, root: [group] });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "group",
      depth: 0,
      hasChildren: true,
      kind: "group",
    });
    expect(rows[1]).toMatchObject({
      id: "child",
      depth: 1,
      parentId: "group",
      kind: "text",
    });
  });

  it("hides the children of a collapsed group but keeps the group", () => {
    const group = new Group([new Rect({ id: "child", width: 10, height: 10 })]);
    group.set("id", "group");
    const rows = projectLayers({
      ...base,
      root: [group],
      collapsed: new Set(["group"]),
    });
    expect(rows.map((row) => row.id)).toEqual(["group"]);
  });

  it("takes visibility and lock from the whole ancestor path", () => {
    const group = new Group(
      [new Rect({ id: "child", width: 10, height: 10 })],
      {
        visible: false,
      },
    );
    group.set("id", "group");
    const rows = projectLayers({ ...base, root: [group] });
    expect(rows[1]).toMatchObject({
      id: "child",
      visible: false,
      locked: false,
    });
  });

  it("marks the row whose object is selected, resolving a child through its group", () => {
    const group = new Group([new Rect({ id: "child", width: 10, height: 10 })]);
    group.set("id", "group");
    const rows = projectLayers({ ...base, root: [group], selected: [group] });
    expect(rows.find((row) => row.id === "group")?.selected).toBe(true);
    expect(rows.find((row) => row.id === "child")?.selected).toBe(false);
  });

  it("prefers a stored display name over the id", () => {
    const rect = new Rect({ id: "header", width: 10, height: 10 });
    const rows = projectLayers({
      ...base,
      root: [rect],
      names: { header: "Header rule" },
    });
    expect(rows[0]?.name).toBe("Header rule");
  });

  it("does not crash on an object with no id", () => {
    const rows = projectLayers({
      ...base,
      root: [new Rect({ width: 10, height: 10 })],
    });
    expect(rows[0]?.id).toBe("unidentified");
    expect(rows[0]?.name).toBe("unidentified");
  });

  it("gives each id-less object its own row id", () => {
    const rows = projectLayers({
      ...base,
      root: [
        new Rect({ width: 10, height: 10 }),
        new Rect({ width: 10, height: 10 }),
      ],
    });
    expect(rows.map((row) => row.id)).toEqual([
      "unidentified",
      "unidentified#2",
    ]);
    expect(rows[0]?.name).toBe("unidentified");
  });

  it("falls back to the kind when neither the stored name nor the id is usable", () => {
    // Whitespace counts as unusable: a blank row tells the author nothing.
    const rect = new Rect({ id: "   ", width: 10, height: 10 });
    const rows = projectLayers({
      ...base,
      root: [rect],
      names: { "   ": "  " },
    });
    expect(rows[0]?.name).toBe("Shape");
  });

  it("keeps the id when only the stored name is blank", () => {
    const rect = new Rect({ id: "header", width: 10, height: 10 });
    const rows = projectLayers({
      ...base,
      root: [rect],
      names: { header: "   " },
    });
    expect(rows[0]?.name).toBe("header");
  });
});
