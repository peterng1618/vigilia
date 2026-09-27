# 0004 — One device answers a group: select the assignment, never the maximum

- **Date:** 2026-09-28
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/providers/`,
  `src/web/packages/host/src/server.ts`

## The problem

A theme binds `gpu.load` and nothing else. A machine has two cards. The
baseline provider answered that one key with `highest()` across every
controller (`library.ts:154-168`), so the panel could show card A's load beside
card B's temperature and card C's VRAM — three devices' numbers under one
device's name. Task 9 then had to put a caption on that panel, and a caption is
precisely the thing that makes the mixture *visible*: the display would say
"GeForce RTX 3080" over a temperature belonging to a different card.

So the caption could not be added first. The shape of the problem is:

> **A provider holds N devices of one kind and must answer one key for one of
> them. What is the rule that picks which, and what happens to the other N−1?**

Three sub-shapes hide inside it, and they are not the same problem:

1. Which device answers (`highest`, first, last, the assigned one).
2. How the provider *names* the device it picked, on a machine where the name
   is only available from a second, slower source (a drive's model is not in
   `fsSize()`; a CPU's brand is not in `currentLoad()`).
3. How a caption stays attached to that device when the consumer renames it.

## Rung 1 — Vigilia

Searched: `host/src/providers/{library,lhm,lhm-mapping,lhm-tree,provider,
registry,clock}.ts`, `host/src/settings/{devices,required-devices}.ts`,
`host/src/{server,main}.ts`, `host/public/settings.html`,
`renderer-core/src/data/semantic-keys.ts`, `renderer-core/src/types.ts`,
`editor/src/new-fabric-theme-cards.ts`, `docs/architecture/ownership.md`.

Found — the shape is already solved **once**, for LibreHardwareMonitor, and the
baseline provider is the copy that skipped it.

- `matchLhmSensorsAssigned` (`lhm-mapping.ts:468-530`) filters the sensor list
  to the assigned device's `hardwareId` *before* matching, and returns `[]` when
  the assigned device is gone. `assign.test.ts:20-58` pins that a second,
  higher-reading AMD card does not win. This is exactly the required rule.
- `setAssignment` on `LhmSensorProvider` (`lhm.ts:124-126`) stores the whole
  assignment; `LhmSensorProvider.sample` re-reads it per sample.
- The **library's** `setAssignment` (`library.ts:396-399`) stores only
  `systemDisk` and `dataDisk`, drops `gpu`, and `highest()` answers the rest.
  So the mechanism exists, is tested, and is one field away.
- `gpuDeviceReadings` (`lhm-mapping.ts:283-298`) and `diskDeviceReadings`
  (`:313-346`) already produce `{deviceId, name}` — the model string — for
  every discovered device. It is computed today and thrown away.
- `displayNameFor` (`devices.ts:121-127`) is the consumer-override resolver,
  persisted in `devices.json`, editable in `settings.html:395-404`, and called
  from exactly one place: its own test.
- `DiskLayoutLike` (`library.ts:100-103`) and `diskLayout()`
  (`library.ts:381`) are declared and **never called** — the typed seam for
  resolving a drive model back to a volume.
- `Sample.textValue` (`renderer-core/src/types.ts:14`) and the `clock.ts:61-85`
  emitter are the existing text path; `plan.ts:490-491` already renders it
  verbatim. No second transport is needed or wanted.

## Rung 2 — dependencies

Searched: `host/package.json`; installed `node_modules/systeminformation`
5.33.13 typings (`index.d.ts`).

Found — the three sources this needs are all already declared in the local
`LibraryModule` type, and two of the three are already declared-but-uncalled:

- `si.cpu()` → `CpuData { manufacturer, brand, model, … }` (`index.d.ts:69`).
  Never called anywhere in the repo.
- `si.diskLayout()` → `DiskLayoutData { device, name, … }` (`:262-279`).
  Declared at `library.ts:381`, never called.
- `si.blockDevices()` → `BlockDevicesData { mount, label, device, … }`
  (`:450-466`). **Not referenced anywhere in the repo.** It is the only source
  that joins a *volume* (`mount`) to a *physical device* (`device`), which is
  the join the model→volume lookup needs — see rung 6.
- `si.graphics().controllers[]` is one entry per controller. The library
  already models it (`ControllerLike`, `library.ts:105-114`) and already reads
  `model` — in `describeDevices()` only.

No other dependency ships a device inventory, and none is worth adding for
this: every value needed is already in `systeminformation`.

## Rung 3 — platform

Searched: `node:os` (`os.cpus()`, `os.networkInterfaces()`), the WMI command
line (`wmic diskdrive get model`), `child_process`.

Measured on this machine:

```
os.cpus()[0].model      → "Intel(R) Core(TM) i9-10850K CPU @ 3.60GHz"   (one string)
os.cpus().length        → 20                                            (20 entries, ONE model)
os.networkInterfaces()  → Ethernet, Npcap Loopback Adapter, vEthernet (WSL …)
wmic diskdrive get model → ST4000DM004-2CV104 | WD My Passport 259F USB Device |
                           Lexar 500GB SSD
