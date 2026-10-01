// Compare what the host stored against what the editor is showing.
//
// This is the highest-yield probe on the product. Every worst defect found by
// hand was exactly this disagreement: the document said one thing and three
// surfaces of the UI said another. Saving is part of the probe — several
// disagreements are invisible until the write, because the UI reads the live
// scene while the document reads the last serialisation.
//
// Reads the theme by id rather than "the current one", so it does not care
// which theme the editor happens to have open.
//
// Copy next to cdp.mjs and run as: node cdp.mjs document-vs-ui.mjs
export default async function ({ page }) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.setViewportSize({ width: 2048, height: 962 });
  await page.goto("http://127.0.0.1:5311/editor", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);

  // Whatever the author just did, persist it before comparing.
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole("menuitem", { name: "Save to library" }).click();
  await page.waitForTimeout(2800);
  await page.keyboard.press("Escape");

  const truth = await page.evaluate(async () => {
    const j = await (await fetch("/api/themes")).json();
    const r = await fetch(`/api/themes/${j.themes[0].id}/document`);
    const d = await r.json();
    const objects = d.scene?.objects ?? [];
    const names = objects.map((o) => o.name);
    return {
      id: j.themes[0].id,
      count: objects.length,
      artboard: `${d.artboard.width}x${d.artboard.height}`,
      // The three disagreements worth checking every time.
      danglingBindings: Object.keys(d.bindings ?? {}).filter((k) => !names.includes(k)),
      types: [...new Set(objects.map((o) => o.type))].sort(),
      paletteFrost: d.globals?.palette?.frost?.value,
    };
  });

  const ui = await page.evaluate(() => ({
    layerRows: document.querySelectorAll("[role=treeitem]").length,
    zoom: document.querySelector('button[aria-label="Zoom level"]')?.innerText?.trim(),
    status: document.querySelector("footer")?.innerText?.trim(),
  }));

  console.log(JSON.stringify({
    document: truth,
    ui,
    agrees: { objectCount: truth.count === ui.layerRows },
    errors,
  }, null, 2));
}
