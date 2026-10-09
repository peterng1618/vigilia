// @vitest-environment jsdom
import type { FabricGlobals } from "@vigilia/renderer-core";
import { Rect } from "fabric/es";
import { describe, expect, it } from "vitest";
import { projectLayers } from "../editor-shell/layer-tree.js";
import { uiCopy } from "../ui-copy.js";
import {
  editRefusal,
  measuredEdgeOf,
  type ProjectionPorts,
  projectSelection,
  readField,
} from "./view.js";

/**
 * The projection is a value: the whole of [ADR-0039] is that React holds this
 * and never a Fabric object. A JSON round-trip is one check and not the guard —
 * it cannot tell a Fabric object from a plain one that happens to serialise — so
 * the walk below rejects by prototype, and rejects a function, a DOM node and a
 * non-finite number where it finds them.
 */

const globals = {
  palette: {
    ink: { name: "Ink", value: { kind: "solid", color: "#e8ecf3" } },
  },
  typePresets: {
    body: { name: "Body", value: { family: "Inter", size: 16, weight: "600" } },
  },
} as unknown as FabricGlobals;

/** The read context the column already takes, with the real read halves of the
    geometry port rather than a stand-in. */
function ports(overrides: Partial<ProjectionPorts> = {}): ProjectionPorts {
  return {
    globals,
    locale: undefined,
    nodeBindings: undefined,
    sampleSource: undefined,
    geometry: { read: readField, measuredEdge: measuredEdgeOf },
    ...overrides,
  };
}

/** Every leaf is a primitive, an array or a plain object — nothing else. */
function assertPlainValue(value: unknown, path: string): void {
  if (value === undefined || value === null) return;
  const kind = typeof value;
  if (kind === "string" || kind === "boolean") return;
  if (kind === "number") {
    expect(Number.isFinite(value), `${path} is a finite number`).toBe(true);
    return;
  }
  expect(kind, `${path} is not a ${kind}`).not.toBe("function");
  expect(value, `${path} is not a DOM node`).not.toBeInstanceOf(Node);
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertPlainValue(entry, `${path}[${index}]`),
    );
    return;
  }
  const prototype = Object.getPrototypeOf(value) as object | null;
  // A Fabric object is the failure this catches: its prototype is its class.
  expect(
    prototype === Object.prototype,
    `${path} is a plain object (saw ${prototype?.constructor?.name ?? "null"})`,
  ).toBe(true);
  for (const [key, child] of Object.entries(value)) {
    assertPlainValue(child, `${path}.${key}`);
  }
}

/** A shape carrying an authored name — the first arm of the name chain. */
function namedRect(name: string): Rect {
  const rect = new Rect({ id: "shape", width: 10, height: 10 });
  rect.set("name", name);
  return rect;
}

describe("projectSelection", () => {
  it("carries no Fabric object, DOM node, function or non-finite number", () => {
    const rect = new Rect({
      id: "shape",
      left: 0,
      top: 0,
      width: 40,
      height: 20,
    });
    const view = projectSelection(rect, 1, ports());

    assertPlainValue(view, "view");
    // Round-tripped without an undefined-valued key to drop, so the two agree
    // field for field — a function or a node would not have survived.
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it("is empty when nothing is selected", () => {
    const view = projectSelection(undefined, 0, ports());

    expect(view.subject).toBeUndefined();
    expect(view.sections).toHaveLength(0);
    expect(view.locked).toBe(false);
    expect(view.targetRevision).toBe(0);
    // Undefined is valid state but JSON omits it; the round-trip must not gain a
    // `subject` key, and raw equality is not the proof for that reason.
    expect("subject" in JSON.parse(JSON.stringify(view))).toBe(false);
  });

  it("names the subject exactly as the layer row names the same object", () => {
    // The agreement is the test, not a copy of the rule: whatever the tree
    // prints for an object's own row is what the column must print for it, so a
    // second copy of the fallback chain cannot drift back in. Every arm the
    // chain has is covered, the blank-id one included — the case the two copies
    // disagreed about before they shared an owner.
    const cases: readonly [string, Rect][] = [
      ["Header panel", namedRect("Header panel")],
      ["cpu-card", new Rect({ id: "cpu-card", width: 10, height: 10 })],
      [
        uiCopy.panels.layerKinds.shape,
        new Rect({ id: "   ", width: 10, height: 10 }),
      ],
      ["unidentified", new Rect({ width: 10, height: 10 })],
    ];
    for (const [expected, object] of cases) {
      const row = projectLayers({
        root: [object],
        selected: [],
        expanded: new Set(),
      })[0];
      expect(row?.name, `layer row names ${expected}`).toBe(expected);
      expect(projectSelection(object, 1, ports()).subject?.name).toBe(
        row?.name,
      );
    }
  });

  it("names the kind, and the key a binding carries", () => {
    const rect = new Rect({ id: "shape", width: 10, height: 10 });
    const kindLine = projectSelection(rect, 1, ports()).subject?.kindLine;
    expect(kindLine).toBe(uiCopy.inspectorFields.subjectKind("Shape"));

    const bound = projectSelection(
      rect,
      1,
      ports({
        nodeBindings: () => [{ id: "b1", semanticKey: "cpu.load" }],
      }),
    ).subject?.kindLine;
    expect(bound).toBe(uiCopy.inspectorFields.subjectKind("Shape", "cpu.load"));
  });

  it("reports the lock on the subject", () => {
    const rect = new Rect({ id: "shape", width: 10, height: 10 });
    rect.set("locked", true);

    expect(projectSelection(rect, 3, ports()).locked).toBe(true);
    expect(projectSelection(rect, 3, ports()).targetRevision).toBe(3);
  });
});

/**
 * The guard in front of the write funnel. It is a pure decision so it can be
 * driven without a React control: the dispatcher consults the same function at
 * call time, and a control that outlived its selection is refused here rather
 * than writing through a funnel that would resolve the *current* target.
 */
describe("editRefusal", () => {
  const live = { targetRevision: 4, locked: false };
  const edit = (
    overrides: Partial<{
      expectedRevision: number;
      fieldId: string;
      value: string | number | boolean;
    }> = {},
  ) => ({ expectedRevision: 4, fieldId: "left", value: 5, ...overrides });

  it("lets a current, writable, finite edit through", () => {
    expect(editRefusal(edit(), live)).toBeUndefined();
  });

  it("refuses an edit projected from another revision", () => {
    // The failure this exists for: a field's draft outlives its selection, so
    // its revision no longer matches the live target's.
    expect(editRefusal(edit({ expectedRevision: 3 }), live)).toBe("stale");
  });

  it("refuses a write to a locked object", () => {
    expect(editRefusal(edit(), { ...live, locked: true })).toBe("locked");
  });

  it("refuses a field the dispatcher cannot write", () => {
    expect(editRefusal(edit({ fieldId: "name" }), live)).toBe("unknown");
  });

  it("refuses a value that is not a finite number rather than coercing it", () => {
    expect(editRefusal(edit({ value: Number.NaN }), live)).toBe("invalid");
    expect(editRefusal(edit({ value: "12" }), live)).toBe("invalid");
  });

  it("reports a stale draft ahead of the lock it would also fail", () => {
    // Precedence is part of the contract: the newer selection is the reason the
    // draft is wrong, so that is what a caller is told.
    expect(
      editRefusal(edit({ expectedRevision: 3 }), { ...live, locked: true }),
    ).toBe("stale");
  });
});
