"use client";

import { useState } from "react";

const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

/**
 * Small provider logo via logo.dev, keyed on a domain (e.g. `anthropic.com`).
 *
 * Renders NOTHING when there is no domain or the image fails to load — never an
 * initial-letter fallback (per the landing logo-discipline convention). Callers
 * resolve the domain from the backend-authoritative cost catalog
 * (`getPlatformPrices`), never by deriving it from a name.
 */
export function ProviderLogo({
  domain,
  size = 16,
  className,
}: {
  domain: string | null;
  size?: number;
  className?: string;
}) {
  const [error, setError] = useState(false);

  if (!domain || error) return null;

  return (
    <img
      src={`https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`}
      alt={domain}
      width={size}
      height={size}
      className={className ?? "rounded-sm flex-shrink-0"}
      onError={() => setError(true)}
    />
  );
}
