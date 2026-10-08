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

export type IntegrationSlug = "gohighlevel" | "posthog" | "stripe";

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
  /** A closed choice the producer accepts, rendered as a picker instead of a text field. */
  options?: { value: string; label: string }[];
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
  /** Where that surface lives for one brand. */
  surfaceHref: (orgId: string, brandId: string) => string;
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
  surfaceHref: (orgId, brandId) => `/orgs/${orgId}/brands/${brandId}/crm`,
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

/** Unibox (Records), the merged thread both sources below feed. Lives in v2 only. */
const conversationsHref = (orgId: string, brandId: string) =>
  `/v2/orgs/${orgId}/brands/${brandId}/unibox`;

/**
 * PostHog authenticates with a Personal API key and reads ONE project, in the
 * region it lives in (crm-service picks the host from the region, never from us).
 * Only identified people come through: a visitor PostHog has no email for is nobody
 * we can put a thread to.
 */
const POSTHOG: IntegrationDef = {
  slug: "posthog",
  name: "PostHog",
  domain: "posthog.com",
  blurb: "See who visited your site and what they did there, in each person's thread.",
  surfaceLabel: "Unibox",
  surfaceHref: conversationsHref,
  fields: [
    {
      key: "token",
      label: "Personal API key",
      help: "In PostHog: Settings, then Personal API keys. Create one with the Query read scope.",
      placeholder: "phx_...",
      secret: true,
    },
    {
      key: "projectId",
      label: "Project ID",
      help: "In PostHog: Settings, then Project. It is the number under Project ID.",
      placeholder: "171095",
      secret: false,
    },
    {
      key: "region",
      label: "Region",
      help: "Where your PostHog account lives: eu.posthog.com is EU, app.posthog.com is US.",
      placeholder: "Pick one",
      secret: false,
      options: [
        { value: "eu", label: "EU" },
        { value: "us", label: "US" },
      ],
    },
  ],
  docsUrl: "https://posthog.com/docs/api#private-endpoint-authentication",
};

/**
 * Stripe takes a RESTRICTED key only (crm-service refuses a full secret key before
 * any call), so nothing connected here can move money.
 */
const STRIPE: IntegrationDef = {
  slug: "stripe",
  name: "Stripe",
  domain: "stripe.com",
  blurb: "See what each person paid you, in their thread.",
  surfaceLabel: "Unibox",
  surfaceHref: conversationsHref,
  fields: [
    {
      key: "token",
      label: "Restricted key",
      help: "In Stripe: Developers, then API keys. Create a restricted key with Read on Customers, Charges, Refunds and Subscriptions.",
      placeholder: "rk_live_...",
      secret: true,
    },
  ],
  docsUrl: "https://docs.stripe.com/keys#create-restricted-api-secret-key",
};

/** Every integration on offer, in the order the Settings section lists them. */
export const INTEGRATIONS: IntegrationDef[] = [GOHIGHLEVEL, POSTHOG, STRIPE];

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
