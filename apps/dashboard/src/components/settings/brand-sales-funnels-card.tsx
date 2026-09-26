"use client";

import { PAYMENT_DECLINED_LABEL, PAYMENT_DECLINED_STYLE } from "@/lib/payment-declined";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import { useMutation } from "@tanstack/react-query";
import {
  declareOfferSalesFunnel,
  getBrand,
  getBrandSalesEconomics,
  getFeature,
  getOfferSalesFunnels,
  getBrandFunnelBudgets,
  getBrandSpendableBudget,
  getPublicChannels,
  getWorkflowProjectionLadder,
  listCampaignsByBrand,
  prefillFeatureInputs,
  prefillToStringMap,
  saveBrandFunnelBudget,
  setCampaignStatus,
  startFunnelChannelCampaign,
  undeclareOfferSalesFunnel,
  type BrandSalesFunnelSet,
  type DeclaredSalesFunnel,
} from "@/lib/api";
import { buildControlRows, type OfferableChannel } from "@/lib/campaign-controls";
import { runningAfterBudget } from "@/lib/campaign-budget";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { launchLegKey } from "@/lib/stated-campaign-leg";
import {
  CHANNEL_RUN_STATE_LABEL,
  ChannelStartRefusal,
  channelRunState,
  channelStartBlocker,
  channelStatusSummary,
  channelWriteErrorMessage,
  startableWorkflowDynastySlug,
  type ChannelRunState,
  type ChannelStatusMove,
} from "@/lib/channel-start";
import { Skeleton } from "@/components/skeleton";
import { useFeatures } from "@/lib/features-context";
import {
  channelsForFunnel,
  funnelChannelBudgets,
  funnelPairCents,
  offerFunnelTotalCents,
} from "@/lib/funnel-channels";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { useChannelMinimums } from "@/lib/use-channel-minimums";
import {
  channelBudgetBelowMinimum,
  channelBudgetFloorMessage,
  channelBudgetHint,
  channelMinimumCents,
  projectedPairTotalUsd,
} from "@/lib/channel-minimums";
import {
  NOTHING_DECLARED,
  SALES_FUNNELS,
  buildFunnelPatch,
  funnelDestinationChips,
  funnelDraftFromBrand,
  funnelDraftFromDeclared,
  funnelLifetimeLabel,
  funnelRateFields,
  funnelWriteErrorMessage,
  isEmptyFunnelPatch,
  partitionFunnelsBySelection,
  validateFunnelDraft,
  type DeclaredFunnelValues,
  type FunnelDraft,
  type FunnelRateKey,
  type SalesFunnelDef,
  type SalesFunnelKey,
} from "@/lib/sales-funnels";
import {
  formatLocaleInteger,
  parseLocaleNumberInput,
} from "@/lib/format-number";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { invalidateCampaignMoney } from "@/lib/write-invalidation";
import { FunnelActivationModal } from "@/components/settings/funnel-activation-modal";
import { spendableCampaignsForFunnel } from "@/lib/use-running-daily-budget";
import { BrandLogo } from "@/components/brand-logo";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { InfoTooltip } from "@/components/visibility/metric-info";

// The funnels an OFFER is sold through, and what each one is worth. Several can
// run at once, and each keeps its own conversion rates, lifetime revenue and
// landing page, because a self-serve purchase customer and an enterprise meeting
// customer are not worth the same and do not land on the same page.
//
// The scope is the OFFER, never the brand. A brand is an identity; an offer is
// the proposition, and conversion rates, lifetime revenue and destinations are
// facts about the proposition. brand-service still serves the brand-scoped funnel
// routes and resolves them to the brand's sole offer, which is why the card
// worked before the offer level shipped — but on a page that names ONE offer
// those routes write to whichever offer the service picks, and they answer 409
// SEVERAL_OFFERS the moment a brand has two. So every read and every write here
// carries the offer, and the query key carries it too: two offers of one brand
// sharing one cache entry would show each other's funnels.
//
// The MONEY is the exception, and deliberately so: billing keys a ceiling on
// (org, brand, funnel, acquisition channel) and has no offer dimension, so the
// budgets stay on the brand-scoped billing routes and the brand-scoped key.
//
// brand-service stores all of it PER FUNNEL, so this card writes: confirming a
// funnel declares it and prices it, removing one drops its economics with the
// declaration. The write is a PARTIAL patch built by `buildFunnelPatch` — only
// the fields whose value actually changed travel, so editing one rate cannot
// overwrite the others and emptying a field really clears it.
//
// A funnel the brand has NOT declared is prefilled from its blended sales
// economics so the numbers on screen are its own. That prefill is for a person
// to confirm and is never written on its own: the patch omits any field that
// still equals what is stored, so a number nobody confirmed cannot read back as
// one the brand declared.
//
// Choosing a funnel, and dropping one, are decisions about how the brand sells.
// Neither is one tap on a checkbox: both go through opening the card and
// pressing a button that says what it does.

type FunnelState = {
  /** Declared on the wire: the brand has stated it sells through this funnel. */
  declared: boolean;
  /** What brand-service has stored, and what the patch is diffed against. */
  saved: DeclaredFunnelValues;
  touched: boolean;
  draft: FunnelDraft;
  /**
   * The daily ceiling PER ACQUISITION CHANNEL, in whole dollars, as typed, keyed
   * on the channel's feature slug. Kept OUT of `draft` on purpose: `draft` is
   * exactly what brand-service's patch reads, and this is billing's. Two
   * services, two writes, one form.
   *
   * Per channel rather than per funnel because the same funnel is worked through
   * several offers at once, each running its own campaign: one figure for the
   * funnel could not say how the money splits between them, and billing refuses
   * a slug-less write on a split funnel for exactly that reason.
   */
  budgetUsdByChannel: Record<string, string>;
  /**
   * Whether each channel should be RUNNING once Save lands, as the switch reads it,
   * keyed on the channel's feature slug. Kept out of `draft` for the same reason the
   * money is: `draft` is exactly what brand-service's patch reads, and this is
   * campaign-service's. Three services, three writes, one form.
   *
   * A key is present only once the reads have settled, so a channel whose state we do
   * not know yet has no draft to compare against and cannot be saved by accident.
   */
  runningByChannel: Record<string, boolean>;
  /** What campaign-service reports right now, the baseline the switch diffs against. */
  savedRunningByChannel: Record<string, boolean>;
  /**
   * The campaign a status write ADDRESSES per channel, or null for one that has none.
   * Null is what makes the switch a CREATE rather than a status flip: since
   * campaign-service stopped provisioning from a funded ceiling, a channel funded
   * after onboarding has no campaign and nothing can address it until one is made.
   */
  campaignIdByChannel: Record<string, string | null>;
  /**
   * Channels whose campaign billing stopped over a declined card (not a person), so a
   * restart is refused until the payment is fixed. See `lib/payment-declined.ts`.
   */
  declinedByChannel: Record<string, boolean>;
  /** What billing has stored per channel, in cents. Zero = not funded. */
  savedCentsByChannel: Record<string, number>;
  /**
   * What billing has stored for the funnel AS A WHOLE, in cents: the served sum
   * of the channels above, across EVERY offer selling it, never re-added here.
   * The product minimum and its grandfather bind this, not any single channel —
   * which is the one question that genuinely spans offers, and the only thing
   * this is read for. Nothing DISPLAYS it: this page is scoped to one offer, so
   * a figure covering the sibling's money would name money the reader can
   * neither see nor edit (see `offerFunnelTotalCents`).
   */
  savedBudgetCents: number;
  error: string | null;
};

