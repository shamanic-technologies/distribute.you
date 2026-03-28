/**
 * Returns the user-facing display name for a workflow.
 * Priority: dynastyName > signatureName (capitalized) > name (fallback).
 *
 * The `dynastyName` stays constant across workflow upgrades/forks,
 * whereas `name` (the versioned signature) changes on every upgrade.
 * Users should always see the stable dynasty name.
 */
export function workflowDisplayName(wf: {
  dynastyName?: string | null;
  signatureName?: string | null;
  name?: string | null;
  workflowSlug?: string | null;
}): string {
  if (wf.dynastyName) return wf.dynastyName;
  if (wf.signatureName && typeof wf.signatureName === "string") {
    return wf.signatureName.charAt(0).toUpperCase() + wf.signatureName.slice(1);
  }
  return wf.name || wf.workflowSlug || "Unknown";
}
