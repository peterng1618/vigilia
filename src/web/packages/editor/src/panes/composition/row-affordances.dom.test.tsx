// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { EditorShellBridge } from "../../editor-shell/bridge.js";
import { LayerActions } from "../../editor-shell/layer-panel.js";
import type { LayerRow } from "../../editor-shell/layer-tree.js";
import { type ObjectTarget, objectActionsFor } from "../../object-actions.js";
import { uiCopy } from "../../ui-copy.js";
import { CompositionPane } from "./composition-pane.js";
import { NEUTRAL_PAINT } from "./layer-mark-fixture.js";

// React only flushes work scheduled inside `act` when it has been told it is in
// a test; without this, `act` warns and the update lands after the assertion.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** One row as the projection emits it, with the three required arms filled in:
 *  a fixture that left the mark, the role or the bound key out would crash the
 *  panel before the assertion under test ran. */
function row(parts: Partial<LayerRow> = {}): LayerRow {
  return {
    id: "loose-0",
    name: "loose-0",
    kind: "shape",
    mark: { kind: "shape", paint: NEUTRAL_PAINT },
    role: { kind: "shape" },
    bound: [],
    depth: 0,
    parentId: undefined,
    hasChildren: false,
    collapsed: false,
    visible: true,
    locked: false,
    selected: false,
    ...parts,
  };
}

/** Only the members these cases drive: the panel reads the projection, the
 *  entered context, and the commands behind the controls. */
function paneBridge(
  rows: readonly LayerRow[],
  overrides: Record<string, unknown> = {},
): EditorShellBridge {
  return {
    layers: () => rows,
    groupContext: () => [],
    subscribe: () => () => undefined,
    selectLayer: vi.fn(),
    renameLayer: vi.fn(),
    setLayerVisible: vi.fn(),
    setLayerLocked: vi.fn(),
    ...overrides,
  } as unknown as EditorShellBridge;
}

async function renderPane(
  rows: readonly LayerRow[],
  overrides: Record<string, unknown> = {},
): Promise<HTMLElement> {
  const host = document.createElement("div");
  await act(async () =>
    (await Promise.resolve(createRoot(host))).render(
      <CompositionPane bridge={paneBridge(rows, overrides)} />,
    ),
  );
  return host;
}

/** Every control the row's state slot is drawing, by its own name. The twisty
 *  is outside the slot, so this is the affordances and nothing else. */
function affordanceLabels(host: HTMLElement): readonly (string | null)[] {
  return [
    ...host.querySelectorAll<HTMLElement>(".vigilia-layer-state button"),
  ].map((button) => button.getAttribute("aria-label"));
}

/** A pointer over a row, which is one of the two ways a row is attended. */
async function hover(host: HTMLElement, id: string): Promise<void> {
  await act(async () =>
    host
      .querySelector<HTMLElement>(`[data-vigilia-layer="${id}"]`)
      ?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
  );
}

it("shows the row's own controls on the attended row and on a row whose state is not the default", async () => {
  // The whole rule in one table, because the cases are what it is made of: a
  // default row carries nothing, and a row says something the moment either its
  // own state or the author's attention says something. Two flags that are both
  // true carry no information, so a visible unlocked row at rest draws no
  // control at all — 104 icons reading "visible, unlocked" was the measured
  // defect, and it grows with the row count.
  const cases: readonly {
    readonly what: string;
    readonly row: LayerRow;
    readonly attended: boolean;
    readonly shows: readonly string[];
  }[] = [
    {
      what: "a default row, with nobody on it",
      row: row(),
      attended: false,
      shows: [],
    },
    {
      what: "the attended row",
      row: row(),
      attended: true,
      shows: [uiCopy.panels.rename, uiCopy.panels.hide, uiCopy.actions.lock],
    },
    {
      what: "a selected row",
      row: row({ selected: true }),
      attended: false,
      shows: [uiCopy.panels.rename, uiCopy.panels.hide, uiCopy.actions.lock],
    },
    {
      what: "a hidden row",
      row: row({ visible: false }),
      attended: false,
      // Rename is not a state and reads nothing about the eye: the row's state
      // brings back the control that names it, and the eye's neighbour — an
      // unlocked row's lock — stays away, because a hidden row is still
      // unlocked and an unlocked lock icon is noise even here.
      shows: [uiCopy.panels.rename, uiCopy.panels.show],
    },
    {
      what: "a locked row",
      row: row({ locked: true }),
      attended: false,
      shows: [uiCopy.panels.rename, uiCopy.actions.unlock],
    },
  ];

  for (const { what, row: subject, attended, shows } of cases) {
    const host = await renderPane([subject]);
    if (attended) await hover(host, subject.id);
    expect(affordanceLabels(host), what).toEqual(shows);
    host.remove();
  }
});

