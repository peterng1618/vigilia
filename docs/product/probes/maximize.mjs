export default async function ({ page, context }) {
  const session = await context.newCDPSession(page);
  const { windowId } = await session.send("Browser.getWindowForTarget");
  await session.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "maximized" } });
  await page.waitForTimeout(1000);
  const s = await page.evaluate(() => ({ innerW: window.innerWidth, innerH: window.innerHeight }));
  console.log("MAXIMIZED " + JSON.stringify(s));
}
