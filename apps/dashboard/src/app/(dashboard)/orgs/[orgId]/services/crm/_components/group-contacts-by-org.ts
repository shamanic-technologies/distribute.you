import type { GoogleContactRow } from "./parse-google-contact";
import { parseGoogleContact } from "./parse-google-contact";

export interface OrgGroup {
  orgName: string | null;
  contacts: GoogleContactRow[];
}

export function groupContactsByOrg(rows: GoogleContactRow[]): OrgGroup[] {
  const map = new Map<string | null, GoogleContactRow[]>();
  for (const row of rows) {
    const { organizationName } = parseGoogleContact(row);
    const key = organizationName;
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  const groups: OrgGroup[] = [];
  for (const [orgName, contacts] of map.entries()) {
    groups.push({ orgName, contacts });
  }
  groups.sort((a, b) => {
    if (a.orgName === null) return 1;
    if (b.orgName === null) return -1;
    return a.orgName.localeCompare(b.orgName);
  });
  return groups;
}
