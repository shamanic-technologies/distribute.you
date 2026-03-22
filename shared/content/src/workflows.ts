export type WorkflowCategory = "sales" | "journalists" | "outlets" | "press-kit" | "webinars" | "welcome";
export type WorkflowChannel = "email" | "database";
export type WorkflowAudienceType = "cold-outreach" | "generation" | "discovery";

/** Static workflow section definitions (replaces MCP_PACKAGES). */
export interface WorkflowDefinition {
  /** Section key, e.g. "sales-email-cold-outreach" */
  sectionKey: string;
  /** Human-readable label */
  label: string;
  /** Short description for cards/lists */
  description: string;
  category: WorkflowCategory;
  channel: WorkflowChannel;
  audienceType: WorkflowAudienceType;
  /** Icon identifier for UI */
  icon: string;
  /** Whether workflows exist for this feature in the backend */
  implemented: boolean;
}

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    sectionKey: "sales-email-cold-outreach",
    label: "Sales Cold Email Outreach",
    description:
      "Find leads, generate personalized cold emails, send & optimize.",
    category: "sales",
    channel: "email",
    audienceType: "cold-outreach",
    icon: "envelope",
    implemented: true,
  },
  {
    sectionKey: "journalists-email-cold-outreach",
    label: "Journalists Cold Email Outreach",
    description:
      "Pitch journalists and media contacts for press coverage.",
    category: "journalists",
    channel: "email",
    audienceType: "cold-outreach",
    icon: "newspaper",
    implemented: true,
  },
  {
    sectionKey: "press-kit-email-generation",
    label: "Press Kit Generation",
    description:
      "Generate and manage press kits for media outreach.",
    category: "press-kit",
    channel: "email",
    audienceType: "generation",
    icon: "document",
    implemented: true,
  },
  {
    sectionKey: "webinars",
    label: "Webinars",
    description:
      "Welcome emails, heat-up sequences, reminders, and post-webinar thank you emails.",
    category: "webinars",
    channel: "email",
    audienceType: "cold-outreach",
    icon: "calendar",
    implemented: false,
  },
  {
    sectionKey: "welcome-email",
    label: "Welcome Email",
    description:
      "Automated welcome email for new signups and contacts.",
    category: "welcome",
    channel: "email",
    audienceType: "cold-outreach",
    icon: "envelope",
    implemented: false,
  },
  {
    sectionKey: "outlets-database-discovery",
    label: "Media Outlet Discovery",
    description:
      "Find relevant media outlets and publications for your brand.",
    category: "outlets",
    channel: "database",
    audienceType: "discovery",
    icon: "building",
    implemented: true,
  },
  {
    sectionKey: "journalists-database-discovery",
    label: "Journalist Discovery",
    description:
      "Find relevant journalists and media contacts for your brand.",
    category: "journalists",
    channel: "database",
    audienceType: "discovery",
    icon: "users",
    implemented: true,
  },
];

export const getWorkflowDefinition = (sectionKey: string) =>
  WORKFLOW_DEFINITIONS.find((w) => w.sectionKey === sectionKey);

export const getWorkflowDefinitionsByCategory = (cat: WorkflowCategory) =>
  WORKFLOW_DEFINITIONS.filter((w) => w.category === cat);

export interface ParsedWorkflowName {
  category: WorkflowCategory;
  channel: WorkflowChannel;
  audienceType: WorkflowAudienceType;
  signatureName: string;
  sectionKey: string;
}

export const WORKFLOW_CATEGORY_LABELS: Record<WorkflowCategory, string> = {
  sales: "Sales",
  journalists: "Journalists",
  outlets: "Media Outlets",
  "press-kit": "Press Kit",
  webinars: "Webinars",
  welcome: "Welcome",
};

/** Section labels keyed by sectionKey ({category}-{channel}-{audienceType}). */
export const SECTION_LABELS: Record<string, string> = {
  "sales-email-cold-outreach": "Sales Cold Email Outreach",
  "journalists-email-cold-outreach": "Journalists Cold Email Outreach",
  "press-kit-email-generation": "Press Kit Generation",
  "outlets-database-discovery": "Media Outlet Discovery",
  "journalists-database-discovery": "Journalist Discovery",
  "webinars": "Webinars",
  "welcome-email": "Welcome Email",
};

const KNOWN_CATEGORIES = new Set<string>(["sales", "journalists", "outlets", "webinars", "welcome"]);
const TWO_WORD_CATEGORIES = new Set<string>(["press-kit"]);
const KNOWN_CHANNELS = new Set<string>(["email", "database"]);
const TWO_WORD_AUDIENCE_TYPES = new Set<string>(["cold-outreach"]);
const ONE_WORD_AUDIENCE_TYPES = new Set<string>(["discovery", "generation"]);

/**
 * Parse a workflow name: {category}-{channel}-{audienceType}-{signatureName}.
 * Supports multi-word categories (e.g., "press-kit") and audience types (e.g., "cold-outreach").
 * Example: "sales-email-cold-outreach-sienna"
 * Example: "press-kit-email-generation-v1"
 * Returns null if the name doesn't match the expected format.
 */
export function parseWorkflowName(name: string): ParsedWorkflowName | null {
  const parts = name.split("-");
  if (parts.length < 4) return null;

  let category: WorkflowCategory;
  let channelStart: number;

  // Try 2-word category first (e.g., "press-kit")
  if (parts.length >= 5) {
    const twoWordCat = `${parts[0]}-${parts[1]}`;
    if (TWO_WORD_CATEGORIES.has(twoWordCat)) {
      category = twoWordCat as WorkflowCategory;
      channelStart = 2;
    } else if (KNOWN_CATEGORIES.has(parts[0])) {
      category = parts[0] as WorkflowCategory;
      channelStart = 1;
    } else {
      return null;
    }
  } else if (KNOWN_CATEGORIES.has(parts[0])) {
    category = parts[0] as WorkflowCategory;
    channelStart = 1;
  } else {
    return null;
  }

  if (!KNOWN_CHANNELS.has(parts[channelStart])) return null;
  const channel = parts[channelStart] as WorkflowChannel;

  const rest = parts.slice(channelStart + 1);

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

  // Try 1-segment audience type (e.g., "discovery", "generation")
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
