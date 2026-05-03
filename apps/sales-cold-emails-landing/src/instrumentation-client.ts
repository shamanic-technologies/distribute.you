import posthog from "posthog-js";

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: posthogHost,
    defaults: "2026-01-30",
  });
}