it("reaches rename, visibility and lock from the keyboard, with a name each", async () => {
  // Review Focus 3. A pointer-only gate would leave a keyboard author with no
  // way to reach any of the three, so attendance is hover OR focus — and the
  // focus half is checked with no pointer anywhere near the row. Each control
  // is a real button with its own name, so it is in the tab order and it is
  // announced; and a press on one reaches the bridge rather than selecting the
  // layer underneath it, which is the other thing the row's own click does.
  const setLayerVisible = vi.fn();
  const setLayerLocked = vi.fn();
  const selectLayer = vi.fn();
  const host = await renderPane([row()], {
    setLayerVisible,
    setLayerLocked,
    selectLayer,
  });
  document.body.append(host);

  const line = host.querySelector<HTMLElement>(
    '[data-vigilia-layer="loose-0"]',
  )!;
  // The row the keyboard can land on at all: `focusin` alone would fire on a row
  // nothing can focus, so the tab stop is asserted rather than assumed.
  expect(line.tabIndex, "the row is in the tab order").toBe(0);
  // `focusin`, not `focus`: React's onFocus is the bubbling one, so this is the
  // event a keyboard author's Tab actually raises on the row.
  await act(async () =>
    line.dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
  );

  const controls = [
    ...host.querySelectorAll<HTMLButtonElement>(".vigilia-layer-state button"),
  ];
  expect(controls.map((control) => control.getAttribute("aria-label"))).toEqual(
    [uiCopy.panels.rename, uiCopy.panels.hide, uiCopy.actions.lock],
  );
  for (const control of controls) {
    expect(
      control.tagName,
      "a control the keyboard can reach is a button",
    ).toBe("BUTTON");
    expect(control.getAttribute("aria-label")?.trim(), "a name each").not.toBe(
      "",
    );
  }

  // The load-bearing half of the gate, and the one a synthetic `focusin` cannot
  // see: Tab from the row goes *to* one of these controls, which raises a
  // `focusout` on the row whose `relatedTarget` is still inside it. That is not
  // leaving the row, so the controls stay mounted and the author can reach the
  // next one; stand them down here and the row is a pointer-only gate again.
  const inside = controls[0]!;
  await act(async () =>
    line.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, relatedTarget: inside }),
    ),
  );
  expect(
    affordanceLabels(host),
    "focus that stays inside the row does not stand the controls down",
  ).toEqual([uiCopy.panels.rename, uiCopy.panels.hide, uiCopy.actions.lock]);

  // The other half, so the case above is not vacuous: focus that leaves the row
  // entirely does stand them down.
  await act(async () =>
    line.dispatchEvent(
      new FocusEvent("focusout", {
        bubbles: true,
        relatedTarget: document.body,
      }),
    ),
  );
  expect(
    affordanceLabels(host),
    "focus leaving the row entirely stands them down",
  ).toEqual([]);
  // And back onto the row for the presses below.
  await act(async () =>
    line.dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
  );

  const press = async (label: string): Promise<void> => {
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>(
          `.vigilia-layer-state button[aria-label="${label}"]`,
        )
        ?.click(),
    );
  };
  await press(uiCopy.panels.hide);
  await press(uiCopy.actions.lock);
  expect(setLayerVisible.mock.calls).toEqual([["loose-0", false]]);
  expect(setLayerLocked.mock.calls).toEqual([["loose-0", true]]);

  // Rename is the third: pressing it opens the field the double-click and F2
  // have always opened, so the control is a second route to one behaviour
  // rather than a second behaviour.
  expect(host.querySelector('[aria-label="Rename loose-0"]')).toBeNull();
  await press(uiCopy.panels.rename);
  expect(
    host.querySelector<HTMLInputElement>('[aria-label="Rename loose-0"]'),
  ).not.toBeNull();

  // A press on a control is not a press on the row: selecting the layer under
  // the control the author pressed is the failure this guards.
  expect(selectLayer).not.toHaveBeenCalled();
  host.remove();
});

