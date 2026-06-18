// Helpers for the prompt editor: parse `{{variable}}` tokens out of a stored
// prompt template and verify that an operator's edited template still
// references EXACTLY the declared variable names — no drop, rename, or
// addition. This mirrors the backend guard on PUT /prompt-assignments; the
// client check just gives an instant error before the round-trip.

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Distinct `{{name}}` variable names referenced in a prompt template. */
export function extractTemplateVariableNames(prompt: string): string[] {
  const names = new Set<string>();
  for (const match of prompt.matchAll(VAR_RE)) {
    names.add(match[1]);
  }
  return [...names];
}

export interface VariableIntegrityResult {
  ok: boolean;
  /** Declared but absent from the edited text (dropped or renamed away). */
  missing: string[];
  /** Present in the edited text but not declared (added or renamed to). */
  extra: string[];
}

/**
 * The edited prompt must reference exactly the declared variable set. A rename
 * shows up as one `missing` + one `extra`. The dashboard only supplies the
 * declared variables at generation time, so an added `{{var}}` would render
 * empty — hence `extra` is also a failure, not just `missing`.
 */
export function checkVariableIntegrity(
  prompt: string,
  declared: string[],
): VariableIntegrityResult {
  const present = new Set(extractTemplateVariableNames(prompt));
  const declaredSet = new Set(declared);
  const missing = declared.filter((name) => !present.has(name));
  const extra = [...present].filter((name) => !declaredSet.has(name));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

/** Operator-facing message for a failed integrity check, or null when ok. */
export function variableIntegrityMessage(
  result: VariableIntegrityResult,
): string | null {
  if (result.ok) return null;
  const parts: string[] = [];
  if (result.missing.length) {
    parts.push(
      `missing or renamed: ${result.missing.map((n) => `{{${n}}}`).join(", ")}`,
    );
  }
  if (result.extra.length) {
    parts.push(
      `not supported: ${result.extra.map((n) => `{{${n}}}`).join(", ")}`,
    );
  }
  return `The prompt must keep exactly the template variables. ${parts.join("; ")}.`;
}
