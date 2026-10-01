// @vitest-environment jsdom
import type { Binding, FabricGlobals, TextRun } from "@vigilia/renderer-core";
import { formatInstant, instantIn } from "@vigilia/renderer-core";
import { VIGILIA_TEXT_PROPERTY } from "@vigilia/scene-fabric";
import { Canvas, Textbox } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createRunEditor } from "./runs.js";

/**
 * A text object's runs, plus the binding store a run's reading lives in: the
 * envelope owns that, so the test stands in for the session.
 */
function harness(
  runs: readonly TextRun[],
  locale?: string,
  globals?: FabricGlobals,
  /** Keys a reading has arrived for; absent means nothing has. */
  arrived: readonly string[] = [],
  declared: readonly Binding[] = [],
) {
  const canvas = new Canvas(document.createElement("canvas"));
  const object = new Textbox("", { id: "clock-label" });
  object.set(VIGILIA_TEXT_PROPERTY, { runs });
  canvas.add(object);

  let bindings: readonly Binding[] = [...declared];
  const host = document.createElement("div");
  const render = (): void => {
    host.replaceChildren();
    host.append(
      createRunEditor(
        {
          canvas,
          historyManager: { saveState: vi.fn() },
        } as never,
        globals,
        object as never,
        render,
        {
          bindings: () => bindings,
          setBindings: (next) => {
            bindings = next;
          },
        },
        locale,
        () => ({
          latest: (key: string) =>
            arrived.includes(key)
              ? {
                  sensorId: key,
                  timestamp: "2026-09-20T00:00:00.000Z",
                  status: "ok" as const,
                  value: 1,
                }
              : undefined,
          history: () => [],
        }),
      ).root,
    );
  };
  render();

  const pick = <T extends HTMLElement>(selector: string): T =>
    host.querySelector<T>(selector)!;

  return {
    object,
    host,
    pick,
    render,
    runs: (): readonly TextRun[] =>
      (object.get(VIGILIA_TEXT_PROPERTY) as { runs: readonly TextRun[] }).runs,
    stored: (): readonly Binding[] => bindings,
    notes: (): readonly string[] =>
      [...host.querySelectorAll<HTMLElement>("[data-vigilia-run-note]")].map(
        (note) => note.textContent ?? "",
      ),
    binding: (): Readonly<Record<string, string | undefined>> => {
      const note = host.querySelector<HTMLElement>(
        "[data-vigilia-run-binding]",
      );
      return {
        text: note?.textContent ?? undefined,
        problem: note?.dataset["vigiliaRunProblem"],
      };
    },
    dispose: () => canvas.dispose(),
  };
}

const literalClock: readonly TextRun[] = [
  {
    kind: "literal",
    text: "07:24",
    typePreset: "typePresets.70-300",
    style: { color: { ref: "palette.text" } },
  },
];

/** Choosing from a select fires `change`; nothing else does. */
function choose(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change"));
}

