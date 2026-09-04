"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { tenantBasePath } from "@/lib/offer-path";
import { BrandLogo } from "@/components/brand-logo";
import { OfferMark } from "@/components/marks/offer-mark";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { FunnelLegMark } from "@/components/marks/funnel-leg-mark";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { useTenantSwitcher } from "@/lib/use-tenant-switcher";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { channelSlugLabel } from "@/lib/campaign-title";
import { campaignLegFor } from "@/lib/campaign-leg";
import { statedCampaignLeg } from "@/lib/stated-campaign-leg";
import { useFunnelLegIndex } from "@/lib/use-funnel-leg-index";
import { funnelLegOperator, funnelLegOperatorLabel } from "@/lib/funnel-leg-operator";
import { SALES_FUNNELS } from "@/lib/sales-funnels";
import type { LeadCampaignAudience } from "@/components/audiences/lead-campaign-sections";

/**
 * The hierarchy the open lead sits in, ONE CARD PER LEVEL, stacked.
 *
 * Brand > Offer > Funnel > Funnel leg > Channel > Audience is how the product is sold,
 * and a panel that nests all six inside each other reads as one box with a paragraph in
 * it. Each level a person's campaigns AGREE on gets its own card here — mark, title, one
 * line saying what it is, and the link to its own page — and only what varies is left to
 * the nested list underneath.
 *
 * WHICH levels those are is `leadPanelScope`'s answer, computed off the person's own
 * cards rather than off the route: a funnel-scoped page serves the brand's rows, so the
 * route's funnel is not a fact about everyone on it. In the ordinary case the two agree,
 * which is why a campaign-scoped panel draws all six and a brand-scoped one draws Brand
 * alone.
 *
 * A level we cannot resolve renders NOTHING rather than a card reading `-`: every one of
 * these is fail-soft upstream, so an absent value means "we could not say" as often as
 * "there is none", and a card asserts the second.
 */
export function LeadScopeCards({
  offer,
  funnelKey,
  sole,
}: {
  offer: { id: string; name: string | null } | null;
  funnelKey: string | null;
  /** The leg, channel and audience are facts about the PERSON only when they have one
   *  campaign. With several, each card in the list below states its own. */
  sole: { featureSlug: string | null; legKey: string | null; audience: LeadCampaignAudience | null } | null;
}) {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const { displayBrand } = useTenantSwitcher();
  const channels = useAcquisitionChannels();
  const legIndex = useFunnelLegIndex();

  // A lookup that ANSWERS rather than one that throws on a key it does not carry: the
  // key here comes off a campaign row, so a funnel we cannot name renders no card.
  const funnel = funnelKey ? SALES_FUNNELS.find((f) => f.key === funnelKey) ?? null : null;
  const channel = sole?.featureSlug
    ? acquisitionChannelForFeatureSlug(sole.featureSlug, channels)
    : null;
  // Same precedence as `CampaignIdentity`, so a campaign cannot read as one leg here and
  // another in the top bar above it: the campaign's own stated leg wins, the derivation
  // from the channel's legs is the fallback for every campaign predating the column.
  const leg =
    funnel && sole
      ? statedCampaignLeg(funnel, sole.legKey, legIndex) ?? campaignLegFor(funnel, channel?.legs)
      : null;
  const offerPath = tenantBasePath(orgId, brandId, offer?.id ?? null);

  return (
    <>
      {/* The brand is the one level every Leads page shares, so it is always stated —
          and it is where the money and the whole hierarchy hang off. */}
      <ScopeCard
        heading="Brand"
        mark={
          <BrandLogo
            domain={displayBrand?.domain ?? null}
            size={20}
            className="h-5 w-5 shrink-0 rounded"
            fallbackClassName="h-5 w-5 shrink-0 text-gray-400"
          />
        }
        title={displayBrand?.name ?? null}
        unnamed="This brand"
        subtitle={displayBrand?.domain ?? null}
        href={`/orgs/${orgId}/brands/${brandId}`}
        linkLabel="View brand"
      />
      {offer && (
        <ScopeCard
          heading="Offer"
          mark={<OfferMark size="sm" />}
          title={offer.name}
          unnamed="Unnamed offer"
          subtitle="What this person was contacted to be sold."
          href={offerPath}
          linkLabel="View offer"
        />
      )}
      {funnel && (
        <ScopeCard
          heading="Sales funnel"
          mark={<SalesFunnelMark def={funnel} size="sm" />}
          title={funnel.name}
          unnamed={null}
          /* The steps in the funnel's own words — the same ones the Sales Funnels
             settings card and the funnel page read, never a second vocabulary. */
          subtitle={funnel.steps.join(" → ")}
          href={offer ? `${offerPath}/funnels/${funnel.key}` : null}
          linkLabel="View funnel"
        />
      )}
      {leg && funnel && (
        <ScopeCard
          heading="Funnel leg"
          mark={<FunnelLegMark fromKey={leg.fromKey} toKey={leg.toKey} size="sm" />}
          title={leg.label}
          unnamed={null}
          /* A funnel is sold leg by leg, so the arrow is what the campaign actually
             buys — and WHO works it is the other half of that sentence. */
          subtitle={`Worked by ${funnelLegOperatorLabel(
            funnelLegOperator(leg.fromKey, leg.toKey),
            displayBrand?.name,
          )}.`}
          href={offer ? `${offerPath}/funnels/${funnel.key}/legs/${leg.toKey}` : null}
          linkLabel="View leg"
        />
      )}
      {sole?.featureSlug && (
        <ScopeCard
          heading="Acquisition channel"
          mark={channel ? <AcquisitionChannelMark def={channel} size="sm" /> : null}
          /* A slug the catalogue misses keeps its own prettified words — still the
             channel's name, never a guess at a different channel's. */
          title={channel?.name ?? channelSlugLabel(sole.featureSlug)}
          unnamed={null}
          subtitle={channel?.summary ?? "Where this person was reached."}
          href={null}
          linkLabel={null}
        />
      )}
      {sole && (sole.audience ? <AudienceScopeCard audience={sole.audience} /> : null)}
    </>
  );
}