it("offers only the object actions this selection can run, and asks the registry", async () => {
  // The footer decides nothing: eligibility is `objectActionsFor`'s, and the
  // expected column below is that function's own answer rather than a copy of
  // its rule. A surface that re-spelled the filter would agree with it on one
  // selection and diverge on another — which is why three selections are asked,
  // one of them a locked object, where the delete half of the registry refuses.
  const cases: readonly {
    readonly what: string;
    readonly target: ObjectTarget;
  }[] = [
    {
      what: "nothing selected",
      target: { kind: "none", locked: false, memberCount: 0, isGroup: false },
    },
    {
      what: "a locked object",
      target: { kind: "object", locked: true, memberCount: 1, isGroup: false },
    },
    {
      what: "an unlocked object",
      target: {
        kind: "object",
        locked: false,
        memberCount: 1,
        isGroup: false,
      },
    },
  ];

  const renderFooter = async (
    target: ObjectTarget,
  ): Promise<{
    readonly host: HTMLElement;
    readonly labels: readonly (string | null)[];
    readonly offered: ReturnType<typeof objectActionsFor>;
    readonly run: ReturnType<typeof vi.fn>;
  }> => {
    const run = vi.fn();
    const bridge = {
      target: () => target,
      canArrange: () => false,
      run,
    } as unknown as EditorShellBridge;
    const host = document.createElement("div");
    await act(async () =>
      (await Promise.resolve(createRoot(host))).render(
        <LayerActions bridge={bridge} />,
      ),
    );
    return {
      host,
      run,
      offered: objectActionsFor(bridge),
      labels: [...host.querySelectorAll<HTMLElement>("button")].map((button) =>
        button.getAttribute("aria-label"),
      ),
    };
  };

  for (const { what, target } of cases) {
    const { host, labels, offered, run } = await renderFooter(target);
    expect(labels, what).toEqual(offered.map((action) => action.label));
    // The press carries the registry's own id, so the footer is rendering the
    // registry's entries rather than a list of its own that happens to match.
    const first = offered[0];
    if (first !== undefined) {
      await act(async () =>
        host.querySelector<HTMLButtonElement>("button")?.click(),
      );
      expect(run.mock.calls, what).toEqual([[first.id]]);
    }
    host.remove();
  }

  // The absences the filter buys, said outright: a locked object is offered no
  // Delete and no Lock, and a selection of nothing is offered nothing at all.
  // Rendering the whole registry instead would put a control on the footer that
  // the selection cannot run.
  const none = await renderFooter({
    kind: "none",
    locked: false,
    memberCount: 0,
    isGroup: false,
  });
  expect(none.labels).toEqual([]);

  const locked = await renderFooter({
    kind: "object",
    locked: true,
    memberCount: 1,
    isGroup: false,
  });
  expect(locked.labels).not.toContain(uiCopy.actions.delete);
  expect(locked.labels).not.toContain(uiCopy.actions.lock);
  expect(locked.labels).toContain(uiCopy.actions.unlock);
});
