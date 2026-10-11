// @vitest-environment jsdom
/**
 * The two copy defects, checked as defects.
 *
 * `ui-copy.test.ts` owns the copy rules — the table holds no pictograph and no
 * surface says a word the table does not. This file owns the two ways a word can
 * be *wrong* rather than unowned, and it lives apart from that file because
 * adding it there took the walk past the 800-line stop (783 before this file).
 *
 * **A missing reading is a gap, never a placeholder.** Bible §9, and the
 * architecture guardrail `AGENTS.md` names: a reading that has not arrived is
 * never fabricated as a zero or a default. A surface may draw nothing (that is
 * the truth) or the gap's own word; it may never draw `0`, `-`, `--` or `—`,
 * which an author reads as data.
 *
 * **A capability string names a control that can run it.** Every string that
 * claims an action is either beside the control that performs it, or withdrawn.
 */
import { Canvas, Textbox } from "fabric/es";
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { settingsField } from "./editor-shell/controls/settings-field.js";
import { PublishControl } from "./editor-shell/publish-control.js";
import { PublishIndicator } from "./editor-shell/publish-indicator.js";
import { SaveState } from "./editor-shell/save-state.js";
import type { EditorActionFacade } from "./editor-shell/session-facade.js";
import type {
  HostingSnapshot,
  HostingStore,
  PublishSurfaceStore,
} from "./editor-shell/shell-layout.js";
import { resolutionValue } from "./selection-inspector/appearance.js";
import { projectRuns, RunEditor } from "./selection-inspector/runs.js";
import type { RunEdits } from "./selection-inspector/view.js";
import { shortcutLabel } from "./shortcut-manager/display.js";
import { PRODUCT_SHORTCUTS } from "./shortcut-manager/index.js";
import { uiCopy } from "./ui-copy.js";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** A host whose state is fixed. The real `HostingStore` asks the host on
 *  construction, which a unit test has no host for; only the two members the
 *  readers use are here, because a fuller stub would be a second implementation. */
function stubHosting(snapshot: HostingSnapshot): HostingStore {
  return {
    subscribe: () => () => {},
    get: () => snapshot,
  } as unknown as HostingStore;
}

function stubSurface(): PublishSurfaceStore {
  return {
    subscribe: () => () => {},
    get: () => false,
    set: () => {},
  } as unknown as PublishSurfaceStore;
}

/** A session that answers one question — is the document dirty — with a fixed
 *  answer. The other twenty members are the shell's and are not reachable here. */
function stubSession(dirty: boolean): EditorActionFacade {
  return {
    isDirty: () => dirty,
    subscribeDocumentChange: () => () => {},
  } as unknown as EditorActionFacade;
}

/** Render one surface and hand back its own text, unmounting it before the next
 *  mount so a portal or a popup cannot leak into the read that follows. */
async function renderSpeech(element: ReactElement): Promise<string> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  const text = host.textContent?.trim() ?? "";
  await act(async () => root.unmount());
  host.remove();
  return text;
}

/** A run row's binding note, from a value run whose reading has (or has not)
 *  arrived. The note is the row's own words, not a placeholder the canvas would
 *  paint — the surface an author reads before they discover the missing sensor. */
async function runReadingNote(
  bindings: readonly { readonly id: string; readonly semanticKey: string }[],
): Promise<string> {
  const canvas = new Canvas(document.createElement("canvas"));
  const object = new Textbox("", { id: "clock-label" });
  object.set("vigiliaText", {
    align: "left",
    runs: [{ kind: "value", bindingId: "clock-time" }],
  });
  canvas.add(object);

  const runs = projectRuns(object as never, "clock-label", {
    globals: undefined,
    locale: undefined,
    nodeBindings: () => bindings,
    // Nothing has arrived for the `unmapped` case; the `undeclared` case never
    // asks, because the run names a binding the object does not hold.
    sampleSource: () => ({ latest: () => undefined, history: () => [] }),
    swatchValue: () => undefined,
  });
  if (runs === undefined)
    throw new Error("the run editor projected no rows to read");

  const edits: RunEdits = {
    setRunText: () => true,
    setRunPreset: () => true,
    setRunColour: () => true,
    setUnitDisplay: () => true,
    setSource: () => true,
    setFormat: () => true,
    setZone: () => true,
    writeLayout: () => true,
    addRun: () => true,
    removeRun: () => true,
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(RunEditor, { runs, edits })));
  const text =
    host.querySelector("[data-vigilia-run-binding]")?.textContent?.trim() ?? "";
  await act(async () => root.unmount());
  host.remove();
  return text;
}

