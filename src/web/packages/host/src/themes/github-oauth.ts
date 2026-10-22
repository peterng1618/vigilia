/**
 * GitHub's device authorization flow, as a client the host calls before a
 * submission. The host runs locally and cannot keep a client secret, so this is
 * the only OAuth flow available to it, and the token it returns is the whole
 * result. See docs/decisions/0090.
 */

export interface DeviceCode {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly expiresIn: number;
  readonly interval: number;
}

export type DeviceOutcome =
  | { readonly state: "pending" }
  | { readonly state: "slow_down" }
  | { readonly state: "denied" }
  | { readonly state: "expired" }
  | {
      readonly state: "ok";
      readonly accessToken: string;
      readonly scope: string;
    };

export interface DeviceOptions {
  /** Injected so a unit test drives this without a network. */
  readonly fetch?: typeof fetch;
}

const DEVICE_ENDPOINT = "https://github.com/login/device/code";
const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const USER_ENDPOINT = "https://api.github.com/user";
const SCOPE = "public_repo";
const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

type Body = Record<string, unknown>;

type Answer =
  | { readonly parsed: Body; readonly status: number }
  | { readonly error: string };

export async function requestDeviceCode(
  clientId: string,
  options?: DeviceOptions,
): Promise<DeviceCode | { readonly error: string }> {
  if (clientId.trim() === "") return refuse("An OAuth client id is required.");

  const answer = await post(
    DEVICE_ENDPOINT,
    { client_id: clientId, scope: SCOPE },
    options?.fetch ?? fetch,
  );
  if ("error" in answer) return { error: answer.error };

  if (answer.status >= 400) return refuse(describe(answer));

  const body = answer.parsed;
  const deviceCode = asText(body["device_code"]);
  const userCode = asText(body["user_code"]);
  // The editor draws this as a link, so only an `https://` URL is a usable
  // answer; anything else refuses the flow rather than being rendered.
  const verificationUri = asHttpsUrl(body["verification_uri"]);
  const expiresIn = asCount(body["expires_in"]);
  const interval = asCount(body["interval"]);
  if (
    deviceCode === undefined ||
    userCode === undefined ||
    verificationUri === undefined ||
    expiresIn === undefined ||
    interval === undefined
  )
    return refuse("GitHub's device code response was incomplete.");

  return { deviceCode, userCode, verificationUri, expiresIn, interval };
}

export async function pollDeviceToken(
  clientId: string,
  deviceCode: string,
  options?: DeviceOptions,
): Promise<DeviceOutcome | { readonly error: string }> {
  if (clientId.trim() === "") return refuse("An OAuth client id is required.");
  if (deviceCode.trim() === "")
    return refuse("A device code is required to poll.");

  const answer = await post(
    TOKEN_ENDPOINT,
    {
      client_id: clientId,
      device_code: deviceCode,
      grant_type: DEVICE_GRANT,
    },
    options?.fetch ?? fetch,
  );
  if ("error" in answer) return { error: answer.error };

  const body = answer.parsed;
  const accessToken = asText(body["access_token"]);
  if (accessToken !== undefined) {
    // A token is success even on an error status; the token is what was asked
    // for. RFC 6749 makes `scope` optional when it equals what was requested.
    return {
      state: "ok",
      accessToken,
      scope: asText(body["scope"]) ?? SCOPE,
    };
  }

  switch (asText(body["error"])) {
    case "authorization_pending":
      return { state: "pending" };
    case "slow_down":
      return { state: "slow_down" };
    case "access_denied":
      return { state: "denied" };
    case "expired_token":
      return { state: "expired" };
    case undefined:
      return refuse(describe(answer));
    default:
      // An unrecognised error is not a pending poll: reporting it as one would
      // keep the caller waiting on a code GitHub has already rejected.
      return refuse(`GitHub refused the device token: ${body["error"]}.`);
  }
}

/**
 * The account a token acts as, which is the only thing the browser is told.
 *
 * The token is never put into a refusal: this message travels to the editor,
 * and a token in an error is a token in a log.
 */
export async function fetchLogin(
  accessToken: string,
  options?: DeviceOptions,
): Promise<{ readonly login: string } | { readonly error: string }> {
  if (accessToken.trim() === "")
    return refuse("A token is required to read the account.");

  let response: Response;
  try {
    response = await (options?.fetch ?? fetch)(USER_ENDPOINT, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    return refuse("GitHub could not be reached.");
  }

  if (!response.ok)
    return refuse(`GitHub refused the user request (HTTP ${response.status}).`);

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return refuse(
      "GitHub answered the user request with a body that is not JSON.",
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return refuse(
      "GitHub answered the user request with a body that is not an object.",
    );

  const login = asText((parsed as Body)["login"]);
  if (login === undefined || login === "")
    return refuse("GitHub's user response had no login.");

  return { login };
}

async function post(
  endpoint: string,
  fields: Record<string, string>,
  fetcher: typeof fetch,
): Promise<Answer> {
  try {
    const response = await fetcher(endpoint, {
      method: "POST",
      // GitHub's documented default is form-encoded; JSON is opt-in per request.
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(fields),
    });
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        error: `GitHub answered ${endpoint} with a body that is not JSON.`,
      };
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return {
        error: `GitHub answered ${endpoint} with a body that is not an object.`,
      };
    return { parsed: parsed as Body, status: response.status };
  } catch {
    return { error: "GitHub could not be reached." };
  }
}

function describe(answer: { readonly parsed: Body; readonly status: number }) {
  const code = asText(answer.parsed["error"]);
  return code === undefined
    ? `GitHub refused the request (HTTP ${answer.status}).`
    : `GitHub answered: ${code}.`;
}

/** A string, including the empty one, or nothing. Never a coercion. */
function asText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** A positive integer. GitHub's `expires_in` and `interval` are seconds, and a
 *  zero of either would poll in a tight loop or start already over. */
function asCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

/** An `https://` URL, or nothing. The one shape a browser is handed as a link. */
function asHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

function refuse(message: string): { readonly error: string } {
  return { error: message };
}
