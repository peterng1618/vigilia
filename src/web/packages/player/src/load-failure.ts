import { uiCopy } from "./ui-copy.js";

/**
 * The page a reader gets when the theme would not load.
 *
 * The one failure the player owns, and the only one that replaces the whole
 * display — so it is a page and not a strip. It was a `<pre>` of monospace red
 * on black, which told a reader the load failed and then stopped: no retry, no
 * link, no way back to a screen showing anything at all. A host that came back
 * five seconds later left the reader looking at a dead screen for ever.
 *
 * Both ways on are here, and they are the two a reader actually has: ask again
 * (a host restarting, a network that blipped) and go to the host (the wrong id,
 * or the wrong theme). The host's own reason is kept, labelled, because the
 * person who fixes this is not looking at a phone.
 *
 * `retry` is passed rather than taken, so this module decides what the page
 * *says* and the caller owns what the browser does.
 */
export function loadFailureView(
  detail: string,
  retry: () => void,
): HTMLElement {
  styleOnce();

  const view = document.createElement("section");
  view.dataset["vigiliaLoadFailure"] = "";
  // The whole surface is the message, and it is the only thing on the screen.
  // A landmark keeps it reachable by keyboard and by a screen reader's rotor
  // without inventing a heading level below the one below.
  view.setAttribute("aria-label", uiCopy.loadFailure.title);

  const heading = document.createElement("h1");
  heading.textContent = uiCopy.loadFailure.title;

  const lede = document.createElement("p");
  lede.textContent = uiCopy.loadFailure.lede;

  const reason = document.createElement("p");
  reason.dataset["vigiliaLoadFailureReason"] = "";
  reason.textContent = `${uiCopy.loadFailure.reasonLabel}: ${detail}`;

  const again = document.createElement("button");
  again.type = "button";
  again.dataset["vigiliaLoadFailureRetry"] = "";
  again.textContent = uiCopy.loadFailure.retry;
  again.addEventListener("click", retry);

  // A link is the only control here that leaves the display, so it is styled
  // like text and told apart by its underline rather than by a box that would
  // read as a second button — the host's own pages already draw it that way.
  const host = document.createElement("a");
  host.dataset["vigiliaLoadFailureHost"] = "";
  host.href = "/";
  host.textContent = uiCopy.loadFailure.host;

  const actions = document.createElement("div");
  actions.append(again, host);

  view.append(heading, lede, reason, actions);
  return view;
}

const STYLE_ID = "vigilia-load-failure-style";

/**
 * The host's `firstRunPage` is the same product answering the same question on
 * a different surface — "there is nothing to show, here is what to do" — so it
 * is the same colours, the same measure and the same pill. A reader who has
 * seen one has seen the other.
 *
 * `justify-content: safe center` rather than plain `center`: a centred flex
 * column clips its own first line on a display shorter than its content, and
 * this is the one page on the player that has no artboard behind it to scroll.
 */
const STYLE = `
[data-vigilia-load-failure] {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: safe center;
  gap: 0;
  box-sizing: border-box;
  padding: 24px;
  /* The player sets viewport-fit=cover, so a notched phone's home indicator
     sits inside this padding. */
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  overflow: auto;
  background: #14161c;
  color: #e8ecf3;
  font: 15px / 1.6 system-ui, sans-serif;
  text-align: center;
}
[data-vigilia-load-failure] h1 {
  font-size: 22px;
  letter-spacing: 0.02em;
  margin: 0 0 8px;
}
[data-vigilia-load-failure] p {
  color: #8a97ab;
  margin: 0 0 20px;
  max-width: 34em;
}
[data-vigilia-load-failure] [data-vigilia-load-failure-reason] {
  color: #b5c6c0;
  font: 12px / 1.5 ui-monospace, monospace;
  /* A long validator message on a 360px phone must wrap, not widen. */
  overflow-wrap: anywhere;
}
[data-vigilia-load-failure] > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px 20px;
}
[data-vigilia-load-failure] [data-vigilia-load-failure-retry] {
  display: inline-block;
  padding: 12px 22px;
  border: 0;
  border-radius: 8px;
  background: #e8ecf3;
  color: #14161c;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
[data-vigilia-load-failure] [data-vigilia-load-failure-host] {
  color: inherit;
  text-underline-offset: 3px;
}
[data-vigilia-load-failure] :where(button, a):focus-visible {
  outline: 2px solid #e8ecf3;
  outline-offset: 2px;
}
`;

function styleOnce(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.append(style);
}
