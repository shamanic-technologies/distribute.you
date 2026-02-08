"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { getCampaign, getCampaignStats, listCampaignEmails, listCampaignLeads, listCampaignReplies, type Campaign, type CampaignStats, type Email, type Lead, type Reply } from "./api";

interface CampaignContextType {
  campaign: Campaign | null;
  stats: CampaignStats | null;
  emails: Email[];
  leads: Lead[];
  replies: Reply[];
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

  const { data: repliesData, isLoading: repliesLoading } = useAuthQuery(
    ["campaignReplies", campaignId],
    (token) => listCampaignReplies(token, campaignId)
  );

  const loading = campaignLoading || statsLoading || emailsLoading || leadsLoading || repliesLoading;
  const campaign = campaignData?.campaign ?? null;
  const stats = statsData ?? null;
  const emails = emailsData?.emails ?? [];
  const replies = repliesData?.replies ?? [];
  const rawLeads = leadsData?.leads ?? [];

  // Derive lead status from emails and replies
  const leads = useMemo(() => {
    const repliedEmails = new Set(replies.map((r) => r.leadEmail.toLowerCase()));
    const contactedEmails = new Set(emails.map((e) => e.leadEmail?.toLowerCase()).filter(Boolean));

    return rawLeads.map((lead) => {
      const email = lead.email.toLowerCase();
      let status = "found";
      if (repliedEmails.has(email)) {
        status = "replied";
      } else if (contactedEmails.has(email)) {
        status = "contacted";
      }
      return { ...lead, status };
    });
  }, [rawLeads, emails, replies]);

  const refreshStats = async () => {
    await queryClient.invalidateQueries({ queryKey: ["campaignStats", campaignId] });
  };

  // setCampaign is kept for interface compat but is a no-op (queries manage state)
  const setCampaign = () => {};

  return (
    <CampaignContext.Provider value={{ campaign, stats, emails, leads, replies, loading, setCampaign, refreshStats }}>
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
