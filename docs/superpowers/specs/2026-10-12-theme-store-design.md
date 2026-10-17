# A theme store for Vigilia

- **Status:** revised 2026-10-17 for acceptance; no plan yet
- **Date:** 2026-10-12, **revised 2026-10-16** after the `hydralauncher/hydra-themes`
  study, **revised again 2026-10-17** after the rulings in the next section
- **Scope:** two subjects that are one shell. **The storefront**, specified
  kind-agnostically — three kinds are in view, dashboard themes, widget presets
  and editor themes, and **v1 ships the dashboard theme only**, because it is the
  only kind with an exchange unit; the other two get an addendum each. And **the
  three-mode shell** the storefront is a mode of. A third subject, **per-display
  theme assignment**, is deliberately not here: it is its own spec and it lands
  first, per ruling 6 below.

## What this is, and is not

A design agreed in conversation, revised. It exists so a future session starts
from the decisions rather than re-deriving them. It is **not** accepted work:
`STATUS.md` alone decides acceptance, and nothing here is the active plan. The
sections that say *unverified* are load-bearing unknowns, not omissions — a
free-tier limit that turns out false changes the architecture.

**Superseded by this revision, and named so the old reading is not resurrected:**
the previous scope line said "the **theme** half only … the widget store is a
later spec that this one must not pre-empt", and `vg-388` said in as many words
that widgets are out of scope. The user ruled on 2026-10-15 that **the store
carries three kinds and the spec is scoped storefront-now, kinds-follow**. The
widget store is still a later piece of work; it is no longer a later *storefront*.

## Rulings taken 2026-10-17

Nine decisions, all the user's, taken across three passes the same day. Each one
changes a section below rather than adding to it, which is why they are first.

1. **The store interface shows online themes and local themes together** — the
   catalogue, and the themes made here or imported offline, in one surface. This
   is the requirement the rest of the revision is arranged around.
2. **Import lands in the library.** A package brought in offline is written into
   the host's theme library, so the local list is exactly the library.
3. **The store mode's two halves are tabs** — local and online. A downloaded
   theme *is* a local theme (see "Provenance"), so the two views of one fact are
   never on screen together. That cost is accepted rather than argued.
4. **The third mode is this PC** — devices, display and theme questions, rebuilt
   in the shell. Its Themes section and `library.html`'s activate job move to the
   store mode's local tab, so one surface owns the theme list. `Editor Settings`
   keeps the editor's own chrome, and the two names stop conflicting because the
   subjects are disjoint: the mode owns the machine, the pane owns the editor.
   `settings.html` and `library.html` stay served, so a browser with no editor
   open can still pick and administer.
5. **Activation is per-display from the start.** The local tab assigns a theme to
   a display client, or to a default for unassigned ones. `active-theme.json`'s
   one id for the host becomes a per-display map and `/api/themes/active` changes
   shape with it, so no activation work is built against the single-theme model
   and then reworked.
6. **Per-display assignment is its own spec and lands first.** This document
   consumes its assign action and does not restate its model.
7. **The store is searchable and filterable by author, colour mode, the sensors a
   theme reads, shape (orientation, aspect ratio, pixel size) and author-declared
   style tags** — the five facets of § "Finding a theme: the five facets". Four are
   derived from the document rather than authored; style tags are the one addition
   to the theme format, and they are **picked from the tags that already exist**
   rather than typed, with a new tag proposed only when nothing fits and carried by
   the same submission as its first use. The format validates a tag's shape, not its
   membership, because a tag the vocabulary does not yet know has to be writable
   before the vocabulary can grow to include it.
8. **The store is a gallery grid, paged at the bottom, with a configurable number
   of themes per page** — § "The gallery, and paging". The grid replaces the row
   list in both halves rather than being a second view of it. The grid is
   responsive by CSS rather than by breakpoints, and the pager shows the five pages
   nearest the current one rather than only a step back and a step forward.
9. **An item opens a detail modal** — § "The item's own surface". The gallery shows
   what a theme looks like; the modal is where a theme is *read*: its preview at its
   own ratio, its description, and the facts the grid has no room for.

**What ruling 6 supersedes.** The draft said the three-mode top bar "needs its
own spec, not a section of this one"; the user folded it in on 2026-10-17, so
that sentence is superseded and the shell is specified here. Ruling 5's subject
is the queued multi-device objective, which has no register row: it gets one, and
its spec is the first thing this work owes.

## The intent

A store inside the app where authors share items and anyone browses and downloads
them. Open browse and download for anyone, including people with no account.
Submission is gated: an author submits, the owner reviews, and the owner may mark
an author **verified**, after which that author's submissions are automated.

## The three kinds, and which has an exchange unit

| Kind | What it is | Exchange unit today |
|---|---|---|
| Dashboard theme | the persisted envelope: `artboard`, `globals`, `assets`, `bindings`, `scene` | **yes** — ADR-0004/0017, §139/§141, `host/src/themes/store.ts` bounds |
| Widget preset | **the same envelope minus the artboard**: a scene **subtree** plus its `bindings`, `globals` and `assets` | no — §139 defers widget packages until an authoring workflow exists |
| Editor theme | a token set for the editor chrome | no, **and that is a decision rather than a gap** |

**A widget preset is a theme envelope minus the artboard** (user, 2026-10-15).
That is deliberately larger than the cheapest reading — a subtree plus bindings
alone — and it is the *cheaper* one overall: it reuses the envelope's own
sections, and therefore its validator and its bounds, rather than inventing a
second format for a second kind. `card-library.ts`'s insertable cards are the
authoring-side precedent: one Fabric `Group` over its parts, readings in the
envelope's `bindings`, and a `provenance` key.

**An editor theme is a token set, not a scene**, because §35 states that
editor-shell theming is separate from authored dashboard theme globals. Nothing
about the dashboard theme's package answers what this artifact is, so its
addendum has to settle that first. `DESIGN.md` is the design language's contract
and the ratchet in `scripts/design-tokens.mjs` guards the chrome, so an editor
theme is a *token* artifact that those instruments can read — not a stylesheet.

**Why v1 is one kind.** This document's central leverage claim is that the store
defines no format, no validator and no size policy, because it reuses the ones
that are already contracts. That claim is true only while one exchange unit
exists. Two of the three kinds have none, so building all three now means
designing two formats in the same breath as the storefront.

## What the hydra-themes study contributes, and what it does not

`hydralauncher/hydra-themes` was studied on 2026-10-16 as the reference for this
design. What it actually does, read from its files rather than its README:

