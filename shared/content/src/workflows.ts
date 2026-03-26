/** Static workflow section definitions (replaces MCP_PACKAGES). */
export interface WorkflowDefinition {
  /** Section key, e.g. "sales-email-cold-outreach" */
  featureSlug: string;
  /** Human-readable label */
  label: string;
  /** Short description for cards/lists */
  description: string;
  /** Icon identifier for UI */
  icon: string;
  /** Whether workflows exist for this feature in the backend */
  implemented: boolean;
}

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    featureSlug: "sales-email-cold-outreach",
    label: "Sales Cold Email Outreach",
    description:
      "Find leads, generate personalized cold emails, send & optimize.",
    icon: "envelope",
    implemented: true,
  },
  {
    featureSlug: "journalists-email-cold-outreach",
    label: "Journalists Cold Email Outreach",
    description:
      "Pitch journalists and media contacts for press coverage.",
    icon: "newspaper",
    implemented: true,
  },
  {
    featureSlug: "press-kit-email-generation",
    label: "Press Kit Generation",
    description:
      "Generate and manage press kits for media outreach.",
    icon: "document",
    implemented: true,
  },
  {
    featureSlug: "webinars",
    label: "Webinars",
    description:
      "Welcome emails, heat-up sequences, reminders, and post-webinar thank you emails.",
    icon: "calendar",
    implemented: false,
  },
  {
    featureSlug: "welcome-email",
    label: "Welcome Email",
    description:
      "Automated welcome email for new signups and contacts.",
    icon: "envelope",
    implemented: false,
  },
  {
    featureSlug: "outlets-database-discovery",
    label: "Media Outlet Discovery",
    description:
      "Find relevant media outlets and publications for your brand.",
    icon: "building",
    implemented: true,
  },
  {
    featureSlug: "journalists-database-discovery",
    label: "Journalist Discovery",
    description:
      "Find relevant journalists and media contacts for your brand.",
    icon: "users",
    implemented: true,
  },
];

export const getWorkflowDefinition = (featureSlug: string) =>
  WORKFLOW_DEFINITIONS.find((w) => w.featureSlug === featureSlug);

/** Section labels keyed by featureSlug. */
export const FEATURE_LABELS: Record<string, string> = {
  "sales-email-cold-outreach": "Sales Cold Email Outreach",
  "journalists-email-cold-outreach": "Journalists Cold Email Outreach",
  "press-kit-email-generation": "Press Kit Generation",
  "outlets-database-discovery": "Media Outlet Discovery",
  "journalists-database-discovery": "Journalist Discovery",
  "webinars": "Webinars",
  "welcome-email": "Welcome Email",
};

/** Resolve display name for a workflow name. Returns the last segment capitalized, otherwise title-cases the raw name. */
export function getWorkflowDisplayName(workflowName: string): string {
  // Extract the last segment after the featureSlug prefix as the signature name
  for (const def of WORKFLOW_DEFINITIONS) {
    if (workflowName.startsWith(def.featureSlug + "-")) {
      const signatureName = workflowName.slice(def.featureSlug.length + 1);
      if (signatureName) {
        return signatureName.charAt(0).toUpperCase() + signatureName.slice(1);
      }
    }
  }
  return workflowName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
