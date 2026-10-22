import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type * as React from "react";
import { Fragment } from "react";
import { ControlIconButton } from "../components/ui/control-icon-button.js";
import { ACTION_BUTTON } from "../components/ui/dialog.js";
import { CHECK_GLYPH, CLOSE_GLYPH, Glyph } from "../editor-shell/icons.js";
import { destructiveMarker } from "../object-actions.js";
import { uiCopy } from "../ui-copy.js";
import { CELL_ACTION_REASONS } from "./cell-actions.js";
import type { InstallControl } from "./install-item.js";
import { type InstallState, installStateOf } from "./install-state.js";
import type { CellAction, StoreItem } from "./local-source.js";
import type { SubmitControl } from "./use-submit.js";

/**
 * The item's own surface: the modal a cell opens (`store-detail.html`).
 *
 * **It is a viewer first.** The subject is a picture, so the box is 960px
 * against the settings sheet's 560 and the stage takes the top of it. The stage
 * is **one height for every item** and the theme is contained in it, letterboxed
 * against a ground darker than the modal — sizing the stage to the item would
 * make the modal change height as a person steps between items, which is the one
 * thing a viewer must not do. The theme's own ratio is still what is drawn
 * inside, so this is the one place a portrait artboard is seen uncropped and the
 * reason `Other` is an acceptable answer in the Shape facet.
 *
 * **There is no title bar.** The name, the author, the kind, the version and the
 * change date are one caption line — the drawing's `1.4.0 · 2026-10-14`, from
 * the listing rather than from a second read — and the close control floats over
 * the stage's corner the way a viewer's does — a 56px bar holding a name and a
 * close is 56px of picture. Escape closes it through Base UI's own dismissal,
 * and focus returns to the control that opened it.
 *
 * **The facts are pills, not rows.** A row per sensor spends a 30px line and a
 * label column to say four words; pills under §2's eyebrow put the same facts in
 * a third of the height and wrap when there are many.
 *
 * **One modal for every kind.** The subject is an item, not a theme: `kind` is
 * already the seam the storefront reads, so what changes with the kind is which
 * pills appear and which actions the footer offers — the online half's footer
 * carries Install, Installed or Update in place of the four below.
 *
 * **The provenance is one muted line under the band**, not a group of pills: it
 * is what a cell has no room for, and a cell can say *From the store* and cannot
 * say from where (spec, "Provenance"). Its first clause is `uiCopy.store.fromStore`,
 * the same word the cell's badge draws.
 */

/**
 * The footer's four actions in the drawing's own order — Delete leftmost, Open
 * in editor rightmost, which is the reverse of the cell's facts band. One
 * command reached two ways is not two owners: the cell keeps them because they
 * are frequent (§8) and the modal shows them because this is the surface someone
 * is looking at when they have just read enough to decide. The words are the
 * cell's own (`uiCopy.store.cell.actions`), so the two cannot disagree.
 *
 * **`open` leaves this surface alone.** It loads the stored theme as the
 * editor's document, which is a fact about the document rather than about the
 * item's modal: the theme it opened is the one this surface is showing, and the
 * surface the person is on is the store. Closing here would be this modal
 * deciding something the region owns, and the region's `openId` is what says
 * whether it is on screen.
 */
const FOOTER_ACTIONS = [
  "delete",
  "export",
  "assign",
  "open",
] as const satisfies readonly CellAction[];

/** §4's destructive mark, from its one owner: Delete is the one action here that
 *  destroys, and `destructiveMarker` decides what that means rather than this
 *  surface writing the attribute or the colour itself. */
const DESTRUCTIVE: Readonly<Record<`data-${string}`, string>> =
  destructiveMarker({ destructive: true });

/** The footer's own button, and the one that destroys: §5's dialog button for
 *  the three equal-weight verbs, and the same box without its border for the
 *  verb whose ink is the mark — an accent-filled footer would be the one act
 *  among four, and none of these four is *the* act. */
const FOOTER_BUTTON = `${ACTION_BUTTON} disabled:text-faint`;

