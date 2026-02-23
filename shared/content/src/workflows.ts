export type WorkflowCategory = "sales" | "pr";
export type WorkflowChannel = "email";
export type WorkflowAudienceType = "cold-outreach";

export interface ParsedWorkflowName {
  category: WorkflowCategory;
  channel: WorkflowChannel;
  audienceType: WorkflowAudienceType;
  signatureName: string;
  sectionKey: string;
}

export const WORKFLOW_CATEGORY_LABELS: Record<WorkflowCategory, string> = {
  sales: "Sales",
  pr: "PR & Media",
};

/** Section labels keyed by sectionKey ({category}-{channel}-{audienceType}). */
export const SECTION_LABELS: Record<string, string> = {
  "sales-email-cold-outreach": "Sales Cold Email Outreach",
  "pr-email-cold-outreach": "PR & Media Email Outreach",
};

const KNOWN_CATEGORIES = new Set<string>(["sales", "pr"]);
const KNOWN_CHANNELS = new Set<string>(["email"]);
const TWO_WORD_AUDIENCE_TYPES = new Set<string>(["cold-outreach"]);

/**
 * Parse a workflow name: {category}-{channel}-{audienceType}-{signatureName}.
 * Example: "sales-email-cold-outreach-sienna"
 * Returns null if the name doesn't match the expected format.
 */
export function parseWorkflowName(name: string): ParsedWorkflowName | null {
  const parts = name.split("-");
  if (parts.length < 4) return null;

  if (!KNOWN_CATEGORIES.has(parts[0])) return null;
  const category = parts[0] as WorkflowCategory;

  if (!KNOWN_CHANNELS.has(parts[1])) return null;
  const channel = parts[1] as WorkflowChannel;

  const rest = parts.slice(2);

  // Try 2-segment audience type (e.g., "cold-outreach")
  if (rest.length >= 3) {
    const twoWord = `${rest[0]}-${rest[1]}`;
    if (TWO_WORD_AUDIENCE_TYPES.has(twoWord)) {
      const signatureName = rest.slice(2).join("-");
      if (signatureName) {
        return {
          category,
          channel,
          audienceType: twoWord as WorkflowAudienceType,
          signatureName,
          sectionKey: `${category}-${channel}-${twoWord}`,
        };
      }
    }
  }

  return null;
}

/** Get the section key for grouping. Returns null if name doesn't match expected format. */
export function getSectionKey(workflowName: string): string | null {
  return parseWorkflowName(workflowName)?.sectionKey ?? null;
}

/** Extract signatureName from a workflow name. Returns null if name doesn't match expected format. */
export function getSignatureName(workflowName: string): string | null {
  return parseWorkflowName(workflowName)?.signatureName ?? null;
}

/** Resolve category for a workflow name. Returns null if name doesn't match expected format. */
export function getWorkflowCategory(workflowName: string): WorkflowCategory | null {
  return parseWorkflowName(workflowName)?.category ?? null;
}

/** Resolve display name for a workflow name. Returns the capitalized signatureName if parseable, otherwise title-cases the raw name. */
export function getWorkflowDisplayName(workflowName: string): string {
  const parsed = parseWorkflowName(workflowName);
  if (parsed) {
    return parsed.signatureName.charAt(0).toUpperCase() + parsed.signatureName.slice(1);
  }
  return workflowName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
