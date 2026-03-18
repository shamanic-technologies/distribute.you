/**
 * Returns the user-facing display name for a workflow.
 * Priority: signatureName (capitalized) > displayName > name (fallback).
 */
export function workflowDisplayName(wf: {
  signatureName?: string | null;
  displayName?: string | null;
  name?: string | null;
  workflowName?: string | null;
}): string {
  if (wf.signatureName) {
    return wf.signatureName.charAt(0).toUpperCase() + wf.signatureName.slice(1);
  }
  return wf.displayName || wf.name || wf.workflowName || "Unknown";
}
