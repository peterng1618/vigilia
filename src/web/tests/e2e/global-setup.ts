import { seedHostTheme } from "./host-theme.js";

/**
 * Seeds the host fixture once, before any worker starts.
 *
 * This cannot live in `playwright.config.ts`: Playwright loads the config in
 * every worker process too, so seeding there ran once per worker. Four workers
 * raced on the same `rmSync`, and two of them throwing `ENOTEMPTY` was the
 * harmless half — the other half is that a worker starting late re-seeded
 * *mid-suite*, wiping `active-theme.json` out from under a host test that was
 * reading it. `workers: 1` hid both.
 *
 * It also has to finish before the host web server boots, since the host reads
 * its themes directory at startup and serves what it found there.
 */
export default async function globalSetup(): Promise<void> {
  await seedHostTheme();
}
