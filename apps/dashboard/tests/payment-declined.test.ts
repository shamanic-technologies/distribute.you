import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  campaignStartRefusalMessage,
  isPaymentDeclinedStop,
  PAYMENT_DECLINED_LABEL,
  PAYMENT_DECLINED_NOTE,
  scopeHeldByPayment,
} from "../src/lib/payment-declined";
import { buildControlRows } from "../src/lib/campaign-controls";
import { channelWriteErrorMessage } from "../src/lib/channel-start";

const SRC = join(__dirname, "../src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

// Verbatim shape of campaign-service's refusal (src/lib/payment-hold.ts).
const HELD_BODY = {
  error:
    "Your campaigns are paused because your card was declined. Pay your outstanding balance and add a card that works, then start them again.",
  reason: "payment_declined",
  blockedReason: "card_declined",
};

describe("isPaymentDeclinedStop", () => {
  it("is true only for a stopped campaign whose reason is the declined payment", () => {
    expect(isPaymentDeclinedStop({ status: "stopped", stopReason: "payment_declined" })).toBe(true);
    expect(isPaymentDeclinedStop({ status: "stopped", stopReason: "manual" })).toBe(false);
    expect(isPaymentDeclinedStop({ status: "stopped", stopReason: null })).toBe(false);
    expect(isPaymentDeclinedStop({ status: "stopped" })).toBe(false);
    // A running row never reads as declined, whatever an old reason says.
    expect(isPaymentDeclinedStop({ status: "ongoing", stopReason: "payment_declined" })).toBe(false);
  });
});

describe("scopeHeldByPayment", () => {
  it("fires when a campaign is stopped over the declined payment and nothing runs", () => {
    expect(
      scopeHeldByPayment([
        { status: "stopped", stopReason: "payment_declined" },
        { status: "stopped", stopReason: "manual" },
      ]),
    ).toBe(true);
  });
  it("stays silent once anything runs: a start is refused while held, so the hold cleared", () => {
    expect(
      scopeHeldByPayment([
        { status: "stopped", stopReason: "payment_declined" },
        { status: "ongoing", stopReason: null },
      ]),
    ).toBe(false);
  });
  it("stays silent for a healthy org whose campaign a person paused", () => {
    expect(scopeHeldByPayment([{ status: "stopped", stopReason: "manual" }])).toBe(false);
    expect(scopeHeldByPayment([])).toBe(false);
  });
});

describe("campaignStartRefusalMessage", () => {
  it("returns campaign-service's own sentence for a payment_declined 409, verbatim", () => {
    expect(campaignStartRefusalMessage(409, HELD_BODY)).toBe(HELD_BODY.error);
  });
  it("returns it for a billing_unavailable 502 too", () => {
    const body = { error: "We couldn't check your payment status just now, so nothing was started.", reason: "billing_unavailable" };
    expect(campaignStartRefusalMessage(502, body)).toBe(body.error);
  });
  it("returns null for anything else, so the caller keeps its own message", () => {
    expect(campaignStartRefusalMessage(409, { error: "A campaign with this name already exists" })).toBeNull();
    expect(campaignStartRefusalMessage(400, HELD_BODY)).toBeNull();
    expect(campaignStartRefusalMessage(409, { reason: "payment_declined" })).toBeNull();
    expect(campaignStartRefusalMessage(null, null)).toBeNull();
  });
  it("reaches the funnels card's start error through channelWriteErrorMessage", () => {
    const err = Object.assign(new Error("x"), { status: 409, body: HELD_BODY });
    expect(channelWriteErrorMessage(err, "start")).toBe(HELD_BODY.error);
  });
});

describe("copy", () => {
  it("carries no em dash", () => {
    expect(PAYMENT_DECLINED_LABEL).not.toContain("—");
    expect(PAYMENT_DECLINED_NOTE).not.toContain("—");
    expect(read("components/billing/payment-declined-notice.tsx")).not.toContain("—");
  });
});

describe("buildControlRows paymentDeclined", () => {
  const channels = [] as never[];
  it("marks a stopped row whose representative was stopped over the payment", () => {
    const rows = buildControlRows(
      [
        {
          id: "c1",
          status: "stopped",
          stopReason: "payment_declined",
          offerId: null,
          featureSlug: null,
          funnelKey: null,
          createdAt: "2026-09-25T00:00:00Z",
        } as never,
      ],
      undefined,
      channels,
      { campaignId: "c1" },
    );
    expect(rows[0].paymentDeclined).toBe(true);
    expect(rows[0].running).toBe(false);
  });
  it("leaves a manually paused row unmarked", () => {
    const rows = buildControlRows(
      [
        { id: "c2", status: "stopped", stopReason: "manual", offerId: null, featureSlug: null, funnelKey: null, createdAt: "2026-09-25T00:00:00Z" } as never,
      ],
      undefined,
      channels,
      { campaignId: "c2" },
    );
    expect(rows[0].paymentDeclined).toBe(false);
  });
});

describe("call sites", () => {
  it("every campaign status surface reads the declined state", () => {
    expect(read("components/campaigns/campaigns-table.tsx")).toContain(
      "<StatusPill status={campaign.status} stopReason={campaign.stopReason} />",
    );
    expect(read("components/campaigns/campaign-controls-trigger.tsx")).toContain("r.paymentDeclined");
    expect(read("components/campaigns/campaign-controls-modal.tsx")).toContain("row.paymentDeclined");
    expect(read("components/settings/campaign-settings-card.tsx")).toContain("isPaymentDeclinedStop(campaign)");
    expect(read("components/settings/brand-sales-funnels-card.tsx")).toContain("declinedByChannel");
  });
  it("every restart surface renders campaign-service's refusal", () => {
    expect(read("components/campaigns/campaign-controls-modal.tsx")).toContain("campaignStartRefusalMessage(err.status, err.body)");
    expect(read("components/settings/campaign-settings-card.tsx")).toContain("campaignStartRefusalMessage(err.status, err.body)");
    expect(read("lib/channel-start.ts")).toContain("campaignStartRefusalMessage(");
  });
  it("the notice links to Billing and rides every Overview", () => {
    expect(read("components/billing/payment-declined-notice.tsx")).toContain("/billing");
    expect(read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx")).toContain("<ScopePaymentDeclinedBand");
    expect(read("components/campaigns/campaign-overview-page.tsx")).toContain("<ScopePaymentDeclinedBand");
  });
});
