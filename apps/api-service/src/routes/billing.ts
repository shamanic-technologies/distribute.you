import { Router, raw, Request, Response } from "express";
import { authenticate, requireOrg, AuthenticatedRequest } from "../middleware/auth.js";
import { callExternalService, externalServices } from "../lib/service-client.js";
import { buildInternalHeaders } from "../lib/internal-headers.js";

const router = Router();

/** Build billing-service headers: internal headers + x-key-source: "platform" */
function billingHeaders(req: AuthenticatedRequest): Record<string, string> {
  return { ...buildInternalHeaders(req), "x-key-source": "platform" };
}

// GET /v1/billing/accounts — get or create billing account
router.get("/billing/accounts", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await callExternalService(
      externalServices.billing,
      "/v1/accounts",
      { headers: billingHeaders(req) }
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get billing account" });
  }
});

// GET /v1/billing/accounts/balance — quick balance check
// Ensures account exists (upsert) before querying balance
router.get("/billing/accounts/balance", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const headers = billingHeaders(req);
    // Ensure billing account exists (auto-creates if missing)
    await callExternalService(externalServices.billing, "/v1/accounts", { headers });
    const result = await callExternalService(
      externalServices.billing,
      "/v1/accounts/balance",
      { headers }
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get balance" });
  }
});

// GET /v1/billing/accounts/transactions — transaction history
router.get("/billing/accounts/transactions", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await callExternalService(
      externalServices.billing,
      "/v1/accounts/transactions",
      { headers: billingHeaders(req) }
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get transactions" });
  }
});

// PATCH /v1/billing/accounts/mode — switch billing mode
router.patch("/billing/accounts/mode", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await callExternalService(
      externalServices.billing,
      "/v1/accounts/mode",
      { method: "PATCH", body: req.body, headers: billingHeaders(req) }
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to switch billing mode" });
  }
});

// POST /v1/billing/credits/deduct — deduct credits
router.post("/billing/credits/deduct", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await callExternalService(
      externalServices.billing,
      "/v1/credits/deduct",
      { method: "POST", body: req.body, headers: billingHeaders(req) }
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to deduct credits" });
  }
});

// POST /v1/billing/checkout-sessions — create Stripe checkout session
router.post("/billing/checkout-sessions", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await callExternalService(
      externalServices.billing,
      "/v1/checkout-sessions",
      { method: "POST", body: req.body, headers: billingHeaders(req) }
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create checkout session" });
  }
});

/**
 * Stripe webhook handler — exported separately for mounting before express.json().
 * No auth middleware (Stripe validates via signature header).
 * Must receive raw body for signature verification.
 */
export async function stripeWebhookHandler(req: Request, res: Response) {
  try {
    const { appId } = req.params;
    const response = await fetch(
      `${externalServices.billing.url}/v1/webhooks/stripe/${appId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": externalServices.billing.apiKey,
          "Stripe-Signature": (req.headers["stripe-signature"] as string) || "",
        },
        body: req.body, // raw Buffer from express.raw()
      }
    );

    const text = await response.text();
    try {
      res.status(response.status).json(JSON.parse(text));
    } catch {
      res.status(response.status).send(text);
    }
  } catch (error: any) {
    console.error("Stripe webhook proxy error:", error);
    res.status(500).json({ error: error.message || "Failed to proxy Stripe webhook" });
  }
}

export default router;
