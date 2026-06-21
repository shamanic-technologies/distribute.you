// Maps a raw onboarding setup error into a human-friendly message for the URL
// step. Shared by both onboarding flows (beta + default) so a dead/unreachable
// site (the brand scrape fails with a raw "Fetch failed") never surfaces as
// backend jargon to the user. Display fallback only — an unmatched message
// still shows verbatim, so this never hides a real signal.
export function displaySetupError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  // Unreachable / non-existent site — the brand scrape couldn't load the URL.
  if (
    /fetch failed|could not (reach|fetch|scrape|load|resolve)|ENOTFOUND|getaddrinfo|EAI_AGAIN|unreachable|invalid url|name not resolved|failed to fetch/i.test(
      message,
    )
  ) {
    return "We couldn't reach that website. Double-check the URL is correct and the site is live, then try again.";
  }

  // AI analysis service hiccup.
  if (/chat-service|LLM call failed|\/complete/i.test(message)) {
    return "Our AI analysis service had a temporary issue. Please try again in a minute.";
  }

  return err instanceof Error ? err.message : "Setup failed. Please try again.";
}