- **Unit:** `themes/<ThemeName>-<authorCode>/` holding exactly one `.css` and one
  `screenshot.<ext>`. There is no per-theme manifest: the name is the folder name
  minus its last dash segment, and that segment is the author's account id.
- **Validation** (`src/lib/validate-themes.ts`, run by CI on every PR): a
  stylesheet exists; a file whose lowercased name starts with `screenshot` has an
  allowed extension; the folder yields a non-empty author code **that resolves as
  a real account through their API**; theme names are unique across the repo.
- **Index** (`src/lib/generate-themes.ts`, run at build): derives
  `{name, authorId, hasAchievementsSupport, hasAchievementSoundSupport}`, makes
  webp thumbnails at 340 and 1920 wide, then **POSTs the array to their API**
  rather than committing a manifest. Git is the submission medium; their server
  is the runtime source.
- **Capabilities are inferred from the artifact**: achievements support means the
  CSS contains a class starting `achievement-notification`; sound support means an
  `achievement.{wav,mp3,ogg,m4a}` file exists. That is a workaround for having no
  schema.
- **No versioning, update or deletion semantics anywhere in it.**

**What transfers.** The minimal unit; validation as one script CI runs; author
identity reused from the host account rather than invented; capability flags on
the index so the client renders badges without fetching every item. All four
already match `vg-388`'s agreed shape.

**What does not transfer, and why it matters more than what does.** Hydra's
theming mechanism is **CSS overriding their app's markup**, which is the one thing
this product forbids: a dashboard theme here is a validated Fabric-JSON envelope,
and the editor chrome is tokens under `DESIGN.md` watched by the ratchet. A
stylesheet-shaped editor theme would bypass the design system and the token
instrument entirely. Inferring capability from selectors is likewise unnecessary
when a schema exists — our items **declare** their kind and their features. And
their server as the runtime source is the opposite of this design's premise, which
is that browsing and downloading touch no API at all.

## What already exists, and must not be rebuilt

- `ADR-0004` — `@vigilia/theme-package` owns the ZIP layout and validation. A
  validated package is the immutable portable artifact; a local folder may be an
  authoring workspace but never a competing published format.
- `0017` — a theme is a **folder**; a ZIP is **only** what an author exports.
  Folder and package state do not silently synchronize.
- `§139` — the package embeds its declared `assets/` bytes and may carry a
  thumbnail at the package root, so a recipient sees the look without installing.
  It names "a future store" directly.
- `§141` — validation: reject traversal, symlinks, decompression bombs,
  executable content, external SVG resources; fail cleanly without mutating the
  open document.
- `0009`, `0010`, `0023` — asset URLs are base + declared path, served as their
  own type; the code decides what a theme may carry.
- **Bounds already exist and are enforced in both directions** in
  `host/src/themes/store.ts`: `MAX_ASSET_BYTES` 32 MiB, `MAX_ASSET_COUNT` 128,
  `MAX_TOTAL_ASSET_BYTES` 128 MiB, `MAX_THEME_FILE_BYTES` 32 MiB. `assetBounds`
  runs on save and the same refusals run on load.
- **The listing already reads every envelope.** `ThemeStore.list()` validates each
  stored document and `entryFor` takes the envelope, which is where the `author` a
  library cell shows already comes from. The facet record extends that one
  function.
- **The semantic-key vocabulary already has an owner and a label.**
  `describeSemanticKey` in `renderer-core` returns a descriptor with a `label` and
  a `family`, and `host/src/settings/required-devices.ts` already derives from
  `envelope.bindings` — for a different question, which slots to ask about. The
  sensors facet reads the same two things and replaces neither.
- **`metadata` already carries what the authored facets need** —
  `name`, `author`, `description`, `version`, `themeLanguage` — and
  `editor/src/panes/document/metadata-fields.tsx` is where they are authored. Tags
  are a field there, not a surface. **`artboard.width` and `artboard.height` are
  already authored and already bounded**, so the Shape facet's three readings need
  nothing new either.
- **The shell already persists a view preference.** `editor-shell/palette.ts`
  establishes the namespaced `localStorage` key with a read/write/clear trio; the
  page size is the second thing that needs exactly that and nothing more.
- **`PalettePaint` is solid-or-gradient** (`renderer-core/src/theme/document.ts`),
  so colour mode has a total rule rather than a case that was not thought about.

The store therefore does not define a format, a validator or a size policy. It
uses the ones that are already contracts — and it derives its facets from the
document rather than adding a parallel description of it.

## Architecture: GitHub is the whole backend

No server the owner runs, and no recurring cost.

| Concern | Mechanism |
|---|---|
| Catalogue | `catalogue/<id>/item.json` plus thumbnail, in one public repo |
| Identity | the author's GitHub account, reused for everything |
| Submission | **a pull request the app opens on the author's behalf** |
| Review | **the PR diff** — an item is JSON, so the change is readable |
| Listing | merging the PR |
| Verified author | a login in a list file, which makes their PRs auto-merge |
| Media | release assets, which carry a native `download_count` — **but whose repository they live in is open question 1, and the app-opened PR made it sharper** |
| Delivery to the app | a generated `index.json` over a free CDN |
| Counters | `created`/`updated` from git; `downloads` native; `favorites` via reactions, folded into `index.json` on a schedule |

Why the diff matters: the review instrument is the thing that costs the most to
build, and a PR gives it for free. An item is JSON, so a reviewer reads what
changed. An upload form plus a review UI is strictly more app for a worse
instrument.

### The item, and why `kind` is the seam

`item.json` carries a **`kind`** field, and it is the only field the storefront
reads to decide how to present and install an item. Everything else stays as the
draft has it.

**An unknown `kind` must degrade rather than break.** The client renders what the
item declares and refuses what it does not recognise, because the two addenda
will add kinds to a catalogue that already has items in it. This is the one place
v1 pays for kinds it does not ship, and it is cheaper than a migration later: a
client that cannot parse an item must skip it and say so, not fail the listing.

### The trust ladder

1. **Unverified author** — submits. Any GitHub account can fork a public repo, so
   this needs no invite and no setup from the owner. The owner reviews and merges,
   or closes.
2. **Verified author** — a GitHub Action auto-merges their own PR once validation
   passes, with no invitation for them to accept.

**The auto-merge rule is a security boundary, not a convenience.** A PR that
auto-merges on the strength of a username will happily carry a diff that edits
`.github/` or another author's item. Auto-merge must require all three of: the PR
author is in the verified list; validation is green; **and the diff touches only
that author's own `catalogue/<id>/` path**.

