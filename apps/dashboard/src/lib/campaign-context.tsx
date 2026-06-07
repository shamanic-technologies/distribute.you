"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { getCampaign, getCampaignStats, listCampaignEmails, listCampaignLeads, type Campaign, type CampaignStats, type Email, type Lead } from "./api";

interface CampaignContextType {
  campaign: Campaign | null;
  stats: CampaignStats | null;
  emails: Email[];
  leads: Lead[];
  loading: boolean;
  // Per-entity loading. `loading` gates ONLY the campaign query; emails/leads are
  // independent queries, so entity pages must gate their own skeleton on these —
  // gating on `loading` hides the skeleton the moment the campaign resolves while
  // the entity list is still fetching, flashing an empty state.
  emailsLoading: boolean;
  leadsLoading: boolean;
  setCampaign: (campaign: Campaign | null) => void;
  refreshStats: () => Promise<void>;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

interface CampaignProviderProps {
  children: ReactNode;
  campaignId: string;
}

const EMPTY_EMAILS: Email[] = [];
const EMPTY_LEADS: Lead[] = [];
const noop = () => {};

export function CampaignProvider({ children, campaignId }: CampaignProviderProps) {
  const queryClient = useQueryClient();

  // Gate on isPending, NOT isLoading. The org-consistency gate in useAuthQuery
  // disables the query (enabled:false) until Clerk's active org resolves and
  // matches the URL org. A disabled v5 query reports isPending:true but
  // isLoading:false (isLoading = isPending && isFetching, and isFetching is
  // false while idle). Driving `loading` off isLoading would flip it false
  // during that settle window with campaign still null → the page renders its
  // "Campaign not found" red-cross flash before the fetch ever runs. isPending
  // stays true until the query RESOLVES (success or error), so not-found shows
  // only when the campaign genuinely doesn't exist.
  const { data: campaignData, isPending: campaignLoading } = useAuthQuery(
    ["campaign", campaignId],
    () => getCampaign(campaignId),
    { refetchInterval: POLL_INTERVAL, placeholderData: keepPreviousData },
  );

  // Only poll secondary data while the campaign is active
  const isActive = campaignData?.campaign?.status === "ongoing";
  const pollOptions = {
    refetchInterval: isActive ? POLL_INTERVAL : false as const,
    placeholderData: keepPreviousData,
  };

  const { data: statsData, isLoading: statsLoading } = useAuthQuery(
    ["campaignStats", campaignId],
    () => getCampaignStats(campaignId),
    pollOptions,
  );

  const { data: emailsData, isLoading: emailsLoading } = useAuthQuery(
    ["campaignEmails", campaignId],
    () => listCampaignEmails(campaignId),
    pollOptions,
  );

  const { data: leadsData, isLoading: leadsLoading } = useAuthQuery(
    ["campaignLeads", campaignId],
    () => listCampaignLeads(campaignId),
    pollOptions,
  );

  // Only gate the global loading state on the campaign query itself.
  // Stats/emails/leads load independently — individual pages handle their own loading.
  const loading = campaignLoading;
  const campaign = campaignData?.campaign ?? null;
  const stats = statsData ?? null;
  const emails = emailsData?.emails ?? EMPTY_EMAILS;
  const leads = leadsData?.leads ?? EMPTY_LEADS;

  const refreshStats = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["campaignStats", campaignId] });
  }, [queryClient, campaignId]);

  const value = useMemo<CampaignContextType>(
    () => ({ campaign, stats, emails, leads, loading, emailsLoading, leadsLoading, setCampaign: noop, refreshStats }),
    [campaign, stats, emails, leads, loading, emailsLoading, leadsLoading, refreshStats],
  );

  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error("useCampaign must be used within a CampaignProvider");
  }
  return context;
}
