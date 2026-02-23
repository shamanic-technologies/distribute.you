"use client";

import { useState } from "react";
import { BrandLeaderboard, WorkflowLeaderboard } from "./leaderboard-table";
import type { BrandLeaderboardEntry, WorkflowLeaderboardEntry } from "@/lib/fetch-leaderboard";

type Tab = "workflow" | "brand";

export function SectionLeaderboard({
  brands,
  workflows,
  maxEntries = 5,
}: {
  brands: BrandLeaderboardEntry[];
  workflows: WorkflowLeaderboardEntry[];
  maxEntries?: number;
}) {
  const [tab, setTab] = useState<Tab>("workflow");

  return (
    <div>
      <div className="flex gap-1 mb-4">
        <TabButton active={tab === "workflow"} onClick={() => setTab("workflow")}>
          By Workflow
        </TabButton>
        <TabButton active={tab === "brand"} onClick={() => setTab("brand")}>
          By Brand
        </TabButton>
      </div>

      {tab === "workflow" ? (
        workflows.length > 0 ? (
          <WorkflowLeaderboard workflows={workflows.slice(0, maxEntries)} />
        ) : (
          <p className="text-sm text-gray-500 py-4">No workflow data yet.</p>
        )
      ) : brands.length > 0 ? (
        <BrandLeaderboard brands={brands.slice(0, maxEntries)} />
      ) : (
        <p className="text-sm text-gray-500 py-4">No brand data yet.</p>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
        active
          ? "bg-primary-50 text-primary-700 border border-primary-200"
          : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent"
      }`}
    >
      {children}
    </button>
  );
}
