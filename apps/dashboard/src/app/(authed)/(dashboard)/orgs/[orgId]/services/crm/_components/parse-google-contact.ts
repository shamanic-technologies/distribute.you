export interface GooglePeopleName {
  displayName?: string;
  givenName?: string;
  familyName?: string;
  metadata?: { primary?: boolean };
}

export interface GooglePeopleEmail {
  value?: string;
  type?: string;
  metadata?: { primary?: boolean };
}

export interface GooglePeoplePhone {
  value?: string;
  type?: string;
  metadata?: { primary?: boolean };
}

export interface GooglePeopleOrg {
  name?: string;
  title?: string;
  department?: string;
  type?: string;
  metadata?: { primary?: boolean };
}

export interface GoogleContactPayload {
  resourceName?: string;
  names?: GooglePeopleName[];
  emailAddresses?: GooglePeopleEmail[];
  phoneNumbers?: GooglePeoplePhone[];
  organizations?: GooglePeopleOrg[];
}

export interface GoogleContactRow {
  id?: string;
  resourceName?: string;
  payload?: GoogleContactPayload | null;
}

export interface ParsedContact {
  displayName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  organizationName: string | null;
  organizationTitle: string | null;
}

function pickPrimary<T extends { metadata?: { primary?: boolean } }>(arr: T[] | undefined): T | null {
  if (!arr || arr.length === 0) return null;
  const primary = arr.find((x) => x.metadata?.primary === true);
  return primary ?? arr[0];
}

export function parseGoogleContact(row: GoogleContactRow): ParsedContact {
  const p = row.payload;
  if (!p) {
    return {
      displayName: null,
      primaryEmail: null,
      primaryPhone: null,
      organizationName: null,
      organizationTitle: null,
    };
  }
  const name = pickPrimary(p.names);
  const email = pickPrimary(p.emailAddresses);
  const phone = pickPrimary(p.phoneNumbers);
  const org = pickPrimary(p.organizations);
  return {
    displayName:
      typeof name?.displayName === "string" && name.displayName.length > 0
        ? name.displayName
        : null,
    primaryEmail: typeof email?.value === "string" && email.value.length > 0 ? email.value : null,
    primaryPhone: typeof phone?.value === "string" && phone.value.length > 0 ? phone.value : null,
    organizationName:
      typeof org?.name === "string" && org.name.length > 0 ? org.name : null,
    organizationTitle:
      typeof org?.title === "string" && org.title.length > 0 ? org.title : null,
  };
}
