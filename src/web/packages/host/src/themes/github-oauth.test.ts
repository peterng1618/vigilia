import { describe, expect, it } from "vitest";
import {
  fetchLogin,
  pollDeviceToken,
  requestDeviceCode,
} from "./github-oauth.js";

const DEVICE_ENDPOINT = "https://github.com/login/device/code";
const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const USER_ENDPOINT = "https://api.github.com/user";

interface Call {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

/**
 * A `typeof fetch` that answers one body and records what it was asked. The
 * record is how a test proves the request's shape — the endpoint, the form
 * fields and the `Accept` header — rather than only its parsed answer.
 */
function injectedFetch(
  body: unknown,
  status = 200,
): { readonly fetch: typeof fetch; readonly calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: typeof globalThis.fetch = async (input, init) => {
    calls.push({
      url:
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      init,
    });
    return new Response(
      typeof body === "string" ? body : JSON.stringify(body),
      {
        status,
        headers: { "content-type": "application/json" },
      },
    );
  };
  return { fetch: fetcher, calls };
}

describe("requestDeviceCode", () => {
  const DOCUMENTED = {
    device_code: "3584d83530557fdd1f46af8289938c8ef79f9dc5",
    user_code: "WDJB-MJHT",
    verification_uri: "https://github.com/login/device",
    expires_in: 900,
    interval: 5,
  };

  it("posts to GitHub's device endpoint with the public_repo scope", async () => {
    const { fetch, calls } = injectedFetch(DOCUMENTED);

    await requestDeviceCode("client-abc", { fetch });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe(DEVICE_ENDPOINT);
    expect(call.init?.method).toBe("POST");
    const form = new URLSearchParams(String(call.init?.body));
    expect(form.get("client_id")).toBe("client-abc");
    expect(form.get("scope")).toBe("public_repo");
  });

  it("asks for JSON, because GitHub's default body is form-encoded", async () => {
    const { fetch, calls } = injectedFetch(DOCUMENTED);

    await requestDeviceCode("client-abc", { fetch });

    const headers = new Headers(calls[0]!.init?.headers);
    expect(headers.get("accept")).toBe("application/json");
  });

  it("returns the documented device code", async () => {
    const { fetch } = injectedFetch(DOCUMENTED);

    await expect(requestDeviceCode("client-abc", { fetch })).resolves.toEqual({
      deviceCode: DOCUMENTED.device_code,
      userCode: DOCUMENTED.user_code,
      verificationUri: DOCUMENTED.verification_uri,
      expiresIn: DOCUMENTED.expires_in,
      interval: DOCUMENTED.interval,
    });
  });

  it("refuses a non-JSON body rather than guessing", async () => {
    const { fetch } = injectedFetch("<html>not json</html>");

    const result = await requestDeviceCode("client-abc", { fetch });

    expect(result).toHaveProperty("error");
  });

  it("refuses a body missing the device code fields", async () => {
    const { fetch } = injectedFetch({ user_code: "WDJB-MJHT" });

    const result = await requestDeviceCode("client-abc", { fetch });

    expect(result).toHaveProperty("error");
  });

  it("refuses an empty client id instead of sending it", async () => {
    const { fetch, calls } = injectedFetch(DOCUMENTED);

    const result = await requestDeviceCode("", { fetch });

    expect(result).toHaveProperty("error");
    expect(calls).toHaveLength(0);
  });

  it("refuses a zero interval or expiry instead of poll-looping", async () => {
    const zeroInterval = await requestDeviceCode("client-abc", {
      fetch: injectedFetch({ ...DOCUMENTED, interval: 0 }).fetch,
    });
    const zeroExpiry = await requestDeviceCode("client-abc", {
      fetch: injectedFetch({ ...DOCUMENTED, expires_in: 0 }).fetch,
    });

    expect(zeroInterval).toHaveProperty("error");
    expect(zeroExpiry).toHaveProperty("error");
  });

  it("refuses a verification link that is not https", async () => {
    const { fetch } = injectedFetch({
      ...DOCUMENTED,
      verification_uri: "http://github.com/login/device",
    });

    await expect(requestDeviceCode("client-abc", { fetch })).resolves.toEqual({
      error: "GitHub's device code response was incomplete.",
    });
  });
});

describe("pollDeviceToken", () => {
  const DEVICE_CODE = "3584d83530557fdd1f46af8289938c8ef79f9dc5";

  it("posts the device grant type and no client secret", async () => {
    const { fetch, calls } = injectedFetch({
      access_token: "gho_token",
      token_type: "bearer",
      scope: "public_repo",
    });

    await pollDeviceToken("client-abc", DEVICE_CODE, { fetch });

    const call = calls[0]!;
    expect(call.url).toBe(TOKEN_ENDPOINT);
    expect(call.init?.method).toBe("POST");
    const form = new URLSearchParams(String(call.init?.body));
    expect(form.get("client_id")).toBe("client-abc");
    expect(form.get("device_code")).toBe(DEVICE_CODE);
    expect(form.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:device_code",
    );
    expect(form.get("client_secret")).toBeNull();
  });

  it("asks for JSON, because GitHub's default body is form-encoded", async () => {
    const { fetch, calls } = injectedFetch({ error: "authorization_pending" });

    await pollDeviceToken("client-abc", DEVICE_CODE, { fetch });

    const headers = new Headers(calls[0]!.init?.headers);
    expect(headers.get("accept")).toBe("application/json");
  });

  it("maps authorization_pending to pending", async () => {
    const { fetch } = injectedFetch({ error: "authorization_pending" });

    await expect(
      pollDeviceToken("client-abc", DEVICE_CODE, { fetch }),
    ).resolves.toEqual({ state: "pending" });
  });

  it("maps slow_down to slow_down", async () => {
    const { fetch } = injectedFetch({ error: "slow_down" });

    await expect(
      pollDeviceToken("client-abc", DEVICE_CODE, { fetch }),
    ).resolves.toEqual({ state: "slow_down" });
  });

  it("maps access_denied to denied", async () => {
    const { fetch } = injectedFetch({ error: "access_denied" });

    await expect(
      pollDeviceToken("client-abc", DEVICE_CODE, { fetch }),
    ).resolves.toEqual({ state: "denied" });
  });

  it("maps expired_token to expired", async () => {
    const { fetch } = injectedFetch({ error: "expired_token" });

    await expect(
      pollDeviceToken("client-abc", DEVICE_CODE, { fetch }),
    ).resolves.toEqual({ state: "expired" });
  });

  it("returns the access token and its scope on success", async () => {
    const { fetch } = injectedFetch({
      access_token: "gho_token",
      token_type: "bearer",
      scope: "public_repo",
    });

    await expect(
      pollDeviceToken("client-abc", DEVICE_CODE, { fetch }),
    ).resolves.toEqual({
      state: "ok",
      accessToken: "gho_token",
      scope: "public_repo",
    });
  });

  it("refuses an unknown error instead of reporting it as pending", async () => {
    const { fetch } = injectedFetch({ error: "bad_verification_code" });

    const result = await pollDeviceToken("client-abc", DEVICE_CODE, { fetch });

    expect(result).toHaveProperty("error");
  });

  it("refuses a non-JSON body", async () => {
    const { fetch } = injectedFetch("access_token=gho_token");

    const result = await pollDeviceToken("client-abc", DEVICE_CODE, { fetch });

    expect(result).toHaveProperty("error");
  });

  it("refuses a success body with no access token", async () => {
    const { fetch } = injectedFetch({ token_type: "bearer", scope: "" });

    const result = await pollDeviceToken("client-abc", DEVICE_CODE, { fetch });

    expect(result).toHaveProperty("error");
  });
});

/**
 * The one request that carries the token to a second endpoint. What matters
 * here is that its refusals stay sentences and never echo the token, and that
 * the token travels only in the `Authorization` header.
 */
describe("fetchLogin", () => {
  const TOKEN = "gho_secret_token_value";

  it("reads the account and sends the token only in the header", async () => {
    const { fetch, calls } = injectedFetch({ login: "octocat" });

    await expect(fetchLogin(TOKEN, { fetch })).resolves.toEqual({
      login: "octocat",
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe(USER_ENDPOINT);
    expect(call.url).not.toContain(TOKEN);
    expect(call.init?.body).toBeUndefined();
    expect(new Headers(call.init?.headers).get("authorization")).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it("refuses a non-OK answer without naming the token", async () => {
    const { fetch } = injectedFetch({ message: "Bad credentials" }, 401);

    const result = await fetchLogin(TOKEN, { fetch });

    expect(result).toEqual({
      error: "GitHub refused the user request (HTTP 401).",
    });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it("refuses a body that is not JSON", async () => {
    const { fetch } = injectedFetch("<html>not json</html>");

    await expect(fetchLogin(TOKEN, { fetch })).resolves.toEqual({
      error: "GitHub answered the user request with a body that is not JSON.",
    });
  });

  it("refuses a body that is not an object", async () => {
    const { fetch } = injectedFetch([{ login: "octocat" }]);

    await expect(fetchLogin(TOKEN, { fetch })).resolves.toEqual({
      error:
        "GitHub answered the user request with a body that is not an object.",
    });
  });

  it("refuses a body with no login", async () => {
    const { fetch } = injectedFetch({ id: 1 });

    await expect(fetchLogin(TOKEN, { fetch })).resolves.toEqual({
      error: "GitHub's user response had no login.",
    });
  });

  it("refuses an unreachable endpoint without naming the token", async () => {
    const fetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof globalThis.fetch;

    const result = await fetchLogin(TOKEN, { fetch });

    expect(result).toEqual({ error: "GitHub could not be reached." });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it("refuses an empty token without sending it", async () => {
    const { fetch, calls } = injectedFetch({ login: "octocat" });

    const result = await fetchLogin("", { fetch });

    expect(result).toHaveProperty("error");
    expect(calls).toHaveLength(0);
  });
});
