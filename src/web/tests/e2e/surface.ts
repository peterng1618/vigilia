import type { TestInfo } from "@playwright/test";

/**
 * Whether this run is on a desktop surface.
 *
 * The editor and the host's pages are desktop-only, and their tests say so by
 * skipping on a phone. Reading that from the project *name* would tie the
 * question to how the projects happen to be split, so a surface that spans more
 * than one project — the host has its own, to keep its shared stores serial —
 * would silently skip every one of its tests. The convention is the prefix: a
 * phone project is named `phone-*`, everything else is a desktop.
 */
export function isDesktopSurface(testInfo: TestInfo): boolean {
  return !testInfo.project.name.startsWith("phone");
}
