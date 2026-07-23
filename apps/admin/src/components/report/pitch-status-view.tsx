import { SectionCard, EmptyState } from "@/components/report/section-card";
import { CsvDownloadButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import {
  SortablePitchTable,
  type PitchRow,
} from "@/components/report/sortable-pitch-table";
import {
  fetchQuotePitchesByBrand,
  fetchQuoteRequestIndex,
  type QuoteRequestOutlet,
} from "@/lib/report-api";
import type { QuotePitch } from "@/lib/api";
import {
  type PitchStatusTab,
  pitchesForTab,
  pitchTimestamp,
  toDomain,
} from "@/lib/report-pitch-tabs";

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
  request: QuoteRequestOutlet | undefined,
  tabSlug: PitchStatusTab["slug"],
): PitchRow {
  const outletName = request?.mediaOutlet ?? null;
  // The outlet `mediaOutlet` is already a bare domain (e.g. `azbigmedia.com`)
  // → use it directly for the logo. Fall back to the published article's host.
  // NEVER the pitchUrl (a connectively.us platform link = same logo everywhere).
  const logoDomain = toDomain(outletName) ?? toDomain(pitch.featuredArticleUrl);
  // Publication: show the DISPLAY NAME consistently — the pitch's own
  // `publicationSource` (Connectively outlet name, e.g. "Small Biz Leader")
  // first, else the joined quote-request outlet domain. Prevents a mix of
  // "smallbizleader.com" and "Small Biz Leader" across rows.
  const publicationName =
    pitch.publicationSource ?? outletName ?? "—";
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
    // Answer (pitch draft) is already on the wire → instant. The question is
    // fetched on click by this id (kept out of the page-load path).
    answer: pitch.draft ?? null,
    quoteRequestId: pitch.quoteRequestId ?? null,
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

  const rows: PitchRow[] = pitchesForTab(pitches, tab).map((p) =>
    buildRow(p, requestIndex[p.quoteRequestId], tab.slug),
  );

  const csvColumns: CsvColumn<PitchRow>[] = [
    { label: "Publication", value: (r) => r.publicationName },
    { label: "Article", value: (r) => r.articleTitle ?? "" },
    { label: "Article URL", value: (r) => r.articleUrl ?? "" },
    { label: "DR", value: (r) => r.drLabel },
    { label: "Attribution", value: (r) => r.attributionLabel },
    { label: tab.dateLabel, value: (r) => r.timestampIso ?? "" },
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
          <SortablePitchTable
            rows={rows}
            dateLabel={tab.dateLabel}
            detailBase={`/api/report/${orgId}/${brandId}/${featureSlug}/quote-request`}
          />
        )}
      </SectionCard>
    </div>
  );
}
