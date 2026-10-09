// @vitest-environment jsdom
import type { FabricGlobals } from "@vigilia/renderer-core";
import { Rect } from "fabric/es";
import { describe, expect, it } from "vitest";
import { uiCopy } from "../ui-copy.js";
import {
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

  it("names the subject as the layer list does, falling back to the id", () => {
    const named = new Rect({ id: "shape", width: 10, height: 10 });
    named.set("name", "Header panel");
    expect(projectSelection(named, 1, ports()).subject?.name).toBe(
      "Header panel",
    );

    const unnamed = new Rect({ id: "cpu-card", width: 10, height: 10 });
    expect(projectSelection(unnamed, 1, ports()).subject?.name).toBe(
      "cpu-card",
    );
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
