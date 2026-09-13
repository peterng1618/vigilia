# 0002 — Theme document model and import validation

- **Status:** implemented
- **Design document sections:** §73, §75, §81, §83, §87, §89, §93, §122, §134, §137, §141
- **Specs superseded:** none

## Problem

`schema/theme-document.schema.json` described the persisted format, but nothing
could load it. There were no in-memory types, no validator, and therefore no
JSON round-trip — which Gate 0 and Gate 1 both require. The schema also could
not express the rules that matter most at import: whether a style reference
resolves, whether IDs are unique, whether a tree is bounded.

## Behaviour

### Types

`renderer-core/src/theme/document.ts` mirrors the schema and is **stricter**
where JSON Schema is weak:

- `content` is a discriminated union on node type, not an open object. A chart's
  `settings` are the same types the chart adapters accept, so the format and the
  renderer cannot disagree about what a gauge is.
- `StyleValue` is an exclusive-or at compile time: `{ ref, value }` together does
  not type-check (§75).

### Validation

`validateThemeDocument(unknown)` returns either the typed document or a list of
issues, each with an `IssueCode` and a JSON Pointer.

**Accumulates all issues**, so an import dialog can show everything wrong at
once — with one exception. An unsupported `schemaVersion` returns *only* that
issue: §141 requires failing without changing the library, and reporting type
errors from a format we admit we do not understand would be misleading. A
newer version gets its own code (`newer-schema-version`) so the UI can say
"update Vigilia" rather than "this file is broken".

Rules enforced beyond the schema:

| Rule | Why it cannot be schema-expressed |
|---|---|
| `style.*.ref` resolves to a declared global | Cross-document reference |
| Node, binding and asset IDs are unique | Uniqueness across a recursive tree |
| A text run's `bindingId` names a binding on **its own node** | Scoped reference |
| `image`/`video` `assetId` resolves | Cross-document reference |
| Tree depth ≤ `MAX_NODE_DEPTH`, nodes ≤ `MAX_NODE_COUNT` | Recursive bound |
| Binding arity per node type and chart family | Depends on two fields at once |
| No `..` segment in an asset path | The schema pattern permits it — see below |

### Binding arity

A binding that nothing reads is an error, not a no-op: an author who attaches
one to a rectangle would otherwise wait forever for a value that was never going
to appear.

| Node / family | Bindings |
|---|---|
| `group`, `rectangle`, `ellipse`, `line`, `image`, `video` | 0 |
| `text` | 0–64, referenced by styled runs (§89) |
| chart / `gauge` | exactly 1 — one value against a range |
| chart / `line` | 1–16 |
| chart / `bar`, `pie` | 1–64 |

### Asset paths

The schema's `path` pattern is `^assets/[A-Za-z0-9._/-]{1,200}$`, whose character
class permits `.` — so `assets/../../secrets.env` **matches it**. The schema
description claimed traversal was rejected; the pattern alone never did that.
The validator rejects any `..` segment, and that check is what actually confines
a path to the package. A test pins the pattern's weakness so the check is not
later removed as redundant.

## Out of scope

- **Migrations.** Only `SUPPORTED_SCHEMA_VERSION` loads. When version 2 exists,
  the equality check becomes a migration chain; the issue codes already
  distinguish older from newer.
- **ZIP import** — manifest, staging, decompression-bomb limits, SVG
  sanitisation (§141). This validates a document, not a package.
- **Full settings validation.** Only invariants the adapters cannot recover from
  are checked (a zero-width gauge range, a zero-width donut ring, a non-positive
  line window). Cosmetic bounds are clamped by the adapters, and duplicating them
  here would create a second place to keep in sync.
- **Font validation** (§141 also asks for it) — needs the font-loading work.

## Acceptance

`packages/renderer-core/src/theme/validate.test.ts` — every rule above has a
test, including the version-only failure, the `{ ref, value }` rejection, the
cross-node binding reference, the depth bound at and past the limit, and the
traversal path.

`packages/renderer-core/src/theme/schema-sync.test.ts` reads
`schema/theme-document.schema.json` off disk and asserts the shared constants
(stable-ID pattern, artboard maximum, node types, chart families, global groups,
precision bounds, and every known-key list) match the validator's.

`contracts-mirror.test.ts` since does the same for the C# ↔ `types.ts` mirror,
so that boundary is no longer unguarded either.

**Not verified:** no document has been round-tripped through a file on disk, and
no editor writes this format yet. The types are exercised only by tests and the
player's demo theme.

---

## Addendum — serialisation and widget insertion (2026-09-12)

### Canonical serialisation

`serializeThemeDocument(document, indent?)` emits canonical JSON: schema key
order first, unknown keys alphabetically after, `undefined` dropped, trailing
newline. Idempotent and independent of the input object's key order, which is
what §139's "save marks history clean without clearing it" needs — comparing
objects by identity would mark a document dirty after a no-op edit.

Unknown keys are **kept**. This is not a filter, and dropping a field a newer
build wrote would make a load-and-save lossy.

### Unknown-field rejection

The validator rejects keys a shape does not declare, mirroring the schema's
`additionalProperties: false`, and suggests the nearest known key. This catches
the most common authoring mistake there is: `"visable": false` was previously
valid, rendered, and left the author with nothing to look at.

Forward compatibility is not what this trades away — a field a newer build
introduces arrives with a `schemaVersion` bump, which is rejected earlier and
more clearly.

### Widget insertion (§138)

`instantiateWidget(nodes, options)` embeds a **copy** with fresh IDs. There is
no live link: §138 rules out automatic library-update propagation in v1, so
provenance records origin for a future explicit "update from library" action.

The part that is easy to get wrong, and the reason this is a module rather than a
loop: fresh IDs are not only node IDs. A text run references a **binding ID**,
so both are renamed through one map, allocated in a first pass so a run can be
rewritten whether or not its binding appears earlier in document order.
`semanticKey` is never renamed — a widget bound to `cpu.load` must still be bound
to `cpu.load`, or it arrives showing nothing.

Globals follow §77: an explicit mapping, or conversion to the widget's own
literal, or a reported issue. Never a silent adoption of a same-named global in
the destination, which may mean an entirely different colour.

Offsets and provenance apply to inserted **roots** only. A child's coordinates
are group-local (§57), so offsetting them too would shift every descendant twice.

**Out of scope:** the widget package format (ZIP, manifest, preview, exported
defaults), parameter declarations, and the library UI. This is the insertion
primitive those will call.