describe("binding a text run to a sensor", () => {
  it("turns a literal run into a reading, keeping how it looks", () => {
    const box = harness(literalClock);

    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );

    const [binding] = box.stored();
    expect(binding?.semanticKey).toBe("time.now");
    expect(box.runs()[0]).toMatchObject({
      kind: "value",
      bindingId: binding?.id,
      typePreset: "typePresets.70-300",
      style: { color: { ref: "palette.text" } },
    });
    return box.dispose();
  });

  it("offers a format and a zone only for a key that is an instant", () => {
    const box = harness(literalClock);
    const source = box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]');

    choose(source, "cpu.load");
    box.render();
    expect(box.host.querySelector('[data-vigilia-run-format="0"]')).toBeNull();
    expect(box.host.querySelector('[data-vigilia-run-zone="0"]')).toBeNull();

    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );
    box.render();
    expect(
      box.host.querySelector('[data-vigilia-run-format="0"]'),
    ).not.toBeNull();
    expect(
      box.host.querySelector('[data-vigilia-run-zone="0"]'),
    ).not.toBeNull();
    return box.dispose();
  });

  it("lets the author take the unit off a reading, as the reference theme does", () => {
    // `cpu-card-value` in the reference is a value run on `cpu.load` with the
    // "%" as a styled literal beside it. Nothing here could author that: the
    // chart panel had this control and the run panel did not, so an author who
    // wanted it got the reading's unit AND their literal, and "45%%" on the
    // display's face.
    const box = harness(literalClock);
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "cpu.load",
    );
    box.render();

    const unit = box.pick<HTMLSelectElement>(
      '[data-vigilia-run-unit-display="0"]',
    );
    expect(unit).toBeDefined();
    // Default is no override: the run says nothing about units.
    expect(box.runs()[0]).not.toHaveProperty("unitDisplay");

    choose(unit, "none");
    box.render();
    // On the RUN, not the binding: a run's own unitDisplay wins, so writing the
    // binding would be shadowed by the very theme this control reproduces.
    expect(box.runs()[0]).toMatchObject({ kind: "value", unitDisplay: "none" });
    expect(box.stored()[0]?.unitDisplay).toBeUndefined();

    // Clearing it is not the same as "none" — the default is the reading's own.
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-unit-display="0"]'),
      "",
    );
    box.render();
    expect(box.runs()[0]).not.toHaveProperty("unitDisplay");
    return box.dispose();
  });

  it("previews the tokens as they are typed, and stores what was typed", () => {
    const box = harness(literalClock);
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );
    box.render();

    const input = box.pick<HTMLInputElement>('[data-vigilia-run-format="0"]');
    input.value = "[It is ]dddd";
    input.dispatchEvent(new Event("input"));

    // The same instant the editor's own preview source reads, so the preview is
    // the reading the run will paint rather than an example of one.
    expect(box.pick('[data-vigilia-run-format-preview="0"]').textContent).toBe(
      formatInstant(instantIn(Date.now()), "[It is ]dddd"),
    );

    input.dispatchEvent(new Event("change"));
    expect(box.stored()[0]?.format).toBe("[It is ]dddd");
    return box.dispose();
  });

  it("falls back to the key's own default when the format is cleared", () => {
    const box = harness(literalClock);
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );
    box.render();

    const placeholder = box.pick<HTMLInputElement>(
      '[data-vigilia-run-format="0"]',
    ).placeholder;
    expect(placeholder).toBe("HH:mm");

    const input = box.pick<HTMLInputElement>('[data-vigilia-run-format="0"]');
    input.value = "dddd";
    input.dispatchEvent(new Event("change"));
    box.render();

    const cleared = box.pick<HTMLInputElement>('[data-vigilia-run-format="0"]');
    cleared.value = "";
    cleared.dispatchEvent(new Event("input"));
    expect(box.pick('[data-vigilia-run-format-preview="0"]').textContent).toBe(
      formatInstant(instantIn(Date.now()), "HH:mm"),
    );

    cleared.dispatchEvent(new Event("change"));
    expect(box.stored()[0]?.format).toBeUndefined();
    return box.dispose();
  });

  it("drops what described the reading the run no longer reads", () => {
    const box = harness(literalClock);
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );
    box.render();
    const input = box.pick<HTMLInputElement>('[data-vigilia-run-format="0"]');
    input.value = "dddd";
    input.dispatchEvent(new Event("change"));
    box.render();
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-zone="0"]'),
      "Asia/Tokyo",
    );

    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "cpu.load",
    );

    expect(box.stored()[0]?.semanticKey).toBe("cpu.load");
    expect(box.stored()[0]?.format).toBeUndefined();
    expect(box.stored()[0]?.timeZone).toBeUndefined();
    return box.dispose();
  });

  it("reads the clock in the zone the author pinned to it", () => {
    const box = harness(literalClock);
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );
    box.render();

    // Unpinned is the default: the display reads wherever its consumer is.
    const zone = box.pick<HTMLSelectElement>('[data-vigilia-run-zone="0"]');
    expect(zone.value).toBe("");

    choose(zone, "Asia/Tokyo");
    box.render();
    expect(box.stored()[0]?.timeZone).toBe("Asia/Tokyo");

    // The preview is the reading the run will paint, so pinning a zone has to
    // change what it says rather than only what is stored.
    expect(box.pick('[data-vigilia-run-format-preview="0"]').textContent).toBe(
      formatInstant(instantIn(Date.now()), "HH:mm", "Asia/Tokyo"),
    );

    choose(box.pick<HTMLSelectElement>('[data-vigilia-run-zone="0"]'), "");
    expect(box.stored()[0]?.timeZone).toBeUndefined();
    return box.dispose();
  });

  it("previews a format in the document's own language", () => {
    const editor = harness([{ kind: "value", bindingId: "clock-date" }], "ja");
    choose(
      editor.pick<HTMLSelectElement>("[data-vigilia-run-source]"),
      "date.today",
    );

    const format = editor.pick<HTMLInputElement>("[data-vigilia-run-format]");
    format.value = "dddd";
    format.dispatchEvent(new Event("input"));

    const preview = editor.pick<HTMLElement>(
      "[data-vigilia-run-format-preview]",
    ).textContent;

    // The preview must read the language the paint will, or an author chooses a
    // format against words that never appear on the dashboard. The weekday varies
    // with the day the suite runs, so the week's shape is asserted rather than a
    // fixed string: `ja` and `en` for the same instant must differ, which a
    // preview ignoring the language cannot achieve. One instant, read once: a
    // midnight rollover between the assertions must not make them disagree.
    const instant = instantIn(Date.now());

    expect(preview).toBe(formatInstant(instant, "dddd", undefined, "ja"));
    expect(preview).not.toBe(formatInstant(instant, "dddd", undefined, "en"));

    return editor.dispose();
  });

  it("writes alignment, wrap and overflow into the object's authored text", () => {
    const box = harness(literalClock);
    const content = (): Record<string, unknown> =>
      box.object.get(VIGILIA_TEXT_PROPERTY) as Record<string, unknown>;

    choose(box.pick<HTMLSelectElement>("[data-vigilia-text-align]"), "center");
    choose(box.pick<HTMLSelectElement>("[data-vigilia-text-wrap]"), "nowrap");
    choose(
      box.pick<HTMLSelectElement>("[data-vigilia-text-overflow]"),
      "ellipsis",
    );

    // These are the object's layout, which the renderer already honours; they
    // persist in the same authored content the runs do.
    expect(content()["align"]).toBe("center");
    expect(content()["wrap"]).toBe(false);
    expect(content()["overflow"]).toBe("ellipsis");
    return box.dispose();
  });

  it("shows alignment, wrap and overflow again from what was stored", () => {
    const box = harness(literalClock);
    choose(box.pick<HTMLSelectElement>("[data-vigilia-text-align]"), "right");

    // Reopening rebuilds the control from the persisted content, so a re-read
    // must show the stored choice rather than a default.
    box.render();
    expect(box.pick<HTMLSelectElement>("[data-vigilia-text-align]").value).toBe(
      "right",
    );
    return box.dispose();
  });

  it("returns a run to prose, releasing the binding it named", () => {
    const box = harness(literalClock);
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );
    box.render();

    choose(box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'), "");

    expect(box.stored()).toEqual([]);
    expect(box.runs()[0]).toMatchObject({
      kind: "literal",
      typePreset: "typePresets.70-300",
    });
    return box.dispose();
  });
});

