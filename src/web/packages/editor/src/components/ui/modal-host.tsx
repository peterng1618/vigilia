import type * as React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

/**
 * What a modal surface calls to answer.
 *
 * `dismiss` is the answer a dismissal gives — Escape, the backdrop, or a host
 * that closes the surface — and it is `undefined`, the one value no surface can
 * choose. `close` carries the surface's own answer.
 */
export interface ModalSettle<T> {
  readonly close: (value: T) => void;
  readonly dismiss: () => void;
}

/**
 * Mounts one modal surface on a host the editor owns, and resolves with what it
 * answered.
 *
 * This is the shape the imperative dialogs had and the reason each facade keeps
 * its signature: a body-owned host is appended, the first commit is flushed
 * synchronously so a caller that reads the surface straight after opening it —
 * every owning test does — sees it rendered rather than an empty frame, and the
 * answer arrives as a promise. Focus returns to whatever was focused when the
 * surface opened, which is the menu row or command that invoked it rather than a
 * fixed control; `Base UI`'s own focus manager does the same, and this line is
 * what makes it true when the invoker is not a `Dialog.Trigger`.
 */
export function openModal<T>(
  surface: (settle: ModalSettle<T>) => React.ReactElement,
): Promise<T | undefined> {
  const host = document.createElement("div");
  document.body.append(host);
  const invoker = document.activeElement;
  const root = createRoot(host);
  let settled = false;

  return new Promise<T | undefined>((resolve) => {
    const finish = (value: T | undefined): void => {
      if (settled) return;
      settled = true;
      resolve(value);
      root.unmount();
      host.remove();
      if (invoker instanceof HTMLElement && invoker.isConnected) {
        invoker.focus();
      }
    };
    flushSync(() => {
      root.render(surface({ close: finish, dismiss: () => finish(undefined) }));
    });
  });
}
