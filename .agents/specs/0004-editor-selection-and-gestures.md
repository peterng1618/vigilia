# 0004 — Editor selection and transform behaviour

- **Status:** behaviour retained; custom implementation superseded by [0013](0013-fabric-scene-migration.md)
- **Design sections:** §31, §51, §57, §61, §67, §137

This spec defines behaviour the new Fabric/image-editor foundation must provide.
Do not preserve `geometry.ts`, custom hit-testing, transform gestures or overlay
code merely to satisfy this file.

## Selection

- Topmost visible object wins pointer hit-testing.
- Hidden objects do not intercept clicks but remain selectable from layers.
- Locked objects remain selectable/inspectable; transforms are blocked.
- Group interaction must allow selecting the group and entering it to reach
  children.
- Shift/Ctrl/Cmd behaviour must not combine unrelated meanings that change the
  selection accidentally.
- Marquee selection must work in either drag direction.

Prefer the editor foundation's native selection/group mechanisms.

## Transforms

Generic objects should support move, resize and rotation through Fabric controls.
Group transforms compose with child transforms and preserve world appearance.

Required invariants:

- a selected ancestor and descendant must not apply the same move twice;
- locked objects do not transform;
- rotated-object resize must preserve the intended opposite anchor;
- transform math must remain correct inside rotated/scaled groups;
- rotation wraps naturally rather than clamping at ±180°.

Charts have the relaxed rules in spec 0013: move, rotation and proportional
resize are required; skew/non-proportional stretch are not.

## Snapping

Grid, guide and object snapping are independent and may be bypassed temporarily.
Snap tolerance is screen/zoom stable. Reuse editor/Fabric snapping where
available; implement only the gaps required by §64.

## History

A generic drag/resize/rotate gesture should become one undo transaction where
the chosen editor history supports it. Telemetry never enters history. Chart
property-edit undo is optional per §67/0013.

## Acceptance

Verify against the replacement editor, not the retired custom modules:

- topmost/hidden/locked selection rules;
- group entry/child selection;
- move/resize/rotate through transformed ancestry;
- no double transform for ancestor+descendant selection;
- snapping bypass/tolerance;
- chart move/rotate/proportional resize;
- hidden objects remain recoverable from layers.

Browser interaction tests are the primary evidence for this spec.