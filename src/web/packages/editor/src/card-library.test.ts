// @vitest-environment jsdom

import type { Binding, FabricGlobals } from "@vigilia/renderer-core";
import { validateFabricThemeEnvelope } from "@vigilia/renderer-core";
import { reviveScene, serialiseScene } from "@vigilia/scene-fabric";
import { Canvas, Group, type FabricObject, util } from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CARD_LIBRARY,
  type CardUnit,
  insertCard,
  instantiateCard,
} from "./card-library.js";
import { cpuCard } from "./new-fabric-theme-cards.js";
import { createNewFabricTheme } from "./new-fabric-theme.js";
import type { ObjectJson } from "./new-fabric-theme-objects.js";
import { uiCopy } from "./ui-copy.js";

// jsdom cannot drawImage an undecoded img, and a card carries a frosted panel,
// a gauge and a sparkline. Same proxy `starter-round-trip.dom.test.ts` installs.
beforeEach(() => {
  const real = document.createElement("canvas").getContext("2d");
  if (real === null) return;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      new Proxy(real, {
        get(target, property) {
          if (property === "drawImage") return (): void => {};
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
        set(target, property, value) {
          if (property === "patternQuality") return true;
          return Reflect.set(target, property, value);
        },
      }) as unknown as CanvasRenderingContext2D,
  );
});

const CPU_CARD = "group-cpu-card";
/** The frosted panel and the six parts printed on it; stated so a card that
 *  gained or lost a part fails here rather than quietly re-basing the rest. */
const CPU_PARTS = 7;

/** The starter's own globals, so a card's every reference resolves. */
const STARTER_GLOBALS = createNewFabricTheme().globals as FabricGlobals;

function unit(cardId: string) {
  const found = CARD_LIBRARY.find((candidate) => candidate.id === cardId);
  if (found === undefined) throw new Error(`no ${cardId} unit`);
  return found;
}

/** A card's parts, as the plain records the factories authored them as. */
function partsOf(card: ObjectJson): readonly ObjectJson[] {
  const children = card["objects"];
  return Array.isArray(children) ? children.filter(isRecord) : [];
}