describe("what a run cannot carry", () => {
  const tracking = {
    typePresets: {
      tracked: {
        name: "Tracked",
        value: { family: "Inter", size: 32, letterSpacing: 4 },
      },
      plain: {
        name: "Plain",
        value: { family: "Inter", size: 32 },
      },
    },
  } as unknown as FabricGlobals;

  const mixedRuns: readonly TextRun[] = [
    { kind: "literal", text: "CPU ", typePreset: "typePresets.plain" },
    { kind: "literal", text: "42%", typePreset: "typePresets.tracked" },
  ];

  it("says a second run's tracking is not shown separately", () => {
    // The defect this covers is a control that does nothing: the author picks a
    // tracked preset for the value run, and the object keeps the first run's
    // tracking with nothing on screen to say so.
    const box = harness(mixedRuns, undefined, tracking);

    expect(box.notes()).toHaveLength(1);
    expect(box.notes()[0]).toContain("typePresets.tracked");
    expect(box.notes()[0]).toContain("one tracking value");
    return box.dispose();
  });

  it("says nothing when only the first run tracks", () => {
    // The counter-case: a single-run object carries its preset's tracking, so a
    // note here would train the author to ignore the ones that matter.
    const box = harness(
      [{ kind: "literal", text: "VIGILIA", typePreset: "typePresets.tracked" }],
      undefined,
      tracking,
    );

    expect(box.notes()).toEqual([]);
    return box.dispose();
  });

  it("says nothing when a later run tracks the same as the first", () => {
    // The panel has to match the model, which reports on *inequality*. A second
    // run asking for the value the object already carries loses nothing, and
    // warning about it would teach the author to ignore the note.
    const same = {
      typePresets: {
        tracked: {
          name: "Tracked",
          value: { family: "Inter", size: 32, letterSpacing: 4 },
        },
      },
    } as unknown as FabricGlobals;
    const box = harness(
      [
        { kind: "literal", text: "CPU ", typePreset: "typePresets.tracked" },
        { kind: "literal", text: "42%", typePreset: "typePresets.tracked" },
      ],
      undefined,
      same,
    );

    expect(box.notes()).toEqual([]);
    return box.dispose();
  });

  it("still reports when the first run is untracked and a later one tracks", () => {
    // The object takes the first run's value, which here is none, so a later
    // run asking for tracking is a gap like any other. Distinct from the first
    // case above only in what the object ends up painting, and the note is the
    // same one.
    const box = harness(mixedRuns, undefined, tracking);

    expect(box.notes()).toHaveLength(1);
    expect(box.notes()[0]).toContain("typePresets.tracked");
    return box.dispose();
  });

  it("reports a mismatching preset once however many runs share it", () => {
    // The round that removed a duplicate in scene-fabric added one here, so the
    // three-run shape is now covered once, in the place that renders it.
    const box = harness(
      [
        { kind: "literal", text: "CPU ", typePreset: "typePresets.plain" },
        { kind: "literal", text: "48", typePreset: "typePresets.tracked" },
        { kind: "literal", text: " %", typePreset: "typePresets.tracked" },
      ],
      undefined,
      tracking,
    );

    // Two runs name the same mismatching preset, so one note says it once.
    expect(box.notes()).toHaveLength(1);
    return box.dispose();
  });

  it("says nothing when no run tracks", () => {
    const box = harness(
      [
        { kind: "literal", text: "CPU ", typePreset: "typePresets.plain" },
        { kind: "literal", text: "42%", typePreset: "typePresets.plain" },
      ],
      undefined,
      tracking,
    );

    expect(box.notes()).toEqual([]);
    return box.dispose();
  });
});