/** The counts' reader, declared here rather than hoisted beside the cell's: a
 *  formatter instance is a presentation choice rather than a business rule, and
 *  the caption and the cell's facts band are two surfaces. `en-US` because
 *  `uiCopy` is one English table — the drawing's `1,204`, not the machine's. */
const CATALOGUE_COUNT = new Intl.NumberFormat("en-US");

/** One pill: the drawing's `--panel-2` inside a 1px `--edge` at a full radius.
 *  `mono` is the size's own treatment — two numbers read as one measurement
 *  rather than as a word — and **a proposed pill is that same box dashed and in
 *  `--muted`**, which is the drawing's mark for a word the vocabulary does not
 *  hold yet (`store-detail.html`). */
function Pill(props: {
  readonly id: string;
  readonly name: string;
  readonly mono: boolean;
  readonly proposed: boolean;
}): React.JSX.Element {
  return (
    <span
      data-vigilia-store-item-pill={props.id}
      className={`rounded-full border bg-panel-2 px-[var(--space-10)] py-[var(--space-4)] text-xs font-medium ${
        props.proposed
          ? "border-dashed border-edge text-muted"
          : "border-edge text-text"
      } ${props.mono ? "font-mono" : ""}`}
    >
      {props.name}
    </span>
  );
}

/** One group: §2's eyebrow over its pills. A group with no pills is not drawn at
 *  all — a heading over nothing is a word that says nothing (§9), which is what
 *  a theme that binds no sensor would otherwise leave on screen. */
function PillGroup(props: {
  readonly id: string;
  readonly name: string;
  readonly pills: readonly {
    readonly id: string;
    readonly name: string;
    readonly mono: boolean;
    readonly proposed: boolean;
  }[];
}): React.JSX.Element | null {
  if (props.pills.length === 0) return null;
  return (
    <span
      data-vigilia-store-item-group={props.id}
      className="flex min-w-0 flex-1 flex-col gap-[var(--space-6)]"
    >
      <span
        data-vigilia-store-item-group-name=""
        className="text-2xs font-semibold tracking-[0.11em] text-faint uppercase"
      >
        {props.name}
      </span>
      <span className="flex flex-wrap gap-[var(--space-6)]">
        {props.pills.map((pill) => (
          <Pill
            key={pill.id}
            id={pill.id}
            name={pill.name}
            mono={pill.mono}
            proposed={pill.proposed}
          />
        ))}
      </span>
    </span>
  );
}

/** One reading on a pill: the id a driver reads and the word a person does.
 *  `proposed` is the vocabulary's answer rather than the reading's own, and it
 *  is `false` everywhere a facet word settles the value — Style is the one group
 *  whose values an author can invent. */
interface Reading {
  readonly id: string;
  readonly name: string;
  readonly mono: boolean;
  readonly proposed: boolean;
}

/**
 * The Shape group's readings, in the drawing's order: the ground's own colour
 * mode, the orientation, the aspect bucket and the exact size.
 *
 * **An unclassified theme draws no colour-mode pill.** `unclassified` is the
 * absence of an answer rather than an answer — a mid-grey ground, or a picture
 * behind the board — so there is no word for it and nothing to say (R117).
 */
function shapeReadings(item: StoreItem): readonly Reading[] {
  const { colourMode, orientation, aspect, width, height } = item.facets;
  const readings: Reading[] = [];
  if (colourMode !== "unclassified") {
    readings.push({
      id: colourMode,
      name: uiCopy.store.colourModes[colourMode],
      mono: false,
      proposed: false,
    });
  }
  readings.push({
    id: orientation,
    name: uiCopy.store.orientations[orientation],
    mono: false,
    proposed: false,
  });
  readings.push({
    id: aspect,
    name: aspect === "other" ? uiCopy.store.otherShape : aspect,
    mono: false,
    proposed: false,
  });
  readings.push({
    id: `${width}x${height}`,
    name: uiCopy.store.size(width, height),
    mono: true,
    proposed: false,
  });
  return readings;
}

