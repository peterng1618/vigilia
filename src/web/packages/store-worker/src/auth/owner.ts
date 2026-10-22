import type { Session } from "./session.js";

/**
 * The owner allow-list is a comma-separated secret compared case-insensitively:
 * an email's case is not a credential, and a mismatch would close the only
 * door into the queue. An empty secret matches nobody.
 */
export function isOwner(session: Session, ownerEmails: string): boolean {
  const email = session.email.trim().toLowerCase();
  return ownerEmails
    .split(",")
    .some((candidate) => candidate.trim().toLowerCase() === email);
}