/** What an unauthored optional chart setting renders: the select's own first
 *  option, which is the gap's word rather than a placeholder value. A DOM
 *  factory with no React and no popup, so it is the one absence site this file
 *  can render for free. */
function unsetSettingWord(): string {
  const field = settingsField(
    {
      property: "vigilia-test.optional",
      label: "Optional setting",
      kind: "select",
      section: "content",
      hint: "A descriptor that exists only to render the absent state.",
      optional: true,
      options: [{ value: "yes", label: "Yes" }],
    },
    { value: undefined, onChange: () => {} },
  );
  // The unset option is appended first (`settings-field.ts`), so this is the
  // word an author reads before the field has a value.
  return field.querySelector("option")?.textContent?.trim() ?? "";
}

/** What a placeholder reading looks like: the shapes an author would read as a
 *  measurement rather than as an absence. The brief's own list. */
const PLACEHOLDER_READINGS = ["0", "-", "--", "—", "0.0"];

interface AbsentReading {
  /** What the surface is, for the failure message a broken net prints. */
  readonly name: string;
  /** What it renders for its absent reading. */
  readonly text: string;
  /** Whether the surface must state the gap in words, or may draw nothing —
   *  where nothing is the truth (`PublishIndicator` on an unread host). */
  readonly expect: "gap" | "nothing";
}

/**
 * The absence kinds this case **renders**, and the ones it does not.
 *
 * **Rendered here (eight):** an unread host on two surfaces (`PublishIndicator`
 * and `PublishControl` draw nothing), a saved document (`SaveState` draws
 * nothing), a sample that has not arrived and a binding this object does not
 * declare (both stated in words by `runs.tsx`'s `bindingStateOf`), the two lines
 * `resolutionValue` answers (`notSet`, and `"{shown} (no longer resolves)"`), and
 * an unauthored optional chart setting, whose select renders the table's own gap
 * word (`settings-field.ts:206`).
 *
 * **Not rendered here, proven elsewhere:** the About tab's absent version is a
 * row left out rather than a dash, asserted by `settings.dom.test.tsx` (the About
 * text holds neither `panels.notSet` nor a dash); an unauthored optional *number*
 * field is an empty box, never a zero, asserted by `controls.dom.test.ts`. The
 * unread host and the saved document are also rendered and asserted by their own
 * files (`publish-indicator.dom.test.tsx`, `save-state.dom.test.tsx`).
 *
 * **Not rendered here, and no test renders it:** `chart-fields.tsx:351`, the
 * React clearable select's gap option — reading it needs a Base UI select popup
 * open, the 50–90s-per-open class (`vg-135`); and the artboard resolution select
 * (`artboard-fields.tsx:159`), whose absence is the control's *value* (`?? ""`)
 * rather than its text, so a rendered-text net would read its option list and the
 * right net is a value assertion this file does not make.
 */
async function absentReadings(): Promise<AbsentReading[]> {
  return [
    {
      name: "the status bar's live mark, host unknown",
      text: await renderSpeech(
        createElement(PublishIndicator, {
          store: stubHosting({ kind: "unknown" }),
        }),
      ),
      expect: "nothing",
    },
    {
      name: "the publish control, host unknown",
      text: await renderSpeech(
        createElement(PublishControl, {
          hosting: stubHosting({ kind: "unknown" }),
          surface: stubSurface(),
        }),
      ),
      expect: "nothing",
    },
    {
      name: "the save state, document saved",
      text: await renderSpeech(
        createElement(SaveState, { session: stubSession(false) }),
      ),
      expect: "nothing",
    },
    {
      name: "a run's reading the sensor has not sent",
      text: await runReadingNote([
        { id: "clock-time", semanticKey: "date.today" },
      ]),
      expect: "gap",
    },
    {
      name: "a run naming a binding this object does not declare",
      text: await runReadingNote([]),
      expect: "gap",
    },
    {
      name: "the selection's resolution line, nothing spent",
      text: resolutionValue(undefined, undefined),
      expect: "gap",
    },
    {
      name: "the selection's resolution line, a reference that no longer resolves",
      text: resolutionValue("Ink", undefined),
      expect: "gap",
    },
    {
      name: "an unauthored optional chart setting",
      text: unsetSettingWord(),
      expect: "gap",
    },
  ];
}

