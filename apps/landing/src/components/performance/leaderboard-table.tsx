"use client";

import { useState } from "react";
import Image from "next/image";
import { FEATURE_LABELS } from "@distribute/content";
import {
  formatPercent,
  formatCostCents,
  formatCostCentsWhole,
  formatWorkflowName,
  formatCostDollars,
  type BrandLeaderboardEntry,
  type WorkflowLeaderboardEntry,
} from "@/lib/performance/fetch-leaderboard";
import { defaultDir, compareForSort, type SortKey } from "@/lib/performance/sort-direction";

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
type BrandSortKey = Extract<SortKey, keyof BrandLeaderboardEntry>;

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <th
      className="dy-mono cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--dy-muted)] hover:text-[var(--dy-accent-hi)]"
      onClick={() => onSort(sortKey)}
    >
      {label} {active ? (currentDir === "desc" ? "↓" : "↑") : ""}
    </th>
  );
}

export function BrandLeaderboard({ brands, maxEntries }: { brands: BrandLeaderboardEntry[]; maxEntries?: number }) {
  const [sortKey, setSortKey] = useState<BrandSortKey>("costPerReplyCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: SortKey) {
    const brandKey = key as BrandSortKey;
    if (brandKey === sortKey) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(brandKey);
      setSortDir(defaultDir(brandKey));
    }
  }

  const sorted = [...brands].sort((a, b) =>
    compareForSort(a[sortKey], b[sortKey], sortDir),
  );

  const visible = maxEntries ? sorted.slice(0, maxEntries) : sorted;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[var(--dy-border)]">
        <thead>
          <tr>
            <th className="dy-mono px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--dy-muted)]">
              Brand
            </th>
            <SortHeader label="% Opens" sortKey="openRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="$/Open" sortKey="costPerOpenCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="% Clicks" sortKey="clickRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="$/Click" sortKey="costPerClickCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="% Positive Replies" sortKey="replyRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="$/Positive Reply" sortKey="costPerReplyCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Expected revenue" sortKey="expectedRevenueUsd" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="ROI" sortKey="roiMultiple" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--dy-border)]">
          {visible.map((brand, i) => (
            <tr key={brand.brandId || brand.brandDomain || i} className="hover:bg-[var(--dy-surface-hi)]">
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  {brand.brandDomain && LOGO_DEV_TOKEN ? (
                    <Image
                      src={`https://img.logo.dev/${brand.brandDomain}?token=${LOGO_DEV_TOKEN}&size=64`}
                      alt={brand.brandDomain}
                      width={28}
                      height={28}
                      className="rounded"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--dy-accent-dim)] text-sm font-bold text-[var(--dy-accent-hi)]">
                      {(brand.brandName || brand.brandDomain || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-[var(--dy-text)]">
                    {brand.brandName || brand.brandDomain || "Unknown"}
                  </span>
                </div>
              </td>
              <td className="px-4 py-4 text-sm text-[var(--dy-sub)]">{brand.emailsSent > 0 ? formatPercent(brand.openRate) : "—"}</td>
              <td className="px-4 py-4 text-sm text-[var(--dy-sub)]">{formatCostCents(brand.costPerOpenCents)}</td>
              <td className="px-4 py-4 text-sm text-[var(--dy-sub)]">{brand.emailsSent > 0 ? formatPercent(brand.clickRate) : "—"}</td>
              <td className="px-4 py-4 text-sm text-[var(--dy-sub)]">{formatCostCents(brand.costPerClickCents)}</td>
              <td className="px-4 py-4 text-sm text-[var(--dy-sub)]">{brand.emailsSent > 0 ? formatPercent(brand.replyRate) : "—"}</td>
              <td className="px-4 py-4 text-sm text-[var(--dy-text)]">{formatCostCentsWhole(brand.costPerReplyCents)}</td>
              <td className="px-4 py-4 text-sm font-medium text-[var(--dy-text)]">{formatRevenueUsd(brand.expectedRevenueUsd)}</td>
              <td className="px-4 py-4 text-sm font-medium text-[var(--dy-text)]">{formatRoi(brand.roiMultiple)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatRevenueUsd(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value === 0) return "$0";
  if (value < 100) return `$${value.toFixed(2)}`;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatRoi(value: number | null | undefined): string {
  return value == null ? "—" : `${value.toFixed(1)}×`;
}

export function WorkflowLeaderboard({ workflows, inSection = false, maxEntries }: { workflows: WorkflowLeaderboardEntry[]; inSection?: boolean; maxEntries?: number }) {
  const [sortKey, setSortKey] = useState<SortKey>("costPerReplyCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<WorkflowLeaderboardEntry | null>(null);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir(defaultDir(key));
    }
  }

  const sorted = [...workflows].sort((a, b) =>
    compareForSort(a[sortKey as keyof WorkflowLeaderboardEntry], b[sortKey as keyof WorkflowLeaderboardEntry], sortDir),
  );

  const visible = maxEntries ? sorted.slice(0, maxEntries) : sorted;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--dy-border)]">
          <thead>
            <tr>
              <th className="dy-mono px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--dy-muted)]">
                Workflow
              </th>
              <SortHeader label="% Opens" sortKey="openRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="$/Open" sortKey="costPerOpenCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="% Clicks" sortKey="clickRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="$/Click" sortKey="costPerClickCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="% Positive Replies" sortKey="replyRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="$/Positive Reply" sortKey="costPerReplyCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Expected revenue" sortKey="expectedRevenueUsd" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="ROI" sortKey="roiMultiple" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--dy-border)]">
            {visible.map((wf) => (
              <tr
                key={wf.workflowName}
                className={`cursor-pointer hover:bg-[var(--dy-surface-hi)] ${selected?.workflowName === wf.workflowName ? "bg-[var(--dy-accent-dim)]" : ""}`}
                onClick={() => setSelected(selected?.workflowName === wf.workflowName ? null : wf)}
              >
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--dy-text)]">
                      {inSection && wf.workflowDynastySignatureName
                        ? wf.workflowDynastySignatureName.charAt(0).toUpperCase() + wf.workflowDynastySignatureName.slice(1)
                        : wf.workflowDynastyName || formatWorkflowName(wf.workflowName)}
                    </span>
                    {!inSection && wf.featureSlug && (
                      <span className="rounded-full bg-[var(--dy-surface-hi)] px-2 py-0.5 text-xs text-[var(--dy-sub)]">
                        {FEATURE_LABELS[wf.featureSlug] ?? wf.featureSlug}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-[var(--dy-sub)]">{wf.emailsSent > 0 ? formatPercent(wf.openRate) : "—"}</td>
                <td className="px-4 py-4 text-sm text-[var(--dy-sub)]">{formatCostCents(wf.costPerOpenCents)}</td>
                <td className="px-4 py-4 text-sm text-[var(--dy-sub)]">{wf.emailsSent > 0 ? formatPercent(wf.clickRate) : "—"}</td>
                <td className="px-4 py-4 text-sm text-[var(--dy-sub)]">{formatCostCents(wf.costPerClickCents)}</td>
                <td className="px-4 py-4 text-sm text-[var(--dy-sub)]">{wf.emailsSent > 0 ? formatPercent(wf.replyRate) : "—"}</td>
                <td className="px-4 py-4 text-sm text-[var(--dy-text)]">{formatCostCentsWhole(wf.costPerReplyCents)}</td>
                <td className="px-4 py-4 text-sm font-medium text-[var(--dy-text)]">{formatRevenueUsd(wf.expectedRevenueUsd)}</td>
                <td className="px-4 py-4 text-sm font-medium text-[var(--dy-text)]">{formatRoi(wf.roiMultiple)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <WorkflowDetailPanel workflow={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function WorkflowDetailPanel({ workflow: wf, onClose }: { workflow: WorkflowLeaderboardEntry; onClose: () => void }) {
  const name = wf.workflowDynastySignatureName
    ? wf.workflowDynastySignatureName.charAt(0).toUpperCase() + wf.workflowDynastySignatureName.slice(1)
    : wf.workflowDynastyName || formatWorkflowName(wf.workflowName);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="animate-slide-in fixed right-0 top-0 z-50 h-full w-full max-w-sm overflow-y-auto border-l border-[var(--dy-border-hi)] bg-[var(--dy-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--dy-border-hi)] px-6 py-4">
          <h3 className="text-lg font-semibold text-[var(--dy-text)]">{name}</h3>
          <button onClick={onClose} className="text-xl leading-none text-[var(--dy-muted)] hover:text-[var(--dy-text)]">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <DetailStat label="Total Spent" value={formatCostDollars(wf.totalCostUsdCents)} />
            <DetailStat label="Expected Revenue" value={formatRevenueUsd(wf.expectedRevenueUsd)} />
            <DetailStat label="ROI" value={formatRoi(wf.roiMultiple)} />
            <DetailStat label="Emails Sent" value={wf.emailsSent > 0 ? wf.emailsSent.toLocaleString() : "—"} />
            <DetailStat label="Runs" value={wf.runCount > 0 ? wf.runCount.toLocaleString() : "—"} />
          </div>

          <div>
            <h4 className="dy-mono mb-3 text-xs font-medium uppercase tracking-wider text-[var(--dy-muted)]">Rates</h4>
            <div className="space-y-2">
              <DetailRow label="Open Rate" value={wf.emailsSent > 0 ? formatPercent(wf.openRate) : "—"} sub={`${wf.emailsOpened.toLocaleString()} opens`} />
              <DetailRow label="Click Rate" value={wf.emailsSent > 0 ? formatPercent(wf.clickRate) : "—"} sub={`${wf.emailsClicked.toLocaleString()} clicks`} />
              <DetailRow label="Positive Reply Rate" value={wf.emailsSent > 0 ? formatPercent(wf.replyRate) : "—"} sub={`${wf.emailsReplied.toLocaleString()} positive replies`} />
            </div>
          </div>

          <div>
            <h4 className="dy-mono mb-3 text-xs font-medium uppercase tracking-wider text-[var(--dy-muted)]">Cost per Action</h4>
            <div className="space-y-2">
              <DetailRow label="$/Open" value={formatCostCents(wf.costPerOpenCents)} />
              <DetailRow label="$/Click" value={formatCostCents(wf.costPerClickCents)} />
              <DetailRow label="$/Positive Reply" value={formatCostCentsWhole(wf.costPerReplyCents)} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--dy-surface-hi)] p-3">
      <div className="text-xs text-[var(--dy-muted)]">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-[var(--dy-text)]">{value}</div>
    </div>
  );
}

function DetailRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <span className="text-sm text-[var(--dy-sub)]">{label}</span>
        {sub && <span className="ml-2 text-xs text-[var(--dy-muted)]">{sub}</span>}
      </div>
      <span className="text-sm font-medium text-[var(--dy-text)]">{value}</span>
    </div>
  );
}
