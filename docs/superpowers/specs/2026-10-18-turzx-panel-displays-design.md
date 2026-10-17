# TURZX panel displays — design

- **Status:** **rough capture, 2026-10-18 — long-term roadmap only.** Not queued,
  no plan, and **not approved for one**: this needs its own brainstorm first. It
  exists so the protocol research is not lost.
- **Register:** no row. Nothing here is a defect against shipped behaviour.
- **Depends on:** `2026-10-18-per-display-themes-design.md`. A panel would be a
  **third** display kind in that model, and the first display the host has to draw
  for rather than serve JSON to.

## What this is, and is not

**It is** a capture of what it would take to drive a TURZX / Turing Smart Screen
USB panel from the host: the wire protocol as the reference implementation
practises it, the constraint that decides the whole shape, and the decisions
nobody has made yet.

**It is not** a design. No interface below is settled, no task is implied, and
nothing here should be read as a commitment to build it. Where a number appears it
is either read from the reference source or arithmetic from it, and both are
labelled.

## What the device is

A USB-C panel that takes **pixels over a wire protocol**. It has no URL, no DOM,
no session token, no service worker and no `127.0.0.1`. So it is neither of the two
kinds `2026-10-18-per-display-themes-design.md` defines: not `paired` (nothing to
pair, no credential) and not `local` (nothing is resolved through loopback and no
browser is launched). It is closer to `local` in that it is attached to this PC and
needs no pairing, which is why the third kind would likely be a sibling of it.

**The reference implementation is a Python project**, `mathoudebine/turing-smart-screen-python`,
which is **GPL-3.0-or-later**. Only protocol facts are taken from it here — no code,
no vendoring. A wire protocol is not copyrightable and an independent implementation
of one is not a derivative work, but if any of that project's code were ever copied
into this repo the licence would reach the whole product, so the rule is: read it for
the protocol, write our own TypeScript, and record that in the decision note.

## The protocol, from the reference implementation

**Three families, not one.** They share a serial base but not a packet format, and
the newer and faster panels are not serial at all.

