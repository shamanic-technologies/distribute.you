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

/**
 * An LLM's PRODUCT mark (Claude's starburst, Gemini's sparkle; owner 2026-10-19: the product, not
 * the company), shipped under `public/model-logos` because logo.dev only knows company sites. The
 * path comes from `lib/llm-marks.ts` (`llmMark`); every model chip draws through
 * `components/v2/catalogue-name.tsx`, never an `<img>` of its own.
 */
export function ModelProductLogo({ src, size = 16 }: { src: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" aria-hidden="true" width={size} height={size} className="shrink-0" style={{ width: size, height: size }} />
  );
}
