# Per-display themes — design

- **Status:** draft 2026-10-18, revised the same day for acceptance; no plan yet
- **Register:** `vg-574` — *Each display client holds its own theme and its own
  theme-specific settings*
- **Lands before:** `2026-10-12-theme-store-design.md`'s phase A, which consumes
  this document's assign action and does not restate this model.

## What this is, and is not

**It is** the model for a display client: what one is, how it is named, which
theme it holds, and which answers that theme's questions on that display — for
both kinds of client, a paired one on the LAN and the host's own monitors.

**It is not** the storefront (the store spec), the display's own settings panel
or keep-awake (`vg-576`), the installable player (`vg-577`), launching a browser
on a local monitor (§ "The host's own monitors" specifies the display and hands
over a command line), or where the assignment is drawn — the store spec's Host
settings mode and its local tab own that surface.

## The intent

The user ruled on 2026-10-17: the app is to serve multiple display clients, each
with their own theme and that theme's own settings, and the store's activation is
built per-display from the start rather than against the single-theme model and
reworked later. Success is that a second screen shows a different theme from the
first, that the choice survives a restart of the host, and that the questions a
theme asks are asked once per display rather than once per PC.

## What the 9remote study contributes, and what it does not

`decolua/9remote` was read on 2026-10-18 at the user's suggestion, for its device
pairing and management, at `033dd6e3`. What it actually does, read from its files
rather than its README:

- **Two credentials with two lifetimes, side by side.** A **one-time key** with a
  live countdown and an expiry, and a **permanent key** beside it. Regenerating the
  one-time key warns that the current one expires immediately; regenerating the
  permanent one warns that it **disconnects every existing session**
  (`host/ui/src/components/QRCard.jsx`).
- **The one-time key is drawn to be typed**, not only scanned: monospace,
  `letter-spacing: 0.18em`, a countdown, and an expired key shown as dots rather
  than as a dead value. The QR is one route to the same key, and the card writes the
  endpoint out beside it.
- **The human alphabet excludes the glyphs people confuse** —
  `ABCDEFGHIJKLMNPQRSTUVWXYZ123456789`, so no `O` and no `0`
  (`host/lib/pairingCode.js`).
- **A short code is defended by rate limiting rather than by length**: five failures
  per key head, an exponential penalty from one second to sixty, a one-hour window,
  a pending cap, and a twenty-second proof deadline.
- **A mismatch burns the code only when the presenter named *this* code**, so a
  stale code's wrong guess cannot kill the live pairing window.
- **Admission is one decision table for every carrier** (`gateDevice`): approved,
  auto, rejected or unknown, over a persisted `approvedDevices.json`. A **kicked**
  device asks again even with auto-approve on — *"the host's explicit Disconnect
  must not be instantly undone"* — and rejected and kicked are RAM-only, so a
  restart clears them.
- **A reserved local-UI id** is dropped from legacy files because it is *"never a
  real client"*.

**What transfers.** The two-key split, which is the answer to § "Pairing a display
that has no camera"; the unambiguous alphabet; the countdown and the
hidden-when-expired rule; rate limiting and burn-on-mismatch as the defence for a
code short enough to type; one admission table in which kicked outranks
auto-approve; and the reserved local id, which this design had reached
independently as `this-pc`.

**What does not transfer, and why it matters.** 9remote pairs a device to a **cloud
relay** — a Worker, a `workerUrl`, a hosted endpoint — so its one-time code is
revoked *at the Worker* and its permanent key is a bearer credential for a service
somebody runs. Vigilia's premise is the opposite: no server, no recurring cost, and
browsing that touches no API. A one-time code here is revoked in the host's own
process and expiry is the only revocation it needs, and the card has no endpoint to
write but this PC's own address. Their device *management* transfers whole; their
device *transport* does not transfer at all.

## Today, read from the code

- **One theme per host.** `host/src/settings/active-theme.ts` stores
  `{ id }` in `active-theme.json`, with `read(exists)` treating a theme deleted
  since it was chosen as no choice at all.
- **One resolution order, and it is host-wide.** `server.ts`'s `GET /` answers
  the author's published theme, then `?theme=`, then the chosen theme, then the
  only theme when the library holds exactly one.
- **Answers are keyed by theme alone.** `settings/theme-settings.ts` stores
  `Record<themeId, Partial<Record<AssignableGroup, string>>>` in
  `theme-answers.json`, and `currentAssignment()` (`server.ts`) resolves
  `perTheme[group] ?? stored.assigned[group]`.
- **A display's only identity is a short-lived token.**
  `session/pairing.ts` holds `DisplaySession { token, label, createdAt, expiresAt }`
  in an in-memory `Map` with a 12-hour TTL, deliberately: *"a leaked token must
  stop working on its own."* The token rides in the page URL as `?session=`.
- **Loopback is trusted admin and is never paired** (`allowed()`), and
  `/api/themes/active` is loopback-only for both its read and its write.
- **The library is not loopback-only.** `GET /api/themes` sits behind the *display*
  guard (`server.ts`), so a paired display can already list this host's themes.
  That one fact is why ruling 11 costs a branch rather than a surface: the chooser's
  contents are already reachable, and only the write was missing.
- **A display already polls for change.** `player/src/publish-follower.ts` reads
  `/api/published`, which answers `{ id, revision }`.

## What a display is

**A display is a client that shows a theme, not a panel.** A PC with two monitors
showing the same page is one display; two browsers on one PC are two. This is
worth stating because "display" in the user's own words means the screens, while
everything that can hold an assignment is a client — and the code can only ever
see a client. **A monitor is a place a client is asked to appear, not an
identity**: the same page dragged to another screen is the same display, and a
screen with nothing on it is not a display at all.

**There are two ways a client becomes known**, and the difference is only how it
was admitted:

- **Pairing** admits a client on the LAN, which needs a credential because the
  host cannot otherwise tell one client from another.
- **The host's own monitors** are admitted by being *specified* on this PC
  (§ "The host's own monitors"): no code, no credential, because the host is
  starting a client on its own machine for itself.

**Admission is the only difference; everything after it is shared.** A local
monitor is a display with no credential, so the per-display map, the answers map,
the resolution order and the two writers all apply to it unchanged. That is the
whole reason the kind is a field on one record rather than a second subsystem.

**The assignment is a key in one map, and it has two writers.** Admission is how a
client becomes *known* — it gets a name on this PC and appears in the list. What
that display shows is a separate fact: **this PC** may set any display's theme or
the default, and **the display itself** may set its own and nothing else. The
second writer is ruling 11 (§ "A display may change its own theme"), and it costs
one branch on one route because the authority is *derived* from the session rather
than claimed in the body.

Three clients are displays, and a fourth is not:

