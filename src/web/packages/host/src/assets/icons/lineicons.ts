import { LINEICONS_ICONS } from "./lineicons.generated.js";
import { createLocalIconSource, type LocalIcon } from "./local-icons.js";

export { LINEICONS_ICONS };
export type LineiconsIcon = LocalIcon;

const { source, search } = createLocalIconSource({
  id: "lineicons",
  label: "Lineicons",
  licence: "MIT",
  homeUrl: "https://lineicons.com/icons/",
  icons: LINEICONS_ICONS,
});

export const searchLineicons = search;
export const lineiconsSource = source;
