"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import { useMutation } from "@tanstack/react-query";
import {
  declareOfferSalesFunnel,
  getBrand,
  getBrandSalesEconomics,
  getOfferSalesFunnels,
  getBrandFunnelBudgets,
  saveBrandFunnelBudget,
  undeclareOfferSalesFunnel,
  type BrandSalesFunnelSet,
  type DeclaredSalesFunnel,
} from "@/lib/api";
import { useFeatures } from "@/lib/features-context";
import {
  channelsForFunnel,
  funnelChannelBudgets,
  offerFunnelTotalCents,
  typedFunnelTotalUsd,
} from "@/lib/funnel-channels";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import {
  NOTHING_DECLARED,
  SALES_FUNNELS,
  buildFunnelPatch,
  funnelBudgetBelowMinimum,
  funnelBudgetFloorMessage,
  funnelBudgetTip,
  funnelDestinationChips,
  funnelDraftFromBrand,
  funnelDraftFromDeclared,
  funnelLegPct,
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
  formatLocaleNumberInputValue,
  parseLocaleNumberInput,
} from "@/lib/format-number";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
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

  // Which channels each funnel may be sold through is features-service's own
  // statement, carried on the feature list the app already fetches — so this
  // dedupes on the shared `["features"]` key rather than adding a read.
  const { features } = useFeatures();

  const brand = brandData?.brand ?? null;
  const brandDomain = brand?.domain ?? null;
  // Only true once the brand resolved, so a load flash cannot lock the visit-led
  // funnels on a brand that does have a website.
  const noWebsite = !!brand && brand.url == null;

  const [states, setStates] = useState<Record<SalesFunnelKey, FunnelState>>(initialStates);
  // One card open at a time: the list reorders itself around the selection, so
  // several open forms would move under the cursor.
  const [openKey, setOpenKey] = useState<SalesFunnelKey | null>(null);
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
      cacheDeclared(res.funnel);
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

  const undeclareMutation = useMutation({
    mutationFn: (vars: { def: SalesFunnelDef }) =>
      undeclareOfferSalesFunnel(brandId, offerId, vars.def.key),
    onSuccess: (set, vars) => {
      queryClient.setQueryData(["offerSalesFunnels", brandId, offerId], set);
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

  function editRate(key: SalesFunnelKey, rateKey: FunnelRateKey, value: string) {
    setStates((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        touched: true,
        error: null,
        draft: { ...prev[key].draft, rates: { ...prev[key].draft.rates, [rateKey]: value } },
      },
    }));
  }

  function normalizeRate(key: SalesFunnelKey, rateKey: FunnelRateKey) {
    const parsed = parseLocaleNumberInput(states[key].draft.rates[rateKey] ?? "");
    if (parsed === null) return;
    editRate(key, rateKey, formatLocaleNumberInputValue(parsed));
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

  /** What each of this funnel's channels is typed at, keyed on the feature slug. */
  function typedUsdByChannel(key: SalesFunnelKey): Record<string, number> {
    const out: Record<string, number> = {};
    for (const channel of channelsForFunnel(key, features)) {
      out[channel.featureSlug] = channelUsdOf(key, channel.featureSlug);
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
    // Zero is legal — it is how a funnel is put down without forgetting how it
    // sells. A FUNDED one below its floor is not: that budget cannot buy a
    // single outcome, so the funnel would sit still and look broken instead.
    //
    // What the brand is ALREADY funded at is part of the question. A funnel
    // carried under its floor by the per-funnel attribution keeps that figure
    // and may be raised; the gate would otherwise refuse the whole form, so
    // editing a conversion rate on such a funnel was impossible.
    //
    // The floor binds the funnel TOTAL, never one channel: a customer splitting
    // one funded funnel across two offers must not be refused for each half
    // being under a bar the whole clears. billing holds the same rule and its
    // 400 is what decides.
    const usdByChannel = typedUsdByChannel(def.key);
    const budgetUsd = typedFunnelTotalUsd(usdByChannel);
    if (funnelBudgetBelowMinimum(def.key, budgetUsd, state.savedBudgetCents)) {
      patch(def.key, { error: funnelBudgetFloorMessage(def.key, state.savedBudgetCents) });
      return;
    }
    const body = buildFunnelPatch(def, state.draft, state.saved);
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
    const rateFields = funnelRateFields(def);
    const dimmed = !state.declared && !isOpen;
    // What this offer funds the funnel at — the sum of the very figures the open
    // form edits, so the closed card and the open one cannot disagree.
    const offerFundedCents = offerFunnelTotalCents(state.savedCentsByChannel);

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
              const pct = i > 0 && showNumbers ? funnelLegPct(def, state.draft, i - 1) : null;
              return (
                <span key={step} className="inline-flex items-start gap-1.5">
                  {i > 0 && (
                    <span className="inline-flex flex-col items-center">
                      <span className="leading-5 text-gray-300">→</span>
                      {pct && (
                        <span className="-mt-0.5 text-[10px] leading-none text-gray-400">{pct}</span>
                      )}
                    </span>
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
        {state.declared && !isOpen && (
          offerFundedCents > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
              <CheckCircleIcon className="h-3.5 w-3.5" />
              ${Math.round(offerFundedCents / 100).toLocaleString("en-US")}/day
            </span>
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
              {rateFields.map((rate) => (
                <div key={rate.key}>
                  <label className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                    {rate.label}
                    <InfoTooltip tip={rate.tip} placement="top" />
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={state.draft.rates[rate.key] ?? ""}
                      onChange={(e) => editRate(def.key, rate.key, e.target.value)}
                      onBlur={() => normalizeRate(def.key, rate.key)}
                      className="w-full rounded-lg border border-gray-200 py-2 pl-3 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      %
                    </span>
                  </div>
                </div>
              ))}

              {/* The money, one ceiling per acquisition channel this funnel can
                  be sold through. Whole dollars, never cents — a daily budget is
                  a configured ceiling, not a charge. Empty means that channel is
                  not funded, which is how one offer is put down without
                  forgetting how the funnel sells: every number below stays as it
                  is, and the funnel's other channels keep running.

                  Funding a channel IS choosing it, which is why there is no
                  toggle beside these fields: a switch would be a second way to
                  say what the amount already says. */}
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                  Daily budget per channel
                  <InfoTooltip
                    tip={funnelBudgetTip(def.key, state.savedBudgetCents)}
                    placement="top"
                  />
                </label>
                <div className="space-y-2">
                  {channelsForFunnel(def.key, features).map((channel) => (
                    <div key={channel.featureSlug} className="flex items-center gap-2.5">
                      <AcquisitionChannelMark def={channel} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                        {channel.name}
                      </span>
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
                    </div>
                  ))}
                </div>
              </div>

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
    </section>
  );
}
