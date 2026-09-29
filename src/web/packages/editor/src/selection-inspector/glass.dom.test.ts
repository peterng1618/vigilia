// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VIGILIA_PAINT_PROPERTY } from "@vigilia/scene-fabric";
import { Group, Rect, Textbox } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createSelectionInspector } from "./index.js";

const globals = {
  palette: {
    none: { name: "None", value: { kind: "solid", color: "transparent" } },
    panel: { name: "Panel", value: { kind: "solid", color: "#081523d9" } },
    frost: {
      name: "Frosted panel",
      value: { kind: "solid", color: "#0815234d" },
    },
  },
} as never;

/**
 * The kinds a published theme may carry `vigiliaGlass` on.
 *
 * `renderer-core` keeps its own list internal — deliberately, because the
 * reader and the property name are the external contract and the vocabulary is
 * enforced at import. The **published schema** is that same list, and
 * `fabric-envelope-schema-sync.test.ts` fails if the two ever disagree, so the
 * schema is the editor's honest way to ask. Hard-coding `["Rect", "Group"]`
 * here would be the drift guard this test exists to be.
 */
interface PublishedSchema {
  readonly $defs: Record<
    string,
    Record<string, unknown> & {
      readonly properties?: Record<string, Record<string, unknown>>;
      readonly allOf?: readonly Record<string, unknown>[];
      readonly enum?: readonly string[];
    }
  >;
}

// The path is built from the string `import.meta.url` rather than from a
// `URL` object: under jsdom that object is jsdom's own class, which Node's
// `fileURLToPath` refuses as "not of scheme file".
const SCHEMA = JSON.parse(
  readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../../../schema/theme-document.schema.json",
    ),
    "utf8",
  ),
) as PublishedSchema;

const PUBLISHED_GLASS_TYPES: readonly string[] = (
  SCHEMA.$defs["fabricObject"]?.["allOf"]?.[0] as {
    readonly then: {
      readonly properties: { readonly type: { enum: string[] } };
    };
  }
).then.properties.type.enum;

/** The bound the schema publishes, which is the one the validator enforces. */
const PUBLISHED_BLUR_MAXIMUM = (
  SCHEMA.$defs["glassTreatment"]?.["properties"]?.["blurRadius"] as {
    readonly maximum: number;
  }
).maximum;

function setup(active: unknown) {
  const host = document.createElement("div");
  const history = { saveState: vi.fn() };
  const refreshGlass = vi.fn();
  const editor = {
    canvas: {
      getActiveObject: () => active,
      getObjects: () => (active === undefined ? [] : [active]),
      requestRenderAll: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },
    historyManager: history,
    errorManager: { warn: vi.fn(), error: vi.fn() },
  };
  createSelectionInspector(host, {
    editor: editor as never,
    globals,
    refreshGlass,
  });
  const field = <T extends HTMLElement>(selector: string): T =>
    host.querySelector<T>(selector)!;
  return { host, history, refreshGlass, editor, field };
}

function panel(): Rect {
  return new Rect({ id: "panel", left: 0, top: 0, width: 360, height: 200 });
}

/** A panel as the Add pane makes it: the card surface it hands every new shape. */
function newPanel(): Rect {
  const rect = panel();
  rect.set(VIGILIA_PAINT_PROPERTY, { fill: "palette.panel" });
  rect.set("fill", "#081523d9");
  return rect;
}

function tick(field: HTMLInputElement, checked: boolean): void {
  field.checked = checked;
  field.dispatchEvent(new Event("change"));
}

function type(field: HTMLInputElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event("change"));
}

/** The field's own invalid-input line, when it is showing. */
function alertIn(host: HTMLElement): Element | null {
  return host.querySelector(".vigilia-field [role='alert']");
}

/** A live object of each kind the published schema allows. */
const LIVE_KIND: Readonly<Record<string, () => unknown>> = {
  Rect: () => panel(),
  Group: () => new Group([new Rect({ width: 40, height: 40 })]),
};

