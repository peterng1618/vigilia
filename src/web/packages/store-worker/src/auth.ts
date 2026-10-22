import type { Auth, BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { bearer, oneTimeToken, testUtils } from "better-auth/plugins";
import type { Env } from "./env.js";

/**
 * Better Auth's configuration, built fresh per call: the instance is options
 * plus lazy adapters, and the brief rules out a session cache.
 *
 * The options are widened to `BetterAuthOptions` because the inferred return
 * type otherwise names a zod helper better-auth does not export.
 *
 * `testUtils` is only constructed when the harness sets TEST_MODE, so no
 * production binding can turn it on.
 */
export function createAuth(env: Env): Auth {
  const options: BetterAuthOptions = {
    database: env.DB,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    plugins:
      env.TEST_MODE === "1"
        ? [bearer(), oneTimeToken(), testUtils()]
        : [bearer(), oneTimeToken()],
  };
  return betterAuth(options);
}