| Client | Identity | Registered | Its theme |
|---|---|---|---|
| **This PC's own screen** — the root page on loopback | the reserved id `this-pc` | implicitly; never paired, because loopback is already trusted admin | assigned like any other, and the default until it is |
| **A local monitor** — a browser the host specified, on this PC's own second screen | a display record's id, minted when the owner adds it | by being specified on this PC; no code, no credential | assigned like any other |
| **A paired LAN client** — a phone, tablet, TV or installed player | a display record's id, minted at pairing | by pairing, which is the only way a LAN client gets a record | assigned from this PC; the default until it is |
| **An unpaired reader** — anyone else who opens the root page on the LAN | none | **no, and it is not a display** | it reads the default, because a reader with no record cannot be assigned to |

**The last row is the one worth stating plainly**: an unpaired reader is not a
display that has been given a theme, it is a page being served the default. It
becomes a display by being paired, and until then there is nothing to assign a
theme to. That is also why pairing is an admin action on this PC rather than
something a client can do for itself — a client that could register itself could
give itself a name on the list.

## The host's own monitors

The user's second requirement, 2026-10-18: beside a remote display over the LAN,
**a host's own secondary monitor running a lightweight fullscreen browser**, which
needs no pairing because it is the host's own screen — the host just specifies it.

**The host can already enumerate monitors, with no new dependency.**
`systeminformation` is a host dependency today (`packages/host/package.json`), and
its `graphics().displays` answers per-monitor facts — probed on this PC, 5.33.13
returns one entry carrying `deviceName` (`\\.\DISPLAY1`), `model`, `serial`,
`main`, `positionX`/`positionY` and `currentResX`/`currentResY`. Those are exactly
the two things this needs: an identity to point a display at, and the geometry a
fullscreen browser has to be told. **Only one display is attached to this PC**, so
the multi-monitor case is reasoned from the shape of that answer rather than
observed, and it is in the unverified list.

**A local monitor is a display record with `kind: "local"` and no `tokenHash`**,
minted when the owner adds it, and removable like any other. Its id obeys the same
pattern and is minted from the same slug rule, so the answers file accepts it and
nothing downstream learns a second shape.

**It is resolvable only from loopback, and that is the invariant that makes a
credentialless display safe.** A local monitor is reached at
`http://127.0.0.1:<port>/?display=<id>`; a request that names a local display from
off this PC is refused, because otherwise anyone on the LAN could send
`?display=<id>` and take that screen's theme — the exact claim § "Identity" says a
client may never make. Loopback is already trusted admin (`allowed()`), so a
loopback request naming a display is not a client claiming an identity, it is the
admin choosing one.

**A local monitor is immune to everything in § "Finding the host after its address
changes"**: it is on this PC, reaching `127.0.0.1`, so there is no address to
change, no name to resolve, no sweep, and no code. It is the one display that
cannot be lost by a router handing out a new lease.

**The monitor a display points at is a hint, and losing it must not lose the
theme.** The record stores what the owner chose — `serial` when the monitor reports
one, otherwise `deviceName` — and the geometry is re-read on each start rather than
stored, because a resolution change is not an identity change. A record whose hint
matches no attached monitor **stays in the list and keeps its theme**; it simply
is not on a screen, and the Host settings mode says so. The alternative — deleting
a display because a cable moved — would throw away the person's configuration to
report a fact about the furniture.

**`this-pc` is the same kind, and stays reserved.** It is the local display for
whatever screen the host's own page is on, which is why the reserved id and the
specified monitors are one concept rather than two: `this-pc` is the local display
nobody had to add.

**Adding one is a Host settings action**: name it, pick a monitor from what
`graphics().displays` reports, and the host answers with the URL to open and the
monitor's geometry.

**Ruling 13: the host launches the display, and it registers itself to start at
sign-in.** The user ruled this on 2026-10-18, overruling this document's earlier
recommendation that the owner run a shortcut: *"It needs to survive host app
restarts & computer reboots, else it's useless if user have to manually reopen it
everytime."* That is right, and the earlier recommendation was wrong for the
reason it gave — a wall display nobody reopens is not a display.

**The launcher is not a new subsystem: this codebase already launches and
registers a child process.** `providers/lhm-launcher.ts` does every part of it for
LibreHardwareMonitor — `registerLhmTask` creates a `schtasks /SC ONLOGON` entry,
`hasLhmStartupTask` reads the task store to see whether it exists, `launchChild`
spawns a host-owned child (`detached: false`), and `launchLhm` **probes before
launching** so an already-running instance keeps ownership of itself and reports
`{ started, reason, stop }`. So the display launcher is that shape with a browser in
place of LHM, and the reuse gate's rung 4 is passed by an existing file rather than
by argument. (`cli/net.ts`'s `openBrowser` detaches and unrefs instead, because it
opens a browser *for the owner* that must outlive the host — the opposite case, and
worth not copying here.)

Four properties it has to have, each with the mechanism that gives it:

- **One registration, not one per monitor.** The **host** is what is registered at
  sign-in, and the host then ensures its monitors. A monitor added later is covered
  without a second approval, and there is one entry for the owner to find and
  remove. On Windows that is the `schtasks` call `registerLhmTask` already makes;
  macOS's launchd and Linux's systemd-user or XDG autostart are their own work and
  are named as such rather than assumed.
- **Comes back after a host restart, because the host starts it again.** The user's
  own clarification, 2026-10-18: *"When I say it survive a host restart, I simply
  mean the host relaunch the browser on the right monitor again."* So the browser is
  the **host's own child** — `detached: false`, which is `lhm-launcher.ts`'s
  `launchChild` and not `openBrowser`'s detach — and the reconcile pass on host
  start is what brings it back. Nothing has to outlive anything, which is simpler
  and is the honest reading of what a display is: a window the host owns.
- **Never launches twice, and this is what makes the crash case safe.** A host that
  is killed rather than closed can leave its browser orphaned on Windows, so a
  relaunch on start would otherwise put a second window on the same monitor. The
  liveness check is already free and already stored: a local display that polled
  within the last few seconds **is running**, so `lastSeenAt` — the field § "The
  host's own monitors" already wanted for the settings surface — is what stops the
  second window. This is `launchLhm`'s reachability probe replaced by a fact the
  host already has, which is why the reconcile step is a comparison rather than a
  process scan.
- **Comes back after a crash, and goes away when removed.** The same reconcile pass
  re-checks each local display and relaunches the missing ones, so a crashed or
  accidentally-closed window returns. **Removal must stop it too** — deleting a
  local display has to close its window, or "remove" leaves a browser on the screen
  forever, which is the half of supervision that is easiest to forget. And because
  the child is the host's own, `close` is unambiguous: a browser the host started is
  the host's to kill, and one the owner started is not, which is `launchLhm`'s "an
  LHM the owner already runs keeps ownership of itself" applied to a browser.

**What renders it, and what that costs.** The user's other question, 2026-10-18:
the app exists to report on a machine's load, so the display must not become a
load of its own. Read from the code, the cost is **not** where the host is:

