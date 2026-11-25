/**
 * The sentence the Copilot shows when a turn fails (COPILOT-LATENCY-1125).
 *
 * A failed turn reaches the panel as the proxy's response body. When an edge in
 * front of the backend answers instead of it (Cloudflare's 524 after 100 s of
 * silence), that body is a whole HTML page, and the panel printed it verbatim.
 * The proxy now answers `{ error }` with a sentence; this reads it, and turns
 * anything that is still not a sentence (HTML, empty) into one.
 */
const NOT_A_SENTENCE = /^\s*(<!doctype|<html|<\?xml|<)/i;

export function copilotErrorText(raw: string | undefined | null, status?: number): string {
  const busy = status ? `The copilot took too long to answer (error ${status}). Try again.` : "The copilot took too long to answer. Try again.";
  if (!raw || !raw.trim()) return busy;
  let text = raw.trim();
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && typeof (parsed as { error?: unknown }).error === "string") {
      text = ((parsed as { error: string }).error).trim();
    }
  } catch {
    // not JSON: read the text itself
  }
  if (!text || NOT_A_SENTENCE.test(text)) return busy;
  return text;
}
