import { applyD1Migrations, env } from "cloudflare:test";
import type { Env as WorkerEnv } from "../src/env";

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {}
  }
}

const migrations = env.TEST_MIGRATIONS;
if (!migrations) {
  throw new Error("TEST_MIGRATIONS binding is not configured by vitest.config.ts");
}
await applyD1Migrations(env.DB, migrations);