function isRecord(value: unknown): value is ObjectJson {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stage(): Canvas {
  const element = document.createElement("canvas");
  element.width = 1672;
  element.height = 941;
  document.body.append(element);
  return new Canvas(element);
}

/** Fabric's own revival, so the serialised scene is the one a save would write. */
async function enliven(card: ObjectJson): Promise<Canvas> {
  const canvas = stage();
  const [object] = await util.enlivenObjects<FabricObject>([card]);
  if (object === undefined) throw new Error("the card could not be revived");
  canvas.add(object);
  return canvas;
}

/** The surface an insertion writes through: the canvas, the history and the
 *  diagnostics, exactly as the editor's own managers use them. */
function editorStub(canvas: Canvas) {
  return {
    canvas,
    artboard: () => ({ width: 1672, height: 941 }),
    historyManager: { saveState: vi.fn() },
    errorManager: { warn: vi.fn(), error: vi.fn() },
  };
}

/** One session's envelope, as the bindings written into it accumulate. */
class Envelope {
  readonly bindings: Record<string, readonly Binding[]> = {};

  readonly write = (
    additions: Readonly<Record<string, readonly Binding[]>>,
  ): void => {
    Object.assign(this.bindings, additions);
  };
}

/** Inserts into `envelope` the way the session does: the readings already
 *  carried go in to be read, the new ones come back out. */
async function insert(
  canvas: Canvas,
  envelope: Envelope,
  cardId = CPU_CARD,
  globals: FabricGlobals | undefined = STARTER_GLOBALS,
): Promise<void> {
  await insertCard(editorStub(canvas) as never, cardId, {
    globals,
    bindings: envelope.bindings,
    onBindings: envelope.write,
  });
}

/** The readings one copy carries, read off its own parts on the canvas. */
function readingsOf(
  envelope: Envelope,
  card: FabricObject,
): readonly Binding[] {
  if (!(card instanceof Group)) throw new Error("a copy is a group");
  return card
    .getObjects()
    .flatMap((child) => envelope.bindings[String(child.get("id"))] ?? []);
}

function copy(canvas: Canvas): FabricObject {
  const object = canvas
    .getObjects()
    .find((candidate) => candidate.get("provenance") !== undefined);
  if (object === undefined) throw new Error("nothing was inserted");
  return object;
}

function copies(canvas: Canvas): FabricObject[] {
  return canvas.getObjects().filter((object) => object instanceof Group);
}

describe("the card library", () => {
  it("offers one unit per card the starter itself draws", () => {
    const groups = createNewFabricTheme().scene["objects"] as readonly {
      type: string;
      id: string;
    }[];

    expect(CARD_LIBRARY.map((entry) => entry.id)).toEqual([
      "group-time-card",
      "group-cpu-card",
      "group-gpu-card",
      "group-ram-card",
      "group-vram-card",
      "group-trends-card",
      "group-storage-card",
      "group-network-card",
    ]);
    for (const entry of CARD_LIBRARY) {
      expect(
        groups.some(
          (object) => object.type === "Group" && object.id === entry.id,
        ),
        `${entry.id} is a card in the starter`,
      ).toBe(true);
    }
  });

  // THE property. A copy that reused an id would be a twin the second save
  // refuses; a copy that minted a semantic key would be bound to a sensor
  // nobody publishes, and would arrive showing nothing (§93).
  it("inserts one card twice as two objects with different ids and the same semantic keys", async () => {
    const canvas = stage();
    const envelope = new Envelope();

    await insert(canvas, envelope);
    await insert(canvas, envelope);

    const [first, second] = copies(canvas);
    expect(copies(canvas)).toHaveLength(2);
    expect(first?.get("id")).toBe(`card-${CPU_CARD}`);
    expect(second?.get("id")).toBe(`card-${CPU_CARD}-2`);

    const firstReadings = readingsOf(envelope, first as FabricObject);
    const secondReadings = readingsOf(envelope, second as FabricObject);
    // The CPU card's own four, read off its parts: load, model name, the
    // sparkline's own load series and the clock.
    expect(firstReadings.map((b) => b.semanticKey).sort()).toEqual([
      "cpu.brand",
      "cpu.clock",
      "cpu.load",
      "cpu.load",
    ]);
    // Same readings, in the same order: this is the CPU card again.
    expect(secondReadings.map((b) => b.semanticKey)).toEqual(
      firstReadings.map((b) => b.semanticKey),
    );
    // And a fresh binding identity for each. A binding id is unique across the
    // document — the validator refuses one used twice — and it is not an object
    // id, so a copy that watched only the canvas would mint the second copy's
    // `cpu.load` onto the first copy's id and leave a document that cannot be
    // saved, reported nowhere.
    expect(secondReadings.map((b) => b.id)).not.toEqual(
      firstReadings.map((b) => b.id),
    );
    expect(secondReadings.map((b) => b.id)).toContain("card-cpu-card-load-2");
    expect(
      new Set(
        Object.values(envelope.bindings).flatMap((list) =>
          list.map((binding) => binding.id),
        ),
      ).size,
    ).toBe(Object.values(envelope.bindings).flatMap((list) => list).length);
  });

  it("keeps the whole card, and joins the scene at the top level", async () => {
    const canvas = stage();
    await insertCard(editorStub(canvas) as never, CPU_CARD, {
      globals: STARTER_GLOBALS,
      onBindings: vi.fn(),
    });

    const card = copy(canvas);
    expect(card).toBeInstanceOf(Group);
    expect((card as Group).getObjects()).toHaveLength(CPU_PARTS);
    expect(canvas.getObjects()).toEqual([card]);
  });

  it("points each run at the binding the copy actually carries", async () => {
    const canvas = stage();
    const envelope = new Envelope();
    await insert(canvas, envelope);

    let pointed = 0;
    for (const part of (copy(canvas) as Group).getObjects()) {
      const authored = part.get("vigiliaText") as
        | { runs: readonly { kind: string; bindingId?: string }[] }
        | undefined;
      if (authored === undefined) continue;
      const carried = envelope.bindings[String(part.get("id"))] ?? [];
      for (const run of authored.runs) {
        if (run.kind !== "value") continue;
        // THE defect a copy invites: rename the binding, forget the run, and
        // the run paints a placeholder for a sensor sitting right there.
        expect(carried.map((binding) => binding.id)).toContain(run.bindingId);
        pointed += 1;
      }
    }
    expect(pointed).toBeGreaterThan(0);
  });

  it("moves the root only, leaving a part's group-local coordinates alone", () => {
    const built = unit(CPU_CARD).build();
    const copied = instantiateCard({
      unit: unit(CPU_CARD),
      globals: STARTER_GLOBALS,
      existingIds: [],
      origin: { left: 1000, top: 500 },
    }).card;

    expect(copied["left"]).toBe(1000);
    expect(copied["top"]).toBe(500);

    const parts = partsOf(copied);
    const authored = partsOf(built);
    expect(parts).toHaveLength(authored.length);
    // §57: a child's coordinates are group-local, so offsetting them too would
    // shift every descendant twice.
    for (const [index, part] of parts.entries()) {
      expect(part["left"]).toBe(authored[index]?.["left"]);
      expect(part["top"]).toBe(authored[index]?.["top"]);
    }
  });

  it("records which unit the copy came from, on the root alone", () => {
    const copied = instantiateCard({
      unit: unit(CPU_CARD),
      globals: STARTER_GLOBALS,
      existingIds: [],
      origin: { left: 0, top: 0 },
    }).card;

    expect(copied["provenance"]).toEqual({
      widgetId: CPU_CARD,
      widgetName: uiCopy.cardLibrary.cpu,
    });
    expect(copied["name"]).toBe(uiCopy.cardLibrary.cpu);

    // Stamping every descendant would triple a deep card's size to say the
    // same thing.
    for (const part of partsOf(copied)) {
      expect(part["provenance"]).toBeUndefined();
    }
  });

  // Review Focus 5: where a copy came from is a fact, not a naming convention.
  it("keeps that fact across a save and reopen", async () => {
    const canvas = stage();
    await insertCard(editorStub(canvas) as never, CPU_CARD, {
      globals: STARTER_GLOBALS,
      onBindings: vi.fn(),
    });

    const scene = serialiseScene(canvas);
    const reopened = stage();
    await reviveScene(reopened, scene);

    expect(copy(reopened).get("provenance")).toEqual({
      widgetId: CPU_CARD,
      widgetName: uiCopy.cardLibrary.cpu,
    });
  });

  it("names both copies after the unit, so two CPU cards read as two", async () => {
    const canvas = stage();
    for (let n = 0; n < 2; n += 1) {
      await insertCard(editorStub(canvas) as never, CPU_CARD, {
        globals: STARTER_GLOBALS,
        onBindings: vi.fn(),
      });
    }

    expect(canvas.getObjects().map((object) => object.get("name"))).toEqual([
      uiCopy.cardLibrary.cpu,
      uiCopy.cardLibrary.cpu,
    ]);
  });

  it("mints past an id the document already holds rather than shadowing it", async () => {
    const canvas = stage();
    // The document already carries the authored card, so every copied id has
    // something to be distinct from.
    const held = new Group([]);
    held.set("id", `card-${CPU_CARD}`);
    canvas.add(held);

    await insertCard(editorStub(canvas) as never, CPU_CARD, {
      globals: STARTER_GLOBALS,
      onBindings: vi.fn(),
    });

    expect(copy(canvas).get("id")).toBe(`card-${CPU_CARD}-2`);
  });
});

describe("a global this theme cannot supply", () => {
  // §77 makes explicit global mapping the author's decision. Silently inlining
  // would quietly divorce the copy from the theme's tokens; silently dropping
  // would paint it wrong; either would be invisible until someone re-saves.
  it("reports the reference instead of inlining or dropping it", () => {
    const copied = instantiateCard({
      unit: unit(CPU_CARD),
      globals: undefined,
      existingIds: [],
      origin: { left: 0, top: 0 },
    });

    expect(new Set(copied.issues.map((issue) => issue.code))).toEqual(
      new Set(["unmapped-global"]),
    );
    const panel = partsOf(copied.card)[0];
    expect(panel?.["vigiliaPaint"]).toEqual({
      fill: "palette.frost",
      stroke: "palette.panelStroke",
    });
  });

  it("says which token, so the author can act on it", () => {
    const copied = instantiateCard({
      unit: unit(CPU_CARD),
      globals: undefined,
      existingIds: [],
      origin: { left: 0, top: 0 },
    });

    expect(copied.issues[0]?.detail).toContain("palette.frost");
    expect(copied.issues[0]?.detail).toContain("may mean something else");
  });

  it("refuses to insert, because a card the theme cannot express cannot be saved", async () => {
    const canvas = stage();

    // `snapshot` validates and throws, so a card that arrived anyway would
    // leave a canvas that looks right and a save that fails for the session.
    await expect(
      insertCard(editorStub(canvas) as never, CPU_CARD, {
        globals: undefined,
        onBindings: vi.fn(),
      }),
    ).rejects.toThrow(/palette\.frost/);
    expect(canvas.getObjects()).toHaveLength(0);
  });

  it("accepts a card whose every global the theme does have", () => {
    expect(
      instantiateCard({
        unit: unit(CPU_CARD),
        globals: STARTER_GLOBALS,
        existingIds: [],
        origin: { left: 0, top: 0 },
      }).issues,
    ).toEqual([]);
  });
});

/**
 * A card that declares one id twice.
 *
 * `WidgetIssue["id-collision"]` was unreachable from `card-library.ts`: the
 * `claim` walk minted per authored id with no `has` guard, so both copies took
 * one id and the envelope validator answered `duplicate-id` — after which
 * `snapshot()` throws and **every later save in that session fails, reported
 * nowhere**. That is the same unsaveable-session outcome `insertCard` refuses
 * to create for `unmapped-global`, arriving by the other door, so the guard is
 * the one `claim()` in `widget.ts` keeps and the extraction left behind.
 */
describe("a card that declares one id twice", () => {
  /** The CPU card with its title part renamed onto its value part's id. */
  const DUPLICATE_CARD: CardUnit = {
    id: "group-duplicate-card",
    label: "Duplicate",
    build: () => {
      const card = cpuCard();
      const parts = card["objects"] as readonly ObjectJson[];
      const renamed = parts.map((part) =>
        part["id"] === "cpu-card-title"
          ? { ...part, id: "cpu-card-value" }
          : part,
      );
      return { ...card, objects: renamed };
    },
  };

  const copied = (): ReturnType<typeof instantiateCard> =>
    instantiateCard({
      unit: DUPLICATE_CARD,
      globals: STARTER_GLOBALS,
      existingIds: [],
      origin: { left: 0, top: 0 },
    });

  it("reports the collision, by name", () => {
    const issue = copied().issues.find(
      (entry) => entry.code === "id-collision",
    );

    expect(issue).toBeDefined();
    expect(issue?.detail).toContain("cpu-card-value");
  });

  it("gives each declaration an id of its own, so nothing collides", () => {
    const parts = partsOf(copied().card);
    const ids = parts.map((part) => part["id"]);

    // The defect: both copies at one id is what the validator refuses. The
    // second is numbered the way a second *insertion* would number it, so a
    // duplicate reads as a copy rather than as an accident.
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("card-cpu-card-value");
    expect(ids).toContain("card-cpu-card-value-2");
  });

  it("still serialises and validates — the session stays saveable", async () => {
    // The whole reason the guard exists. `validateFabricThemeEnvelope` is what
    // `snapshot()` calls before every save, and it answers `duplicate-id` for
    // two objects at one id, so a copy that fails here fails every later save.
    const copy = copied();
    const scene = serialiseScene(
      await enliven(copy.card),
    ) as unknown as Readonly<Record<string, unknown>>;

    const result = validateFabricThemeEnvelope({
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "duplicate-card",
      // Carried from the starter rather than restated: the validator requires a
      // declared language, and a restated one is a second place to forget it.
      metadata: { themeLanguage: "en" },
      artboard: { width: 1672, height: 941 },
      scene,
      bindings: copy.bindings,
      globals: STARTER_GLOBALS,
    });

    expect(result.ok).toBe(true);
  });

  it("keeps the readings on one copy, so no binding id is claimed twice", () => {
    const copy = copied();
    const ids = Object.values(copy.bindings).flatMap((list) =>
      list.map((binding) => binding.id),
    );

    // A binding id is unique across the document. Two copies of one
    // declaration cannot both carry them without the validator refusing the
    // pair, so the first keeps them and the second arrives with none — reported
    // as the collision it is, rather than as a document that cannot be saved.
    expect(new Set(ids).size).toBe(ids.length);
    // The CPU card's four readings survive, under the first declaration's id.
    expect(ids).toHaveLength(4);
    expect(Object.keys(copy.bindings)).toContain("card-cpu-card-value");
    expect(Object.keys(copy.bindings)).not.toContain("card-cpu-card-value-2");
  });
});

describe("cards this theme cannot express", () => {
  it("refuses a card the library does not have, by name", async () => {
    await expect(
      insertCard(editorStub(stage()) as never, "group-twin-card", {
        globals: STARTER_GLOBALS,
        onBindings: vi.fn(),
      }),
    ).rejects.toThrow(/group-twin-card/);
  });
});