/**
 * The Style group's readings: one pill per tag the document declares, and the
 * tag the vocabulary does not hold says so **on its own pill** rather than being
 * indistinguishable from a settled one (spec, "The facts are pills, not rows").
 *
 * `vocabulary` is the settled set the region hands down (`settledTags`), not a
 * second reading of the listing: the facet's own options are the tags the items
 * carry, this theme included, so a pill read against those could never be
 * proposed.
 */
function styleReadings(
  item: StoreItem,
  vocabulary: readonly string[],
): readonly Reading[] {
  const settled = new Set(vocabulary);
  return item.facets.tags.map((tag) => {
    const proposed = !settled.has(tag);
    return {
      id: tag,
      // The pill's own words are the field's, because the drawing draws one
      // proposed pill in both places: a second composer would be a second owner
      // of the word (`ui-copy.ts`).
      name: proposed ? uiCopy.panels.tagsProposed(tag) : tag,
      mono: false,
      proposed,
    };
  });
}

/** The caption band: what the item is called and who made it, then the pills.
 *  Nothing in it is a row. */
function Caption(props: {
  readonly item: StoreItem;
  /** The style tags the vocabulary holds, which is what the Style group's
   *  proposed pill is read against (`settledTags`). */
  readonly vocabulary: readonly string[];
}): React.JSX.Element {
  const { item } = props;
  // The cell's own reading of a date: the first ten characters of an ISO-8601
  // instant *are* its UTC day, so no reader sees a different one — a
  // locale-formatted date would give two readers two days (`gallery.tsx`).
  const day = item.updatedAt?.slice(0, 10);
  // **The drawing's own pair, `1.4.0 · 2026-10-14`**, and the separator belongs
  // to the pair rather than to either reading: a theme that declares no version
  // draws no separator and no empty slot, and one with no change date draws its
  // version alone. Composing the sentence here rather than in `uiCopy` is the
  // caption's own punctuation — the `@` on the author is the same kind of mark,
  // and neither is a word a person reads as one.
  //
  // The catalogue's two counts join that same end for the same reason: they are
  // facts about the item rather than about any facet, so they take no group and
  // no row. A library item has no catalogue to read them from and draws neither.
  // The nouns are read, not seen — see `uiCopy.store.counts`.
  const stamp: { readonly key: string; readonly node: React.ReactNode }[] = [];
  if (item.version !== undefined && item.version !== "") {
    stamp.push({ key: "version", node: item.version });
  }
  if (day !== undefined && day !== "") {
    stamp.push({ key: "date", node: day });
  }
  if (item.catalogue !== undefined) {
    const { downloads, favorites } = item.catalogue;
    stamp.push(
      {
        key: "downloads",
        node: (
          <>
            {CATALOGUE_COUNT.format(downloads)}
            <span className="sr-only">
              {` ${uiCopy.store.counts.downloads(downloads)}`}
            </span>
          </>
        ),
      },
      {
        key: "favorites",
        node: (
          <>
            {CATALOGUE_COUNT.format(favorites)}
            <span className="sr-only">
              {` ${uiCopy.store.counts.favorites(favorites)}`}
            </span>
          </>
        ),
      },
    );
  }
  return (
    <span className="flex flex-col gap-[var(--space-12)] px-[var(--space-24)] py-[var(--space-20)]">
      <span className="flex items-center gap-[var(--space-10)]">
        <span
          data-vigilia-store-item-name=""
          className="truncate text-lg text-text"
        >
          {item.name}
        </span>
        <span
          data-vigilia-store-item-author=""
          className="flex-none font-mono text-xs text-muted"
        >
          {item.author === undefined
            ? uiCopy.store.cell.noAuthor
            : `@${item.author}`}
        </span>
        <span
          data-vigilia-store-item-kind=""
          className="flex-none rounded-full border border-edge px-[var(--space-8)] py-[var(--space-4)] text-2xs text-muted"
        >
          {/* A kind this build does not know prints its own identifier: a client
              older than the kind has no word for it, and inventing one would be
              a name nobody chose. */}
          {uiCopy.store.cell.kinds[item.kind] ?? item.kind}
        </span>
        <span className="flex-1" />
        {stamp.length === 0 ? null : (
          <span
            data-vigilia-store-item-date=""
            className="flex-none font-mono text-xs text-faint"
          >
            {stamp.map((part, index) => (
              <Fragment key={part.key}>
                {index === 0 ? null : uiCopy.store.readingSeparator}
                {part.node}
              </Fragment>
            ))}
          </span>
        )}
      </span>
      <span className="flex items-start gap-[var(--space-24)]">
        <PillGroup
          id="reads"
          name={uiCopy.store.pillGroups.reads}
          // A sensor pill carries the descriptor's own `label`, which is what a
          // person reads; the `key` it filters by is the facet's and not this
          // group's.
          pills={item.facets.sensors.map((sensor) => ({
            id: sensor.key,
            name: sensor.label,
            mono: false,
            proposed: false,
          }))}
        />
        <PillGroup
          id="shape"
          name={uiCopy.store.pillGroups.shape}
          pills={shapeReadings(item)}
        />
        {/* The third group the spec names, and the one a theme may have none of:
            `PillGroup` draws no heading over no pills, so an untagged theme
            draws two groups rather than an empty third. */}
        <PillGroup
          id="style"
          name={uiCopy.store.pillGroups.style}
          pills={styleReadings(item, props.vocabulary)}
        />
      </span>
      {/* **The provenance line, which is what a cell has no room for**: where the
          item came from, as one muted line rather than another group of pills
          (`store-detail.html`). **Only the origin clause is drawn** — *Shows on
          …* is an assignment fact no item carries yet, and the surface that owns
          assignment owns that clause. A theme the host holds no record of draws
          no line at all.
          **The version here is not the caption's.** The caption prints the
          document's own version; this one is the version installed from the
          catalogue, and the two can differ — so this is not a duplicate to
          remove. */}
      {item.origin === undefined ? null : (
        <span
          data-vigilia-store-item-origin=""
          className="truncate text-xs text-faint"
        >
          {[
            uiCopy.store.fromStore,
            item.origin.catalogueId,
            item.origin.version,
          ].join(uiCopy.store.readingSeparator)}
        </span>
      )}
    </span>
  );
}

