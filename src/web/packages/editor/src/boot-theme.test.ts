import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { describe, expect, it, vi } from "vitest";
import { bootTheme } from "./boot-theme.js";
import type {
  ThemeLibraryClient,
  ThemeLibraryContent,
} from "./theme-library-client.js";

/**
 * Which document the editor opens on a URL that names one.
 *
 * The editor shipped a baked-in default and could not open anything else, so a
 * theme it saved to the library was a write-only surface: the status line said
 * "Saved to library" and nothing in the product could read it back. The join
 * was the whole of it — the client, the open call and the mount all existed.
 */

/** A saved theme, named and identified so a test cannot pass on either count:
 * the baked-in default and a saved copy of it have the same number of objects,
 * which is exactly how this hid. */
const SAVED: FabricThemeEnvelope = {
  schemaVersion: 2,
  fabricVersion: "7.4.0",
  id: "edited-by-hand",
  artboard: { width: 1920, height: 1080 },
  metadata: { name: "EDITED BY HAND", locale: "en" },
  scene: { version: "7.4.0", objects: [{ id: "renamed-headline" }] },
};

const content = { envelope: SAVED, assets: {} };

function clientOpening(opened: ThemeLibraryContent): ThemeLibraryClient {
  return {
    list: vi.fn(async () => []),
    open: vi.fn(async () => opened),
    save: vi.fn(async () => undefined),
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

  it("falls back to the editor's own default on a theme this host does not have", async () => {
    // A bookmark outlives the theme it points at. An error page says nothing
    // an author can act on; the editor's default is what a bare `/editor/`
    // gives, and it is a document they can work in.
    const client: ThemeLibraryClient = {
      list: vi.fn(async () => []),
      open: vi.fn(async () => {
        throw new Error("Could not open theme (404).");
      }),
      save: vi.fn(async () => undefined),
    };

    await expect(bootTheme("?theme=deleted-long-ago", client)).resolves.toBe(
      undefined,
    );
  });

  it("asks for nothing on a bare /editor/, which is most of the traffic", async () => {
    const client = clientOpening(content);

    await expect(bootTheme("", client)).resolves.toBe(undefined);
    await expect(bootTheme("?data=live", client)).resolves.toBe(undefined);
    expect(client.open).not.toHaveBeenCalled();
  });

  it("treats an empty id as no id", async () => {
    const client = clientOpening(content);

    await expect(bootTheme("?theme=", client)).resolves.toBe(undefined);
    expect(client.open).not.toHaveBeenCalled();
  });
});
