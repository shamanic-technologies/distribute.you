import {
  parseGoogleContact,
  type ParsedContact,
  type GoogleContactRow as RawContactRow,
} from "./parse-google-contact";
import type { GoogleContactRow } from "@/lib/api";

function nonEmpty(v: string | null | undefined): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Prefer the typed google-service contact fields; fall back to parsing the raw
 * People API `payload` while the additive typed rollout is not yet live (payload
 * is real wire data, not a fabricated default). Returns the same {@link
 * ParsedContact} shape the presentational components already render.
 */
export function contactDisplay(row: GoogleContactRow): ParsedContact {
  const parsed = parseGoogleContact(row as unknown as RawContactRow);
  return {
    displayName: nonEmpty(row.displayName) ?? parsed.displayName,
    primaryEmail:
      nonEmpty(row.primaryEmail) ?? nonEmpty(row.emails?.[0]) ?? parsed.primaryEmail,
    primaryPhone: nonEmpty(row.phones?.[0]) ?? parsed.primaryPhone,
    organizationName: nonEmpty(row.organization) ?? parsed.organizationName,
    organizationTitle: nonEmpty(row.jobTitle) ?? parsed.organizationTitle,
  };
}
