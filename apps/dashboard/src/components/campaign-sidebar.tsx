"use client";

import { useState, type ReactNode } from "react";
import { McpSidebar } from "./mcp-sidebar";
import { useFeatures } from "@/lib/features-context";
import { useEntityRegistry } from "@/lib/entity-registry-context";
import { CampaignInputsPanel } from "./campaign/campaign-inputs-panel";
import { CampaignPromptPanel } from "./campaign/campaign-prompt-panel";
import { isExpertQuoteFeature } from "@/lib/expert-quote-feature";

// Only the PR-Expert quote family has an editable generation prompt today (the
// GENERATE button on the quote-requests page renders the expert-quote-pitch
// template). Gate the Prompt button to that family until other features wire a
// template. Keyed on the family helper, not a single slug, so a workflow
// re-version (e.g. -opportunities → -outreach) doesn't drop the button.

// Icons as SVG components
const OverviewIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const WorkflowIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

const RunsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LogsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

const InputsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PromptIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m-6 4h6m-3 8l-4-4H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-3 3z" />
  </svg>
);

// Icon name → SVG component mapping for entity registry icons
const ICON_MAP: Record<string, () => ReactNode> = {
  users: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  newspaper: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  "pen-tool": () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  ),
  "scroll-text": () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  building: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  envelope: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  document: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  "help-circle": () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 4M12 17h.01" />
    </svg>
  ),
  quote: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h3v6H7zM7 13c0 2 1 3 3 3M14 7h3v6h-3zM14 13c0 2 1 3 3 3" />
    </svg>
  ),
  sparkles: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M19 13v4M17 15h4M11 5l1.5 4 4 1.5-4 1.5L11 16l-1.5-4-4-1.5 4-1.5L11 5z" />
    </svg>
  ),
  "message-square": () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  swords: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M5 17l-2 2M3 19l2 2" />
    </svg>
  ),
};

function getEntityIcon(iconName: string): ReactNode {
  const iconFn = ICON_MAP[iconName];
  if (iconFn) return iconFn();
  // Fallback: generic icon
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
    </svg>
  );
}

interface CampaignSidebarProps {
  campaignId: string;
  orgId: string;
  brandId: string;
  featureSlug: string;
  entityCounts?: Record<string, number | "loading" | undefined>;
  workflowId?: string;
  featureInputs?: Record<string, string> | null;
}

export function CampaignSidebar({ campaignId, orgId, brandId, featureSlug, entityCounts, workflowId, featureInputs }: CampaignSidebarProps) {
  const [inputsPanelOpen, setInputsPanelOpen] = useState(false);
  const [promptPanelOpen, setPromptPanelOpen] = useState(false);
  const { getFeature, isLoading: featuresLoading } = useFeatures();
  const { registry, isLoading: registryLoading } = useEntityRegistry();
  // Reveal the whole nav together once the feature + entity registry defs load
  // (entity items depend on them); skeleton rows until then. See CLAUDE.md → "Coordinated reveal".
  const defsReady = !featuresLoading && !registryLoading;
  const basePath = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/campaigns/${campaignId}`;
  const backHref = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}`;

  const featureDef = getFeature(featureSlug);
  const entities = featureDef?.entities ?? [];

  const hasInputs = featureInputs && Object.values(featureInputs).some(Boolean);
  const showPromptButton = isExpertQuoteFeature(featureSlug);

  const entityItems = entities
    .filter((e) => registry[e.name])
    .map((e) => {
      const config = registry[e.name];
      return {
        id: e.name,
        label: config.label,
        href: `${basePath}/${config.pathSuffix}`,
        icon: getEntityIcon(config.icon),
        badge: entityCounts?.[e.name] ?? undefined,
      };
    });

  const items = [
    {
      id: "overview",
      label: "Overview",
      href: basePath,
      icon: <OverviewIcon />,
    },
  ];

  const settingsItems = [
    ...(workflowId
      ? [
          {
            id: "workflow",
            label: "Workflow",
            href: `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/workflows/${workflowId}`,
            icon: <WorkflowIcon />,
          },
        ]
      : []),
    {
      id: "runs",
      label: "Runs",
      href: `${basePath}/runs`,
      icon: <RunsIcon />,
    },
    {
      id: "logs",
      label: "Logs",
      href: `${basePath}/logs`,
      icon: <LogsIcon />,
    },
  ];

  return (
    <>
      <McpSidebar
        navPending={!defsReady}
        items={items}
        outcomesItems={entityItems}
        settingsItems={settingsItems}
        settingsExtra={(showPromptButton || hasInputs) ? (
          <>
            {showPromptButton && (
              <button
                onClick={() => setPromptPanelOpen(true)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition text-gray-600 hover:bg-gray-50 hover:text-gray-800 w-full"
              >
                <span className="w-5 h-5 text-gray-400"><PromptIcon /></span>
                <span className="flex-1 text-left">Prompt</span>
              </button>
            )}
            {hasInputs && (
              <button
                onClick={() => setInputsPanelOpen(true)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition text-gray-600 hover:bg-gray-50 hover:text-gray-800 w-full"
              >
                <span className="w-5 h-5 text-gray-400"><InputsIcon /></span>
                <span className="flex-1 text-left">Inputs</span>
              </button>
            )}
          </>
        ) : undefined}
        title="Campaign"
        backHref={backHref}
        backLabel="Campaigns"
      />
      <CampaignInputsPanel
        open={inputsPanelOpen}
        onClose={() => setInputsPanelOpen(false)}
        featureInputs={featureInputs ?? null}
      />
      {showPromptButton && (
        <CampaignPromptPanel
          open={promptPanelOpen}
          onClose={() => setPromptPanelOpen(false)}
          featureSlug={featureSlug}
        />
      )}
    </>
  );
}
