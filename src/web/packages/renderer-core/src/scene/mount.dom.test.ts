// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { SampleStore } from "../data/store.js";
import type { TextContent, TextRun } from "../theme/document.js";
import type { Sample } from "../types.js";
import { mountScene } from "./mount.js";
import {
  type PlanNode,
  type PlanTextSegment,
  resolveTextSegments,
  type ScenePlan,
} from "./plan.js";

/**
 * The DOM applier's update path, which had no unit test at all.
 *
 * Everything else about `mount.ts` is covered by Playwright, and that is the
 * right place for it — this file exists for one question a browser test can
 * only answer by accident: does an update rewrite DOM that did not change?
 *
 * It is the question that matters, because `renderText` does not patch. It
 * clears the element and rebuilds every span, so an unguarded call throws away
 * and recreates the whole subtree of every text node once a second, for the
 * ~90% of them whose text is identical. That was the state of it: the box and
 * style writes above it were both guarded and this one was not.
 *
 * The visible symptom was a test flake rather than a rendering fault — a
 * Playwright handle resolved from one of those spans detaches mid-assertion,
 * and `getComputedStyle` on a detached element returns empty strings rather
 * than throwing, so the former DOM display suite failed intermittently
 * and inexplicably. A browser test cannot assert the absence of churn without
 * catching it in the act; identity comparison here can.
 *
 * The plan is built by hand because the applier's input is a `ScenePlan`, not a
 * document: the segments come from `resolveTextSegments`, which is still the one
 * owner of what a run reads, and the rest is the scaffolding this test is about.
 */

const NOW = Date.parse("2026-01-01T00:00:10Z");

const BINDINGS = [{ id: "load", semanticKey: "cpu.load.total" }];

/** One literal run and one bound run, so both halves of §89 are exercised. */
function authored(label: string): TextContent {
  const runs: readonly TextRun[] = [
    { kind: "literal", text: label, style: { color: { value: "#fff" } } },
    { kind: "value", bindingId: "load" },
  ];

  return { runs };
}

function segmentsOf(content: TextContent, value: number): PlanTextSegment[] {
  const store = new SampleStore();
  const sample: Sample = {
    sensorId: "cpu.load.total",
    timestamp: new Date(NOW).toISOString(),
    status: "ok",
    value,
    unit: "%",
  };

  store.ingest([["cpu.load.total", sample]], NOW);

  return resolveTextSegments(
    "readout",
    content.runs,
    BINDINGS,
    { source: store },
    {},
    [],
  );
}

function nodeOf(
  content: TextContent,
  segments: readonly PlanTextSegment[],
): PlanNode {
  return {
    id: "readout",
    box: {
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    visible: true,
    style: {},
    content: {
      kind: "text",
      authored: content,
      segments,
      layout: {
        wrap: false,
        overflow: "clip",
        align: "left",
        verticalAlign: "top",
      },
    },
    children: [],
  };
}

function planFor(label: string, value: number): ScenePlan {
  const content = authored(label);

  return {
    artboard: {
      width: 800,
      height: 480,
      contentFit: "contain",
      background: "#fff",
      barColor: "#000",
    },
    nodes: [nodeOf(content, segmentsOf(content, value))],
    issues: [],
  };
}

function spansOf(host: HTMLElement): Element[] {
  return [...host.querySelectorAll('[data-node-id="readout"] span')];
}

describe("updating a text node", () => {
  it("leaves the existing spans in place when nothing about the text changed", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const handle = mountScene({ host, plan: planFor("CPU ", 42) });
    const before = spansOf(host);

    // Two spans, one of them styled — so the comparison has a style map to get
    // wrong, which is how the identity bug in the node-level guard was found.
    expect(before).toHaveLength(2);
    expect(host.textContent).toContain("CPU ");

    // A second plan built from the same inputs: different objects throughout,
    // identical content. This is exactly what the player's 1 Hz tick produces
    // for a node whose reading has not moved, so identity of the plan says
    // nothing and the fields have to be compared.
    handle.update(planFor("CPU ", 42));

    const after = spansOf(host);

    // Element identity, not markup equality — a rebuild produces equal markup
    // and different objects, which is the whole failure being guarded.
    expect(after).toEqual(before);
    expect(after[0]).toBe(before[0]);

    handle.dispose();
    host.remove();
  });

  it("rebuilds them when the reading actually changes", () => {
    // The other half, and the one that makes the test above mean something: a
    // guard that never lets an update through would also pass it.
    const host = document.createElement("div");
    document.body.append(host);

    const handle = mountScene({ host, plan: planFor("CPU ", 42) });
    const before = spansOf(host);

    handle.update(planFor("CPU ", 91));

    const after = spansOf(host);

    expect(after[0]).not.toBe(before[0]);
    expect(host.textContent).toContain("91");

    handle.dispose();
    host.remove();
  });
});
