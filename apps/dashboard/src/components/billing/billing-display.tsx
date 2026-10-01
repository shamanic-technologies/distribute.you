"use client";

import { useState } from "react";

/**
 * Display helpers for the Billing pages (v1 and v2): how a card, a country, a
 * payment status and a date are written. Formatting only, no figure is derived here.
 */

export function formatGrantDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ISO-3166-1 alpha-2 -> full country name, for ANY country (Intl.DisplayNames,
// so a US/FR/BR card names its country too, not just the RBI-blocked set). Falls
// back to a generic phrase only when the code is missing/invalid.
const REGION_NAMES =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export function countryLabel(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "your card's country";
  const up = code.toUpperCase();
  try {
    return REGION_NAMES?.of(up) ?? up;
  } catch {
    return up;
  }
}

// ISO-3166-1 alpha-2 -> regional-indicator flag emoji (A-Z => U+1F1E6..U+1F1FF).
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const up = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(up)) return "";
  return String.fromCodePoint(...[...up].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// Stripe PaymentMethod card.brand -> display label. Absent/unknown => "Card".
const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

export function cardBrandLabel(brand: string | null | undefined): string {
  if (!brand) return "Card";
  return CARD_BRAND_LABELS[brand.toLowerCase()] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function cardExpiryLabel(month: number | null | undefined, year: number | null | undefined): string | null {
  if (!month || !year) return null;
  const mm = String(month).padStart(2, "0");
  const yy = String(year).slice(-2);
  return `${mm}/${yy}`;
}

// Stripe card.brand -> the network's registrable domain, so logo.dev serves the
// real network logo (Visa/Amex/Mastercard/...). Shared public logo.dev token
// (same one BrandLogo / conversions-table use).
const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";
const CARD_BRAND_DOMAINS: Record<string, string> = {
  visa: "visa.com",
  mastercard: "mastercard.com",
  amex: "americanexpress.com",
  discover: "discover.com",
  diners: "dinersclubinternational.com",
  jcb: "global.jcb",
  unionpay: "unionpayintl.com",
};

// Generic card glyph — fallback when the brand is unknown or the logo 404s.
function GenericCardGlyph() {
  return (
    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

// Network-logo tile (logo.dev by brand domain). Falls back to a generic card
// glyph when the brand is unknown OR the logo image fails to load.
export function CardBrandLogo({
  brand,
  className = "rounded-md border border-gray-200 bg-white",
}: {
  brand: string | null | undefined;
  /** The tile's frame: v1 draws a bordered white tile, v2 a Keel inset. */
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const domain = brand ? CARD_BRAND_DOMAINS[brand.toLowerCase()] : undefined;
  return (
    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center p-1.5 ${className}`}>
      {domain && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}&size=128&format=png&retina=true`}
          alt={`${cardBrandLabel(brand)} logo`}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <GenericCardGlyph />
      )}
    </div>
  );
}