/** One level, drawn the way every other level is drawn. */
function ScopeCard({
  heading,
  mark,
  title,
  unnamed,
  subtitle,
  href,
  linkLabel,
}: {
  heading: string;
  mark: React.ReactNode;
  title: string | null;
  /** What to read when the title is missing, or null to render the card unnamed. */
  unnamed: string | null;
  subtitle: string | null;
  href: string | null;
  linkLabel: string | null;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{heading}</h3>
      <div className="flex min-w-0 items-center gap-2">
        {mark}
        <p className="truncate text-sm font-medium text-gray-800">
          {title ?? <span className="text-gray-500">{unnamed ?? "Not stated"}</span>}
        </p>
      </div>
      {subtitle && <p className="mt-2 text-sm text-gray-600">{subtitle}</p>}
      {href && linkLabel && (
        <Link
          href={href}
          className="mt-3 inline-block text-sm text-brand-600 hover:text-brand-700 hover:underline"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

/**
 * The audience as its own card, with the avatar the Audiences page draws for it.
 *
 * Size / remaining-to-contact deliberately do NOT live here: the Audiences page owns
 * every audience number and the targeting filters. The link carries `?audienceId=`,
 * the deep-link seed `CustomerAudiencesPage` reads on first paint.
 */
function AudienceScopeCard({ audience }: { audience: LeadCampaignAudience }) {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const routeOfferId = params.offerId as string | undefined;
  // An audience's page lives under the OFFER it was assembled for, so the link is built
  // from the AUDIENCE's own `offerId`, never from whichever route the reader is on —
  // building it from the route sent every brand-level reader to a path that does not
  // exist. No offer resolvable ⟹ no link: some audiences predate the offer level.
  const audienceOfferId = audience.offerId ?? routeOfferId ?? null;
  const detailHref = audienceOfferId
    ? `${tenantBasePath(orgId, brandId, audienceOfferId)}/audiences?audienceId=${audience.id}`
    : null;
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Audience</h3>
      <div className="flex items-center gap-3">
        {audience.avatarUrl ? (
          <img
            src={audience.avatarUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded border border-gray-200 bg-white object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-brand-100 text-sm font-semibold text-brand-700">
            {(audience.name ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <p className="text-sm font-medium text-gray-800">
          {audience.name ?? <span className="text-gray-500">An audience no longer listed</span>}
        </p>
      </div>
      {audience.description && <p className="mt-2 text-sm text-gray-600">{audience.description}</p>}
      {detailHref && (
        <Link
          href={detailHref}
          className="mt-3 inline-block text-sm text-brand-600 hover:text-brand-700 hover:underline"
        >
          View audience details
        </Link>
      )}
    </div>
  );
}
