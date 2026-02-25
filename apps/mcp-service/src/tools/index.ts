import { z } from "zod";
import { getConfigStatus, callApi } from "../lib/api-client.js";

// Tool definitions with Zod schemas
export const toolDefinitions = {
  mcpfactory_status: {
    description: "Check MCPFactory connection status and configuration",
    schema: z.object({}),
  },
  mcpfactory_list_workflows: {
    description: "List all available workflows with their descriptions and categories",
    schema: z.object({
      category: z.enum(["sales", "pr"]).optional().describe("Filter by workflow category"),
    }),
  },
  mcpfactory_create_campaign: {
    description: "Create and immediately start a cold email campaign. Provide a URL, describe your target audience in plain text, and set a budget. The system automatically finds matching leads via AI.",
    schema: z.object({
      name: z.string().describe("Campaign name"),
      workflow_name: z.string().describe("Workflow name (e.g. 'sales-email-cold-outreach-sienna'). Use mcpfactory_list_workflows to see available workflows."),
      brand_url: z.string().describe("Your brand/company URL to promote"),
      target_audience: z.string().describe("Plain text description of your ideal customers (e.g. 'CTOs at SaaS startups with 10-50 employees in the US')"),
      target_outcome: z.string().describe("What you want to achieve with this campaign (e.g. 'Book sales demos', 'Recruit community ambassadors', 'Get press coverage')"),
      value_for_target: z.string().describe("What the target audience gains from responding (e.g. 'Access to an enterprise-grade analytics platform at startup pricing', 'Join a growing international community with competitive compensation')"),
      urgency: z.string().describe("Time-based constraint that motivates action now (e.g. 'Recruitment closes in 30 days', 'Price doubles after March 1st')"),
      scarcity: z.string().describe("Supply-based constraint on availability (e.g. 'Only 10 spots available worldwide', 'Limited to 50 participants')"),
      risk_reversal: z.string().describe("Guarantee or safety net that removes risk for the prospect (e.g. 'Free trial for 2 weeks, no commitment', 'Phone screening call before any obligation')"),
      social_proof: z.string().describe("Evidence of credibility and traction (e.g. 'Backed by 60 sponsors including X, Y, Z', '500+ companies already onboarded')"),
      max_daily_budget_usd: z.number().optional().describe("Maximum daily spend in USD (at least one budget required)"),
      max_weekly_budget_usd: z.number().optional().describe("Maximum weekly spend in USD"),
      max_monthly_budget_usd: z.number().optional().describe("Maximum monthly spend in USD"),
      max_total_budget_usd: z.number().optional().describe("Maximum total spend in USD (campaign stops permanently when reached)"),
      max_leads: z.number().optional().describe("Maximum number of leads to contact (campaign stops permanently when reached)"),
      end_date: z.string().optional().describe("Optional campaign end date (ISO format)"),
    }),
  },
  mcpfactory_list_campaigns: {
    description: "List all your cold email campaigns",
    schema: z.object({
      status: z.enum(["ongoing", "stopped", "all"]).optional().describe("Filter by campaign status"),
    }),
  },
  mcpfactory_stop_campaign: {
    description: "Stop a running campaign",
    schema: z.object({
      campaign_id: z.string().describe("Campaign ID to stop"),
    }),
  },
  mcpfactory_resume_campaign: {
    description: "Resume a stopped campaign",
    schema: z.object({
      campaign_id: z.string().describe("Campaign ID to resume"),
    }),
  },
  mcpfactory_campaign_stats: {
    description: "Get statistics for a specific campaign",
    schema: z.object({
      campaign_id: z.string().describe("Campaign ID to get stats for"),
    }),
  },
  mcpfactory_campaign_debug: {
    description: "Get detailed debug info for a campaign: status, all runs, errors, and pipeline state",
    schema: z.object({
      campaign_id: z.string().describe("Campaign ID to debug"),
    }),
  },
  mcpfactory_list_brands: {
    description: "List all your brands (companies/websites you promote through campaigns)",
    schema: z.object({}),
  },
  mcpfactory_suggest_icp: {
    description:
      "Analyze a brand's website and suggest an Ideal Customer Profile (ICP). Use this when the user doesn't know who to target and wants AI-generated targeting suggestions. Returns a description of ideal customers that can be used as the target_audience in mcpfactory_create_campaign.",
    schema: z.object({
      brand_url: z.string().describe("The brand/company URL to analyze for ICP extraction"),
    }),
  },
};