describe("how many runs a text object has", () => {
  const globals = {
    typePresets: {
      "60-600": { name: "Reading", value: { family: "Inter", size: 60 } },
      "20-400": { name: "Unit", value: { family: "Inter", size: 20 } },
    },
    palette: {
      text: { name: "Text", value: { kind: "solid", color: "#fff" } },
    },
  } as unknown as FabricGlobals;

  const readingAndUnit: readonly TextRun[] = [
    { kind: "value", bindingId: "load", typePreset: "typePresets.60-600" },
    { kind: "literal", text: "%", typePreset: "typePresets.20-400" },
  ];

  it("appends a run that looks the way the one before it does", () => {
    // "32" and "%" are one card, not two objects: the number is a reading and
    // the sign is prose, and only a second run on the same object can say so.
    const box = harness(literalClock, undefined, globals);

    box.pick<HTMLButtonElement>("[data-vigilia-run-add]").click();

    expect(box.runs()).toHaveLength(2);
    expect(box.runs()[1]).toMatchObject({
      kind: "literal",
      text: "",
      typePreset: "typePresets.70-300",
    });
    return box.dispose();
  });

  it("carries the text a prose run says, and offers none for a reading", () => {
    const box = harness(
      readingAndUnit,
      undefined,
      globals,
      ["cpu.load"],
      [{ id: "load", semanticKey: "cpu.load" }],
    );

    // A value run has no words of its own, so a field over one would accept an
    // edit and persist nothing.
    expect(box.host.querySelector('[data-vigilia-run-text="0"]')).toBeNull();
    const field = box.pick<HTMLInputElement>('[data-vigilia-run-text="1"]');
    expect(field.value).toBe("%");
    field.value = " %";
    field.dispatchEvent(new Event("change"));

    expect(box.runs()[1]).toMatchObject({ kind: "literal", text: " %" });
    return box.dispose();
  });

  it("removes a run, and the reading only it was bound to", () => {
    const box = harness(
      readingAndUnit,
      undefined,
      globals,
      ["cpu.load"],
      [{ id: "load", semanticKey: "cpu.load" }],
    );

    box.pick<HTMLButtonElement>('[data-vigilia-run-remove="0"]').click();

    expect(box.runs()).toHaveLength(1);
    // Nothing else can be reading it, and a binding no run can paint is one
    // the document declares and no reader resolves.
    expect(box.stored()).toEqual([]);
    return box.dispose();
  });

  it("will not offer to remove the last run", () => {
    // A text object with no runs paints nothing at all, so the control that
    // could reach that state is the control that empties the canvas.
    const box = harness(literalClock, undefined, globals);
    expect(box.host.querySelector("[data-vigilia-run-remove]")).toBeNull();
    return box.dispose();
  });

  it("numbers the remove buttons, so three rows are not one name", () => {
    const box = harness(
      [
        ...readingAndUnit,
        { kind: "literal", text: " of 4", typePreset: "typePresets.20-400" },
      ],
      undefined,
      globals,
      ["cpu.load"],
      [{ id: "load", semanticKey: "cpu.load" }],
    );

    const names = [
      ...box.host.querySelectorAll("[data-vigilia-run-remove]"),
    ].map((button) => button.textContent);
    expect(new Set(names).size).toBe(3);
    return box.dispose();
  });
});

