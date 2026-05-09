import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const componentPath = path.resolve(
  __dirname,
  "../src/components/expert-quote-outreach/expert-quote-outreach-page.tsx",
);
const featurePagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/page.tsx",
);
const apiLibPath = path.resolve(__dirname, "../src/lib/api.ts");

const componentContent = fs.readFileSync(componentPath, "utf-8");
const featurePageContent = fs.readFileSync(featurePagePath, "utf-8");
const apiLibContent = fs.readFileSync(apiLibPath, "utf-8");

describe("Expert Quote Outreach — page wiring", () => {
  it("per-brand feature page routes the slug to the dedicated component", () => {
    expect(featurePageContent).toContain('featureSlug === "pr-expert-quote-outreach"');
    expect(featurePageContent).toContain("ExpertQuoteOutreachPage");
  });

  it("component is a client component", () => {
    expect(componentContent).toContain('"use client"');
  });

  it("renders the page test id", () => {
    expect(componentContent).toContain('data-testid="expert-quote-outreach-page"');
  });
});

describe("Expert Quote Outreach — Featured creds form", () => {
  it("renders a form with username + password inputs", () => {
    expect(componentContent).toContain('data-testid="featured-creds-form"');
    expect(componentContent).toContain('autoComplete="username"');
    expect(componentContent).toContain('autoComplete="current-password"');
  });

  it("submits via setFeaturedCreds", () => {
    expect(componentContent).toContain("setFeaturedCreds(");
  });

  it("surfaces error visibly (no silent fallback)", () => {
    expect(componentContent).toContain('data-testid="featured-creds-error"');
  });
});

describe("Expert Quote Outreach — stats + lists + trigger", () => {
  it("calls listQuoteRequests for the requests list", () => {
    expect(componentContent).toContain("listQuoteRequests(");
    expect(componentContent).toContain('data-testid="quote-requests-list"');
  });

  it("calls listQuotePitches for the pitches list", () => {
    expect(componentContent).toContain("listQuotePitches(");
    expect(componentContent).toContain('data-testid="quote-pitches-list"');
  });

  it("renders aggregate stats card", () => {
    expect(componentContent).toContain("getQuoteRequestStats(");
    expect(componentContent).toContain('data-testid="expert-quote-stats"');
  });

  it("trigger button calls triggerExpertQuoteRun", () => {
    expect(componentContent).toContain('data-testid="trigger-run-button"');
    expect(componentContent).toContain("triggerExpertQuoteRun(");
  });

  it("surfaces workflow-not-registered error explicitly when 404", () => {
    expect(componentContent).toContain("expert-quote-outreach` is not registered");
    expect(componentContent).toContain('data-testid="trigger-run-error"');
  });
});

describe("Expert Quote Outreach — api client functions", () => {
  it("setFeaturedCreds posts username + password to /keys for `featured` provider", () => {
    expect(apiLibContent).toContain("export async function setFeaturedCreds(");
    // Verify the body shape
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
    expect(apiLibContent).toContain("export async function triggerExpertQuoteRun(");
  });

  it("triggerExpertQuoteRun resolves the workflow by slug then executes it", () => {
    const block = apiLibContent.split("export async function triggerExpertQuoteRun(")[1];
    expect(block).toContain('featureSlug: "pr-expert-quote-outreach"');
    expect(block).toContain("expert-quote-outreach");
    expect(block).toContain("/workflows/${wf.id}/execute");
  });

  it("triggerExpertQuoteRun throws ApiError(404) when workflow not registered", () => {
    const block = apiLibContent.split("export async function triggerExpertQuoteRun(")[1];
    expect(block).toContain("throw new ApiError(");
    expect(block).toContain("404");
  });
});
