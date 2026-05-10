import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const featurePagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/page.tsx",
);
const byokBannerPath = path.resolve(
  __dirname,
  "../src/components/feature-byok-banner.tsx",
);
const runButtonPath = path.resolve(
  __dirname,
  "../src/components/feature-run-button.tsx",
);
const apiLibPath = path.resolve(__dirname, "../src/lib/api.ts");
const quoteRequestsPath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/quote-requests/page.tsx",
);
const quotePitchesPath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/quote-pitches/page.tsx",
);

const featurePageContent = fs.readFileSync(featurePagePath, "utf-8");
const byokBannerContent = fs.readFileSync(byokBannerPath, "utf-8");
const runButtonContent = fs.readFileSync(runButtonPath, "utf-8");
const apiLibContent = fs.readFileSync(apiLibPath, "utf-8");
const quoteRequestsContent = fs.readFileSync(quoteRequestsPath, "utf-8");
const quotePitchesContent = fs.readFileSync(quotePitchesPath, "utf-8");

describe("Feature page — generic routing (no per-slug branch)", () => {
  it("does not branch on the pr-expert-quote-outreach slug", () => {
    expect(featurePageContent).not.toContain('featureSlug === "pr-expert-quote-outreach"');
    expect(featurePageContent).not.toContain("ExpertQuoteOutreachPage");
  });

  it("renders FeatureBYOKBanner so any feature can require credentials", () => {
    expect(featurePageContent).toContain("FeatureBYOKBanner");
  });
});

describe("FeatureBYOKBanner — Featured creds form", () => {
  it("client component", () => {
    expect(byokBannerContent).toContain('"use client"');
  });

  it("renders form with username + password inputs", () => {
    expect(byokBannerContent).toContain('data-testid="featured-creds-form"');
    expect(byokBannerContent).toContain('autoComplete="username"');
    expect(byokBannerContent).toContain('autoComplete="current-password"');
  });

  it("submits via setFeaturedCreds", () => {
    expect(byokBannerContent).toContain("setFeaturedCreds(");
  });

  it("surfaces error visibly (no silent fallback)", () => {
    expect(byokBannerContent).toContain('data-testid="featured-creds-error"');
  });

  it("falls back to slug→provider map when feature.byokProvider absent", () => {
    expect(byokBannerContent).toContain('"pr-expert-quote-outreach": "featured"');
  });
});

describe("FeatureRunButton — generic trigger", () => {
  it("calls triggerFeatureRun with the supplied feature slug", () => {
    expect(runButtonContent).toContain("triggerFeatureRun(featureSlug");
    expect(runButtonContent).toContain('data-testid="trigger-run-button"');
    expect(runButtonContent).toContain('data-testid="trigger-run-error"');
  });
});

describe("Quote requests + pitches — generic entity routes", () => {
  it("quote-requests page calls listQuoteRequests", () => {
    expect(quoteRequestsContent).toContain("listQuoteRequests(");
    expect(quoteRequestsContent).toContain('data-testid="quote-requests-page"');
  });

  it("quote-pitches page calls listQuotePitches", () => {
    expect(quotePitchesContent).toContain("listQuotePitches(");
    expect(quotePitchesContent).toContain('data-testid="quote-pitches-page"');
  });
});

describe("api client functions", () => {
  it("setFeaturedCreds posts username + password to /keys for `featured` provider", () => {
    expect(apiLibContent).toContain("export async function setFeaturedCreds(");
    const setBlock = apiLibContent.split("export async function setFeaturedCreds(")[1];
    expect(setBlock).toContain('provider: "featured"');
    expect(setBlock).toContain("username");
    expect(setBlock).toContain("password");
  });

  it("declares the journalists-quotes endpoints", () => {
    expect(apiLibContent).toContain("export async function listQuoteRequests(");
    expect(apiLibContent).toContain("export async function getQuoteRequest(");
    expect(apiLibContent).toContain("export async function getQuoteRequestStats(");
    expect(apiLibContent).toContain("export async function listQuotePitches(");
    expect(apiLibContent).toContain("export async function getQuotePitch(");
  });

  it("triggerFeatureRun resolves the workflow by featureSlug then executes it", () => {
    expect(apiLibContent).toContain("export async function triggerFeatureRun(");
    const block = apiLibContent.split("export async function triggerFeatureRun(")[1];
    expect(block).toContain("listWorkflows({ featureSlug }");
    expect(block).toContain("/workflows/${wf.id}/execute");
  });

  it("triggerFeatureRun throws ApiError(404) when workflow not registered", () => {
    const block = apiLibContent.split("export async function triggerFeatureRun(")[1];
    expect(block).toContain("throw new ApiError(");
    expect(block).toContain("404");
  });
});
