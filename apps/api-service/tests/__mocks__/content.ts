/**
 * Mock for @mcpfactory/content
 * Used in tests since the workspace package may not be built in CI
 */

export type WorkflowCategory = "sales" | "pr";

export const SECTION_LABELS: Record<string, string> = {
  "sales-email-cold-outreach": "Sales Cold Email Outreach",
  "pr-email-cold-outreach": "PR & Media Email Outreach",
};

export function getSectionKey(workflowName: string): string | null {
  const parsed = parseWorkflowName(workflowName);
  return parsed?.sectionKey ?? null;
}

export function getSignatureName(workflowName: string): string | null {
  const parsed = parseWorkflowName(workflowName);
  return parsed?.signatureName ?? null;
}

export function getWorkflowCategory(workflowName: string): WorkflowCategory | null {
  const parsed = parseWorkflowName(workflowName);
  return parsed?.category ?? null;
}

export function getWorkflowDisplayName(workflowName: string): string {
  const parsed = parseWorkflowName(workflowName);
  if (parsed) {
    return parsed.signatureName.charAt(0).toUpperCase() + parsed.signatureName.slice(1);
  }
  return workflowName
    .split("-")
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const KNOWN_CATEGORIES = new Set<string>(["sales", "pr"]);
const KNOWN_CHANNELS = new Set<string>(["email"]);
const TWO_WORD_AUDIENCE_TYPES = new Set<string>(["cold-outreach"]);

function parseWorkflowName(name: string) {
  const parts = name.split("-");
  if (parts.length < 4) return null;
  if (!KNOWN_CATEGORIES.has(parts[0])) return null;
  const category = parts[0] as WorkflowCategory;
  if (!KNOWN_CHANNELS.has(parts[1])) return null;
  const channel = parts[1];
  const rest = parts.slice(2);
  if (rest.length >= 3) {
    const twoWord = `${rest[0]}-${rest[1]}`;
    if (TWO_WORD_AUDIENCE_TYPES.has(twoWord)) {
      const signatureName = rest.slice(2).join("-");
      if (signatureName) {
        return { category, channel, audienceType: twoWord, signatureName, sectionKey: `${category}-${channel}-${twoWord}` };
      }
    }
  }
  return null;
}
