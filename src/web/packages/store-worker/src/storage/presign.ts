import { AwsClient } from "aws4fetch";

/** S3's own ceiling; the store signs for 15 minutes, well under it. */
const MAX_EXPIRY_SECONDS = 604800;

export interface PresignPutInput {
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
  readonly key: string;
  readonly expiresSeconds: number;
}

/**
 * Signs a private-R2 PUT for one object. The key is derived by the caller from
 * the session and the version the Worker computed, and refused here if it could
 * name another path: a client-supplied key would overwrite someone else's
 * package. R2's S3 endpoint carries the bucket as the first path segment.
 */
export async function presignPut(input: PresignPutInput): Promise<string> {
  if (input.accountId.length === 0)
    throw new Error("An R2 account id is required to sign an upload.");
  if (input.bucket.length === 0)
    throw new Error("An R2 bucket is required to sign an upload.");
  if (
    input.key.length === 0 ||
    input.key.startsWith("/") ||
    input.key.includes("..")
  ) {
    throw new Error(
      `Refusing to sign the key "${input.key}": upload keys are derived, never client-supplied.`,
    );
  }
  if (
    !Number.isInteger(input.expiresSeconds) ||
    input.expiresSeconds <= 0 ||
    input.expiresSeconds > MAX_EXPIRY_SECONDS
  ) {
    throw new Error(
      `Refusing to sign an upload that expires in ${input.expiresSeconds} seconds.`,
    );
  }

  const url = new URL(
    `https://${input.accountId}.r2.cloudflarestorage.com/${input.bucket}/${input.key}`,
  );
  url.searchParams.set("X-Amz-Expires", String(input.expiresSeconds));
  const client = new AwsClient({
    service: "s3",
    region: "auto",
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey,
  });
  // No headers are signed beyond `host`, so the client may send any content
  // type; the method is part of the signature, so only a PUT matches it.
  const signed = await client.sign(url, {
    method: "PUT",
    aws: { signQuery: true },
  });
  return signed.url;
}
