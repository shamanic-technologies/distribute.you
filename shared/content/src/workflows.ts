export type WorkflowCategory = "sales" | "pr";

export interface WorkflowDefinition {
  /** Prefix match against workflowName from runs-service. */
  namePattern: string;
  /** Human-readable display name. */
  displayName: string;
  /** Category for leaderboard filtering. Matches workflow-service dimension values. */
  category: WorkflowCategory;
}

/**
 * Canonical mapping of workflow names to categories.
 * Uses prefix matching: "sales-cold-email" matches "sales-cold-email-v1", "sales-cold-email-v2", etc.
 *
 * Order matters — first match wins. Put more specific patterns before generic ones.
 */
export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  { namePattern: "sales-cold-email", displayName: "Sales Cold Email", category: "sales" },
  { namePattern: "cold-email-outreach", displayName: "Cold Email Outreach", category: "sales" },
  { namePattern: "cold-email", displayName: "Cold Email", category: "sales" },
  { namePattern: "journalist-outreach", displayName: "Journalist Outreach", category: "pr" },
  { namePattern: "journalist-pitch", displayName: "Journalist Pitch", category: "pr" },
  { namePattern: "influencer-outreach", displayName: "Influencer Outreach", category: "pr" },
  { namePattern: "influencer-pitch", displayName: "Influencer Pitch", category: "pr" },
  { namePattern: "podcaster-outreach", displayName: "Podcaster Outreach", category: "pr" },
  { namePattern: "podcaster-pitch", displayName: "Podcaster Pitch", category: "pr" },
  { namePattern: "thought-leader", displayName: "Thought Leader", category: "pr" },
];

export const WORKFLOW_CATEGORY_LABELS: Record<WorkflowCategory, string> = {
  sales: "Sales",
  pr: "PR & Media",
};

export const CATEGORY_SECTION_LABELS: Record<WorkflowCategory, string> = {
  sales: "Sales Cold Email Outreach",
  pr: "PR & Media Outreach",
};

/** Resolve category for a workflow name using prefix matching. Returns null for unknown workflows. */
export function getWorkflowCategory(workflowName: string): WorkflowCategory | null {
  const def = WORKFLOW_DEFINITIONS.find((d) => workflowName.startsWith(d.namePattern));
  return def?.category ?? null;
}

/** Resolve display name for a workflow name. Falls back to title-casing the raw name. */
export function getWorkflowDisplayName(workflowName: string): string {
  const def = WORKFLOW_DEFINITIONS.find((d) => workflowName.startsWith(d.namePattern));
  if (def) return def.displayName;
  return workflowName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
