import type {
  Artboard,
  AssetReference,
  Globals,
  ThemeMetadata,
} from "@vigilia/renderer-core";
import type { SceneBox } from "@vigilia/scene-fabric";
import { InspectorSection } from "../../components/ui/inspector-section.js";
import { uiCopy } from "../../ui-copy.js";
import { ArtboardFields } from "./artboard-fields.js";
import { MetadataFields } from "./metadata-fields.js";

/**
 * The Document pane's body: the theme's own metadata, and the artboard it is
 * drawn on.
 *
 * **The pane's identity is not written here.** `Pane` is the one owner of
 * `data-vigilia-panel` (`editor-shell/pane.tsx:43`), and this renders inside it;
 * a second element under that name is a strict-mode failure for every locator
 * that browses by it. The References section Task 9 adds is a sibling of this
 * tree's sections, under the same pane host.
 *
 * The heading is the panel's own word and a plain `<h2>`: `panel-labels.spec.ts`
 * reads every `section h2` and matches the panel's name against it, and the
 * disclosure chrome's `▾` would arrive in that text beside the title.
 *
 * §8's ordering, most likely first: what the theme is, then the board it is
 * drawn on — the size and the presets that set it, then the paint and the media,
 * which are the once-in-a-while controls and are disclosed under their own
 * heading rather than removed.
 */
interface DocumentPaneProps {
  readonly artboard: Artboard;
  readonly metadata: ThemeMetadata | undefined;
  readonly globals: Globals | undefined;
  readonly assets: readonly AssetReference[];
  /** The scene as `sceneBoxes` last read it, or `undefined` when the panel has
   *  none to read. */
  readonly boxes: readonly SceneBox[] | undefined;
  readonly onArtboard: (next: Artboard) => void;
  readonly onMetadata: (next: ThemeMetadata) => void;
}

export function DocumentPane(props: DocumentPaneProps): React.JSX.Element {
  const { artboard, metadata, globals, assets, boxes } = props;
  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <h2 className="text-xs font-semibold tracking-[0.11em] text-muted uppercase">
        {uiCopy.panels.themeSettings}
      </h2>
      <InspectorSection id="theme" title={uiCopy.panels.themeMetadata}>
        <MetadataFields metadata={metadata} onCommit={props.onMetadata} />
      </InspectorSection>
      <InspectorSection id="artboard" title={uiCopy.panels.artboard}>
        <ArtboardFields
          artboard={artboard}
          globals={globals}
          assets={assets}
          boxes={boxes}
          onCommit={props.onArtboard}
        />
      </InspectorSection>
    </div>
  );
}
