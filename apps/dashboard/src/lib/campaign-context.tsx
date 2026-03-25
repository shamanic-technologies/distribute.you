"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { getCampaign, getCampaignStats, listCampaignEmails, listCampaignLeads, type Campaign, type CampaignStats, type Email, type Lead } from "./api";

const POLL_INTERVAL = 5_000;

interface CampaignContextType {
  campaign: Campaign | null;
  stats: CampaignStats | null;
  emails: Email[];
  leads: Lead[];
  loading: boolean;
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

  const { data: campaignData, isLoading: campaignLoading } = useAuthQuery(
    ["campaign", campaignId],
    () => getCampaign(campaignId),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false, placeholderData: keepPreviousData },
  );

  // Only poll secondary data while the campaign is active
  const isActive = campaignData?.campaign?.status === "ongoing";
  const pollOptions = {
    refetchInterval: isActive ? POLL_INTERVAL : false as const,
    refetchIntervalInBackground: false,
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

  const loading = campaignLoading || statsLoading || emailsLoading || leadsLoading;
  const campaign = campaignData?.campaign ?? null;
  const stats = statsData ?? null;
  const emails = emailsData?.emails ?? EMPTY_EMAILS;
  const leads = leadsData?.leads ?? EMPTY_LEADS;

  const refreshStats = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["campaignStats", campaignId] });
  }, [queryClient, campaignId]);

  const value = useMemo<CampaignContextType>(
    () => ({ campaign, stats, emails, leads, loading, setCampaign: noop, refreshStats }),
    [campaign, stats, emails, leads, loading, refreshStats],
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
