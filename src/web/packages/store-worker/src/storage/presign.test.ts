import { describe, expect, it } from "vitest";
import { presignPut } from "./presign";

const VALID = {
  accountId: "account",
  accessKeyId: "access",
  secretAccessKey: "secret",
  bucket: "bucket",
  key: "packages/item/1.0.0.zip",
  expiresSeconds: 900,
};

describe("presignPut", () => {
  it("signs a PUT of the derived key into the bucket's path", async () => {
    const url = new URL(await presignPut(VALID));
    expect(url.origin).toBe("https://account.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/bucket/packages/item/1.0.0.zip");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).not.toBeNull();
  });

  it("refuses a key or an expiry it did not derive", async () => {
    for (const key of ["", "/absolute.zip", "packages/../escape.zip"]) {
      await expect(presignPut({ ...VALID, key })).rejects.toThrow();
    }
    for (const expiresSeconds of [0, -1, 1.5, 604801, Number.NaN]) {
      await expect(presignPut({ ...VALID, expiresSeconds })).rejects.toThrow();
    }
    await expect(presignPut({ ...VALID, bucket: "" })).rejects.toThrow();
    await expect(presignPut({ ...VALID, accountId: "" })).rejects.toThrow();
  });
});
