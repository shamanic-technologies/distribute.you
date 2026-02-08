"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { getCampaign, getCampaignStats, listCampaignEmails, listCampaignLeads, type Campaign, type CampaignStats, type Email, type Lead } from "./api";

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

export function CampaignProvider({ children, campaignId }: CampaignProviderProps) {
  const queryClient = useQueryClient();

  const { data: campaignData, isLoading: campaignLoading } = useAuthQuery(
    ["campaign", campaignId],
    (token) => getCampaign(token, campaignId)
  );

  const { data: statsData, isLoading: statsLoading } = useAuthQuery(
    ["campaignStats", campaignId],
    (token) => getCampaignStats(token, campaignId)
  );

  const { data: emailsData, isLoading: emailsLoading } = useAuthQuery(
    ["campaignEmails", campaignId],
    (token) => listCampaignEmails(token, campaignId)
  );

  const { data: leadsData, isLoading: leadsLoading } = useAuthQuery(
    ["campaignLeads", campaignId],
    (token) => listCampaignLeads(token, campaignId)
  );

  const loading = campaignLoading || statsLoading || emailsLoading || leadsLoading;
  const campaign = campaignData?.campaign ?? null;
  const stats = statsData ?? null;
  const emails = emailsData?.emails ?? [];
  const leads = leadsData?.leads ?? [];

  const refreshStats = async () => {
    await queryClient.invalidateQueries({ queryKey: ["campaignStats", campaignId] });
  };

  // setCampaign is kept for interface compat but is a no-op (queries manage state)
  const setCampaign = () => {};

  return (
    <CampaignContext.Provider value={{ campaign, stats, emails, leads, loading, setCampaign, refreshStats }}>
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
