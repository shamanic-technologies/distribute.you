export type WorkflowCategory = "sales" | "pr" | "utility";
export type WorkflowChannel = "email" | "api";
export type WorkflowAudienceType = "cold-outreach" | "internal";

export interface ParsedWorkflowName {
  category: WorkflowCategory;
  channel: WorkflowChannel;
  audienceType: WorkflowAudienceType;
  signatureName: string;
  sectionKey: string;
}

export interface WorkflowDefinition {
  /** Prefix match against workflowName from runs-service. */
  namePattern: string;
  /** Human-readable display name. */
  displayName: string;
  /** Category for leaderboard filtering. Matches workflow-service dimension values. */
  category: WorkflowCategory;
}

/**
 * Canonical mapping of legacy workflow names to categories.
 * Uses prefix matching: "cold-email-outreach" matches "cold-email-outreach-v1", etc.
 *
 * New-format names ({category}-{channel}-{audienceType}-{signatureName}) are parsed
 * directly by parseWorkflowName() and don't need entries here.
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
  utility: "Utility",
};

/** Section labels keyed by sectionKey ({category}-{channel}-{audienceType}). */
export const SECTION_LABELS: Record<string, string> = {
  "sales-email-cold-outreach": "Sales Cold Email Outreach",
  "pr-email-cold-outreach": "PR & Media Email Outreach",
};

/** @deprecated Use SECTION_LABELS instead. Kept for backward compat. */
export const CATEGORY_SECTION_LABELS: Record<string, string> = {
  sales: "Sales Cold Email Outreach",
  pr: "PR & Media Outreach",
};

/** Legacy workflow names → sectionKey for grouping into sections. */
const LEGACY_SECTION_MAP: Record<string, string> = {
  "sales-cold-email": "sales-email-cold-outreach",
  "cold-email-outreach": "sales-email-cold-outreach",
  "cold-email": "sales-email-cold-outreach",
};

const KNOWN_CATEGORIES = new Set<string>(["sales", "pr", "utility"]);
const KNOWN_CHANNELS = new Set<string>(["email", "api"]);
const TWO_WORD_AUDIENCE_TYPES = new Set<string>(["cold-outreach"]);
const ONE_WORD_AUDIENCE_TYPES = new Set<string>(["internal"]);

/**
 * Parse a new-format workflow name: {category}-{channel}-{audienceType}-{signatureName}.
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

  // Try 2-segment audience type first (e.g., "cold-outreach")
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

  // Try 1-segment audience type (e.g., "internal")
  if (rest.length >= 2 && ONE_WORD_AUDIENCE_TYPES.has(rest[0])) {
    const signatureName = rest.slice(1).join("-");
    if (signatureName) {
      return {
        category,
        channel,
        audienceType: rest[0] as WorkflowAudienceType,
        signatureName,
        sectionKey: `${category}-${channel}-${rest[0]}`,
      };
    }
  }

  return null;
}

/** Get the section key for grouping. Works with both new and legacy names. */
export function getSectionKey(workflowName: string): string | null {
  const parsed = parseWorkflowName(workflowName);
  if (parsed) return parsed.sectionKey;

  // Check legacy map (prefix match)
  for (const [prefix, key] of Object.entries(LEGACY_SECTION_MAP)) {
    if (workflowName.startsWith(prefix)) return key;
  }

  return null;
}

/** Extract signatureName from a new-format workflow name. Returns null for legacy names. */
export function getSignatureName(workflowName: string): string | null {
  return parseWorkflowName(workflowName)?.signatureName ?? null;
}

/** Resolve category for a workflow name. Tries new format first, then legacy prefix matching. */
export function getWorkflowCategory(workflowName: string): WorkflowCategory | null {
  const parsed = parseWorkflowName(workflowName);
  if (parsed) return parsed.category;

  const def = WORKFLOW_DEFINITIONS.find((d) => workflowName.startsWith(d.namePattern));
  return def?.category ?? null;
}

/** Resolve display name for a workflow name. Falls back to title-casing the raw name. */
export function getWorkflowDisplayName(workflowName: string): string {
  const parsed = parseWorkflowName(workflowName);
  if (parsed) {
    return parsed.signatureName.charAt(0).toUpperCase() + parsed.signatureName.slice(1);
  }

  const def = WORKFLOW_DEFINITIONS.find((d) => workflowName.startsWith(d.namePattern));
  if (def) return def.displayName;
  return workflowName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
