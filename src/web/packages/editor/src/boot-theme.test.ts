import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { describe, expect, it, vi } from "vitest";
import { bootTheme } from "./boot-theme.js";
import type {
  ThemeLibraryClient,
  ThemeLibraryContent,
} from "./theme-library-client.js";

/**
 * Which document the editor opens on a URL that names one, and on one that
 * does not.
 *
 * The editor shipped a baked-in default and could not open anything else, so a
 * theme it saved to the library was a write-only surface: the status line said
 * "Saved to library" and nothing in the product could read it back. The join
 * was the whole of it — the client, the open call and the mount all existed.
 *
 * Naming a theme fixed the bookmark and not the round trip: an author who
 * closes the tab and opens the editor again got the template, with their work
 * still on the host and nothing said. So a URL that names nothing opens what
 * they saved last, which is what "coming back" means.
 *
 * **The two questions are not the same question.** A URL that names nothing
 * resumes the author's own last save. A URL that names a theme this host does
 * not have opens NOTHING, because answering with a different document is the
 * defect: the author asked for one specific theme, gets handed another, and
 * the next Save writes over it. This file used to pin the opposite, and the
 * case that changed is called out by name where it changed.
 */

/** A saved theme, named and identified so a test cannot pass on either count:
 * the baked-in default and a saved copy of it have the same number of objects,
 * which is exactly how this hid. */
const SAVED: FabricThemeEnvelope = {
  schemaVersion: 2,
  fabricVersion: "7.4.0",
  id: "edited-by-hand",
  artboard: { width: 1920, height: 1080 },
  metadata: { name: "EDITED BY HAND", themeLanguage: "en" },
  scene: { version: "7.4.0", objects: [{ id: "renamed-headline" }] },
};

const content = { envelope: SAVED, assets: {} };

function clientOpening(opened: ThemeLibraryContent): ThemeLibraryClient {
  return {
    list: vi.fn(async () => []),
    open: vi.fn(async () => opened),
    save: vi.fn(async () => "base-after-save"),
  };
}

/** The first object's id out of a scene, which is opaque Fabric JSON by design
 *  — so it is read the way the product reads it, and a test that indexed
 *  straight into it would be asserting on a cast. */
function firstObjectId(envelope: FabricThemeEnvelope): unknown {
  const objects = (envelope.scene as { readonly objects?: unknown }).objects;
  if (!Array.isArray(objects)) return undefined;
  return (objects[0] as { readonly id?: unknown } | undefined)?.id;
}

describe("the editor on a URL that names a theme", () => {
  it("opens that theme, by name and by what is in it", async () => {
    const client = clientOpening(content);

    const opened = await bootTheme("?theme=edited-by-hand", client);

    expect(client.open).toHaveBeenCalledWith("edited-by-hand");
    // Name and a distinctive object id, never a count: a saved copy of the
    // default has the same number of objects as the default it replaced.
    expect(opened?.envelope.metadata?.name).toBe("EDITED BY HAND");
    expect(firstObjectId(opened?.envelope ?? SAVED)).toBe("renamed-headline");
  });

  it("carries the base, so a save from a URL-opened theme can be checked", async () => {
    // A tab opened this way holds the document it fetched and nothing since.
    // Without the base it could not tell that document from the one now
    // stored, and its save would go through as if it were the newer one.
    const client = clientOpening({ ...content, base: "base-as-stored" });

    const opened = await bootTheme("?theme=edited-by-hand", client);

    expect(opened?.base).toBe("base-as-stored");
  });

  it("opens nothing when the theme this host does not have", async () => {
    // A bookmark outlives the theme it points at, and an error page says
    // nothing an author can act on — so nothing is opened and the editor
    // mounts its own default, which is visible and clearly not what the URL
    // asked for.
    //
    // What it must NOT do is open a different saved document. The author named
    // one specific theme; answering with whatever ran last hands them a
    // document they did not choose, and the next Save writes over it. That was
    // the fall-through this test used to pin.
    const client: ThemeLibraryClient = {
      list: vi.fn(async () => [
        {
          id: "someone-elses-work",
          name: "Last",
          updatedAt: "2026-10-01T09:00:00.000Z",
        },
      ]),
      open: vi.fn(async () => {
        throw new Error("Could not open theme (404).");
      }),
      save: vi.fn(async () => "base-after-save"),
    };

    await expect(bootTheme("?theme=deleted-long-ago", client)).resolves.toBe(
      undefined,
    );
    // The point of the case: the store held something, and it was not opened.
    expect(client.open).toHaveBeenCalledExactlyOnceWith("deleted-long-ago");
  });

  it("asks for nothing when the author has saved nothing", async () => {
    // A first-time author has no work to come back to, so the reference
    // composition is the right thing to open — and asking for it must not
    // reach into the library at all.
    const client = clientOpening(content);

    await expect(bootTheme("", client)).resolves.toBe(undefined);
    expect(client.list).toHaveBeenCalledOnce();
    expect(client.open).not.toHaveBeenCalled();
  });

  it("never opens a template as if the author had saved it", async () => {
    // `updatedAt` is the host store's mtime and a template has none, so an
    // entry without one is not the author's own work however it is named.
    const client = clientOpening(content);
    client.list = vi.fn(async () => [
      { id: "vigilia-starter-template", name: "Starter — System dashboard" },
    ]);

    await expect(bootTheme("", client)).resolves.toBe(undefined);
    expect(client.open).not.toHaveBeenCalled();
  });

  it("falls back to the default when the host cannot be asked", async () => {
    const client: ThemeLibraryClient = {
      list: vi.fn(async () => {
        throw new Error("Could not list themes (0).");
      }),
      open: vi.fn(async () => content),
      save: vi.fn(async () => "base-after-save"),
    };

    await expect(bootTheme("", client)).resolves.toBe(undefined);
    expect(client.open).not.toHaveBeenCalled();
  });

  it("treats an empty id as no id, and comes back to the author's own work", async () => {
    // `?theme=` names nothing, so it is the bare-URL case and resumes — the
    // empty string is not a theme id that happens to be missing, which is the
    // distinction the previous case draws.
    const client = clientOpening(content);

    await bootTheme("?theme=", client);
    expect(client.open).not.toHaveBeenCalledWith("");
  });
});

