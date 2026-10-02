import posthog from "posthog-js";

import { dropVendorNoise } from "./lib/posthog-before-send";
import { browserChunkReloadEnv, installStaleChunkReload } from "./lib/stale-chunk-reload";

// A tab holding a previous build's HTML that asks for a chunk the deploy removed
// reloads once instead of staying dead (lib/stale-chunk-reload.ts).
installStaleChunkReload({
  ...browserChunkReloadEnv(),
  addEventListener: (type, fn) => window.addEventListener(type, fn),
});

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: posthogHost,
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    // Front-end errors reach PostHog as `$exception` (error tracking): uncaught
    // errors and unhandled promise rejections. Console errors stay out, they are
    // noise. Stated here rather than left to the project's remote setting, so a
    // settings change cannot silently turn crash reporting off again (the project
    // held 0 `$exception` events in 30 days before this).
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    // Third-party noise nobody can act on: a blocked Partnero script, an opaque
    // cross-origin "Script error.", code injected by a link scanner (lib/posthog-before-send.ts).
    before_send: dropVendorNoise,
  });
  // The release every event (exceptions included) was captured on. Written into
  // the build env by the box's deploy script; absent in a local build.
  const release = process.env.NEXT_PUBLIC_RELEASE;
  if (release) posthog.register({ release });
}
