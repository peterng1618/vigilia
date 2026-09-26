# Clock and date as sensors

- **Status:** implemented — landed without a paired plan; no plan file exists for it.
- **Requirement:** the clock half of the author journey

## Why

A dashboard without a clock is not a dashboard. Today the starter theme's clock
is **authored literal text** (`"07:24"`), so it shows a fixed time forever — it
looks like a clock and is not one.

The right shape is a provider: time is a reading, and every rule the product
already has about readings then applies — it refreshes on a cadence, a display
binds it semantically, and an author drops it into text like any other sensor.

## What exists

- `Sample` already carries `textValue`, and `resolveTextSegments` already renders
  it, so a text-valued sensor needs **no model change**.
- Providers acquire on the host's cadence and are bound by semantic key (§93).
- `longUnits` and the measurement preference already flow into value formatting.
- The vocabulary has no time or date key.

## Design

### Keys

Two, because they are read differently and refreshed differently:

- `time.now` — the wall clock, `HH:mm`.
- `date.today` — the calendar date.

They are **string** sensors: a clock is a formatted string, not a number. The
families are new (`time`, `date`), so §93's vocabulary gains families rather
than overloading an existing one.

### The provider measures; the display formats

The tension worth naming: time is trivially derivable in the browser, and
deriving it there would be simpler. It is still the host's job, because:

- §116 puts formatting on the display but **acquisition on the PC**, and a clock
  is acquisition: the time a dashboard shows should be the host's clock, so two
  displays agree and a phone with a wrong clock still shows the right time.
- The host already has the timezone and the consumer's locale preferences;
  pushing the clock to the browser would duplicate them per device.

So the provider reports a format the display could not have chosen alone, and the
format preference (below) is applied where the rest of a display's preferences
are.

### The author owns format *and* zone; the consumer supplies the default

Three decisions, and the first draft got two of them wrong:

- **How it reads** is design, so the *author* owns it: `HH:mm`, `dddd, DD MMMM`,
  day of week included.
- **Which zone each clock shows** is *also* design. A world-clocks dashboard is a
  legitimate theme: one clock in the consumer's own zone and others pinned to
  named zones by the author. So the *author* may set a zone per binding, and a
  binding that sets none follows the consumer's default.
- **What the default zone is** is a machine fact, so the *consumer* owns that
  one, in the global settings section.

What the provider sends is an **instant**, never a formatted wall clock: the
reading is written with the offset it was read in, so it cannot be misread as a
local time and a display never re-converts. Which zone that reading is taken in
is resolved in two places, and they do not overlap:

- The **consumer's default zone is the provider's**, applied where the other
  machine preferences are. Two displays of the same theme then agree, and a
  device with a wrong clock still reads the host's time.
- The **author's zone is the binding's**, applied at format time by the display:
  it names the zone for that one clock, so a world-clocks theme works.

This requires one envelope addition: the binding carries an optional author-chosen
zone. That is presentation of a reading, not a new reading, so it belongs on the
binding beside `precision` and `unitDisplay`. The run row authors it beside
**Format**: a **Zone** picker whose first option follows the display and whose
remaining options are every name `Intl` resolves — UTC included, since `Intl`
resolves it but omits it from its canonical list and server time is the zone a
dashboard most often pins. The preview is the reading the run will paint, so it
re-renders in the pinned zone.

`Intl.DateTimeFormat` supplies zone offsets, so no date library is added.

### Formatting is a small token set, not a pattern language

```
HH   24-hour padded      H   24-hour
hh   12-hour padded      h   12-hour
mm   minutes             ss   seconds
dddd weekday name        ddd  weekday short
DD   day padded          D    day
MMMM month name          MMM  month short
MM   month padded        M    month
YYYY year                YY   year short
A    day period (PM)     a    day period (pm)
```

Tokens concatenate, and `[bracketed]` text is always literal. Prose is full of
letters, so an unquoted `[Today is ]dddd` must not read `T` `o` `d` `a` `y` as
tokens; an unclosed bracket keeps its text rather than swallowing the string.
This covers every clock a dashboard needs, including day of week, without
shipping a pattern engine or a dependency. An arbitrary ICU pattern is explicitly
**not** supported: it would be a parser, a second formatting model, and a source
of silent mismatch with `Intl`.

A binding with no format uses a sensible default per family (time `HH:mm`,
date `DD MMM YYYY`).

### Refresh cadence

A clock changes every minute and nothing else does. The host's cadence is 1 s, so
the provider re-reads cheaply and the *display* decides granularity. Two
options, and the spec chooses the simpler:

- Ship the already-rounded string (`14:07`) and refresh on the normal cadence.
  Values repeat between minutes, so the sample stream carries an unchanged string
  most seconds.

This is accepted: the protocol has no change-detection, the payload is a few
bytes, and adding "only send when changed" would be a protocol feature for one
provider's benefit. If a real cost appears, a `stale`-style tick is the fix and
it belongs to the protocol, not this provider.

### One key each, not one per format

`time.now` and `date.today` stay single keys: format multiplies what an author
can *say* about one reading, and a key per format would put presentation in the
vocabulary. Two keys also keep the derivation and binding UIs unchanged.

### Timezone, finally buildable

With the key and provider in place, timezone becomes what the settings spec said
it would be: a machine preference with a real consumer. It joins the global
settings section beside the measurement system — and it is the *only* part of a
clock a consumer configures, since the format is authored.

## Non-goals

- A live-updating seconds clock: the cadence is the host's, and per-second redraw
  is a performance decision this does not need to make.
- Timers, stopwatches, uptime or duration sensors.
- Calendar/agenda data.
- Locale-aware digit formatting beyond what the clock string needs (§89's canvas
  limits still apply).

## Boundaries

- Acquisition and formatting of the clock string belong to the host, beside the
  other providers; the display treats it as any other text sensor.
- The vocabulary gains one family; no existing family is overloaded.
- The timezone preference lives in the global settings section, not a theme's.
- A theme binding `time.now` on a Raspberry-Pi-thin host still gets a reading;
  the provider needs no platform API.

## Acceptance

- `time.now` and `date.today` appear in the authoring picker with the other keys.
- An author can format each one, including day of week, and the rendered result
  matches the tokens they wrote.
- An unknown token renders literally rather than throwing or blanking the text.
- A text run bound to `time.now` shows the host's current time, and updates as
  the cadence advances.
- Choosing a different timezone changes what the dashboard shows, on the next
  cadence, without editing the theme.
- A 12-hour format renders as the author's tokens specify.
- The starter theme's authored `"07:24"` is replaced by a bound clock, so the
  default theme demonstrates the feature rather than a fixed string.
- A theme bound to no time key is unaffected.

## Verification

Driven in a browser against the real host, checking two things the DOM alone
cannot prove: that the shown time advances across cadences, and that changing the
timezone changes the rendered value rather than only a stored setting.

The authoring control is driven in the editor the same way: pinning a zone
rebuilds the control from what was written and the preview then reads that zone's
wall clock, which is what makes the control do something rather than store a
value.
