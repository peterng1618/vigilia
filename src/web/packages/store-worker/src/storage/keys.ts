/** R2 keys are derived, never client-supplied: a key that names its own path
 *  would let a presigned upload write over another item's package. */
export function packageKey(itemId: string, version: string): string {
  return `packages/${itemId}/${version}.zip`;
}

export function thumbnailKey(itemId: string): string {
  return `thumbnails/${itemId}.png`;
}
