import { Suspense } from "react";
import { SectionCard, EmptyState } from "@/components/report/section-card";
import { CsvDownloadButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { fetchQuotePitchesByBrand } from "@/lib/report-api";
import type { QuotePitch, QuotePitchStatus } from "@/lib/api";

export const revalidate = 14400;
export const maxDuration = 300;

const PITCHES_COLUMNS = ["Status", "Pitch", "Delivery", "Submitted", "Article"];

// Read-only mirror of the authed `features/[featureSlug]/quote-pitches` status
// palette. The report never mutates a pitch, so only the badge color matters.
const STATUS_STYLES: Record<QuotePitchStatus, string> = {
  drafted: "bg-gray-100 text-gray-700 border-gray-200",
  submitted: "bg-blue-100 text-blue-700 border-blue-200",
  selected: "bg-yellow-100 text-yellow-700 border-yellow-200",
  published: "bg-green-100 text-green-700 border-green-200",
  not_selected: "bg-gray-100 text-gray-500 border-gray-200",
  error: "bg-red-100 text-red-600 border-red-200",
  length_violation: "bg-red-100 text-red-600 border-red-200",
  template_missing: "bg-red-100 text-red-600 border-red-200",
  brand_missing_fields: "bg-red-100 text-red-600 border-red-200",
  insufficient_credits: "bg-red-100 text-red-600 border-red-200",
  question_not_found: "bg-red-100 text-red-600 border-red-200",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

export default async function QuotePitchesPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;
  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <Suspense
        fallback={
          <TableSectionSkeleton
            title="Pitches"
            description="Drafted and submitted pitches for journalist quote requests."
            columnLabels={PITCHES_COLUMNS}
          />
        }
      >
        <PitchesSection orgId={orgId} brandId={brandId} featureSlug={featureSlug} />
      </Suspense>
    </div>
  );
}

async function PitchesSection({
  orgId,
  brandId,
  featureSlug,
}: {
  orgId: string;
  brandId: string;
  featureSlug: string;
}) {
  const pitches = await fetchQuotePitchesByBrand(orgId, brandId);

  const csvColumns: CsvColumn<QuotePitch>[] = [
    { label: "Status", value: (p) => p.status },
    { label: "Pitch", value: (p) => p.draft ?? "" },
    { label: "Delivery method", value: (p) => p.deliveryMethod },
    { label: "Characters", value: (p) => p.pitchCharCount ?? "" },
    { label: "Submitted", value: (p) => p.submittedAt ?? "" },
    { label: "Article URL", value: (p) => p.featuredArticleUrl ?? "" },
    { label: "Error", value: (p) => p.error ?? "" },
  ];

  return (
    <SectionCard
      title="Pitches"
      description="Drafted and submitted pitches for journalist quote requests."
      count={pitches.length}
      actions={
        <CsvDownloadButton
          filename={`pitches-${featureSlug}.csv`}
          csv={toCsv(pitches, csvColumns)}
          isEmpty={pitches.length === 0}
        />
      }
    >
      {pitches.length === 0 ? (
        <EmptyState message="No pitches yet. They appear here once a quote opportunity is drafted or sent." />
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50">
            <tr>
              {PITCHES_COLUMNS.map((label) => (
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
            {pitches.map((p) => (
              <Row key={p.id} pitch={p} />
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}

function Row({ pitch }: { pitch: QuotePitch }) {
  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="px-4 py-3 whitespace-nowrap">
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[pitch.status]}`}
        >
          {pitch.status}
        </span>
      </td>
      <td className="px-4 py-3 max-w-md">
        {pitch.draft ? (
          <p
            className="text-xs text-gray-700 line-clamp-3 whitespace-pre-line"
            title={pitch.draft}
          >
            {pitch.draft}
          </p>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
        {pitch.error && (
          <p className="text-xs text-red-600 mt-1">{pitch.error}</p>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
        {pitch.deliveryMethod === "featured_api" ? "Featured" : "Email reply"}
        {pitch.pitchCharCount != null && (
          <span className="text-gray-400"> · {pitch.pitchCharCount} chars</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
        {formatDate(pitch.submittedAt)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {pitch.featuredArticleUrl ? (
          <a
            href={pitch.featuredArticleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline text-xs"
          >
            View article →
          </a>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
}