**The app-opened PR adds a fourth requirement.** Because the *client*, not the
person, composes the branch and the PR, the client must not be able to name the
target path: the app commits only to the author's own fork and the path is
derived from the author's identity and the item's id, never taken from input. A
client that can name a path is a store-wide write primitive in a compromised build.

### Identity: the device flow, and the first credential this product stores

Browsing and downloading need **no identity at all** — `index.json` is a static
file and downloads are plain URLs, so neither a token nor an API call is involved
and no rate limit applies. Favorite **counts** are baked into `index.json` by the
Action, so an anonymous viewer still sees them; only *casting* a favorite needs a
token. Anonymous downloads still increment the asset counter, so the download
metric survives anonymity.

**Publishing does need a token, and the previous draft was wrong to imply
otherwise.** "Sign-in is a just-in-time prompt on the heart control and nothing
more" is false once the app opens the pull request: the larger act is now the one
that requires identity. What survives is the property that mattered — a viewer who
never publishes never signs in.

- **The flow is GitHub's device authorization flow.** A locally-run host **cannot
  keep a client secret**, so the web redirect flow is unavailable to it. The app
  shows a code, the author approves it on github.com, and the app receives a
  token with the narrowest scope that can fork and open a PR on a public repo.
- **The token is consumer state**, stored beside the active-theme choice and the
  display settings. It is the **first credential this product stores**, so its
  file, its permissions, whether it is encrypted at rest, and what it does on
  failure or revocation are this design's business rather than an implementation
  detail.
- **Nothing secret ever reaches a fork's workflow.** Fork PRs do not receive the
  repository's secrets, which is why the re-homing job below runs after merge
  rather than during review.

### Views are dropped

GitHub exposes no per-item view count, and its traffic API is owner-only and 14
days deep. Rather than build a write endpoint for the one counter with no free
native source, **"most viewed" is not a sort this store offers.** Sorting is
created, updated, downloads and favorites.

## Submission: the app opens the pull request

The user ruled on 2026-10-15 that the app performs the submission. The sequence,
and the one rule each step exists to keep:

1. The app validates the package locally against the contracts above — the same
   validator, before anything leaves the machine.
2. The app forks the catalogue repo into the author's account, if it has not
   already, and commits `catalogue/<id>/item.json` plus the thumbnail to that fork.
3. The app opens the PR against the catalogue repo.
4. CI validates; the owner reviews the diff, or auto-merge fires under the
   four-part rule above.
5. Merging lists the item.

**The alternative, recorded because it is the one an author may prefer:** the app
exports the package and hands over a prefilled GitHub link the author completes
in a browser. No token reaches the app at all. It is not the ruling; it remains
the fallback if the OAuth app becomes a burden, and the client should be written
so the submission step is one seam rather than a path threaded through the UI.

## The shell: three modes, and what each surface owns

One shell whose top bar switches between **theme store**, **theme editor** and
**host settings**. The store is a sibling of the editor rather than something
inside it, and it is never built inside a shell it will leave.

**The switch is the header, because a second bar is forbidden.** §7.2 says the
rail replaced the horizontal pane bar and "a second horizontal bar under the
header is forbidden", and §10 lists one as a don't. So there is no mode strip
under the header: the header itself gains the mode switch and its action region
becomes per-mode — `File`/`Edit`/`View` and the publish chord in editor mode, the
store's own actions in the store mode, nothing but the switch where a mode has no
action of its own. §7.1 is amended in the same commit, which is what it asks for
when a surface needs something it does not have.

**The switch is a `Segmented`** — §5's "small exclusive choice where both options
must be readable" — not a new control, because §10 forbids inventing one. Its
labels are the modes' names, and **the names are the one thing here that needs
the user's word**: the draft's names are *theme store*, *theme editor* and *host
settings*, and the proposal the drawings carry is **Editor · Themes · This PC**,
which reuses the product's own words for two of the three (`uiCopy.menus`'s
editor, and the host page's `This PC`) and keeps `Editor Settings` for the pane.

**The store's two halves are a `Segmented` in the region's own header row**, not a
second bar: it sits inside the content region beside the filter and the sort, the
way a pane's title bar sits inside its pane. That reading is stated because a
reviewer is right to ask whether it is the forbidden second bar — it is a region's
own control over what the region lists, not navigation between shell surfaces,
and the shell's navigation is the header.

| Surface | Owns | Loses |
|---|---|---|
| Theme store mode | the theme list — the local tab over the host library, the online tab over the catalogue — plus import, export, install, removal and submission | — |
| Host settings mode | this PC: devices, display, and the theme questions **per display** | its Themes section, to the store's local tab |
| Theme editor | the document | — |
| `Editor Settings` pane (its own spec) | the editor's own chrome: appearance, keyboard, about | — |

**The reconciliation the draft asked for, answered.** The mode owns the machine
and what it displays; the pane owns the editor's own chrome. Nothing is owned by
both, so no subject moves twice and neither name is a lie. Themes are the one
list that moves: today `settings.html` lists them, `library.html` chooses the
active one and `ThemeLibraryChooser` opens one, and afterwards the store mode's
local tab is where a theme is listed, opened, activated, exported or removed.

**Per-display assignment reaches the answers, not only the theme.** The user's
words are that each display client holds "their own theme & its theme-specific
settings", so `theme-answers.json` stops being keyed by theme alone: an answer
belongs to a display's use of a theme. That is the per-display spec's model to
define — this document records only that the Host settings mode is where the
answers are given, and that the key change is why the mode's third section is not
the same section it is today.

**`settings.html` and `library.html` are not deleted.** They are served from
`BundleRoots.admin` and are the only surfaces a phone, or a browser with no editor
open, can reach — so a consumer who never opens the editor keeps the path they
have. The shell's mode is the author's path to the same facts.

**One invariant: a mode switch never loses an unsaved document.** The editor's
existing dirty guard is the instrument; a mode switch is not a document
replacement and must not read as one.

**Two costs, named rather than discovered.** The bar restructures
`editor-shell/`'s header and rail, which `vg-269` and `vg-330` are already
touching, and `editor-shell/shell-layout.tsx` is a watched path — a decision note
must claim it before the first write there. And the third mode is a rebuild of
four sections in the shell's own React, not an iframe over the host's page.

## The store mode

Two tabs, and the whole surface is those two galleries.

