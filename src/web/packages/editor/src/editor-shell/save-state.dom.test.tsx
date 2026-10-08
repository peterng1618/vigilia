// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { SaveState } from "./save-state.js";
import type { EditorActionFacade } from "./session-facade.js";

/** Only what the mark reads. The session owns the answer; a stub here would be
 *  a second implementation of it. */
function stubSession(dirty: () => boolean): {
  readonly facade: EditorActionFacade;
  announce(): void;
} {
  const listeners = new Set<() => void>();
  return {
    facade: {
      isDirty: dirty,
      subscribeDocumentChange: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    } as unknown as EditorActionFacade,
    announce: () => {
      for (const listener of listeners) listener();
    },
  };
}

describe("the unsaved mark", () => {
  let host: HTMLDivElement | undefined;

  afterEach(() => {
    host?.remove();
    host = undefined;
  });

  function mount(session: EditorActionFacade): HTMLDivElement {
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(<SaveState session={session} />));
    return host;
  }

  it("says nothing until the document differs from what was saved", () => {
    // The failure this row records: an author renames the theme and types a
    // rectangle, and nothing on the page says a thing is pending. Red without
    // the mark — the footer reads empty in both states.
    let saved = true;
    const session = stubSession(() => !saved);
    const host = mount(session.facade);
    const mark = (): Element | null =>
      host.querySelector(".editor-shell-save-state");

    expect(mark()?.textContent).toBe("");

    saved = false;
    act(() => session.announce());
    expect(mark()?.textContent).toBe("Unsaved changes");

    saved = true;
    act(() => session.announce());
    expect(mark()?.textContent).toBe("");
  });
});
