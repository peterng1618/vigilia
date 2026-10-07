import { useEffect, useState } from "react";
import {
  displayUrl,
  type HostingAnswer,
  mintSession,
  readHosting,
  setLan,
} from "../hosting-client.js";
import type { PublishSwitch } from "../publish-client.js";
import { uiCopy } from "../ui-copy.js";
import type { EditorActionFacade } from "./session-facade.js";
// `qr-symbol`, not `qr-code`: `./qr-code.js` is the encoder, and a
// same-basename `.tsx` beside it is unreachable under `moduleResolution:
// bundler` — it resolves to the `.ts` and yields `undefined`, not an error.
import { QrCode } from "./qr-symbol.js";

/**
 * Where the phone should go, in the header, because that is where §6 puts it:
 * publishing answers one question, and the answer is an address and a code.
 *
 * Everything is read from the host. In the browser the editor's own URL is
 * `127.0.0.1`, so an address composed here would be an address no phone can
 * reach — and it would look right.
 *
 * This is the only place in the product that turns the LAN on, so it is the
 * place §145's warning has to be a sentence rather than a tooltip: it is on the
 * surface whenever the choice is, and `aria-describedby` binds it to the button,
 * because the button's own name offers to publish and a screen reader otherwise
 * reaches the action having been told nothing about the cost. A refusal is shown
 * in the host's own words for the same reason — the host is the only thing that
 * knows why a socket refused.
 */
/** The one control on this surface, so a fixed id is the whole address. */
const WARNING_ID = "vigilia-publish-warning";

export function PublishControl({
  session,
  publish,
}: {
  /** The open document, asked what a display would be shown. */
  readonly session?: EditorActionFacade | undefined;
  /** The transport, owned by `editor-main`. The switch turns it on and off; it
   *  never has to hand over a document to do either. */
  readonly publish?: PublishSwitch | undefined;
}): React.JSX.Element | null {
  const [hosting, setHosting] = useState<HostingAnswer | undefined>(undefined);
  /** The credential a phone pairs with, which is not the editor session. */
  const [pairing, setPairing] = useState<HostingAnswer["session"]>(undefined);
  const [reason, setReason] = useState<string | undefined>(undefined);
  /** The state a toggle is asking for, while the host is deciding. */
  const [pending, setPending] = useState<boolean | undefined>(undefined);
  /** What a display is showing: the document that goes out, or nothing when the
   *  library does not hold this one. */
  const [showing, setShowing] = useState<{ readonly name: string } | undefined>(
    undefined,
  );
  // Publishing follows the LAN, because that is the whole of §145's opt-in: a
  // host serving loopback has nothing to publish to, and turning the LAN off
  // takes the document back.
  const open = hosting?.lan === true;

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

  useEffect(() => {
    if (!open || publish === undefined) return;

    publish.start();
    return () => {
      void publish.stop();
    };
  }, [open, publish]);

  useEffect(() => {
    let live = true;

    void (async () => {
      const answer = await readHosting();
      if (!live || answer === undefined) return;
      setHosting(answer);
      if (!answer.lan) return;

      const minted = await mintSession();
      if (!live || minted === undefined) return;
      setPairing(minted);
    })();

    return () => {
      live = false;
    };
  }, []);

  async function toggle(): Promise<void> {
    if (hosting === undefined) return;
    const wanted = !hosting.lan;
    setPending(wanted);
    setReason(undefined);

    const outcome = await setLan(wanted);
    setPending(undefined);

    if (!outcome.ok) {
      setReason(outcome.reason);
      // The host is the only thing that knows where its binding ended up: a
      // refusal restores the old one, which is not necessarily where the
      // button was pointing.
      const now = await readHosting();
      if (now === undefined) return;
      setHosting(now);
      if (!now.lan) setPairing(undefined);
      return;
    }

    setHosting(outcome.answer);

    // The host answers a move before it makes it, so a refusal arrives here —
    // on the read that follows — rather than in the answer to the PUT.
    if (outcome.answer.refusal !== null) setReason(outcome.answer.refusal);

    if (!outcome.answer.lan) {
      setPairing(undefined);
      return;
    }

    setPairing(await mintSession());
  }

  // No host behind the editor: there is nothing to offer, so nothing is drawn.
  if (hosting === undefined) return null;

  // The address and the pairing exist only while the LAN is on, so turning it
  // off takes the URL off the screen rather than leaving a stale one behind.
  const shown =
    open &&
    hosting.address !== null &&
    hosting.port !== null &&
    pairing !== undefined
      ? {
          address: hosting.address,
          port: hosting.port,
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
    <div className="editor-shell-publish editor-glass" data-vigilia-publish="">
      <div className="editor-shell-publish-text">
        <button
          type="button"
          className="editor-shell-publish-toggle"
          aria-pressed={open}
          aria-describedby={WARNING_ID}
          disabled={pending !== undefined}
          onClick={() => {
            void toggle();
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
        {/* Only once the shell has a document to read: a control drawn without
            one would say "save this theme" about no theme. */}
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
          </>
        )}
      </div>
      {shown === undefined ? null : (
        <QrCode
          text={displayUrl(
            { address: shown.address, port: shown.port },
            shown.token,
          )}
        />
      )}
    </div>
  );
}
