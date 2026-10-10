import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  campaignStartRefusalMessage,
  paymentHoldKind,
  PAYMENT_HOLD_LABEL,
  PAYMENT_HOLD_NOTE,
  PAYMENT_HOLD_TITLE,
  billingHoldKind,
  scopePaymentHold,
  scopeStoppedOverPayment,
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

describe("billingHoldKind", () => {
  it("reads billing's current verdict: only charge_blocked holds, billing's reason picks the words", () => {
    expect(billingHoldKind({ state: "charge_blocked", blockedReason: "no_chargeable_card" })).toBe("no_payment_method");
    expect(billingHoldKind({ state: "charge_blocked", blockedReason: "card_declined" })).toBe("declined");
    expect(billingHoldKind({ state: "charge_blocked", blockedReason: "retries_exhausted" })).toBe("declined");
    // A prepaid org is never blocked by billing (the 2026-10-10 org read no_autopay).
    expect(billingHoldKind({ state: "no_autopay", blockedReason: null })).toBeNull();
    expect(billingHoldKind({ state: "will_charge", blockedReason: null })).toBeNull();
    expect(billingHoldKind({ state: "idle", blockedReason: null })).toBeNull();
  });
});

describe("scopePaymentHold", () => {
  it("fires when billing blocks the org NOW and the scope was stopped over payment with nothing running", () => {
    expect(
      scopePaymentHold(
        [
          { status: "stopped", stopReason: "payment_declined" },
          { status: "stopped", stopReason: "manual" },
        ],
        "declined",
      ),
    ).toBe("declined");
    expect(
      scopePaymentHold(
        [
          { status: "stopped", stopReason: "no_payment_method" },
          { status: "stopped", stopReason: "manual" },
        ],
        "no_payment_method",
      ),
    ).toBe("no_payment_method");
  });
  it("words the notice from billing's current reason, not the campaign's old one", () => {
    expect(scopePaymentHold([{ status: "stopped", stopReason: "no_payment_method" }], "declined")).toBe("declined");
  });
  it("stays silent when billing does not block the org, whatever an old stop reason says (prepaid with credit, 2026-10-10)", () => {
    const campaigns = [
      { status: "stopped", stopReason: "manual" },
      { status: "stopped", stopReason: "manual" },
      { status: "stopped", stopReason: "no_payment_method" },
    ];
    expect(scopeStoppedOverPayment(campaigns)).toBe(true);
    expect(scopePaymentHold(campaigns, billingHoldKind({ state: "no_autopay", blockedReason: null }))).toBeNull();
  });
  it("stays silent once anything runs: a start is refused while held, so the hold cleared", () => {
    const campaigns = [
      { status: "stopped", stopReason: "payment_declined" },
      { status: "ongoing", stopReason: null },
    ];
    expect(scopeStoppedOverPayment(campaigns)).toBe(false);
    expect(scopePaymentHold(campaigns, "declined")).toBeNull();
  });
  it("stays silent for a scope a person paused, even while billing blocks the org", () => {
    expect(scopePaymentHold([{ status: "stopped", stopReason: "manual" }], "no_payment_method")).toBeNull();
    expect(scopePaymentHold([], "no_payment_method")).toBeNull();
    expect(scopeStoppedOverPayment([])).toBe(false);
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
    for (const table of [PAYMENT_HOLD_LABEL, PAYMENT_HOLD_NOTE, PAYMENT_HOLD_TITLE]) {
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
    expect(read("lib/use-scope-toggle.ts")).toContain("r.paymentHold");
    expect(read("components/campaigns/campaign-controls-trigger.tsx")).toContain("PAYMENT_HOLD_LABEL[hold]");
    expect(read("components/settings/campaign-settings-card.tsx")).toContain("paymentHoldKind(campaign)");
  });
  it("dashboard v2 states it on every mission and on every brand page", () => {
    expect(read("components/v2/use-missions.ts")).toContain("paymentHold: paymentHoldKind(c)");
    expect(read("components/v2/today-page.tsx")).toContain("hold={m.paymentHold}");
    // The campaign page's status button names the hold itself (PAYMENT_HOLD_LABEL). No hold
    // banner under it (owner 2026-10-05: removed even when true, out of credit included).
    expect(read("components/v2/campaign-page.tsx")).toContain("<CampaignControlsTrigger");
    expect(read("components/v2/campaign-page.tsx")).not.toContain("campaignHoldCopy(hold)");
    expect(read("components/v2/v2-shell.tsx")).toContain("<ScopePaymentDeclinedBand brandId={brandId} />");
  });
  it("every restart surface renders campaign-service's refusal", () => {
    expect(read("lib/use-scope-toggle.ts")).toContain("campaignStartRefusalMessage(err.status, err.body)");
    expect(read("components/settings/campaign-settings-card.tsx")).toContain("campaignStartRefusalMessage(err.status, err.body)");
    expect(read("lib/channel-start.ts")).toContain("campaignStartRefusalMessage(");
  });
  it("the notice that tells the customer to act gates on billing's CURRENT hold, on v2 and v1", () => {
    const notice = read("components/billing/payment-declined-notice.tsx");
    expect(notice).toContain('useAuthQuery(["paymentHoldNow"], getPaymentHoldNow');
    expect(notice).toContain("scopePaymentHold(campaigns, billingHoldKind(hold.data))");
    // The bare kind-taking notice is not exported: no surface can skip billing.
    expect(notice).not.toContain("export function PaymentDeclinedNotice");
    expect(read("components/billing/scope-payment-declined-band.tsx")).toContain("<PaymentHoldNotice campaigns={campaigns} />");
    expect(read("components/settings/campaign-settings-card.tsx")).toContain("<PaymentHoldNotice campaigns={[campaign]} />");
    // The route reads billing's outlook, not a campaign's stop reason.
    expect(read("app/(authed)/api/orgs/payment-hold/route.ts")).toContain("getPaymentOutlook(identity.orgId)");
    expect(read("lib/billing-service.ts")).toContain("/payment-outlook");
  });
  it("billing unreadable says so, never a guessed Add a card", () => {
    const notice = read("components/billing/payment-declined-notice.tsx");
    const at = notice.indexOf("if (!hold.data) {");
    const end = notice.indexOf("const kind = scopePaymentHold(", at);
    expect(at).toBeGreaterThan(-1);
    const branch = notice.slice(at, end);
    expect(branch).toContain("We could not check your billing status.");
    expect(branch).not.toContain("Add a card");
  });
  it("the notice links to Billing", () => {
    expect(read("components/billing/payment-declined-notice.tsx")).toContain("/billing");
  });
});