describe("the editor on a URL that names nothing", () => {
  it("opens what the author saved last, not the template", async () => {
    // The shape the row measured: rename, add a rectangle, save, close the
    // tab, reopen — and hold the Starter with the work still on the host.
    const client = clientOpening(content);
    client.list = vi.fn(async () => [
      {
        id: "edited-yesterday",
        name: "Older",
        updatedAt: "2026-09-30T09:00:00.000Z",
      },
      {
        id: "edited-by-hand",
        name: "Last",
        updatedAt: "2026-10-01T09:00:00.000Z",
      },
      { id: "vigilia-starter-template", name: "Starter" },
    ]);

    const opened = await bootTheme("", client);

    expect(client.open).toHaveBeenCalledExactlyOnceWith("edited-by-hand");
    expect(opened?.envelope.metadata?.name).toBe("EDITED BY HAND");
  });

  it("reads the store's ISO timestamps as text, newest last in the file wins", async () => {
    // ISO-8601 UTC is fixed width, so the newest is the greatest string and
    // not the one that happens to be listed last.
    const client = clientOpening(content);
    client.list = vi.fn(async () => [
      {
        id: "edited-by-hand",
        name: "Last",
        updatedAt: "2026-10-01T09:00:00.000Z",
      },
      {
        id: "edited-yesterday",
        name: "Older",
        updatedAt: "2026-09-30T09:00:00.000Z",
      },
    ]);

    await bootTheme("?data=live", client);

    expect(client.open).toHaveBeenCalledExactlyOnceWith("edited-by-hand");
  });

  it("does not hand a dead ?theme= the author's most recent save", async () => {
    // THE DECISION this file records, and the round trip that was wrong.
    //
    // This test used to pin the opposite: a dead `?theme=` fell through to
    // `latestOwnTheme` and landed on "EDITED BY HAND". It was defended as "the
    // author's own work, and sending them to the template instead would put the
    // loss straight back for whoever's bookmark died" — but there is no loss to
    // put back. The theme is already gone; the question is only what replaces it,
    // and the two candidates are not equivalent. The template is a document the
    // author can SEE they were not given. "Whatever ran last" is a document that
    // looks like their work, mounts as their work, and takes their next Save.
    //
    // So the round trip that survives is the one this file's other describe
    // pins: a URL that names NOTHING resumes the author's own most recent save,
    // because closing the tab and coming back is the ordinary case and the
    // store is single-author (`~/.vigilia/themes/` under `os.homedir()`, loopback
    // host, no account). A URL that names something and cannot have it is a
    // different question, and it is answered with nothing.
    const client = clientOpening(content);
    client.list = vi.fn(async () => [
      {
        id: "edited-by-hand",
        name: "Last",
        updatedAt: "2026-10-01T09:00:00.000Z",
      },
    ]);
    client.open = vi.fn(async (id: string) => {
      if (id === "deleted-long-ago") throw new Error("Could not open (404).");
      return content;
    });

    await expect(bootTheme("?theme=deleted-long-ago", client)).resolves.toBe(
      undefined,
    );
    // Asked once, for the bookmark, and did not go looking for a substitute.
    expect(client.open).toHaveBeenCalledExactlyOnceWith("deleted-long-ago");
    expect(client.list).not.toHaveBeenCalled();
  });
});