describe("which type preset a run is set in", () => {
  const globals = {
    typePresets: {
      "24-400": { name: "Card title", value: { family: "Inter", size: 24 } },
      "46-600": { name: "Ring unit", value: { family: "Inter", size: 46 } },
      mono: { name: "Mono", value: { family: "Inter", size: 14 } },
    },
    palette: {
      text: { name: "Text", value: { kind: "solid", color: "#fff" } },
    },
  } as unknown as FabricGlobals;

  it("lists each preset under the name the type preset panel lists it by", () => {
    // Two dropdowns, thirteen presets, one document — and the run editor printed
    // the ids (`24-400`) where every other reference picker in the editor prints
    // the authored name (`Card title`). An author who read one could not find the
    // same preset in the other, a field apart.
    const box = harness(
      [{ kind: "literal", text: "Hi", typePreset: "typePresets.24-400" }],
      undefined,
      globals,
    );

    const options = [
      ...box
        .pick<HTMLSelectElement>('[data-vigilia-run-preset="0"]')
        .querySelectorAll("option"),
    ];
    expect(options.map((option) => option.textContent)).toEqual([
      "Card title",
      "Ring unit",
      "Mono",
    ]);
    return box.dispose();
  });

  it("stores the reference, not the name it shows", () => {
    const box = harness(
      [{ kind: "literal", text: "Hi", typePreset: "typePresets.24-400" }],
      undefined,
      globals,
    );

    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-preset="0"]'),
      "typePresets.46-600",
    );

    // The label is display; the value is what persists. Changing the first must
    // not change the second.
    expect(box.runs()[0]?.typePreset).toBe("typePresets.46-600");
    return box.dispose();
  });

  it("shows the preset the run is actually set in", () => {
    const box = harness(
      [{ kind: "literal", text: "Hi", typePreset: "typePresets.46-600" }],
      undefined,
      globals,
    );

    // The control was never mis-bound — it holds the stored reference, which is
    // what the run carries. What an author could not do was read the option it
    // had landed on and match it against the list beside it.
    const preset = box.pick<HTMLSelectElement>(
      '[data-vigilia-run-preset="0"]',
    );
    expect(preset.value).toBe("typePresets.46-600");
    expect(preset.selectedOptions[0]?.textContent).toBe("Ring unit");
    return box.dispose();
  });
});

describe("which binding a value run carries", () => {
  const bound: readonly TextRun[] = [
    { kind: "value", bindingId: "load", typePreset: "typePresets.60-600" },
  ];

  it("names the key, and says nothing is missing, when a reading has arrived", () => {
    const { binding, dispose } = harness(
      bound,
      undefined,
      undefined,
      ["ram.used.percent"],
      [{ id: "load", semanticKey: "ram.used.percent" }],
    );

    // The canvas paints the reading, so the key is only visible here.
    expect(binding().text).toContain("ram.used.percent");
    expect(binding().problem).toBeUndefined();
    void dispose();
  });

  it("marks a declared binding with no reading, which needs a sensor not an edit", () => {
    const { binding, dispose } = harness(
      bound,
      undefined,
      undefined,
      [],
      [{ id: "load", semanticKey: "ram.used.percent" }],
    );

    expect(binding().problem).toBe("unmapped");
    void dispose();
  });

  it("marks a run that names a binding this object never declared", () => {
    const { binding, dispose } = harness([
      { kind: "value", bindingId: "ghost" },
    ]);

    expect(binding().problem).toBe("undeclared");
    void dispose();
  });
});

describe("which format tokens a clock can be given", () => {
  it("names the vocabulary beside the field", () => {
    // The formatter's rule is that an unrecognised token renders literally "so
    // a typo is visible" — which makes it visible on a display, where the
    // author is not. Drawn during the rebuild: a date authored as
    // `EEE, MMM d, yyyy` painted exactly that, because the vocabulary is
    // `ddd`, `D` and `YYYY`.
    const box = harness(literalClock);
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "date.today",
    );
    box.render();

    const hint = box.pick('[data-vigilia-run-format-hint="0"]').textContent;
    for (const token of ["YYYY", "MMM", "ddd", "DD", "HH", "mm", "A"])
      expect(hint).toContain(token);
    return box.dispose();
  });
});
