"use client";

import { useState } from "react";
import { GlobeAltIcon } from "@heroicons/react/24/outline";

const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

/**
 * The mark a brand is shown under, anywhere in the dashboard.
 *
 * TWO sources, in this order and never the other way round:
 *
 *  1. `logoUrl` — a logo somebody at that brand CHOSE and we host ourselves.
 *  2. `img.logo.dev/<domain>` — what a third party has indexed for the domain.
 *
 * The order is the whole point. logo.dev is a crawl, so it is right until it is
 * not: it served our own brand under a visual identity we retired in July for two
 * months, on every sidebar and every browser tab, with nobody able to correct it.
 * A stored logo is a statement; a crawled one is a guess, and a guess must never
 * win over a statement.
 *
 * Preferring the stored one also makes the RESET meaningful: brand-service keeps
 * `logo_url` null until somebody stores one, so null here is the honest "nobody
 * chose", which is exactly when falling back to the crawl is right.
 *
 * A brand with neither — no stored logo and no domain — draws the globe. That is
 * a real state (a brand created without a website), not a loading one.
 */
export function BrandLogo({
  domain,
  logoUrl,
  size = 24,
  className,
  fallbackClassName,
}: {
  domain: string | null;
  /** The brand's own stored logo. Absent/null = nobody chose one; fall back to the crawl. */
  logoUrl?: string | null;
  size?: number;
  className?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);

  const stored = logoUrl?.trim() ? logoUrl : null;
  const derived = domain ? `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}` : null;
  // A stored logo that will not load falls back to the crawl rather than to the
  // globe: the brand still has a domain and the crawl is still the better guess.
  // Keyed on the SRC that failed, so replacing the logo re-arms the attempt
  // instead of leaving the slot dead for the rest of the session.
  const src = stored && failed !== stored ? stored : derived;

  if (!src || failed === src) {
    return (
      <GlobeAltIcon
        className={fallbackClassName || className}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={src}
      alt={domain ?? ""}
      width={size}
      height={size}
      className={className || "rounded"}
      onError={() => setFailed(src)}
    />
  );
}
