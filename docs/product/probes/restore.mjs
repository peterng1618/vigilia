// Reset the test library to the pristine Starter by re-saving from the editor,
// which is the cheapest reset there is. Verify afterwards.
export default async function ({ page }) {
  await page.setViewportSize({ width: 2048, height: 962 });
  await page.goto("http://127.0.0.1:5311/editor", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("menuitem", { name: "Save to library" }).click();
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape");
  const d = await page.evaluate(async () => {
    const j = await (await fetch("/api/themes")).json();
    const r = await fetch(`/api/themes/${j.themes[0].id}/document`);
    const doc = await r.json();
    const objs = doc.scene?.objects ?? [];
    const names = objs.map((o) => o.name);
    return {
      count: objs.length,
      frost: doc.globals.palette.frost,
      art: doc.artboard.width + "x" + doc.artboard.height,
      dangling: Object.keys(doc.bindings ?? {}).filter((k) => !names.includes(k)),
    };
  });
  console.log("RESTORED " + JSON.stringify(d));
}
