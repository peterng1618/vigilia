import { describe, expect, it } from "vitest";
import {
  MISSING_VALUE_TEXT,
  buildScenePlan,
  requiredSemanticKeys,
  validateThemeDocument,
  walkNodes,
} from "@vigilia/renderer-core";
import { createDemoSource, demoThemeSource, loadDemoTheme } from "./demo.js";

const T0 = Date.parse("2026-01-01T00:00:00Z");

describe("the demo theme fixture", () => {
  it("validates", () => {
    // Checked in, so an invalid fixture is a repository bug. This is also the
    // only place the validator meets a realistic document rather than a
    // purpose-built test case.
    const result = validateThemeDocument(demoThemeSource);

    if (!result.ok) {
      throw new Error(
        `Invalid fixture:\n${result.issues.map((i) => `${i.path}: ${i.message}`).join("\n")}`,
      );
    }

    expect(result.ok).toBe(true);
  });

  it("exercises all four chart families", () => {
    // The point of the fixture. If a family drops out of it, that family stops
    // being visually checked by anything.
    const document = loadDemoTheme();
    const families = new Set<string>();

    for (const { node } of walkNodes(document.nodes)) {
      if (node.type === "chart") {
        families.add(node.content.family);
      }
    }

    expect([...families].sort()).toEqual(["bar", "gauge", "line", "pie"]);
  });

  it("declares the semantic keys the host would have to supply", () => {
    expect(requiredSemanticKeys(loadDemoTheme())).toEqual([
      "cpu.load",
      "cpu.power",
      "cpu.temp",
      "disk.nvme.queue-depth",
      "gpu.clock",
      "gpu.load",
      "gpu.temp",
      "ram.used",
    ]);
  });

  it("includes a styled-run text element mixing a literal with a live value", () => {
    const document = loadDemoTheme();
    const readout = [...walkNodes(document.nodes)].find(
      ({ node }) => node.id === "cpu-readout",
    );

    expect(readout?.node.type).toBe("text");
    if (readout?.node.type === "text") {
      expect(readout.node.content.runs.map((run) => run.kind)).toEqual([
        "value",
        "literal",
      ]);
    }
  });
});

describe("the demo fixture rendered", () => {
  function planAt(nowMs: number) {
    return buildScenePlan({
      document: loadDemoTheme(),
      source: createDemoSource(nowMs),
      nowMs,
      animate: false,
    });
  }

  it("produces a plan for every node", () => {
    const plan = planAt(T0);
    // 6 top-level nodes; the panels are groups, so the tree is deeper.
    expect(plan.nodes).toHaveLength(6);
    expect([...plan.nodes].every((node) => node.id.length > 0)).toBe(true);
  });

  it("resolves every global reference the fixture uses", () => {
    // An unresolved global would silently drop a colour, which is exactly the
    // failure the plan reports rather than guessing around.
    const plan = planAt(T0);
    expect(
      plan.issues.filter((issue) => issue.code === "unresolved-global"),
    ).toEqual([]);
  });

  it("reports exactly the one deliberately unmapped key", () => {
    const plan = planAt(T0);
    const unmapped = plan.issues.filter(
      (issue) => issue.code === "unmapped-key",
    );

    expect(unmapped).toHaveLength(1);
    expect(unmapped[0]!.detail).toContain("disk.nvme.queue-depth");
  });

  it("renders the unmapped value as a placeholder, never a zero", () => {
    const plan = planAt(T0);
    const node = [...plan.nodes]
      .flatMap((n) => [n, ...n.children])
      .find((n) => n.id === "memory-unmapped");

    expect(node?.content.kind).toBe("text");
    if (node?.content.kind === "text") {
      expect(node.content.segments.at(-1)?.text).toBe(MISSING_VALUE_TEXT);
    }
  });

  it("shows a real value for a mapped key at the same instant", () => {
    const plan = planAt(T0);
    const node = [...plan.nodes]
      .flatMap((n) => [n, ...n.children])
      .find((n) => n.id === "cpu-readout");

    if (node?.content.kind === "text") {
      expect(node.content.segments[0]?.text).toMatch(/^\d+$/);
    }
  });

  it("is deterministic at a fixed instant, so a screenshot test can pin it", () => {
    const a = planAt(T0 + 5000);
    const b = planAt(T0 + 5000);

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produces a gap rather than a zero during the simulated outage", () => {
    // Scan a full outage cycle for a frame where the GPU temperature is absent,
    // then check nothing substituted a number for it.
    let sawPlaceholder = false;

    for (let second = 0; second < 24; second++) {
      const plan = planAt(T0 + second * 1000);
      const node = [...plan.nodes]
        .flatMap((n) => [n, ...n.children])
        .find((n) => n.id === "thermals-gpu-label");

      if (node?.content.kind === "text") {
        const valueSegment = node.content.segments[1];
        if (valueSegment?.text === MISSING_VALUE_TEXT) {
          sawPlaceholder = true;
          expect(valueSegment.status).toBe("error");
        }
      }
    }

    expect(sawPlaceholder).toBe(true);
  });
});
