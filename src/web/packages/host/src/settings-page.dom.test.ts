// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * The prompts `/settings` puts above its device dropdowns.
 *
 * The page is a static document the host serves as-is — no build step, nothing
 * to import — so this reads the file and runs its own script against stubbed
 * answers, then reads the DOM back. Asserting the rendered text rather than a
 * constant's value is the point: a label moved, reworded or shared between two
 * fieldsets has to fail here, whether or not the string that produced it is
 * still the one a constant holds.
 */

// `import.meta.dirname`, not `fileURLToPath`: this file runs under jsdom, whose
// `URL` is the browser's and which `fileURLToPath` refuses as a non-file URL.
const PAGE = readFileSync(
  join(import.meta.dirname, "../public/settings.html"),
  "utf8",
);

/** The page's markup, minus the script the runner evaluates separately. */
const BODY_HTML = PAGE.slice(
  PAGE.indexOf("<body>") + "<body>".length,
  PAGE.indexOf("</body>"),
).replace(/<script[\s\S]*?<\/script>/, "");

/** The page's one module, minus the import: `/settings/theme-list.js` is a URL
 *  only a host serves, and no test here reaches it, because a PC with no saved
 *  theme draws no chooser and the questions below need no theme list. */
const SCRIPT = (
  PAGE.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1] ?? ""
).replace(/^\s*import\b[^\n]*$/m, "");

type Body = () => Promise<void>;
const AsyncFunction = Object.getPrototypeOf(
  async (): Promise<void> => undefined,
).constructor as new (
  source: string,
) => Body;

interface Device {
  readonly id: string;
  readonly name: string;
}

interface Hardware {
  readonly gpus: readonly Device[];
  readonly disks: readonly Device[];
}

const CARD: Device = { id: "rtx-4080", name: "NVIDIA GeForce RTX 4080" };
const OTHER_CARD: Device = { id: "arc-a770", name: "Intel Arc A770" };
const BOOT: Device = { id: "samsung-ssd-990-pro", name: "Samsung SSD 990 PRO" };
const ARCHIVE: Device = {
  id: "st4000dm004-2cv104",
  name: "WDC WD40EFRX-68N32N0",
};

/** The shape the page reads off a response, and nothing more of it. */
const json = (body: unknown): Response =>
  ({
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const stubFetch = (hardware: Hardware): void => {
  globalThis.fetch = (async (input: string) => {
    switch (input) {
      case "/api/themes/active":
        return json({ themes: [], templates: [], active: "living-room" });
      case "/api/themes/living-room/answers":
        return json({ required: ["data-disk"], answers: {} });
      case "/api/devices":
        return json({
          available: { gpus: hardware.gpus, disks: hardware.disks },
          assigned: { assigned: {}, names: {} },
        });
      case "/api/display":
        return json({ zones: ["Europe/London"], settings: {} });
      default:
        throw new Error(`the page fetched ${input}, which no test stubs`);
    }
  }) as unknown as typeof globalThis.fetch;
};

const realFetch = globalThis.fetch;

async function render(hardware: Hardware): Promise<void> {
  document.body.innerHTML = BODY_HTML;
  stubFetch(hardware);
  await new AsyncFunction(SCRIPT)();
}

afterEach(() => {
  globalThis.fetch = realFetch;
  document.body.replaceChildren();
});

/** Each device fieldset's prompt, keyed by the group it assigns. */
function promptByGroup(): Record<string, string> {
  return Object.fromEntries(
    [
      ...document.querySelectorAll<HTMLSelectElement>(
        "#groups select[data-group]",
      ),
    ].map((select) => [
      select.dataset.group ?? "",
      select.closest("fieldset")?.querySelector("label")?.textContent ?? "",
    ]),
  );
}

/** Every fieldset that offers a choice, as the label above that choice. The
 *  names fieldset is excluded: its labels are device names, not prompts, and
 *  two drives may legitimately report the same one. */
function prompts(): string[] {
  return [...document.querySelectorAll("fieldset")]
    .filter((fieldset) => fieldset.querySelector("select") !== null)
    .map((fieldset) => fieldset.querySelector("label")?.textContent ?? "");
}

const MANY: Hardware = { gpus: [CARD, OTHER_CARD], disks: [BOOT, ARCHIVE] };

describe("the two disk fieldsets ask different questions", () => {
  it("each prompt names the drive it wants, not the count of them", async () => {
    await render(MANY);
    const prompt = promptByGroup();

    expect(prompt["system-disk"]).toBe("Which drive does this PC run from?");
    expect(prompt["data-disk"]).toBe(
      "Which second drive should dashboards show?",
    );
  });

  it("still differ on a PC with one drive, where there is no second drive to count", async () => {
    await render({ gpus: [CARD], disks: [BOOT] });
    const prompt = promptByGroup();

    // The count once decided both labels, so a one-drive PC asked twice and
    // the legend was the only thing telling the two dropdowns apart.
    expect(prompt["system-disk"]).toBe("Which drive does this PC run from?");
    expect(prompt["data-disk"]).toBe(
      "Which second drive should dashboards show?",
    );
  });
});

describe("the graphics card keeps both of its branches", () => {
  it("answers the question when this PC reports one card", async () => {
    await render({ gpus: [CARD], disks: [BOOT, ARCHIVE] });

    expect(promptByGroup()["gpu"]).toBe(
      "Only one found — dashboards use NVIDIA GeForce RTX 4080",
    );
  });

  it("asks it when this PC reports several", async () => {
    await render(MANY);

    expect(promptByGroup()["gpu"]).toBe("Which device should dashboards use?");
  });
});

describe("no two fieldsets on the page carry the same prompt", () => {
  // Every combination the count could produce, because the count is what used
  // to decide the copy. Includes the theme's own question, which shares the
  // page with the device fieldsets.
  for (const gpus of [[CARD], [CARD, OTHER_CARD]]) {
    for (const disks of [[BOOT], [BOOT, ARCHIVE]]) {
      it(`on a PC with ${gpus.length} card(s) and ${disks.length} drive(s)`, async () => {
        await render({ gpus, disks });
        const seen = prompts();

        expect(seen.filter((text) => text === "")).toEqual([]);
        expect(new Set(seen).size).toBe(seen.length);
      });
    }
  }
});
