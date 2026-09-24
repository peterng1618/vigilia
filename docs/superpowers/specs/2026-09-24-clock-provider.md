# Clock and date as sensors

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
family is new (`time`), so §93's vocabulary gains a family rather than
overloading an existing one.

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

### The format is a preference, not a key per format

A consumer's timezone and clock format are global user preferences (the category
the settings page now separates), so they configure the provider rather than
multiplying semantic keys. `time.now` stays the one key; the host renders it
using the consumer's timezone and 12/24-hour choice.

This is why the provider belongs on the host: the format needs the consumer's
settings, which the host owns.

### Timezone, finally buildable

With the key and provider in place, timezone becomes what the settings spec said
it would be: a formatting preference with a real consumer. It joins the global
settings section beside the measurement system.

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
- A text run bound to `time.now` shows the host's current time, and updates as
  the cadence advances.
- Choosing a different timezone changes what the dashboard shows, on the next
  cadence, without editing the theme.
- A 12-hour format choice changes the rendering as expected.
- The starter theme's authored `"07:24"` is replaced by a bound clock, so the
  default theme demonstrates the feature rather than a fixed string.
- A theme bound to no time key is unaffected.

## Verification

Driven in a browser against the real host, checking two things the DOM alone
cannot prove: that the shown time advances across cadences, and that changing the
timezone changes the rendered value rather than only a stored setting.
