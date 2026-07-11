import { afterEach, describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { staticResponse } from "../../src/lib/static-html";

const staticHtmlPath = path.resolve(
  __dirname,
  "../../src/lib/static-html.ts",
);
const salesLandingPagePath = path.resolve(
  __dirname,
  "../../../sales-cold-emails-landing/src/app/page.tsx",
);
const landingDir = path.resolve(__dirname, "../../public/landing");

const staticHtml = fs.readFileSync(staticHtmlPath, "utf-8");
const salesLandingPage = fs.readFileSync(salesLandingPagePath, "utf-8");
const staticPageSource = ["index-v1.html", "performance.html"]
  .map((fileName) => fs.readFileSync(path.join(landingDir, fileName), "utf-8"))
  .join("\n");

describe("Static landing live performance values", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("injects the public best positive-reply cost into static pages", () => {
    expect(staticHtml).toContain("/v1/public/features/best");
    expect(staticHtml).toContain("sales-cold-email-outreach");
    expect(staticHtml).toContain("recipientsRepliesPositive");
    expect(staticHtml).toContain("replaceAll(\"$1.42\"");
  });

  it("does not keep the old positive-reply cost hardcoded in static page source", () => {
    expect(staticPageSource).toContain("__BEST_POSITIVE_REPLY_COST__");
    expect(staticPageSource).toContain("__BEST_POSITIVE_REPLY_COST_NUMERIC__");
    expect(staticPageSource).toContain("__OPEN_RATE__");
    expect(staticPageSource).toContain("__POSITIVE_REPLY_RATE__");
    expect(staticPageSource).toContain("__EMAILS_SENT__");
    expect(staticPageSource).not.toContain("$1.42");
    expect(staticPageSource).not.toContain('data-n="1.42"');
    expect(staticPageSource).not.toContain("48 hrs");
    expect(staticPageSource).not.toContain("first reply within 48 hours");
  });

  it("renders the exact public best positive-reply cost into served HTML", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/v1/public/features/best")) {
        return new Response(
          JSON.stringify({
            best: {
              recipientsRepliesPositive: {
                workflowSlug: "sales-cold-email-outreach-permafrost-v5",
                workflowName: "Sales Cold Email Outreach Permafrost v5",
                createdForBrandId: "01800fc5-3934-4901-858a-60c8e59e2e9c",
                value: 3200,
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          results: [
            {
              stats: {
                recipientsSent: 100,
                recipientsOpened: 38,
                recipientsRepliesPositive: 2,
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const performanceResponse = await staticResponse("performance.html");
    const performanceHtml = await performanceResponse.text();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "/v1/public/features/best?featureSlug=sales-cold-email-outreach&groupBy=workflow",
      ),
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "/v1/public/features/ranked?featureSlug=sales-cold-email-outreach&objective=emailsSent&groupBy=workflow&limit=100",
      ),
      expect.any(Object),
    );
    // Adam's home leads with cost-per-contact ($0.07/contact), a metric the live
    // performance API does not expose, so it carries no live-cost token; the live
    // best-positive-reply cost ($X.XX/reply) is injected on the performance page only.
    expect(performanceHtml).toContain("$32.00");
    expect(performanceHtml).toContain('data-n="32.00"');
    expect(performanceHtml).toContain("38.0%");
    expect(performanceHtml).toContain("2.0%");
    expect(performanceHtml).toContain("100");
    expect(performanceHtml).toContain("emails sent tracked");
    expect(performanceHtml).not.toContain("$1.42");
  });

  it("falls back to last-known-good numbers instead of aborting when the best metric is missing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/v1/public/features/best")) {
        // best response is missing recipientsRepliesPositive (the transient
        // shape that aborted the build).
        return new Response(JSON.stringify({ best: {} }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const indexResponse = await staticResponse("index-v1.html");
    const performanceResponse = await staticResponse("performance.html");
    const indexHtml = await indexResponse.text();
    const performanceHtml = await performanceResponse.text();

    // No raw placeholder tokens leak into the served HTML.
    expect(indexHtml).not.toContain("__BEST_POSITIVE_REPLY_COST__");
    expect(performanceHtml).not.toContain("__OPEN_RATE__");
    expect(performanceHtml).not.toContain("__EMAILS_SENT__");

    // Fallback (last-known-good) values are injected on pages that carry the
    // live cost token. The home leads with $0.07/contact and has no
    // cost-per-reply token, so only performance injects the
    // fallback — the home is asserted to be token-free above.
    expect(performanceHtml).toContain("$1.42");
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("keeps the standalone sales landing on recipient-based public best keys", () => {
    expect(salesLandingPage).toContain('"recipientsOpened"');
    expect(salesLandingPage).toContain('"recipientsRepliesPositive"');
    expect(salesLandingPage).not.toContain('best["opened"]');
    expect(salesLandingPage).not.toContain('best["replied"]');
  });
});
