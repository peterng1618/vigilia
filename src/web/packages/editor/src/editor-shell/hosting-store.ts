import {
  type HostingAnswer,
  mintSession,
  readHosting,
  setLan,
} from "../hosting-client.js";

/** What the shell knows about the host behind it, and the one place that answers
 *  "is this editor publishing".
 *
 *  `unknown` is the initial state and a real one: until the host has answered,
 *  the editor has nothing to say about publishing, and a reader that treated it
 *  as "not live" would be inventing a fact. `absent` is a build with no host at
 *  all — the same silence, for a different reason. */
export type HostingSnapshot =
  | { readonly kind: "unknown" }
  | { readonly kind: "absent" }
  | {
      readonly kind: "known";
      readonly answer: HostingAnswer;
      /** The credential a phone pairs with, which is not the editor session. */
      readonly pairing: HostingAnswer["session"] | undefined;
      /** A refusal, in the host's own words. */
      readonly reason: string | undefined;
      /** The state a toggle is asking for, while the host is deciding. */
      readonly pending: boolean | undefined;
    };

/** The host's answer, owned outside React: the header's control and Task 4's
 *  status bar read one subscription rather than each asking the host. Unknown
 *  until the host answers, and it renders no claim until then. */
export class HostingStore {
  #snapshot: HostingSnapshot = { kind: "unknown" };
  readonly #listeners = new Set<() => void>();

  /** The host is asked once, here, so every reader — the header's control and
   *  Task 4's status bar — shares one answer rather than each asking. */
  constructor() {
    void this.read();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly get = (): HostingSnapshot => this.#snapshot;

  #emit(next: HostingSnapshot): void {
    this.#snapshot = next;
    for (const listener of this.#listeners) listener();
  }

  /** The host's first answer. An unread host is `absent`, not "not live". A
   *  build with no `fetch` at all reaches the same place, which is why this
   *  catches rather than letting the constructor's promise reject unhandled. */
  async read(): Promise<void> {
    try {
      const answer = await readHosting();
      if (answer === undefined) {
        this.#emit({ kind: "absent" });
        return;
      }
      this.#emit({
        kind: "known",
        answer,
        pairing: answer.lan ? await mintSession() : undefined,
        reason: undefined,
        pending: undefined,
      });
    } catch {
      this.#emit({ kind: "absent" });
    }
  }

  /** Turns the LAN on or off, and reads where the host landed.
   *
   *  A `200` means the host accepted the request, not that it moved: it answers
   *  first and rebinds afterwards, so the state it asked for — and a refusal, if
   *  it made one — is on the read that follows rather than in the PUT's body. */
  async toggle(): Promise<void> {
    const current = this.#snapshot;
    if (current.kind !== "known") return;
    const wanted = !current.answer.lan;
    this.#emit({ ...current, pending: wanted, reason: undefined });

    const outcome = await setLan(wanted);
    if (!outcome.ok) {
      // The host is the only thing that knows where its binding ended up: a
      // refusal restores the old one, which is not necessarily where the button
      // was pointing.
      const now = await readHosting();
      const answer = now ?? current.answer;
      this.#emit({
        kind: "known",
        answer,
        pairing: answer.lan ? current.pairing : undefined,
        reason: outcome.reason,
        pending: undefined,
      });
      return;
    }

    const { answer } = outcome;
    this.#emit({
      kind: "known",
      answer,
      pairing: answer.lan ? await mintSession() : undefined,
      reason: answer.refusal ?? undefined,
      pending: undefined,
    });
  }
}
