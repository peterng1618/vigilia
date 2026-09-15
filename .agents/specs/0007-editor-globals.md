# 0007 — Editing theme globals

- **Status:** behaviour retained; UI implementation moves with specs 0011/0013
- **Design sections:** §73, §75, §170

Globals are document/theme state. Their editing UI should integrate into the new
image-editor-based editor foundation; the legacy Theme tab layout is not a
requirement.

## Requirements

Every global group remains discoverable, including empty groups that can accept
new entries.

A global entry has:

- stable key used by references;
- editable display name;
- typed value;
- where-used count/navigation where practical.

Operations:

| Operation | Behaviour |
|---|---|
| Add | create a unique valid key |
| Edit value | all references follow without rewriting each site |
| Rename display name | references unchanged |
| Rekey | rewrite every reference atomically |
| Delete | reassign references; schema-v2 fallback may use `palette.none` |

Invalid/duplicate keys, empty required names and unknown tokens are refused
without creating history entries.

## Reference handling

Reference traversal has one owner and must cover every semantic reference site.
Do not duplicate site lists in counting, rekeying, deletion and UI code.

Schema v2 changes from spec 0011 apply:

- colour/gradient palette tokens;
- type presets replacing separate font/font-size groups;
- reserved undeletable `palette.none`;
- chart styling references the same token system where supported.

Do not preserve the old behaviour of inlining colour literals on delete once
colour literals are removed by schema v2.

## Editor integration

Use/extend the source fork's property/theme UI architecture. Do not preserve the
old right/left panel arrangement or current `globals-panel.ts` simply because it
exists.

Global edits that can cleanly use authored history should remain undoable. Live
telemetry never participates.

## Acceptance

- rename leaves references intact;
- rekey updates every reference site;
- delete leaves no dangling refs and honours `palette.none` rules;
- changing a token updates all dependents;
- invalid edits are refused without mutating authored state;
- palette and type-preset UI are available in the chosen editor foundation;
- reference traversal has one tested owner.