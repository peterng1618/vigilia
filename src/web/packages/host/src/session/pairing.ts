import { randomBytes, timingSafeEqual } from "node:crypto";

/** Display credentials (§145). The credential belongs to the display record and
 *  is verified against it (`settings/displays.ts`), so nothing here expires: a
 *  pairing lasts until the host removes the client (ruling 12). */

/** 32 bytes of CSPRNG output, URL-safe. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Compares the one-time pairing code a person types. The length check is the
 *  only early exit and equal lengths are compared byte-wise in constant time,
 *  which is what a short, low-entropy secret needs. The durable credential is a
 *  fixed-width digest and is compared where it is stored, in
 *  `displays.authenticate`. */
export function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
