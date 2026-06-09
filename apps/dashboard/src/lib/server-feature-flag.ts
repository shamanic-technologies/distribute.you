import { z } from "zod";

const posthogDecideResponseSchema = z.object({
  featureFlags: z.record(z.string(), z.unknown()),
});

function normalizePostHogHost(host: string): string {
  return host.replace("https://eu.i.posthog.com", "https://eu.posthog.com").replace(/\/$/, "");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[server-feature-flag] ${name} is required`);
  return value;
}

export async function isServerFeatureFlagEnabled({
  flag,
  distinctId,
  email,
  firstName,
  lastName,
}: {
  flag: string;
  distinctId: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<boolean> {
  const posthogHost = normalizePostHogHost(
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.posthog.com",
  );
  const posthogProjectToken = requireEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN");

  const res = await fetch(`${posthogHost}/decide/?v=3`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: posthogProjectToken,
      distinct_id: distinctId,
      person_properties: {
        email,
        firstName,
        lastName,
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`[server-feature-flag] PostHog decide failed: ${res.status} ${res.statusText}`);
  }

  const data: unknown = await res.json();
  return posthogDecideResponseSchema.parse(data).featureFlags[flag] === true;
}