```

What it gives, and what it does not:

- **CPU identity is native and free** — but as *one* string, not the three
  fields `CpuData` separates. `os.cpus()[0].model` is the full marketing string
  (`Intel(R) Core(TM) i9-10850K CPU @ 3.60GHz`); `si.cpu()` returns
  `manufacturer: "Intel"`, `brand: "Core™ i9-10850K"`, `model: "165"`. The
  user ruled all three ship, and only the library can supply all three.
- **No GPU anything.** `os` has no graphics API on any platform.
- **No volume identity at all.** `wmic diskdrive` lists *drives*; mapping a
  drive letter to a drive needs a second WMI class, and `wmic` is deprecated
  and Windows-only. The library's `fsSize()`/`diskLayout()`/`blockDevices()`
  are the same underlying WMI, already dependency-pinned and cross-platform.

So the platform cannot answer the question, and the CPU half would cost a
*second* CPU source with a different string — two owners for one concept, which
`AGENTS.md` forbids.

## Rung 4 — ecosystem

Searched: how Prometheus node_exporter and its hwmon collector attribute a
metric when several devices of one kind are present; node_exporter issues #3646
and #3673 on colliding `chip` labels; node_exporter issue #2374 on device vs
name; the glances GPU plugin (`glances/plugins/gpu/__init__.py`, read via
Fossies) and its per-GPU/mean views; LibreHardwareMonitor issue #2202
("Mixed sensor values from two the same GPUs") and PR #2232;
`systeminformation`'s own multi-GPU output (issue #536, dual-GPU MacBooks).

Found — **every project answers per device, and none of them attributes an
aggregate to one device's name.** The pattern is unanimous:

**node_exporter / hwmon — one series per device, name attached as a label.**

```
node_hwmon_temp_celsius{chip="platform_thermal_thermal_zone0",sensor="temp0"} 60.69
node_hwmon_temp_celsius{chip="ieee80211_phy0",sensor="temp1"}               55.00
```

There is no `node_hwmon_temp_max_celsius` *across chips* — `..._max_...` exists
per chip and means the sensor's own critical/max attribute. The two hardest
issues on the collector are both about making a device *identifiable*, never
about blending devices: #3646 and #3673 fix two hwmon nodes colliding on the
same `chip` label by suffixing the distinguishing `name`-file content. And
#2374 asks for the human-readable name *as a label*, answered with a separate
`node_hwmon_chip_names` info-metric to join against — precisely so the name can
travel with the device without changing every series' label set.

**glances — per device, and the aggregate is renamed, not attributed.**

`_get_mean` computes `sum(s[k] for s in self.stats)/len(self.stats)` over *all*
GPUs for the one-line summary, and then the summary line is labelled
`proc mean:` / `temp mean:`, with the header rendered as `"2 GPUs"`. Its
detailed view (`_msg_curse_multi`) drops the aggregate entirely and lists each
GPU by its own `name`. So even the project that *does* aggregate refuses to put
one device's name on the aggregate — it changes the label instead. The
multi-GPU API shape is one record per GPU, each carrying its own `name`.

**LibreHardwareMonitor — the mixing bug is a known upstream defect, and the fix
was per-controller.** Issue #2202 is this exact symptom, filed against LHM
itself: "Some sensors values are mixed between two graphics cards… GPU Core is
reported separately and fine for both RTX 5060s, but GPU memory is not." The
fix (PR #2232) is in `NvidiaGpu.cs` and indexes by controller. LHM's own data
model is one hardware node per device, with the node's `Text` as the model —
which is what `flattenLhmSensors` already reads.

**systeminformation — one entry per controller, no aggregation.** Its dual-GPU
output (issue #536) is `controllers: [Intel…, AMD…]`. Every aggregation we do
is ours.

**The answer, from four independent projects:** *a metric belongs to a device;
a device is named; if you must show an aggregate, change the label to say so
rather than borrowing a device's name.* Vigilia has exactly one key per group
and no indexed per-device form (`semantic-keys.test.ts:53-57` deliberately
declares none), so the ecosystem's per-device-series answer is not available to
us — the **selection must happen inside the provider**, and the selection must
be the assignment.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Keep `highest()`, add captions anyway | names a max; the defect, visible | 0 | a panel says one card over another's temperature | **rejected — the defect** |
| Per-device keys (`gpu.0.load`) | the node_exporter answer verbatim | new key shape, contradicts `semantic-keys.test.ts:53-57` and spec 0010's open question | a provider would contradict the vocabulary | rejected — the vocabulary ruled it out |
| Select by "busiest" | preserves today's documented default | 0 | **the caption flickers between two names every sample** and the panel's identity is not stable | rejected — see below |
| Select the first controller in array order | deterministic | ~1 line | `provider.ts:9`: "Never derive identity from tree/array position" | rejected — the contract forbids it |
| **Select the assigned device; unassigned, the one device that answers** | exact; matches `matchLhmSensorsAssigned` | reuse the existing field + rule | none — LHM already ships it | **accepted** |

**Why not "busiest", given the settings page promises it.** `settings.html:439`
offers "Busiest (default)" for the GPU group, and `library.ts:154`'s comment
says "one figure should describe the busiest". Both describe the *current* rule,
not a requirement: the brief forbids selecting a name for another device's
readings, and a caption that changes every sample is a caption that cannot be
read. A default that is stable frame to frame is a precondition for a caption
being a caption. The copy is updated to match the rule that ships.

**Why "the one device that answers" is well-defined.** On a single-GPU machine
(unambiguous) there is nothing to choose. On a multi-GPU machine with no
assignment, the provider picks the first controller that reports a reading, in
the order the library enumerates — a deterministic function of the machine's
own inventory, not of array position in a *sensor list* (the rule
`provider.ts:9` guards, which is about identity of a *sensor*, and is
independently satisfied because the sensorId is still `<provider>:<key>`). The
choice is visible to the consumer as a `<select>` they can change, and the
selection is the same for the metric and the caption because both come from the
same selection.

## Rung 6 — probe

Run against this PC (`systeminformation@5.33.13`, Node, Windows), because the
model→volume join is the one claim that cannot be reasoned out:

- `si.cpu()` → `manufacturer "Intel"`, `brand "Core™ i9-10850K"`, `model "165"`.
  **All three differ**, and `model` alone is useless — which is the measured
  reason all three ship as separate keys rather than one.
- `si.graphics().controllers` → exactly one controller here
  (`NVIDIA GeForce RTX 3080 Ti`). **This machine has no second GPU**, so the
  multi-GPU path can only be proven by injected controllers, not claimed.
- `si.fsSize()` → four volumes `C: D: E: X:` with `fs === mount` and **no
  model, no label, no device**.
- `si.diskLayout()` → four drives keyed by `\\.\PHYSICALDRIVEn`, each with a
  `name` (the model). **No mount, no volume.**
- `si.blockDevices()` → the join, and the only place it exists:
  `{name:"D:", mount:"D:", label:"Data", device:"\\\\.\\PHYSICALDRIVE0"}` — and
  `diskLayout()[0]` is `{device:"\\\\.\\PHYSICALDRIVE0", name:"ST4000DM004-2CV104"}`.

So **model → volume is a three-way join**: `diskLayout` (device → model) ⨝
`blockDevices` (device → mount) ⨝ `fsSize` (mount → capacity). `diskLayout` alone
cannot do it, which is why `library.ts:425-427`'s comment ("a model name … could
never match an assigned id back to a volume here") was true when written and is
no longer: the missing half was `blockDevices`, never called anywhere in the
repo. Note `blockDevices[].model` is **empty on Windows**, so the model must
come from `diskLayout` and only the *mount* comes from `blockDevices`.

Cost, same run — this is why the join is cached and not per-sample
(`DEFAULT_SAMPLE_INTERVAL_MS` is 1000):

| call | ms |
|---|---|
| `si.cpu()` | 1606, 1496 |
| `si.blockDevices()` | 1484, 1466 |
| `si.diskLayout()` | 1978 |
| `si.graphics()` | 1282 |
| `si.fsSize()` | 710 |

`ponytail:` the name index is refreshed on `setAssignment` and on
`describeDevices()`, never per sample. A drive plugged in while the host runs
keeps serving the previous index until the consumer republishes the assignment
or opens the settings page. Upgrade path when that bites: refresh the index when
a selected device id is not found in it, which is the same lazy miss the
assignment path already has.

## Decision

**One device answers a group, and the provider names that same device.**

- The assigned device answers, and the other devices are filtered out *before*
  matching — `matchLhmSensorsAssigned`'s existing rule, applied to the library's
  GPU group and to both providers' caption keys. An assigned device that is
  gone yields a gap, never another device's numbers.
- With no assignment, the provider selects the one device that reports, and
  reports a **selection**, not a maximum. `highest()` is deleted.
- The caption and the metrics come out of the *same selection*, so they cannot
  disagree by construction.

**Captions are the existing `Sample.textValue` path, declared in the existing
vocabulary**: `cpu.brand`, `cpu.model`, `cpu.manufacturer`, `gpu.name` and
`disk.name` — no `instant`, so `plan.ts` renders them verbatim. No second
metadata transport, and no serial number or provider-instance id ever reaches a
theme: the name index carries only the `name`/`mount`/`device` display fields.

**The volume's identity is its drive model**, per the user's ruling, which
requires the library to learn the model→volume join above. The display name is
`displayNameFor` — the consumer's choice, else the detected model — and that
resolver, already persisted and already editable, is what the providers now
call. A drive that cannot be resolved to a volume is a gap, not a fallback to
another drive.

**In-flight assignment changes need no generation counter.** Every provider
reads its assignment exactly once, *after* the asynchronous reads, at selection
time; an assignment published while a sample is in flight is therefore the one
that sample uses, for the caption and the metrics together. A counter would be
a second thing to keep in sync with no case it covers.