**Local** — the host's library, exactly: `ThemeStore.list()` plus the origin
record. A cell is a thumbnail, the name, the author and `updatedAt`, with actions
**Open in editor**, **Assign to display**, **Export package** and **Delete**. The
mode carries one action of its own: **Import package**.

**Online** — the catalogue's `index.json`. A cell is a thumbnail, the name, the
author, the item's `kind`, its download and favorite counts and when it changed,
with **Install** — or, when the item is installed, **Installed**, and **Update**
when the catalogue's version is newer. **Removal is not here**: removing an
installed theme is deleting a theme, and the local half's Delete owns it. An act
with two owners is what the ownership map exists to prevent.

The region's own header row carries the search box, the five facets and the sort — §
"Finding a theme: the five facets". A sort per half, because the two share no sort
key: online sorts by created, updated, downloads and favorites (§ "Views are
dropped"), local by name and `updatedAt`.

**Every action here already has an owner.** Open, export, delete and assign are
the library's existing operations, import is § "Import lands in the library" and
install is § "Provenance". The store mode composes them and invents none.

## Finding a theme: the five facets

A store that only lists is a store you scroll. Five facets — and the first thing
each needs is an answer to *who knows the value*, because four of the five are
already in the document and only one is not.

| Facet | Values | Where the value comes from |
|---|---|---|
| **Author** | `metadata.author` | authored, and already in the format |
| **Colour mode** | light, dark, unclassified | derived from the artboard's resolved background |
| **Sensors** | the `semanticKey` of every binding the theme declares | derived from `bindings` |
| **Shape** | orientation, aspect ratio, pixel size | derived from `artboard.width` and `artboard.height` |
| **Style** | `metadata.tags` | authored, and new — see below |

**One record, one function, two producers.** The values above are computed into a
single facet record, and the function that computes it lives in `renderer-core`,
because that is the only layer both producers can import: the host, for a theme in
the library, and the catalogue's Action, for a theme it has just merged. A theme's
facets are **never authored and never stored in `theme.json`** — they are derived
where they are needed. `index.json` carries the derived record per item, which is
why the Action writes it and the author's `item.json` does not. How the Action
obtains the function — a published package, or the workflow checking out the app
repo at a pinned commit — is the plan's choice, not this document's.

**The host already has the envelope in hand.** `ThemeStore.list()` validates every
stored document and hands the envelope to `entryFor`, which is where the existing
`author` comes from. The facet record is an extension of that one function, not a
second pass over the library and not a cache: a listing that already parses every
theme is the listing that can afford to derive from them.

**Colour mode is derived, and may be absent.** The artboard's `background` token
resolves to a `PalettePaint`, which is a solid or a gradient (`document.ts`), so: a
solid takes its own relative luminance; a gradient takes the mean of its stops; a
theme with `artboard.backgroundMedia` is **unclassified**, because a picture is its
ground and the token is not what a viewer sees. A luminance in the middle band is
unclassified too — that is the one place the answer is genuinely ambiguous, and a
wrong *light* on a mid-grey theme is worse than no answer at all. **Unclassified
themes are reachable under "any" and under no other value**, so the facet never
hides a theme from someone who did not ask it to.

**Sensors are the keys the theme reads.** Every `bindings[*][*].semanticKey`,
unioned, grouped by the family `describeSemanticKey` already returns and labelled
by the descriptor's own `label` — the same two things `requiredDeviceGroups` reads,
which stays the host's separate answer about which *slots* to ask about (§145). A
theme that binds nothing has no sensor values and matches no sensor selection; that
is a fact about the theme rather than a gap to fill. A key with no descriptor in
this build is still listed, labelled by its key, because the alternative is a theme
that reads something invisible to search.

**Shape is three readings of two numbers.** `artboard.width` and
`artboard.height` are already authored and already validated, and orientation,
aspect ratio and pixel size are what a person can read off them — one source,
three questions, and nothing new to author.

- **Orientation** is landscape, portrait or square, and square is exact equality
  rather than a tolerance band: the two numbers are the author's own, and an
  artboard of 1000×1001 is not square.
- **Aspect ratio is bucketed, and the bucket is published.** An artboard may be any
  size up to 16384, so the exact ratio would be a facet with one value per theme.
  The set is 1:1, 4:3, 3:2, 16:10, 16:9, 21:9 and 32:9 together with each one's
  portrait inversion, and the nearest is chosen by comparing `width / height` in
  log space, which is the comparison that treats 16:9 and 9:16 as the same
  distance. **A theme further from every bucket than the tolerance is `Other`** —
  never the nearest wrong bucket, because a facet that files a 2.35:1 artboard
  under 21:9 is a facet that lies about the thing it exists to filter.
- **Pixel size is exact**, and the facet offers the sizes **more than one theme
  declares**, largest first. A facet of one-off sizes is a list of themes wearing a
  filter's clothes; every other size is reachable under `Other`, and the exact size
  is on the detail modal either way.

**The facet does not reshape the tile, and that is a cost worth naming.** The grid's
boxes stay uniform and the picture is covered, so a portrait theme is cropped in the
grid. Seeing a theme at its own ratio is what the detail modal is for, which is one
of the reasons it exists rather than being a nicety.

**Within a facet the values are OR, across facets they are AND — except Sensors and
Shape, where they are AND.** Two facets ask a question that only *all* of a
selection can answer, and for the same reason: a theme must read every sensor you
asked for, and it must have every shape property you asked for. "Themes that use
CPU **and** GPU" is one selection that must not return a CPU-only theme, and
"landscape 16:9 at 1920×1080" is one shape, not three alternative ones. Inside
Shape, the three groups are therefore AND with each other and OR within themselves,
which is the same rule one level down. Author, colour mode and style take the
ordinary reading, where selecting *nature* and *cityscape* asks for either. This is
the one place the rules differ, and they differ on purpose.

**Style tags are the one thing this adds to the format, and they are picked, not
typed.** An author chooses from the tags that already exist; the field offers the
vocabulary, and **a new tag is proposed only when nothing in it fits**. That
ordering is the whole mechanism, and it is what keeps the facet enumerable without
an enum: free text as the *first* affordance puts *sci-fi*, *scifi* and *science
fiction* into the catalogue as three tags with one theme each, and the browsing
this section exists to serve is what suffers. A proposal is a deliberate act with
a reason behind it; a typo is not.

**So the format validates the shape and the store owns the vocabulary.** A tag is
lowercase — `[a-z0-9-]`, one to twenty-four characters — and a theme declares at
most five. That is what `renderer-core` and `schema/theme-document.schema.json`
enforce, and it is the whole of what they enforce: **there is no enum to mirror
into `envelope-keys.ts`**, because a tag the vocabulary does not yet know has to be
writable before the vocabulary can grow to include it.

**The vocabulary is what exists, and it grows through the same PR as its first
use.** The Style facet enumerates the tags present in the catalogue, so the
vocabulary *is* the catalogue's own content and needs no second file to fall out of
step with. The editor offers the shipped seed list when it is offline and the
catalogue's own tags when it is online. When an author proposes one, the submission
carries the tag and the theme that uses it in a single diff, so the reviewer
approves the word and its first use together — which is the only review that can
catch a near-synonym, and is a person's judgement rather than a schema's.

**What that costs, named rather than discovered.** A theme can carry a tag no other
theme has, and the facet will show it with a count of one. That is the price of not
blocking an author on a vocabulary change, and it is the price the user chose: the
alternative is a closed enum in the format, where a new style waits for a schema
release before anyone can use it.

The authoring surface is `panes/document/metadata-fields.tsx`, which already
carries `name`, `author`, `description` and `themeLanguage`: tags are a field
there, not a new surface.

**This is a change to the published format, and its consequence is named rather
than discovered.** `metadata` is `additionalProperties: false`, so a build older
than this one refuses a tagged theme as an unknown field. Pre-release internal
architecture may break cleanly, so v2 gains the field without a version bump — what
must not happen is a tagged theme reaching a user on an old build and being
reported as corrupt.

**Tags belong in `theme.json` and provenance does not, and the difference is the
test the earlier ruling already used.** Provenance is a fact about *this machine's
copy*, which is why it is consumer state; a tag is a fact about *the theme*,
authored by whoever made it, and it has to travel in the package or the catalogue
cannot be filtered by it.

## The gallery, and paging

The store is a gallery of pictures, so it is a grid and not a list of rows: a
thumbnail, the name, the author and the badges, in a cell sized by the window.

**The grid is CSS, and it is responsive without a breakpoint list.**
`repeat(auto-fill, minmax(<cell>, 1fr))` answers the column count from the
available width, so there is no resize listener, no measured column count, and no
second copy of the window's size to keep in step — and no invented breakpoints
either. **The minimum is the cell's content, not a column count**: a cell has to
hold a name, a badge and four 26px actions inside its own padding, and 240px is
where that lands. §7.8's rule is the one that binds — *measure labels, hit areas
and contrast at the real pane width before changing column count; reduce columns
only for an observed overflow or readability failure* — so the column count is
observed rather than asserted, and the proof is §7.7's own: 1280×720, 1440×900 and
200% browser zoom. **The phone layout is `vg-172`'s recorded limitation and this
design does not claim to fix it.**

**What is not automatic is the facet row, and that is the one responsive decision
made here.** It wraps to a second line rather than dropping a control, because a
filter that has silently gone missing is worse than a row one line taller.

**A thumbnail has no known aspect and may be absent.** The store keeps whatever PNG
was captured, inside its byte bound and under no shape rule
(`themes/thumbnails.ts`), so a cell is a fixed-ratio box and the picture is
`object-fit: cover` within it. A theme with no picture is a flat tile of its own
artboard background rather than an empty box: the library already treats a missing
thumbnail as ordinary, and a grid of holes is not a gallery.

**Paging is client-side, and that is not a shortcut.** The local half is a folder on
this machine, and the online half is one static `index.json` fetched whole, so
neither has a page to ask a server for. The upgrade path is named where it would be
needed — sharding `index.json` when the catalogue outgrows a single file.

The pager sits at the bottom of the list, above the status bar, and it is a
**numbered** one: a step back, then the five pages nearest the current page, then a
step forward, with the first and last always reachable and an ellipsis standing for
what is skipped — `1 … 4 5 [6] 7 8 … 12`. Five rather than every page because a
catalogue of four hundred items has thirty-four pages and a row of thirty-four
numerals is not navigation; and a catalogue of seven pages or fewer shows them all
with no ellipsis, because at that size the numbers *are* the list. The current page
carries the same chosen treatment every other chosen thing in this store carries —
a raised background and a `--text` numeral — and never an accent fill (§4). Beside
the numbers, the per-page choice of 12, 24, 48 or All.

**The page size is a view preference and persists; the filter and the sort are a
query and do not.** It is stored the way the shell's own palette choice already is
— a namespaced key in the shell's `localStorage`, with the read/write/clear trio
`editor-shell/palette.ts` establishes — because that is what this is: a preference
about how this viewer sees this surface, not consumer state the host owns and not
theme data.

**Changing a filter returns to page one.** Otherwise a narrower result leaves the
viewer on a page that no longer exists, which reads as an empty store.

**An empty result is a sentence, not an empty grid**, and the two empties are
different sentences because they have different answers. A library with nothing in
it: *"No themes are saved on this PC yet."* with *"Build one in the editor, or
import a package."* below it. A filter that matched nothing: *"No themes match
these filters."* and the way out is clearing them — never the first-run sentence,
which would tell someone with forty themes to go and build one.

**§5 grows one control, and the rest is composition.** A checkbox choice row is
absent from the closed vocabulary — rule 7 describes a radio group — so it is
added to DESIGN.md in the same commit that draws it rather than exempted locally.
Everything else here is made of what §5 already names: the facet button is the well
idiom with a chevron and a count; the cell is a panel; the per-page choice is a
well; and the pager is §5's icon button — whose glyph is a numeral, which is still a
glyph — around the same chosen treatment the facet value and the mode switch item
already use. **The cell's four actions stay visible rather than moving into an
overflow menu**, because §8 puts disclosure on the once-in-a-while and opening and
assigning a theme are the frequent acts of a theme library.

## The item's own surface

The gallery answers *what does this look like*; it cannot answer *what is this*. A
cell has room for a name, an author and a badge, and the facts that decide whether
someone wants a theme — its description, its version, when it changed, which
sensors it reads, its shape, its tags, its counts — do not fit and should not be
crammed into one.

**So a cell opens a modal, and it is one modal for every kind.** The subject is an
item, not a theme: `kind` is already the seam the storefront reads (§ "The item,
and why `kind` is the seam"), so the dashboard theme's modal is the first of three
rather than a surface the widget preset will need its own version of. What changes
with the kind is which sections the modal has, not which modal it is.

It is § "Elevation & Depth"'s level 3, like the settings modal: radius 8, the
`0 24px 60px` shadow over the scrim, dialog padding from §3's 20–24 band, and a
`--text-lg` title. It holds:

- **The preview at the theme's own ratio**, which is the one place a portrait
  artboard is seen uncropped — the grid's boxes are uniform and cover the picture,
  and § "Finding a theme: the five facets" says why.
- **What it is**: the name, the author, the description, the `kind`, the version,
  and the dates.
- **What it reads**: the derived facets, spelled out rather than as facet values —
  the colour mode, the orientation, the aspect ratio, the pixel size, and every
  semantic key with its descriptor's own label.
- **Its tags**, and where a proposed tag says so.
- **Its counts and its state** on the online half, and the origin and local state
  on the local half.
- **Its actions**, which are the same commands its cell offers. That is one command
  reached two ways rather than two owners: the cell keeps them because they are
  frequent (§8), and the modal shows them because it is the surface someone is
  looking at when they have just read enough to decide.

**Opening it is not a document change and not a mode change.** Escape closes it and
returns focus to the cell that opened it (§5's keyboard rules already say so for a
popup and its trigger), and it does not disturb the filter, the sort or the page
underneath — closing it puts the viewer back exactly where they were, which is the
same invariant the mode switch has.

## Import lands in the library

Today a package the author brings in becomes an open *document*
(`editor-main.ts`'s picker → `parseThemePackage`) and reaches the library only if
they then press Save to library. Ruling 2 makes import a library write, so an
imported theme survives the editor closing and appears in the local list.

The host gains one route: package bytes in, `readThemePackage` — the §141 reader
it already depends on — then `ThemeStore.write` and `ThumbnailStore.write`. **The
host validates, not the browser**, because the host owns the folder the bytes land
in and §141 is its contract.

**The id rule.** The envelope's own `id` when it is valid and free; otherwise the
next free id derived from `metadata.name`; otherwise a suffixed one. **Import
never overwrites.** A taken id gets a suffix, so re-importing your own export
makes a second entry rather than replacing the first. Additive is the safe
direction and the duplicate is visible and deletable, where a silent replace is
data loss with no undo.

## Provenance: what makes "Installed" true

Nothing today links a library folder to the catalogue item it came from. Without
that link the surface cannot tell a theme you made from one you downloaded, cannot
offer an update, and cannot say *Installed* at all — which is the whole of what
ruling 1 asks the online tab to show.

**The record is consumer state**, beside `active-theme.json` and
`theme-answers.json`: a `theme-origins.json` keyed by library id, holding the
catalogue id, the version installed and when. It is swept when the theme is
removed, exactly as `ThemeSettingsStore.remove` sweeps answers.

**Why not a stamp inside `theme.json`.** That would change the exchange unit, the
validator and the package — the one thing this design's leverage claim rests on.
Where a theme came from is a fact about *this machine's copy*, the same category
as the per-theme answers already stored that way, and ADR-0017 forbids a silent
folder↔package sync.

**What it answers in v1:** *Installed*, and *Update available* when the
catalogue's version is newer than the recorded one. **What it does not answer
yet:** *modified locally*, which needs a content hash stable across a store round
trip — a property `contentId` may or may not have, and therefore a one-line probe
during implementation rather than a promise now. If the probe passes the row
gains the third state; if it fails, the third state needs its own decision.

The listing route joins origins onto `/api/themes`, so the client needs one fetch
for the local half. `ThemeStore` itself stays unaware of origins: it owns folders,
not where they came from.

## Media: two of three caps exist, and the third is what makes them reachable

Video is expected to be common, and `§139` puts assets *inside* the package, so
an unbounded video makes package size unbounded — which is the one thing that
breaks a zero-cost host. The normalizing rules below are what turn hosting from a
gamble into a budget.

**Size cap — already exists (32 MiB per asset, 128 MiB total).** A cap alone
refuses without letting an author predict the outcome, because
**bitrate × duration** is what fills it.

**Duration cap — proposed at 30 seconds.** At the existing per-asset cap against
a 1080p background loop (realistically 3–8 Mbit/s at CRF 22), 30 seconds lands at
roughly 22–30 MiB and fits with headroom. The total cap then gives the number
that decides hosting: **worst-case package is 128 MiB, so worst-case egress per
download is known before a host is chosen.**

**Resolution ceiling — proposed at 1920 on the long edge.** Without it, a 4K
source halves the permitted duration for no visible gain at dashboard size.

### The publish-time normalizer

An author-facing helper resizes and re-encodes a source video into the envelope,
so the store receives a predictable artifact rather than whatever was recorded.
Reuse `§171`'s shape — images are already downscaled on import past a bound — and
apply the same rule to video.

The envelope, each item earning its place:

- **MP4 with `+faststart`**, so playback and seeking start before the whole file
  arrives.
- **H.264 High, `yuv420p`** — 4:2:4 silently fails to decode in some browsers.
- **Even width and height** — H.264 requires it; odd dimensions fail silently.
- **Constant frame rate, ≤ 30fps** — and this one is Vigilia-specific:
  `scene-fabric/src/background-media.ts` repaints the scene once per decoded
  frame via `requestVideoFrameCallback`, so a variable cadence becomes a variable
  repaint rate.
- **No audio track.**
- **Single-pass CRF ~20–23**; 2-pass buys little on a background loop.

Four rules that keep the normalizer honest:

1. **Normalize to a bound declared in the theme, not to the live artboard
   resolution.** Artboard resolution moves — `§53` fit modes and the device-lens
   work were about a theme rendering at different shapes. A crop baked to today's
   artboard is silently wrong after an artboard edit, and re-normalizing costs a
   generation. Offer `cover` and `contain`, default to preserving the source
   aspect, and let the scene do the framing.
2. **Verify by probe; never re-encode to validate.** CI cannot re-encode
   deterministically across ffmpeg versions. The author normalizes locally and
   the store **probes** the result against the envelope, rejecting out-of-bounds
   input before anything is revived — a property check, not a byte derivation.
3. **Idempotent pass-through.** A file already inside the envelope is copied
   byte-for-byte. Otherwise every resubmission degrades the loop.
4. **The author previews the normalized asset, not the master.** Write it as an
   explicit derived asset in the theme folder — not a silent folder↔package sync,
   which `0017` forbids.

**How the normalizer gets ffmpeg is an open decision**, and it is a licence
question rather than a footnote: a system `ffmpeg` probed at runtime adds no
shipped dependency but requires the author to install it; a bundled static build
is convenient but carries GPL parts such as x264, which pulls in
`THIRD-PARTY-NOTICES.md` and packaging obligations. Leaning: probe and refuse.

## The rename, which still lands alone

`publish` currently means *editor → host, so the paired phone or display shows
it* (`POST /api/publish`, `/api/published`, `publish.surface`,
`publishableDocument`, `publish-loop.spec.ts`). Two different acts sharing one
word is the problem, and the owner's ruling of 2026-10-12 is that the existing
route is renamed rather than the store finding a second word: **publish** — an
author sends an item to the store; **submission** — a publish from an unverified
author, awaiting review; **listed** — passed review and in the catalogue.

The replacement word is **still not decided**: `activate` collides with
keyboard-activating a focused control in `viewport-manager/navigation.ts`, and
`cast` and `go live` are the clear candidates. The rename is a family — the
route, the `published` store in `server.ts`, its revision accessor, the
`publish.surface` chord and `publish-loop.spec.ts` — and it touches
`host/src/server.ts`, a watched path, so it needs its own decision note.

**It is not on this work's critical path**, which is why it stays a prerequisite
that can land alone rather than a phase below. The one thing it must not do is
land *after* submission ships, because then the store owns a word the route
already uses.

The three-mode top bar was the second prerequisite. The rulings above fold it
into this document, so it is now § "The shell" and the first phase below rather
than a spec of its own.

## Landing order

Per-display assignment first — its own spec and plan, per ruling 6 — then this
document's plan, in phases that are each useful on their own:

| Phase | Lands | Needs |
|---|---|---|
| **A** | the three-mode shell; the store mode's local half as a gallery, with the facet record, the facet row, paging and the item modal; and the Host settings mode absorbing this PC | the per-display spec's assign action; `shell-layout.tsx`'s decision note |
| **B** | the origin record and the *Installed* badge | A |
| **C** | the online tab, read-only: the catalogue repo exists, `index.json` is generated with each item's derived facet record, browse, filter and sort work, and the item modal gains its online facts | a public repo and one Action; **not** open question 1 |
| **D** | install: download, validate, write to the library, record the origin | C, and **open question 1 decided** |
| **E** | submission: the device flow, the fork-and-PR client, CI validation and the auto-merge Action | D |
| **F** | the publish-time normalizer and the duration and resolution caps | E, and open question 2 |
| **G** | the style-tag field: the format's shape rule, the editor's pick-or-propose control, and the Style facet | A, and **open question 7** |

**A is the phase that answers ruling 1**, and it needs no catalogue, no token, no
`index.json` and no hosting decision. **C is the last phase that dodges open
question 1**; everything after it depends on where the bytes live, which is why
that question is the first thing D waits on rather than a footnote.

**G is the one row out of order.** It needs only A, and it must land before C so
the first `index.json` the Action generates already carries tags, rather than the
record's shape changing inside C's window. It is lettered last because A–F are
already referred to by letter in the acceptance below and in the register.

## Open questions

Each needs a decision before implementation, and each is recorded with the shape
of the decision rather than a placeholder:

1. **Hosting the bytes — and the app-opened PR has made this sharper.**
   *Deferred by the user on 2026-10-15; the candidates and the new constraint are
   recorded here so the deferral is not a silence.* Release assets belong to one
   repository, and an author's app can only upload to **the author's own fork's**
   releases. Left there, every listed item would point into a stranger's fork:
   the author can delete it and break every item, removal cannot be enforced, and
   the store's own asset counter ceases to exist.
   - **A (leaning) — the fork carries the bytes during review; merging re-homes
     them.** The app uploads to the author's fork release, `item.json` references
     it, reviewers download from there, and a post-merge Action in the upstream
     repo downloads it, uploads it as an upstream release asset and rewrites the
     URL in a follow-up commit. Keeps native `download_count` and store-owned
     bytes, and no secret ever reaches a fork PR. Costs one exception to "the PR
     diff is the review instrument" — the merged `item.json` is not byte-identical
     to the submitted one — and a video is downloaded twice (once at merge, once
     per user).
   - **B — the package rides in the catalogue repo beside `item.json`.** No
     releases and no re-homing, and the diff shows everything including the
     bytes. Costs up to 128 MiB per item in git history permanently, and GitHub
     exposes **no download count for repository files**, so "downloads" stops
     being a sort.
   - **C — an object store with signed uploads.** It is a server, which is the
     one premise this design rests on. Recorded only to be dismissed.
2. **The ffmpeg source** — probe a system binary, or bundle a static build and
   take on the licence obligation.
3. **`index.json` freshness** — how often the scheduled Action regenerates it,
   which sets how stale a favorite count can be.
4. **Moderation beyond the review gate** — the owner reading a diff catches a
   broken item; it does not catch objectionable imagery in a thumbnail or a
   background video. Who looks at the pixels, and when.
5. **Removal** — what happens to a listed item later withdrawn, and whether
   download counters survive it. The re-homing choice above changes this: if the
   bytes live on the store's own release, removal is enforceable; if they live on
   a fork, it is not.
6. **The two addenda** — a widget-preset package and an editor-theme artifact,
   each settled before its kind reaches the store. The editor theme's is a design
   question (what a token artifact is), and the widget preset's is a sequencing
   question (§139 waits on an authoring workflow).
7. **The shipped seed vocabulary** — which tags the editor offers before it has
   ever seen the catalogue. The ruling of 2026-10-17 fixed the mechanism and the
   *online* vocabulary (it is the catalogue's own content, so it needs no separate
   list), and the user's own examples (`futuristic`, `retro`, `modern`, `elegant`,
   `classic`, `nature`, `cityscape`) are the seed rather than the answer. It matters
   because an author working offline has nothing else to pick from, and because the
   seed is what the first proposals are measured against. Phase G carries this
   question rather than shipping the field with an empty list.
8. **The aspect-ratio buckets and their tolerance** — the set named in § "Finding a
   theme: the five facets" is a draft from the sizes dashboards actually are, and
   the distance at which a theme falls to `Other` is a number nobody has measured.
   Both are cheap to change later and both change what the facet says, so they are
   decided with the facet rather than guessed here.

## Not verified, and must be before this is planned

Free-tier limits decide feasibility, so each is a probe rather than an assumption:

- **The device flow against a public client**: that the scope needed to fork and
  open a PR on a public repo is grantable, and what the token's lifetime and
  revocation behaviour are.
- **Release assets on a fork, and a post-merge re-home**: that an Action can read
  a fork's release asset and publish it upstream, and that `download_count`
  survives the move.
- Per-file size caps on the CDN used to serve `index.json` and thumbnails, which
  determine whether it proxies metadata only or can also serve packages.
- Release-asset size ceilings, and Actions minutes on a public versus private
  repo.
- Whether the CDN in front of release assets is viable at all for multi-megabyte
  packages, given its per-file limits.
- Whether `requestVideoFrameCallback` cadence actually suffers under a variable
  frame rate in this renderer, or whether the envelope rule above is defensive
  without a measured reason.

## The repo's own gates still apply

- `AGENTS.md`'s reuse gate: all seven rungs (owner, dependencies, platform,
  ecosystem, comparison, probe, build) recorded before the first write, at
  `docs/decisions/NNNN-<slug>.md`. **The hydra-themes study is rung 5's evidence
  for the theme half and only for that** — it is one ecosystem comparison of a
  store over a git host, and it covers a single kind with a CSS mechanism this
  product cannot use. Rungs 4–5 still have to be run for the submission mechanics
  the app-opened PR introduces (OAuth device flow, fork-and-PR from a desktop
  client), which the reference does not exercise at all.
- `host/src/server.ts` is a watched path in `scripts/reuse-gate.mjs`, so a
  decision note must claim it before the first edit there.
- **The facet record and the tag vocabulary land under a watched path too.**
  `renderer-core/src/theme/` is on the same watchlist, so each of them owes its own
  decision note with all seven rungs worked before the first write there — and the
  facet derivation is the one that needs rungs 4–5 honestly, because "derive a
  theme's facets from its envelope" is a shape other products have solved and the
  note has to say what was searched rather than that nothing was found.
- **§5 grows one control, and that is a DESIGN.md change in the same commit.** A
  checkbox choice row is absent from the closed vocabulary — rule 7 describes a
  radio group — so it is added there rather than exempted locally. Nothing else
  this adds is new vocabulary: the facet button, the cell, the pager and the
  per-page well are compositions of what §5 already names.
- **The rename can still land alone.** The top bar no longer can: the rulings
  above fold it into this document, so it is the first phase rather than a
  prerequisite that ships separately.
- **The drawings are part of this design, not decoration.** The store mode, the
  Host settings mode and the bar are new surfaces, so the checked set at
  `docs/design/mockups/current/` gains a file per new view, `shell.html` is
  redrawn because the bar changes its header and rail, and the README's table and
  count move with them. **Rulings 7 to 9 redraw the store mode's two files a second
  time**, from rows to a gallery with the facet row and the pager, because a drawing
  that still shows the list is a drawing of a surface this document no longer
  specifies — and they add two more files, because a popover and a modal are views
  no other file can carry. Four files, one view each. Three rules bind that work rather than being discovered
  during it: **every new drawing is read by something** — the drawings gate walks
  the directory (`currentDrawings()`), so a new file is held to §3's spacing, §2's
  type, the radius table, the elevation levels and the 1px hairline rule the moment
  it exists, without being registered anywhere; `mockup-values.ts`'s path constants
  and `PARITY` rows are the *second*, narrower reading, for a drawing whose values
  must match the built product rather than only obey the scales; **the copy is the
  product's own**, taken string by string
  from `ui-copy.ts`, so a new surface's words are decided here and land in
  `ui-copy.ts` in the same change as its drawing — the facet labels, the pager's
  words and the empty state are this design's own new strings; and **one drawn view
  per file**, because the reader's `[style*="…"]` selector refuses to settle
  between two elements carrying the same declaration. The pending settings-pane
  redraw touches the same set, and neither change may be written as if the other
  does not exist.
- One implementation plan is active at a time. When this is picked up it becomes
  a plan that queues behind whatever `STATUS.md` names that day.

## Acceptance

The spec is accepted when the user says so. **The work is accepted per phase**,
each on its own phase gate, and each item below is something a person can see:

- **A** — the top bar switches between the three modes; the local half is a gallery
  whose cells show a picture, a name and an author; the facet row narrows it by
  author, colour mode, sensors and shape, a theme that binds nothing is matched by no
  sensor, and a theme with no derivable ground or an unbucketed ratio is still
  reachable under "any" and "Other"; paging holds, its numbers show the pages
  nearest the current one, and the page size a viewer chose is still theirs after a
  reload while a filter is not; a cell opens the item's modal, which shows the
  theme's preview at its own ratio and closes back onto the same page, filter and
  sort; a package imported from a file appears in that list and survives closing the
  editor; a theme is assigned to a display from its cell; switching modes with an
  unsaved document loses nothing; the grid is checked at 1280×720, 1440×900 and 200%
  zoom with every facet still reachable; and `settings.html` no longer lists themes
  while `/settings` and `/library` still work in a plain browser.
- **B** — a theme installed from a catalogue item reads *Installed*, and the mark
  survives a restart because it is read from the origin record rather than held in
  the session.
- **C** — the online half lists the catalogue's items with their kind, counts and
  dates, and the same facets filter and sort them; an item's facets are the ones
  derived from its merged `theme.json`, not fields an author wrote into
  `item.json`; the modal shows its counts and its installed state; and an item whose
  `kind` this build does not know is skipped with the reason shown rather than
  breaking the listing.
- **D** — Install puts a working theme in the library and records its origin, and
  the item then reads *Installed*; a package that fails §141 is refused with the
  reason and the library is unchanged.
- **E** — an author with a GitHub account submits a theme from the library and the
  PR appears; an unverified author's PR waits for review; a verified author's own
  PR auto-merges only when validation is green *and* the diff touches only their
  own `catalogue/<id>/` path.
- **F** — a video past the duration or resolution bound is refused before
  submission with the bound named, and one inside it is copied byte-for-byte on a
  second run.
- **G** — an author picks a tag from the ones that exist; a tag that is not in the
  vocabulary can only be proposed deliberately, and the submission carries the
  proposal and the theme that uses it in one diff; the tag is lowercase and the
  format refuses one that is not, refuses a sixth, and accepts a tag the vocabulary
  has never seen; the Style facet counts it; and a build older than this one refuses
  a tagged theme as an unknown field rather than reporting it as corrupt.

**What closing `vg-388` means, and the conflict this settles.** Phase 24 of the
backlog drain says `vg-388` closes when the store "carries all three kinds as
specified rather than the theme half alone", and v1 cannot satisfy that: it ships
the dashboard theme, with the widget preset and the editor theme as addenda. So
the row's closure condition is **the storefront plus the dashboard theme**, and
the two addenda become rows of their own. The plan's acceptance line and its
failure-mode line are the text that must move with it; leaving them is how a row
stays open against work that is done.
