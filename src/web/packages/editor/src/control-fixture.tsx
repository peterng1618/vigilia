import type * as React from "react";
import { createRoot } from "react-dom/client";
import { ControlIconButton } from "./components/ui/control-icon-button.js";
import { ControlNumber } from "./components/ui/control-number.js";
import { ControlSegmented } from "./components/ui/control-segmented.js";
import { ControlSelect } from "./components/ui/control-select.js";
import { ControlSlider } from "./components/ui/control-slider.js";
import { ControlSwatch } from "./components/ui/control-swatch.js";
import { ControlText } from "./components/ui/control-text.js";
import { ControlToggle } from "./components/ui/control-toggle.js";
import { InspectorSection } from "./components/ui/inspector-section.js";
import "./editor-shell/editor-shell.css";

/**
 * The design-language parity fixture (spec §13.1).
 *
 * It mounts every control of bible §5's vocabulary — alone and inside the
 * `InspectorSection` a surface composes them into — over the built stylesheet,
 * and renders the states the language is *made of* rather than the happy path
 * alone: a required label, a refusal with its reason, an invalid draft, a
 * checked toggle, a selected segment, a destructive action and a focused
 * target. `tests/e2e/design-language.spec.ts` drives the two states that need an
 * interaction (the invalid draft and the focus) and asserts the rest.
 *
 * It is wrapped in `.editor-shell` on purpose, and neither the wrapper nor the
 * `bg-panel` columns are decoration: the shell owns the backdrop the chrome is
 * composited over and the reduced-motion policy the controls inherit, so
 * measuring contrast or motion outside it would measure a page nobody ships.
 * The columns are the inspector's own 276px, because §7.8 asks labels, hit
 * areas and contrast be read at the real pane width rather than at a comfortable
 * one.
 *
 * Every class here is a role or a scale step. A literal would be the defect the
 * fixture exists to catch, so the fixture is held to the same ratchet
 * (`design-tokens.gated.json`) as the controls it mounts.
 */

/** A name an author could really type: long, mixed-script, and unbreakable
 *  enough to be the case §7.7's "a long name cannot widen a pane" is about. */
const LONG_NAME =
  "Måneoverflate-temperatur ℃ ẞ 日本語のラベル 🎛 the long authored name";

const SHOWS = [
  { id: "cpu.load", name: "CPU load" },
  { id: "mem.used", name: "Memory used" },
] as const;
const PAINTS = [
  { id: "ink", name: "Ink" },
  { id: "paper", name: "Paper" },
] as const;
const ALIGN = [
  { id: "left", name: "Left" },
  { id: "center", name: "Center" },
] as const;

const noop = (): void => {};

function Fixture(): React.JSX.Element {
  return (
    <div className="editor-shell" data-fixture-root>
      <div className="flex flex-wrap items-start gap-[var(--space-12)] p-[var(--space-12)]">
        <div className="w-[276px] bg-panel p-[var(--space-12)]">
          <InspectorSection id="content" title="Content">
            <div data-fixture="text">
              <ControlText label="Name" value="CPU gauge" onCommit={noop} />
            </div>
            <div data-fixture="long">
              <ControlText
                label={LONG_NAME}
                value={LONG_NAME}
                onCommit={noop}
              />
            </div>
            <div data-fixture="select">
              <ControlSelect
                label="Shows"
                value="cpu.load"
                options={SHOWS}
                onChange={noop}
              />
            </div>
            <div data-fixture="swatch">
              <ControlSwatch
                label="Fill"
                value="ink"
                options={PAINTS}
                onChange={noop}
                swatch={
                  <span
                    aria-hidden
                    className="size-[11px] rounded-sm bg-accent"
                  />
                }
              />
            </div>
          </InspectorSection>

          <InspectorSection id="position" title="Position">
            <div data-fixture="number">
              <ControlNumber
                label="Width"
                value={299}
                unit="px"
                min={0}
                max={1000}
                onCommit={noop}
              />
            </div>
            <div data-fixture="slider">
              <ControlSlider
                label="Opacity"
                value={50}
                min={0}
                max={100}
                onCommit={noop}
              />
            </div>
          </InspectorSection>

          <InspectorSection id="layer" title="Layer">
            <div data-fixture="toggle">
              <ControlToggle label="Glass" checked={false} onChange={noop} />
            </div>
            <div data-fixture="toggle-on">
              <ControlToggle label="Locked" checked onChange={noop} />
            </div>
            <div data-fixture="segmented">
              <ControlSegmented
                label="Align"
                value="left"
                options={ALIGN}
                onChange={noop}
                data={{ "data-fixture-segmented": "1" }}
              />
            </div>
          </InspectorSection>

          <InspectorSection id="spends" title="Spends" readOnly>
            <p className="m-0 font-mono text-xs text-muted">
              resolves to ink · 12/400
            </p>
          </InspectorSection>
        </div>

        <div className="w-[276px] bg-panel p-[var(--space-12)]">
          <InspectorSection id="states" title="Refused and invalid">
            <div data-fixture="refused">
              <ControlToggle
                label="Glass"
                checked={false}
                onChange={noop}
                refused="not offered for a group"
              />
            </div>
            <div data-fixture="refused-number">
              <ControlNumber
                label="Blur"
                value={2}
                min={0}
                max={10}
                onCommit={noop}
                refused="not offered for a group"
              />
            </div>
            <div data-fixture="invalid">
              <ControlNumber
                label="Steps"
                value={3}
                min={0}
                max={10}
                onCommit={noop}
                data={{ "data-fixture-invalid": "1" }}
              />
            </div>
            <div data-fixture="icon">
              <ControlIconButton
                label="Delete layer"
                destructive
                onClick={noop}
              >
                <span aria-hidden>✕</span>
              </ControlIconButton>
            </div>
            <div data-fixture="icon-focus">
              <ControlIconButton
                label="Duplicate layer"
                shortcut={{ printed: "Ctrl+D", spoken: "Control D" }}
                onClick={noop}
              >
                <span aria-hidden>⧉</span>
              </ControlIconButton>
            </div>
          </InspectorSection>
        </div>
      </div>
    </div>
  );
}

const host = document.querySelector("#control-fixture");
if (host === null)
  throw new Error("the control fixture has no #control-fixture");
createRoot(host).render(<Fixture />);
