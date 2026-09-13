import type { ThemeNode } from '@vigilia/renderer-core';

/** Human-readable node label used by every editor surface. */
export function nodeLabel(node: ThemeNode): string {
  return node.name ?? node.id;
}
