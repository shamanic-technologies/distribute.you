"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import { useMutation } from "@tanstack/react-query";
import {
  declareBrandSalesFunnel,
  getBrand,
  getBrandSalesEconomics,
  getBrandSalesFunnels,
  getBrandFunnelBudgets,
  saveBrandFunnelBudget,
  undeclareBrandSalesFunnel,
  type BrandSalesFunnelSet,
  type DeclaredSalesFunnel,
} from "@/lib/api";
import {
  FUNNEL_MIN_DAILY_BUDGET_USD,
  NOTHING_DECLARED,
  SALES_FUNNELS,
  buildFunnelPatch,
  funnelBudgetBelowMinimum,
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

// The funnels a brand sells through, and what each one is worth. Several can run
// at once, and each keeps its own conversion rates, lifetime revenue and landing
// page, because a self-serve purchase customer and an enterprise meeting
// customer are not worth the same and do not land on the same page.
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
   * The daily ceiling, in whole dollars, as typed. Kept OUT of `draft` on
   * purpose: `draft` is exactly what brand-service's patch reads, and this is
   * billing's. Two services, two writes, one form.
   */
  budgetUsd: string;
  /** What billing has stored for this funnel, in cents. Zero = not funded. */
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
      budgetUsd: "",
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

export function BrandSalesFunnelsCard({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();

  // The economics + brand keys are the ones the sibling settings cards already
  // use, so those reads dedupe instead of adding a fetch.
  const { data: econData } = useAuthQuery(["brandSalesEconomics", brandId], () =>
    getBrandSalesEconomics(brandId),
  );
  const { data: brandData } = useAuthQuery(["brand", brandId], () => getBrand(brandId));
  const { data: funnelData } = useAuthQuery(["brandSalesFunnels", brandId], () =>
    getBrandSalesFunnels(brandId),
  );
  // billing owns the money side. A funnel with no row here is simply not funded,
  // which is why an absent row reads as zero rather than as an unknown.
  const { data: budgetData } = useAuthQuery(["brandFunnelBudgets", brandId], () =>
    getBrandFunnelBudgets(brandId),
  );

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

  // Seed every funnel once: a DECLARED funnel from its own stored values, an
  // undeclared one from the brand's blended economics as a guess to confirm.
  // A funnel the user already edited keeps what they typed.
  useEffect(() => {
    if (
      hydrated.current ||
      econData === undefined ||
      brandData === undefined ||
      funnelData === undefined ||
      budgetData === undefined
    ) {
      return;
    }
    hydrated.current = true;
    const declared = new Map(funnelData.funnels.map((f) => [f.funnelKey, f]));
    const funded = new Map(budgetData.funnels.map((f) => [f.funnelKey, f.dailyBudgetCents]));
    setStates((prev) => {
      const next = { ...prev };
      for (const def of SALES_FUNNELS) {
        if (next[def.key].touched) continue;
        const saved = declared.get(def.key);
        const cents = funded.get(def.key) ?? 0;
        next[def.key] = {
          ...next[def.key],
          declared: saved !== undefined,
          saved: saved ?? NOTHING_DECLARED,
          // A daily budget always renders as whole dollars, never cents.
          budgetUsd: cents > 0 ? String(Math.round(cents / 100)) : "",
          savedBudgetCents: cents,
          draft: saved
            ? funnelDraftFromDeclared(def, saved)
            : funnelDraftFromBrand(def, econData.salesEconomics, brand?.clickDestinationUrl ?? null),
        };
      }
      return next;
    });
  }, [econData, brandData, funnelData, budgetData, brand]);

  /** Write the funnel we just declared into the cached set, in catalogue order. */
  function cacheDeclared(funnel: DeclaredSalesFunnel) {
    queryClient.setQueryData(
      ["brandSalesFunnels", brandId],
      (prev: BrandSalesFunnelSet | undefined): BrandSalesFunnelSet => {
        const rest = (prev?.funnels ?? []).filter((f) => f.funnelKey !== funnel.funnelKey);
        // Declaring a funnel IS stating the brand's set includes it, so the flag
        // follows from the write we just made rather than being guessed.
        return { declared: true, funnels: [...rest, funnel].sort(byCatalogueOrder) };
      },
    );
  }

  const declareMutation = useMutation({
    mutationFn: (vars: { def: SalesFunnelDef; patch: ReturnType<typeof buildFunnelPatch> }) =>
      declareBrandSalesFunnel(brandId, vars.def.key, vars.patch),
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
      console.error("[dashboard] declareBrandSalesFunnel failed", err);
      patch(vars.def.key, { error: funnelWriteErrorMessage(err) });
    },
    onSettled: () => setPendingKey(null),
  });

  // billing's write, separate from brand-service's. A funnel's money and a
  // funnel's economics live in two services, so pressing one button makes two
  // writes; neither can stand in for the other.
  const budgetMutation = useMutation({
    mutationFn: (vars: { def: SalesFunnelDef; cents: number }) =>
      saveBrandFunnelBudget(brandId, vars.def.key, vars.cents),
    onSuccess: (set, vars) => {
      queryClient.setQueryData(["brandFunnelBudgets", brandId], set);
      const cents = set.funnels.find((f) => f.funnelKey === vars.def.key)?.dailyBudgetCents ?? 0;
      patch(vars.def.key, {
        savedBudgetCents: cents,
        budgetUsd: cents > 0 ? String(Math.round(cents / 100)) : "",
      });
    },
    onError: (err, vars) => {
      console.error("[dashboard] saveBrandFunnelBudget failed", err);
      patch(vars.def.key, { error: funnelWriteErrorMessage(err) });
    },
  });

  const undeclareMutation = useMutation({
    mutationFn: (vars: { def: SalesFunnelDef }) =>
      undeclareBrandSalesFunnel(brandId, vars.def.key),
    onSuccess: (set, vars) => {
      queryClient.setQueryData(["brandSalesFunnels", brandId], set);
      // Its economics went with the declaration, so the form falls back to the
      // brand-level guess rather than keeping numbers nothing stores any more.
      patch(vars.def.key, {
        declared: false,
        saved: NOTHING_DECLARED,
        touched: false,
        draft: funnelDraftFromBrand(
          vars.def,
          econData?.salesEconomics ?? null,
          brand?.clickDestinationUrl ?? null,
        ),
        error: null,
      });
      setOpenKey(null);
    },
    onError: (err, vars) => {
      console.error("[dashboard] undeclareBrandSalesFunnel failed", err);
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

  /** Whole dollars typed for this funnel's ceiling. Blank reads as unfunded. */
  function budgetUsdOf(key: SalesFunnelKey): number {
    const parsed = parseLocaleNumberInput(states[key].budgetUsd.trim());
    return parsed === null ? 0 : Math.max(0, Math.round(parsed));
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
    const budgetUsd = budgetUsdOf(def.key);
    if (funnelBudgetBelowMinimum(def.key, budgetUsd)) {
      patch(def.key, {
        error: `A daily budget for this funnel starts at $${FUNNEL_MIN_DAILY_BUDGET_USD[def.key]}. Leave it empty to stop funding it.`,
      });
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
    const cents = budgetUsd * 100;
    const budgetMoved = cents !== state.savedBudgetCents;
    if (budgetMoved) budgetMutation.mutate({ def, cents });

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
  // `declared` with an empty set is the brand saying it sells through none — a
  // real answer, and a different one from never having told us anything.
  const statedNone = funnelData?.declared === true && selected.length === 0;

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

          {/* The chain, kept quieter than the name. Once the funnel is chosen,
              each arrow carries the rate for that leg and the lifetime revenue
              closes the chain, where the last step earns it. */}
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
              Needs a website. Set your brand domain above first.
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
            wearing a green tag that claims it runs. */}
        {state.declared && !isOpen && (
          state.savedBudgetCents > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
              <CheckCircleIcon className="h-3.5 w-3.5" />
              ${Math.round(state.savedBudgetCents / 100).toLocaleString("en-US")}/day
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

              {/* The money. Whole dollars, never cents — a daily budget is a
                  configured ceiling, not a charge. Empty means the funnel is not
                  funded, which is how it is put down without forgetting how it
                  sells: every number below it stays exactly as it is. */}
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                  Daily budget
                  <InfoTooltip
                    tip={`The most this funnel may spend in a day. Leave it empty to stop funding it — nothing else about it is lost. From $${FUNNEL_MIN_DAILY_BUDGET_USD[def.key]} a day once you do fund it.`}
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
                    value={state.budgetUsd}
                    onChange={(e) =>
                      patch(def.key, {
                        budgetUsd: e.target.value.replace(/\D/g, ""),
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

        {/* Having stated a set and having said nothing are different answers, so
            they read differently. Neither is rendered as the other. */}
        {selected.length === 0 && (
          <p className="mt-4 text-xs text-gray-400">
            {statedNone
              ? "You told us you sell through none of these. Pick one whenever that changes."
              : "Pick at least one funnel to describe how a lead becomes a paid client."}
          </p>
        )}
      </div>
    </section>
  );
}