- **The host already idles correctly.** `server.ts`'s `tick` returns immediately
  when `connections.size === 0`, and it polls the **union** of every display's keys
  once and offers one already-serialized payload to each. A second local monitor
  costs one more write, not a second sampling cycle; the only host-side growth is
  keys a new theme binds that no existing theme did.
- **Repaint rate is the dominant client cost, not the engine, and it is a
  per-display setting.** `ChartRefreshRate` is `1 | 30` and every repaint in a scene
  goes through `startChartRefresh`'s one loop. **Ruled by the user on 2026-10-18:
  the rate belongs to the display, a local monitor defaults to 1 fps, and a remote
  display defaults to 30.** That is the right split because the two cases are not
  the same product: a wall screen on this PC is glanced at, while a phone or tablet
  someone is holding is looked at, and a dashboard nobody is touching has no reason
  to draw thirty times a second. So the rate is a field on the display record,
  defaulted by `kind`, carried to the player on the poll it already makes
  (`/api/published`), and overridable per display — not a constant in the player and
  not a property of the theme, because two displays showing one theme want different
  rates.
- **The loop as written does not idle, and that is the defect to fix here.**
  `startChartRefresh`'s `tick` re-arms `requestAnimationFrame` on **every frame**
  and returns early when the rate has not elapsed — so at 1 fps it still wakes the
  process ~60 times a second to decide to do nothing. A monitor that wakes a
  process 60 times a second is exactly the app that degrades the machine it is
  reporting on. At rate 1 the loop should be a `setInterval` and let the browser
  go idle between updates; the rAF loop is right for 30 and wrong for 1.
- **Animation is a bigger cost than the browser.** Any continuously animating
  element forces repaint at the display's refresh rate and keeps the compositor and
  the GPU process awake. A local monitor's theme should be static between samples.
- **Pixels are a cost.** The artboard is authored at a fixed size and scaled, so a
  local monitor on a HiDPI screen should render at 1× rather than 2× device pixel
  ratio — a quarter of the raster work for a dashboard nobody is reading at
  retina distance.
- **One browser, N windows.** If a PC has several local monitors, they share one
  browser process with a separate profile rather than one independent engine tree
  each, which shares the browser, network and GPU processes and adds a renderer
  per screen.

**A browser is the floor here, and that is a deliberate choice.** The cheapest
possible client would be a native renderer, which means reimplementing the Fabric
scene per platform; a WebView2/WebKitGTK shell would have a lower baseline than a
full browser at the cost of three platform implementations. Neither is worth it
against a repaint-rate fix that costs one function. `--disable-gpu` is **not**
recommended without measuring: for a mostly-static 1 fps canvas, software raster
may use less power than keeping a GPU process alive, and that is a probe rather
than a conclusion — **and it is off the table entirely for a theme with a video
background**, because hardware decode is what makes video cheap on the CPU.

### A video background defeats the rate, and mostly for nothing

The user asked on 2026-10-18 what a background video does to all of this. Read from
the code, the answer is that **1 fps does not survive a video, and the reason is a
repaint nobody asked for.**

`scene.ts` mounts the artboard's media with
`onFrame: () => canvas.requestRenderAll()`, and `background-media.ts`'s
`followFrames` drives that from `requestVideoFrameCallback` — one callback per
*decoded video frame*. So a 60 fps background repaints the whole Fabric canvas 60
times a second, and the per-display rate never applies: the loop `startChartRefresh`
owns is not the loop the video is on. On a 2560×1440 canvas that is 60 full-canvas
rasters a second, which is precisely the load this product must not add.

**And the repaint is only needed for glass.** The file says why it exists:
*"Fabric cannot see a `<video>` that is a DOM sibling rather than an object, so
nothing repaints and the glass keeps a still frame of a moving background."* That
is a statement about **glass panels**, which sample the media layer through
`backdrop()` — a panel blurring a video has to be re-composited as the video moves,
or it shows one frozen frame. A theme with a video background and **no glass panel**
has no such reader: the video is a plain DOM element below a transparent canvas, the
browser composites it on the GPU for free, and every one of those 60 repaints a
second is pure waste.

So the fix is a gate rather than a rate: **subscribe `onFrame` only when something
actually samples the backdrop**, which is the same "nothing subscribes unless a
video is the media" reasoning the file already applies one level up — an image
background starts no loop at all. With the gate, a video background with no glass
costs what a video costs and no more; with glass it costs a repaint per frame, which
is the price of the effect and is worth saying out loud on the surface.

**What the video costs regardless, and cannot be tuned away.** Decode and composite
at the video's own frame rate, forever — it cannot idle, because idling it is
pausing the thing the theme is for. The levers are all in the **asset**, not the
player:

- **Frame rate and resolution of the file.** A 60 fps 4K background on a 1080p
  screen is 4× the decode for pixels nobody sees; 24–30 fps at the screen's own size
  is the honest authoring target, and it is the theme author's choice rather than a
  runtime setting.
- **Codec.** One the platform hardware-decodes (H.264/H.265 in MP4) is
  dramatically cheaper on the CPU than one it does not — and this is a property of
  what an author puts in a package, so it belongs in the store's own guidance for
  the kind rather than in the player.
- **It is one video at most.** `Artboard` carries a single `backgroundMedia`, so
  there is no stacking case to design for.
- **`muted`, `autoplay`, `loop` and `playsInline` are already set**, so there is no
  audio path and no autoplay-policy stall to fix.

**The honest recommendation is that a video background is a deliberate choice on a
local monitor rather than a default**, because it is the one theme feature that
prevents the display from ever idling. The rate setting cannot bound it, so the
surface that turns it on should say what it costs rather than leaving the person to
discover it in their power bill.

### What the assignment warns about

**Ruled by the user on 2026-10-18**, asked what a background video does: warn on the
two combinations that cost, and only those.

| The theme | Assigning to a local monitor | Assigning to a remote display |
|---|---|---|
| **glass and a video background** | **warn** — a full-canvas repaint per decoded video frame | **warn** — the same repaint, on a device that is often on battery |
| **a video background, no glass** | **warn** — the display can never idle, so this PC never reaches its low-power states | nothing — the video is a DOM element the browser composites for free, and a phone showing video is doing what a phone does |
| glass, no video | nothing | nothing |
| neither | nothing | nothing |

**The two rows are different problems and the table is why the warning is not one
rule.** A video *with* glass pays the per-frame canvas repaint — the cost Task 4.7
narrows to the case that needs it — and that cost is real on any device. A video
*without* glass pays no repaint at all, and its cost is that the machine cannot
idle, which is a fact about a PC running a monitor rather than about a phone someone
is holding. Warning about the second on a phone would be noise, and noise is how a
warning stops being read.

