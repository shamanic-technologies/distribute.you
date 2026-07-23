import { SectionCard, EmptyState } from "@/components/report/section-card";
import { CsvDownloadButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { ProviderLogo } from "@/components/provider-logo";
import { fetchQuotePitchesByBrand, fetchQuoteRequestIndex } from "@/lib/report-api";
import type { QuotePitch } from "@/lib/api";
import {
  type PitchStatusTab,
  pitchesForTab,
  pitchTimestamp,
  toDomain,
  timeAgo,
} from "@/lib/report-pitch-tabs";

// One row of the read-only press tracker. Every column now comes from real
// backend data: Publication (pitch's originating quote request, or the pitch's
// own `publicationSource` when the request join misses), Article (title/url),
// DR (`outletDomainRating`), Attribution (`backlinkAttribution` dofollow/
// nofollow), Timestamp (`publishedAt`). Values are NEVER fabricated client-
// side — a genuinely-absent field renders "—" / "Unknown".
interface PitchRow {
  id: string;
  publicationName: string;
  logoDomain: string | null;
  articleUrl: string | null;
  articleTitle: string | null;
  drLabel: string;
  drValue: number | null;
  attributionLabel: string;
  timestampIso: string | null;
}

const COLUMN_LABELS = ["Publication", "Article", "DR", "Attribution", "Updated"];

// Normalise the wire `backlinkAttribution` (e.g. "DoFollow" / "NoFollow" /
// "Unknown" / null) to the badge's display label, case-insensitively.
function attributionLabel(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "dofollow" || v === "do follow") return "Do follow";
  if (v === "nofollow" || v === "no follow") return "No follow";
  return "Unknown";
}

function buildRow(
  pitch: QuotePitch,
  outletName: string | null,
  tabSlug: PitchStatusTab["slug"],
): PitchRow {
  // The outlet `mediaOutlet` is already a bare domain (e.g. `azbigmedia.com`)
  // → use it directly for the logo. Fall back to the published article's host.
  // NEVER the pitchUrl (a connectively.us platform link = same logo everywhere).
  const logoDomain = toDomain(outletName) ?? toDomain(pitch.featuredArticleUrl);
  // Publication name: the joined quote-request outlet, else the pitch's own
  // `publicationSource` (the placement outlet name from Connectively) so a
  // request-join miss still shows the outlet instead of "—".
  const publicationName = outletName ?? pitch.publicationSource ?? "—";
  const dr = pitch.outletDomainRating ?? null;
  return {
    id: pitch.id,
    publicationName,
    logoDomain,
    articleUrl: pitch.featuredArticleUrl,
    articleTitle: pitch.articleTitle ?? null,
    drLabel: dr != null ? String(dr) : "—",
    drValue: dr,
    attributionLabel: attributionLabel(pitch.backlinkAttribution),
    timestampIso: pitchTimestamp(pitch, tabSlug),
  };
}

export async function PitchStatusView({
  orgId,
  brandId,
  featureSlug,
  tab,
}: {
  orgId: string;
  brandId: string;
  featureSlug: string;
  tab: PitchStatusTab;
}) {
  const [pitches, requestIndex] = await Promise.all([
    fetchQuotePitchesByBrand(orgId, brandId),
    fetchQuoteRequestIndex(orgId, brandId),
  ]);

  const rows: PitchRow[] = pitchesForTab(pitches, tab)
    .map((p) => {
      const outlet = requestIndex[p.quoteRequestId];
      return buildRow(p, outlet?.mediaOutlet ?? null, tab.slug);
    })
    // Sort by DR desc (a present DR outranks an absent one), then most-recent.
    .sort((a, b) => {
      const drA = a.drValue ?? -1;
      const drB = b.drValue ?? -1;
      if (drB !== drA) return drB - drA;
      const tA = a.timestampIso ? new Date(a.timestampIso).getTime() : 0;
      const tB = b.timestampIso ? new Date(b.timestampIso).getTime() : 0;
      return tB - tA;
    });

  const csvColumns: CsvColumn<PitchRow>[] = [
    { label: "Publication", value: (r) => r.publicationName },
    { label: "Article", value: (r) => r.articleTitle ?? "" },
    { label: "Article URL", value: (r) => r.articleUrl ?? "" },
    { label: "DR", value: (r) => r.drLabel },
    { label: "Attribution", value: (r) => r.attributionLabel },
    { label: "Updated", value: (r) => r.timestampIso ?? "" },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <SectionCard
        title={tab.label}
        description={`Quote placements at the "${tab.label}" stage for this brand.`}
        count={rows.length}
        actions={
          <CsvDownloadButton
            filename={`quotes-${tab.slug}-${featureSlug}.csv`}
            csv={toCsv(rows, csvColumns)}
            isEmpty={rows.length === 0}
          />
        }
      >
        {rows.length === 0 ? (
          <EmptyState message={`No quotes at the "${tab.label}" stage yet.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  {COLUMN_LABELS.map((label) => (
                    <th
                      key={label}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Row key={r.id} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Row({ row }: { row: PitchRow }) {
  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <ProviderLogo domain={row.logoDomain} size={18} />
          <span className="text-gray-800">{row.publicationName}</span>
        </div>
      </td>
      <td className="px-4 py-3 max-w-xs">
        {row.articleUrl ? (
          <a
            href={row.articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline text-xs break-all"
          >
            {row.articleTitle ?? row.logoDomain ?? "View article"} →
          </a>
        ) : row.articleTitle ? (
          <span className="text-xs text-gray-700">{row.articleTitle}</span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{row.drLabel}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <AttributionBadge label={row.attributionLabel} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-gray-500">
        {timeAgo(row.timestampIso)}
      </td>
    </tr>
  );
}

function AttributionBadge({ label }: { label: string }) {
  const style =
    label === "Do follow"
      ? "bg-green-100 text-green-700 border-green-200"
      : label === "No follow"
        ? "bg-gray-100 text-gray-600 border-gray-200"
        : "bg-gray-50 text-gray-400 border-gray-200";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${style}`}>
      {label}
    </span>
  );
}
