# Measurement and locale settings — what is actually buildable

## Why this exists as a spec rather than code

Measurement system, location and timezone were named as examples of *global user
preferences*: settings about the person and this PC, rather than about a
dashboard. They illustrate the category the settings page needs, and each is
built when it has a consumer. Checked against the product before building any:

| Setting | Consumer today? |
|---|---|
| Measurement system | **Partially.** Temperature is the only affected family, and only `cpu.temp`/`gpu.temp` reach it. |
| Timezone | **Landed.** `time.now` and `date.today` exist with the clock provider, so the setting chooses the zone the host reads them in. |
| Location | **None yet.** It arrives with weather: the provider is a §99 custom API with its own URL and credentials, and location is that provider's configuration. |

Building all three would add settings a consumer can set that change nothing,
which is worse than not offering them. This spec separates what has a consumer
from what does not, and says what each would need first.

## Settled: measurement system

### The one real effect

Providers report SI: `cpu.temp` and `gpu.temp` in °C, RAM/disk in GB, network in
Mb/s. A consumer in a Fahrenheit context sees °C and has no way to change it.

### Design

- **Global**, not per theme: a consumer's unit preference is a fact about the
  person, not the dashboard. It joins the machine section rather than a theme's
  questions.
- **Conversion at presentation, never in the sample.** A sample carries what the
  provider measured (§97's "never fabricate"). The display formats it. Storing a
  converted value would put a derived number where a measurement belongs, and
  would break the "never show a number that was not measured" rule in the other
  direction — a converted reading is a derivation of a measurement, and it must
  stay traceable to it.
- **One owner.** The plan already formats units through `formatUnit` with a
  `longUnits` map. Unit *symbol and scale* belong together, so the conversion
  joins that boundary rather than a second one beside it.
- **Applies to what it can**: temperature (°C/°F). Volume/mass families do not
  exist yet, so the setting must not pretend to cover them; when a family is
  added, it declares whether it converts.

### What it needs first

- The key's descriptor must say whether it converts and how
  (`renderer-core/src/data/semantic-keys.ts` already carries `unit`; a
  conversion descriptor belongs beside it).
- The display needs the preference at plan time, which means `PlanContext`.
- A double conversion must be impossible: a value converted once must not be
  converted again when a theme's authored text also formats it.

## Settled: timezone

It was sequenced behind a clock key and provider, and both exist, so the setting
was built with the consumer reached. It differs from the measurement preference
in one way: **the provider applies it, not the display.** The reading the host
sends is the instant written with the offset it was read in, so every display
shows one clock and a device with a wrong clock still reads the host's time.
The format stays authored; the zone is the machine fact. A clock an author pins
to a named zone is unaffected.

## Sequenced: location (with weather)

Weather is the first consumer, and it is a §99 custom-API provider with its own
URL, credentials and licence questions. Location becomes that provider's
configuration, so it is built with the provider rather than offered now as a
setting that changes nothing.

## Non-goals

- Converting any of the stored scene, samples or authored text.
- Per-theme unit overrides (a person's unit preference does not change per
  dashboard).
- Locale-aware number formatting beyond unit symbols; the digit-formatting
  question is separate and already limited by canvas text (§89).
- A settings framework; this is one preference with one effect.

## Acceptance

- The measurement setting appears in the global section, not in a theme's
  questions.
- With Fahrenheit chosen, a temperature bound to `cpu.temp` shows the converted
  value and its symbol; with Celsius chosen it shows what the provider measured.
- The conversion happens once: an authored run that formats its own value does
  not double-convert.
- A sample that is a gap stays a gap; conversion never turns it into a number.
- No other family's unit changes, because none declares a conversion yet.
- Rendered inspection of the same theme under both settings.

## Verification

Both settings are driven in a browser against the real host, with the persisted
envelope inspected to prove no converted value entered authored state and the
provider's own reading inspected to prove the sample was untouched.
