"use client";

import {
  CardBrandLogo,
  cardBrandLabel,
  cardExpiryLabel,
  countryFlag,
  countryLabel,
} from "../billing/billing-display";

/**
 * Billing > Payment method: WHAT we charge, whatever its type, from the fields billing
 * serves (BILLING-LINK-PAYMENT-METHOD-1118). A card reads "Visa •••• 4242", expiry and
 * issuing country under it; a Stripe Link wallet (no card number) reads "Link · <its
 * email>" with Link's mark. "Card connected" only when billing states no detail at all.
 */
export interface SavedMethodAccount {
  payment_method_type?: string | null;
  link_email?: string | null;
  card_brand?: string | null;
  card_last4?: string | null;
  card_exp_month?: number | null;
  card_exp_year?: number | null;
  card_country?: string | null;
}

export function SavedMethodLine({ account }: { account: SavedMethodAccount }) {
  const isLink = account.payment_method_type === "link";
  const expiry = isLink ? null : cardExpiryLabel(account.card_exp_month, account.card_exp_year);
  const country = isLink ? null : account.card_country;
  return (
    <>
      <CardBrandLogo brand={isLink ? "link" : account.card_brand} className="k-inset rounded-lg" />
      <div className="min-w-0 flex-1">
        {isLink ? (
          <p className="flex min-w-0 items-center text-[13px]">
            <span className="font-medium">Link</span>
            {account.link_email && (
              <>
                <span className="k-fg4 mx-1.5" aria-hidden>
                  ·
                </span>
                <span className="k-fg2 truncate">{account.link_email}</span>
              </>
            )}
          </p>
        ) : account.card_last4 ? (
          <p className="text-[13px]">
            <span className="font-medium">{cardBrandLabel(account.card_brand)}</span>
            <span className="k-fg4 mx-1.5 tracking-[0.2em]" aria-hidden>
              ••••
            </span>
            <span className="font-medium tabular-nums">{account.card_last4}</span>
          </p>
        ) : (
          <p className="text-[13px] font-medium">Card connected</p>
        )}
        {(expiry || country) && (
          <p className="k-fg3 mt-0.5 flex flex-wrap items-center gap-x-1.5 whitespace-nowrap text-[12px]">
            {expiry && <span>Expires {expiry}</span>}
            {expiry && country && <span aria-hidden>·</span>}
            {country && (
              <span>
                {countryFlag(country)} {countryLabel(country)}
              </span>
            )}
          </p>
        )}
      </div>
    </>
  );
}
