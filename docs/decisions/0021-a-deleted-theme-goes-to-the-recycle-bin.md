# 0021 — A deleted theme goes to the recycle bin, not to `unlink`

- **Date:** 2026-10-01
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/themes/store.ts`,
  `src/web/packages/host/src/server.ts`

## The problem

The library listing is the only surface that shows an author's themes, and it
offers nothing that removes one — no `DELETE` on `/api/themes/:id`, no control in
`theme-list.js`, no File-menu item. ADR-0017 made a theme **a directory on
disk**, which is precisely what turned the absence into a decision rather than an
oversight: with a theme as one ZIP file, "remove it" was one `unlink` of a
regenerable artifact. With a theme as a folder of authored work, the same line is
a `fs.rm(recursive)` of the only copy.

So the shape of the problem is not "add a delete button". It is: **give the
destructive act a recovery, on three operating systems, without a native addon
and without a new dependency.**

The ruling (user, 2026-10-01) settles the intent:

> Delete move a theme folder to the recycle bin. So it's recoverable from there

The recycle bin *is* the undo. A hand-rolled quarantine directory inside the
themes root was considered and is what this decision replaces: it would be a
second trash the author would not know how to restore from.

## Rung 1 — Vigilia

Searched: `trash|recycle|Recycle|SHFileOperation|gio |trash-put|osascript|shell.trashItem`
across `src/web/packages` (excluding `dist/`), and the API surface of
`ThemeLibraryClient`, `ThemeStore`, `themeList()` and the File menu.

Found: **two unrelated `Trash2` icon imports** in
`editor/src/object-actions.ts` — the delete-an-*object* control on the canvas, a
scene-graph op with its own undo. Nothing that moves a theme to a trash. The
library listing's entire control set is `Open the editor`, the template link, the
theme's own choose button, and `Edit`.

One thing worth keeping: `ThumbnailStore.remove` (`themes/thumbnails.ts:98`)
already exists, and its comment draws the exact line this feature must not cross
— *"The picture, never the theme: a theme is removed by removing its folder."*
The thumbnail lives **inside** the theme folder, so trashing the folder takes it
along and no second call is needed.

## Rung 2 — dependencies

Searched: `packages/host/package.json` and the workspace root. The host declares
`@vigilia/renderer-core`, `@vigilia/theme-package`, `systeminformation`, plus a
`@types/node` that never ships. Its own `"//"` field states the rule: **zero
runtime dependencies beyond the renderer's types, deliberately.**

Found: **nothing installed can do this.** `systeminformation` is telemetry.
`@vigilia/theme-package` is archive I/O. Adding `trash` (or any other package)
would be the first runtime dependency the host ever took, and `AGENTS.md` requires
a licence check, a `THIRD-PARTY-NOTICES.md` entry and a
`docs/engineering/dependencies.md` entry first.

## Rung 3 — platform

Searched: `Object.keys(require("node:fs"))` filtered for
`trash|recycle|remove|delete`; `require("node:fs/promises").trash`; the Node
issue tracker for a trash proposal.

Found: **Node has no trash API at any version, including the 24 this repo runs.**
`fs.trash` is `undefined`, `fsPromises.trash` is `undefined`, and the only
matching `fs` keys are `rm`/`rmdir` — the permanent ones. So there is no
standard-library route on any platform, and the question becomes which per-platform
mechanism shells out to what.

**Windows** — `SHFileOperation`/`IFileOperation` with `FOF_ALLOWUNDO` is the real
API, but it is a Win32 call with no Node binding; reaching it needs FFI or a
native addon. Two zero-dependency routes exist:

- `powershell.exe` + `Microsoft.VisualBasic.FileIO.FileSystem.DeleteDirectory(path, UIOption::OnlyErrorDialogs, RecycleOption::SendToRecycleBin)`. The VisualBasic assembly ships in Windows PowerShell 5.1 (measured present on this machine), and the call is the Shell's own recycle path, so the item is restorable from Explorer with its original location intact.
- The `trash` npm package's own Windows path, which is a bundled 28 KB `windows-trash.exe` doing exactly the above.

**macOS** — `NSFileManager.trashItemAtURL:` is the real API and again needs a
native binary (`macos-trash` ships a 709 KB Swift binary). The zero-dependency
route is `osascript -e 'tell application "Finder" to delete POSIX file "…"'`.
Cost, stated plainly: it needs Finder, and on macOS 10.14+ the first call raises
a TCC Automation prompt.

**Linux** — the freedesktop.org Trash **specification** (v1.0) is the contract;
there is no single API. Two CLIs implement it: `gio trash` (GLib/GIO's
`g_file_trash`, present on GNOME and most desktops) and `trash-put` (trash-cli,
in most distro repos). Implementing the spec by hand is possible and is rung 4's
dead end, below.

**WSL** — not a target. The host is a Windows, macOS or Linux process; a WSL
process is a Linux one as far as this code is concerned.

## Rung 4 — ecosystem

Searched: *"Node.js cross-platform move file to recycle bin trash API no native
dependency"*, *"npm package trash sindresorhus move to trash cross platform
implementation"*, *"macos-trash npm implementation AppleScript osascript Finder
delete POSIX file trash"*, *"freedesktop trash specification gio trash trash-put
XDG_DATA_HOME Trash files trashinfo"*, and the `sindresorhus/trash` source
(`lib/macos.js`, `lib/linux.js`, `lib/windows.js`, `package.json`) as surfaced in
those results.

Found, and this is the part that decides it:

- **The obvious dependency is declining on the exact platform we would need it
  for.** `trash@10.1.1`'s own README: *"The Linux implementation is not very
  good and not maintained. Help welcome. If no one steps up to help maintain it,
  I will eventually remove Linux support."* Its Linux path is not the `gio`
  binary — it is its own `xdg-trashdir` + `move-file` + `chunkify`
  implementation, i.e. the hand-rolled spec this note was asked to evaluate.
  Its macOS path is a 709 KB prebuilt binary its maintainer declines to keep
  current. So the one package that would have carried this ships the weakest
  implementation on Linux and a binary blob on macOS.
- **The freedesktop spec is genuinely hand-work** — `$XDG_DATA_HOME/Trash` with
  `files/` and `info/`, a `.trashinfo` per item written **before** the move and
  created atomically (`O_EXCL`, retry on collision), URL-escaped `Path=`, RFC-3339
  `DeletionDate=`, plus a separate `$topdir/.Trash/$uid` for anything not on the
  home filesystem and a sticky-bit check on it. GLib hit exactly the
  write-info-first bug this shape produces (glib commit `g_local_file_trash:
  write info file first`, GNOME #749314 — gvfs observed the file as an empty
  stub and dropped the original path). **This is the undischarged case the reuse
  gate exists for**, and it is precisely what `gio` already gets right.
- **macOS has two Finder-free answers and neither is free.**
  `trash-rs` documents them side by side: `Finder` (gives "Put Back", may ask for
  Automation permission, makes the Finder sound) versus `NSFileManager`
  (`trashItemAtURL`, no permission prompt, no sound, and **"does not show the Put
  Back option on some systems (this is a macOS bug)"**). We cannot reach
  `NSFileManager` from Node without a binary, so we take Finder — and record
  that Put Back is why we tolerate the TCC prompt, because Put Back *is* the
  ruling's "recoverable from there".
- `sindresorhus/recycle-bin` and Electron's `shell.trashItem` are the same
  mechanisms reached through a binary and through Electron, respectively. The
  host is neither an Electron app nor permitted a binary.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `fs.rm(folder, {recursive})` | perfect fit, zero work | none | **irreversible loss of authored work** | rejected — the thing the ruling exists to prevent |
| Quarantine folder inside the themes root | "reversible" in a way | none | a second trash the author cannot restore from; pollutes the library root the store lists | rejected — this is what the ruling replaces |
| npm `trash` | would carry it | 9 runtime deps; first the host has ever taken; `THIRD-PARTY-NOTICES` + `docs/engineering/dependencies.md` | unmaintained on Linux, binary blob on macOS | **rejected — rung 4's own finding** |
| Hand-rolled freedesktop spec on Linux | spec-correct | ~100 lines: `.trashinfo`, `O_EXCL` uniqueness, URL escaping, topdir trash, sticky bit | the empty-info-file bug GLib shipped | rejected — `gio` is the discharged form of this work |
| Per-platform shell-out to the OS's own trash mechanism | what every OS provides | ~90 lines, no dependency, no binary | spawn cost; per-platform failure modes | **chosen** |

## Rung 6 — probe

Measured on this machine (Windows 11, PowerShell 5.1.22621.6133, Node
v24.13.0), against scratch directories under `%TEMP%`:

| Measurement | Result |
|---|---|
| `fs.trash` / `fsPromises.trash` | `undefined` / `undefined` |
| `Microsoft.VisualBasic.FileIO` assembly present in `powershell.exe` | yes |
| Correct enum name | `RecycleOption` — **`RecycleBinOption` does not exist** and the first probe failed on it |
| First trashed folder, end to end | exit 0, gone from the filesystem |
| Nested tree (`theme.json` + `assets/a.png`) trashed whole | gone |
| A sibling folder in the same parent | untouched |
| Folder name containing `'` | trashed (single quotes doubled in the generated script) |
| Missing path | exit 1, `Could not find directory` on stderr — **fails loudly, never silently succeeds** |
| Cost | 426 ms first call (assembly load), ~380–460 ms each after |

## Decision

**A theme is removed by moving its folder to the operating system's trash, and by
nothing else.** The three mechanisms, in order of preference:

- **Windows** — `powershell.exe -NoProfile -NonInteractive` running
  `Microsoft.VisualBasic.FileIO.FileSystem.DeleteDirectory` with
  `RecycleOption::SendToRecycleBin`.
- **macOS** — `osascript -e 'tell application "Finder" to delete POSIX file "…"'`.
- **Linux** — `gio trash <path>`, falling back to `trash-put`.

**If none of them is available, the delete fails with a message naming what it
tried.** It does not fall back to `fs.rm`. A refused delete is recoverable; a
silent permanent delete is the defect, and a fallback would reintroduce it on
exactly the machines that were not tested.

**The route refuses a folder that is not a theme.** `remove(id)` reads the theme
first and 404s if it will not read, so a valid-id directory in the library root
that holds no theme is never trashed — only what the library would have listed.

**A save in flight for that id refuses the delete** rather than racing it: the
save's swap is two renames, and trashing between them would take the folder the
save is about to rename in.

**The active theme needs no clearing.** `ActiveThemeStore.read` already drops an
id the library no longer lists (`settings/active-theme.ts:38-40`), so the
consumer side self-heals on the next read.