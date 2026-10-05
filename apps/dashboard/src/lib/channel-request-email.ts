/**
 * "Contact us" on a channel we do not run yet (Sales path page, Channels section):
 * the customer writes what they want and the budget they have in mind, and staff get
 * ONE email right away.
 *
 * Template `channel_contact_request` is registered at boot in `instrumentation.ts`.
 * ONE-OWNER: this app sends it, so this app registers it. It is a pure envelope
 * (like `staff_daily_digest`): the body is composed here, so the customer's text is
 * escaped once, in code, before it reaches any HTML.
 *
 * Alias-free on purpose, so the rendering carries real unit tests.
 */
export const CHANNEL_REQUEST_TEMPLATE = "channel_contact_request";

export const CHANNEL_REQUEST_TEMPLATE_DEF = {
  name: CHANNEL_REQUEST_TEMPLATE,
  subject: "{{subject}}",
  htmlBody: "{{htmlBody}}",
  textBody: "{{textBody}}",
} as const;

/** Long enough for a real brief, short enough that the email stays an email. */
export const CHANNEL_REQUEST_MAX_CHARS = 4000;

export interface ChannelRequest {
  channelSlug: string;
  channelName: string;
  message: string;
  requesterEmail: string;
  orgId: string;
  brandId: string;
  offerId: string;
  /** The page the request was sent from, so staff land where the customer was. */
  pageUrl: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderChannelRequestSubject(r: ChannelRequest): string {
  return `Channel request: ${r.channelName} from ${r.requesterEmail}`;
}

export function renderChannelRequestText(r: ChannelRequest): string {
  return [
    `${r.requesterEmail} asked about ${r.channelName} (${r.channelSlug}).`,
    "",
    r.message,
    "",
    `Org: ${r.orgId}`,
    `Brand: ${r.brandId}`,
    `Offer: ${r.offerId}`,
    `Page: ${r.pageUrl}`,
  ].join("\n");
}

export function renderChannelRequestHtml(r: ChannelRequest): string {
  const meta = [
    ["Org", r.orgId],
    ["Brand", r.brandId],
    ["Offer", r.offerId],
  ]
    .map(([k, v]) => `${k}: ${escapeHtml(v)}`)
    .join("<br>");
  return [
    `<p><strong>${escapeHtml(r.requesterEmail)}</strong> asked about <strong>${escapeHtml(r.channelName)}</strong> (${escapeHtml(r.channelSlug)}).</p>`,
    `<p style="white-space:pre-wrap;border:1px solid #e5e5e5;border-radius:8px;padding:12px;">${escapeHtml(r.message)}</p>`,
    `<p style="color:#666;font-size:13px;">${meta}<br><a href="${escapeHtml(r.pageUrl)}">Open the page</a></p>`,
  ].join("\n");
}

/**
 * Send the request to staff. Fail-loud on a non-2xx: the route answers the customer
 * with an error, so they know to try again rather than wait for a reply that never comes.
 */
export async function sendChannelRequestEmail(input: {
  request: ChannelRequest;
  staffEmail: string;
  userId: string;
  apiUrl: string;
  adminKey: string;
  /** Unique per submission, so a retried POST of the same submission never mails twice. */
  requestId: string;
  fetchFn?: typeof fetch;
}): Promise<void> {
  const fetchFn = input.fetchFn ?? fetch;
  const r = input.request;
  const res = await fetchFn(`${input.apiUrl}/v1/emails/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": input.adminKey,
      "x-external-org-id": r.orgId,
      "x-external-user-id": input.userId,
    },
    body: JSON.stringify({
      eventType: CHANNEL_REQUEST_TEMPLATE,
      recipientEmail: input.staffEmail,
      productId: `${CHANNEL_REQUEST_TEMPLATE}:${input.requestId}`,
      metadata: {
        subject: renderChannelRequestSubject(r),
        htmlBody: renderChannelRequestHtml(r),
        textBody: renderChannelRequestText(r),
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[channel-request-email] send failed: ${res.status} ${body.slice(0, 200)}`);
  }
}
