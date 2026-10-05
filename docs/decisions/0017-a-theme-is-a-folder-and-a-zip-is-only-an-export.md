# 0017 — A theme is a folder; a ZIP is only what an author exports

- **Date:** 2026-09-30
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/themes/store.ts`,
  `src/web/packages/host/src/server.ts`,
  `src/web/packages/host/src/cli/args.ts`,
  `src/web/packages/editor/src/editor-session.ts`

## The problem

The library stored each theme as a single `.vigilia-theme` ZIP, and read it back
by unzipping. So the archive was not an export artifact — it was the **working
format**, on every save and every read.

The cost was not tidiness. `store.ts:53-56` showed it plainly: **`list()` read
every file and parsed the whole package** just to learn a theme's name, author
and mtime. Listing a library of N themes decompressed N archives to print N
lines. And `editor-session.ts:552` built a ZIP in order to *save to the library*
— compressing data that was about to be written uncompressed, uncompressed
again on the next read.

The user ruled twice, the second time in answer to this measurement: *"No we
don't zip round trip on anything. A zip is only made when the author export the
theme."*

## Rung 1 — Vigilia

Searched: every `serializeThemePackage` / `readThemePackage` /
`writeThemePackage` caller in non-test source, and the on-disk layout in
`~/.vigilia/themes/`.

Found: the app folder was **already** at `~/.vigilia/themes`
(`cli/args.ts:26`) — under the home directory, which is where an npm-installed
Node app conventionally keeps state. **The location was right; the shape was
wrong.** Three surfaces zip on a working path — the store's read, list and
write, and the editor's save-to-library. Two are legitimate and must not be
touched: `persistence-manager.save` **is** the export, and `persist.ts`'s import
reads the archive the author opened.

## Rung 2 — dependencies

Searched: the direct dependencies of `@vigilia/theme-package`.
Found: **it is the right module and it is untouched by this change.** Reading and
writing a `.vigilia-theme` is exactly its job, and the export and import paths
keep it. Nothing here argues for a different archive library.

## Rung 3 — platform

Searched: `node:fs/promises` — `mkdir`, `writeFile`, `readdir({withFileTypes})`,
`rename`, and the atomic-write-by-temp-file-then-rename pattern the store
already uses.
Found: everything needed is already in use. **`rename` within a directory is
atomic on every platform this runs on**, which is the property that makes a
folder safer than a ZIP for a working format: an interrupted save can never
leave a half-written archive where a theme used to be — the worst outcome of
today's design. `readdir({withFileTypes:true})` already distinguishes the
directory entries this needs from the loose files around them.

## Rung 4 — ecosystem

Searched: how editors and IDEs that keep documents on disk structure their
workspace — VS Code's untitled-workspaces, Obsidian's vault, a JetBrains
project's `.idea/`, and what npm's own `configstore`/`conf` conventions assume
about app folders.
Found: **the consensus is one directory per document, with a human-readable file
inside it, and an index derived by listing the directories rather than kept
separately.** Nothing keeps a document as a compressed archive it must inflate to
read a name. The one thing they all share with today's code is the
temp-file-then-rename write, which is the atomicity property worth keeping.

**Nobody in that set appeared to have a migration story for "we used to store
archives"**, which is consistent with the ruling not to have one: the formats are
too different to convert silently, and a wrong conversion is worse than a
re-import.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Keep the ZIP as the working format | works today | an archive step on every save and every read | silent; listing costs N decompressions | **rejected by the user, twice** |
| Folder per theme, read/write in place | what was asked for | a layout change and a store rewrite | an interrupted write loses the draft, not the theme — the archive had the same exposure | **chosen** |
| Migrate existing ZIPs on first start | no re-import | migration code that must survive a half-finished run | a botched migration loses a theme | **rejected by the user** — start clean |
| Read both, prefer the folder | nothing lost | two code paths forever | the ZIP path never dies | **rejected by the user** |

## Rung 6 — probe

Listed `~/.vigilia/themes/` on this machine: three `.vigilia-theme` archives and
one loose `active-theme.json`, i.e. **settings and themes sharing one directory,
each theme a file where a folder was specified.** Measured sizes: a theme package
is ~1.2 KB with no assets and the starter backdrop alone is 438 KB — so a package
is small, which is exactly why zipping it bought nothing.

## Decision

**A theme is a directory under the app folder, and `theme-package` is used only
where an archive is the point: export, and import of a file the author opened.**

```
~/.vigilia/                 app folder
  themes/                   the theme library
    <theme-id>/             one theme's own folder — the working format
      theme.json
      assets/…
  <settings>                device, display, active-theme, per-theme settings
```

**Existing archives are ignored rather than migrated** — and the reason is worth
recording, because it is the opposite of the usual one. **The app is not
released; we are its only users.** So the reason to write a migration — someone's
data would be stranded — does not apply, and the project's own rule already says
so: *pre-release internal architecture may break cleanly, with no compatibility
glue to preserve a superseded design.* What is on disk is machine-generated by
our own testing. A migration would be code whose only beneficiary is us, and
`AGENTS.md`'s guard against exactly that is worth honouring here.

**A follow-on the user named, deliberately out of scope for this change:** the
starter theme is *built by code at runtime* — `onNewFromStarter` calls
`createNewFabricTheme()` — and should eventually be a pre-bundled theme in a
folder on disk like any other.

**This is sequenced before auto-save, not after.** Auto-save becomes "write this
theme's folder" — no archive step, no re-zip — and building it first would mean
building it twice.
