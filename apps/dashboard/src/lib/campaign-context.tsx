"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
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

  const pollOptions = { refetchInterval: POLL_INTERVAL };

  const { data: campaignData, isLoading: campaignLoading } = useAuthQuery(
    ["campaign", campaignId],
    (token) => getCampaign(token, campaignId),
    pollOptions,
  );

  const { data: statsData, isLoading: statsLoading } = useAuthQuery(
    ["campaignStats", campaignId],
    (token) => getCampaignStats(token, campaignId),
    pollOptions,
  );

  const { data: emailsData, isLoading: emailsLoading } = useAuthQuery(
    ["campaignEmails", campaignId],
    (token) => listCampaignEmails(token, campaignId),
    pollOptions,
  );

  const { data: leadsData, isLoading: leadsLoading } = useAuthQuery(
    ["campaignLeads", campaignId],
    (token) => listCampaignLeads(token, campaignId),
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
