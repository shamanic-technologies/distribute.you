"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { tenantBasePath } from "@/lib/offer-path";
import { audienceDetailHref } from "@/lib/audience-detail-href";
import { BrandLogo } from "@/components/brand-logo";
import { OfferMark } from "@/components/marks/offer-mark";
import { useOfferImages } from "@/lib/use-offer-images";
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
import { SALES_FUNNELS } from "@/lib/sales-funnels";
import { MaturityBadge } from "@/components/maturity-badge";
import { WorkflowModelCell, WorkflowTemplateCell } from "@/components/workflows/workflow-cells";
import type { LeadWorkflowIdentity } from "@/lib/campaign-workflow-rows";
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
  sole: {
    featureSlug: string | null;
    legKey: string | null;
    audience: LeadCampaignAudience | null;
    /** The campaign this person's one card names — what the Workflow card links into. */
    campaignId: string;
    /**
     * The workflow that SERVED this person, resolved from the slug their own row froze.
     * Null when the row states none, when the reader is not on the beta, or while the
     * two channel reads are in flight: a card is drawn only once there is one to draw.
     */
    workflow: LeadWorkflowIdentity | null;
  } | null;
}) {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const { displayBrand } = useTenantSwitcher();
  const channels = useAcquisitionChannels();
  const legIndex = useFunnelLegIndex();
  // The offer arrives from lead-service as `{id, name}` and carries no image, so the
  // mark is resolved from the brand's own offer list — a lookup over a query this page
  // already polls. See `lib/offer-image.ts`.
  const offerImage = useOfferImages(brandId);

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
            logoUrl={displayBrand?.logoUrl}
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
          mark={<OfferMark size="sm" imageUrl={offerImage(offer.id)} />}
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
             settings card reads, never a second vocabulary. */
          subtitle={funnel.steps.join(" → ")}
          href={null}
          linkLabel={null}
        />
      )}
      {leg && funnel && (
        <ScopeCard
          heading="Funnel leg"
          mark={<FunnelLegMark fromKey={leg.fromKey} toKey={leg.toKey} size="sm" />}
          title={leg.label}
          unnamed={null}
          /* A funnel is sold leg by leg, so the arrow is what the campaign actually
             buys. Neither the funnel nor the leg has a page of its own. */
          subtitle="The step of the funnel this campaign works."
          href={null}
          linkLabel={null}
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
      {sole?.workflow && (
        <WorkflowScopeCard
          workflow={sole.workflow}
          offerId={offer?.id ?? null}
          campaignId={sole.campaignId}
        />
      )}
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
  // The route's own scope. `offerId` is absent on the brand Leads page; `id` names a
  // campaign, present only on its own route.
  const routeOfferId = params.offerId as string | undefined;
  const campaignId = params.id as string | undefined;
  // The audience opens at the grain the reader is standing on — a campaign's Leads page
  // opens it on that campaign's Audiences page rather than dropping them back to the
  // offer. `audienceDetailHref` owns the rule (including "no offer resolvable ⟹ no
  // link"), so this card and the campaign row below cannot state two different links.
  const detailHref = audienceDetailHref({
    orgId,
    brandId,
    audienceId: audience.id,
    audienceOfferId: audience.offerId,
    routeOfferId,
    campaignId,
  });
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

/**
 * THE WORKFLOW THAT SERVED THIS PERSON, and what it writes with.
 *
 * The lead's own `leads_campaigns` row froze a versioned workflow slug at serve time,
 * so this names the workflow that actually processed THEM rather than whatever the
 * campaign is pinned to today. It draws under Audience because it is the last link in
 * the same story: the audience says who was picked, the workflow says what ran on them.
 *
 * BETA, and gated by the PAGE — the reads behind it fire only for a beta reader, so a
 * card reaching here has already passed that gate. The badge rides the heading, which
 * is the visible half of the rule: a gate with no badge is a surface whose own reader
 * cannot tell it is beta.
 *
 * ⚠️ THE MODEL AND THE TEMPLATE ARE THE WORKFLOW'S, NOT THIS EMAIL'S, and the card says
 * so in one line. workflow-service publishes them for each dynasty's CURRENT version
 * only, so an earlier version that served this person may have named a different model
 * or template and nothing on the wire could tell us. Printing them as "what wrote this
 * email" would be a claim we cannot back; printing nothing would withhold a fact the
 * reader came for.
 *
 * The cells are the SAME two the campaign Workflows table draws, so a workflow cannot
 * read one way here and another way on the page this card links into.
 */
function WorkflowScopeCard({
  workflow,
  offerId,
  campaignId,
}: {
  workflow: LeadWorkflowIdentity;
  offerId: string | null;
  campaignId: string;
}) {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  // The Workflows page lives under the campaign, which lives under the OFFER it sells,
  // so the link is built from the CARD's own offer and campaign rather than from
  // whichever route the reader is on — a brand-scoped reader has no offer segment, and
  // building it from the route is what sends them to a path that does not exist.
  //
  // No dynasty resolved ⟹ NO link: `?workflow=` opens the panel BY dynasty slug, so a
  // link without one lands on the list with nothing open, which reads as a broken
  // control rather than as an answer.
  const detailHref =
    offerId && workflow.dynastySlug
      ? `${tenantBasePath(orgId, brandId, offerId)}/campaigns/${campaignId}/workflows?workflow=${encodeURIComponent(
          workflow.dynastySlug,
        )}`
      : null;
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow</h3>
        <MaturityBadge level="beta" />
      </div>
      {/* A version nothing can name still names ITSELF: the frozen slug is what the row
          holds, and stating it keeps the attribution while admitting the lookup missed. */}
      <p className="truncate text-sm font-medium text-gray-800">
        {workflow.dynastyName ?? workflow.workflowSlug}
      </p>
      {workflow.dynastySlug ? (
        <>
          <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                LLM
              </p>
              <WorkflowModelCell contentModel={workflow.contentModel} />
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                AI template
              </p>
              <WorkflowTemplateCell contentPromptType={workflow.contentPromptType} />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            The model and the template are what this workflow runs today. An earlier
            version of it may have written this email.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-gray-600">
          This version is not one the channel currently offers, so we cannot say what it
          writes with.
        </p>
      )}
      {detailHref && (
        <Link
          href={detailHref}
          className="mt-3 inline-block text-sm text-brand-600 hover:text-brand-700 hover:underline"
        >
          View workflow details
        </Link>
      )}
    </div>
  );
}
