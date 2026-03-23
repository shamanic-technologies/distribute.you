"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getBrand, getBrandSalesProfile, listBrandRuns, createBrandSalesProfile, refreshBrandSalesProfile, type SalesProfile, type BrandRun, type RunCost, type Testimonial } from "@/lib/api";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatCost(cents: string | null | undefined): string | null {
  if (!cents) return null;
  const val = parseFloat(cents);
  if (isNaN(val) || val === 0) return null;
  const usd = val / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function formatDuration(startedAt: string, completedAt: string | null): string | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return "<1s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return u.hostname + path;
  } catch {
    return url;
  }
}

export default function BrandInfoPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<BrandRun | null>(null);
  const queryClient = useQueryClient();

  const { data: brandData, isLoading: brandLoading } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
    pollOptions,
  );
  const brand = brandData?.brand ?? null;
  const brandName = brand?.name ?? null;

  const { data: profileData, error: profileError, isLoading: profileLoading } = useAuthQuery(
    ["brandSalesProfile", brandId],
    () => getBrandSalesProfile(brandId),
    pollOptions,
  );
  const profile = profileData?.profile ?? null;
  const profileCached = profileData?.cached ?? false;
  const error = profileError?.message ?? null;

  const { data: runsData, isLoading: runsLoading } = useAuthQuery(
    ["brandRuns", brandId],
    () => listBrandRuns(brandId),
    pollOptions,
  );
  const runs = runsData?.runs ?? [];

  const totalCostUsd = runs.reduce((sum, run) => {
    const cents = parseFloat(run.totalCostInUsdCents ?? "0");
    return sum + (isNaN(cents) ? 0 : cents);
  }, 0) / 100;

  // Find the latest completed sales-profile-extraction run to attach scrapedUrls
  const latestExtractionRunId = runs.find(
    (r) => r.taskName === "sales-profile-extraction" && r.status === "completed"
  )?.id ?? null;

  const scrapedUrls = profile?.scrapedUrls ?? [];

  const handleGenerate = async () => {
    if (!brand || generating) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      if (profile) {
        await refreshBrandSalesProfile(brandId);
      } else {
        await createBrandSalesProfile(brandId);
      }
      await queryClient.invalidateQueries({ queryKey: ["brandSalesProfile", brandId] });
      await queryClient.invalidateQueries({ queryKey: ["brandRuns", brandId] });
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (brandLoading || profileLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-gray-500">Brand not found</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Error: {error}</p>
        </div>
      </div>
    );
  }

  const EmptyPlaceholder = () => (
    <p className="text-sm text-gray-400 italic">This section has not been populated yet.</p>
  );

  const Section = ({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-3">{title}</h2>
      {empty ? <EmptyPlaceholder /> : children}
    </div>
  );

  const List = ({ items }: { items: string[] }) => (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
          <span className="text-brand-500 mt-1">-</span>
          {item}
        </li>
      ))}
    </ul>
  );

  const Tags = ({ items, variant = "primary" }: { items: string[]; variant?: "primary" | "gray" }) => (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span
          key={i}
          className={`text-xs px-2 py-0.5 rounded ${
            variant === "primary"
              ? "bg-brand-50 text-brand-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Brand Info</h1>
        <div className="flex items-center gap-4">
          {activeTab === "current" && profile?.extractedAt && (
            <div className="text-right">
              <span className="text-xs text-gray-400 block">
                Updated: {new Date(profile.extractedAt).toLocaleDateString()}
              </span>
              <span className="text-xs text-gray-400 block">
                Total: {totalCostUsd < 1 ? "<$1" : `$${Math.round(totalCostUsd)}`}
              </span>
            </div>
          )}
          {activeTab === "current" && brand && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {generating ? (profile ? "Regenerating..." : "Generating...") : (profile ? "Regenerate" : "Generate")}
            </button>
          )}
        </div>
      </div>

      {generateError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-red-600">{generateError}</p>
          <button onClick={() => setGenerateError(null)} className="text-red-400 hover:text-red-600 text-sm ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("current")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "current"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Current Version
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "history"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Update History
        </button>
      </div>

      {/* Current Version Tab */}
      {activeTab === "current" && (
        <>
          {!profile ? (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
              <svg
                className="w-12 h-12 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No brand info yet</h3>
              <p className="text-gray-500 text-sm">
                Brand information will be automatically extracted when you run a campaign.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Section title="Brand Name" empty={!brandName}>
                <p className="text-gray-700 font-medium">{brandName}</p>
              </Section>

              <Section title="Value Proposition" empty={!profile.valueProposition}>
                <p className="text-gray-700">{profile.valueProposition}</p>
              </Section>

              <Section title="Company Overview" empty={!profile.companyOverview}>
                <p className="text-gray-700">{profile.companyOverview}</p>
              </Section>

              <Section title="Target Audience" empty={!profile.targetAudience}>
                <p className="text-gray-700">{profile.targetAudience}</p>
              </Section>

              <Section title="Customer Pain Points" empty={!profile.customerPainPoints?.length}>
                <List items={profile.customerPainPoints ?? []} />
              </Section>

              <Section title="Key Features" empty={!profile.keyFeatures?.length}>
                <Tags items={profile.keyFeatures ?? []} variant="primary" />
              </Section>

              <Section title="Product Differentiators" empty={!profile.productDifferentiators?.length}>
                <List items={profile.productDifferentiators ?? []} />
              </Section>

              <Section title="Competitors" empty={!profile.competitors?.length}>
                <Tags items={profile.competitors ?? []} variant="gray" />
              </Section>

              <Section title="Leadership" empty={!profile.leadership?.length}>
                <div className="space-y-3">
                  {(profile.leadership ?? []).map((member, i) => (
                    <div key={i} className="border-l-2 border-brand-200 pl-3">
                      <p className="text-sm font-medium text-gray-800">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.role}</p>
                      {member.bio && <p className="text-sm text-gray-600 mt-1">{member.bio}</p>}
                      {member.notableBackground && (
                        <p className="text-xs text-gray-500 mt-1 italic">{member.notableBackground}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                title="Funding"
                empty={!profile.funding?.totalRaised && !profile.funding?.rounds?.length && !profile.funding?.notableBackers?.length}
              >
                <div className="space-y-3">
                  {profile.funding?.totalRaised && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Total Raised:</span> {profile.funding.totalRaised}
                    </p>
                  )}
                  {profile.funding?.rounds?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Rounds</h3>
                      <div className="space-y-2">
                        {profile.funding.rounds.map((round, i) => (
                          <div key={i} className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3">
                            <span className="font-medium">{round.type}</span>
                            {round.amount && <span> &mdash; {round.amount}</span>}
                            {round.date && <span className="text-xs text-gray-400 ml-2">({round.date})</span>}
                            {round.notableInvestors?.length > 0 && (
                              <p className="text-xs text-gray-500 mt-0.5">Investors: {round.notableInvestors.join(", ")}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.funding?.notableBackers?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-1">Notable Backers</h3>
                      <Tags items={profile.funding.notableBackers} variant="gray" />
                    </div>
                  )}
                </div>
              </Section>

              <Section title="Awards & Recognition" empty={!profile.awardsAndRecognition?.length}>
                <div className="space-y-2">
                  {(profile.awardsAndRecognition ?? []).map((award, i) => (
                    <div key={i} className="text-sm border-l-2 border-yellow-200 pl-3">
                      <p className="font-medium text-gray-800">
                        {award.title}
                        {award.year && <span className="text-xs text-gray-400 ml-2">({award.year})</span>}
                      </p>
                      {award.issuer && <p className="text-xs text-gray-500">{award.issuer}</p>}
                      {award.description && <p className="text-gray-600 mt-0.5">{award.description}</p>}
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Revenue Milestones" empty={!profile.revenueMilestones?.length}>
                <div className="space-y-2">
                  {(profile.revenueMilestones ?? []).map((m, i) => (
                    <div key={i} className="text-sm border-l-2 border-green-200 pl-3">
                      <p className="text-gray-800">
                        <span className="font-medium">{m.metric}:</span> {m.value}
                        {m.date && <span className="text-xs text-gray-400 ml-2">({m.date})</span>}
                      </p>
                      {m.context && <p className="text-xs text-gray-500 mt-0.5">{m.context}</p>}
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                title="Social Proof"
                empty={
                  !profile.socialProof?.caseStudies?.length &&
                  !profile.socialProof?.testimonials?.length &&
                  !profile.socialProof?.results?.length
                }
              >
                {profile.socialProof?.caseStudies?.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Case Studies</h3>
                    <List items={profile.socialProof.caseStudies} />
                  </div>
                )}
                {profile.socialProof?.testimonials?.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Testimonials</h3>
                    <ul className="space-y-2">
                      {profile.socialProof.testimonials.map((t, i) => (
                        <li key={i} className="text-sm text-gray-600 border-l-2 border-brand-200 pl-3">
                          {typeof t === "string" ? (
                            <p>{t}</p>
                          ) : (
                            <>
                              <p className="italic">&ldquo;{t.quote}&rdquo;</p>
                              {(t.name || t.role || t.company) && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {[t.name, t.role, t.company].filter(Boolean).join(" - ")}
                                </p>
                              )}
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {profile.socialProof?.results?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Results</h3>
                    <List items={profile.socialProof.results} />
                  </div>
                )}
              </Section>

              <Section title="Call to Action" empty={!profile.callToAction}>
                <p className="text-gray-700">{profile.callToAction}</p>
              </Section>

              <Section title="Additional Context" empty={!profile.additionalContext}>
                <p className="text-gray-700">{profile.additionalContext}</p>
              </Section>
            </div>
          )}
        </>
      )}

      {/* Update History Tab */}
      {activeTab === "history" && (
        <>
          {runsLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-4xl mb-4">&#128203;</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No runs yet</h3>
              <p className="text-gray-500 text-sm">
                Run history will appear here after campaigns execute.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => {
                const isLatestExtraction = run.id === latestExtractionRunId;
                const runScrapedUrls = isLatestExtraction ? scrapedUrls : [];
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRun(run)}
                    className="w-full text-left bg-white rounded-lg border border-gray-200 p-4 hover:border-brand-300 hover:shadow-sm transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            run.status === "completed"
                              ? "bg-green-500"
                              : run.status === "failed"
                              ? "bg-red-500"
                              : "bg-yellow-500"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {run.taskName === "sales-profile-extraction" ? "Sales Profile Extraction" :
                             run.taskName === "icp-extraction" ? "ICP Extraction" :
                             run.taskName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {timeAgo(run.startedAt)}
                            {run.status !== "completed" && (
                              <span className="ml-2 text-gray-400">({run.status})</span>
                            )}
                          </p>
                          {runScrapedUrls.length > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {runScrapedUrls.length} page{runScrapedUrls.length !== 1 ? "s" : ""} scraped: {runScrapedUrls.map(shortenUrl).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {formatCost(run.totalCostInUsdCents) && (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                            {formatCost(run.totalCostInUsdCents)}
                          </span>
                        )}
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    {run.status === "failed" && run.errorSummary && (
                      <div className="mt-2 bg-red-50 border border-red-100 rounded-md p-3">
                        <p className="text-sm text-red-700">{run.errorSummary.rootCause}</p>
                        <p className="text-xs text-red-500 mt-1">
                          Step: <span className="font-mono">{run.errorSummary.failedStep}</span>
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Run Detail Panel */}
      {selectedRun && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSelectedRun(null)}
          />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto border-l border-gray-200 animate-slide-in-right">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Run Details</h2>
              <button
                onClick={() => setSelectedRun(null)}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Status & Task */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      selectedRun.status === "completed"
                        ? "bg-green-500"
                        : selectedRun.status === "failed"
                        ? "bg-red-500"
                        : "bg-yellow-500"
                    }`}
                  />
                  <span className="text-sm font-medium text-gray-800 capitalize">{selectedRun.status}</span>
                </div>
                <p className="text-sm text-gray-600">
                  {selectedRun.taskName === "sales-profile-extraction" ? "Sales Profile Extraction" :
                   selectedRun.taskName === "icp-extraction" ? "ICP Extraction" :
                   selectedRun.taskName}
                </p>
              </div>

              {/* Timing */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Timing</h3>
                <div className="text-sm text-gray-700 space-y-1">
                  <p>Started: {new Date(selectedRun.startedAt).toLocaleString()}</p>
                  {selectedRun.completedAt && (
                    <p>Completed: {new Date(selectedRun.completedAt).toLocaleString()}</p>
                  )}
                  {formatDuration(selectedRun.startedAt, selectedRun.completedAt) && (
                    <p>Duration: {formatDuration(selectedRun.startedAt, selectedRun.completedAt)}</p>
                  )}
                </div>
              </div>

              {/* Cost Breakdown */}
              {selectedRun.costs?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cost Breakdown</h3>
                  <div className="space-y-1">
                    {selectedRun.costs.map((cost, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{cost.costName}</span>
                        <span className="text-gray-800 font-mono text-xs">
                          {formatCost(cost.totalCostInUsdCents) ?? "-"}
                        </span>
                      </div>
                    ))}
                    {formatCost(selectedRun.totalCostInUsdCents) && (
                      <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-100">
                        <span className="text-gray-700 font-medium">Total</span>
                        <span className="text-gray-900 font-medium font-mono text-xs">
                          {formatCost(selectedRun.totalCostInUsdCents)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Scraped URLs */}
              {selectedRun.id === latestExtractionRunId && scrapedUrls.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Scraped URLs ({scrapedUrls.length})
                  </h3>
                  <div className="space-y-1">
                    {scrapedUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-brand-600 hover:text-brand-700 hover:underline truncate"
                      >
                        {shortenUrl(url)}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Details */}
              {selectedRun.status === "failed" && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Error</h3>
                  {selectedRun.errorSummary ? (
                    <div className="bg-red-50 border border-red-100 rounded-md p-3">
                      <p className="text-sm text-red-700">{selectedRun.errorSummary.rootCause}</p>
                      <p className="text-xs text-red-500 mt-1">
                        Step: <span className="font-mono">{selectedRun.errorSummary.failedStep}</span>
                      </p>
                    </div>
                  ) : selectedRun.error ? (
                    <p className="text-sm text-red-600">{selectedRun.error}</p>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No error details available</p>
                  )}
                </div>
              )}

              {/* Run ID */}
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Run ID</h3>
                <p className="text-xs text-gray-400 font-mono break-all">{selectedRun.id}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
