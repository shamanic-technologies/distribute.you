"use client";

import { McpSidebar } from "./mcp-sidebar";
import { CampaignStats } from "@/lib/api";

// Icons as SVG components
const OverviewIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const CompaniesIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const LeadsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const EmailsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);


const WorkflowIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

const OutletsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const JournalistsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
  </svg>
);

interface CampaignSidebarProps {
  campaignId: string;
  orgId: string;
  brandId: string;
  sectionKey: string;
  stats?: CampaignStats;
  emailCount?: number;
  leadCount?: number;
  companyCount?: number;
  outletCount?: number;
  journalistCount?: number;
  workflowId?: string;
}

export function CampaignSidebar({ campaignId, orgId, brandId, sectionKey, stats, emailCount, leadCount, companyCount, outletCount, journalistCount, workflowId }: CampaignSidebarProps) {
  const basePath = `/orgs/${orgId}/brands/${brandId}/features/${sectionKey}/campaigns/${campaignId}`;
  const backHref = `/orgs/${orgId}/brands/${brandId}/features/${sectionKey}`;

  const isDiscovery = sectionKey === "outlets-database-discovery" || sectionKey === "journalists-database-discovery";

  const outreachItems = [
    {
      id: "companies",
      label: "Companies",
      href: `${basePath}/companies`,
      icon: <CompaniesIcon />,
      badge: companyCount ?? undefined,
    },
    {
      id: "leads",
      label: "Leads",
      href: `${basePath}/leads`,
      icon: <LeadsIcon />,
      badge: leadCount ?? undefined,
    },
    {
      id: "emails",
      label: "Emails",
      href: `${basePath}/emails`,
      icon: <EmailsIcon />,
      badge: emailCount ?? undefined,
    },
  ];

  const discoveryItems = [
    ...(sectionKey === "outlets-database-discovery"
      ? [{
          id: "outlets",
          label: "Outlets",
          href: `${basePath}/outlets`,
          icon: <OutletsIcon />,
          badge: outletCount ?? undefined,
        }]
      : []),
    ...(sectionKey === "journalists-database-discovery"
      ? [{
          id: "journalists",
          label: "Journalists",
          href: `${basePath}/journalists`,
          icon: <JournalistsIcon />,
          badge: journalistCount ?? undefined,
        }]
      : []),
  ];

  const items = [
    {
      id: "overview",
      label: "Overview",
      href: basePath,
      icon: <OverviewIcon />,
    },
    ...(isDiscovery ? discoveryItems : outreachItems),
    ...(workflowId
      ? [
          {
            id: "workflow",
            label: "Workflow",
            href: `/orgs/${orgId}/brands/${brandId}/features/${sectionKey}/workflows/${workflowId}`,
            icon: <WorkflowIcon />,
          },
        ]
      : []),
  ];

  return (
    <McpSidebar
      items={items}
      title="Campaign"
      backHref={backHref}
      backLabel="Campaigns"
    />
  );
}
