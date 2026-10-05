// Quantify "the UI feels sluggish" as a number an author can be shown.
//
// Playwright's wall clock measures CDP round trips, not the page, so it is
// useless for this. The instrument that works is PerformanceObserver on
// `longtask`, which reports every main-thread block over 50 ms. Divide the total
// by the wall clock of the interaction and you get the share of the time the
// author is actually waiting — which is what "stutters" means.
//
// **And a count, because a share moves and a count does not.** A blocked-frame
// percentage on this editor has read 4% and 46% for the same code minutes apart,
// because four agents were building into the same bundle while it was measured.
// So the probe also counts the work itself — `initDimensions` calls on text
// objects, and full-canvas `requestRenderAll` calls — in a fixed interval of
// pure idle. That number is what says whether the loop changed at all, and it
// survives a rebuild, a machine, and a busy neighbour.
//
// Copy next to cdp.mjs and run as: node cdp.mjs longtask.mjs
// Requires an element with [aria-label="<track>"] to drag. Edit LABEL to suit.
//
// Environment:
//   TOKEN=<palette token id>   which token to drag (default: the 8-use one)
//   RUNS=<n>                   drags per token (default 3)
//   TOKENS=a,b,c               several tokens in one run, RUNS drags each
//   PORT=<n>                   the host's port (default 5311)
//   IDLE_MS=<n>                idle measurement window (default 3200)
//   SKIP_IDLE=1                skip the idle block and only drag
export default async function ({ page }) {
  const PORT = process.env.PORT ?? "5311";
  const LABEL = process.env.PROBE_TRACK ?? "picker-saturation";
  const RUNS = Number(process.env.RUNS ?? 3);
  const IDLE_MS = Number(process.env.IDLE_MS ?? 3200);
  const TOKENS = (
    process.env.TOKENS ??
    // The token with the most uses, so a scaling question has two ends to
    // compare. Read from the page rather than pinned, because the Starter's
    // tokens move and a pinned index measures a different token after a change.
    ""
  ).split(",").filter(Boolean);

  await page.setViewportSize({ width: 2048, height: 962 });
  await page.goto(`http://127.0.0.1:${PORT}/editor`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  const starter = page.locator("text=/Starter/").first();
  if (await starter.count()) {
    await starter.click().catch(() => {});
    await page.waitForTimeout(4000);
  }

  /**
   * ONE observer, for the life of the page.
   *
   * This is the trap that cost vg-081 a run: installing a PerformanceObserver
   * per drag stacks every earlier observer onto the same array, so each run
   * reports two, then three, then four times the real count — 96, 192, 300
   * tasks over one 2.8 s drag, and a blocked share climbing past 100%. The
   * guard is `window.__ltObserver`: the first call installs, every later one
   * returns early. The array is CLEARED between runs instead, which is the
   * other half — a fresh observer would fix the stacking and lose the
   * comparison between runs.
   *
   * Any share above 100% is this bug, not a finding.
   */
  const installed = await page.evaluate(() => {
    if (window.__ltObserver) return "reused";
    window.__long = [];
    window.__ltObserver = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__long.push(Math.round(e.duration));
    });
    window.__ltObserver.observe({ entryTypes: ["longtask"] });
    return "installed";
  });

  /**
   * Counters on the work itself, installed once and read many times.
   *
   * The prototype is patched rather than the instance, so an object added after
   * this runs is counted too — a figure that only covered the objects present at
   * install time would quietly under-report as a document grows. The prototype
   * is marked, so a second run over the same page does not stack wrappers and
   * report twice the real count, which is the same bug as the observer above.
   */
  const counters = await page.evaluate(() => {
    const canvas = window.vigiliaEditorBridge?.editor?.canvas;
    if (!canvas) return { ok: false, text: 0, classes: 0 };
    if (window.__work) return window.__work;
    const protos = new Set();
    let text = 0;
    const walk = (objects) => {
      for (const object of objects) {
        if (typeof object.initDimensions === "function") {
          protos.add(Object.getPrototypeOf(object));
          text += 1;
        }
        const children = object.getObjects?.();
        if (children) walk(children);
      }
    };
    walk(canvas.getObjects());
    for (const proto of protos) {
      const base = proto.initDimensions;
      if (base.__probe) continue;
      const wrapped = function (...args) {
        window.__count.measures += 1;
        return base.apply(this, args);
      };
      wrapped.__probe = true;
      proto.initDimensions = wrapped;
    }
    const render = canvas.requestRenderAll.bind(canvas);
    window.__count = { measures: 0, renders: 0 };
    canvas.requestRenderAll = () => {
      window.__count.renders += 1;
      return render();
    };
    window.__work = { ok: true, text, classes: protos.size };
    return window.__work;
  });
  console.log(
    `COUNTERS ${JSON.stringify(counters)}` +
      (counters.ok ? "" : "  — no editor bridge; the canvas could not be reached"),
  );

  const readCounters = () =>
    page.evaluate(() => ({ ...window.__count, long: window.__long.length }));

  const reset = () =>
    page.evaluate(() => {
      window.__long.length = 0;
      window.__count.measures = 0;
      window.__count.renders = 0;
    });

  if (process.env.SKIP_IDLE !== "1") {
    await reset();
    // No pointer, no key, no gesture at all. Whatever this costs is the loop
    // running on its own, and an editor nobody is touching is the state an
    // author leaves it in most of the day.
    await page.waitForTimeout(IDLE_MS);
    const idle = await readCounters();
    console.log(
      `IDLE ${IDLE_MS}ms with no gesture: measures=${idle.measures} ` +
        `renders=${idle.renders} longtasks=${idle.long}` +
        (counters.ok ? ` over ${counters.text} text objects` : ""),
    );
  }

  const tokens = TOKENS.length
    ? TOKENS
    : await page.evaluate(() => {
        const select = document.querySelector("select[data-vigilia-palette-token]");
        if (!select) return [];
        const scored = [...select.options].map((o) => ({
          id: o.value,
          uses: Number(/·\s*(\d+)$/.exec(o.textContent ?? "")?.[1] ?? 0),
        }));
        // The busiest token and the quietest non-empty one: if a token's use
        // count predicted the cost, these two would separate.
        const used = scored.filter((t) => t.uses > 0);
        const most = used.sort((a, b) => b.uses - a.uses)[0];
        const fewest = used.sort((a, b) => a.uses - b.uses)[0];
        return [...new Set([most?.id, fewest?.id].filter(Boolean))];
      });

  const results = [];
  for (const id of tokens) {
    const picked = await page.evaluate((token) => {
      const select = document.querySelector("select[data-vigilia-palette-token]");
      if (!select) return "no-select";
      // By id, never by index: an option added to the Starter shifts every
      // index after it, and a silent retarget is a measurement of nothing.
      select.value = token;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return select.value;
    }, id);
    await page.waitForTimeout(900);
    const opened = await page
      .locator('button[aria-label="Pick a colour"]')
      .first()
      .click({ timeout: 8000 })
      .then(() => "ok")
      .catch((e) => "FAIL " + e.message.slice(0, 80));
    await page.waitForTimeout(1200);

    const box = await page.locator(`[aria-label="${LABEL}"]`).first().boundingBox();
    if (!box) {
      console.log(`NO_TRACK ${LABEL} (token ${id}, picker ${opened})`);
      continue;
    }

    for (let run = 1; run <= RUNS; run++) {
      await reset();
      await page.waitForTimeout(400);
      await reset();

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

      const lag = await page.evaluate(() => ({
        count: window.__long.length,
        durations: window.__long,
        total: window.__long.reduce((a, b) => a + b, 0),
        max: window.__long.length ? Math.max(...window.__long) : 0,
      }));
      const work = await readCounters();
      const share = Math.round((lag.total / wall) * 100);
      results.push({ token: id, run, wall, measures: work.measures, renders: work.renders, ...lag, share });
      console.log(
        `${id} #${run} wall=${wall}ms count=${lag.count} total=${lag.total}ms max=${lag.max}ms share=${share}%` +
          ` measures=${work.measures} renders=${work.renders} [${lag.durations.join(",")}]`,
      );
      await page.waitForTimeout(900);
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500);
  }

  /**
   * The spread, not the headline. A single run of this drag has measured 2% and
   * 68% on the same machine minutes apart, so one number is not a finding and
   * the median of three is barely better. What a run is for is the SHAPE:
   * whether the stalls are a few peaks or many flat ones, and whether they sit
   * at all. Report the whole set.
   */
  const byToken = new Map();
  for (const r of results) {
    if (!byToken.has(r.token)) byToken.set(r.token, []);
    byToken.get(r.token).push(r);
  }
  console.log(`\nOBSERVER ${installed} — one per page; a share above 100% is the stacking bug, not a result.`);
  for (const [token, runs] of byToken) {
    const shares = runs.map((r) => r.share).sort((a, b) => a - b);
    const measures = runs.map((r) => r.measures);
    const renders = runs.map((r) => r.renders);
    const all = runs.flatMap((r) => r.durations);
    console.log(
      `${token}: shares ${shares.join("/")}%  tasks ${runs.map((r) => r.count).join("/")}` +
        `  measures ${measures.join("/")}  renders ${renders.join("/")}` +
        `  peaks ${all.length ? Math.min(...all) + "-" + Math.max(...all) + "ms" : "none"}`,
    );
  }
  console.log(
    "A stall that repeats once per drag move is per-move work; one that appears" +
      " a few times is a single expensive event. They have different owners.",
  );
  console.log(
    "The share is the symptom and the measures are the cause. Read the measures:" +
      " they are the number that means the same thing on the next machine.",
  );
}
