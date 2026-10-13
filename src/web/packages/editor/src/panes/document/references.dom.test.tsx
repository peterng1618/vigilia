// @vitest-environment jsdom
// No `createRoot` of its own: the panel is mounted through its factory, the way
// `editor-session.ts` mounts it, so the tree under test is the shipped one.

/**
 * The Document pane's References section: the document's own resolved tokens and
 * presets, read-only, and it says so before it is opened.
 *
 * Two properties are the point of the rewrite. The section is read-only **and
 * says so in its header** (§5.4 and decision 0030: absence of controls is not the
 * statement), and it re-reads `globals()` on every render, because the panel is
 * mounted for the session and a theme edit must not leave a stale copy behind.
 */
import { act } from "react";
import { afterEach, expect, it } from "vitest";
import { uiCopy } from "../../ui-copy.js";
import {
  createDocumentReferencesPanel,
  type DocumentReferencesPanel,
} from "./references.js";
import {
  EDITED_GLOBALS,
  INK_PAINT,
  REFERENCES_GLOBALS,
} from "./references-fixture.js";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let panel: DocumentReferencesPanel | undefined;

afterEach(async () => {
  if (panel !== undefined) await act(async () => panel?.destroy());
  panel = undefined;
  document.body.replaceChildren();
});

function mount(): { host: HTMLElement; setGlobals: (next: unknown) => void } {
  document.body.replaceChildren();
  const host = document.createElement("div");
  document.body.append(host);
  let current = REFERENCES_GLOBALS;
  panel = createDocumentReferencesPanel(host, {
    globals: () => current,
  });
  return {
    host,
    setGlobals: (next: unknown): void => {
      current = next as never;
    },
  };
}

/** The section itself — the header and the collapsible body both live under it. */
function section(host: HTMLElement): HTMLElement {
  const found = host.querySelector<HTMLElement>(
    '[data-vigilia-section="style"]',
  );
  if (found === null) throw new Error("no References section");
  return found;
}

function sectionHeader(host: HTMLElement): HTMLElement {
  const found = section(host).querySelector<HTMLElement>("h2");
  if (found === null) throw new Error("the References section has no header");
  return found;
}

/** The section's body, which `InspectorSection` hides rather than unmounts. */
function sectionBody(host: HTMLElement): HTMLElement {
  const found = section(host).querySelector<HTMLElement>('[id="style-panel"]');
  if (found === null) throw new Error("the References section has no body");
  return found;
}

/** Every row's hook: its label, the authored name. */
function rowLabels(body: HTMLElement): readonly (string | undefined)[] {
  return Array.from(body.querySelectorAll("[data-vigilia-resolution]")).map(
    (row) => (row as HTMLElement).dataset["vigiliaResolution"],
  );
}

it("says it is read-only in its header, before it is opened", () => {
  // §5.4 and 0030: absence of controls is not the statement, so the mark is on
  // the header of the closed section rather than inferred from the body.
  const { host } = mount();
  const header = sectionHeader(host);
  expect(header.textContent).toContain(uiCopy.inspectorFields.documentStyle);
  expect(header.textContent).toMatch(/read.only/i);
  // `InspectorSection` hides a collapsed body rather than unmounting it
  // (`inspector-section.tsx:88-93`), so "still closed" is the panel's `hidden`,
  // never the absence of its rows.
  expect(sectionBody(host).hidden).toBe(true);
});

it("lists every token and preset the document offers, and skips the none token", () => {
  const { host } = mount();
  const opened = sectionBody(host);
  // `none` is the absence of a reference, not one of them.
  expect(rowLabels(opened)).toEqual(["Ink", "Body"]);
});

it("resolves each row through the document's own globals", () => {
  const { host } = mount();
  const opened = sectionBody(host);
  const ink = opened.querySelector('[data-vigilia-resolution="Ink"]');
  expect(ink?.textContent).toContain("Ink");
  // The printed paint is the fixture's own ink, so the assertion reads the
  // value's owner rather than a second copy of it.
  expect(ink?.textContent).toContain(INK_PAINT);
  const body = opened.querySelector('[data-vigilia-resolution="Body"]');
  expect(body?.textContent).toContain("Body");
  expect(body?.textContent).toContain("Inter");
});

it("shows globals that changed after the panel mounted", () => {
  const { host, setGlobals } = mount();

  setGlobals(EDITED_GLOBALS);
  panel?.render();

  // Read on demand, so a theme edit cannot leave a stale resolution behind.
  expect(host.textContent).toContain("Accent");
});

it("renders no well and no border in the section's body", () => {
  const { host } = mount();
  // The header is itself a button by §5's own rule (`inspector-section.tsx:61`),
  // so the net is over the body — scoping it to the section would fail on the
  // disclosure that §5 requires.
  const opened = sectionBody(host);
  expect(
    opened.querySelectorAll("input, select, button, .vigilia-field"),
  ).toHaveLength(0);
});
