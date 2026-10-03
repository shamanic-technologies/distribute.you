import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The landing ships as a container on the Hetzner box, so the build emits a
  // self-contained server plus only the traced dependencies. `next build` runs with
  // apps/landing as its cwd, and the trace root has to be the monorepo root or the
  // standalone output misses everything pnpm hoisted above this package — including
  // @distribute/content, which every served page reads its copy from.
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  // `next dev` refuses a request whose `Origin` is not the dev server's own, which is
  // every CORS-mode subresource on a clone host (`lab-<slug>.distribute.you`) — four of
  // outrank's stylesheets read as 403 while serving perfectly to a plain request. The
  // check does not exist in a production build; this only makes the clones openable
  // locally. See src/proxy.ts.
  allowedDevOrigins: ["*.distribute.you"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.logo.dev",
      },
      {
        protocol: "https",
        hostname: "unavatar.io",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
  // Next owns the `Vary` header on every app-router response (it sets its own
  // RSC router vary list and overwrites whatever a route handler returned), so
  // the negotiated pages cannot state `Vary: Accept` from their own Response.
  // A config header is applied by the routing layer on top of that, which is the
  // only place the value survives. Without it a shared cache keyed on the URL
  // alone could hand the HTML variant to an agent that asked for markdown.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Vary", value: "Accept" }],
      },
    ];
  },

  // Every redirect below is OURS, so none of them may fire on a lab host: config
  // redirects run before src/proxy.ts, and a competitor's own /sign-in or /sign-up (their
  // onboarding, which is exactly what a clone is there to show) would otherwise be sent to
  // OUR dashboard before the clone ever saw the request.
  async redirects() {
    const offLab = [{ type: "host" as const, value: "lab-[a-z0-9-]+\\.distribute\\.you" }];
    return [
      // Retired pages that crawlers and AI assistants still fetch (Cloudflare, 7 days to
      // 2026-10-01: /performance 15, /pricing 13, the cold-email clusters ~100 together). The
      // pages stay deleted (see CLAUDE.md); each URL lands on the live page answering the same
      // question instead of a 404.
      { source: "/pricing", destination: "/#pricing", permanent: true, missing: offLab },
      { source: "/performance/:path*", destination: "/", permanent: true, missing: offLab },
      { source: "/use-cases", destination: "/", permanent: true, missing: offLab },
      { source: "/outcomes/:path*", destination: "/", permanent: true, missing: offLab },
      { source: "/cold-email-cost-guide/:path*", destination: "/blog/cold-email-cost-per-positive-reply", permanent: true, missing: offLab },
      { source: "/cold-email-for-saas-founders/:path*", destination: "/", permanent: true, missing: offLab },
      { source: "/cold-email-vs-linkedin/:path*", destination: "/", permanent: true, missing: offLab },
      { source: "/developers/:path+", destination: "/developers", permanent: true, missing: offLab },
      // Blog posts that no longer exist, still fetched by ChatGPT-User, Claude-User and
      // DuckAssistBot (Cloudflare, 7 days to 2026-10-02). Each lands on the live article on the
      // same subject; one with no live article on its subject, and junk slugs, land on /blog.
      { source: "/blog/digital-narratives-examples", destination: "/blog/email-marketing-strategy", permanent: true, missing: offLab },
      { source: "/blog/what-is-thought-leadership-marketing", destination: "/blog/email-marketing-strategy", permanent: true, missing: offLab },
      { source: "/blog/examples-of-great-press-releases", destination: "/blog", permanent: true, missing: offLab },
      { source: "/blog/boutique-pr-firms", destination: "/blog", permanent: true, missing: offLab },
      { source: "/blog/venture-capital-due-diligence", destination: "/blog", permanent: true, missing: offLab },
      { source: "/blog/the-slug", destination: "/blog", permanent: true, missing: offLab },
      { source: "/blog/second", destination: "/blog", permanent: true, missing: offLab },
      // Articles taken down on 2026-10-02: their headline was a signal, not a conclusion (Research verdicts).
      { source: "/blog/cold-email-open-tracking-pixel", destination: "/blog", permanent: true, missing: offLab },
      { source: "/blog/cold-email-open-tracking", destination: "/blog", permanent: true, missing: offLab },
      { source: "/blog/cold-email-response-rate", destination: "/blog", permanent: true, missing: offLab },
      // Taken down on 2026-10-03: their click findings rested on the sending provider's click tracking,
      // which no scanner check screens; on human visits alone none of them holds.
      { source: "/blog/cost-per-click-cold-email", destination: "/blog", permanent: true, missing: offLab },
      { source: "/blog/flash-vs-pro-llm-cold-email", destination: "/blog", permanent: true, missing: offLab },
      { source: "/blog/cold-email-greeting", destination: "/blog", permanent: true, missing: offLab },
      // Articles taken down on 2026-10-03: their subject is a channel we do not run (positioning
      // 2026-09-24: a cold email agency).
      { source: "/blog/press-release-distribution-software", destination: "/blog", permanent: true, missing: offLab },
      { source: "/blog/journalism-pitch-example", destination: "/blog", permanent: true, missing: offLab },
      { source: "/blog/influencer-discovery-tools", destination: "/blog", permanent: true, missing: offLab },
      { source: "/blog/text-messages-to-email", destination: "/blog", permanent: true, missing: offLab },
      { source: "/sign-in", destination: "https://dashboard.distribute.you/sign-in", permanent: false, missing: offLab },
      { source: "/sign-up", destination: "https://dashboard.distribute.you/sign-up", permanent: false, missing: offLab },
    ];
  },
};

export default nextConfig;