function emptyDraft(def: SalesFunnelDef): FunnelDraft {
  const rates: Partial<Record<FunnelRateKey, string>> = {};
  for (const rate of funnelRateFields(def)) rates[rate.key] = "";
  return { rates, lifetimeRevenueUsd: "", destinationUrl: "", bookingUrl: "" };
}

function initialStates(): Record<SalesFunnelKey, FunnelState> {
  const out = {} as Record<SalesFunnelKey, FunnelState>;
  for (const def of SALES_FUNNELS) {
    out[def.key] = {
      declared: false,
      saved: NOTHING_DECLARED,
      touched: false,
      draft: emptyDraft(def),
      budgetUsdByChannel: {},
      runningByChannel: {},
      savedRunningByChannel: {},
      campaignIdByChannel: {},
      declinedByChannel: {},
      savedCentsByChannel: {},
      savedBudgetCents: 0,
      error: null,
    };
  }
  return out;
}

/** Catalogue order, so two reads of the same brand never disagree on order. */
function byCatalogueOrder(a: DeclaredSalesFunnel, b: DeclaredSalesFunnel): number {
  const order = SALES_FUNNELS.map((f) => f.key);
  return order.indexOf(a.funnelKey) - order.indexOf(b.funnelKey);
}

export function BrandSalesFunnelsCard({
  brandId,
  offerId,
}: {
  brandId: string;
  offerId: string;
}) {
  const queryClient = useQueryClient();

  // The economics + brand keys are the ones the sibling settings cards already
  // use, so those reads dedupe instead of adding a fetch.
  const { data: econData, isError: econError } = useAuthQuery(
    ["brandSalesEconomics", brandId],
    () => getBrandSalesEconomics(brandId),
  );
  const { data: brandData, isError: brandError } = useAuthQuery(["brand", brandId], () =>
    getBrand(brandId),
  );
  // The offer is IN the key. Two propositions of one brand sell through
  // different funnels at different rates, so one shared entry would paint the
  // sibling offer's funnels on this one.
  const { data: funnelData, isError: funnelError } = useAuthQuery(
    ["offerSalesFunnels", brandId, offerId],
    () => getOfferSalesFunnels(brandId, offerId),
  );
  // billing owns the money side. Its store is BRAND-scoped and answers at three
  // grains at once — per funnel, per (funnel, channel), per (funnel, channel,
  // offer) — so the read stays on the brand key, shared with every other surface
  // that asks what this brand is funded at, and the offer narrowing happens
  // below where the finest grain is read. A funnel with no row is simply not
  // funded, which is why an absent row reads as zero rather than as an unknown.
  const { data: budgetData, isError: budgetError } = useAuthQuery(
    ["brandFunnelBudgets", brandId],
    () => getBrandFunnelBudgets(brandId),
  );

  // What each funnel may spend TODAY, which is a JOIN neither producer can answer
  // alone: billing keys a ceiling on (funnel x channel x offer) and stores no
  // status, campaign-service stores the status and no money. So billing's figures
  // above — the ones the fields in this card edit — are status-BLIND, and a funnel
  // running one channel at $50 beside one PAUSED at $10 has $60 of ceilings and $50
  // of spend. campaign-service serves the join; this reads it on the key every
  // campaign surface already polls, so it costs no request, and
  // `invalidateCampaignMoney` (which both writes below call) re-reads it, so the
  // tag moves the moment a budget or a status does.
  const spendableQ = useAuthQuery(
    ["brandSpendableBudget", brandId],
    () => getBrandSpendableBudget(brandId),
    { enabled: Boolean(brandId) },
  );

  // Whether each channel is RUNNING, which is campaign-service's own word and the one
  // thing money cannot answer. Since 2026-09-06 a funded ceiling provisions nothing, so
  // a channel funded here after onboarding has no campaign at all until a person starts
  // it — and that is the state this card had no way to show or change.
  //
  // `["campaigns", brandId]` is the key the funnels table and the controls trigger
  // already poll, so this costs no request, and every write below re-reads it through
  // `invalidateCampaignMoney`.
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId));

  // Which channels each funnel may be sold through is features-service's own
  // statement, carried on the feature list the app already fetches — so this
  // dedupes on the shared `["features"]` key rather than adding a read.
  const { features } = useFeatures();
  // The same catalogue in the shape `buildControlRows` reads. It dedupes on
  // `["features"]` too, so it is the same one payload.
  const catalogue = useAcquisitionChannels();

  // What a day of each channel costs to run — the floor a funded ceiling clears.
  // features-service publishes it on the channel's own terms, and this reads it
  // on the key the leg index already polls, so it costs no request. No floors is
  // the honest reading while it settles: billing holds the same rule and its 400
  // is what decides, so nothing here refuses money billing would accept.
  const minimums = useChannelMinimums();

  const brand = brandData?.brand ?? null;
  const brandDomain = brand?.domain ?? null;
  // Only true once the brand resolved, so a load flash cannot lock the visit-led
  // funnels on a brand that does have a website.
  const noWebsite = !!brand && brand.url == null;

  const [states, setStates] = useState<Record<SalesFunnelKey, FunnelState>>(initialStates);
  // One card open at a time: the list reorders itself around the selection, so
  // several open forms would move under the cursor.
  const [openKey, setOpenKey] = useState<SalesFunnelKey | null>(null);
  // The funnel an offer JUST started selling through, while its rates are shown
  // for confirmation. Set only on a first declaration: an update to a funnel the
  // offer already sells through has nothing new to confirm.
  const [activation, setActivation] = useState<{
    funnelKey: SalesFunnelKey;
    lifetimeRevenueUsd: number | null;
    bookingUrl: string | null;
  } | null>(null);
  const closeActivation = useCallback(() => setActivation(null), []);
  const [pendingKey, setPendingKey] = useState<SalesFunnelKey | null>(null);
  const hydrated = useRef(false);
  // The payload the form was last seeded FROM. A boolean latch cannot do this
  // job: the reads settle from the on-disk cache first (local-first SWR), so a
  // once-only seed takes whatever the last visit stored and then ignores the
  // fresh server payload that lands a moment later. The card kept showing a
  // rate the brand had already saved as blank, which reads as the save having
  // been dropped. `setQueryData` after a write does not go through the query
  // function, so it is not persisted either, and the stale copy outlives the
  // write that replaced it.
  const seededFrom = useRef<{ funnels: unknown; budgets: unknown }>({
    funnels: undefined,
    budgets: undefined,
  });
  /** The campaigns payload the SWITCHES were last seeded from. Same rule, own read. */
  const seededStatusFrom = useRef<unknown>(undefined);

  // Seed every funnel from the server: a DECLARED funnel from its own stored
  // values, an undeclared one from the brand's blended economics as a guess to
  // confirm. A funnel the user has edited keeps what they typed, and so does
  // the one they have open, so a background refetch can never move the form
  // under the cursor.
  //
  // Hydration waits for each read to SETTLE — resolved OR errored — never for
  // all four to succeed. Gated on success alone, ONE failing read left every
  // funnel at its initial blank state forever: no rate, no lifetime revenue,
  // `$0/day`, and `OK` where the card should have said `Update`. That is
  // indistinguishable from a brand that has told us nothing, so it reads as
  // deleted data rather than as a failed read, and it is exactly how the
  // retired-goal parse throw took this card down fleet-wide. A read that
  // errored contributes what it knows, which is nothing; the others still show
  // what the brand stated.
  useEffect(() => {
    const econSettled = econData !== undefined || econError;
    const brandSettled = brandData !== undefined || brandError;
    const funnelSettled = funnelData !== undefined || funnelError;
    const budgetSettled = budgetData !== undefined || budgetError;
    if (!econSettled || !brandSettled || !funnelSettled || !budgetSettled) return;
    // Re-seed whenever either payload is a DIFFERENT object than the one the
    // form was built from — which is what a revalidation landing on top of a
    // restored disk snapshot produces. Identity, not deep equality: React Query
    // hands back the same reference when nothing changed (structural sharing),
    // so an unchanged refetch costs nothing here.
    if (
      hydrated.current &&
      seededFrom.current.funnels === funnelData &&
      seededFrom.current.budgets === budgetData
    ) {
      return;
    }
    hydrated.current = true;
    seededFrom.current = { funnels: funnelData, budgets: budgetData };
    const declared = new Map((funnelData?.funnels ?? []).map((f) => [f.funnelKey, f]));
    const funded = new Map((budgetData?.funnels ?? []).map((f) => [f.funnelKey, f.dailyBudgetCents]));
    setStates((prev) => {
      const next = { ...prev };
      for (const def of SALES_FUNNELS) {
        // What the user is typing outranks the server, and so does the card
        // they have open: a form that rewrites itself mid-edit is worse than a
        // stale one. Both keep their draft until the write settles, and the
        // mutation's own success handler seeds them from its response.
        if (next[def.key].touched || openKey === def.key) continue;
        const saved = declared.get(def.key);
        const cents = funded.get(def.key) ?? 0;
        // The money splits across the channels this funnel may be sold through,
        // and then across the offers worked through each — billing serves both
        // grains. The fields show THIS offer's own ceilings, because they are
        // what the button writes; a channel with no row is not funded.
        const perChannel = funnelChannelBudgets(
          def.key,
          channelsForFunnel(def.key, features),
          budgetData?.channels,
          cents,
          budgetData?.offers,
          offerId,
        );
        const savedCentsByChannel: Record<string, number> = {};
        const budgetUsdByChannel: Record<string, string> = {};
        for (const { channel, savedCents } of perChannel) {
          savedCentsByChannel[channel.featureSlug] = savedCents;
          // A daily budget always renders as whole dollars, never cents.
          budgetUsdByChannel[channel.featureSlug] =
            savedCents > 0 ? String(Math.round(savedCents / 100)) : "";
        }
        next[def.key] = {
          ...next[def.key],
          // The set lists switched-off funnels too, keeping every number on them
          // so the form can show what the user entered. Treating one as selected
          // just because it is IN the list would put a green tag on a funnel the
          // brand told us it no longer sells through.
          declared: saved !== undefined && saved.active !== false,
          saved: saved ?? NOTHING_DECLARED,
          budgetUsdByChannel,
          savedCentsByChannel,
          savedBudgetCents: cents,
          draft: saved
            ? funnelDraftFromDeclared(def, saved)
            : funnelDraftFromBrand(
                def,
                econData?.salesEconomics ?? null,
                brand?.clickDestinationUrl ?? null,
              ),
        };
      }
      return next;
    });
  }, [
    econData,
    brandData,
    funnelData,
    budgetData,
    brand,
    econError,
    brandError,
    funnelError,
    budgetError,
    features,
    openKey,
  ]);

  // Seed every funnel's per-channel SWITCH from campaign-service, on its own effect
  // and its own ref.
  //
  // Separate from the field hydration above because the two settle independently: the
  // campaigns read must never hold the rates and the money hostage, and a field edit
  // must never be re-seeded because a campaign poll landed. Same identity-compare rule
  // though, for the same reason: the local-first cache resolves the disk snapshot
  // first, so a boolean latch would seed from the previous visit and ignore the server
  // answer that lands a moment later.
  //
  // The rows come from `buildControlRows`, the ONE resolver every campaign surface
  // writes through, scoped to this offer and this funnel. `offerable` is what makes a
  // channel with no campaign appear at all: without it a channel nobody has launched is
  // invisible to a campaign-derived list by construction, which is precisely the
  // channel someone opens this card to turn on.
  useEffect(() => {
    if (campaignsQ.data === undefined && !campaignsQ.isError) return;
    if (seededStatusFrom.current === campaignsQ.data) return;
    seededStatusFrom.current = campaignsQ.data;
    setStates((prev) => {
      const next = { ...prev };
      for (const def of SALES_FUNNELS) {
        const channels = channelsForFunnel(def.key, features);
        const offerable: OfferableChannel[] = channels.map((channel) => ({
          funnelKey: def.key,
          featureSlug: channel.featureSlug,
          channelName: channel.name,
          offerId,
        }));
        const rows = buildControlRows(
          campaignsQ.data?.campaigns ?? [],
          budgetData,
          catalogue,
          { offerId, funnelKey: def.key },
          offerable,
        );
        const savedRunningByChannel: Record<string, boolean> = {};
        const campaignIdByChannel: Record<string, string | null> = {};
        const declinedByChannel: Record<string, boolean> = {};
        for (const row of rows) {
          const slug = row.scope?.featureSlug;
          if (!slug) continue;
          savedRunningByChannel[slug] = (savedRunningByChannel[slug] ?? false) || row.running;
          campaignIdByChannel[slug] = campaignIdByChannel[slug] ?? row.campaignId;
          if (row.paymentDeclined) declinedByChannel[slug] = true;
        }
        // A switch the user has already flipped outranks the server, and so does the
        // card they have open: a form that rewrites itself mid-edit is worse than a
        // stale one. Same rule the fields follow.
        const keepDraft = next[def.key].touched || openKey === def.key;
        next[def.key] = {
          ...next[def.key],
          savedRunningByChannel,
          campaignIdByChannel,
          declinedByChannel,
          runningByChannel: keepDraft ? next[def.key].runningByChannel : savedRunningByChannel,
        };
      }
      return next;
    });
  }, [campaignsQ.data, campaignsQ.isError, budgetData, catalogue, features, offerId, openKey]);

  /** Write the funnel we just declared into the cached set, in catalogue order. */
  function cacheDeclared(funnel: DeclaredSalesFunnel) {
    queryClient.setQueryData(
      ["offerSalesFunnels", brandId, offerId],
      (prev: BrandSalesFunnelSet | undefined): BrandSalesFunnelSet => {
        const rest = (prev?.funnels ?? []).filter((f) => f.funnelKey !== funnel.funnelKey);
        return { funnels: [...rest, funnel].sort(byCatalogueOrder) };
      },
    );
  }

  const declareMutation = useMutation({
    mutationFn: (vars: { def: SalesFunnelDef; patch: ReturnType<typeof buildFunnelPatch> }) =>
      declareOfferSalesFunnel(brandId, offerId, vars.def.key, vars.patch),
    onSuccess: (res, vars) => {
      const firstDeclaration = !states[vars.def.key].declared;
      cacheDeclared(res.funnel);
      if (firstDeclaration) {
        // The brand's rates now cover a funnel they did not before, so re-read them
        // before the modal states them.
        void queryClient.invalidateQueries({ queryKey: ["brandConversionRates", brandId] });
        setActivation({
          funnelKey: vars.def.key,
          lifetimeRevenueUsd: res.funnel.lifetimeRevenueUsd,
          bookingUrl: res.funnel.bookingUrl,
        });
      }
      // Show exactly what persisted, so the card can never claim a value the
      // store rejected or normalized differently.
      patch(vars.def.key, {
        declared: true,
        saved: res.funnel,
        touched: false,
        draft: funnelDraftFromDeclared(vars.def, res.funnel),
        error: null,
      });
      setOpenKey(null);
    },
    onError: (err, vars) => {
      console.error("[dashboard] declareOfferSalesFunnel failed", err);
      patch(vars.def.key, { error: funnelWriteErrorMessage(err) });
    },
    onSettled: () => setPendingKey(null),
  });

  // billing's write, separate from brand-service's. A funnel's money and a
  // funnel's economics live in two services, so pressing one button makes two
  // writes; neither can stand in for the other.
  // The money is stated PER CHANNEL, so a funnel sold through two channels makes
  // two writes. They run in SEQUENCE, not in parallel: each response carries the
  // whole set, and billing recomputes the funnel total on every one, so two
  // concurrent writes would each answer with a set that predates the other and
  // the last one home would cache a total missing its sibling.
  //
  // Each write NAMES THE OFFER it funds, alongside the channel. A ceiling funds
  // one campaign and a campaign is (offer × funnel × channel), so a write naming
  // only two of the three addresses every offer worked through that pair at
  // once: the day a brand states a second, funding one would silently fund the
  // other and neither could be stopped without stopping both.
  const budgetMutation = useMutation({
    mutationFn: async (vars: {
      def: SalesFunnelDef;
      moves: { featureSlug: string; cents: number }[];
    }) => {
      let set: Awaited<ReturnType<typeof saveBrandFunnelBudget>> | null = null;
      for (const move of vars.moves) {
        set = await saveBrandFunnelBudget(
          brandId,
          vars.def.key,
          move.cents,
          move.featureSlug,
          offerId,
        );
      }
      return set!;
    },
    onSuccess: (set, vars) => {
      queryClient.setQueryData(["brandFunnelBudgets", brandId], set);
      // Funding a funnel changes what every campaign selling it may spend, so the
      // running total, the campaign rows and the funnels table are re-read at once
      // rather than waiting for their own next poll.
      invalidateCampaignMoney(queryClient);
      // Show exactly what persisted, per channel and for the funnel as a whole,
      // so the card can never claim a ceiling billing normalized differently.
      const cents = set.funnels.find((f) => f.funnelKey === vars.def.key)?.dailyBudgetCents ?? 0;
      const savedCentsByChannel: Record<string, number> = {};
      const budgetUsdByChannel: Record<string, string> = {};
      for (const { channel, savedCents } of funnelChannelBudgets(
        vars.def.key,
        channelsForFunnel(vars.def.key, features),
        set.channels,
        cents,
        set.offers,
        offerId,
      )) {
        savedCentsByChannel[channel.featureSlug] = savedCents;
        budgetUsdByChannel[channel.featureSlug] =
          savedCents > 0 ? String(Math.round(savedCents / 100)) : "";
      }
      patch(vars.def.key, { savedBudgetCents: cents, savedCentsByChannel, budgetUsdByChannel });
    },
    onError: (err, vars) => {
      console.error("[dashboard] saveBrandFunnelBudget failed", err);
      patch(vars.def.key, { error: funnelWriteErrorMessage(err) });
    },
  });

  /**
   * campaign-service's write, the third of the three this one button commits.
   *
   * Two shapes behind one switch, and which one fires is decided by whether a campaign
   * EXISTS for the (offer, funnel, channel):
   *   - it does  -> `PATCH /campaigns/:id` with activate | stop, the status flip.
   *   - it does not -> `POST /campaigns`, which creates it and hands it back started.
   *
   * The second is the whole point of this card growing a switch. Since campaign-service
   * deleted provisioning from a funded ceiling (2026-09-06, "money starts nothing"), a
   * channel funded after the onboarding launch has no campaign and never will until a
   * person makes one, and no surface in the customer dashboard could.
   *
   * The workflow is resolved LAZILY, inside the mutation rather than on a poll: it is
   * needed once per start, so fetching it per channel on every render of this card would
   * be one extra read per channel per visit for a value almost nobody uses. It is
   * features-service's own recommendation for THIS funnel (`funnel`, never `goal`: the
   * two meeting funnels both echo `meetingBooked`, so a goal-keyed request prices and
   * ranks across both at once).
   *
   * The starts run in SEQUENCE, like the budget writes: each one creates a campaign and
   * fires its workflow, and two concurrent creates on one identity is the shape that
   * produced duplicate live campaigns in production.
   */
  const statusMutation = useMutation({
    mutationFn: async (vars: {
      def: SalesFunnelDef;
      moves: { featureSlug: string; channelName: string; next: boolean; campaignId: string | null }[];
    }) => {
      for (const move of vars.moves) {
        if (move.campaignId) {
          await setCampaignStatus(move.campaignId, move.next ? "activate" : "stop", {
            brandId,
            featureSlug: move.featureSlug,
          });
          continue;
        }
        // No campaign to address, so turning it OFF is already true and turning it ON
        // means creating one. A pause on a channel with no campaign is a no-op rather
        // than an error: there is nothing running to stop.
        if (!move.next) continue;
        const ladder = await getWorkflowProjectionLadder({
          featureSlug: move.featureSlug,
          brandId,
          funnel: vars.def.key,
        });
        const workflowDynastySlug = startableWorkflowDynastySlug(
          ladder.recommendedWorkflowDynastySlug,
        );
        if (!workflowDynastySlug) {
          // features-service names no workflow for this (channel, funnel), so there is
          // nothing to run. Picking one here would be a second opinion over the producer
          // that owns the answer, and it would create a campaign that does nothing.
          throw new ChannelStartRefusal(
            `${move.channelName} has no workflow ready for this funnel yet, so there is nothing to start.`,
          );
        }
        const [inputs, channels] = await Promise.all([
          buildFeatureInputs(move.featureSlug),
          // Best-effort, exactly as the onboarding launch treats it: a campaign that
          // states no leg is read as every campaign created before the column existed,
          // and inventing one would file it under an arrow nobody bought.
          getPublicChannels().catch((err) => {
            console.error("[dashboard] could not read the channel catalogue for the leg", err);
            return null;
          }),
        ]);
        await startFunnelChannelCampaign({
          // The CHANNEL is in the name, because campaign-service refuses a name the org
          // already holds and a funnel is routinely sold through more than one channel.
          // Named for the funnel alone, starting a second channel of a funnel answers
          // `409 A campaign with this name already exists` — so the funnel this page
          // exists to fund could be started once and never completed. It is also what a
          // campaign IS: offer x funnel x channel, and the name now says two of the
          // three rather than one.
          name: `${brand?.name ?? brandDomain ?? "Brand"} — ${vars.def.name} (${move.channelName})`,
          brandId,
          featureSlug: move.featureSlug,
          featureInputs: inputs,
          funnelKey: vars.def.key,
          workflowDynastySlug,
          offerId,
          legKey: launchLegKey(channels, move.featureSlug, vars.def),
        });
      }
    },
    onSuccess: (_res, vars) => {
      // Whether a channel runs moves the running total, the campaign rows and every
      // figure derived from them, so they are re-read at once rather than waiting for
      // their own next poll. `["campaigns", brandId]` is in that set, which is what
      // re-seeds the switches from campaign-service's own answer.
      invalidateCampaignMoney(queryClient);
      seededStatusFrom.current = null;
      patch(vars.def.key, { error: null });
    },
    onError: (err, vars) => {
      console.error("[dashboard] channel status write failed", err);
      patch(vars.def.key, {
        error: channelWriteErrorMessage(err, vars.moves.some((m) => m.next) ? "start" : "pause"),
      });
    },
  });

  const undeclareMutation = useMutation({
    mutationFn: (vars: { def: SalesFunnelDef }) =>
      undeclareOfferSalesFunnel(brandId, offerId, vars.def.key),
    onSuccess: (set, vars) => {
      queryClient.setQueryData(["offerSalesFunnels", brandId, offerId], set);
      // Dropping a funnel changes which ones the offer sells and what its campaigns
      // may spend, so those surfaces are re-read now.
      invalidateCampaignMoney(queryClient);
      // Switching a funnel off KEEPS its row and every number on it, so the form
      // keeps showing what the user entered — switching it back on returns that,
      // instead of an empty form they would have to retype.
      const kept = set.funnels.find((f) => f.funnelKey === vars.def.key);
      patch(vars.def.key, {
        declared: false,
        saved: kept ?? NOTHING_DECLARED,
        touched: false,
        draft: kept
          ? funnelDraftFromDeclared(vars.def, kept)
          : funnelDraftFromBrand(
              vars.def,
              econData?.salesEconomics ?? null,
              brand?.clickDestinationUrl ?? null,
            ),
        error: null,
      });
      setOpenKey(null);
    },
    onError: (err, vars) => {
      console.error("[dashboard] undeclareOfferSalesFunnel failed", err);
      patch(vars.def.key, { error: funnelWriteErrorMessage(err) });
    },
    onSettled: () => setPendingKey(null),
  });

  /**
   * The feature inputs a new campaign is created with, resolved the SAME way the
   * onboarding launch resolves them: the channel's own declared input keys, filled
   * from features-service's prefill for this brand.
   *
   * Cached per channel for the life of the card, because a customer starting two
   * channels of one funnel in one Save would otherwise prefill twice for the same
   * brand. Only keys the prefill actually answered are sent: an empty string is not an
   * answer, and api-service validates by key-presence.
   *
   * It names THIS OFFER, and that is what makes a Start work at all for a brand selling
   * more than one thing. The keys this fills are the offer's own words — the ask, the
   * value proposition, the proof — so brand-service refuses a brand-scoped extraction
   * for such a brand (409 SEVERAL_OFFERS) rather than serving another proposition's
   * copy. Unnamed, that 409 surfaced as a 502 and the campaign was never created: 21 of
   * 144 brands could not start a channel from this page at all. The cache is keyed on
   * the pair for the same reason — one channel's inputs are a different answer per
   * offer.
   */
  const featureInputsRef = useRef<Record<string, Record<string, string>>>({});
  async function buildFeatureInputs(featureSlug: string): Promise<Record<string, string>> {
    const cacheKey = `${featureSlug}|${offerId}`;
    const cached = featureInputsRef.current[cacheKey];
    if (cached) return cached;
    const [{ feature }, prefill] = await Promise.all([
      getFeature(featureSlug),
      prefillFeatureInputs(featureSlug, [brandId], offerId),
    ]);
    const prefilled = prefillToStringMap(prefill.prefilled);
    const out: Record<string, string> = {};
    for (const input of feature.inputs ?? []) {
      const value = prefilled[input.key]?.trim();
      if (value) out[input.key] = value;
    }
    featureInputsRef.current[cacheKey] = out;
    return out;
  }

  /** Flip one channel's switch in the DRAFT. Nothing is written until Save. */
  function toggleChannel(key: SalesFunnelKey, featureSlug: string) {
    setStates((prev) => {
      const state = prev[key];
      const saved = state.savedRunningByChannel[featureSlug] ?? false;
      const current = state.runningByChannel[featureSlug] ?? saved;
      return {
        ...prev,
        [key]: {
          ...state,
          touched: true,
          error: null,
          runningByChannel: { ...state.runningByChannel, [featureSlug]: !current },
        },
      };
    });
  }

  function patch(key: SalesFunnelKey, update: Partial<FunnelState>) {
    setStates((prev) => ({ ...prev, [key]: { ...prev[key], ...update } }));
  }

  function editDraft(key: SalesFunnelKey, update: Partial<FunnelDraft>) {
    setStates((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        touched: true,
        error: null,
        draft: { ...prev[key].draft, ...update },
      },
    }));
  }

  function normalizeLtr(key: SalesFunnelKey) {
    const parsed = parseLocaleNumberInput(states[key].draft.lifetimeRevenueUsd);
    if (parsed === null) return;
    editDraft(key, { lifetimeRevenueUsd: formatLocaleInteger(parsed) });
  }

  function openCard(def: SalesFunnelDef, locked: boolean) {
    if (locked) return;
    patch(def.key, { error: null });
    setOpenKey(def.key);
  }

  /** Whole dollars typed for one channel of a funnel. Blank reads as unfunded. */
  function channelUsdOf(key: SalesFunnelKey, featureSlug: string): number {
    const parsed = parseLocaleNumberInput(
      (states[key].budgetUsdByChannel[featureSlug] ?? "").trim(),
    );
    return parsed === null ? 0 : Math.max(0, Math.round(parsed));
  }

  /**
   * Whether ONE channel's switch reads ON, once its typed budget is taken into
   * account.
   *
   * A channel funded at NOTHING does not send: campaign-service holds its campaign
   * on the funding gate every tick and never hands it a turn. So taking the amount
   * to zero pauses it, and the same Save writes both. The switch and the write read
   * this one expression, or the row shows a channel as running while the Save
   * pauses it. The inverse does not hold — funding a paused channel does not start
   * it; `channelStartBlocker` already refuses to start one at zero.
   */
  function channelRunningAfterBudget(key: SalesFunnelKey, featureSlug: string): boolean {
    const state = states[key];
    const saved = state.savedRunningByChannel[featureSlug] ?? false;
    return runningAfterBudget({
      running: state.runningByChannel[featureSlug] ?? saved,
      nextCents: channelUsdOf(key, featureSlug) * 100,
      savedCents: state.savedCentsByChannel[featureSlug] ?? 0,
    });
  }

  /**
   * What billing funds each of this funnel's channels at ACROSS EVERY OFFER —
   * the grain the channel's floor binds, so it is what a typed figure is checked
   * against. The per-channel figures the form EDITS are this offer's own share.
   */
  function pairCentsFor(key: SalesFunnelKey): Record<string, number> {
    return funnelPairCents(
      key,
      channelsForFunnel(key, features),
      budgetData?.channels,
      states[key].savedBudgetCents,
    );
  }

  /** What each of this funnel's channels is typed at, keyed on the feature slug. */
  function typedUsdByChannel(key: SalesFunnelKey): Record<string, number> {
    const out: Record<string, number> = {};
    for (const channel of channelsForFunnel(key, features)) {
      out[channel.featureSlug] = channelUsdOf(key, channel.featureSlug);
    }
    return out;
  }

  /** Has the campaigns read answered? Settled = resolved OR errored, never "succeeded". */
  const campaignsSettled = campaignsQ.data !== undefined || campaignsQ.isError;

  /**
   * What each channel of this funnel is DOING right now, keyed on the feature slug.
   *
   * campaign-service's own word plus whether a campaign exists at all, through the ONE
   * shared resolver both this card and the funnel board read: a channel cannot say
   * "Running" on one screen and "Paused" on the other for the same offer and funnel,
   * which is exactly what it did while a funded ceiling stood in for the verdict.
   */
  function runStateOf(key: SalesFunnelKey, featureSlug: string): ChannelRunState {
    return channelRunState({
      settled: campaignsSettled,
      campaignId: states[key].campaignIdByChannel[featureSlug] ?? null,
      running: states[key].savedRunningByChannel[featureSlug] ?? false,
    });
  }

  /**
   * The switches that MOVED, as a live compare against what campaign-service reports,
   * never a sticky flag: flipping a switch and flipping it back has to disarm Save.
   *
   * `kind` separates a CREATE from a status flip, which is what the sentence above the
   * button needs to say and what the mutation branches on. Nothing moves while the
   * campaigns read is unsettled: a draft built against a baseline we do not have would
   * write a status nobody chose.
   */
  function statusMovesFor(
    def: SalesFunnelDef,
  ): { featureSlug: string; channelName: string; next: boolean; kind: ChannelStatusMove["kind"] }[] {
    if (!campaignsSettled) return [];
    const state = states[def.key];
    const out: {
      featureSlug: string;
      channelName: string;
      next: boolean;
      kind: ChannelStatusMove["kind"];
    }[] = [];
    for (const channel of channelsForFunnel(def.key, features)) {
      const slug = channel.featureSlug;
      const saved = state.savedRunningByChannel[slug] ?? false;
      const next = channelRunningAfterBudget(def.key, slug);
      if (next === saved) continue;
      out.push({
        featureSlug: slug,
        channelName: channel.name,
        next,
        kind: !next ? "pause" : state.campaignIdByChannel[slug] ? "restart" : "start",
      });
    }
    return out;
  }

  function confirm(def: SalesFunnelDef) {
    const state = states[def.key];
    // The patch is diffed against what is stored, so a set we could not read is
    // a set we must not write over: every field would look changed and a prefill
    // nobody confirmed would land on top of values the brand already declared.
    if (funnelData === undefined || budgetData === undefined) {
      patch(def.key, { error: "Could not load your funnels. Reload the page and try again." });
      return;
    }
    const result = validateFunnelDraft(def, state.draft, brandDomain);
    if (!result.ok) {
      patch(def.key, { error: result.error });
      return;
    }
    // Zero is legal — it is how a channel is put down without forgetting how the
    // funnel sells. A FUNDED one below its floor is not: that budget cannot buy a
    // single outcome, so the channel would sit still and look broken instead.
    //
    // The floor is the CHANNEL's own published operating cost, so each channel is
    // judged on its own money — a sibling channel's spend has nothing to say about
    // whether this one can run. What it binds is the (funnel, channel) PAIR's total
    // ACROSS OFFERS, which is billing's own grain: a customer splitting one funded
    // pair across two offers must not be refused for each half being under a bar
    // the whole clears. So the projection holds the sibling offers constant.
    //
    // What the brand is ALREADY funded at is part of the question. A pair carried
    // under its floor keeps that figure and may be raised; the gate would otherwise
    // refuse the whole form, so editing a conversion rate on such a funnel was
    // impossible. billing holds the same rule against the same published figure and
    // its 400 is what decides — a floor we could not read refuses nothing here.
    const usdByChannel = typedUsdByChannel(def.key);
    // A channel cannot be turned ON with no ceiling: campaign-service holds such a
    // campaign on the funding gate every tick, so the create would produce a campaign
    // that exists and never sends. Refused HERE rather than sent, and the customer is
    // told to fund it rather than left with a switch that silently achieved nothing.
    for (const move of statusMovesFor(def)) {
      if (!move.next) continue;
      const blocker = channelStartBlocker({
        state: runStateOf(def.key, move.featureSlug),
        typedCents: (usdByChannel[move.featureSlug] ?? 0) * 100,
      });
      if (blocker) {
        patch(def.key, { error: `${move.channelName}: ${blocker}` });
        return;
      }
    }
    const pairCents = pairCentsFor(def.key);
    for (const channel of channelsForFunnel(def.key, features)) {
      const slug = channel.featureSlug;
      const minimumCents = channelMinimumCents(minimums, slug);
      if (minimumCents === null) continue;
      const pair = pairCents[slug] ?? 0;
      const projected = projectedPairTotalUsd(
        pair,
        state.savedCentsByChannel[slug] ?? 0,
        usdByChannel[slug] ?? 0,
      );
      if (channelBudgetBelowMinimum(minimumCents, projected, pair)) {
        patch(def.key, { error: channelBudgetFloorMessage(channel.name, minimumCents, pair) });
        return;
      }
    }
    // Conversion rates are the BRAND's now (one rate per funnel arrow, stated on
    // Brand Settings), so this offer-level card never writes one. The patch still
    // carries the offer's own fields: lifetime revenue, destination, booking link.
    const { rates: _offerRates, ...body } = buildFunnelPatch(def, state.draft, state.saved);
    // An already-declared funnel with nothing changed has no write to make; an
    // undeclared one is still declared, with a body that prices nothing yet.
    // Two services, so two writes. The ceiling only goes when it MOVED: billing
    // rejects a value below the floor, and re-sending an unchanged one would
    // turn a rate edit into a money write for no reason. This runs BEFORE the
    // nothing-changed exit below, because a budget edit alone is a real change
    // even when the economics are untouched.
    // Only the channels that MOVED are written, so funding one offer never
    // re-states its sibling's ceiling.
    const moves = Object.entries(usdByChannel)
      .map(([featureSlug, usd]) => ({ featureSlug, cents: usd * 100 }))
      .filter((m) => m.cents !== (state.savedCentsByChannel[m.featureSlug] ?? 0));
    if (moves.length > 0) budgetMutation.mutate({ def, moves });

    // The STATUS, campaign-service's own. Only the switches that MOVED travel, so
    // editing a conversion rate never touches whether anything runs, which is the whole
    // separation this card was missing: Update used to write fields and money and say
    // nothing about the one fact a customer was actually waiting on.
    //
    // Ordered BEFORE the nothing-changed exit for the same reason the budget is: a
    // switch flipped on an otherwise untouched funnel is a real change.
    const statusMoves = statusMovesFor(def);
    if (statusMoves.length > 0) {
      statusMutation.mutate({
        def,
        moves: statusMoves.map((m) => ({
          featureSlug: m.featureSlug,
          channelName: m.channelName,
          next: m.next,
          campaignId: state.campaignIdByChannel[m.featureSlug] ?? null,
        })),
      });
    }

    if (state.declared && isEmptyFunnelPatch(body)) {
      patch(def.key, { touched: false, error: null });
      setOpenKey(null);
      return;
    }
    patch(def.key, { error: null });
    setPendingKey(def.key);
    declareMutation.mutate({ def, patch: body });
  }

  function removeFunnel(def: SalesFunnelDef) {
    patch(def.key, { error: null });
    setPendingKey(def.key);
    undeclareMutation.mutate({ def });
  }

  const { selected, unselected } = partitionFunnelsBySelection((key) => states[key].declared);
  // A brand that has ANSWERED keeps at least one funnel on — brand-service refuses
  // to switch off the last active one — so a brand with rows and none of them
  // selected is one that switched them all off between reads, not one that stated
  // it sells through nothing. That second answer is unreachable now, which is what
  // retired the `declared` flag: an empty list means "never told us", full stop.
  const hasStoredFunnels = (funnelData?.funnels.length ?? 0) > 0;

  function renderFunnel(def: SalesFunnelDef) {
    const state = states[def.key];
    const locked = def.requiresWebsite && noWebsite;
    const isOpen = openKey === def.key;
    const saving = pendingKey === def.key;
    // A funnel the brand has not declared shows what it IS, and nothing else.
    // Its numbers are a prefill nobody has confirmed, and printing them on a row
    // the brand never picked reads as a claim about how it sells.
    const showNumbers = state.declared || isOpen;
    const chips = showNumbers ? funnelDestinationChips(def, state.draft) : [];
    const lifetime = showNumbers ? funnelLifetimeLabel(state.draft) : null;
    const dimmed = !state.declared && !isOpen;
    // What this offer funds the funnel at — the sum of the very figures the open
    // form edits, so the closed card and the open one cannot disagree. It says
    // whether a ceiling EXISTS, never what is being spent: billing stores no
    // status, so this counts a paused channel exactly like a running one.
    const offerFundedCents = offerFunnelTotalCents(state.savedCentsByChannel);
    // Whether campaign-service holds a campaign for ANY channel of this funnel, which
    // is what separates "stopped" from "never launched" on the closed card.
    const funnelHasAnyCampaign = Object.values(state.campaignIdByChannel).some((id) => id !== null);
    // Paused by billing over a declined card rather than by a person, which the
    // closed card states instead of a plain "Paused".
    const funnelDeclined = Object.values(state.declinedByChannel).some(Boolean);
    const statusSummary = channelStatusSummary(
      statusMovesFor(def).map((m) => ({ channelName: m.channelName, kind: m.kind })),
    );
    // What billing funds each channel of this funnel at ACROSS EVERY OFFER — the
    // grain the channel's floor binds, so it is what each row's own hint states.
    const channelPairCents = pairCentsFor(def.key);
    // ...and what is actually spent today, which is the campaigns campaign-service
    // reports as RUNNING for this funnel of this offer. Narrowed with the same one
    // exported rule the funnels TABLE one level up reads, on the normalized funnel
    // key — the wire carries two spellings of every funnel, so matching the raw
    // string reads empty for whichever half the producer is emitting. `null` while
    // the read is in flight or has failed, deliberately NOT zero: "we could not
    // measure this" and "this funnel spends nothing" are different statements, and
    // the tag renders nothing at all for the first rather than claiming the second.
    const runningCents =
      spendableQ.data === undefined
        ? null
        : spendableCampaignsForFunnel(spendableQ.data, def.key, offerId).reduce(
            (sum, c) => sum + c.runningDailyBudgetCents,
            0,
          );

    const header = (
      <div className="flex items-start gap-3 p-4">
        <SalesFunnelMark def={def} dimmed={dimmed} />

        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium ${
              locked ? "text-gray-400" : dimmed ? "text-gray-500" : "text-gray-900"
            }`}
          >
            {def.name}
          </p>

          {/* The funnel, kept quieter than the name. Once the funnel is chosen,
              each arrow carries the rate for that leg and the lifetime revenue
              closes the funnel, where the last step earns it. */}
          <p className="mt-0.5 flex flex-wrap items-start gap-x-1.5 text-xs text-gray-500">
            {def.steps.map((step, i) => {
              return (
                <span key={step} className="inline-flex items-start gap-1.5">
                  {i > 0 && (
                    <span className="leading-5 text-gray-300">→</span>
                  )}
                  <span className="leading-5">{step}</span>
                </span>
              );
            })}
            {lifetime && (
              <span className="inline-flex items-start gap-1.5">
                <span className="leading-5 text-gray-300">·</span>
                <span className="leading-5 text-gray-400">{lifetime}</span>
              </span>
            )}
          </p>

          {locked && (
            <p className="mt-1 text-xs text-gray-400">
              Needs a website. Set your domain in Brand Settings first.
            </p>
          )}

          {chips.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
              {chips.map((chip, i) => (
                <span
                  key={`${chip.kind}-${i}`}
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 sm:max-w-md"
                >
                  {i > 0 && <span className="text-gray-300">·</span>}
                  <BrandLogo
                    domain={chip.host}
                    size={14}
                    className="shrink-0 rounded-sm"
                    fallbackClassName="shrink-0 text-gray-300"
                  />
                  <span className="truncate">{chip.label}</span>
                </span>
              ))}
            </p>
          )}
        </div>

        {/* What the brand is spending on this funnel, not merely that it picked
            it: the money IS the selection now. A declared funnel at zero is one
            it has described but is not paying for, and it says so rather than
            wearing a green tag that claims it runs.

            It states what THIS OFFER funds, which is what the fields inside the
            card edit. billing's own funnel figure spans every offer selling the
            funnel, so on this page it would name money the reader can neither
            see nor change — a tag reading more than the fields under it add up
            to, with both correct. The funnel-wide figure still governs the
            product minimum below, which is the one thing that really does bind
            across offers. */}
        {state.declared && !isOpen && runningCents !== null && (
          runningCents > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
              <CheckCircleIcon className="h-3.5 w-3.5" />
              ${Math.round(runningCents / 100).toLocaleString("en-US")}/day
            </span>
          ) : offerFundedCents > 0 ? (
            // Funded and not running is its own answer, and it is the one the old tag
            // got wrong in both directions: it summed the paused ceiling into the
            // green figure, and a funnel whose every channel was paused read "Not
            // funded" although the customer's amounts are all still there. Restart
            // it and it spends that money again — nothing to re-enter.
            //
            // Which of the two words depends on whether a campaign EXISTS, never on
            // the money: a funnel funded after the onboarding launch has none at all
            // (campaign-service stopped provisioning from a ceiling on 2026-09-06), and
            // calling that "Paused" sends the customer looking for a switch that was
            // never flipped. Open the card and the switch is there.
            funnelDeclined ? (
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-xs font-medium ${PAYMENT_DECLINED_STYLE}`}
              >
                {PAYMENT_DECLINED_LABEL}
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                {funnelHasAnyCampaign ? "Paused" : "Not started"}
              </span>
            )
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
              Not funded
            </span>
          )
        )}
      </div>
    );

    return (
      <li
        key={def.key}
        className={`rounded-xl border transition ${
          isOpen
            ? "border-gray-300 bg-white shadow-sm"
            : state.declared
              ? "border-gray-200 bg-white"
              : "border-gray-200 bg-gray-50"
        }`}
      >
        {isOpen ? (
          header
        ) : (
          // The whole card is the affordance: a funnel is opened by clicking it
          // anywhere, not by finding a control on it. Rendered as a span with a
          // button role because the open form it reveals contains its own
          // buttons, which a real <button> cannot legally wrap.
          <div
            role="button"
            tabIndex={locked ? -1 : 0}
            aria-expanded={false}
            aria-disabled={locked}
            onClick={() => openCard(def, locked)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              openCard(def, locked);
            }}
            // The hover has to differ from the card's own resting tint, or an
            // unselected card (already gray-50) shows no response to the cursor.
            className={`rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
              locked
                ? "cursor-not-allowed"
                : state.declared
                  ? "cursor-pointer hover:bg-gray-50"
                  : "cursor-pointer hover:bg-gray-100"
            }`}
          >
            {header}
          </div>
        )}

        {isOpen && (
          <div className="border-t border-gray-100 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                  Customer Lifetime Revenue
                  <InfoTooltip
                    tip="Average total revenue (not gross margin) one customer won through this funnel brings over their lifetime."
                    placement="top"
                  />
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={state.draft.lifetimeRevenueUsd}
                    onChange={(e) =>
                      editDraft(def.key, {
                        lifetimeRevenueUsd: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    onBlur={() => normalizeLtr(def.key)}
                    className="w-full rounded-lg border border-gray-200 py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
              </div>

              {def.pageDestination && (
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                    Destination page
                    <InfoTooltip
                      tip="The page on your site an outreach click lands on."
                      placement="top"
                    />
                  </label>
                  <input
                    type="url"
                    inputMode="url"
                    value={state.draft.destinationUrl}
                    placeholder="https://yoursite.com/pricing"
                    onChange={(e) => editDraft(def.key, { destinationUrl: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
              )}

              {def.bookingLink && (
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                    Booking link (optional)
                    <InfoTooltip
                      tip="The scheduling page a lead opens to pick a slot. Leave it empty if you book over email."
                      placement="top"
                    />
                  </label>
                  <input
                    type="url"
                    inputMode="url"
                    value={state.draft.bookingUrl}
                    placeholder="https://cal.com/yourteam/30min"
                    onChange={(e) => editDraft(def.key, { bookingUrl: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
              )}
            </div>

            {/* The money, one ceiling per acquisition channel this funnel can be
                sold through. Whole dollars, never cents — a daily budget is a
                configured ceiling, not a charge. Empty means that channel is not
                funded, which is how one offer is put down without forgetting how
                the funnel sells: every number above stays as it is, and the
                funnel's other channels keep running.

                Funding a channel is NOT starting it, which is why each row
                carries a switch beside its amount. It used to: campaign-service
                provisioned a campaign for any funded pair on its own tick, so the
                amount really did say everything. That was deleted on 2026-09-06
                ("money starts nothing") after reading a ceiling as intent brought
                back campaigns customers had deliberately stopped — so a channel
                funded here now has no campaign at all until a person starts one,
                and this card was the surface with no way to say so or to act.

                The two are committed by ONE Save and diffed separately, so editing
                a rate never touches what runs and flipping a switch never restates
                a rate.

                It sits BELOW the funnel's own inputs, full width, one row per
                channel — a channel is a thing the brand funds and runs, not a
                field, and squeezed into a quarter of the input grid the mark, the
                name, the amount and the switch had no room to read as one line. */}
            <div className="mt-5 border-t border-gray-100 pt-4">
              <label className="mb-2 flex items-center gap-1 text-xs text-gray-500">
                Channels, and what each may spend a day
                <InfoTooltip
                  tip="One ceiling per channel this funnel sells through, and a switch for whether it runs. Funding a channel does not start it: the switch does. Leave an amount empty to stop funding a channel, and nothing else about it is lost."
                  placement="top"
                />
              </label>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {channelsForFunnel(def.key, features).map((channel) => {
                  // The floor is the CHANNEL's own published operating cost, so each
                  // row states its own rather than one figure standing for every
                  // channel of the funnel. A channel whose terms we could not read
                  // states nothing: the figure is the channel's to publish, and there
                  // is nothing honest to write in its place.
                  const hint = channelBudgetHint(
                    channelMinimumCents(minimums, channel.featureSlug),
                    channelPairCents[channel.featureSlug] ?? 0,
                  );
                  const runState = runStateOf(def.key, channel.featureSlug);
                  const savedRunning = state.savedRunningByChannel[channel.featureSlug] ?? false;
                  const nextRunning = channelRunningAfterBudget(def.key, channel.featureSlug);
                  // Forced OFF by a zero amount rather than by the switch: the
                  // control is disabled and the field beside it is what turns it
                  // back on, so a customer is never handed a switch that cannot move.
                  const zeroedOff =
                    (state.runningByChannel[channel.featureSlug] ?? savedRunning) && !nextRunning;
                  return (
                  // Two lines on a phone, one from `sm:` up. The row carries four
                  // things now and they do not fit a phone side by side: measured at
                  // 412px the name had 33px left and every channel read "Sales ...",
                  // "AI ...", "Yo..." — the identity of the row destroyed to make room
                  // for the controls that act on it. Stacked, the name gets the full
                  // width and the amount and the switch share the line below it.
                  <li
                    key={channel.featureSlug}
                    className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <AcquisitionChannelMark def={channel} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-gray-700">{channel.name}</span>
                        {zeroedOff ? (
                          <span className="block truncate text-xs text-gray-500">
                            $0 a day pauses it. Give it an amount to run it.
                          </span>
                        ) : (
                          hint && (
                            <span className="block truncate text-xs text-gray-400">{hint}</span>
                          )
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                    <div className="relative w-32 shrink-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        $
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Daily budget for ${channel.name}`}
                        value={state.budgetUsdByChannel[channel.featureSlug] ?? ""}
                        onChange={(e) =>
                          patch(def.key, {
                            budgetUsdByChannel: {
                              ...state.budgetUsdByChannel,
                              [channel.featureSlug]: e.target.value.replace(/\D/g, ""),
                            },
                            touched: true,
                            error: null,
                          })
                        }
                        placeholder="0"
                        className="w-full rounded-lg border border-gray-200 py-2 pl-7 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        /day
                      </span>
                    </div>
                    {/* Whether it RUNS, which the amount beside it does not say.
                        A skeleton while campaign-service has not answered: a
                        switch is a claim about what is happening, and drawing one
                        in either position before we know is a guess dressed as a
                        state. */}
                    {runState === "unknown" ? (
                      <Skeleton className="h-6 w-24 shrink-0 rounded-full" />
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={nextRunning}
                        aria-label={`${nextRunning ? "Stop" : "Start"} ${channel.name}`}
                        onClick={() => toggleChannel(def.key, channel.featureSlug)}
                        disabled={saving || zeroedOff}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
                          nextRunning
                            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 rounded-full ${
                            nextRunning ? "bg-green-600" : "bg-gray-400"
                          }`}
                        />
                        {/* What it will BE once Save lands when the switch has
                            moved, and what it IS when it has not. A switch that
                            reads the saved word while sitting in the drafted
                            position is one control saying two things. */}
                        {nextRunning === savedRunning
                          ? CHANNEL_RUN_STATE_LABEL[runState]
                          : nextRunning
                            ? "Start"
                            : "Pause"}
                      </button>
                    )}
                    </div>
                  </li>
                  );
                })}
              </ul>
            </div>

            {/* What Save is about to do to what RUNS, said before it does it.
                Starting fires the workflow immediately rather than at the next
                daily tick, so a customer who thought they were scheduling
                something for tomorrow reads it here and not in their billing. */}
            {statusSummary && <p className="mt-4 text-sm text-gray-600">{statusSummary}</p>}

            {state.error && <p className="mt-4 text-sm text-red-600">{state.error}</p>}

            {/* Actions sit on the right on desktop, and dropping a funnel is a
                named button rather than a control you can hit by accident. */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => setOpenKey(null)}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 disabled:opacity-40"
              >
                Cancel
              </button>
              {state.declared && (
                <button
                  type="button"
                  onClick={() => removeFunnel(def)}
                  disabled={saving}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                >
                  Remove this funnel
                </button>
              )}
              {/* The in-flight label stays at full opacity: fading the very word
                  that signals work reads as a dead button. */}
              <button
                type="button"
                onClick={() => confirm(def)}
                disabled={saving}
                className={`rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-600 ${
                  saving ? "cursor-wait" : ""
                }`}
              >
                {saving ? "Saving…" : state.declared ? "Update" : "OK"}
              </button>
            </div>
          </div>
        )}
      </li>
    );
  }

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Sales Funnels</h2>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="mb-5 text-sm text-gray-500">
          Pick every funnel you sell through. Each one keeps its own conversion rates,
          lifetime revenue and landing page, and the ones you pick are what your
          campaigns optimize for.
        </p>

        {selected.length > 0 && <ul className="space-y-3">{selected.map(renderFunnel)}</ul>}

        {unselected.length > 0 && (
          <>
            {selected.length > 0 && (
              <p className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-gray-400">
                Not selected
              </p>
            )}
            <ul className="space-y-3">{unselected.map(renderFunnel)}</ul>
          </>
        )}

        {/* Having switched every funnel off and having never answered are
            different states, so they read differently. Neither is rendered as
            the other, and the first keeps every number the user entered. */}
        {selected.length === 0 && (
          <p className="mt-4 text-xs text-gray-400">
            {hasStoredFunnels
              ? "Every path is switched off. Turn one back on and it returns with the numbers you gave it."
              : "Pick at least one funnel to describe how a lead becomes a paid client."}
          </p>
        )}
      </div>

      {activation && (
        <FunnelActivationModal
          brandId={brandId}
          funnelKey={activation.funnelKey}
          lifetimeRevenueUsd={activation.lifetimeRevenueUsd}
          bookingUrl={activation.bookingUrl}
          onClose={closeActivation}
        />
      )}
    </section>
  );
}
