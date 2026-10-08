import { Popover } from "@base-ui/react/popover";
import { useEffect, useState, useSyncExternalStore } from "react";
import { displayUrl } from "../hosting-client.js";
import type { PublishSwitch } from "../publish-client.js";
import { uiCopy } from "../ui-copy.js";
import { QrCode } from "./qr-symbol.js";
import type { HostingStore } from "./shell-layout.js";
import type { EditorActionFacade } from "./session-facade.js";

/**
 * The editor's one filled accent button, and behind it everything publishing
 * has to say.
 *
 * §7.1 gives the header a single primary control, so the control *is* the
 * toggle: pressing it asks the host to serve the LAN and opens the facts in one
 * gesture. The address, the code, the expiry and the §145 warning are the
 * popover's, not the bar's — the bar stops growing with the LAN, and the facts
 * are one press away rather than on screen for the whole session.
 *
 * Everything is read from the host. In the browser the editor's own URL is
 * `127.0.0.1`, so an address composed here would be an address no phone can
 * reach — and it would look right. The `HostingStore` owns the answer and this
 * control only reads it, so a second reader (Task 4's status bar) sees the same
 * one.
 *
 * The warning is bound to the button with `aria-describedby` and the popover is
 * kept mounted, because the button's own name offers to publish and a screen
 * reader otherwise reaches the action having been told nothing about the cost.
 * A refusal is shown in the host's own words for the same reason — the host is
 * the only thing that knows why a socket refused.
 */
/** The one control on this surface, so a fixed id is the whole address. */
const WARNING_ID = "vigilia-publish-warning";

export function PublishControl({
  session,
  publish,
  hosting,
}: {
  /** The open document, asked what a display would be shown. */
  readonly session?: EditorActionFacade | undefined;
  /** The transport, owned by `editor-main`. The switch turns it on and off; it
   *  never has to hand over a document to do either. */
  readonly publish?: PublishSwitch | undefined;
  /** What the host is doing, owned by the shell so the status bar reads it too. */
  readonly hosting: HostingStore;
}): React.JSX.Element | null {
  const state = useSyncExternalStore(
    hosting.subscribe,
    hosting.get,
    hosting.get,
  );
  /** What a display is showing: the document that goes out, or nothing when the
   *  library does not hold this one. */
  const [showing, setShowing] = useState<{ readonly name: string } | undefined>(
    undefined,
  );

  useEffect(() => {
    if (session === undefined) return;

    const read = (): void => {
      const document = session.publishableDocument();
      setShowing(
        document === undefined
          ? undefined
          : { name: document.envelope.metadata?.name ?? document.id },
      );
    };
    read();
    return session.subscribeDocumentChange(read);
  }, [session]);

  // Publishing follows the LAN, because that is the whole of §145's opt-in: a
  // host serving loopback has nothing to publish to, and turning the LAN off
  // takes the document back.
  const known = state.kind === "known" ? state : undefined;
  const open = known?.answer.lan === true;

  useEffect(() => {
    if (!open || publish === undefined) return;

    publish.start();
    return () => {
      void publish.stop();
    };
  }, [open, publish]);

  // Unknown is a real state, not a blank: until the host has answered the editor
  // has nothing to say. No host at all says the same nothing, for its own
  // reason. Neither is drawn as "not publishing".
  if (known === undefined) return null;

  const { answer, pairing, reason, pending } = known;
  // The address and the pairing exist only while the LAN is on, so turning it
  // off takes the URL off the screen rather than leaving a stale one behind.
  const shown =
    open && answer.address !== null && answer.port !== null && pairing !== undefined
      ? {
          address: answer.address,
          port: answer.port,
          token: pairing.token,
          expiresAt: pairing.expiresAt,
        }
      : undefined;
  const label = open
    ? uiCopy.publish.stop
    : pending === true
      ? uiCopy.publish.starting
      : uiCopy.publish.start;

  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        className="editor-shell-primary"
        data-vigilia-publish=""
        aria-pressed={open}
        aria-describedby={WARNING_ID}
        disabled={pending !== undefined}
        onClick={() => {
          void hosting.toggle();
        }}
      >
        {label}
      </Popover.Trigger>
      {/* `keepMounted`, so the warning the button is described by is in the DOM
          whether or not the popover is showing: a description that only exists
          once the choice has been made describes nothing on the way there. */}
      <Popover.Portal keepMounted>
        <Popover.Positioner
          sideOffset={6}
          align="end"
          className="editor-shell-positioner"
        >
          <Popover.Popup
            className="editor-shell-publish-popup"
            aria-label={uiCopy.publish.surface}
          >
            <span id={WARNING_ID} className="editor-shell-publish-warning">
              {uiCopy.publish.warning}
            </span>
            {reason === undefined ? null : (
              <span className="editor-shell-publish-reason" role="alert">
                {reason}
              </span>
            )}
            {/* Only once the shell has a document to read: a control drawn
                without one would say "save this theme" about no theme. */}
            {session === undefined || !open ? null : (
              <span className="editor-shell-publish-live">
                {showing === undefined
                  ? uiCopy.publish.unsaved
                  : uiCopy.publish.live(showing.name)}
              </span>
            )}
            {shown === undefined ? null : (
              <>
                <span className="editor-shell-publish-label">
                  {uiCopy.publish.address}
                </span>
                <code className="editor-shell-publish-url">{`http://${shown.address}:${shown.port}`}</code>
                <span className="editor-shell-publish-expiry">
                  {uiCopy.publish.expires(shown.expiresAt)}
                </span>
                <QrCode
                  text={displayUrl(
                    { address: shown.address, port: shown.port },
                    shown.token,
                  )}
                />
              </>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
