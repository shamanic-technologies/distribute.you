/**
 * Centralized number formatting with thousand separators.
 * All numbers displayed to users should go through these functions.
 */

type NumberLocale = Intl.LocalesArgument;

function viewerLocale(): NumberLocale {
  if (typeof navigator === "undefined") return undefined;
  return navigator.languages.length > 0 ? navigator.languages : navigator.language;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function localeSeparators(locale: NumberLocale = viewerLocale()): {
  group: string | null;
  decimal: string;
} {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  return {
    group: parts.find((part) => part.type === "group")?.value ?? null,
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
  };
}

export function formatLocaleNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale: NumberLocale = viewerLocale(),
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function parseLocaleNumberInput(
  raw: string,
  locale: NumberLocale = viewerLocale(),
): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const { group, decimal } = localeSeparators(locale);
  let compact = trimmed.replace(/[\s\u00a0\u202f]/g, "");
  if (group) compact = compact.replace(new RegExp(escapeRegExp(group), "g"), "");
  if (decimal !== ".") {
    compact = compact.replace(new RegExp(escapeRegExp(decimal), "g"), ".");
  }

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(compact)) return null;
  const value = Number(compact);
  return Number.isFinite(value) ? value : null;
}

export function formatLocaleNumberInputValue(
  value: number,
  locale: NumberLocale = viewerLocale(),
): string {
  if (!Number.isFinite(value)) return "";
  return formatLocaleNumber(value, { maximumFractionDigits: 10 }, locale);
}

export function formatLocaleInteger(
  value: number,
  locale: NumberLocale = viewerLocale(),
): string {
  return formatLocaleNumber(Math.round(value), { maximumFractionDigits: 0 }, locale);
}

/** Format a USD dollar amount with thousand separators. */
export function formatUsd(usd: number, decimals = 2): string {
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** Format cents as USD with thousand separators. */
export function formatCentsAsUsd(cents: number | string, decimals = 2): string {
  const usd = (typeof cents === "string" ? parseFloat(cents) : cents) / 100;
  return formatUsd(usd, decimals);
}

/**
 * Adaptive USD for the user dashboard: amounts under $10 show cents ($4.27),
 * amounts $10 and above show whole dollars rounded, with thousand separators
 * ($1,240). This is the standard currency display across every user-dashboard
 * page. The billing pages deliberately keep the explicit-decimal `formatUsd` /
 * `formatCentsAsUsd` / `formatBillingCents` above (exact charged amounts).
 */
export function formatUsdAdaptive(usd: number): string {
  const decimals = Math.abs(usd) < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** Cents variant of {@link formatUsdAdaptive}. */
export function formatCentsAsUsdAdaptive(cents: number | string): string {
  const usd = (typeof cents === "string" ? parseFloat(cents) : cents) / 100;
  return formatUsdAdaptive(usd);
}

/**
 * Format billing cents (fractional, full-precision decimal string from billing-service)
 * as USD, ceiling to the next whole cent so the user is never under-charged in display.
 * Accepts string ("100.4200000000") or number; both are rounded UP per cent.
 */
export function formatBillingCents(cents: string | number): string {
  const raw = typeof cents === "string" ? parseFloat(cents) : cents;
  const usd = Math.ceil(raw) / 100;
  return formatUsd(usd, 2);
}

/** Format cents as USD, returning null for null/undefined/zero/NaN. */
export function formatCentsAsUsdOrNull(cents: string | number | null | undefined): string | null {
  if (cents === null || cents === undefined) return null;
  const n = typeof cents === "string" ? parseFloat(cents) : cents;
  if (isNaN(n) || n === 0) return null;
  return formatCentsAsUsd(n);
}

/** Format an integer with thousand separators. */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}
