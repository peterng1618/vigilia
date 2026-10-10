import type { FabricGlobals, TypePreset } from "@vigilia/renderer-core";
import { useCallback, useState, useSyncExternalStore } from "react";
import { ControlNumber } from "../../components/ui/control-number.js";
import { ControlSelect } from "../../components/ui/control-select.js";
import { ControlText } from "../../components/ui/control-text.js";
import { catalogFaces, fontTrios } from "../../font-catalog.js";
import { newPresetType } from "../../new-fabric-theme-globals.js";
import { resolveTypePreset } from "../../selection-inspector/appearance.js";
import type {
  TypePresetFontActions,
  TypePresets,
} from "../../type-preset-manager/panel.js";
import { uiCopy } from "../../ui-copy.js";

/**
 * The Tokens pane's preset library: every preset as a resolution line, the
 * chooser that names it, a new-preset row, and the chosen preset's own fields.
 *
 * **A resolution is not a control.** The line beside a preset is its label and a
 * mono value with no well, because a border means editable (bible §5.1) and the
 * editable copy of the same numbers sits inches below it. `resolveTypePreset` is
 * the one owner of what a preset resolves to, so this file reads the rule rather
 * than restating the "family weight sizepx" it composes.
 *
 * **Nothing is re-derived here (R33).** The membership is `Object.keys(presets)`,
 * the faces and trios come from `catalogFaces()`/`fontTrios()`, and every
 * editable field is the shell's own control set — a second table of any of them
 * is the defect this file exists to avoid. There is no native `<select>`.
 */
export interface PresetListProps {
  readonly presets: TypePresets;
  readonly onChange: (presets: TypePresets) => void;
  readonly onDelete: ((id: string, replacement: string) => void) | undefined;
  readonly fontActions: TypePresetFontActions | undefined;
  /** Where the selection's own preset is read from. Absent reads as nothing
   *  selected — a list mounted with no shell behind it says so rather than
   *  inventing a selection. */
  readonly selection: PresetSelection | undefined;
}

/**
 * The stage's answer to "what is the selection set in", as the pane reads it.
 *
 * The pane is a persistent React tree and the selection is Fabric's, so the id
 * is pulled through a subscription rather than handed over once. The shape is
 * the shell's own projection (`EditorShellSnapshot`), which is the one owner of
 * what is selected — this file never walks the scene itself (R33).
 */
export interface PresetSelection {
  subscribe(listener: () => void): () => void;
  get(): {
    readonly selectedCount: number;
    readonly selectionPresetId: string | undefined;
  };
}

/** No shell behind the list. A module constant, because
 *  `useSyncExternalStore` compares snapshots by identity. */
const NO_SELECTION: ReturnType<PresetSelection["get"]> = {
  selectedCount: 0,
  selectionPresetId: undefined,
};

function usePresetSelection(
  source: PresetSelection | undefined,
): ReturnType<PresetSelection["get"]> {
  const subscribe = useCallback(
    (listener: () => void) => source?.subscribe(listener) ?? (() => undefined),
    [source],
  );
  const read = useCallback(() => source?.get() ?? NO_SELECTION, [source]);
  return useSyncExternalStore(subscribe, read, read);
}

/**
 * What the pane says the **selection** is set in, as against what the chooser
 * below it is browsing.
 *
 * This is the distinction `vg-094` is about: a default and an answer must not
 * read alike, so four cases read four ways. "The selection is set to …" when
 * the selection carries a preset; a dangling reference reads as unresolved,
 * which is a third answer and collapses into neither empty one; "carries no
 * type preset" when the selection is set in none; and "nothing selected" when
 * there is no selection at all — never the first declared preset, which is what
 * `Object.keys(presets)[0]` used to masquerade as.
 */
