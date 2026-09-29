// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFailureView } from "./load-failure.js";
import { uiCopy } from "./ui-copy.js";

const DETAIL = "Could not load theme (404).";

function mount(): { readonly view: HTMLElement; readonly retry: () => void } {
  const retry = vi.fn();
  document.body.replaceChildren(loadFailureView(DETAIL, retry));
  return { view: document.querySelector<HTMLElement>("body > *")!, retry };
}

describe("the player's load-failure page", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    document.head.replaceChildren();
  });

  it("is a page with a heading, not a bare error string", () => {
    const { view } = mount();

    // It was a `<pre>` of monospace on black: the shape of a crash dump, on the
    // one surface a reader is most likely to be looking at.
    expect(view.querySelector("pre")).toBeNull();
    expect(view.querySelector("h1")?.textContent).toBe(
      uiCopy.loadFailure.title,
    );
    expect(view.textContent).toContain(uiCopy.loadFailure.lede);
  });

  it("keeps the host's own reason, labelled as a reason", () => {
    const { view } = mount();
    const reason = view.querySelector<HTMLElement>(
      "[data-vigilia-load-failure-reason]",
    );

    expect(reason?.textContent).toContain(DETAIL);
    expect(reason?.textContent).toContain(uiCopy.loadFailure.reasonLabel);
  });

  it("offers a retry that asks for the display again", () => {
    const { view, retry } = mount();
    const control = view.querySelector<HTMLButtonElement>(
      "[data-vigilia-load-failure-retry]",
    );

    // A failure with no way to try again is the stranding this fixes: a host
    // that came back leaves the reader looking at a dead screen for ever.
    expect(control?.textContent).toBe(uiCopy.loadFailure.retry);
    expect(control?.type).toBe("button");
    control?.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("leaves a route onward to the host", () => {
    const { view } = mount();
    const link = view.querySelector<HTMLAnchorElement>(
      "[data-vigilia-load-failure-host]",
    );

    // `/` on a host is its theme chooser, or whichever theme it holds: either
    // way the one place a reader can change what this display shows.
    expect(link?.textContent).toBe(uiCopy.loadFailure.host);
    expect(link?.getAttribute("href")).toBe("/");
  });

  it("gives every control an accessible name and a focus ring", () => {
    const { view } = mount();

    for (const control of view.querySelectorAll("button, a")) {
      expect((control.textContent ?? "").trim(), control.outerHTML).not.toBe(
        "",
      );
    }
    // Never `outline: none` without a replacement: the whole shell follows the
    // same rule, and a display reached by keyboard is a display a reader uses.
    expect(
      document.getElementById("vigilia-load-failure-style")?.textContent,
    ).toContain(":focus-visible");
  });

  it("carries its own stylesheet once, however many times it is built", () => {
    mount();
    mount();

    expect(
      document.querySelectorAll("#vigilia-load-failure-style"),
    ).toHaveLength(1);
  });
});
