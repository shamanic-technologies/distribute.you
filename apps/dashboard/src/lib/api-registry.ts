const API_REGISTRY_URL =
  process.env.API_REGISTRY_SERVICE_URL || "https://api-registry.distribute.you";
const API_REGISTRY_KEY = process.env.API_REGISTRY_SERVICE_API_KEY;

/**
 * Well-known provider → domain mapping for logo display.
 * Domain is used with favicon services (e.g. Google S2) to show provider logos.
 */
export const PROVIDER_DOMAINS: Record<string, string> = {
  anthropic: "anthropic.com",
  openai: "openai.com",
  apollo: "apollo.io",
  instantly: "instantly.ai",
  postmark: "postmarkapp.com",
  twilio: "twilio.com",
  google: "google.com",
  resend: "resend.com",
  sendgrid: "sendgrid.com",
  mailgun: "mailgun.com",
  stripe: "stripe.com",
  ahref: "ahrefs.com",
  ahrefs: "ahrefs.com",
  firecrawl: "firecrawl.dev",
  perplexity: "perplexity.ai",
  groq: "groq.com",
  deepseek: "deepseek.com",
  mistral: "mistral.ai",
  cohere: "cohere.com",
  "serper-dev": "serper.dev",
};

export async function registryFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = `${API_REGISTRY_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(API_REGISTRY_KEY ? { "X-API-Key": API_REGISTRY_KEY } : {}),
  };

  return fetch(url, { ...init, headers: { ...headers, ...init?.headers } });
}