export function Binding(props: {
  readonly presetId: string | undefined;
  readonly hasSelection: boolean;
  readonly presets: TypePresets;
}): React.JSX.Element | null {
  const { presetId, hasSelection, presets } = props;
  const sentence = ((): string => {
    if (!hasSelection) return uiCopy.panels.selectionEmpty;
    if (presetId === undefined) return uiCopy.panels.selectionNoType;
    // The name, because every surface that offers a reference names what it
    // offers; the ref is what is left when the document no longer declares it.
    const name = presets[presetId]?.name;
    return name === undefined
      ? uiCopy.panels.selectionUnresolved(`typePresets.${presetId}`)
      : uiCopy.panels.selectionSetTo(name);
  })();
  // A plain line, not a live region: the pane is rerendered on every selection,
  // and an announcement per canvas click is noise rather than information.
  return (
    <p data-vigilia-type-preset-binding="" className="text-xs text-muted">
      {sentence}
    </p>
  );
}

/**
 * The selector a reveal is aimed at: the row of one preset, or the whole list
 * when the selection names no preset. One owner for the row's hook, so the
 * session that asks for the reveal does not spell it a second time.
 */
export function presetRevealTarget(presetId: string | undefined): string {
  if (presetId === undefined) return "[data-vigilia-type-presets]";
  const quoted = typeof CSS === "undefined" ? presetId : CSS.escape(presetId);
  return `[data-vigilia-type-preset-row="${quoted}"]`;
}

