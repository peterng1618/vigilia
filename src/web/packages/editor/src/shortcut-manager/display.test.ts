import { afterEach, describe, expect, it, vi } from "vitest";
import { shortcutLabel, usesCommandKey } from "./display.js";

/** `navigator.userAgent` is the only platform signal every browser here has. */
function onPlatform(userAgent: string): void {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
}

const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const MACINTOSH = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shortcutLabel", () => {
  it("spells the modifiers on a platform whose keyboard spells them", () => {
    onPlatform(WINDOWS);
    expect(usesCommandKey()).toBe(false);
    expect(shortcutLabel("edit.undo")).toBe("Ctrl+Z");
    expect(shortcutLabel("canvas.select-all")).toBe("Ctrl+A");
    expect(shortcutLabel("edit.delete")).toBe("Delete · Backspace");
  });

  it("prints the glyphs on a platform whose keyboard has them", () => {
    // `shortcut-manager/index.ts:76` accepts `ctrlKey` OR `metaKey` everywhere,
    // so the binding is never wrong. What is wrong is *showing* Ctrl to an
    // author whose keyboard has no Ctrl for this — and nothing on this machine
    // would notice, which is why the platform is stubbed rather than read.
    onPlatform(MACINTOSH);
    expect(usesCommandKey()).toBe(true);
    expect(shortcutLabel("edit.undo")).toBe("⌘Z");
    expect(shortcutLabel("edit.redo")).toBe("⌘⇧Z · ⌘Y");
  });

  it("joins every chord an action answers to, in the table's order", () => {
    onPlatform(WINDOWS);
    // Both are deliberate: `index.ts:39-42` keeps Ctrl+Y alongside the standard
    // chord because Figma has it and someone learned it here.
    expect(shortcutLabel("edit.redo")).toBe("Ctrl+Shift+Z · Ctrl+Y");
  });

  it("renders a shifted character as the browser reports it, without a Shift cap", () => {
    onPlatform(WINDOWS);
    // `index.ts:49-54` binds `}` and `{` because Shift makes the browser report
    // the shifted character. "Ctrl+Shift+}" names a key nobody has and matches
    // nothing; "Ctrl+}" is the character the event carries.
    expect(shortcutLabel("canvas.front")).toBe("Ctrl+} · Ctrl+]");
    expect(shortcutLabel("canvas.back")).toBe("Ctrl+{ · Ctrl+[");
  });

  it("leaves a bound action's chord empty rather than inventing one", () => {
    onPlatform(WINDOWS);
    // `view.exit-group` is in the manager and deliberately not in the table
    // (`index.ts:67-71`). A caller that asks for it gets nothing back — the
    // renderer never guesses a default, which is the same rule the repo applies
    // to a refused numeric field.
    expect(shortcutLabel("view.exit-group")).toBe("");
  });
});
