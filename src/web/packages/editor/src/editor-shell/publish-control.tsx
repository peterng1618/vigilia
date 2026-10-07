import { useEffect, useState } from "react";
import { displayUrl, mintSession, readHosting } from "../hosting-client.js";
import { uiCopy } from "../ui-copy.js";
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
 */
interface Shown {
  readonly address: string;
  readonly port: number;
  readonly url: string;
  readonly expiresAt: string | undefined;
}

export function PublishControl(): React.JSX.Element | null {
  const [shown, setShown] = useState<Shown | undefined>(undefined);

  useEffect(() => {
    let live = true;

    void (async () => {
      const hosting = await readHosting();
      if (!live || hosting === undefined || !hosting.lan) return;
      if (hosting.address === null || hosting.port === null) return;

      const session = await mintSession();
      if (!live || session === undefined) return;

      setShown({
        address: hosting.address,
        port: hosting.port,
        url: displayUrl(
          { address: hosting.address, port: hosting.port },
          session.token,
        ),
        expiresAt: session.expiresAt,
      });
    })();

    return () => {
      live = false;
    };
  }, []);

  if (shown === undefined) return null;

  return (
    <div className="editor-shell-publish editor-glass" data-vigilia-publish="">
      <div className="editor-shell-publish-text">
        <span className="editor-shell-publish-label">
          {uiCopy.publish.address}
        </span>
        <code className="editor-shell-publish-url">{`http://${shown.address}:${shown.port}`}</code>
        <span className="editor-shell-publish-warning">
          {uiCopy.publish.warning}
        </span>
        {shown.expiresAt === undefined ? null : (
          <span className="editor-shell-publish-expiry">
            {uiCopy.publish.expires(shown.expiresAt)}
          </span>
        )}
      </div>
      <QrCode text={shown.url} />
    </div>
  );
}
