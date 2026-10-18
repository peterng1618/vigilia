import { X509Certificate } from "node:crypto";
import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSecureOrigin } from "./authority.js";

/**
 * The chain is checked by **Node's own X.509 verifier**, never by the library
 * that produced it: `node-forge` carries an advisory in its signature
 * *verification* path (GHSA-86w9-cpqp-85rv, `docs/decisions/0070`), and this
 * host's answer to that is that it never calls it. A case that verified with
 * forge would be testing the half of the package the decision excludes.
 */

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "vigilia-tls-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

/** The names a host on this box would ask for, loopback included. */
const NAMES = ["localhost", "127.0.0.1", "192.168.2.56"] as const;

describe("the host's own certificate authority", () => {
  it("signs a leaf that Node accepts as coming from the root", async () => {
    const origin = await createSecureOrigin(directory, NAMES);
    const authority = new X509Certificate(origin.certificate);
    const leaf = new X509Certificate(origin.leaf);

    // The reading the whole task turns on: a browser registers a service worker
    // on a certificate it can build a chain to a trusted root from, and refuses
    // one it had to warn about. `verify` is that question, asked of the root.
    expect(leaf.verify(authority.publicKey)).toBe(true);
    expect(authority.verify(authority.publicKey)).toBe(true);
  });

  it("presents the leaf and the root, in that order", async () => {
    const origin = await createSecureOrigin(directory, NAMES);

    // What the server hands a client. A leaf alone cannot be chained by a
    // client that was never given the root, and a chain in the wrong order is
    // read as a leaf that issued itself — measured as
    // `ERR_CERT_AUTHORITY_INVALID` against the LAN address.
    expect(origin.chain).toBe(origin.leaf + origin.certificate);
    expect(origin.chain.startsWith("-----BEGIN CERTIFICATE-----")).toBe(true);
    expect(origin.chain.match(/BEGIN CERTIFICATE/g)).toHaveLength(2);
  });

  it("issues a root that is a root and a leaf that is not", async () => {
    const origin = await createSecureOrigin(directory, NAMES);

    // A leaf that said `CA: TRUE` could sign for any name this machine chose,
    // and a root that did not could sign for nothing at all.
    expect(new X509Certificate(origin.certificate).ca).toBe(true);
    expect(new X509Certificate(origin.leaf).ca).toBe(false);
  });

  it("covers every name it was asked for, hostnames and addresses alike", async () => {
    const origin = await createSecureOrigin(directory, NAMES);
    const leaf = new X509Certificate(origin.leaf);

    expect(leaf.checkHost("localhost")).toBe("localhost");
    expect(leaf.checkIP("127.0.0.1")).toBe("127.0.0.1");
    // The address a display actually uses, and the one a leaf covering only
    // loopback would fail on — as a name mismatch the owner cannot tell from a
    // root they had not installed.
    expect(leaf.checkIP("192.168.2.56")).toBe("192.168.2.56");
  });

  it("keeps the root and re-issues the leaf on the next start", async () => {
    const first = await createSecureOrigin(directory, NAMES);
    const second = await createSecureOrigin(directory, NAMES);

    // The root is what a display installs. If it changed between starts, every
    // device would have to install it again — which is the self-signed
    // certificate's cost under another name.
    expect(second.certificate).toBe(first.certificate);
    // The leaf is disposable, and a new one per start is what makes a moved
    // LAN address cost a restart rather than a re-install.
    expect(second.leaf).not.toBe(first.leaf);
  });

  it("regenerates a root that is missing, and one whose key does not match it", async () => {
    const first = await createSecureOrigin(directory, NAMES);
    await rm(path.join(directory, "ca.crt"));

    const second = await createSecureOrigin(directory, NAMES);
    expect(second.certificate).not.toBe(first.certificate);
    expect(
      new X509Certificate(second.leaf).verify(
        new X509Certificate(second.certificate).publicKey,
      ),
    ).toBe(true);

    // The half-state a read cannot see, and the one a crash between the two
    // writes actually produces: a certificate and a key that are both readable
    // and do not belong together. Signed with that key, every leaf would fail
    // to chain to the root the devices already trust.
    await writeFile(path.join(directory, "ca.crt"), first.certificate, "utf8");
    const third = await createSecureOrigin(directory, NAMES);
    expect(
      new X509Certificate(third.leaf).verify(
        new X509Certificate(third.certificate).publicKey,
      ),
    ).toBe(true);
    expect(third.certificate).not.toBe(first.certificate);
  });

  it("writes the root and its key, and nothing else", async () => {
    const origin = await createSecureOrigin(directory, NAMES);

    expect((await readdir(directory)).sort()).toEqual(["ca.crt", "ca.key"]);
    expect(origin.certificatePath).toBe(path.join(directory, "ca.crt"));

    // The leaf's key is never written: a leaf is re-issued at every start, so
    // there is nothing for a file to save.
    expect(origin.key).toContain("BEGIN PRIVATE KEY");
    expect(origin.leaf).not.toContain("PRIVATE KEY");
  });

  it("keeps the root's private key to its owner", async () => {
    // A mode is a POSIX idea; on Windows the file inherits the profile
    // directory's ACL, which is already this user's alone, and `stat` reports
    // the mode it would have on a POSIX filesystem rather than the one in
    // force. Asserted where it means something rather than asserted everywhere
    // and true nowhere.
    if (process.platform === "win32") return;

    await createSecureOrigin(directory, NAMES);
    const key = await stat(path.join(directory, "ca.key"));
    expect(key.mode & 0o777).toBe(0o600);
  });
});
