import type { Brand } from "@/lib/api";

interface ReportHeaderProps {
  brand: Brand | null;
  brandId: string;
  orgName: string;
  featureSlug: string;
  generatedAt: Date;
}

const FEATURE_LABELS: Record<string, string> = {
  "sales-cold-email-outreach": "Sales Cold Email Outreach",
};

export function ReportHeader({ brand, brandId, orgName, featureSlug, generatedAt }: ReportHeaderProps) {
  const featureLabel = FEATURE_LABELS[featureSlug] ?? featureSlug;
  const brandName = brand?.name || brand?.domain || "this brand";
  void brandId;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={`${brandName} logo`}
              width={56}
              height={56}
              className="rounded-lg border border-gray-200 bg-white object-contain"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xl font-semibold">
              {brandName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-800">{brandName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{featureLabel} report</p>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>
            Generated{" "}
            <time dateTime={generatedAt.toISOString()}>
              {generatedAt.toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>
          </div>
          <div className="text-gray-400 mt-0.5">Prepared by {orgName}</div>
        </div>
      </div>
    </header>
  );
}