**Both facts are readable from the theme, so the decision is pure.** A video
background is `artboard.backgroundMedia.assetId` resolved against `assets` to an
entry whose `kind` is `video` — the envelope already refuses a `backgroundMedia`
pointing at anything else (`validateBackgroundMedia` allows `image`, `svg`, `video`).
Glass is an object carrying a glass treatment, which `renderer-core` owns the
vocabulary for (`glassTreatment`). So the detection is a function of the envelope
alone, with no renderer, no DOM and no Fabric: it lives in **`renderer-core`**,
which is the only layer both the host and a catalogue Action may import, and it
answers a list of costs rather than a boolean so the surface can say *which* one.

**It is a notice, not a confirm.** The warning appears in the assign surface as soon
as the theme-and-display pair matches, before the assignment lands — which is the
moment it is useful — and it does not block. It is advice about a cost, not a
refusal: a modal on every video theme would be dismissed by reflex within a week and
would teach people to dismiss the ones that matter. Open question 8 still owns
whether a video background should ever be refused outright, and the answer to that
is not this notice's job to pre-empt.

## Two hosts on one network

The user asked whether **two PCs, each running a host on the same LAN**, and their
displays, get tangled. **No — and the boundary is the origin, which is structural
rather than a rule anyone has to keep.** A display is a client that loaded one
host's page, so its own URL names the host it belongs to; and a session token
verifies only in the process that minted it, because `session/pairing.ts` holds its
sessions in an in-memory `Map` per process. Host A's token presented to host B is a
token B never issued. The two hosts share no file, no port and no map: separate
machines, separate app folders.

