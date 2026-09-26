### Task 2: Add package-local copy, shell tokens, and palette persistence

**Files:**
- Create: `src/web/packages/editor/src/ui-copy.ts`
- Create: `src/web/packages/editor/src/editor-shell/palette.ts`
- Create: `src/web/packages/editor/src/editor-shell/palette.test.ts`
- Create: `src/web/packages/editor/src/editor-shell/editor-shell.css`

**Interfaces:**
- Consumes: browser `localStorage` and the editor mount root.
- Produces: `ShellPalette`, `readShellPalette()`, `writeShellPalette()`, and `applyShellPalette(root, palette)` for Task 3.

- [ ] **Step 1: Write failing palette tests**

Test the default, valid stored palette, invalid stored palette, and that no palette operation receives or changes a theme envelope.

```ts
expect(readShellPalette(storage)).toBe("graphite");
expect(readShellPalette(storageWith("ember"))).toBe("ember");
expect(readShellPalette(storageWith("invalid"))).toBe("graphite");
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- palette.test.ts`

Expected: FAIL because the palette module does not exist.

- [ ] **Step 3: Add the typed copy and palette owner**

Create `ui-copy.ts` as a typed constant for visible editor labels. In `palette.ts`, allow exactly `graphite`, `ember`, `moss`, `plum`, and `light`; store the selected key under one editor-specific key; and set `data-shell-palette` on the shell root. Invalid storage falls back to `graphite` without throwing.

- [ ] **Step 4: Implement the visual tokens and fallback**

Define palette variables in `editor-shell.css`: dark default, translucent charcoal surfaces, pale edge highlight, and intentional mint/amber/coral/violet accents. Apply `backdrop-filter: blur(10px)` only to glass surfaces. Add a solid surface in `@media (prefers-reduced-transparency: reduce)` and an `@supports not (backdrop-filter: blur(1px))` fallback. Do not include the mockup city image in a production bundle.

- [ ] **Step 5: Run the focused test**

Run: `npm test -- palette.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/ui-copy.ts src/web/packages/editor/src/editor-shell/palette.ts src/web/packages/editor/src/editor-shell/palette.test.ts src/web/packages/editor/src/editor-shell/editor-shell.css
git commit -m "feat: add editor shell palette tokens"
```

