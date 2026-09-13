# 0009 — Opening and saving a theme

- **Status:** implemented
- **Design document sections:** §139, §141
- **Specs superseded:** none

## Problem

The editor loaded a checked-in fixture and could not persist anything. Two
consequences:

- No authoring session could outlive a page reload, so the editor could not be
  used for real work even by its author.
- §139 — "saving marks history clean without clearing it" — was implemented in
  `history.ts` and unit-tested, but had **no caller**. A rule nothing invokes is
  a rule nobody has checked.

## Behaviour

### A picker and a download, not a "save"

There is no host yet (ADR-0006 sequences it after this milestone), so there is
nowhere to save *to*. Open is a hidden `<input type="file">`; Save generates a
blob and clicks an anchor. When the host exists, themes will live there and this
becomes "export a copy" — the banner says so on screen.

**The File System Access API is deliberately not used.** It would allow saving
in place, and it needs a user gesture that cannot be driven from a test. Trading
a verifiable round trip for one fewer click, on a surface that is a stopgap
anyway, is the wrong trade.

### Opening

- The file is parsed and then validated with **the same validator the player
  uses**, so a file the editor accepts is a file that renders. Anything weaker
  would let an author save something the display then refuses.
- A rejected file **does not touch the open document**. §141's refusal must not
  half-apply, and keeping half of a broken theme is worse than refusing it.
- The reason appears in the status bar. "Nothing happened" is indistinguishable
  from a broken button.
- A newer `schemaVersion` is reported **on the version alone** (§141). Anything
  else said about a format we do not understand is speculation.
- Opening **resets the history** (`replaceDocument`). An undo that crossed a
  file boundary would restore half of another theme.
- The picker's value is cleared after every attempt, or choosing the same file
  twice in a row fires no `change` event and looks dead.
- Input is bounded at `MAX_THEME_BYTES` (8 MB) and rejected **before** parsing,
  so a mis-picked video does not freeze the tab inside `JSON.parse`. The stress
  fixture is 9 KB, so the bound is three orders of magnitude clear of real use.

### Saving

- Canonical serialisation, via `serializeThemeDocument` — so opening and saving
  without editing produces no diff, asserted by a byte-for-byte round trip.
- One trailing newline, exactly. The wrapper originally appended a second and
  the test caught it.
- The filename comes from the theme's **id**, not its display name: the id is
  already constrained to `^[A-Za-z0-9_-]{1,64}$`, and a display name is not —
  "CPU / GPU dashboard" would produce a path separator. An id that somehow fails
  that pattern falls back to `theme.json`, because this function sits one
  `JSON.parse` away from arbitrary input and a filename is exactly where
  traversal gets attempted (§141).
- **§139:** saving calls `markSaved`, which records the current document without
  clearing `past`. So undo still reaches edits from before the save, and undoing
  *away* from the saved document makes the editor dirty again — which falls out
  of comparing by reference rather than needing its own rule.

### Parsing is separated from the DOM

`parseThemeFile(text)` returns a document or a list of issues, so every rule
about what an acceptable file is gets unit-tested. The picker and the anchor
live in `main.ts` and decide nothing — the same split as everywhere else in this
editor.

## Out of scope

- **Draft recovery**, which §161 places in Gate 4. Nothing survives a crash or a
  reload today.
- **Theme packages** — ZIP with assets and fonts (§141's security rules). This is
  a bare `.json` document; a theme referencing assets will open, and those
  assets will not resolve.
- **Saving in place**, which needs either the host or the File System Access API.
- **A prompt on unload when dirty.** The status bar says `unsaved`; a
  `beforeunload` handler is a separate decision and annoying to test.
- **Recent files** or any notion of a current filename. Save always downloads to
  the id-derived name.

## Acceptance

| Behaviour | Test |
|---|---|
| The demo theme round-trips byte for byte | `persist.test.ts` — "round-trips the demo theme byte for byte" |
| Broken JSON, a non-theme, and an oversized file are all refused | `persist.test.ts` |
| A newer schema reports the version and nothing else (§141) | "reports only the version for a newer schema (§141)" |
| An unsafe id cannot become a filename | "falls back when an id would not be a safe filename" |
| Saving marks clean without clearing history (§139) | `tests/e2e/editor.spec.ts` — "saving downloads the theme, and marks history clean without clearing it (§139)" |
| The downloaded file is a valid, canonical theme | "the saved file is a valid theme that round-trips" |
| Opening replaces the document and resets history | "opening a file replaces the document and resets the history" |
| A rejected file leaves the open document intact | "a file that is not a theme is refused, and the open document survives" |
| An edit survives save → reopen | "an edited theme survives a save and reopen unchanged" |

The last one deliberately edits a **global** before saving, because the globals
map is the part of the format a serialiser is most likely to drop, and the
assertion is on the rendered colour rather than on the file's text.

Not verified: nothing has been opened that a *different* build wrote, so the
round trip only proves self-consistency. No file with assets has been opened
(the `assets` fixture references an asset that is deliberately not shipped), and
no file over a few kilobytes — the 8 MB bound is tested with a synthetic string,
not a real document.
