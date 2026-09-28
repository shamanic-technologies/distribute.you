import { timingSafeEqual } from "node:crypto";

/**
 * The org's invite link as stored on its Clerk privateMetadata. Server-only (it
 * imports node:crypto): the browser must never see a code it did not create.
 */
export interface StoredInviteLink {
  code: string;
  createdAt: string;
  createdBy: string;
}

export function readInviteLink(privateMetadata: unknown): StoredInviteLink | null {
  if (typeof privateMetadata !== "object" || privateMetadata === null) return null;
  const link = (privateMetadata as { inviteLink?: unknown }).inviteLink;
  if (typeof link !== "object" || link === null) return null;
  const l = link as Record<string, unknown>;
  return typeof l.code === "string" && typeof l.createdAt === "string" && typeof l.createdBy === "string"
    ? { code: l.code, createdAt: l.createdAt, createdBy: l.createdBy }
    : null;
}

/** Constant-time compare, so a guessed code learns nothing from how long the refusal took. */
export function inviteCodeMatches(stored: StoredInviteLink | null, presented: string): boolean {
  if (!stored) return false;
  const a = Buffer.from(stored.code);
  const b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}
