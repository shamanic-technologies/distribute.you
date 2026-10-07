import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHANNEL_REQUEST_TEMPLATE,
  renderChannelRequestHtml,
  renderChannelRequestText,
  sendChannelRequestEmail,
  type ChannelRequest,
} from "../src/lib/channel-request-email";

const req: ChannelRequest = {
  channelSlug: "linkedin",
  channelName: "LinkedIn",
  message: "We want LinkedIn DMs.\nBudget <$2,000> a month & up",
  requesterEmail: "jane@acme.com",
  orgId: "org_1",
  brandId: "b1",
  offerId: "o1",
  pageUrl: "https://dashboard.distribute.you/v2/orgs/org_1/brands/b1/offers/o1/sales-path",
};

describe("channel request email", () => {
  it("escapes the customer's text in HTML and keeps it verbatim in text", () => {
    const html = renderChannelRequestHtml(req);
    expect(html).toContain("Budget &lt;$2,000&gt; a month &amp; up");
    expect(html).not.toContain("<$2,000>");
    expect(renderChannelRequestText(req)).toContain("Budget <$2,000> a month & up");
  });

  it("sends to the staff address under its template, failing loud on non-2xx", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await sendChannelRequestEmail({ request: req, staffEmail: "staff@x.com", userId: "u1", apiUrl: "https://api", adminKey: "k", requestId: "r1", fetchFn });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://api/v1/emails/send");
    const body = JSON.parse(init.body);
    expect(body.eventType).toBe(CHANNEL_REQUEST_TEMPLATE);
    expect(body.recipientEmail).toBe("staff@x.com");
    expect(body.productId).toBe(`${CHANNEL_REQUEST_TEMPLATE}:r1`);
    expect(init.headers["x-external-org-id"]).toBe("org_1");

    const failing = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(
      sendChannelRequestEmail({ request: req, staffEmail: "s", userId: "u", apiUrl: "a", adminKey: "k", requestId: "r", fetchFn: failing }),
    ).rejects.toThrow("send failed: 500");
  });

  it("registers the template at boot (the app that sends it owns it)", () => {
    const boot = readFileSync(join(__dirname, "../src/instrumentation.ts"), "utf8");
    expect(boot).toContain("CHANNEL_REQUEST_TEMPLATE_DEF,");
  });

  it("the Channels picker opens the contact form for a channel we do not run", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/offer-channels-picker.tsx"), "utf8");
    // A channel we do not run is a Contact us card, unless staff mode makes it tickable.
    expect(src).toContain("contactUs={!selectable}");
    expect(src).toContain("channelSelectable(c, staffMode)");
    expect(src).toContain("setContact(c)");
    expect(src).toContain("<ChannelContactModal");
  });
});
