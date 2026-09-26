import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  campaignStartRefusalMessage,
  paymentHoldKind,
  PAYMENT_HOLD_LABEL,
  PAYMENT_HOLD_NOTE,
  PAYMENT_HOLD_ROW_NOTE,
  PAYMENT_HOLD_TITLE,
  scopePaymentHold,
  strongestPaymentHold,
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

// campaign-service's refusal when the org has no card at all.
const NO_CARD_BODY = {
  error: "Your campaigns are paused because there is no payment method on your account. Add a card, then start them again.",
  reason: "no_payment_method",
  blockedReason: "no_chargeable_card",
};

describe("paymentHoldKind", () => {
  it("names the two payment stops and nothing else", () => {
    expect(paymentHoldKind({ status: "stopped", stopReason: "payment_declined" })).toBe("declined");
    expect(paymentHoldKind({ status: "stopped", stopReason: "no_payment_method" })).toBe("no_payment_method");
    expect(paymentHoldKind({ status: "stopped", stopReason: "manual" })).toBeNull();
    expect(paymentHoldKind({ status: "stopped", stopReason: null })).toBeNull();
    expect(paymentHoldKind({ status: "stopped" })).toBeNull();
    // A running row never reads as held, whatever an old reason says.
    expect(paymentHoldKind({ status: "ongoing", stopReason: "payment_declined" })).toBeNull();
    expect(paymentHoldKind({ status: "ongoing", stopReason: "no_payment_method" })).toBeNull();
  });
});

describe("strongestPaymentHold", () => {
  it("a declined card outranks a missing one", () => {
    expect(strongestPaymentHold(["no_payment_method", "declined"])).toBe("declined");
    expect(strongestPaymentHold([null, "no_payment_method"])).toBe("no_payment_method");
    expect(strongestPaymentHold([null])).toBeNull();
  });
});

describe("scopePaymentHold", () => {
  it("fires when a campaign is stopped over the declined payment and nothing runs", () => {
    expect(
      scopePaymentHold([
        { status: "stopped", stopReason: "payment_declined" },
        { status: "stopped", stopReason: "manual" },
      ]),
    ).toBe("declined");
  });
  it("names the missing card when that is the reason", () => {
    expect(
      scopePaymentHold([
        { status: "stopped", stopReason: "no_payment_method" },
        { status: "stopped", stopReason: "manual" },
      ]),
    ).toBe("no_payment_method");
  });
  it("stays silent once anything runs: a start is refused while held, so the hold cleared", () => {
    expect(
      scopePaymentHold([
        { status: "stopped", stopReason: "payment_declined" },
        { status: "ongoing", stopReason: null },
      ]),
    ).toBeNull();
  });
  it("stays silent for a healthy org whose campaign a person paused", () => {
    expect(scopePaymentHold([{ status: "stopped", stopReason: "manual" }])).toBeNull();
    expect(scopePaymentHold([])).toBeNull();
  });
});

describe("campaignStartRefusalMessage", () => {
  it("returns campaign-service's own sentence for a payment_declined 409, verbatim", () => {
    expect(campaignStartRefusalMessage(409, HELD_BODY)).toBe(HELD_BODY.error);
  });
  it("returns campaign-service's own sentence for a no_payment_method 409, verbatim", () => {
    expect(campaignStartRefusalMessage(409, NO_CARD_BODY)).toBe(NO_CARD_BODY.error);
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
    for (const table of [PAYMENT_HOLD_LABEL, PAYMENT_HOLD_NOTE, PAYMENT_HOLD_ROW_NOTE, PAYMENT_HOLD_TITLE]) {
      for (const line of Object.values(table)) expect(line).not.toContain("—");
    }
    expect(read("components/billing/payment-declined-notice.tsx")).not.toContain("—");
  });
});

describe("buildControlRows paymentHold", () => {
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
    expect(rows[0].paymentHold).toBe("declined");
    expect(rows[0].running).toBe(false);
  });
  it("marks a stopped row whose representative was stopped for having no card", () => {
    const rows = buildControlRows(
      [
        { id: "c3", status: "stopped", stopReason: "no_payment_method", offerId: null, featureSlug: null, funnelKey: null, createdAt: "2026-09-27T00:00:00Z" } as never,
      ],
      undefined,
      channels,
      { campaignId: "c3" },
    );
    expect(rows[0].paymentHold).toBe("no_payment_method");
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
    expect(rows[0].paymentHold).toBeNull();
  });
});

describe("call sites", () => {
  it("every campaign status surface reads the payment hold", () => {
    expect(read("components/campaigns/campaigns-table.tsx")).toContain(
      "<StatusPill status={campaign.status} stopReason={campaign.stopReason} />",
    );
    expect(read("components/campaigns/campaign-controls-trigger.tsx")).toContain("r.paymentHold");
    expect(read("components/campaigns/campaign-controls-modal.tsx")).toContain("row.paymentHold");
    expect(read("components/settings/campaign-settings-card.tsx")).toContain("paymentHoldKind(campaign)");
    expect(read("components/settings/offer-campaigns-card.tsx")).toContain("row.paymentHold && !row.running");
  });
  it("dashboard v2 states it on every mission and on every brand page", () => {
    expect(read("components/v2/use-missions.ts")).toContain("paymentHold: paymentHoldKind(c)");
    expect(read("components/v2/missions-table.tsx")).toContain("hold={m.paymentHold}");
    expect(read("components/v2/today-page.tsx")).toContain("hold={m.paymentHold}");
    expect(read("components/v2/mission-page.tsx")).toContain("hold={mission.paymentHold}");
    expect(read("components/v2/setup-pages.tsx")).toContain("hold={mission.paymentHold}");
    expect(read("components/v2/v2-shell.tsx")).toContain("<ScopePaymentDeclinedBand brandId={brandId} />");
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
