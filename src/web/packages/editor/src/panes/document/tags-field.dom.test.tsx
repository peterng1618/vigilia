// @vitest-environment jsdom
/**
 * The pick-or-propose field, measured on the rule that gives it its name:
 * **picking is the primary affordance and a proposal is the exception.**
 *
 * The cases below are the whole contract of the field. It offers the vocabulary
 * as choices, commits what is picked, and refuses — visibly, and without
 * committing — the three ways a value can be wrong: a word the format does not
 * take, a word the theme already carries, and a sixth tag. The last two cases
 * are the two the ordering exists for: the committed order is the author's
 * rather than the vocabulary's, and a proposed word is drawn as one.
 */
import {
  MAX_TAGS,
  TAG_PATTERN,
  type ThemeMetadata,
} from "@vigilia/renderer-core";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { THEME_TAG_SEED } from "../../theme-tag-seed.js";
import { uiCopy } from "../../ui-copy.js";
import { MetadataFields } from "./metadata-fields.js";
import { TagsField } from "./tags-field.js";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** The vocabulary these cases pick from: four words, so a pill list and its
 *  order are readable without the seven, and one is left over to be refused. */
const VOCABULARY = ["futuristic", "retro", "modern", "nature"] as const;

let root: Root | undefined;
let host: HTMLDivElement | undefined;
let commits: (readonly string[])[] = [];

/** The field as the pane mounts it: controlled, so a commit flows back into the
 *  value the pills are drawn from rather than only being recorded. */
function Harness({
  initial,
}: {
  readonly initial: readonly string[];
}): React.JSX.Element {
  const [value, setValue] = useState<readonly string[]>(initial);
  return (
    <TagsField
      value={value}
      vocabulary={VOCABULARY}
      onCommit={(next) => {
        commits.push(next);
        setValue(next);
      }}
    />
  );
}

async function mount(initial: readonly string[] = []): Promise<void> {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(<Harness initial={initial} />));
}

beforeEach(() => {
  commits = [];
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
  document.body.replaceChildren();
});

/** Every pill, in the order the field draws them. */
function pills(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>("button[data-vigilia-tag]"),
  );
}

/** The pill for one tag, which is the only handle a person has on it. */
function pill(tag: string): HTMLButtonElement {
  const found = pills().find(
    (candidate) => candidate.getAttribute("data-vigilia-tag") === tag,
  );
  if (found === undefined) throw new Error(`no "${tag}" pill`);
  return found;
}

/** The propose field: the one input this control renders. */
function proposal(): HTMLInputElement {
  const found = document.querySelector<HTMLInputElement>(
    "[data-vigilia-tag-proposal]",
  );
  if (found === null) throw new Error("the field renders no proposal input");
  return found;
}

function addButton(): HTMLButtonElement {
  const found = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === uiCopy.panels.tagAdd,
  );
  if (found === undefined) throw new Error("the field renders no add button");
  return found;
}

/** What the field says beside itself, which is where a refusal is read. */
function shownRefusal(): string {
  return (
    document.querySelector<HTMLElement>('[id$="-invalid"]')?.textContent ?? ""
  );
}

/** A real edit, as React sees one. The value goes through the prototype's
 *  setter because React replaces `value` on the node with a tracker that would
 *  suppress a plain assignment. */
async function type(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(input) as HTMLInputElement,
      "value",
    )?.set;
    if (setter === undefined) input.value = value;
    else setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function click(target: Element): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

/** Propose `tag` the way an author does: type it, then press Add. */
async function propose(tag: string): Promise<void> {
  await type(proposal(), tag);
  await click(addButton());
}

it("offers the vocabulary as choices", async () => {
  await mount();

  expect(
    pills().map((entry) => entry.getAttribute("data-vigilia-tag")),
  ).toEqual([...VOCABULARY]);
  // None is held, so none is pressed: the list is the offer, not the value.
  expect(pills().map((entry) => entry.getAttribute("aria-pressed"))).toEqual([
    "false",
    "false",
    "false",
    "false",
  ]);
});

it("commits a picked tag", async () => {
  await mount();

  await click(pill("retro"));

  expect(commits).toEqual([["retro"]]);
  expect(pill("retro").getAttribute("aria-pressed")).toBe("true");
});

it("refuses a sixth tag, and says why", async () => {
  await mount(["futuristic", "retro", "modern", "elegant", "classic"]);

  await click(pill("nature"));

  expect(commits, "a sixth tag was committed").toEqual([]);
  expect(shownRefusal()).toContain(uiCopy.panels.tagRefusedFull(MAX_TAGS));
});

it("refuses an uppercase proposal, and says why", async () => {
  await mount();

  await propose("Retro");

  expect(commits, "an invalid tag was committed").toEqual([]);
  expect(shownRefusal()).toBe(uiCopy.panels.tagRefusedShape("Retro"));
});

it("refuses a proposal already in the list rather than adding it twice", async () => {
  await mount(["retro"]);

  await propose("retro");

  expect(commits, "the tag was added a second time").toEqual([]);
  expect(shownRefusal()).toBe(uiCopy.panels.tagRefusedDuplicate("retro"));
});

it("removes a picked tag", async () => {
  await mount(["retro", "modern"]);

  await click(pill("retro"));

  expect(commits).toEqual([["modern"]]);
  expect(pill("retro").getAttribute("aria-pressed")).toBe("false");
});

it("keeps the committed order the author's, not the vocabulary's", async () => {
  await mount(["cityscape", "modern"]);

  // The value's own order first — `cityscape` is in no vocabulary this field was
  // given — and the vocabulary's remaining entries after it, in its own order.
  expect(
    pills().map((entry) => entry.getAttribute("data-vigilia-tag")),
  ).toEqual(["cityscape", "modern", "futuristic", "retro", "nature"]);
});

it("draws a proposed tag as a proposal rather than as a picked one", async () => {
  await mount(["retro-diner"]);

  // The drawing's own reading (`store-detail.html`): a dashed pill saying so, so
  // a reader knows the word is new rather than that the facet failed to match.
  const drawn = pill("retro-diner");
  expect(drawn.textContent).toBe(uiCopy.panels.tagsProposed("retro-diner"));
  expect(drawn.className).toContain("border-dashed");
  expect(pill("retro").className).not.toContain("border-dashed");
});

it("holds only tags the format accepts", () => {
  // The seed is the offline vocabulary rather than a schema, so what keeps it
  // honest is that every word in it is one the validator would take.
  expect(THEME_TAG_SEED.filter((tag) => !TAG_PATTERN.test(tag))).toEqual([]);
  expect(THEME_TAG_SEED).toHaveLength(7);
});

/**
 * The panel's half of the contract: the field is mounted where the brief puts
 * it, and an emptied list leaves the metadata **without** a `tags` key rather
 * than as `[]` — the shape a theme that declares no tags has, and the one the
 * validator and the facet both read.
 */
it("drops the key rather than writing an empty list", async () => {
  const committed: ThemeMetadata[] = [];
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root?.render(
      <MetadataFields
        metadata={{ themeLanguage: "en", tags: ["retro"] }}
        onCommit={(next) => committed.push(next)}
      />,
    ),
  );

  await click(pill("retro"));

  expect(committed).toHaveLength(1);
  const next = committed[0];
  if (next === undefined) throw new Error("the field committed nothing");
  expect(Object.hasOwn(next, "tags"), "an empty list was written").toBe(false);
  expect(next.themeLanguage).toBe("en");
});
