import { createLocalIconSource, type LocalIcon } from "./local-icons.js";
import { LUCIDE_ICONS } from "./lucide-icons.generated.js";

export { LUCIDE_ICONS };
export type LucideIcon = LocalIcon;

const { source, search } = createLocalIconSource({
  id: "lucide",
  label: "Lucide",
  licence: "ISC",
  homeUrl: "https://lucide.dev/icons/",
  icons: LUCIDE_ICONS,
});

export const searchLucide = search;
export const lucideSource = source;
