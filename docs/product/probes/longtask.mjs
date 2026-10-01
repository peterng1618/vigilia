// Quantify "the UI feels sluggish" as a number an author can be shown.
//
// Playwright's wall clock measures CDP round trips, not the page, so it is
// useless for this. The instrument that works is PerformanceObserver on
// `longtask`, which reports every main-thread block over 50 ms. Divide the total
// by the wall clock of the interaction and you get the share of the time the
// author is actually waiting — which is what "stutters" means.
//
// Copy next to cdp.mjs and run as: node cdp.mjs longtask.mjs
// Requires an element with [aria-label="<track>"] to drag. Edit LABEL to suit.
export default async function ({ page }) {
  const LABEL = process.env.PROBE_TRACK ?? "picker-saturation";

  await page.setViewportSize({ width: 2048, height: 962 });
  await page.goto("http://127.0.0.1:5311/editor", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);

  // Open whatever owns the control first — here the palette colour picker.
  await page.evaluate(() => {
    const p = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && /PALETTE/i.test(e.textContent ?? ""));
    p?.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(700);
  await page.locator("select").nth(10).selectOption({ index: 6 });
  await page.waitForTimeout(2000);
  await page.locator('button[aria-label="Pick a colour"]').click({ timeout: 8000 });
  await page.waitForTimeout(1500);

  // Install the observer, then let it run untouched across the interaction.
  await page.evaluate(() => {
    window.__long = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__long.push(Math.round(e.duration));
    }).observe({ entryTypes: ["longtask"] });
  });
  await page.waitForTimeout(500);

  const box = await page.locator(`[aria-label="${LABEL}"]`).first().boundingBox();
  if (!box) { console.log("NO_TRACK " + LABEL); return; }

  // A human cadence, not a burst: ~40 ms between moves.
  const t0 = Date.now();
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(box.x + 10 + i * 7, box.y + box.height / 2);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  const wall = Date.now() - t0;
  await page.waitForTimeout(1200);

  const lag = await page.evaluate(() => ({
    count: window.__long.length,
    durations: window.__long,
    total: window.__long.reduce((a, b) => a + b, 0),
    max: window.__long.length ? Math.max(...window.__long) : 0,
  }));
  console.log(JSON.stringify({ wallClockMs: wall, ...lag, blockedShare: Math.round((lag.total / wall) * 100) + "%" }));
}