export function PresetList(props: PresetListProps): React.JSX.Element {
  const { presets, onChange, onDelete, fontActions, selection } = props;
  const ids = Object.keys(presets);
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const stage = usePresetSelection(selection);
  // Derived, not stored: an explicit pick wins, else the preset the selection
  // is set in, else the first declared one — which is only a browse default now
  // that the readout above states the selection's own answer.
  const selected =
    [picked, stage.selectionPresetId].find(
      (id) => id !== undefined && presets[id] !== undefined,
    ) ?? ids[0];
  const entry = selected === undefined ? undefined : presets[selected];
  // The resolver reads a `FabricGlobals`, and this list's own record *is* the
  // `typePresets` of one — so the rule keeps its single owner with no copy.
  const globals: FabricGlobals = { typePresets: presets };

  const commit = (next: {
    readonly name: string;
    readonly value: TypePreset;
  }): void => {
    if (selected === undefined) return;
    onChange({ ...presets, [selected]: next });
  };

  const add = (): void => {
    const id = nextId(presets);
    onChange({
      ...presets,
      [id]: { name: uiCopy.panels.newType, value: newPresetType },
    });
    setPicked(id);
  };

  return (
    <div
      data-vigilia-type-presets=""
      className="flex flex-col gap-[var(--space-8)]"
    >
      <h2 className="text-xs font-semibold tracking-[0.11em] text-muted uppercase">
        {uiCopy.panels.typePresets}
      </h2>
      {/* What the selection is set in, above the control that browses the
          library: the two are separate readouts, so choosing another preset to
          edit below never claims to have applied it to the selection. */}
      <Binding
        presetId={stage.selectionPresetId}
        hasSelection={stage.selectedCount > 0}
        presets={presets}
      />
      <ControlSelect
        label={uiCopy.panels.typePreset}
        data={{ "data-vigilia-type-preset": "" }}
        value={selected ?? ""}
        options={ids.map((id) => ({ id, name: presets[id]?.name ?? id }))}
        onChange={(id) => setPicked(id)}
      />
      {/* The resolution rows. Each is a label and a mono value and nothing
          else — the well-free treatment §5.1 gives a read-only line, so the
          border below is the only thing that says "editable". */}
      <ul className="flex flex-col gap-[var(--space-4)]">
        {ids.map((id) => (
          <li key={id}>
            <div
              data-vigilia-type-preset-row={id}
              className="flex items-baseline gap-[var(--space-8)]"
            >
              <span className="text-xs text-muted">
                {presets[id]?.name ?? id}
              </span>
              <span
                data-vigilia-type-preset-resolution=""
                className="ml-auto font-mono text-xs text-muted"
              >
                {resolveTypePreset(globals, `typePresets.${id}`) ?? ""}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-vigilia-type-preset-add=""
        onClick={add}
        className={buttonClass}
      >
        {uiCopy.panels.addType}
      </button>
      {selected === undefined || entry === undefined ? null : (
        /* Keyed by the preset: a switch changes which record every field edits,
           so the field set is rebuilt rather than reconciled onto the next
           preset with the previous one's half-typed draft still in it. */
        <PresetFields
          key={selected}
          entry={entry}
          presets={presets}
          selected={selected}
          commit={commit}
          onDelete={onDelete}
          fontActions={fontActions}
        />
      )}
    </div>
  );
}

/** The chosen preset's own fields: its name, its family, its size, the three
 *  optional numbers, the curated face and trio adoption, and the
 *  reassignment-on-delete row. */
function PresetFields(props: {
  readonly entry: { readonly name: string; readonly value: TypePreset };
  readonly presets: TypePresets;
  readonly selected: string;
  readonly commit: (next: {
    readonly name: string;
    readonly value: TypePreset;
  }) => void;
  readonly onDelete: ((id: string, replacement: string) => void) | undefined;
  readonly fontActions: TypePresetFontActions | undefined;
}): React.JSX.Element {
  const { entry, presets, selected, commit, onDelete, fontActions } = props;
  const value = entry.value;
  const put = (next: TypePreset, name = entry.name): void =>
    commit({ name, value: next });

  return (
    <div
      data-vigilia-type-preset-fields=""
      className="flex flex-col gap-[var(--space-8)]"
    >
      <ControlText
        label={uiCopy.panels.name}
        data={{ "data-vigilia-type-name": "" }}
        value={entry.name}
        onCommit={(next) => {
          const trimmed = next.trim();
          if (trimmed === "") return;
          put(value, trimmed);
        }}
      />
      <ControlText
        label={uiCopy.panels.family}
        data={{ "data-vigilia-type-family": "" }}
        value={value.family}
        onCommit={(next) => {
          const trimmed = next.trim();
          if (trimmed === "") return;
          put({ ...value, family: trimmed });
        }}
      />
      <ControlNumber
        label={uiCopy.panels.size}
        data={{ "data-vigilia-type-size": "" }}
        value={value.size}
        onCommit={(size) => {
          // A preset's size cannot be zero or negative. `ControlNumber` already
          // refuses a non-number; this refuses the number it lets through rather
          // than writing a size nothing can be set in.
          if (!Number.isFinite(size) || size <= 0) return;
          put({ ...value, size });
        }}
      />
      <ControlText
        label={uiCopy.panels.weight}
        data={{ "data-vigilia-type-weight": "" }}
        value={String(value.weight ?? "")}
        onCommit={(next) => {
          // An emptied optional field **removes its key** — it does not write
          // an empty string, which would be a weight the renderer cannot use.
          const { weight: _weight, ...rest } = value;
          const trimmed = next.trim();
          put(trimmed === "" ? rest : { ...rest, weight: trimmed });
        }}
      />
      <ControlNumber
        label={uiCopy.panels.lineHeight}
        data={{ "data-vigilia-type-line-height": "" }}
        value={value.lineHeight}
        onClear={() => {
          const { lineHeight: _lineHeight, ...rest } = value;
          put(rest);
        }}
        onCommit={(lineHeight) => {
          if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
          put({ ...value, lineHeight });
        }}
      />
      <ControlNumber
        label={uiCopy.panels.letterSpacing}
        data={{ "data-vigilia-type-letter-spacing": "" }}
        value={value.letterSpacing}
        onClear={() => {
          const { letterSpacing: _letterSpacing, ...rest } = value;
          put(rest);
        }}
        onCommit={(letterSpacing) => {
          if (!Number.isFinite(letterSpacing)) return;
          put({ ...value, letterSpacing });
        }}
      />
      {fontActions === undefined ? null : (
        <FontControls selected={selected} fontActions={fontActions} />
      )}
      <DeletionControls
        presets={presets}
        selected={selected}
        onDelete={onDelete}
      />
    </div>
  );
}

/** The curated face and trio the preset can adopt. The face list and the trio
 *  list are `font-catalog`'s, and the two apply buttons run through the ports
 *  the session handed in — never a second loader here. */
function FontControls(props: {
  readonly selected: string;
  readonly fontActions: TypePresetFontActions;
}): React.JSX.Element {
  const { selected, fontActions } = props;
  const faces = catalogFaces();
  const trios = fontTrios();
  const [faceId, setFaceId] = useState<string>(faces[0]?.id ?? "");
  const [trioId, setTrioId] = useState<string>(trios[0]?.id ?? "");
  const face = faces.find((candidate) => candidate.id === faceId);

  return (
    <>
      <ControlSelect
        label={uiCopy.panels.fontFace}
        data={{ "data-vigilia-font-face": "" }}
        value={faceId}
        options={faces.map((candidate) => ({
          id: candidate.id,
          name: `${candidate.family} ${candidate.weight}`,
        }))}
        onChange={setFaceId}
      />
      <div className="flex items-center gap-[var(--space-6)]">
        <button
          type="button"
          data-vigilia-font-preview=""
          onClick={() => {
            if (face !== undefined) void fontActions.preview(face);
          }}
          className={buttonClass}
        >
          {uiCopy.panels.previewFont}
        </button>
        <button
          type="button"
          data-vigilia-font-apply=""
          onClick={() => {
            if (face !== undefined) void fontActions.applyFace(selected, face);
          }}
          className={buttonClass}
        >
          {uiCopy.panels.applyFont}
        </button>
      </div>
      <ControlSelect
        label={uiCopy.panels.fontTrioAdopt}
        data={{ "data-vigilia-font-trio": "" }}
        value={trioId}
        options={trios.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
        }))}
        onChange={setTrioId}
      />
      <button
        type="button"
        data-vigilia-font-trio-apply=""
        onClick={() => {
          void fontActions.applyTrio(trioId);
        }}
        className={buttonClass}
      >
        {uiCopy.panels.applyTrio}
      </button>
    </>
  );
}