// Tool handlers
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "mcpfactory_status":
      return handleStatus();

    case "mcpfactory_list_workflows":
      return handleListWorkflows(args);

    case "mcpfactory_create_campaign":
      return handleCreateCampaign(args);

    case "mcpfactory_list_campaigns":
      return handleListCampaigns(args);

    case "mcpfactory_campaign_stats":
      return handleCampaignStats(args);

    case "mcpfactory_campaign_debug":
      return handleCampaignDebug(args);

    case "mcpfactory_stop_campaign":
      return handleStopCampaign(args);

    case "mcpfactory_resume_campaign":
      return handleResumeCampaign(args);

    case "mcpfactory_list_brands":
      return handleListBrands();

    case "mcpfactory_suggest_icp":
      return handleSuggestIcp(args);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Handler implementations
async function handleStatus() {
  const status = getConfigStatus();
  
  if (!status.configured) {
    return {
      status: "not_configured",
      message: "MCPFactory API key not configured",
      instructions: [
        "1. Get your API key at https://dashboard.mcpfactory.org/settings/api",
        "2. Set MCPFACTORY_API_KEY environment variable",
        "3. Restart the MCP server",
      ],
    };
  }

  // Check API connectivity
  const result = await callApi("/v1/me");
  
  if (result.error) {
    return {
      status: "error",
      message: result.error,
      apiUrl: status.apiUrl,
    };
  }

  return {
    status: "connected",
    apiUrl: status.apiUrl,
    user: result.data,
  };
}

async function handleListWorkflows(args: Record<string, unknown>) {
  const { WORKFLOW_DEFINITIONS, getWorkflowDefinitionsByCategory } = await import("@mcpfactory/content");
  const category = args.category as string | undefined;
  const workflows = category
    ? getWorkflowDefinitionsByCategory(category as "sales" | "pr")
    : WORKFLOW_DEFINITIONS;
  return {
    workflows: workflows.map((wf) => ({
      sectionKey: wf.sectionKey,
      label: wf.label,
      description: wf.description,
      category: wf.category,
      channel: wf.channel,
      audienceType: wf.audienceType,
    })),
  };
}

async function handleCreateCampaign(args: Record<string, unknown>) {
  // Validate at least one budget is provided (max_leads is optional, not a replacement for budget)
  if (!args.max_daily_budget_usd && !args.max_weekly_budget_usd && !args.max_monthly_budget_usd && !args.max_total_budget_usd) {
    throw new Error("At least one budget is required (max_daily_budget_usd, max_weekly_budget_usd, max_monthly_budget_usd, or max_total_budget_usd)");
  }

  const result = await callApi("/v1/campaigns", {
    method: "POST",
    body: {
      name: args.name,
      workflowName: args.workflow_name,
      brandUrl: args.brand_url,
      targetAudience: args.target_audience,
      targetOutcome: args.target_outcome,
      valueForTarget: args.value_for_target,
      urgency: args.urgency,
      scarcity: args.scarcity,
      riskReversal: args.risk_reversal,
      socialProof: args.social_proof,
      maxBudgetDailyUsd: args.max_daily_budget_usd,
      maxBudgetWeeklyUsd: args.max_weekly_budget_usd,
      maxBudgetMonthlyUsd: args.max_monthly_budget_usd,
      maxBudgetTotalUsd: args.max_total_budget_usd,
      maxLeads: args.max_leads,
      endDate: args.end_date,
    },
  });

  if (result.error) {
    throw new Error(result.error);
  }

  return result.data;
}

async function handleListCampaigns(args: Record<string, unknown>) {
  const status = args.status || "all";
  const result = await callApi(`/v1/campaigns?status=${status}`);

  if (result.error) {
    throw new Error(result.error);
  }

  return result.data;
}

async function handleCampaignStats(args: Record<string, unknown>) {
  const result = await callApi(`/v1/campaigns/${args.campaign_id}/stats`);

  if (result.error) {
    throw new Error(result.error);
  }

  return result.data;
}

async function handleCampaignDebug(args: Record<string, unknown>) {
  const result = await callApi(`/v1/campaigns/${args.campaign_id}/debug`);

  if (result.error) {
    throw new Error(result.error);
  }

  return result.data;
}

async function handleStopCampaign(args: Record<string, unknown>) {
  const result = await callApi(`/v1/campaigns/${args.campaign_id}/stop`, {
    method: "POST",
  });

  if (result.error) {
    throw new Error(result.error);
  }

  return result.data;
}

async function handleResumeCampaign(args: Record<string, unknown>) {
  const result = await callApi(`/v1/campaigns/${args.campaign_id}/resume`, {
    method: "POST",
  });

  if (result.error) {
    throw new Error(result.error);
  }

  return result.data;
}

async function handleListBrands() {
  const result = await callApi("/v1/brands");

  if (result.error) {
    throw new Error(result.error);
  }

  return result.data;
}

async function handleSuggestIcp(args: Record<string, unknown>) {
  const result = await callApi("/v1/brand/icp-suggestion", {
    method: "POST",
    body: {
      brandUrl: args.brand_url,
    },
  });

  if (result.error) {
    throw new Error(result.error);
  }

  return result.data;
}