/**
 * The online half's footer reading: one of the drawing's three answers in place
 * of the library's four actions (`store-detail.html:42`).
 *
 * **Installed is a mark, not a control** — there is nothing to do, and the
 * drawing draws no button there. The check carries the rationed accent and the
 * word stays `--muted`, as the cell draws it (`store-browse.html:128-131`).
 * **Install and Update post the item to the host**, disable themselves while the
 * press is in flight, and state the host's refusal beside the control where the
 * person who pressed can read it.
 */
function InstallFooter(props: {
  readonly item: StoreItem;
  readonly state: Exclude<InstallState, "none">;
  readonly install: InstallControl;
}): React.JSX.Element {
  const { item, state, install } = props;

  if (state === "installed") {
    return (
      <span
        data-vigilia-store-item-install={state}
        className="flex items-center gap-[var(--space-6)] text-sm text-muted"
      >
        <span className="flex-none text-accent">
          <Glyph icon={CHECK_GLYPH} size={14} />
        </span>
        {uiCopy.store.cell.installStates.installed}
      </span>
    );
  }

  const busy = install.installingIds.has(item.id);
  const refusal =
    install.refusal?.id === item.id ? install.refusal.message : undefined;
  return (
    <Fragment>
      <button
        type="button"
        id="vigilia-store-item-install"
        data-vigilia-store-item-install={state}
        disabled={busy}
        aria-busy={busy}
        onClick={() => install.onInstall(item)}
        className={FOOTER_BUTTON}
      >
        {uiCopy.store.cell.installStates[state]}
      </button>
      {refusal === undefined ? null : (
        <span
          data-vigilia-store-item-install-refusal=""
          className="max-w-[40ch] text-xs text-warn"
        >
          {refusal}
        </span>
      )}
    </Fragment>
  );
}

