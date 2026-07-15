// Static country list for the onboarding phone step's searchable dial-code
// picker. Kept dependency-free (no libphonenumber / intl-tel-input) so the
// dashboard change stays main-direct-eligible (no lockfile edit). Flags are
// derived from the ISO code via regional-indicator code points — no image
// assets, renders natively.

export type PhoneCountry = { code: string; name: string; dial: string };

// [ISO 3166-1 alpha-2, name, dial code (no +)]. Ordered roughly by market size
// so the default list is useful before the user types; search covers the rest.
const RAW: ReadonlyArray<readonly [string, string, string]> = [
  ["US", "United States", "1"],
  ["GB", "United Kingdom", "44"],
  ["CA", "Canada", "1"],
  ["AU", "Australia", "61"],
  ["FR", "France", "33"],
  ["DE", "Germany", "49"],
  ["ES", "Spain", "34"],
  ["IT", "Italy", "39"],
  ["NL", "Netherlands", "31"],
  ["IE", "Ireland", "353"],
  ["IN", "India", "91"],
  ["SG", "Singapore", "65"],
  ["AE", "United Arab Emirates", "971"],
  ["BR", "Brazil", "55"],
  ["MX", "Mexico", "52"],
  ["JP", "Japan", "81"],
  ["CN", "China", "86"],
  ["HK", "Hong Kong", "852"],
  ["CH", "Switzerland", "41"],
  ["SE", "Sweden", "46"],
  ["NO", "Norway", "47"],
  ["DK", "Denmark", "45"],
  ["FI", "Finland", "358"],
  ["BE", "Belgium", "32"],
  ["AT", "Austria", "43"],
  ["PT", "Portugal", "351"],
  ["PL", "Poland", "48"],
  ["NZ", "New Zealand", "64"],
  ["ZA", "South Africa", "27"],
  ["IL", "Israel", "972"],
  ["SA", "Saudi Arabia", "966"],
  ["AR", "Argentina", "54"],
  ["CL", "Chile", "56"],
  ["CO", "Colombia", "57"],
  ["PE", "Peru", "51"],
  ["KR", "South Korea", "82"],
  ["TW", "Taiwan", "886"],
  ["MY", "Malaysia", "60"],
  ["ID", "Indonesia", "62"],
  ["PH", "Philippines", "63"],
  ["TH", "Thailand", "66"],
  ["VN", "Vietnam", "84"],
  ["TR", "Turkey", "90"],
  ["GR", "Greece", "30"],
  ["CZ", "Czechia", "420"],
  ["RO", "Romania", "40"],
  ["HU", "Hungary", "36"],
  ["SK", "Slovakia", "421"],
  ["UA", "Ukraine", "380"],
  ["RU", "Russia", "7"],
  ["EG", "Egypt", "20"],
  ["NG", "Nigeria", "234"],
  ["KE", "Kenya", "254"],
  ["MA", "Morocco", "212"],
  ["QA", "Qatar", "974"],
  ["KW", "Kuwait", "965"],
  ["BH", "Bahrain", "973"],
  ["OM", "Oman", "968"],
  ["JO", "Jordan", "962"],
  ["LB", "Lebanon", "961"],
  ["PK", "Pakistan", "92"],
  ["BD", "Bangladesh", "880"],
  ["LK", "Sri Lanka", "94"],
  ["LU", "Luxembourg", "352"],
  ["IS", "Iceland", "354"],
  ["EE", "Estonia", "372"],
  ["LV", "Latvia", "371"],
  ["LT", "Lithuania", "370"],
  ["SI", "Slovenia", "386"],
  ["HR", "Croatia", "385"],
  ["BG", "Bulgaria", "359"],
  ["RS", "Serbia", "381"],
  ["CY", "Cyprus", "357"],
  ["MT", "Malta", "356"],
  ["EC", "Ecuador", "593"],
  ["UY", "Uruguay", "598"],
  ["PY", "Paraguay", "595"],
  ["BO", "Bolivia", "591"],
  ["VE", "Venezuela", "58"],
  ["CR", "Costa Rica", "506"],
  ["PA", "Panama", "507"],
  ["GT", "Guatemala", "502"],
  ["DO", "Dominican Republic", "1"],
  ["PR", "Puerto Rico", "1"],
  ["JM", "Jamaica", "1"],
  ["TT", "Trinidad and Tobago", "1"],
  ["GH", "Ghana", "233"],
  ["TZ", "Tanzania", "255"],
  ["UG", "Uganda", "256"],
  ["ET", "Ethiopia", "251"],
  ["DZ", "Algeria", "213"],
  ["TN", "Tunisia", "216"],
  ["MU", "Mauritius", "230"],
  ["KZ", "Kazakhstan", "7"],
  ["GE", "Georgia", "995"],
  ["AM", "Armenia", "374"],
  ["AZ", "Azerbaijan", "994"],
  ["MD", "Moldova", "373"],
  ["MK", "North Macedonia", "389"],
  ["AL", "Albania", "355"],
  ["BA", "Bosnia and Herzegovina", "387"],
  ["ME", "Montenegro", "382"],
  ["MM", "Myanmar", "95"],
  ["KH", "Cambodia", "855"],
  ["LA", "Laos", "856"],
  ["NP", "Nepal", "977"],
  ["MN", "Mongolia", "976"],
  ["MO", "Macau", "853"],
  ["BN", "Brunei", "673"],
  ["MV", "Maldives", "960"],
  ["FJ", "Fiji", "679"],
];

export const COUNTRIES: ReadonlyArray<PhoneCountry> = RAW.map(([code, name, dial]) => ({ code, name, dial }));

export const DEFAULT_COUNTRY: PhoneCountry = COUNTRIES[0];

/**
 * ISO alpha-2 → emoji flag. Each letter maps to its regional-indicator symbol
 * (code point 0x1F1E6 + offset from 'A'), so "US" → 🇺🇸. Renders natively with
 * zero assets. Returns "" for a malformed code (fail-soft on display only).
 */
export function codeToFlag(code: string): string {
  const cc = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)));
}

/** Case-insensitive filter over name, dial code and ISO code. */
export function searchCountries(query: string): ReadonlyArray<PhoneCountry> {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return COUNTRIES;
  const digits = q.replace(/\D/g, "");
  return COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (digits.length > 0 && c.dial.includes(digits)),
  );
}
