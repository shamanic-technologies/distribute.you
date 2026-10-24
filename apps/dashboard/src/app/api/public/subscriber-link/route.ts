import { NextRequest } from "next/server";
import {
  capturePosthog,
  identifySubscriberClick,
  resolveSubscriberLink,
} from "@/lib/subscriber-link";

/**
 * A newsletter click tells us who the visitor is (lib/subscriber-link.ts).
 *
 * Public (an anonymous visitor on /get-started calls it) and answers 204 WHATEVER
 * happened: the email is set on the PostHog person server-side and never comes back,
 * and a uniform answer is no oracle for which ids are valid. The landing serves the
 * same route for its own pages.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  await identifySubscriberClick(body, {
    resolve: (linkId) =>
      resolveSubscriberLink(linkId, {
        apiUrl: process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you",
        apiKey: process.env.ADMIN_DISTRIBUTE_API_KEY,
      }),
    capture: (payload) => capturePosthog(payload, { host: process.env.NEXT_PUBLIC_POSTHOG_HOST }),
    posthogApiKey: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
    log: (msg) => console.error(msg),
  });
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