**What makes that fragile is discovery, and this design adds one** (§ "Finding the
host after its address changes"). A display that re-finds its host by scanning the
LAN is a display that can find *the wrong host*, and today nothing distinguishes
two hosts on one network. **That is why a host needs a durable identity of its
own**, and it is the same id in both places: the reason a re-find is a *re*-find
rather than a fresh pairing, and the reason a scan cannot attach a display to
somebody else's PC.

**A second host on one machine is a different question, and today it is broken.**
`DEFAULT_APP_DIR` is `~/.vigilia` with `themes/` and `settings/` inside it
(`cli/args.ts`), and `--app-dir` is the only thing that separates two installs. Two
hosts started on this PC with no flags share one `settings/`, so they share
`active-theme.json`, `theme-answers.json` and the `display-clients.json` this
design adds
— the same display ids and assignments under two servers. `MAX_PORT_ATTEMPTS`
makes it worse rather than better: the second host walks to the next free port,
starts successfully, and looks like a second host while sharing the first's state.
**One app folder is one host**: the settings directory carries the host's record
and a lock, and a second host starting against a folder a live host holds is
refused with the reason and the flag that fixes it.

## Finding the host after its address changes

DHCP is the normal case on a home LAN, so a host's address changes and a display's
saved URL dies with it. The code says how much of the problem is real:
`lanAddress()` returns the **first non-internal IPv4 address**
(`cli/net.ts:90`), which a new lease replaces — and `hosting.ts` is explicit that
**"The port never moves."** So the port is stable by design and only the address is
in question, which is half the problem gone before anything is built.

**The display stores an identity, not an address.** Today the QR carries
`http://<address>:<port>/?session=<token>`, so the address is baked into the one
thing the display remembers. Pairing instead records
`{ hostId, hostName, port, token }`, and the address becomes a hint that can be
wrong.

**The cheapest durable answer is a name, and the network already has it.** A DHCP
reservation, or a name the router assigns to the host's MAC, makes the display's
URL `http://<name>:5227` and an address change invisible — in every browser, with
no code. **The pairing card should say so**, because it is the one step that makes
this feature unnecessary and it is the owner's to take.

**Where no name resolves, the display re-finds its host by identity**, in order:
the last-known address first, because it is free when nothing changed; then
`http://<hostName>.local:<port>`; then a sweep of the last-known address's /24 for
`GET /api/host`, matching `hostId`. The first match wins, and no match offers the
one-time code again rather than a dead page.

**`GET /api/host` is the second route reachable unpaired**, and it is deliberately
boring: `{ id, name, port }` and nothing else — no theme, no library, no device
facts, no count of anything. It must send `Access-Control-Allow-Origin: *`, because
a sweep is cross-origin by construction, and the response is safe to expose for
exactly the reason it is boring. **A scan that could read anything else would be a
directory of every host on the LAN**, which is the thing this design has otherwise
avoided.

**A reload is the hard case, and it is the one that needs the app shell.** A
display that reloads while the host is elsewhere is served the *browser's* error
page, not ours — so a re-find routine written into the page cannot run, because the
page never loaded. There are two answers and both are named rather than assumed:
the URL is a **name** (above), or the display runs an **app shell cached by a
service worker**, which is `vg-577`'s PWA. **This makes the PWA load-bearing rather
than a nicety**: without it, a camera-less display whose host moved is back to
typing a code, and the code route is the only thing that still works.

**Two limitations, stated rather than discovered later.** A browser cannot read its
own address, so the sweep derives its range from the last-known host address and
**assumes a /24** — a host that moved to a different subnet is not found by
sweeping, and is found by the code route instead. And `lanAddress()`'s "first
non-internal IPv4" is the wrong answer on a PC with Docker, WSL, Hyper-V or a VPN
adapter, so the pairing card can print an address no display can reach; the
address a card shows is worth verifying against the one a phone actually reaches.

**Vice versa is already answered.** The host never opens a connection to a display,
so it does not need to *reach* one — it needs to *tell them apart*, which display
ids do. What it gains is each display's **last-seen address**, recorded on each
poll, so the Host settings mode can show where a display was last seen; that is the
field open question 1 already names, and this is the reader that wants it.

**mDNS advertising is not in this design.** The host announcing
`_vigilia._tcp.local` would give the name above for free on networks with no
router-assigned name — but **a browser cannot resolve `.local` except Safari**, so
it is a bonus for OS-level clients and never the whole answer, and it costs a
shipped dependency (licence review, `THIRD-PARTY-NOTICES.md`,
`docs/engineering/dependencies.md`). It is open question 5.

## Identity: the token is a credential, not a name

**The assignment cannot be keyed by the session token.** The token is a bearer
credential and the record is a name; a theme keyed by the credential would be a
theme keyed by the thing that gets rotated, and rotating it — for any reason, at
any time — would silently move a wall display to the default. The two are separate
things and stay separate, whichever of them is durable.

So the two are separated:

- **Pairing mints a display record** — `{ id, label, kind, createdAt, tokenHash,
  lastSeenAt }` — and persists it. The id is the name an assignment is keyed by.
  **Its file is `display-clients.json`, not `displays.json`**: `settings/display.ts`
  already owns `display.json` in the same directory for a completely different
  thing — how readings are displayed, its time zone and its measurement system —
  and two files one character apart with different owners is a defect waiting for
  a tired reader. The incumbent keeps its name; the new one is the one that says
  which it is.
- **The session carries a `displayId` beside its token**, so a request resolves to
  the record and not to the credential.
- **Re-pairing a known display issues a new session for the existing record**,
  rather than minting a second display: `POST /api/pairing/sessions` takes either
  a `label` (a new display) or a `displayId` (another session for that one).
- **Re-attaching is the admin's choice, never the client's claim.** The client
  cannot name a `displayId`; only the loopback-only pairing route accepts one. A
  client that could name a display would be a client that could take another
  display's theme.

**Ruling 12: a pairing does not expire.** The user ruled on 2026-10-18 that a
display stays paired *until the host removes the client*. That ends the twelve-hour
TTL and the in-memory session map for displays, and it is the change that makes the
rest of this document true rather than aspirational — with a twelve-hour credential
a wall display falls to the default twice a day and after every restart, so
"a display holds its own theme" would have been true of the configuration and false
of the screen.

**What the ruling spends, stated rather than discovered later.** `pairing.ts`'s own
comment is that sessions are short-lived *"so a leaked token must stop working on
its own"*. A credential that never expires does not do that, so three things replace
it and each is part of the ruling rather than an extra:

- **Removal is explicit, and it is the host's act** — the sentence the user wrote.
  The display list is where a client is removed, and removing it deletes the
  credential with the record.
- **The token is stored hashed**, never in the clear: the record holds
  `sha256(token)`, so reading `display-clients.json` — a backup, a synced folder, a
  screenshot — yields a list of displays rather than a set of usable credentials.
  Verification compares the hash, and the existing timing-safe comparison stays.
- **The token stops living in the URL after the first visit.** A twelve-hour token
  in `?session=` is a link; a permanent one in a URL is a permanent credential in
  the browser's history, in a bookmark, and in whatever chat it was pasted into.
  The display stores what it is given and resolves later requests from storage.
  **The QR route never puts a token in a URL at all** — it carries a one-time code
  to `/pair`, and the credential comes back over the exchange — so `?session=` is
  only the path for a display someone handed a URL to directly.
- **The `?session=` parameter keeps its name in this design.** It now carries a
  durable credential rather than a session, so the name is stale; renaming it is a
  wire change across the QR, the player and the host's own console with no
  behaviour in it, and it belongs in a commit about naming rather than in one about
  durability. Recorded here so it is a decision rather than an oversight.

**The sweep and the TTL constant go with it.** `DEFAULT_SESSION_TTL_MS`, `sweep()`
and the expiry field are removed rather than left unused, because a TTL that is not
enforced reads as one that is. There is no separate `revoke` left to keep: with one
credential per display and no expiry, revoking *is* removing, and the routes table
carries the one act that does it.

**This is the second credential this product stores, and the first one's questions
come with it.** The store spec says the GitHub token is the first, with its file,
its permissions, whether it is encrypted at rest and what happens on revocation
being a design's business. Hashing answers the at-rest question for *this* one —
the file holds no secret — and leaves permissions as the shared open question it
already is rather than deciding it twice.

**The id's shape is the one this codebase already uses for a device id** —
`[a-z0-9][a-z0-9-]{0,63}` (`settings/devices.ts`'s `ID_PATTERN`,
`theme-settings.ts`'s `DEVICE_ID`) — minted from the label's slug, with a short
random suffix when the slug is taken. Reusing the pattern is not decoration: the
answers file already refuses a key that does not match it, so a display id that
did not would be unanswerable.

## Renaming a display, and why the id does not move

The user asked on 2026-10-18 for a display to be **renamed to something easy to
recognise after pairing**, as 9remote allows. Today the label is what the id was
minted *from*, so a naive rename would either leave the id stale or mint a new one
— and a new id would move the display's theme and every answer it has given to a
record nobody is looking at.

**So the label is mutable and the id is not.** They were only ever related by
history: the id is the key that the assignment map and the answers file both use,
and the label is what a person reads in a list. One route renames — loopback only,
since it is an admin act like pairing — and it changes `label` and nothing else.
Renaming is therefore free of consequences for a display's theme, its answers, or
which record it is, and the same route works for a paired client and a local
monitor because both are records.

**The id stays as it was, including when it no longer resembles the name.** An
`office-tv` renamed to *Kitchen* keeps the id `office-tv`, and that is the correct
outcome rather than a wart: the id is a key, keys do not get rewritten because a
person changed their mind, and anything that needs the human name already has the
label. A display whose label is ambiguous — two renamed *Kitchen* — is a display
list's problem to draw, not an id's problem to solve, because **labels are not
keys and duplicates are allowed**.

**A rename is validated as text, not as an id.** Trimmed, at least one character
after trimming, at most 64, and refused rather than silently emptied — the label is
the only thing in the record a person types, and `exactOptionalPropertyTypes` plus
"refuse invalid input rather than coercing it" both point the same way. It is *not*
run through the slug rule: that rule exists to mint ids, and applying it here would
refuse a perfectly good name like `Living Room (TV)` for no reason a person could
act on.

## Pairing a display that has no camera

The pairing route today is a QR. `editor-shell/publish-control.tsx` renders a
`QrCode` whose label is `QR code: http://<address>:<port>/?session=<token>`, and
that token is 32 bytes of CSPRNG output as base64url — about forty-three
characters. **That is a QR's payload, not a person's.** A display with no camera
would have to type it, so the one route that exists is the one route a camera-less
device cannot take.

**So pairing gets a second route, and the code is designed for a keyboard.** The
host shows a **one-time code** — short, uppercase, from an alphabet with no `O` and
no `0` — with a countdown and an expiry. The display opens the host's address, types
the code, and the host answers with a session. **The QR stays, and carries the same
code rather than the token**, so there is one thing to mint and two ways to present
it — 9remote's arrangement, and the reason its card can put a QR and a typeable
value side by side without minting twice.

Five rules make a code short enough to type safe enough to use:

- **It expires, and it is single-use.** Minutes rather than hours, and the first
  successful claim burns it.
- **A wrong guess never burns the window; only a successful claim does.** This is
  where the design deliberately diverges from 9remote. Their code is two
  characters, so they *must* burn on a mismatch to stop brute force, and their own
  comment records the bug that follows — a stale code's wrong guess killing the
  live window, which they patch by burning only when the presenter named that code.
  With one live window there is nothing to name, and burning on a mismatch would
  hand anyone on the LAN a way to close a pairing window by guessing wrong. So the
  code is longer, rate limiting carries the defence, and only success consumes.
- **Guessing is rate-limited**, per code and per source, with a penalty that grows
  rather than a lockout that can be aimed at someone else.
- **The exchange is the one route reachable unpaired**, so it is the route that must
  be boring: no listing, no theme, no device facts, and a refusal that says nothing
  about whether a code exists.
- **The code is not a session.** It is exchanged once for the real credential, so a
  code read over someone's shoulder is worth one pairing and no more.

**The code is exchanged for a durable credential**, which is ruling 12: a display
that must stay on a wall cannot be asked to type a code twice a day, so the thing
the code buys is not a twelve-hour session. That is also why the code can be
short — it is the *only* short-lived secret in this exchange, and everything
after it is a credential the host can see and revoke by name.

## The model: a default, and an override per display

`active-theme.json` becomes:

```json
{
  "default": "living-room",
  "displays": { "this-pc": "attic-wall", "kitchen-tablet-a1b2": "kitchen-strip" }
}
```

- **A display with no entry gets the default.** That is what an unpaired LAN
  reader gets, and what a freshly paired display gets before anyone assigns it.
- **A stale id falls back rather than failing.** The existing rule survives: an
  entry naming a theme that is no longer in the library is no choice, so the
  display falls to the default rather than to an error page.
- **`default` is a display id or a theme id, and the file says which by its
  shape** — a string under `default`, an object under `displays` — so a
  hand-edited file cannot be read two ways. Both are validated against the theme
  library on read, as today.

**`this-pc` is reserved and always exists.** Without it the local screen would be
the one client that cannot be given a theme of its own, which is the client the
author is looking at. It is never paired and has no record; the map simply
accepts it as a key.

## A display may change its own theme

Ruled 2026-10-18 by the user: a display may change to a different theme for
itself, chosen from the themes this host holds locally, without changing any other
display's.

**It costs one branch, because the authority is derived rather than claimed.**
`GET /api/themes` is already behind the *display* guard rather than the loopback
one, so a paired display can already list this host's themes and nothing new is
needed to populate a chooser. What was missing is the write, and it is the same
route with a second caller:

| Caller | Sends | May set |
|---|---|---|
| loopback — this PC | `{ display: "<id>" \| "default", id }` | any display, and the default |
| a paired session | `{ id }` | **only its own entry** |

**A display's own id comes from its session and never from the body.** That is the
whole security property, and it is why this is a branch rather than a second
authority model: a client that could name the display it writes would be a client
that could take another display's theme — the rule the pairing route already
follows. Two keys are therefore unreachable from a session *by construction*
rather than by a check: `default`, and `this-pc`.

**An unpaired reader cannot do this**, and that is the honest consequence rather
than an omission: it has no entry to write. A reader that wants a theme of its own
becomes a display by being paired once — the same gate every other LAN read
already passes.

**The display's choice and this PC's are the same key, so the later write wins.**
There is deliberately no second layer of *the display's own preference that the
host's assignment outranks*: the Host settings mode would then show a theme the
display is not showing, and a list that lies about what is on a wall is worse than
one that changes under the person editing it. What this costs is that a display
can override an assignment its owner just made — and the owner can see that in the
same list, because the list reads the key rather than remembering an intent.

**The chooser is a chrome control on the display**, following the idiom the player
already uses for fullscreen and that `vg-576` rules on for the rest: a control on
the surface itself rather than a settings modal. It lists this host's themes by
name and picture and writes the one chosen. When `vg-576`'s panel lands, the
chooser becomes one of its rows rather than a second surface.

## The answers belong to a display's use of a theme

`theme-answers.json` becomes
`Record<displayId, Record<themeId, ThemeAnswers>>`.

The global device settings keep their place as the fallback, so the property the
file exists for survives unchanged: *a consumer who set the system disk once is
not asked again by every theme that reads a disk*. What changes is only where a
theme's **difference** from that global choice is recorded — per display, because
"which GPU does this dashboard show" is now a question about the screen as well as
the theme.

## Resolution, for a display

`GET /` keeps its order and gains one step:

1. **what the author is publishing now** — unchanged, and still the head
2. **`?theme=`** — an explicit link, unchanged
3. **the theme this display holds** — the map entry for the asking display
4. **the default** — new, and where an unassigned display lands
5. **the only theme, when the library holds exactly one** — unchanged
6. **the chooser** — unchanged

Steps 3 and 4 need the route to know which display is asking. It already can: a
request is loopback (so it is `this-pc`), or it carries a session (so it is that
session's `displayId`), or it is neither (so it is an unpaired reader, and gets
the default).

## A reassignment reaches a display that is already showing

Assigning a theme to a display that is on a wall must not need someone to walk to
it. The mechanism already exists and is not rebuilt: `publish-follower.ts` polls
`/api/published` and the player reacts to a change. That read gains the resolved
theme id for the asking display, and the player reloads when it differs from what
it is showing — the same comparison it already makes for the published id, over
the same interval.

**A display that is showing an explicit `?theme=` link is not moved by an
assignment.** The link is the person's own instruction for that page, and it
outranks the map for exactly as long as it is in the URL.

## The routes

| Route | Who | Answers |
|---|---|---|
| `GET /api/host` | **anyone** | `{ id, name, port }` and nothing else, with permissive CORS — the re-find probe of § "Finding the host after its address changes" |
| `POST /api/pairing/claim` | **anyone**, rate-limited | exchanges a one-time code for a durable credential; says nothing about whether a code exists |
| `GET /api/pairing/sessions` | loopback | the live codes **and** the known displays |
| `POST /api/pairing/sessions?label=` | loopback | a new display, its durable credential and a one-time code |
| `POST /api/pairing/sessions?displayId=` | loopback | **replaces** that display's credential — rotation — keeping its record, its theme and its answers |
| `PATCH /api/displays/:id` | loopback | `{ label?, chartFps? }` — **renames and sets the rate, and changes nothing else**; the id does not move |
| `POST /api/displays` | loopback | `{ label, monitor, chartFps? }` — **a local monitor**, a display with no credential, launched at once |
| `GET /api/displays/monitors` | loopback | what `systeminformation` reports is attached, for the owner to pick from |
| `POST /api/displays/autostart` | loopback | registers the **host** to start at sign-in, so every local monitor survives a reboot |
| `DELETE /api/displays/:id` | loopback | **removes the client**: the record, its credential, its assignment, its answers, **and its window** |
| `GET /api/themes/active` | loopback | the default, each display with its theme, the library, the templates |
| `PUT /api/themes/active` | loopback | `{ display: "<id>" \| "default", id }` — any display, and the default |
| `PUT /api/themes/active` | paired | `{ id }` — **its own entry only**, named by its session |
| `GET /api/themes` | loopback or paired | the library, for the display's own chooser. **Already the case** (`server.ts`'s display guard), so nothing is added |
| `GET /api/published` | loopback or paired | `{ id, revision, display: { id, theme, chartFps } }` — the poll the player already makes carries its own rate |

**Two routes are reachable unpaired, and each is deliberately boring.** `GET
/api/host` says only what a re-find needs and never what a stranger would want; the
code exchange answers nothing about whether a code exists. Everything else that a
display may call requires its credential, and everything that administers requires
loopback — so an unpaired client on the LAN can learn that a host exists and can
try to pair, and nothing else.

**Ruling 12 collapses "revoke" and "remove" into one act, so there is one route.**
Under the ephemeral model the two were different: revoking took away a credential
while the display and its theme stayed. A credential that lasts until the host
removes the client has no separate revocation to perform — and the case that would
have wanted one, *this screen is broken and a new one replaces it*, is already
served by `?displayId=`, which mints a fresh credential for the same record and
leaves the theme where it was. One route, one act, and the person's configuration
goes with the client they removed rather than being orphaned by it.

**Removing a display removes its answers with it** — otherwise a new display
reusing a slug would inherit a stranger's answers.

## What already exists, and must not be rebuilt

- **The pairing mechanism, its loopback guard and its token discipline.**
  `session/pairing.ts` is extended with a `displayId` on the session and a
  persisted display list; its constant-time comparison stays. **Its TTL and sweep
  do not** — ruling 12 removes both.
- **The staleness rule** — a chosen theme that is no longer in the library is no
  choice (`active-theme.ts`'s `read(exists)`).
- **The answer fallback** — `perTheme[group] ?? stored.assigned[group]`
  (`server.ts`'s `currentAssignment`).
- **The id pattern** — `settings/devices.ts`'s `ID_PATTERN`.
- **`systeminformation`, already a host dependency**, for enumerating monitors.
  `graphics().displays` is the whole of what § "The host's own monitors" needs —
  an identity to point a display at and the geometry to tell a browser — so the
  second kind of display adds **no dependency**, and the reuse gate's rung 4 is
  passed by the manifest rather than by argument.
- **`requiredDeviceGroups`** already derives a theme's slots from its bindings;
  this document changes *whose* answers are read, not how they are derived.
- **The publish poll** — `publish-follower.ts` and `/api/published`.
- **`settings.html` and `library.html` stay served.** They are the only surfaces a
  browser with no editor open can reach, so their theme chooser is rewritten
  against the display model rather than removed.

## Landing order

One plan, and it is a prerequisite of the store's phase A rather than a sibling:

| Phase | Lands | Needs |
|---|---|---|
| **1** | the display record with its hashed durable credential (ruling 12), pairing against it, the persisted display list, its removal and **rename** routes, the one-time code and its `/pair` route as the camera-less path, **the host's own monitors as credentialless displays**, the host's own identity and lock in the app folder, and `GET /api/host` | — |
| **2** | the per-display map, the default, and `GET /`'s resolution — including a loopback request naming a local display, which is the only way a local display is ever resolved | 1 |
| **3** | the answers keyed by display and theme, through `currentAssignment` | 2 |
| **4** | the routes, the display's own write and its chooser (ruling 11), the reassignment read on `/api/published`, the display's re-find ladder, and the two host pages rewritten against the model | 3 |

**Phase 2 is the one that must not be built against a model that does not exist**,
which is `vg-574`'s own reason for landing first. Phases 1 and 2 are the pair the
store's assign action consumes; 3 and 4 make the feature usable rather than merely
correct, and nothing in the store spec depends on them.

## Open questions

**A display choosing for itself was open question 1 and is now ruling 11** — the
user ruled it on 2026-10-18, and § "A display may change its own theme" is the
answer. What that ruling needed to be safe was already true: the authority comes
from the session, so a display writes its own key or nothing.

1. **What a display's record should carry beyond `label` and `createdAt`** — a
   last-seen time is the obvious candidate and is the thing the Host settings mode
   would want in order to say *this one is online*. Deferred until that surface is
   drawn, so the field is added by the thing that reads it.
2. **Whether an assignment should survive deleting the display's record** — the
   answer above is no (the answers go with it), and the theme assignment going
   too is the consistent reading rather than a decided one.
3. ~~**Whether a display's credential should outlive a session.**~~ **Ruled on
   2026-10-18: it does, until the host removes the client** — ruling 12, §
   "Identity: the token is a credential, not a name". What was open question 3 is
   now a decision with its costs named beside it: the credential is persisted,
   hashed, removable only by the host, and no longer carried in a URL after the
   first visit. `DEFAULT_SESSION_TTL_MS` and `sweep()` are deleted rather than
   left unenforced.
4. **Whether hosts should be discoverable on a LAN** — § "Two hosts on one
   network" says the origin is the boundary *because nothing discovers hosts*. This
   design now adds the narrowest possible discovery: a display that has **already
   paired** re-finds *its own* host by matching a `hostId` it stored, and the only
   unpaired thing a host answers is `GET /api/host`. That is a re-find, not a
   discovery service — nothing enumerates hosts for a stranger. **A general beacon
   is still open**, and it is the thing that would put every host on the network
   into one reachable set.
5. **Whether the host should advertise itself over mDNS.** It would give the
   address-free name in § "Finding the host after its address changes" for free on
   networks with no router-assigned name, and it costs a shipped dependency —
   licence review, `THIRD-PARTY-NOTICES.md`, `docs/engineering/dependencies.md`.
   **Not needed for the feature to work**, because the name route and the re-find
   ladder both work without it, so it is deferred rather than designed. Browsers
   cannot resolve `.local` except Safari, so it would never be the whole answer.
6. ~~**Whether the host should launch the browser on a local monitor itself.**~~
   **Ruled on 2026-10-18: it does** — ruling 13, § "The host's own monitors". The
   earlier recommendation against it was wrong for the reason it gave: a wall
   display nobody reopens is not a display, so surviving a host restart and a
   reboot is a requirement rather than a nicety. The launcher reuses
   `lhm-launcher.ts`'s shape rather than inventing one. **Still open within it:**
   which browser executable to prefer when several are installed, and whether
   macOS and Linux autostart land with the Windows path or after it.
7. **Whether the 1 fps repaint path should be a `setInterval` rather than a
   re-armed `requestAnimationFrame`.** § "The host's own monitors" says the loop as
   written wakes the process ~60 times a second to decide to do nothing, which is
   the defect that makes a monitor app cost more than it reports. **Recommended:
   change it**, and the change is one function — but it is `scene-fabric`'s, it
   affects the editor's live view too, and it wants its own measurement rather than
   being folded into this design.
8. **Whether a video background is allowed on a local monitor, warned about, or
   refused.** § "A video background defeats the rate" establishes that it is the one
   theme feature the per-display rate cannot bound, and that it prevents the display
   from ever idling. **Recommended: allowed and stated**, because a video background
   is a legitimate look and the person choosing it is the one paying for it — but
   the Host settings surface should say so beside the monitor rather than leaving it
   to be discovered. What would change the answer is a measured power cost large
   enough that the honest thing is a refusal.

## Not verified, and must be before this is planned

- **That a session token is the only identity a LAN request carries.** Read from
  `session.ts` and `allowed()`; not driven against a real paired phone.
- **That `/api/published`'s poll interval suits a reassignment.** The interval is
  in `publish-follower.ts` and has not been read for this purpose.
- **That `this-pc` cannot collide with a minted display id.** The reserved word is
  safe only if minting refuses it, which the plan must make true rather than
  assume.
- **That the code's length and its rate limit are the right pair.** Both are chosen
  rather than measured: 9remote's numbers defend a *two-character* code, and this
  design's is longer, so copying their thresholds would be copying a defence sized
  for a different lock. The plan sets them, and the first LAN pairing is what tests
  them.
- **That a browser holds a durable credential across a reload.** Ruling 12 makes
  this load-bearing rather than incidental: the credential must survive a reload,
  a browser restart and a reboot of the display, which means storage the display
  controls. Not driven in a browser here, and it is the first thing phase 1's
  tests must show.
- **That a display can be told its host moved.** § "Finding the host after its
  address changes" reasons from `lanAddress()` and `hosting.ts` that only the
  address changes; **the browser's own behaviour on a stale address is not
  observed here**, and it decides whether the re-find can run from our page or
  needs a cached app shell. Nothing has been driven against a host whose lease
  changed.
- **That a cross-origin sweep can read `GET /api/host`.** The CORS header is
  designed rather than tested, and a preflight or a private-network rule could
  refuse it. Unverified from this environment.
- **That a relaunched browser lands on the right monitor.** The launch shape is
  `lhm-launcher.ts`'s and the registration is its `schtasks /SC ONLOGON` call — but
  neither has been exercised for a *browser* on a *second* monitor, and
  `--window-position` against a monitor Windows has renumbered is exactly the kind
  of thing that works until it does not. Nothing here has been driven through a real
  sign-out and sign-in.
- **That 1 fps is the right default, and that the rAF loop is what costs.** The
  ~60-wakeups-a-second reading is from `chart-refresh.ts`'s source, not from a
  profiler; the relative cost of engine baseline, repaint rate, device pixel ratio
  and GPU process residency on this machine is **unmeasured**. Open question 7 owns
  the change; a measurement is what should decide it.
- **That `systeminformation` reports every attached monitor usefully.** Probed on
  this PC at 5.33.13: it answers one entry with `deviceName`, `serial`, `main`,
  `positionX`/`positionY` and `currentResX`/`currentResY`, which is the shape this
  design needs. **Only one monitor is attached here**, so the multi-monitor case,
  the stability of `deviceName` across a cable change, and whether `serial` is
  reported on monitors that are not this one are all reasoned rather than observed.
  A local monitor is the feature most exposed to that gap, and the plan's first
  test on a two-monitor PC is what closes it.

## Acceptance

- **1** — pairing twice with the same label creates two displays; pairing with a
  `displayId` creates a session for the existing one and no new display; a client
  that sends a `displayId` to the pairing route from off-loopback is refused;
  **a display with no camera pairs by typing the one-time code at `/pair`**, the
  code is refused a second time, a wrong code does not burn a live window it did
  not name, and the exchange route answers nothing about whether a code exists;
  **a second host started against a folder a live host holds is refused**, and
  `--app-dir` is the message's own remedy.
- **1a (ruling 12)** — a paired display is **still paired after the host restarts
  and after any elapsed time**, with no code retyped; the stored record holds no
  usable token (the file's own bytes do not contain the credential the display
  presents); `POST ?displayId=` kills the previous credential — the old token is
  refused, the new one works, and the display's theme and answers are unchanged;
  removing the display makes its credential stop working and takes its assignment
  and its answers with it; `DEFAULT_SESSION_TTL_MS` and `sweep()` no longer exist.
- **2** — two displays hold two themes and each `GET /` answers its own; a display
  with no entry gets the default; an entry naming a deleted theme falls back to the
  default rather than erroring; the local root page is assignable as `this-pc`.
- **3** — the same theme on two displays can answer a different GPU on each, and a
  display with no answer still falls back to the global device settings.
- **4** — a reassignment reaches a display already showing a theme without anyone
  touching it; a display on an explicit `?theme=` link is not moved; the display
  list, each display's theme and the default survive a host restart; and
  `library.html`'s chooser writes the display it names rather than the host.
- **5** — a paired display changes its own theme from a control on the display,
  and only its own: the second display's theme and the default are unchanged; the
  same request naming another display in the body changes nothing; a request from
  a display whose session has been removed is refused; and an unpaired reader is
  offered no chooser at all.
- **6 (address changes)** — a display whose saved address is stale reaches its host
  again without a code, and reaches **its own** host: with two hosts answering on
  the LAN, a re-find matches the stored `hostId` and never attaches to the other
  one; a display that matches nothing is offered the code route rather than a dead
  page; `GET /api/host` answers only `{ id, name, port }`, and is readable
  cross-origin.
- **7 (renaming)** — renaming a display changes its label and **nothing else**: its
  id, its theme and every answer it has given are unchanged, and the assignment map
  still resolves it; an empty or whitespace-only label is refused rather than
  stored; two displays may hold the same label; a rename from off loopback is
  refused; and a rename survives a host restart.
- **8 (local monitors)** — a local monitor added on this PC needs no code and shows
  the theme assigned to it; **a request from off this PC naming a local display is
  refused**, so `?display=<id>` cannot be used to take that screen's theme; a local
  monitor's record whose monitor is no longer attached **stays in the list with its
  theme**, and the settings surface says it is not on a screen; and a local monitor
  is unaffected by the host's address changing, because it reaches `127.0.0.1`.
- **9 (launching, ruling 13)** — adding a local monitor opens a window on the named
  monitor; **restarting the host brings it back on the right monitor**, and does not
  open a second one, because a display seen recently is a display already running —
  including the case where a killed host left an orphan behind; a window that is
  closed comes back on the next reconcile; **removing the display closes its
  window**; the host registers itself at sign-in with one entry that covers every
  monitor, including one added later; and a PC with no browser the host can find
  says so rather than showing nothing.
- **10 (cost)** — the chart rate is **per display**: a local monitor defaults to 1
  fps and a remote display to 30, a display's rate survives a restart, changing it
  for one display does not change another's, and the player honours the rate it was
  given rather than a constant; a local monitor's idle state does not repaint; the
  host samples nothing while no display is connected; and adding a second local
  monitor whose theme binds no new key does not increase the host's sampling.
- **11 (video)** — a theme with a video background and **no glass panel** starts no
  per-frame canvas repaint at all, because nothing samples the backdrop; the same
  theme **with** a glass panel does repaint per video frame, which is the price of
  the effect; and a video background does not change the display's configured rate,
  because the rate governs the sample-driven loop and not the video's own cadence.
- **12 (the assignment warning)** — glass **and** a video background warns for a
  local monitor **and** for a remote display; a video background with no glass warns
  for a local monitor and **does not** warn for a remote display; glass alone warns
  for neither, and a theme with neither warns for neither; the warning names which
  cost it is rather than saying "performance"; it appears before the assignment
  lands and does not block it; and the detection is a function of the envelope, so
  it answers the same for a theme the store has not rendered.
