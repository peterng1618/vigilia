import type { FabricThemeEnvelope } from "@vigilia/renderer-core";

/**
 * The document an author is looking at, held while they are looking at it.
 *
 * In memory and nowhere else. It is not a theme — nothing here is written to a
 * folder, nothing survives the host, and a display that asks for it falls back
 * to the stored document the moment it is gone. That is what makes "publishing"
 * different from "saving", and it is why a stop clears rather than reverts.
 *
 * The revision is the whole subscription mechanism: a display polls one small
 * number and re-reads only when it moves.
 */

export interface PublishedDocument {
  readonly id: string;
  readonly envelope: FabricThemeEnvelope;
  /** Bumped by every publish and by every stop. A display polls this. */
  readonly revision: number;
}

export interface PublishedStore {
  read(): PublishedDocument | undefined;
  publish(id: string, envelope: FabricThemeEnvelope): number;
  clear(): number;
  revision(): number;
}

export function createPublishedStore(): PublishedStore {
  let current: PublishedDocument | undefined;
  let revision = 0;

  return {
    read: () => current,
    publish(id, envelope) {
      revision += 1;
      current = { id, envelope, revision };
      return revision;
    },
    clear() {
      revision += 1;
      current = undefined;
      return revision;
    },
    revision: () => revision,
  };
}
