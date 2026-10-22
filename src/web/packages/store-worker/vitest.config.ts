import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// 0.23.0 replaced the old `defineWorkersConfig` from `/config` with this Vite
// plugin; the pool is now installed as a plugin rather than test.poolOptions.
export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            TEST_MODE: "1",
            MIGRATE_TOKEN: "test-migrate",
            BETTER_AUTH_SECRET: "test-secret",
            OWNER_EMAILS: "owner@example.com",
            R2_ACCOUNT_ID: "test-account",
            R2_ACCESS_KEY_ID: "test-access-key",
            R2_SECRET_ACCESS_KEY: "test-secret-key",
            R2_BUCKET_NAME: "yunari-store-packages",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./tests/apply-migrations.ts"],
    },
  };
});
