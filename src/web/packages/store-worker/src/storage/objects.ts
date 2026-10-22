/** Opens a stored object for streaming; a missing key is the caller's 404. */
export async function openObject(
  bucket: R2Bucket,
  key: string,
): Promise<R2ObjectBody | undefined> {
  return (await bucket.get(key)) ?? undefined;
}

/**
 * The answer is already 404 by the time this runs, so a failed cancel must not
 * change it — the stream may have been closed already.
 */
export async function cancelBody(object: R2ObjectBody): Promise<void> {
  try {
    await object.body.cancel();
  } catch {
    // Best effort only; nothing depends on the cancel succeeding.
  }
}