| Family | Transport | Frame format | Models (the reference's `config.yaml`) |
|---|---|---|---|
| **Rev A** | serial 115200 8N1, `rtscts=True` | RGB565 **little**-endian | Turing 3.5", UsbPCMonitor 3.5"/5" |
| **Rev B** | serial 115200 | RGB565 **big**-endian | Xuanfang 3.5", including the flagship |
| **Rev C / Rev D** | serial 115200 | RGB565 | Turing 2.1"/2.8"/5"/8.8"; Kipye Qiye 3.5" |
| **TUR_USB** | **USB bulk**, not serial | **PNG**, JPEG fallback, H264 stream | Turing HW rev 1.x: 4.6"/5.2"/8"/8.8"/9.2" |
| **WEACT_A / WEACT_B** | serial | via `library/lcd/serialize.py` | WeAct Studio FS V1 3.5" |

**Panel sizes** (`library/display.py`, keyed by the theme's `DISPLAY_SIZE`): 0.96"
80×160, 2.1" and 2.8" 480×480, 3.5" 320×480, 4.6" 320×960, 5" 480×800, 5.2"
720×1280, 8" 800×1280, 8.8" and 9.2" 480×1920, 12.3" 720×1920.

**Rev A** (`library/lcd/lcd_comm_rev_a.py`). Handshake: send six `0x45` (`'E'`),
read six bytes. `[0x01]*6` → 320×480, `[0x02]*6` → 480×800, `[0x03]*6` → 600×1024,
**anything else → 320×480**, which is the case that matters because the official
3.5" does not answer at all. Commands are ASCII-ish: `RESET` 101, `CLEAR` 102,
`SCREEN_OFF` 108, `SCREEN_ON` 109, `SET_BRIGHTNESS` 110, `SET_ORIENTATION` 121,
`SET_MIRROR` 122, `DISPLAY_PIXELS` 195, `DISPLAY_BITMAP` 197. Packets are 6 bytes
with the bounding box packed into a bitfield across the first five and the command
in the sixth. Brightness is **inverted** (0 is brightest).

**Rev B** (`library/lcd/lcd_comm_rev_b.py`). Packets are **10 bytes, framed with the
command byte at both ends**: `[cmd, 8 payload bytes, cmd]`. `HELLO` `0xCA`,
`SET_ORIENTATION` `0xCB`, `DISPLAY_BITMAP` `0xCC`, `SET_LIGHTING` `0xCD`,
`SET_BRIGHTNESS` `0xCE`. The handshake sends the payload `"HELLO"` zero-padded, reads
10 bytes back, and checks `0xCA` at both ends. **Byte 6 of the reply is `0x0A` and
byte 7 gives a sub-revision** — `A01`/`A02`/`A11`/`A12` — where `A02` and `A12` are
the flagship and `A11`/`A12` support a brightness *range* (0–100 mapped to 0–255)
while the others take brightness as effectively on/off. The bitmap header is eight
payload bytes of **big-endian 16-bit inclusive corners**, and there is a
`sleep(0.05)` between bitmaps whose own comment says it "decreases corrupted bitmap
significantly" — a device-side timing constraint, not a politeness.

**TUR_USB** (`library/lcd/lcd_comm_turing_usb.py`) is a different world: pyusb bulk
transfer, vendor `0x1cbe`, products `0x0028`/`0x0046`/`0x0050`/`0x0080`/`0x0088`/
`0x0092`/`0x0123`, endpoints discovered on interface 0. The command packet is **500
bytes padded into a 512-byte frame and encrypted DES-CBC** with the key `slv3tuzx`
and the trailing bytes `161, 26`; the reply is read as 512. Commands: 10 sync, 11
restart, 14 brightness, 15 frame rate, 17 get H264 chunk size, 38/39/40 file open/
write/delete, 98/110/113 play, 100 refresh storage, 101 upload JPEG, 102 upload PNG,
121 play H264 chunk, 122 stream status, 123 stop stream. `send_pil_image_auto`
**prefers PNG and falls back to JPEG** past a byte budget, and H264 is streamed for
the flagship.

**Pixel encoding** (`library/lcd/serialize.py`) is four functions and no more:
`image_to_RGB565(image, endianness)` — 2 bytes per pixel, no padding, byte order
chosen by the literal `"big"`/`"little"`; `image_to_BGR`; `image_to_BGRA`; and
`image_to_compressed_BGRA`, which is 3 bytes per pixel and carries the reference's
own FIXME. Plus `chunked(data, n)`. Serial revisions send in chunks of
`width * 8` bytes.

**The bitmap command carries a bounding box, and the reference uses it.** `DisplayText`,
`DisplayBar` and `DisplayGraph` each call `DisplayPILImage(image, x, y)` with their own
widget's box (`library/lcd/lcd_comm.py`), so the reference's wire cost tracks **widget
area, not screen area**. This is the single most important design fact here, and the
next section is why.

## The constraint that decides everything: wire time

115200 8N1 carries **11,520 bytes/s**. RGB565 is 2 bytes per pixel. So a **full frame**
costs:

| Panel | Bytes | Wire time |
|---|---|---|
| 3.5" 320×480 | 307,200 | **≈27 s** |
| 2.8" 480×480 | 460,800 | ≈40 s |
| 5" 480×800 | 768,000 | ≈67 s |
| 8.8" 480×1920 | 1,843,200 | ≈160 s |

And a region costs its own area — on a 3.5": a 120×20 text row ≈0.42 s, a 300×20 bar
≈1.0 s, a **300×120 chart ≈6.3 s**.

**This is arithmetic from the baud rate and the pixel count, not a measurement**, and
no panel is attached to the machine this was written on. But if it is even roughly
right, it settles the shape:

- On the serial families a **full repaint is minutes**, so the initial draw is a
  visible event and a theme switch is a long one.
- A chart is the expensive widget, at seconds per redraw. **The useful knob is not a
  frame rate** — it is *which region, how often*. That is a different model from
  every display this product has today, where a browser repaints whatever it likes for
  free.
- The TUR_USB family escapes the constraint entirely, because a PNG of a dashboard is
  tens of kilobytes over bulk transfer. **The larger, newer panels are the ones worth
  targeting, and they are also the ones with the harder protocol** (below).

## Why the host cannot do this today

**The host has never drawn a pixel.** `server.ts`'s `tick()` samples the union of the
active displays' semantic keys once, serialises one batch, and offers it to every
connection — the browser does all rendering. The host's entire dependency list is
`@vigilia/renderer-core`, `@vigilia/theme-package` and `systeminformation`. There is no
canvas, no image encoder, no serial and no USB anywhere in the workspace: a scan of
every `package.json` under `packages/` for a canvas, image, serial, USB or HID
dependency returns nothing.

So there are two real blockers, and one of them is measured rather than reasoned.

**1. A renderer in the host, able to draw a *region*.** This is the whole job, and it is
a subsystem rather than a task. The guardrails forbid the obvious shortcut — "Fabric
JSON is the persisted scene. No second simplified scene tree or write-back model" — so a
bespoke panel drawing routine is out. The candidates are headless Fabric in Node
(`fabric/node` plus a canvas implementation, reusing the real scene renderer) or a
headless browser screenshotting the player page. Both have consequences worth naming
early: `scene-fabric`'s background media is a **DOM `<video>` sibling** and glass
samples that layer through `backdrop()`, so **video backgrounds and frosted glass would
simply not exist on a panel** — which is coherent, and should be stated rather than
discovered.

**2. The fast family needs DES-CBC, and this Node cannot do it.** Measured on this
machine — Node 24.13.0, OpenSSL 3.5.4:

```
crypto.createCipheriv('des-cbc', Buffer.from('slv3tuzx'), Buffer.alloc(8))
  → ERR_OSSL_EVP_UNSUPPORTED
```

DES moved to OpenSSL 3's legacy provider, so the TUR_USB header cannot be built with
`node:crypto` as it stands. The ways out are a hand-written DES (small, well-specified,
and a thing to own forever), forcing the legacy provider on, or not supporting that
family — and forcing a provider on is not something to require of a user's machine. So
**the cheap-to-reach family is the slow one and the fast family is the awkward one**,
which is the honest reason this is long-term rather than next.

**3. Transports are a new shipped dependency either way** — `serialport` or `usb`, both
MIT — which means a licence check, `THIRD-PARTY-NOTICES.md` and
`docs/engineering/dependencies.md`, and a native build.

## What it would take, roughly

Ordered by cost, and stated as shape rather than as tasks:

1. **Decide which family is worth supporting at all.** Supporting Rev A and Rev B
   (serial, RGB565, two packet formats, two endiannesses, a sub-revision handshake) is
   a different project from supporting TUR_USB (bulk, PNG, DES). Doing all of them is
   likely three times the work of doing the one anyone actually owns.
2. **A headless renderer that can render a region**, which is the same renderer a
   panel needs for its initial draw, and which nothing in the product has today.
3. **A dirty-region scheduler.** The host already knows which semantic keys a theme
   binds and when a reading changes, so the *information* for "which widget needs
   redrawing" exists — but nothing turns that into a box, and a wrong box is a stale
   or torn region on a wall. This is a mechanism boundary in the reuse gate's sense:
   expensive and invisible when wrong.
4. **The transport and the packet layer**, per family, with the device's own timing
   rules (the 50 ms cooldown, the serial reopen-on-error, the 10 open attempts).
5. **A third display kind in the per-display model** — `kind: "panel"`, with a panel
   hint (port, or VID/PID and serial) where a paired display has a `tokenHash` and a
   local monitor has a `MonitorHint`. No pairing, no credential, no `chartFps` default
   that means anything.

**One integration hazard worth recording now:** the reference says Rev C **cannot
reliably auto-detect its own size** and configures it from the theme instead. That is
the same shape as the per-display spec's "the monitor a display points at is a hint" —
geometry is not identity, and a panel's declared size must be treated as a hint that
can be wrong rather than as a fact.

## Open questions

1. **Which panels, and how many?** Everything downstream depends on this, including
   whether the DES problem has to be solved at all.
2. **Does a panel get a theme of its own, or the same theme rendered smaller?** A
   320×480 panel and a 1440p monitor cannot show the same composition legibly, so
   either the model gains a per-kind artboard or the panel is a second-class citizen.
3. **What is the refresh model when a region costs seconds?** "Which region, how
   often" is not `chartFps`, and pretending it is would be the mistake this capture
   exists to prevent.
4. **Is a full-screen initial draw acceptable at ~27 s?** If not, the panel needs a
   splash, or a cached frame, or the whole feature is for the fast family only.
5. **What happens to glass and video on a panel?** Recommended: refused rather than
   silently dropped, on the same reasoning as the assignment warning.
6. **Does the host render once and share, or once per display?** A panel and a browser
   showing one theme is one scene and two very different rasterisations.

## Not verified, and must be before this is planned

- **Every timing figure above is arithmetic**, not a measurement. No panel is attached
  to the machine this was written on, and nothing has been driven against one.
- **The protocol facts are read from the reference implementation's source**, and only
  from it. `lcd_comm.py`, `lcd_comm_rev_a.py`, `lcd_comm_rev_b.py`,
  `lcd_comm_turing_usb.py`, `serialize.py`, `display.py` and `config.yaml` were read;
  **Rev C, Rev D and the two WEACT revisions were only sampled**, so their packet
  formats are not described here and must not be assumed from Rev A/B.
- **That the DES key and header layout are current.** They were read from a GPL project
  that reverse-engineered a vendor protocol; the vendor can change it, and nothing here
  was confirmed against hardware or a firmware version.
- **That a panel's declared size can be trusted.** The reference's own workaround says
  otherwise for at least one revision.

## The reuse gate has not been run

**This is the first thing to do before any planning, and it is not done.** The seven
rungs need a real search, and **web search was unavailable in the session that wrote
this**, so rungs 4 and 5 in particular — *has anyone already solved this shape, in this
renderer, against this host* — are **undischarged**. The specific question that matters:
whether a maintained JavaScript/TypeScript implementation of this protocol already
exists, because if one does, the transport and packet work above is not ours to write.
Note also that the reference is GPL-3.0-or-later, so a JS library's licence decides
whether it can be used at all rather than merely whether it should be.
