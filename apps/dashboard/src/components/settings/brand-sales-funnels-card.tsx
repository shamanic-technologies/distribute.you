"use client";

import { useEffect, useRef, useState } from "react";
import { PencilSquareIcon } from "@heroicons/react/20/solid";
import { ChatsCircleIcon } from "@phosphor-icons/react/dist/csr/ChatsCircle";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { ShoppingCartSimpleIcon } from "@phosphor-icons/react/dist/csr/ShoppingCartSimple";
import { MagnetIcon } from "@phosphor-icons/react/dist/csr/Magnet";
import type { Icon } from "@phosphor-icons/react";
import { getBrand, getBrandSalesEconomics } from "@/lib/api";
import {
  SALES_FUNNELS,
  funnelDraftFromBrand,
  funnelLegPct,
  funnelMetaChips,
  funnelRateFields,
  validateFunnelDraft,
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
import { useAuthQuery } from "@/lib/use-auth-query";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { BrandLogo } from "@/components/brand-logo";
import { MaturityBadge } from "@/components/maturity-badge";
import { InfoTooltip } from "@/components/visibility/metric-info";

// The funnels a brand sells through. Several can run at once, and each one keeps
// its own conversion rates, lifetime revenue and landing page, because a
// self-serve purchase customer and an enterprise meeting customer are not worth
// the same and do not land on the same page.
//
// Nothing here writes yet: brand-service stores one lifetime revenue and one
// destination per brand, has no field at all for a booking link, and none for
// the meeting show-up rate. Rather than pretend a per-funnel value persisted,
// the card states that it is a preview. The per-funnel values are seeded from
// what the brand really saved, so the numbers on screen are its own.

// Phosphor duotone rather than a single-weight utility set: each mark carries a
// tinted fill under its stroke, so it fills its tile instead of floating in it.
const FUNNEL_ICONS: Record<SalesFunnelKey, Icon> = {
  reply_meeting: ChatsCircleIcon,
  visit_meeting: CalendarCheckIcon,
  visit_signup: ShoppingCartSimpleIcon,
  visit_form: MagnetIcon,
};

type FunnelState = {
  selected: boolean;
  confirmed: boolean;
  /** True once the funnel has been confirmed at least once, so the CTA reads Update. */
  everConfirmed: boolean;
  touched: boolean;
  draft: FunnelDraft;
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
      selected: false,
      confirmed: false,
      everConfirmed: false,
      touched: false,
      draft: emptyDraft(def),
      error: null,
    };
  }
  return out;
}

