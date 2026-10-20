import { Checkbox } from "@base-ui/react/checkbox";
import { Popover } from "@base-ui/react/popover";
import type * as React from "react";
import { useState } from "react";
import { wellClasses } from "../components/ui/control-well.js";
import { CHECK_GLYPH, Glyph } from "../editor-shell/icons.js";
import { uiCopy } from "../ui-copy.js";

/** One value a facet offers: what it is called, and how many themes carry it. */
export interface FacetOption {
  readonly id: string;
  readonly name: string;
  readonly count: number;
}

/** One facet of the row: its own name, and the values it offers. */
export interface Facet {
  readonly id: string;
  readonly name: string;
  readonly options: readonly FacetOption[];
}

/** The ids one facet's controls carry, derived from the facet and the value the
 *  way `useControlIds` derives one from a control — §5 rule 5 wants every
 *  control to have one, and a facet's values are the record's, so the id cannot
 *  be minted from a counter that would move with the catalogue. */
const facetTriggerId = (facetId: string): string =>
  `vigilia-store-facet-${facetId}`;

const facetOptionId = (facetId: string, optionId: string): string =>
  `${facetTriggerId(facetId)}-${optionId}`;

/**
 * §5's **well with chevron**, and its count: a facet's trigger says what it
 * filters by and how many values are chosen behind it, so the author reads what
 * the row is doing without opening five popovers.
 *
 * The count is only drawn when there is one. A facet with nothing chosen says
 * nothing rather than `0`, which §9 forbids as a fabricated reading — and a
 * literal zero here would also be indistinguishable from a facet whose count
 * has not been derived yet.
 */
function FacetButton(props: {
  readonly facet: Facet;
  readonly chosen: readonly string[];
  readonly onToggle: (optionId: string) => void;
}): React.JSX.Element {
  const { facet, chosen, onToggle } = props;
  const count = chosen.length;

  return (
    <Popover.Root>
      {/* The trigger is the well the control set already draws, with the
          chevron `ControlSelect` puts in its own: one idiom for "opens a list".
          The open state raises the resting `--edge` to `--muted`, which is §5
          rule 6's hover treatment on a control that carries a border — a
          pointer and a keyboard user see the same mark. */}
      <Popover.Trigger
        type="button"
        id={facetTriggerId(facet.id)}
        data-vigilia-facet={facet.id}
        className={`${wellClasses("panel")} w-auto flex-none gap-[var(--space-6)] text-xs text-muted data-[popup-open]:border-muted data-[popup-open]:text-text`}
      >
        <span data-vigilia-facet-name="">{facet.name}</span>
        {count === 0 ? null : (
          <span
            data-vigilia-facet-count=""
            className="font-mono text-2xs text-muted"
          >
            {count}
          </span>
        )}
        <span aria-hidden className="flex-none text-2xs text-faint">
          ▼
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup
            aria-label={facet.name}
            className="flex max-h-[var(--available-height)] w-[16rem] flex-col gap-[var(--space-4)] overflow-y-auto rounded-xl border border-edge bg-panel p-[var(--space-8)] shadow-[var(--elev-2)]"
          >
            {facet.options.map((option) => (
              <FacetOptionRow
                key={option.id}
                facet={facet}
                option={option}
                checked={chosen.includes(option.id)}
                onToggle={() => onToggle(option.id)}
              />
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * DESIGN.md §5's **checkbox choice row**: the choice row's geometry and its
 * chosen treatment, with a checkbox in place of the radio and no group owning
 * one checked bit — a facet is a set you may choose *several* of, which is why
 * §5's rule 7 (a radio in one labelled `radiogroup`) is not this control's shape.
 *
 * The row is the whole target, the box is decoration beside its own name, and
 * the count is the number of themes behind the value: the author chooses by how
 * much is there, which is the one thing a facet popover can say that a list of
 * names cannot.
 */
function FacetOptionRow(props: {
  readonly facet: Facet;
  readonly option: FacetOption;
  readonly checked: boolean;
  readonly onToggle: () => void;
}): React.JSX.Element {
  const { facet, option, checked, onToggle } = props;

  return (
    <Checkbox.Root
      nativeButton
      render={<button type="button" />}
      id={facetOptionId(facet.id, option.id)}
      data-vigilia-facet-option={option.id}
      checked={checked}
      onCheckedChange={() => onToggle()}
      className="group flex min-h-[32px] w-full items-center gap-[var(--space-8)] rounded-md border border-edge bg-panel-2 px-[var(--space-10)] py-[var(--space-6)] text-left text-xs text-muted hover:border-muted data-[checked]:border-accent data-[checked]:text-text data-[checked]:[background:var(--stage)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
    >
      <span
        aria-hidden
        className="flex size-[14px] flex-none items-center justify-center rounded-sm border border-edge group-data-[checked]:border-muted"
      >
        <Checkbox.Indicator className="flex text-text">
          <Glyph icon={CHECK_GLYPH} size={10} />
        </Checkbox.Indicator>
      </span>
      <span data-vigilia-facet-option-name="" className="flex-1">
        {option.name}
      </span>
      <span className="flex-none font-mono text-2xs text-faint">
        {option.count}
      </span>
    </Checkbox.Root>
  );
}

/**
 * The store's facet row: one well-with-chevron per facet, each opening a
 * popover of §5's checkbox choice rows.
 *
 * **It draws the values it is given and derives none.** The values come from
 * the facet record A.3 lands in `renderer-core`, which is the layer both the
 * host and the catalogue's Action can import — so this row takes them as props
 * and knows nothing about a theme, a binding or an artboard.
 *
 * **The chosen values live here, and are not yet read by anything.** A.4 and A.5
 * own what a query filters and pages; until then the row is the control and the
 * count is its own reading. It is the row's state rather than the region's for
 * the same reason: nothing outside it has a use for the set yet.
 */
export function FacetRow(props: {
  readonly facets: readonly Facet[];
}): React.JSX.Element {
  const [chosen, setChosen] = useState<
    Readonly<Record<string, readonly string[]>>
  >({});

  const toggle = (facetId: string, optionId: string): void => {
    setChosen((current) => {
      const picked = current[facetId] ?? [];
      return {
        ...current,
        [facetId]: picked.includes(optionId)
          ? picked.filter((id) => id !== optionId)
          : [...picked, optionId],
      };
    });
  };

  return (
    <div
      // `flex-wrap` is the whole of "a wrapped line, never a dropped control":
      // the five are always rendered, and a region too narrow for one line puts
      // the rest on the next rather than clipping them out of reach.
      className="flex min-w-0 flex-wrap items-center gap-[var(--space-8)]"
      data-vigilia-facet-row=""
      role="group"
      aria-label={uiCopy.store.facets.label}
    >
      {props.facets.map((facet) => (
        <FacetButton
          key={facet.id}
          facet={facet}
          chosen={chosen[facet.id] ?? []}
          onToggle={(optionId) => toggle(facet.id, optionId)}
        />
      ))}
    </div>
  );
}