/**
 * The library half's submission: the one control here that hands the theme to
 * the store, beside the four actions that keep it on this PC.
 *
 * **The flow can be longer than a press**, so the control states what a person
 * has to do next: the one-time code and the link while the host is authorising,
 * the pull request once it is opened, and the host's own refusal otherwise. The
 * control disables itself only while a press is in flight and after a
 * submission landed; a refusal re-enables it, because acting on the reason is
 * the point of stating it.
 */
function SubmitFooter(props: {
  readonly item: StoreItem;
  readonly submit: SubmitControl;
}): React.JSX.Element {
  const { item, submit } = props;
  // **Only this item's own answer is drawn**, on the same rule the install
  // footer follows: the flow lives on the region and outlives the modal, so a
  // state kept without an id would show theme A's link, refusal or device code
  // on theme B, and disable B's control with A's success.
  const mine = submit.itemId === item.id;
  const state = mine ? submit.state : "idle";
  const userCode = mine ? submit.userCode : undefined;
  const verificationUri = mine ? submit.verificationUri : undefined;
  const url = mine ? submit.url : undefined;
  const refusal = mine ? submit.refusal : undefined;
  const busy = state === "submitting" || state === "authorising";
  const submitted = state === "submitted";
  return (
    <Fragment>
      <button
        type="button"
        id="vigilia-store-item-submit"
        data-vigilia-store-item-submit={state}
        disabled={busy || submitted}
        aria-busy={busy}
        onClick={() => submit.onSubmit(item)}
        className={FOOTER_BUTTON}
      >
        {busy ? uiCopy.store.submit.busy : uiCopy.store.submit.label}
      </button>
      {/* The code is data, so the sentence that names it is the copy group's
          function rather than a composed sentence here. The link is the control
          the sentence tells the author to use, and it opens a new tab so the
          editor is not replaced mid-flow. */}
      {state === "authorising" &&
      userCode !== undefined &&
      verificationUri !== undefined ? (
        <span
          data-vigilia-store-item-submit-code=""
          className="max-w-[40ch] text-xs text-muted"
        >
          {uiCopy.store.submit.authorising(userCode)}{" "}
          <a
            data-vigilia-store-item-submit-open=""
            href={verificationUri}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {uiCopy.store.submit.open}
          </a>
        </span>
      ) : null}
      {submitted && url !== undefined ? (
        <span className="max-w-[40ch] text-xs text-muted">
          {uiCopy.store.submit.submitted}{" "}
          <a
            data-vigilia-store-item-submit-url=""
            href={url}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {url}
          </a>
        </span>
      ) : null}
      {state === "refused" && refusal !== undefined ? (
        <span
          data-vigilia-store-item-submit-refusal=""
          className="max-w-[40ch] text-xs text-warn"
        >
          {refusal}
        </span>
      ) : null}
    </Fragment>
  );
}

