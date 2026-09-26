import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Front-end crashes reach PostHog as `$exception`. The project held zero of them for
// 30 days because nothing turned exception capture on, so every app that ships
// PostHog states it in code, and every React error boundary reports what it swallows.
const ROOT = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const APPS = ["dashboard", "admin", "landing", "sales-cold-emails-landing"];

describe("PostHog exception capture", () => {
  it.each(APPS)("%s turns on uncaught-error and rejection capture, and tags the release", (app) => {
    const src = read(`apps/${app}/src/instrumentation-client.ts`);
    expect(src).toContain("capture_unhandled_errors: true");
    expect(src).toContain("capture_unhandled_rejections: true");
    expect(src).toContain("capture_console_errors: false");
    expect(src).toContain("posthog.register({ release })");
  });

  it("the static landing pages' snippet captures exceptions too", () => {
    const src = read("apps/landing/src/lib/static-html.ts");
    expect(src).toContain("capture_exceptions:{capture_unhandled_errors:true,capture_unhandled_rejections:true");
    expect(src).toContain("${phRelease}");
  });

  it.each(APPS)("%s has a global-error boundary that reports to PostHog", (app) => {
    const p = `apps/${app}/src/app/global-error.tsx`;
    expect(existsSync(resolve(ROOT, p))).toBe(true);
    expect(read(p)).toContain("posthog.captureException(error");
  });

  it.each([
    "apps/dashboard/src/app/(authed)/(dashboard)/error.tsx",
    "apps/admin/src/app/(authed)/(dashboard)/error.tsx",
    "apps/admin/src/app/report/[orgId]/[brandId]/[featureSlug]/error.tsx",
  ])("%s reports the error it swallows", (p) => {
    expect(read(p)).toContain("posthog.captureException(error");
  });
});