/** The reassignment-on-delete row: the preset this one's references move to, and
 *  the deletion itself. The delete is refused when there is nothing to move them
 *  to, because deleting the last preset would strand every reference to it. */
function DeletionControls(props: {
  readonly presets: TypePresets;
  readonly selected: string;
  readonly onDelete: ((id: string, replacement: string) => void) | undefined;
}): React.JSX.Element | null {
  const { presets, selected, onDelete } = props;
  const [picked, setPicked] = useState<string | undefined>(undefined);
  if (onDelete === undefined) return null;
  const options = Object.entries(presets)
    .filter(([id]) => id !== selected)
    .map(([id, entry]) => ({ id, name: entry.name }));
  const replacement =
    picked !== undefined && picked !== selected && presets[picked] !== undefined
      ? picked
      : options[0]?.id;
  return (
    <>
      <ControlSelect
        label={uiCopy.panels.reassign}
        data={{ "data-vigilia-type-replacement": "" }}
        value={replacement ?? ""}
        options={options}
        onChange={setPicked}
      />
      <button
        type="button"
        data-vigilia-type-delete=""
        disabled={replacement === undefined}
        onClick={() => {
          if (replacement !== undefined) onDelete(selected, replacement);
        }}
        className={`${buttonClass} text-hot disabled:text-faint`}
      >
        {uiCopy.panels.deleteType}
      </button>
    </>
  );
}

const buttonClass =
  "self-start rounded-md border border-edge bg-panel-2 px-[var(--space-6)] py-[var(--space-4)] text-sm text-text hover:border-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

/** The first free `type`, `type-2`, … — the ids are stable keys references are
 *  written against, so a new preset never reuses a deleted one's id. */
function nextId(presets: TypePresets): string {
  for (let index = 1; ; index += 1) {
    const id = index === 1 ? "type" : `type-${index}`;
    if (presets[id] === undefined) return id;
  }
}
