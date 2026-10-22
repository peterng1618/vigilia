/** Bindings the Worker sees; secrets are `wrangler secret put` values, never
 *  `[vars]` entries. The two optional fields exist only under the test harness. */
export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  BETTER_AUTH_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  OWNER_EMAILS: string;
  MIGRATE_TOKEN: string;
  TEST_MODE?: string;
  /** `readD1Migrations` output, injected by vitest.config.ts. */
  TEST_MIGRATIONS?: { name: string; queries: string[] }[];
}
