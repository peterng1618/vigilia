import { Popover } from "@base-ui/react/popover";
import { useEffect, useState, useSyncExternalStore } from "react";
import { displayUrl } from "../hosting-client.js";
import type { PublishSwitch } from "../publish-client.js";
import { uiCopy } from "../ui-copy.js";
import { QrCode } from "./qr-symbol.js";
import type { EditorActionFacade } from "./session-facade.js";
import type { HostingStore } from "./shell-layout.js";

/**
 * The editor's one filled accent button, and behind it everything publishing
 * has to say.
 *
 * **The button opens the surface; it is not the host switch.** §7.1 gives the
 * header one primary control and the facts live behind a press — but a control
 * that turned the LAN off when an author pressed it to read the phone address
 * would lose the fact the address exists to carry, mid-presentation. So the
 * press is free of side effects, and turning the host on and off is its own
 * control inside the popover, where the §145 warning is on screen beside it.
 *
 * Everything is read from the host. In the browser the editor's own URL is
 * `127.0.0.1`, so an address composed here would be an address no phone can
 * reach — and it would look right. The `HostingStore` owns the answer and this
 * control only reads it, so a second reader (Task 4's status bar) sees the same
 * one.
 */
/** The one control that carries the warning, so a fixed id is the whole address. */
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
    open &&
    answer.address !== null &&
    answer.port !== null &&
    pairing !== undefined
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
      {/* One name, whatever the host is doing: the control opens a surface, and
          a bar that said `Stop publishing` would be promising to stop rather
          than to show. What the host is doing is the surface's own reading. */}
      <Popover.Trigger
        type="button"
        className="editor-shell-primary"
        data-vigilia-publish=""
      >
        {uiCopy.publish.start}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          sideOffset={6}
          align="end"
          className="editor-shell-positioner"
        >
          <Popover.Popup
            className="editor-shell-publish-popup"
            aria-label={uiCopy.publish.surface}
          >
            {/* The choice the warning is about, so the warning is bound to the
                control that makes it rather than to the one that opens this. */}
            <button
              type="button"
              className="editor-shell-publish-toggle"
              data-vigilia-host-switch=""
              aria-pressed={open}
              aria-describedby={WARNING_ID}
              disabled={pending !== undefined}
              onClick={() => {
                void hosting.toggle();
              }}
            >
              {label}
            </button>
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
