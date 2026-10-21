import { useEffect, useRef, useState } from "react";
import { uiCopy } from "../ui-copy.js";
import type { StoreItem } from "./local-source.js";

const SUBMIT_PATH = "/api/themes/submit";
const DEVICE_PATH = "/api/github/device";
const POLL_PATH = "/api/github/device/poll";

export type SubmitState =
  | "idle"
  | "authorising"
  | "submitting"
  | "submitted"
  | "refused";

/**
 * What the modal's Submit control needs from the region that owns the press:
 * the action, the state it is in, the code and link a sign-in asks the author
 * for, and the pull request or refusal the host answered.
 */
export interface SubmitControl {
  readonly onSubmit: (item: StoreItem) => void;
  readonly state: SubmitState;
  readonly userCode: string | undefined;
  readonly verificationUri: string | undefined;
  readonly url: string | undefined;
  readonly refusal: string | undefined;
}

/** What the host answers when it starts a device flow. */
interface DeviceFlow {
  readonly userCode: string;
  readonly verificationUri: string;
  readonly expiresIn: number;
  readonly interval: number;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The answer as an object, or nothing where it is not one. */
function jsonOf(text: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The three facts a flow is, or nothing. **A missing or wrong field refuses the
 * flow rather than being coerced**: an interval of zero would poll in a tight
 * loop and an expiry of zero would start the poll already over.
 */
function flowOf(
  value: Record<string, unknown> | undefined,
): DeviceFlow | undefined {
  if (value === undefined) return undefined;
  const { userCode, verificationUri, expiresIn, interval } = value;
  if (typeof userCode !== "string" || userCode === "") return undefined;
  if (typeof verificationUri !== "string" || verificationUri === "")
    return undefined;
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn))
    return undefined;
  if (expiresIn <= 0) return undefined;
  if (typeof interval !== "number" || !Number.isFinite(interval))
    return undefined;
  if (interval <= 0) return undefined;
  return { userCode, verificationUri, expiresIn, interval };
}

/**
 * The library half's submission, and the sentence a screen reader hears for it.
 *
 * It posts the theme's id and nothing else: the host reads the theme, builds the
 * package and opens the pull request as the author's GitHub account. **The
 * browser never receives a token** — a missing identity starts the device flow,
 * whose only facts here are the one-time code and where to type it.
 *
 * **Every timer is cleared on a terminal state and on unmount**, and every
 * continuation checks that the hook is still mounted: a poll that fires after
 * the modal closed has no surface to answer.
 */
export function useSubmit(options: { readonly fetch?: typeof fetch }): {
  readonly control: SubmitControl;
  readonly announcement: string;
} {
  const [state, setState] = useState<SubmitState>("idle");
  const [userCode, setUserCode] = useState<string | undefined>(undefined);
  const [verificationUri, setVerificationUri] = useState<string | undefined>(
    undefined,
  );
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [refusal, setRefusal] = useState<string | undefined>(undefined);

  /** The guard a second press meets before any state has committed. */
  const busy = useRef(false);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = undefined;
    };
  }, []);

  function clearTimer(): void {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  }

  function post(path: string, body: unknown): Promise<Response> {
    // Bound at press time rather than at mount, so a case that replaces the
    // transport sees this press. A host with no `fetch` rejects into the same
    // refusal path as a network failure.
    const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
    return fetcher(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  /** The host's sentence, or the one sentence that is this surface's own: a
   *  refusal leaves the control pressable so the author can act on it. */
  function refuse(message: string): void {
    clearTimer();
    busy.current = false;
    setState("refused");
    setRefusal(message);
    setUserCode(undefined);
    setVerificationUri(undefined);
  }

  function schedule(id: string, seconds: number, deadline: number): void {
    if (!alive.current) return;
    clearTimer();
    // The last poll fires at the flow's own expiry rather than past it.
    const remaining = Math.max(0, deadline - Date.now());
    timer.current = setTimeout(
      () => void poll(id, seconds, deadline),
      Math.min(seconds * 1000, remaining),
    );
  }

  async function poll(
    id: string,
    seconds: number,
    deadline: number,
  ): Promise<void> {
    if (!alive.current) return;
    if (Date.now() > deadline) {
      refuse(uiCopy.store.submit.expired);
      return;
    }
    let answered: Response;
    try {
      answered = await post(POLL_PATH, {});
    } catch (error) {
      refuse(messageOf(error));
      return;
    }
    const text = await answered.text().catch(() => "");
    if (!answered.ok) {
      refuse(text);
      return;
    }
    if (!alive.current) return;
    const signIn = jsonOf(text)?.["state"];
    if (signIn === "pending") {
      schedule(id, seconds, deadline);
      return;
    }
    if (signIn === "slow_down") {
      schedule(id, seconds + 5, deadline);
      return;
    }
    if (signIn === "ok") {
      // The identity is stored; the submission it was missing is retried once.
      await attempt(id);
      return;
    }
    refuse(
      signIn === "denied"
        ? uiCopy.store.submit.denied
        : signIn === "expired"
          ? uiCopy.store.submit.expired
          : text,
    );
  }

  async function authorise(id: string): Promise<void> {
    let answered: Response;
    try {
      answered = await post(DEVICE_PATH, {});
    } catch (error) {
      refuse(messageOf(error));
      return;
    }
    const text = await answered.text().catch(() => "");
    if (!answered.ok) {
      // A `503` names the missing registration in the host's own words.
      refuse(text);
      return;
    }
    if (!alive.current) return;
    const flow = flowOf(jsonOf(text));
    if (flow === undefined) {
      refuse(text);
      return;
    }
    setUserCode(flow.userCode);
    setVerificationUri(flow.verificationUri);
    setState("authorising");
    schedule(id, flow.interval, Date.now() + flow.expiresIn * 1000);
  }

  async function attempt(id: string): Promise<void> {
    if (!alive.current) return;
    setState("submitting");
    let answered: Response;
    try {
      answered = await post(SUBMIT_PATH, { id });
    } catch (error) {
      refuse(messageOf(error));
      return;
    }
    const text = await answered.text().catch(() => "");
    // **`401` is the one status that is not a refusal**: it says the host has
    // no identity, which the device flow can supply.
    if (answered.status === 401) {
      await authorise(id);
      return;
    }
    if (!alive.current) return;
    if (!answered.ok) {
      refuse(text);
      return;
    }
    const prUrl = jsonOf(text)?.["url"];
    if (typeof prUrl !== "string" || prUrl === "") {
      // A `200` with no link is not a pull request this surface may claim.
      refuse(text);
      return;
    }
    clearTimer();
    busy.current = false;
    setState("submitted");
    setUrl(prUrl);
    setRefusal(undefined);
    setUserCode(undefined);
    setVerificationUri(undefined);
  }

  const onSubmit = (item: StoreItem): void => {
    if (busy.current) return;
    busy.current = true;
    clearTimer();
    setState("submitting");
    setRefusal(undefined);
    setUrl(undefined);
    setUserCode(undefined);
    setVerificationUri(undefined);
    void attempt(item.id);
  };

  const announcement =
    state === "refused"
      ? (refusal ?? "")
      : state === "authorising" && userCode !== undefined
        ? uiCopy.store.submit.authorising(userCode)
        : state === "submitted"
          ? uiCopy.store.submit.submitted
          : "";

  return {
    control: { onSubmit, state, userCode, verificationUri, url, refusal },
    announcement,
  };
}
