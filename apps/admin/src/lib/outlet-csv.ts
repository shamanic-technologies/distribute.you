import { toCsv, type CsvColumn } from "@/components/report/csv";
import { statusLabel } from "@/lib/outlet-status";
import type { DeduplicatedOutlet } from "@/lib/api";
import { whyRelevantForBestRelevanceCampaign } from "./outlet-csv-why-relevant";

function whyRelevantFor(outlet: DeduplicatedOutlet): string {
  return whyRelevantForBestRelevanceCampaign(outlet.campaigns);
}

/**
 * Build a flat, one-row-per-outlet CSV of the FULL outlet list.
 *
 * Columns mirror the dashboard outlet card 1:1, so the exported "Status" is the
 * SAME high-watermark display status the card badge shows. The caller passes its
 * own page-scoped resolvers so the CSV can't drift from what's on screen:
 *   - `displayStatusFor` — the latched display-status key for an outlet (the
 *     campaign page resolves campaign-scoped status, brand/feature pages resolve
 *     brand-scoped). Run through `statusLabel` here for the human label.
 *   - `costCentsFor` — the per-outlet total cost in USD cents (string), or null
 *     when the cost query hasn't loaded / the outlet has no cost.
 *
 * The relevance note comes from the campaign with the outlet's best relevance
 * score, so the export shows the strongest available campaign explanation.
 *
 * Exports the WHOLE list passed in — never the active-tab / search-filtered
 * subset. Sorted by relevance desc so the most relevant outlets sit at the top.
 */
export function buildOutletCsv(
  outlets: DeduplicatedOutlet[],
  displayStatusFor: (outlet: DeduplicatedOutlet) => string,
  costCentsFor: (outlet: DeduplicatedOutlet) => string | null,
  drFor: (outlet: DeduplicatedOutlet) => number | null | undefined,
  purchasePriceFor: (outlet: DeduplicatedOutlet) => string | null,
  monthlyVisitsFor: (outlet: DeduplicatedOutlet) => number | null | undefined,
): string {
  const columns: CsvColumn<DeduplicatedOutlet>[] = [
    { label: "Outlet", value: (o) => o.outletName },
    { label: "Domain", value: (o) => o.outletDomain },
    { label: "URL", value: (o) => o.outletUrl },
    { label: "Status", value: (o) => statusLabel(displayStatusFor(o)) },
    { label: "DR", value: (o) => drFor(o) ?? "" },
    { label: "Monthly Visits", value: (o) => monthlyVisitsFor(o) ?? "" },
    { label: "Purchase Price", value: (o) => purchasePriceFor(o) ?? "" },
    { label: "Relevance %", value: (o) => o.relevanceScore },
    { label: "Why Relevant", value: (o) => whyRelevantFor(o) },
    { label: "Campaigns", value: (o) => o.campaigns.length },
    { label: "Discovered", value: (o) => o.createdAt.slice(0, 10) },
    {
      label: "Cost (USD)",
      value: (o) => {
        const cents = costCentsFor(o);
        if (cents == null) return "";
        const n = parseFloat(cents);
        if (isNaN(n) || n === 0) return "";
        return (n / 100).toFixed(2);
      },
    },
  ];
  const rows = [...outlets].sort((a, b) => b.relevanceScore - a.relevanceScore);
  return toCsv(rows, columns);
}