export function ItemModal(props: {
  readonly item: StoreItem;
  /** The style tags the vocabulary holds, built from the listing by the surface
   *  that owns it (`settledTags`) — this modal reads the set and never the
   *  listing, so it cannot become a second source of truth about the library. */
  readonly vocabulary: readonly string[];
  readonly onClose: () => void;
  /** The one callback the cell's four actions travel through. The modal draws
   *  the same four, so it reports them the same way rather than owning a second
   *  answer to "what does this action mean". */
  readonly onAction: (action: CellAction, id: string) => void;
  /** The online half's install press, owned by the region because the re-listing
   *  it causes is the listing's fact rather than any surface's. */
  readonly install: InstallControl;
  /** The library half's submission, owned by the region for the same reason:
   *  the device flow outlives the press that started it. */
  readonly submit: SubmitControl;
}): React.JSX.Element {
  const { item, onClose, onAction, install, submit } = props;
  // The one owner of the decision (`install-state.ts`): this surface draws what
  // it answers and never compares a version itself.
  const installState = installStateOf(item);

  return (
    <DialogPrimitive.Root
      defaultOpen
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        {/* The shell's own scrim, so the one elevation-3 treatment is drawn in
            one place; the box below is this surface's, because a picture's modal
            is not the text sheet `.editor-shell-dialog` describes. */}
        <DialogPrimitive.Backdrop className="editor-shell-dialog-overlay" />
        <DialogPrimitive.Popup
          data-vigilia-store-item=""
          aria-label={item.name}
          className="fixed top-1/2 left-1/2 z-[71] max-h-[90vh] w-[960px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[var(--radius-lg)] border border-edge bg-panel text-sm text-text shadow-[var(--elev-3)]"
        >
          <span className="relative block">
            {/* The stage: **one height for every item**, so the modal's box does
                not move as a person steps between them. Its ground is the one
                the product already draws a theme against rather than a second
                dark surface with its own reason. */}
            <span
              data-vigilia-store-item-stage=""
              className="flex h-[420px] items-center justify-center p-[var(--space-20)] [background:var(--vigilia-canvas-bg)]"
            >
              {/* The picture at the theme's own ratio, contained in the stage's
                  height: `h-full` with an aspect ratio is what letterboxes it,
                  and `max-w-full` is the one case that overrides the ratio — a
                  theme wider than the stage is capped by the width it has. */}
              <span
                data-vigilia-store-item-picture=""
                className="h-full max-w-full overflow-hidden rounded-[var(--radius-md)]"
                style={{
                  aspectRatio: `${item.facets.width} / ${item.facets.height}`,
                  ...(item.ground === undefined
                    ? {}
                    : { background: item.ground }),
                }}
              >
                {item.thumbnailUrl === undefined ? null : (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    className="size-full object-contain"
                  />
                )}
              </span>
            </span>
            {/* The way out, over the picture's corner rather than in a bar above
                it. It carries a ground so it reads over whatever the theme
                paints; Escape does the same thing. */}
            <span className="absolute top-[var(--space-12)] right-[var(--space-12)] rounded-md [background:var(--panel)]">
              <ControlIconButton
                id="vigilia-store-item-close"
                label={uiCopy.store.item.close}
                data={{ "data-vigilia-store-item-close": "" }}
                onClick={onClose}
              >
                <Glyph icon={CLOSE_GLYPH} size={14} />
              </ControlIconButton>
            </span>
          </span>

          <Caption item={item} vocabulary={props.vocabulary} />

          <span className="flex items-center gap-[var(--space-8)] border-t border-edge px-[var(--space-24)] py-[var(--space-16)]">
            <span className="flex-1" />
            {/* **A library item's four are drawn and the two a build does not
                run are disabled** (R164), with their reason in the tree beside
                them: a disabled control is one the pointer cannot ask, so a
                tooltip would reach nobody. Delete keeps its mark but paints
                `--faint` rather than `--hot` — §4's rule for a destructive
                control that cannot run, which the shell's own selector holds.
                An online item draws its install reading instead. */}
            {installState !== "none" ? (
              <InstallFooter
                item={item}
                state={installState}
                install={install}
              />
            ) : (
              FOOTER_ACTIONS.map((action) => {
                const reason = CELL_ACTION_REASONS[action];
                const controlId = `vigilia-store-item-${action}`;
                return (
                  <Fragment key={action}>
                    <button
                      type="button"
                      id={controlId}
                      data-vigilia-store-item-action={action}
                      {...(action === "delete" ? DESTRUCTIVE : {})}
                      disabled={reason !== undefined}
                      aria-describedby={
                        reason === undefined ? undefined : `${controlId}-reason`
                      }
                      onClick={() => onAction(action, item.id)}
                      className={
                        action === "delete"
                          ? "rounded-sm px-[var(--space-12)] py-[var(--space-6)] text-sm disabled:text-faint"
                          : FOOTER_BUTTON
                      }
                    >
                      {uiCopy.store.cell.actions[action]}
                    </button>
                    {reason === undefined ? null : (
                      <span id={`${controlId}-reason`} className="sr-only">
                        {reason}
                      </span>
                    )}
                  </Fragment>
                );
              })
            )}
            {/* The library half's submission, beside the actions that keep the
                theme on this PC; an online item has nothing to submit. */}
            {installState === "none" ? (
              <SubmitFooter item={item} submit={submit} />
            ) : null}
          </span>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
