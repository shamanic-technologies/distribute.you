/**
 * The three outcome lenses that replaced the single Conversions page.
 *
 * Each lens is a view over the SAME feature-revenue endpoint with `?lens=`.
 * features-service filters the leads to the lens signal and computes both the
 * per-lead conversion probability and expected revenue (probability × the
 * brand's lifetime revenue). The dashboard only renders — no client-side math.
 *
 * - signups        → leads whose signal is a website click; probability =
 *                    brand website-click→signup rate.
 * - booked-meetings → leads with a positive reply; probability =
 *                    brand positive-reply→meeting rate.
 * - sales          → leads with a click and/or a positive reply; probability =
 *                    combined paid-close probability across both channels.
 */
export type OutcomeLens = "signups" | "booked-meetings" | "sales";

export interface OutcomeLensMeta {
  lens: OutcomeLens;
  /** URL segment under the brand: `${basePath}/${segment}`. */
  segment: string;
  /** Sidebar + page title. */
  label: string;
  /** Page subtitle. */
  subtitle: string;
  /** Probability column header. */
  probabilityLabel: string;
  /** Empty-table copy. */
  empty: string;
}

export const OUTCOME_LENSES: Record<OutcomeLens, OutcomeLensMeta> = {
  signups: {
    lens: "signups",
    segment: "signups",
    label: "Signups",
    subtitle: "Leads who clicked through to your site, with their probability of signing up and the revenue that signup is worth.",
    probabilityLabel: "Signup probability",
    empty: "No website clicks yet.",
  },
  "booked-meetings": {
    lens: "booked-meetings",
    segment: "booked-meetings",
    label: "Booked Meetings",
    subtitle: "Leads who replied positively, with their probability of booking a meeting and the revenue that meeting is worth.",
    probabilityLabel: "Meeting probability",
    empty: "No positive replies yet.",
  },
  sales: {
    lens: "sales",
    segment: "sales",
    label: "Sales",
    subtitle: "Leads who clicked and/or replied positively, with their combined probability of becoming a paying customer and the expected revenue.",
    probabilityLabel: "Sale probability",
    empty: "No clicks or positive replies yet.",
  },
};

export const OUTCOME_LENS_ORDER: OutcomeLens[] = ["signups", "booked-meetings", "sales"];
