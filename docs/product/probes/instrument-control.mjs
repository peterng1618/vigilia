// Prove the instrument can see the thing before believing its absence.
//
// This is the shape that produced a false finding twice on this pass: a native
// prompt auto-dismissed by Playwright looks exactly like a dead command, and a
// stale page against a restarted host looks exactly like a broken product. Both
// times the honest move was to install the thing myself and confirm the probe
// fires — only then does the app's silence mean absence.
//
// Here the control is a beforeunload handler. Run it against any page; if a
// dialog of type "beforeunload" appears, the harness CAN see one, so an editor
// that produces none genuinely has none.
//
// Copy next to cdp.mjs and run as: node cdp.mjs instrument-control.mjs
export default async function ({ page, seenDialogs }) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:5311/editor", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  // A real user gesture first — Chromium gates beforeunload on it.
  await page.mouse.click(700, 400);
  await page.waitForTimeout(300);

  // CONTROL: install the handler we want to see the product install.
  await page.evaluate(() => {
    window.addEventListener("beforeunload", (e) => { e.preventDefault(); e.returnValue = ""; });
  });
  await page.waitForTimeout(300);

  seenDialogs.length = 0;
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2500);

  console.log(JSON.stringify({
    dialogs: seenDialogs,
    verdict: seenDialogs.some((d) => d.type === "beforeunload")
      ? "HARNESS CAN SEE beforeunload — an absent one is a real absence"
      : "HARNESS CANNOT SEE beforeunload — absence is unmeasurable here, say so",
  }));
}
