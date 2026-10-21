import { COUNTRIES, type PhoneCountry } from "../components/onboarding/phone-countries";

/**
 * A prepared onboarding link (owner 2026-10-21, Karim): staff send a prospect
 * `/get-started?url=<site>&firstName=…&lastName=…&phone=+<E.164>` so the first step opens with
 * what we already know, and the prospect still walks the real flow. Absent or blank params read
 * as nothing (the field stays empty, as before). Alias-free (real unit tests).
 */
export type GetStartedPrefill = {
  firstName: string;
  lastName: string;
  phone: { countryCode: string; dialCode: string; national: string } | null;
};

export function readGetStartedPrefill(params: { get(name: string): string | null }, ipCountry: string | null | undefined): GetStartedPrefill {
  const text = (name: string) => (params.get(name) ?? "").trim();
  return { firstName: text("firstName"), lastName: text("lastName"), phone: parseE164(text("phone"), ipCountry) };
}

/**
 * `+<dial><national>` to the picker's parts: the LONGEST dial code that prefixes the digits wins
 * (`+1 268` is Antigua, not the US). Several countries share a dial code (`1` = US, Canada…): the
 * visitor's IP country when it is one of them, else the first listed. Not a `+` number = null.
 */
export function parseE164(raw: string, ipCountry: string | null | undefined): GetStartedPrefill["phone"] {
  const compact = raw.replace(/[\s().-]/g, "");
  if (!/^\+\d{6,15}$/.test(compact)) return null;
  const digits = compact.slice(1);
  let best: PhoneCountry[] = [];
  for (const c of COUNTRIES) {
    if (!digits.startsWith(c.dial) || digits.length === c.dial.length) continue;
    if (best.length === 0 || c.dial.length > best[0].dial.length) best = [c];
    else if (c.dial.length === best[0].dial.length) best.push(c);
  }
  if (best.length === 0) return null;
  const pick = best.find((c) => c.code === (ipCountry ?? "").toUpperCase()) ?? best[0];
  return { countryCode: pick.code, dialCode: pick.dial, national: digits.slice(pick.dial.length) };
}
