/**
 * The integrations a brand can connect, and what each one asks the customer for.
 *
 * An INTEGRATION is a third-party account the customer already has, connected to
 * ONE brand so we can read what is in it. It is not a channel we sell and not a
 * feature they buy: connecting one adds a surface to their own dashboard and
 * changes nothing about what runs.
 *
 * ONE catalogue, because three surfaces name the same integration (the Settings
 * row, the connect modal, and the page it unlocks) and a second copy is how one
 * of them comes to call it something the other two do not.
 *
 * Alias-free on purpose (no `@/…` import), so this carries REAL unit tests rather
 * than a source-substring guard. Keep it that way.
 */

export type IntegrationSlug = "gohighlevel";

/** One field the customer has to paste to connect. */
export interface IntegrationField {
  /** Wire name. The producer owns it; this is what we send. */
  key: string;
  label: string;
  /** Where to find it, in the customer's own words. Rendered under the field. */
  help: string;
  placeholder: string;
  /** A credential is masked on read-back and never rendered in full again. */
  secret: boolean;
}

export interface IntegrationDef {
  slug: IntegrationSlug;
  name: string;
  /** logo.dev key. A real mark, never a hand-rolled vendor SVG. */
  domain: string;
  /** One line: what the customer GETS, not what we do. */
  blurb: string;
  /** What the connected surface is called, wherever we link to it. */
  surfaceLabel: string;
  fields: IntegrationField[];
  /** The vendor's own page for generating the credential. */
  docsUrl: string;
}

/**
 * GoHighLevel authenticates with a Private Integration Token: a static bearer the
 * customer generates in their own GoHighLevel settings, which does not expire.
 *
 * It asks for the sub-account id as well, because GoHighLevel's documentation
 * gives no way to read the target account out of the token. If that turns out to
 * be derivable, the second field goes away here and nowhere else.
 */
const GOHIGHLEVEL: IntegrationDef = {
  slug: "gohighlevel",
  name: "GoHighLevel",
  domain: "gohighlevel.com",
  blurb: "Read your contacts and your sales pipeline here, kept up to date on its own.",
  surfaceLabel: "CRM",
  fields: [
    {
      key: "token",
      label: "Private Integration Token",
      help: "In GoHighLevel: Settings, then Private Integrations. Create one and copy the token.",
      placeholder: "pit-...",
      secret: true,
    },
    {
      key: "locationId",
      label: "Sub-account ID",
      help: "In GoHighLevel: Settings, then Business Profile. It is the Location ID.",
      placeholder: "ve9EPM428h8vShlRW1KT",
      secret: false,
    },
  ],
  docsUrl: "https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/",
};

/** Every integration on offer, in the order the Settings section lists them. */
export const INTEGRATIONS: IntegrationDef[] = [GOHIGHLEVEL];

/** Null for a slug the catalogue does not carry, never a guessed definition. */
export function integrationFor(slug: string): IntegrationDef | null {
  return INTEGRATIONS.find((i) => i.slug === slug) ?? null;
}

/**
 * The fields a connect attempt is missing, in catalogue order.
 *
 * Shape only. Whether a token actually authenticates is the producer's answer,
 * and it states it in its own words when the connection is refused: guessing at
 * a token's shape here would refuse a valid credential the day the vendor
 * changes its prefix.
 *
 * `credentialStored` is a RETRY: the customer's secret is already in the
 * credential store and the producer resolves it there itself, so a blank secret
 * field means "keep the one I already gave you" rather than an unanswered
 * question. Only a SECRET field is forgiven that way — a sub-account id is not a
 * credential, it is not stored anywhere we can read back, and the connect states
 * it every time.
 */
export function missingFields(
  def: IntegrationDef,
  values: Record<string, string>,
  { credentialStored = false }: { credentialStored?: boolean } = {},
): IntegrationField[] {
  return def.fields.filter((f) => {
    if (f.secret && credentialStored) return false;
    return !(values[f.key] ?? "").trim();
  });
}