export function BrandSalesFunnelsCard({ brandId }: { brandId: string }) {
  const isBeta = useIsBetaUser();

  // Both keys are the ones the sibling settings cards already use, so these
  // reads dedupe instead of adding a fetch.
  const { data: econData } = useAuthQuery(["brandSalesEconomics", brandId], () =>
    getBrandSalesEconomics(brandId),
  );
  const { data: brandData } = useAuthQuery(["brand", brandId], () => getBrand(brandId));

  const brand = brandData?.brand ?? null;
  const brandDomain = brand?.domain ?? null;
  // Only true once the brand resolved, so a load flash cannot lock the visit-led
  // funnels on a brand that does have a website.
  const noWebsite = !!brand && brand.url == null;

  const [states, setStates] = useState<Record<SalesFunnelKey, FunnelState>>(initialStates);
  const hydrated = useRef(false);

  // Seed every funnel from the brand's saved economics + click destination, once.
  // A funnel the user already edited keeps what they typed.
  useEffect(() => {
    if (hydrated.current || econData === undefined || brandData === undefined) return;
    hydrated.current = true;
    setStates((prev) => {
      const next = { ...prev };
      for (const def of SALES_FUNNELS) {
        if (next[def.key].touched) continue;
        next[def.key] = {
          ...next[def.key],
          draft: funnelDraftFromBrand(
            def,
            econData.salesEconomics,
            brand?.clickDestinationUrl ?? null,
          ),
        };
      }
      return next;
    });
  }, [econData, brandData, brand]);

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

  function toggleSelected(def: SalesFunnelDef) {
    const state = states[def.key];
    patch(def.key, { selected: !state.selected, confirmed: false, error: null });
  }

  function confirm(def: SalesFunnelDef) {
    const result = validateFunnelDraft(def, states[def.key].draft, brandDomain);
    if (!result.ok) {
      patch(def.key, { error: result.error });
      return;
    }
    patch(def.key, { confirmed: true, everConfirmed: true, error: null });
  }

  if (!isBeta) return null;

  const selectedCount = SALES_FUNNELS.filter((def) => states[def.key].selected).length;

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Sales Funnels</h2>
        <MaturityBadge level="beta" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="mb-1 text-sm text-gray-500">
          Pick every funnel you sell through. Each one keeps its own conversion rates,
          lifetime revenue and landing page.
        </p>
        <p className="mb-5 text-xs text-gray-400">Preview only. Nothing here is saved yet.</p>

        <ul className="space-y-3">
          {SALES_FUNNELS.map((def) => {
            const state = states[def.key];
            const Icon = FUNNEL_ICONS[def.key];
            const locked = def.requiresWebsite && noWebsite;
            const chips = state.selected ? funnelMetaChips(def, state.draft) : [];
            const rateFields = funnelRateFields(def);

            return (
              <li
                key={def.key}
                className={`rounded-xl border bg-white transition ${
                  state.selected ? "border-gray-300 shadow-sm" : "border-gray-200"
                }`}
              >
                <div className="flex items-start gap-3 p-4">
                  <input
                    id={`funnel-${def.key}`}
                    type="checkbox"
                    checked={state.selected}
                    disabled={locked}
                    onChange={() => toggleSelected(def)}
                    className="mt-2.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-500 focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-40"
                  />

                  {/* Tall enough to run alongside both the name and the chain under it. */}
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${def.tone.iconBg}`}
                  >
                    <Icon size={26} weight="duotone" className={def.tone.iconText} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`funnel-${def.key}`}
                      className={`block text-sm font-medium ${
                        locked ? "cursor-not-allowed text-gray-400" : "cursor-pointer text-gray-900"
                      }`}
                    >
                      {def.name}
                    </label>

                    {/* The chain, kept quieter than the name. Once the funnel is on,
                        each arrow carries the rate for that leg — except the one no
                        field measures, which carries nothing. */}
                    <p className="mt-0.5 flex flex-wrap items-start gap-x-1.5 text-xs text-gray-500">
                      {def.steps.map((step, i) => {
                        const pct = i > 0 && state.selected ? funnelLegPct(def, state.draft, i - 1) : null;
                        return (
                          <span key={step} className="inline-flex items-start gap-1.5">
                            {i > 0 && (
                              <span className="inline-flex flex-col items-center">
                                <span className="leading-5 text-gray-300">→</span>
                                {pct && (
                                  <span className="-mt-0.5 text-[10px] leading-none text-gray-400">
                                    {pct}
                                  </span>
                                )}
                              </span>
                            )}
                            <span className="leading-5">{step}</span>
                          </span>
                        );
                      })}
                    </p>

                    {locked && (
                      <p className="mt-1 text-xs text-gray-400">
                        Needs a website. Set your brand domain above first.
                      </p>
                    )}

                    {chips.length > 0 && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                        {chips.map((chip, i) => (
                          <span key={`${chip.kind}-${i}`} className="inline-flex items-center gap-1.5">
                            {i > 0 && <span className="text-gray-300">·</span>}
                            {chip.kind !== "ltr" && (
                              <BrandLogo
                                domain={chip.host}
                                size={14}
                                className="rounded-sm"
                                fallbackClassName="text-gray-300"
                              />
                            )}
                            <span className="truncate">{chip.label}</span>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>

                  {state.selected && state.confirmed && (
                    <button
                      type="button"
                      onClick={() => patch(def.key, { confirmed: false })}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
                    >
                      <PencilSquareIcon className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  )}
                </div>

                {state.selected && !state.confirmed && (
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

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => confirm(def)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
                      >
                        {state.everConfirmed ? "Update" : "OK"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {selectedCount === 0 && (
          <p className="mt-4 text-xs text-gray-400">
            Pick at least one funnel to describe how a lead becomes a paid client.
          </p>
        )}
      </div>
    </section>
  );
}