describe("the glass control in the selection inspector", () => {
  it("offers frosted glass with a blur radius, both named", () => {
    const { host, field } = setup(panel());
    const enabled = field<HTMLInputElement>("[data-vigilia-glass-enabled]");
    // Non-vacuous: the selection really is a rectangle, so a gate that refused
    // everything cannot satisfy the control assertions below.
    expect(panel()).toBeInstanceOf(Rect);
    expect(enabled.type).toBe("checkbox");
    expect(host.querySelector("[data-vigilia-glass-blur]")).toBeNull();

    tick(enabled, true);

    const blur = field<HTMLInputElement>("[data-vigilia-glass-blur]");
    expect(blur.type).toBe("number");
    expect(blur.min).toBe("0");
    for (const selector of [
      "[data-vigilia-glass-enabled]",
      "[data-vigilia-glass-blur]",
    ]) {
      const control = host.querySelector<HTMLElement>(selector)!;
      const name =
        host.querySelector<HTMLLabelElement>(`label[for="${control.id}"]`)
          ?.textContent ?? control.closest("label")?.textContent;
      expect(name, selector).toBeTruthy();
    }
  });

  it("writes the treatment and tells the glass lifecycle when it is enabled", () => {
    const rect = panel();
    const { history, refreshGlass, field } = setup(rect);

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), true);

    // The authored property is the only place a radius exists.
    expect(rect.get("vigiliaGlass")).toEqual({
      blurRadius: expect.any(Number),
    });
    // Nothing re-resolves the glass lifecycle on its own, so the control is
    // what has to ask; without this call the blur never appears on screen.
    expect(refreshGlass).toHaveBeenCalledTimes(1);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("removes the treatment when the author turns it off", () => {
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 12 });
    const { history, refreshGlass, host, field } = setup(rect);

    expect(host.querySelector("[data-vigilia-glass-blur]")).not.toBeNull();

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), false);

    expect(rect.get("vigiliaGlass")).toBeUndefined();
    expect(refreshGlass).toHaveBeenCalledTimes(1);
    expect(history.saveState).toHaveBeenCalledTimes(1);
    // A radius box over a panel with no treatment accepts an edit and applies
    // none, so it goes with the treatment.
    expect(host.querySelector("[data-vigilia-glass-blur]")).toBeNull();
  });

  it("reads back the radius an author already set", () => {
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 24 });
    const { field } = setup(rect);

    expect(field<HTMLInputElement>("[data-vigilia-glass-blur]").value).toBe(
      "24",
    );
  });

  it("moves the blur radius and refreshes the composite", () => {
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 8 });
    const { history, refreshGlass, field } = setup(rect);

    type(field<HTMLInputElement>("[data-vigilia-glass-blur]"), "32");

    expect(rect.get("vigiliaGlass")).toEqual({ blurRadius: 32 });
    expect(refreshGlass).toHaveBeenCalledTimes(1);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("accepts zero blur, which is a treatment with no blur", () => {
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 8 });
    const { history, field } = setup(rect);

    type(field<HTMLInputElement>("[data-vigilia-glass-blur]"), "0");

    expect(rect.get("vigiliaGlass")).toEqual({ blurRadius: 0 });
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("accepts the published bound and refuses one past it", () => {
    const bound = PUBLISHED_BLUR_MAXIMUM;
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 12 });
    const { host, history, editor, field } = setup(rect);
    const blur = field<HTMLInputElement>("[data-vigilia-glass-blur]");

    type(blur, String(bound));

    expect(rect.get("vigiliaGlass")).toEqual({ blurRadius: bound });
    expect(history.saveState).toHaveBeenCalledTimes(1);

    // Re-read: the accepted edit re-rendered the panel, so the element the
    // first commit belonged to is detached and holds no authority.
    const afterCommit = host.querySelector<HTMLInputElement>(
      "[data-vigilia-glass-blur]",
    )!;
    type(afterCommit, String(bound + 1));

    // Refused by the contract's own reader, not by a number copied into the
    // editor: a clamp to the bound would look identical on screen and
    // silently lose the radius the author asked for.
    expect(rect.get("vigiliaGlass")).toEqual({ blurRadius: bound });
    expect(afterCommit.value).toBe(String(bound));
    expect(history.saveState).toHaveBeenCalledTimes(1);
    expect(editor.errorManager.warn).toHaveBeenCalled();
    // And through the field's own alert, the same one an empty or negative
    // value raises. One field, one kind of invalid-input feedback.
    expect(alertIn(host)).toBeTruthy();
  });

  it("says nothing when a stale event is refused, because nothing was wrong", () => {
    const first = panel();
    first.set("vigiliaGlass", { blurRadius: 12 });
    const { host, history, editor } = setup(first);
    const blur = host.querySelector<HTMLInputElement>(
      "[data-vigilia-glass-blur]",
    )!;
    const second = panel();
    second.set("id", "second");
    (editor.canvas as { getActiveObject: () => unknown }).getActiveObject =
      () => second;

    type(blur, "30");

    // The field belonged to a selection that is gone. Reporting "that value
    // cannot be applied" would blame the author's number for a selection
    // change, which is the one thing here that is not the number's fault.
    expect(first.get("vigiliaGlass")).toEqual({ blurRadius: 12 });
    expect(history.saveState).not.toHaveBeenCalled();
    expect(editor.errorManager.warn).not.toHaveBeenCalled();
    expect(alertIn(host)).toBeNull();
  });

  it("refuses an emptied or negative radius instead of reading it as zero", () => {
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 12 });
    const { history, field } = setup(rect);
    const blur = field<HTMLInputElement>("[data-vigilia-glass-blur]");

    type(blur, "");
    type(blur, "-6");

    expect(rect.get("vigiliaGlass")).toEqual({ blurRadius: 12 });
    expect(blur.value).toBe("12");
    expect(history.saveState).not.toHaveBeenCalled();
  });

  it("refuses a glass edit for an object the panel no longer describes", () => {
    const first = panel();
    const { host, history, refreshGlass, editor } = setup(first);
    const enabled = host.querySelector<HTMLInputElement>(
      "[data-vigilia-glass-enabled]",
    )!;
    const second = panel();
    second.set("id", "second");
    (editor.canvas as { getActiveObject: () => unknown }).getActiveObject =
      () => second;

    tick(enabled, true);

    expect(first.get("vigiliaGlass")).toBeUndefined();
    expect(history.saveState).not.toHaveBeenCalled();
    expect(refreshGlass).not.toHaveBeenCalled();
    expect(enabled.isConnected).toBe(false);
  });

  it("offers a selection that cannot carry glass no glass control at all", () => {
    const text = new Textbox("Hi", { left: 0, top: 0, width: 40 });
    const { host } = setup(text);

    expect(host.querySelector("[data-vigilia-glass-enabled]")).toBeNull();
    expect(host.querySelector("[data-vigilia-glass-blur]")).toBeNull();
    // And the fields the editor does serve for it are untouched by that gate.
    expect(host.querySelector("[data-vigilia-opacity]")).not.toBeNull();
  });

  it("withholds glass from a locked object, which the editor refuses to write", () => {
    const rect = panel();
    rect.set("locked", true);
    const { host } = setup(rect);

    expect(host.querySelector("[data-vigilia-glass-enabled]")).toBeNull();
    expect(host.querySelector("[data-vigilia-panel-fill]")).toBeNull();
  });

  it("gives a new card the frosted surface, not the opaque one", () => {
    // The control named for glass did not carry it. A card the author frosted
    // kept `panel` at 85 % — opaque enough that the blur beneath it is a blur of
    // nothing, so the card read as a tint over a smooth gradient and the
    // photograph behind it was one select away in a control called "Fill".
    const rect = newPanel();
    const { history, refreshGlass, field } = setup(rect);

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), true);

    expect(rect.get(VIGILIA_PAINT_PROPERTY)).toEqual({
      fill: "palette.frost",
    });
    // Resolved, not only referenced: a reference nothing re-resolves would leave
    // the card painted in the colour it had a frame earlier.
    expect(rect.get("fill")).toBe("#0815234d");
    // The treatment and the surface are one edit, so one undo takes both back.
    expect(history.saveState).toHaveBeenCalledTimes(1);
    expect(refreshGlass).toHaveBeenCalledTimes(1);
  });

  it("shows the frosted surface in the fill picker, not only on the canvas", () => {
    const { host, field } = setup(newPanel());

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), true);

    expect(
      host.querySelector<HTMLSelectElement>("[data-vigilia-panel-fill]")?.value,
    ).toBe("palette.frost");
  });

  it("leaves a fill the author chose, because glass is not the author", () => {
    // The other half of the rule: a token the author picked in the Fill picker
    // is a choice, and a treatment layered over it must not overwrite it. There
    // is no record of which hand set a reference, so the current card default is
    // the only honest test for "a default" — and anything else is left alone.
    const rect = newPanel();
    rect.set(VIGILIA_PAINT_PROPERTY, { fill: "palette.none" });
    const { history, field } = setup(rect);

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), true);

    expect(rect.get("vigiliaGlass")).toEqual({
      blurRadius: expect.any(Number),
    });
    expect(rect.get(VIGILIA_PAINT_PROPERTY)).toEqual({ fill: "palette.none" });
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("leaves a card that already carries the frosted surface alone", () => {
    const rect = newPanel();
    rect.set(VIGILIA_PAINT_PROPERTY, { fill: "palette.frost" });
    const { field } = setup(rect);

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), true);

    expect(rect.get(VIGILIA_PAINT_PROPERTY)).toEqual({ fill: "palette.frost" });
  });

  it("does not put a surface on a shape the treatment cannot reach", () => {
    // A group is refused a treatment outright, so it has no backdrop to
    // diffuse; the editor offers it no control and there is nothing to write.
    const group = new Group([new Rect({ width: 40, height: 40 })]);
    const { host } = setup(group);

    expect(host.querySelector("[data-vigilia-glass-enabled]")).toBeNull();
    expect(group.get(VIGILIA_PAINT_PROPERTY)).toBeUndefined();
  });

  it("either authors glass for every kind the schema allows, or names the ones it does not", () => {
    /**
     * The named guard for the one gap the controller ruled on: a kind the
     * published schema lets carry `vigiliaGlass` but the inspector gives no
     * control for. A `Group` is one — Fabric replaces `Group.drawObject`, so a
     * group never fires `before:render`, and `scene-fabric`'s `glass.ts` refuses
     * the treatment and reports it. A control there would accept an edit and
     * apply none.
     */
    const DELIBERATELY_UN_AUTHORABLE: Readonly<Record<string, string>> = {
      Group:
        "Fabric gives a group no before:render boundary, so a treatment on one never composites.",
    };

    for (const type of PUBLISHED_GLASS_TYPES) {
      const make = LIVE_KIND[type];
      // Named first: a kind added to the vocabulary with no live object here
      // has no authoring decision either, and must not pass silently.
      expect(
        typeof make,
        `${type} is in the published schema with no live object`,
      ).toBe("function");
      if (make === undefined) continue;
      const { host } = setup(make());
      const offered =
        host.querySelector("[data-vigilia-glass-enabled]") !== null;
      if (offered) continue;
      expect(
        DELIBERATELY_UN_AUTHORABLE[type],
        `${type} can carry glass and has no control, with no stated reason`,
      ).toBeTypeOf("string");
    }
  });
});
