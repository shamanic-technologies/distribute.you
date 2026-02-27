import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const billingRoutePath = path.join(__dirname, "../../src/routes/billing.ts");
const content = fs.readFileSync(billingRoutePath, "utf-8");

const schemaPath = path.join(__dirname, "../../src/schemas.ts");
const schemaContent = fs.readFileSync(schemaPath, "utf-8");

const indexPath = path.join(__dirname, "../../src/index.ts");
const indexContent = fs.readFileSync(indexPath, "utf-8");

describe("Billing proxy routes", () => {
  it("should have GET /billing/accounts endpoint", () => {
    expect(content).toContain('"/billing/accounts"');
    expect(content).toContain("router.get");
  });

  it("should have GET /billing/accounts/balance endpoint", () => {
    expect(content).toContain('"/billing/accounts/balance"');
  });

  it("should have GET /billing/accounts/transactions endpoint", () => {
    expect(content).toContain('"/billing/accounts/transactions"');
  });

  it("should have PATCH /billing/accounts/mode endpoint", () => {
    expect(content).toContain('"/billing/accounts/mode"');
    expect(content).toContain("router.patch");
  });

  it("should have POST /billing/credits/deduct endpoint", () => {
    expect(content).toContain('"/billing/credits/deduct"');
    expect(content).toContain("router.post");
  });

  it("should have POST /billing/checkout-sessions endpoint", () => {
    expect(content).toContain('"/billing/checkout-sessions"');
  });

  it("should use authenticate and requireOrg on all authenticated endpoints", () => {
    // Count route definitions using authenticate, requireOrg (6 endpoints, excluding webhook)
    // Also matches the import line, so total is 7
    const authMatches = content.match(/authenticate, requireOrg/g);
    expect(authMatches).not.toBeNull();
    expect(authMatches!.length).toBe(7); // 6 routes + 1 import
  });

  it("should use billingHeaders (with x-key-source) for all authenticated endpoints", () => {
    expect(content).toContain("buildInternalHeaders");
    expect(content).toContain('"x-key-source": "platform"');
    const headerMatches = content.match(/billingHeaders\(req\)/g);
    expect(headerMatches).not.toBeNull();
    expect(headerMatches!.length).toBe(6);
  });

  it("should proxy to externalServices.billing", () => {
    expect(content).toContain("externalServices.billing");
  });

  it("should forward correct downstream paths", () => {
    expect(content).toContain('"/v1/accounts"');
    expect(content).toContain('"/v1/accounts/balance"');
    expect(content).toContain('"/v1/accounts/transactions"');
    expect(content).toContain('"/v1/accounts/mode"');
    expect(content).toContain('"/v1/credits/deduct"');
    expect(content).toContain('"/v1/checkout-sessions"');
  });
});

describe("Stripe webhook proxy", () => {
  it("should export stripeWebhookHandler separately", () => {
    expect(content).toContain("export async function stripeWebhookHandler");
  });

  it("should NOT use authenticate middleware", () => {
    // The handler is exported as a standalone function, not routed through authenticate
    const handlerSection = content.slice(
      content.indexOf("stripeWebhookHandler"),
    );
    // stripeWebhookHandler should not reference authenticate
    expect(handlerSection).not.toContain("authenticate,");
  });

  it("should forward Stripe-Signature header", () => {
    expect(content).toContain("stripe-signature");
    expect(content).toContain("Stripe-Signature");
  });

  it("should use raw body (not JSON parsed)", () => {
    expect(content).toContain("req.body"); // raw Buffer
  });

  it("should proxy to billing-service /v1/webhooks/stripe/:appId", () => {
    expect(content).toContain("/v1/webhooks/stripe/");
    expect(content).toContain("appId");
  });
});

describe("Stripe webhook is mounted before express.json()", () => {
  it("should mount stripe webhook before express.json() in index.ts", () => {
    const webhookIndex = indexContent.indexOf("stripeWebhookHandler");
    const jsonIndex = indexContent.indexOf("express.json()");
    expect(webhookIndex).toBeGreaterThan(-1);
    expect(jsonIndex).toBeGreaterThan(-1);
    expect(webhookIndex).toBeLessThan(jsonIndex);
  });

  it("should use express.raw for the stripe webhook route", () => {
    expect(indexContent).toContain("express.raw");
  });
});

describe("Billing OpenAPI schemas", () => {
  it("should register all billing paths", () => {
    expect(schemaContent).toContain('path: "/v1/billing/accounts"');
    expect(schemaContent).toContain('path: "/v1/billing/accounts/balance"');
    expect(schemaContent).toContain('path: "/v1/billing/accounts/transactions"');
    expect(schemaContent).toContain('path: "/v1/billing/accounts/mode"');
    expect(schemaContent).toContain('path: "/v1/billing/credits/deduct"');
    expect(schemaContent).toContain('path: "/v1/billing/checkout-sessions"');
    expect(schemaContent).toContain('path: "/v1/billing/webhooks/stripe/{appId}"');
  });

  it("should use Billing tag", () => {
    expect(schemaContent).toContain('tags: ["Billing"]');
  });

  it("should define request schemas", () => {
    expect(schemaContent).toContain("SwitchBillingModeRequestSchema");
    expect(schemaContent).toContain("DeductCreditsRequestSchema");
    expect(schemaContent).toContain("CreateCheckoutSessionRequestSchema");
  });

  it("should not require auth on stripe webhook path", () => {
    const webhookSection = schemaContent.slice(
      schemaContent.indexOf('path: "/v1/billing/webhooks/stripe/{appId}"'),
      schemaContent.indexOf('path: "/v1/billing/webhooks/stripe/{appId}"') + 500,
    );
    expect(webhookSection).not.toContain("security: authed");
  });
});

describe("Billing routes are mounted in index.ts", () => {
  it("should import and mount billing routes", () => {
    expect(indexContent).toContain("billingRoutes");
    expect(indexContent).toContain("./routes/billing");
  });
});