it("states a missing reading as a gap rather than a zero or a dash", async () => {
  const readings = await absentReadings();
  // The count is the number of absence kinds covered, not a prediction: a kind
  // dropped from the table is this red rather than a loop that checked less.
  expect(readings).toHaveLength(8);
  expect(readings.filter((reading) => reading.expect === "gap").length).toBe(5);

  for (const reading of readings) {
    const text = reading.text.trim();
    // The defect this net exists for: a placeholder an author reads as data.
    expect(PLACEHOLDER_READINGS, reading.name).not.toContain(text);
    if (reading.expect === "gap") {
      // Where the surface must draw something, it draws the gap's own word.
      expect(text, reading.name).not.toBe("");
    } else {
      // Where nothing is the truth, nothing is drawn — not a fabricated claim.
      expect(text, reading.name).toBe("");
    }
  }
});

/**
 * The publish surface's capability strings, each against the control that runs
 * it — **and the boundary of that claim, stated rather than implied.**
 *
 * **Proven here:** `uiCopy.publish.start`, the header control's word, against
 * the control that opens the surface (`[data-vigilia-publish]`, present and
 * enabled); and the `⌘⇧P` chord, printed from the live table, against the
 * `publish.surface` binding the table owns. The chord is the case the brief
 * flags: plan 2 drew the button alone and plan 5 bound `publish.surface`, so the
 * printed chord now runs the action.
 *
 * **Proven elsewhere, named.** The View menu's three readings
 * (`dataSource`/`chartRefresh`/`valueRuns`): `shell-layout.dom.test.tsx` opens
 * the refresh submenu, picks `1 FPS` and asserts `view.setChartRefreshRate(1)`,
 * so each reading's radio reaches its owner — opening a menu here would cost the
 * 50–90s per open the copy walk records against it (`vg-135`), and an existing
 * test already does it. `saveState.unsaved` and `statusBar.live` are a state and
 * a state, not actions: each is rendered and asserted by its surface's own test
 * (`save-state.dom.test.tsx`, `publish-indicator.dom.test.tsx`). The diagnostics
 * pair leads its message, asserted by `diagnostic-message.dom.test.tsx`.
 *
 * **Nothing to prove, and said so.** The rail's `add` slot claims no capability:
 * it draws a glyph and is named by `uiCopy.rail.slots`, and its slot→pane routing
 * is proven generically by `rail.dom.test.tsx` (a slot click chooses its pane) —
 * though **no test clicks the `add` slot id itself**, which is recorded here
 * rather than hidden.
 */
it("maps the publish surface's capability strings to controls that can run them", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      createElement(PublishControl, {
        hosting: stubHosting({
          kind: "known",
          answer: {
            lan: true,
            address: "192.168.1.5",
            port: 4174,
            refusal: null,
          },
          pairing: undefined,
          reason: undefined,
          pending: undefined,
        }),
        surface: stubSurface(),
      }),
    ),
  );

  // The header control's word names what it does, and the control that does it
  // is on the bar and pressable. A disabled control would leave the word a claim
  // about an act nothing can perform — the whole defect, not a cosmetic one.
  const trigger = host.querySelector<HTMLButtonElement>(
    "[data-vigilia-publish]",
  );
  expect(trigger).not.toBeNull();
  expect(trigger?.disabled).toBe(false);
  expect(trigger?.textContent).toContain(uiCopy.publish.start);

  // The chord is printed only because the table binds the act it prints: the
  // chip is empty the moment `publish.surface` is unbound, and what it prints is
  // the live table's own label, so a rebind reaches it.
  const chip = host.querySelector("[data-vigilia-publish-chord]");
  expect(chip?.textContent).not.toBe("");
  expect(chip?.textContent).toBe(shortcutLabel("publish.surface"));
  expect(
    PRODUCT_SHORTCUTS.some((binding) => binding.action === "publish.surface"),
  ).toBe(true);

  await act(async () => root.unmount());
  host.remove();
});
