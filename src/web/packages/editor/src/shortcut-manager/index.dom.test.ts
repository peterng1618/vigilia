// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { ShortcutManager } from "./index.js";

describe("ShortcutManager", () => {
  it("claims registered Vigilia actions and leaves all other canvas keys alone", () => {
    const manager = new ShortcutManager();
    const save = vi.fn();
    manager.register("file.save", save);
    const handled = new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      cancelable: true,
    });
    const canvasKey = new KeyboardEvent("keydown", {
      key: "g",
      ctrlKey: true,
      cancelable: true,
    });

    window.dispatchEvent(handled);
    window.dispatchEvent(canvasKey);

    expect(save).toHaveBeenCalledOnce();
    expect(handled.defaultPrevented).toBe(true);
    expect(canvasKey.defaultPrevented).toBe(false);
    manager.destroy();
  });

  it("does not steal New from an editable field", () => {
    const manager = new ShortcutManager();
    const create = vi.fn();
    manager.register("file.new", create);
    const input = document.createElement("input");
    document.body.append(input);
    const event = new KeyboardEvent("keydown", {
      key: "n",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);

    expect(create).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    input.remove();
    manager.destroy();
  });

  it("keeps Save available while a text field has focus", () => {
    const manager = new ShortcutManager();
    const save = vi.fn();
    manager.register("file.save", save);
    const input = document.createElement("input");
    document.body.append(input);
    const event = new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);

    expect(save).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    input.remove();
    manager.destroy();
  });

  it("dispatches Ctrl+Z/Ctrl+Y to undo/redo", () => {
    const manager = new ShortcutManager();
    const undo = vi.fn();
    const redo = vi.fn();
    manager.register("edit.undo", undo);
    manager.register("edit.redo", redo);

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "z",
        ctrlKey: true,
        cancelable: true,
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "y",
        ctrlKey: true,
        cancelable: true,
      }),
    );

    expect(undo).toHaveBeenCalledOnce();
    expect(redo).toHaveBeenCalledOnce();
    manager.destroy();
  });

  it("does not steal undo from an editable field", () => {
    const manager = new ShortcutManager();
    const undo = vi.fn();
    manager.register("edit.undo", undo);
    const input = document.createElement("input");
    document.body.append(input);
    const event = new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);

    expect(undo).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    input.remove();
    manager.destroy();
  });
});

describe("ShortcutManager unmodified keys", () => {
  it("fires edit.delete for Delete and Backspace with no modifier", () => {
    const manager = new ShortcutManager();
    const handler = vi.fn();
    manager.register("edit.delete", handler);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" }));

    expect(handler).toHaveBeenCalledTimes(2);
    manager.destroy();
  });

  it("never fires an unmodified shortcut while a text field has focus", () => {
    const manager = new ShortcutManager();
    const handler = vi.fn();
    manager.register("edit.delete", handler);
    const field = document.createElement("textarea");
    document.body.append(field);

    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true }),
    );

    expect(handler).not.toHaveBeenCalled();
    field.remove();
    manager.destroy();
  });

  it("separates group and ungroup by the shift modifier", () => {
    const manager = new ShortcutManager();
    const group = vi.fn();
    const ungroup = vi.fn();
    manager.register("edit.group", group);
    manager.register("edit.ungroup", ungroup);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "g", ctrlKey: true }),
    );
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "G", ctrlKey: true, shiftKey: true }),
    );

    expect(group).toHaveBeenCalledOnce();
    expect(ungroup).toHaveBeenCalledOnce();
    manager.destroy();
  });

  it("leaves an unregistered shortcut's default behaviour alone", () => {
    const manager = new ShortcutManager();
    const event = new KeyboardEvent("keydown", {
      key: "Delete",
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    manager.destroy();
  });

  it("nudges on an arrow key and defers to a text field", () => {
    const manager = new ShortcutManager();
    const nudge = vi.fn();
    manager.register("canvas.nudge-left", nudge);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(nudge).toHaveBeenCalledTimes(1);

    // Dispatched ON the input, not on `window`. `window.dispatchEvent` sets the
    // event's `target` to `window` itself, so `isTextEntryTarget(event.target)`
    // reads the window and the nudge fires a second time — the assertion below
    // could never hold, whatever the binding did. `bubbles: true` is what carries
    // it up to the window listener; this is the idiom every existing deferral
    // test in this file already uses (`:42`, `:61`, `:109`, `:139`).
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
    expect(nudge).toHaveBeenCalledTimes(1);
    input.remove();
    manager.destroy();
  });

  it("routes both plain and shift+arrow to the same action", () => {
    const manager = new ShortcutManager();
    const nudge = vi.fn();
    // One id, one handler: the large step is the handler reading event.shiftKey,
    // not a second action id. A bare `vi.fn()` accepts and ignores that argument.
    // The Produces union above is the authority on which ids exist.
    manager.register("canvas.nudge-left", nudge);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true }),
    );
    expect(nudge).toHaveBeenCalledTimes(2);
    manager.destroy();
  });
});

describe("ShortcutManager context bindings", () => {
  it("dispatches Escape to the group-exit action", () => {
    const manager = new ShortcutManager();
    const exit = vi.fn();
    manager.register("view.exit-group", exit);

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(exit).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    manager.destroy();
  });

  it("leaves Escape to a focused text field", () => {
    // Fabric's own editing case is the same contract: its hidden textarea
    // handles Escape itself and stops propagation, so this binding cannot fire.
    const manager = new ShortcutManager();
    const exit = vi.fn();
    manager.register("view.exit-group", exit);
    const field = document.createElement("textarea");
    document.body.append(field);

    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(exit).not.toHaveBeenCalled();
    field.remove();
    manager.destroy();
  });
});
