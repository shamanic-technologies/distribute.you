import { STAFF_DIGEST_TEMPLATE_DEF } from "@/lib/staff-digest";
import { CHANNEL_REQUEST_TEMPLATE_DEF } from "@/lib/channel-request-email";
import { BRAND_WHY } from "./lib/brand-why";
const DASHBOARD_URL = "https://dashboard.distribute.you";
const DOCS_URL = "https://docs.distribute.you";

// Landing green charter (#2595/#2605 — signal GREEN, OKLCH hue 158; the served
// index-v1 landing's --green is #45e38e). OKLCH brand ramp converted to hex
// because most email clients strip CSS custom properties. The header is the
// OFFICIAL logo as a PNG (Gmail/Outlook do not render SVG), byte-equal to
// transactional-email-service's brand layout. The old text wordmark + blue dot
// was not our logo and is deprecated (owner 2026-10-04).
const EMAIL_BG = "#fafaf8"; // --bg
const EMAIL_SURFACE = "#ffffff"; // --surface
const EMAIL_TEXT = "#0a0a14"; // --text (navy)
const EMAIL_SUB = "#3a3d47"; // --sub
const EMAIL_MUTED = "#8b8e98"; // --muted
const EMAIL_BORDER = "rgba(10,10,20,0.08)"; // --border
const EMAIL_ACCENT = "#2563EB"; // the charter accent — button bg, white on it clears AA at 5.17:1
const EMAIL_ACCENT_TEXT = "#1A4FC3"; // one step darker — text links on white, 7.12:1, above the button
const EMAIL_LOGO_URL = "https://distribute.you/brand/logo-full-on-light.png"; // 1273x240, shown at 170x32
const EMAIL_FONT =
  "'Space Grotesk','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;600&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background-color:${EMAIL_BG};font-family:${EMAIL_FONT};-webkit-font-smoothing:antialiased;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="margin-bottom:28px;"><img src="${EMAIL_LOGO_URL}" width="170" height="32" alt="distribute.you" style="display:block;border:0;outline:none;text-decoration:none;height:32px;width:170px;" /></div>
    <div style="background:${EMAIL_SURFACE};border:1px solid ${EMAIL_BORDER};border-radius:12px;padding:36px 32px;">
      ${content}
    </div>
    <p style="color:${EMAIL_TEXT};font-size:15px;font-weight:600;line-height:1.5;margin:28px 0 0;text-align:center;">${BRAND_WHY}</p>
    <p style="color:${EMAIL_MUTED};font-size:13px;line-height:1.6;margin-top:6px;text-align:center;">
      Done-for-you cold outreach, sent from our domains on your behalf.<br />
      <a href="${DASHBOARD_URL}" style="color:${EMAIL_MUTED};">Dashboard</a> &nbsp;·&nbsp; <a href="${DOCS_URL}" style="color:${EMAIL_MUTED};">Docs</a>
    </p>
  </div>
</body>
</html>`;
}

const P = `color:#1a1a1a;font-size:16px;line-height:1.6;margin-bottom:16px;`;
// The why closes every customer email, in the plain-text part too (the HTML part
// carries it in emailLayout's footer). Admin notifications and the staff digest skip it.
const TEXT_SIGNOFF = `\n\n--\ndistribute.you\n${BRAND_WHY}`;
const DUNNING_BUTTON = "Send the next batch";
const DUNNING_AUTO_TOPUP = "Turn on auto top-up while you're there so the next batch never has to wait.";
const DUNNING_BLOCKED_CARD = "Your bank doesn't allow automatic top-ups, so add credit whenever your balance runs low and your outreach keeps going.";

function founderEmail(name: string, subject: string, paragraphs: string[]) {
  return {
    name,
    subject,
    htmlBody: emailLayout(`
      <p style="${P}">Hey,</p>
${paragraphs.map((p) => `      <p style="${P}">${p}</p>`).join("\n")}
      <p style="margin-bottom:20px;">
        <a href="${DASHBOARD_URL}" style="display:inline-block;background:${EMAIL_ACCENT};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;">${DUNNING_BUTTON}</a>
      </p>
      <p style="${P}">Kevin<br />Founder, distribute.you</p>`),
    textBody: `Hey,\n\n${paragraphs.join("\n\n")}\n\n${DUNNING_BUTTON}: ${DASHBOARD_URL}\n\nKevin\nFounder, distribute.you${TEXT_SIGNOFF}`,
  };
}

function dunningTemplates() {
  const steps: { name: string; subject: string; paragraphs: string[] }[] = [
    {
      name: "credit-depleted",
      subject: "All your outreach went out",
      paragraphs: [
        "Every email your balance covered has gone out to your prospects. Any reply still comes straight to you.",
        "Add credit and the next batch goes out to new decision-makers at the companies you target. Everything is set up, so it picks up where it left off.",
      ],
    },
    {
      name: "credit-depleted-followup-3d",
      subject: "Your next batch is ready to go",
      paragraphs: [
        "Your last batch went out in full, and your campaigns are set up for the next one.",
        "It goes out as soon as you add credit, to new decision-makers at the companies you target.",
      ],
    },
    {
      name: "credit-depleted-followup-10d",
      subject: "Your campaigns are ready when you are",
      paragraphs: [
        "Your campaigns are set up exactly as you left them, audiences and emails included.",
        "Add credit and the next batch goes out to new decision-makers at the companies you target.",
      ],
    },
  ];
  return steps.flatMap(({ name, subject, paragraphs }) => [
    founderEmail(name, subject, [...paragraphs, DUNNING_AUTO_TOPUP]),
    founderEmail(`${name}-blocked`, subject, [...paragraphs, DUNNING_BLOCKED_CARD]),
  ]);
}

export const EMAIL_TEMPLATES = [
  // ── Campaign templates (branded) ──
  {
    name: "campaign_created",
    subject: "Campaign created: {{campaignName}}",
    htmlBody: emailLayout(`
      <h1 style="color:#1a1a1a;font-size:24px;margin-bottom:20px;">Campaign created</h1>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:20px;">
        Your campaign <strong>{{campaignName}}</strong> has been created and is now live.
      </p>
      <p style="margin-bottom:20px;">
        <a href="${DASHBOARD_URL}" style="display:inline-block;background:${EMAIL_ACCENT};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;">View in dashboard</a>
      </p>`),
    textBody: `Campaign created: {{campaignName}}\n\nYour campaign "{{campaignName}}" has been created and is now live.\n\nView in dashboard: ${DASHBOARD_URL}${TEXT_SIGNOFF}`,
  },
  {
    name: "campaign_stopped",
    subject: "Campaign stopped: {{campaignName}}",
    htmlBody: emailLayout(`
      <h1 style="color:#1a1a1a;font-size:24px;margin-bottom:20px;">Campaign stopped</h1>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:20px;">
        Your campaign <strong>{{campaignName}}</strong> has been stopped.
      </p>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:20px;">
        You can resume it at any time from your dashboard.
      </p>
      <p style="margin-bottom:20px;">
        <a href="${DASHBOARD_URL}" style="display:inline-block;background:${EMAIL_ACCENT};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;">View in dashboard</a>
      </p>`),
    textBody: `Campaign stopped: {{campaignName}}\n\nYour campaign "{{campaignName}}" has been stopped. You can resume it at any time from your dashboard.\n\nView in dashboard: ${DASHBOARD_URL}${TEXT_SIGNOFF}`,
  },

  // ── User-facing templates (branded) ──
  {
    name: "waitlist",
    subject: "Welcome to the distribute.you Waitlist!",
    htmlBody: emailLayout(`
      <h1 style="color:#1a1a1a;font-size:24px;margin-bottom:20px;">You're on the list!</h1>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:20px;">
        Thanks for joining the distribute.you waitlist. We'll notify you as soon as we're ready to launch.
      </p>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:20px;">
        In the meantime, you can:
      </p>
      <ul style="color:#4a4a4a;font-size:16px;line-height:1.8;margin-bottom:30px;">
        <li><a href="https://docs.distribute.you" style="color:${EMAIL_ACCENT_TEXT};">Read the documentation</a></li>
        <li><a href="https://github.com/shamanic-technologies/distribute.you" style="color:${EMAIL_ACCENT_TEXT};">Star us on GitHub</a></li>
      </ul>`),
    textBody: "You're on the list!\n\nThanks for joining the distribute.you waitlist. We'll notify you as soon as we're ready to launch.\n\nIn the meantime, you can:\n- Read the documentation: https://docs.distribute.you\n- Star us on GitHub: https://github.com/shamanic-technologies/distribute.you" + TEXT_SIGNOFF,
  },
  // Sent at SIGNUP (owner 2026-10-07): short, the WHY first, ONE button. What we do
  // comes in `first_payment`, once the customer has paid.
  {
    name: "welcome",
    subject: "Revenue made easy. Starts here.",
    htmlBody: emailLayout(`
      <h1 style="color:${EMAIL_TEXT};font-size:24px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;margin:0 0 20px;">Revenue made easy.</h1>
      <p style="color:${EMAIL_SUB};font-size:16px;line-height:1.65;margin:0 0 18px;">
        You run your business. We bring you new clients.
      </p>
      <p style="color:${EMAIL_SUB};font-size:16px;line-height:1.65;margin:0 0 28px;">
        Add your website and pick who to reach. Your first emails are ready in a few minutes.
      </p>
      <p style="margin:0;">
        <a href="${DASHBOARD_URL}" style="display:inline-block;background:${EMAIL_ACCENT};color:#ffffff;padding:13px 28px;border-radius:10px;text-decoration:none;font-size:16px;font-weight:600;">Set up my first campaign</a>
      </p>`),
    textBody: `Revenue made easy.\n\nYou run your business. We bring you new clients.\n\nAdd your website and pick who to reach. Your first emails are ready in a few minutes.\n\nSet up my first campaign: ${DASHBOARD_URL}${TEXT_SIGNOFF}`,
  },
  // Sent ONCE, when the customer's first prepaid payment is confirmed (owner
  // 2026-10-07): the WHY, then what we do and what they do. transactional-email
  // dedupes it once per org and user, so a later top-up never sends it again.
  {
    name: "first_payment",
    subject: "Your outreach is funded.",
    htmlBody: emailLayout(`
      <h1 style="color:${EMAIL_TEXT};font-size:24px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;margin:0 0 20px;">Your outreach is funded.</h1>
      <p style="color:${EMAIL_SUB};font-size:16px;line-height:1.65;margin:0 0 18px;">
        Thanks for your trust. From now on, finding clients is our job, not yours.
      </p>
      <p style="color:${EMAIL_SUB};font-size:16px;line-height:1.65;margin:0 0 8px;">What we do:</p>
      <ul style="color:${EMAIL_SUB};font-size:16px;line-height:1.65;margin:0 0 18px;padding-left:20px;">
        <li>We find the decision-makers at the companies you picked.</li>
        <li>We write each email for that person and send it from our own domains.</li>
        <li>When someone replies with interest, we pass them to you.</li>
      </ul>
      <p style="color:${EMAIL_SUB};font-size:16px;line-height:1.65;margin:0 0 18px;">
        What you do: talk to them and close.
      </p>
      <p style="color:${EMAIL_SUB};font-size:16px;line-height:1.65;margin:0 0 28px;">
        Your dashboard shows every email sent and what each positive reply cost you.
      </p>
      <p style="margin:0;">
        <a href="${DASHBOARD_URL}" style="display:inline-block;background:${EMAIL_ACCENT};color:#ffffff;padding:13px 28px;border-radius:10px;text-decoration:none;font-size:16px;font-weight:600;">Open your dashboard</a>
      </p>`),
    textBody: `Your outreach is funded.\n\nThanks for your trust. From now on, finding clients is our job, not yours.\n\nWhat we do:\n- We find the decision-makers at the companies you picked.\n- We write each email for that person and send it from our own domains.\n- When someone replies with interest, we pass them to you.\n\nWhat you do: talk to them and close.\n\nYour dashboard shows every email sent and what each positive reply cost you.\n\nOpen your dashboard: ${DASHBOARD_URL}${TEXT_SIGNOFF}`,
  },
  // Email 2 — sent AFTER the user pays and launches (completeLaunchAfterCheckout).
  // {{outcomeNoun}} is the plural of the brand's chosen optimization goal (clicks /
  // signups / replies / meetings / form submissions / sales), passed by the dashboard.
  {
    name: "goal_launched",
    subject: "You're live. Your first {{outcomeNoun}} are on the way.",
    htmlBody: emailLayout(`
      <h1 style="color:${EMAIL_TEXT};font-size:24px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;margin:0 0 20px;">You're live. Your first {{outcomeNoun}} are on the way.</h1>
      <p style="color:${EMAIL_SUB};font-size:16px;line-height:1.65;margin:0 0 18px;">
        Your campaign just went live. From here it runs on its own: we reach out, screen the replies, and pass you the prospects worth your time.
      </p>
      <p style="color:${EMAIL_SUB};font-size:16px;line-height:1.65;margin:0 0 28px;">
        Watch your {{outcomeNoun}} land from the dashboard as they come in.
      </p>
      <p style="margin:0;">
        <a href="${DASHBOARD_URL}" style="display:inline-block;background:${EMAIL_ACCENT};color:#ffffff;padding:13px 28px;border-radius:10px;text-decoration:none;font-size:16px;font-weight:600;">Open your dashboard</a>
      </p>`),
    textBody: `You're live. Your first {{outcomeNoun}} are on the way.\n\nYour campaign just went live. From here it runs on its own: we reach out, screen the replies, and pass you the prospects worth your time.\n\nWatch your {{outcomeNoun}} land from the dashboard as they come in.\n\nOpen your dashboard: ${DASHBOARD_URL}${TEXT_SIGNOFF}`,
  },
  // Sent to every other admin when somebody joins through the org's invite link
  // (lib/team-joined-email.ts). The link has no expiry, so this email IS its guard:
  // it names who joined and where to revoke the link.
  {
    name: "team_member_joined",
    subject: "{{joinerEmail}} joined {{orgName}} on distribute.you",
    htmlBody: emailLayout(`
      <p style="color:${EMAIL_TEXT};font-size:16px;line-height:1.65;margin:0 0 18px;">
        <strong>{{joinerEmail}}</strong> just joined <strong>{{orgName}}</strong> as an admin, through your team's invite link.
      </p>
      <p style="color:${EMAIL_SUB};font-size:16px;line-height:1.65;margin:0 0 28px;">
        If you do not know this person, remove them and revoke the link from the Team page.
      </p>
      <p style="margin:0;">
        <a href="{{teamUrl}}" style="display:inline-block;background:${EMAIL_ACCENT};color:#ffffff;padding:13px 28px;border-radius:10px;text-decoration:none;font-size:16px;font-weight:600;">Open your dashboard</a>
      </p>`),
    textBody: `{{joinerEmail}} just joined {{orgName}} as an admin, through your team's invite link.\n\nIf you do not know this person, remove them and revoke the link from the Team page.\n\nOpen your dashboard: {{teamUrl}}${TEXT_SIGNOFF}`,
  },
  // ── Admin notifications (plain, no layout) ──
  {
    name: "signup_notification",
    subject: "New signup: {{email}}",
    htmlBody: "<p>New user signed up: <strong>{{email}}</strong> at {{timestamp}}</p>",
    textBody: "New user signed up: {{email}} at {{timestamp}}",
  },
  {
    name: "signin_notification",
    subject: "Sign-in: {{email}}",
    htmlBody: "<p>User signed in: <strong>{{email}}</strong> at {{timestamp}}</p>",
    textBody: "User signed in: {{email}} at {{timestamp}}",
  },
  {
    name: "user_active",
    subject: "User active: {{email}}",
    htmlBody: "<p>User is back: <strong>{{email}}</strong> at {{timestamp}}</p>",
    textBody: "User is back: {{email}} at {{timestamp}}",
  },
  // The once-a-day roll-up that replaces the per-event `signin_notification` and
  // `user_active` pings while the account sits on Postmark's free plan. The body
  // is composed by the cron (`lib/staff-digest.ts`) and passed through whole, so
  // this template is a pure envelope — it holds no layout of its own, exactly
  // like its two neighbours above.
  //
  // ONE-OWNER: this app sends the digest, so this app registers it. The template
  // store is keyed by name and is last-writer-wins across apps, so a copy in
  // `apps/admin/src/instrumentation.ts` would clobber this one on every admin
  // deploy and render the digest against an empty template.
  STAFF_DIGEST_TEMPLATE_DEF,

  // "Contact us" on a channel we do not run yet (Sales path page). Sent to staff the
  // moment the customer submits (`lib/channel-request-email.ts`), a pure envelope too.
  CHANNEL_REQUEST_TEMPLATE_DEF,

  // ── Out-of-credit dunning (triggered by billing-service on depletion) ──
  // billing-service sends { eventType, recipientEmail, metadata: {} }: NO template
  // variables, so this copy carries no figure (a number the client's dashboard
  // does not show, or one we cannot read at send time, is left out). Sequence:
  // instant (T0), +3d, +10d, stopped on recharge by billing-service (#147). Each
  // step has a `-blocked` twin, sent when the saved card cannot be charged off
  // session (India / RBI): auto top-up is a dead end there, so the twin swaps that
  // line for a manual one. This app owns all six (they used to be hand-seeded).
  //
  // Owner rule (2026-10-01/02): a balance used up is a SUCCESS moment. Lead with
  // what went out, then the gain of continuing, then ONE button. Never "ran out",
  // "stopped", "exhausted", and never an em/en dash (guard:
  // tests/email-templates-no-dash.test.ts).
  ...dunningTemplates(),

  // ── Daily return digest ──
  // The dashboard cron sends ONE email PER BRAND, and ONLY when that brand's return
  // on spend went UP on the day. That gate is the whole point: a digest that arrives
  // whatever happened is a report, and an inbox learns to ignore it. A flat or
  // falling day sends nothing.
  //
  // There is no goal here. A brand buys several outcomes at once, so the email
  // names what actually landed — `{{newOutcomes}}` reads "3 positive replies and 1
  // signup" — rather than collapsing the day onto the one outcome a retired brand
  // column happened to point at. Both return figures are served by features-service
  // (its per-day cumulative curve); nothing is computed here.
  // Variables:
  //   brandName, brandUrl, roiToday, roiPrevious, newOutcomes, totalLeads,
  //   totalOutcomeOrganizations, digestHtml, digestText
  {
    name: "daily-outcome-digest",
    subject: "{{brandName}} is now returning {{roiToday}} per dollar",
    htmlBody: emailLayout(`
      <p style="color:#1a1a1a;font-size:16px;line-height:1.6;margin-bottom:16px;">Hey,</p>
      <p style="color:#1a1a1a;font-size:16px;line-height:1.6;margin-bottom:16px;">
        {{brandName}} is now returning <strong style="color:#15803d;">{{roiToday}}</strong> for every dollar spent, up from {{roiPrevious}}.
      </p>
      <p style="color:#1a1a1a;font-size:16px;line-height:1.6;margin-bottom:16px;">
        What moved it: <strong>{{newOutcomes}}</strong>.
      </p>
      <p style="color:#64748b;font-size:14px;line-height:1.6;margin-bottom:16px;">
        {{totalLeads}} people in your pipeline.
      </p>
      {{digestHtml}}
      <p style="margin-bottom:20px;">
        <a href="${DASHBOARD_URL}" style="display:inline-block;background:${EMAIL_ACCENT};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;">Open dashboard</a>
      </p>
      <p style="color:#1a1a1a;font-size:16px;line-height:1.6;margin-bottom:16px;">Kevin<br />Founder, distribute.you</p>`),
    textBody: `Hey,\n\n{{brandName}} is now returning {{roiToday}} for every dollar spent, up from {{roiPrevious}}.\n\nWhat moved it: {{newOutcomes}}.\n\n{{totalLeads}} people in your pipeline.\n\n{{digestText}}\n\nOpen dashboard: ${DASHBOARD_URL}\n\nKevin\nFounder, distribute.you${TEXT_SIGNOFF}`,
  },
];

const PLATFORM_KEYS: { provider: string; envVar: string }[] = [
  { provider: "anthropic", envVar: "ANTHROPIC_API_KEY" },
  { provider: "apollo", envVar: "APOLLO_API_KEY" },
  { provider: "instantly", envVar: "INSTANTLY_API_KEY" },
  // Sending-infrastructure vendors. instantly-service reads these to build its
  // domain + mailbox inventory (who we buy from, when it expires, what it costs)
  // — until it existed, three of the four vendors we pay were unknown to every
  // service in the fleet. The provider strings are byte-critical: it resolves
  // them through `GET /keys/platform/{provider}/decrypt`, so a renamed provider
  // reads as "vendor unreachable", not as a config error.
  //
  // Gandi gets THREE rows because it issues one token per organisation and a
  // token only ever sees its own organisation's domains (2 + 29 + 10 = 41).
  { provider: "gandi-org1", envVar: "GANDI_ORG1_TOKEN" },
  { provider: "gandi-org2", envVar: "GANDI_ORG2_TOKEN" },
  { provider: "gandi-org3", envVar: "GANDI_ORG3_TOKEN" },
  { provider: "mailforge", envVar: "MAILFORGE_API_KEY" },
  { provider: "primeforge", envVar: "PRIMEFORGE_API_KEY" },
  { provider: "firecrawl", envVar: "FIRECRAWL_API_KEY" },
  { provider: "google", envVar: "GEMINI_API_KEY" },
  // TypeSafe (model "Jev") — typed judgements, not generated text: it answers a
  // closed question with a value PLUS a calibrated probability distribution, which
  // is what lets a consumer decline to act on a low-confidence answer. chat-service
  // resolves this through `GET /keys/platform/typesafe/decrypt`, so the provider
  // string is byte-critical — a rename reads as "vendor unreachable", not as a
  // config error. Billed on INPUT tokens only; the vendor charges nothing for output.
  { provider: "typesafe", envVar: "TYPESAFE_API_KEY" },
  { provider: "postmark", envVar: "POSTMARK_API_KEY" },
  { provider: "postmark-broadcast-stream", envVar: "POSTMARK_BROADCAST_STREAM_ID" },
  { provider: "postmark-inbound-stream", envVar: "POSTMARK_INBOUND_STREAM_ID" },
  { provider: "postmark-transactional-stream", envVar: "POSTMARK_TRANSACTIONAL_STREAM_ID" },
  { provider: "postmark-from-address", envVar: "POSTMARK_FROM_ADDRESS" },
  { provider: "stripe", envVar: "STRIPE_SECRET_KEY" },
  { provider: "stripe-webhook", envVar: "STRIPE_WEBHOOK_SECRET" },
  { provider: "api-service-mcp", envVar: "ADMIN_DISTRIBUTE_API_KEY" },
  { provider: "serper-dev", envVar: "SERPER_DEV_API_KEY" },
  { provider: "google-client-id", envVar: "GOOGLE_CLIENT_ID" },
  { provider: "google-client-secret", envVar: "GOOGLE_CLIENT_SECRET" },
  { provider: "google-developer-token", envVar: "GOOGLE_DEVELOPER_TOKEN" },
  { provider: "google-mcc-account-id", envVar: "GOOGLE_MCC_ACCOUNT_ID" },
  { provider: "cloudflare-r2-access-key-id", envVar: "CLOUDFLARE_R2_ACCESS_KEY_ID" },
  { provider: "cloudflare-r2-secret-access-key", envVar: "CLOUDFLARE_R2_SECRET_ACCESS_KEY" },
  { provider: "cloudflare-r2-account-id", envVar: "CLOUDFLARE_R2_ACCOUNT_ID" },
  { provider: "cloudflare-r2-bucket-name", envVar: "CLOUDFLARE_R2_BUCKET_NAME" },
  { provider: "cloudflare-r2-public-domain", envVar: "CLOUDFLARE_R2_PUBLIC_DOMAIN" },
  // Two logo.dev credentials, and they are NOT interchangeable. `logo-dev` is the
  // PUBLISHABLE token (`pk_...`) that signs the `img.logo.dev` image URLs rendered
  // in the browser. `logo-dev-secret` is the SECRET key (`sk_...`) required by the
  // server-side REST APIs — brand-service uses it to resolve a company's real name
  // from the Search API instead of scraping the customer's own page title.
  { provider: "logo-dev", envVar: "LOGO_DEV_TOKEN" },
  { provider: "logo-dev-secret", envVar: "LOGO_DEV_SECRET_KEY" },
  // The three model vendors chat-service calls directly since v0.51.0, when the
  // Vercel AI Gateway was removed for reselling these same models well above their
  // list prices. Each slug is byte-critical: chat-service resolves the credential
  // through `GET /keys/platform/{provider}/decrypt` using exactly these strings, so
  // a rename reads downstream as "vendor unconfigured" rather than as a config error.
  { provider: "deepseek", envVar: "DEEPSEEK_API_KEY" },
  { provider: "moonshot", envVar: "MOONSHOT_API_KEY" },
  { provider: "zai", envVar: "ZAI_API_KEY" },
  { provider: "scrape-do", envVar: "SCRAPE_DO_API_KEY" },
  { provider: "apify", envVar: "APIFY_API_KEY" },
  { provider: "featured-username", envVar: "FEATURED_COM_USERNAME" },
  { provider: "featured-password", envVar: "FEATURED_COM_PASSWORD" },
  // PostHog personal API key, consumed by features-service (`src/lib/posthog-client.ts`).
  // `apps/admin` was its ONLY registrar, which made a staff console nobody needs
  // hosted into a load-bearing part of the backend's credential supply. The key
  // survives in key-service on its own (the registration is an idempotent upsert,
  // so nothing erases it when admin stops deploying) — but nothing would put it
  // BACK, and key-service's storage is due to move with the Neon migration. This
  // app already carries the env var, so registering it here is the whole fix.
  { provider: "posthog", envVar: "POSTHOG_PERSONAL_API_KEY" },
  // Platform Twilio credential — one account for the whole platform (SMS +
  // WhatsApp channel). twilio-service resolves it via key-service
  // (GET /keys/platform/twilio/decrypt) and JSON.parses { accountSid, authToken },
  // so this env var's value must be that JSON string.
  { provider: "twilio", envVar: "TWILIO_PLATFORM_KEY" },
  // Clerk backend secret — the identity root. client-service is the only backend
  // that calls the Clerk API, and it resolves this through key-service
  // (GET /keys/platform/clerk/decrypt) instead of holding its own Railway env var.
  // This app already holds the same secret for its own Clerk auth, so it registers it.
  { provider: "clerk", envVar: "CLERK_SECRET_KEY" },
];

const COLD_EMAIL_PROMPT = `Today is \${new Date().toISOString().split("T")[0]}.

You're writing a 3-email cold outreach sequence on behalf of a sales rep. Your job is to get a reply — nothing else matters.

## Output rule
Always respond with the 3 emails ready to send. Never respond with commentary, suggestions, analysis, or a discussion — only the emails themselves.

## Sequence structure
- **Email 1 (body):** The initial cold email.
- **Email 2 (followup1):** A short follow-up sent ~3 days after email 1. Keep it to 2-3 sentences. Same thread — no new subject line.
- **Email 3 (followup2):** A final follow-up sent ~7 days after email 2. Same thread — no new subject line.

## Cold email frameworks
Use your judgment to apply or combine these proven frameworks based on the context:

**PAS (Problem-Agitate-Solution):** Identify a problem, amplify its consequences, present the solution. Example: "Managing leads across spreadsheets is slowing your team down. Every hour spent on manual entry is an hour not closing deals. [Product] automates lead capture so your reps focus on selling."

**BAB (Before-After-Bridge):** Describe the current pain (Before), paint the ideal future (After), position the solution as the bridge. Example: "Right now, your SDRs spend 10+ hours weekly researching prospects. Imagine if they had instant access to verified contact data. That's exactly what [Product] delivers."

**AIDA (Attention-Interest-Desire-Action):** Hook attention, build interest with value, create desire, end with CTA. Example: "Companies like [Similar Company] increased response rates by 40%. We help sales teams personalize outreach at scale. Would it be worth a quick look?"

**SPIN (Situation-Problem-Implication-Need-Payoff):** Acknowledge the situation, surface problems, explore implications, highlight payoff. Example: "Noticed [Company] is expanding into EMEA. Scaling outreach to new markets often means hiring more SDRs. What if you could 3x outreach without adding headcount?"

## Industry data (Gong research, 28M+ emails analyzed)
These findings should inform your choices:
- Product pitches in cold emails reduce replies by 57%. Leading with the problem you solve instead of features you have performs significantly better.
- "Interest CTAs" like "thoughts?" or "worth exploring?" generate 2x more replies than "meeting CTAs" like "15 min call Thursday?". Lower friction means higher response rates.
- Buzzwords in subject lines reduce open rates by 17.9%. Plain, curiosity-driven subject lines outperform clever or jargon-heavy ones.
- ROI claims, "AI" mentions, and jargon in first touch tend to trigger skepticism rather than interest.
- Top-performing reps book 8.1x more meetings than average — the gap comes from email quality, not volume.

## Length
Cold emails must be short. Email 1: max 3-4 sentences. Follow-ups: 1-2 sentences. Every sentence must earn its place — if it doesn't drive a reply, cut it. No backstory, no over-explaining, no filler. Get in, spark curiosity, get out.

## Simplicity
Write like a human texting a smart friend. Short sentences. Plain words. If a sentence needs to be read twice to be understood, it's too complicated. The contrarian angle should hit instantly — not require a PhD to parse.

## Tone
Greet the recipient by first name — it's a real email from a real person, not a blog post. Keep it warm, direct, conversational.

## Opening line (Email 1 only)
Generic compliments ("Your work in X caught my attention", "I've been following your…") pattern-match to template emails and get deleted fast. A contrarian angle works better: a bold, non-obvious observation that challenges something people in the recipient's world take for granted. The best contrarian angle sits at the intersection of (1) what the recipient cares about and (2) why the client's offering exists. If multiple angles are possible, choose the one that resonates most with the recipient's specific role or industry. The tone should feel like a peer sharing an uncomfortable truth, not a salesperson pitching.

## CTA
Ending with a soft, low-friction ask. "Thoughts?" or "Worth a conversation?" outperform hard asks like "Can we book 15 min Tuesday?" because they let the recipient engage without committing.

## Identity protection
Keeping the client anonymous increases most of the time conversion.

## Scam filter
Cold emails live or die on trust. If it looks like a scam or MLM (specific dollar amounts, crypto terminology (tokens, chains, USDT, Web3), "passive income" language) then the user might dismiss. Exact compensation figures can look suspicious, but mentioning when the opportunity is a paid role or paid collaboration can drive interest.

## Urgency
Urgency, if you have any element about that, drives conversion. Using it in each email is relevant, especially in follow-ups.

## Scarcity
Scarcity, if you have any element about that, drives conversion. Using it in each email is relevant, especially in follow-ups.

## Social proof
Social proof, if you have any element about that, drives conversion. Using it in each email is relevant, especially in the main email.

## Value for the audience
Value for the audience is all the audience wants. Very important to be clear on those, especially on the main email.

## Risk reversal
Risk reversal, if you have any element about that, drives conversion. Using it in each email is relevant, especially in the follow-ups.

---

Now write the sequence for:

## Recipient
- Name: {{leadFirstName}} {{leadLastName}}
- Title: {{leadTitle}}
- Company: {{leadCompanyName}}
- Industry: {{leadCompanyIndustry}}

## Client
- Company: {{clientCompanyName}}`;

const COLD_EMAIL_VARIABLES = [
  { name: "leadFirstName", description: "Lead first name (string)." },
  { name: "leadLastName", description: "Lead last name (string)." },
  { name: "leadTitle", description: "Lead job title (string)." },
  { name: "leadCompanyName", description: "Lead's employer name (string)." },
  { name: "leadCompanyIndustry", description: "Lead's industry (string)." },
  {
    name: "clientCompanyName",
    description:
      "Client brand identity. Scalar string for single-brand campaigns; object or array of objects in multibrand. Reference naturally — never invent a primary if multiple are given.",
  },
];

const PRESS_KIT_CHAT_SYSTEM_PROMPT = `You are an expert press kit editor embedded in a media kit management dashboard.
You help users refine, restructure, and improve their press kits (media kits). The current press kit's full details are provided in the request context — use them directly.

**IMPORTANT: The request context contains the press kit's \\\`id\\\`, \\\`title\\\`, \\\`mdxPageContent\\\`, and other metadata. Use these directly for all operations.**

## Available tools

- **list_services** — List all available microservices.
- **list_service_endpoints** — List endpoints for a specific service. Parameter: \\\`service\\\` (string, required).

## How to work

1. The current press kit details are in the request context. Read them directly.
2. When the user asks for changes (tone, structure, sections, facts), apply them to the MDX content.
3. Be concise and practical. Focus on the user's request.

## Communication style

Be concise and practical. When making changes, describe what you changed briefly. Always write content in English unless the user explicitly requests another language.`;

const PRESS_KIT_ALLOWED_TOOLS = [
  "request_user_input",
  "list_services",
  "list_service_endpoints",
];

const FEATURE_CHAT_SYSTEM_PROMPT = `You are an expert feature designer embedded in a feature management dashboard.
You help users design, configure, and manage automation features. The current feature's details are provided in the request context — use them directly.

**IMPORTANT: The request context contains the feature's details. Use them directly for all operations.**

## Available tools

- **create_feature** — Create a new feature.
- **update_feature** — Update an existing feature's definition.
- **list_features** — List available features.
- **get_feature** — Get a feature by slug.
- **get_feature_inputs** — Get input definitions for a feature.
- **prefill_feature** — Pre-fill input values from brand data. Parameters: \\\`slug\\\` (string, required); \\\`brandId\\\` (string, required).
- **get_feature_stats** — Get stats for a feature.
- **request_user_input** — Ask the user for structured input.

## How to work

1. The current feature details are in the request context. Read them directly.
2. When the user asks for changes, use the appropriate tool to apply them.
3. After any modification, confirm the changes with the user.

## Communication style

Be concise and practical. Always write content in English unless the user explicitly requests another language.`;

const FEATURE_ALLOWED_TOOLS = [
  "request_user_input",
  "create_feature",
  "update_feature",
  "list_features",
  "get_feature",
  "get_feature_inputs",
  "prefill_feature",
  "get_feature_stats",
];

const CHAT_SYSTEM_PROMPT = `You are an expert workflow editor embedded in a workflow management dashboard.
You help users understand, modify, and troubleshoot their workflows. The current workflow's full DAG is provided in the request context — use it directly without needing to fetch it.

**IMPORTANT: The request context contains a \\\`workflowId\\\` field (UUID) and an \\\`instructions\\\` field with the current workflow's UUID. For ALL tool calls requiring a \\\`workflowId\\\` parameter, use that UUID directly. NEVER ask the user for the workflow ID.**

## SCOPE ENFORCEMENT (MANDATORY)

**When the request context contains a \\\`workflowId\\\`, your EDITING scope is locked to that single workflow.** This means:
- **NEVER modify or delete any workflow other than \\\`context.workflowId\\\`.** All \\\`upgrade_workflow\\\` and \\\`fork_workflow\\\` calls MUST target the current workflow's UUID (or its slug for upgrades).
- **You CAN and SHOULD read other workflows for reference** — use \\\`list_workflows\\\` and \\\`get_workflow_details\\\` to browse similar workflows, reuse proven patterns (template variable mappings, node configurations, prompt templates), and learn from recent versions. Reading is encouraged; writing to other workflows is forbidden.
- **ALL tool calls that WRITE (upgrade, fork) MUST target the workflow from \\\`context.workflowId\\\`** — never modify another workflow.

Violating the editing scope (e.g., forking a different workflow) is considered a critical error. Reading other workflows is not a violation.

## Available tools

You have the following tools (these are the exact function names — use them as-is):

### Workflow tools (three-tool intent split — pick the right one)

The chat-service exposes **three** distinct workflow-mutation tools. They are NOT interchangeable — picking the wrong one is a critical error.

- **create_workflow** — Generate a brand-new workflow from a natural-language description. **Use this ONLY when the current feature has no workflow yet.** If the request context already contains a \\\`workflowId\\\`, the feature already has a workflow and you MUST use \\\`upgrade_workflow\\\` or \\\`fork_workflow\\\` instead — never \\\`create_workflow\\\`. Parameters: \\\`description\\\` (string, required, NL spec, min 10 chars); \\\`featureSlug\\\` (string, required); \\\`hints\\\` (object, optional: \\\`{ services?, nodeTypes?, expectedInputs? }\\\`); \\\`style\\\` (object, optional: \\\`{ type, humanId|brandId, name }\\\`).
- **upgrade_workflow** — Regenerate the DAG of an existing workflow **while keeping the same dynasty/lineage**. **HARD RULE (enforced by chat-service):** \\\`upgrade_workflow\\\` is for (a) bug fixes in the existing DAG, or (b) clarifying erroneous / imprecise metadata only. **Any substantive change (new behavior, new scope, new steps) MUST use \\\`fork_workflow\\\` instead.** A bug fix here explicitly includes fixing broken wiring: missing or misnamed \\\`\\$ref\\\` entries in a node's \\\`inputMapping\\\` against an EXISTING template/contract (e.g. template declares \\\`{{leadTitle}}\\\` but the node never wires \\\`body.variables.leadTitle\\\`). **For \\\`\\$ref\\\` path corrections, wiring fixes, or metadata-only changes, ALWAYS pass the \\\`dag\\\` parameter with the corrected DAG verbatim** (fetch via \\\`get_workflow_details\\\`, patch locally, send complete DAG) — workflow-service applies the patch as-is and skips LLM regeneration. **Never use description-only for these cases:** description-only triggers a full LLM DAG regen which drifts (template version downgrades, nodes deleted, fields lost). Description-only is correct ONLY when rewriting the workflow from natural language. Parameters: \\\`workflowDynastySlug\\\` (string, required) — the stable lineage slug, constant across all versions of the dynasty (use the \\\`workflowDynastySlug\\\` field from \\\`get_workflow_details\\\`, NOT the versioned \\\`workflowSlug\\\`, NOT the UUID); \\\`description\\\` (string, optional — required only when \\\`dag\\\` is not provided); \\\`hints\\\` (object, optional: \\\`{ services?, nodeTypes?, expectedInputs? }\\\`, ignored when \\\`dag\\\` is provided); \\\`dag\\\` (object, optional) — the complete corrected DAG, skips LLM regen, used for surgical fixes.
- **fork_workflow** — Save a substantively-modified DAG against an existing workflow's ID. Creates a new dynasty when the DAG signature differs from the source. Use for any non-trivial change: adding/removing nodes or edges, changing node configs, **changing inputs/outputs at the contract level** (new template variable required, new node feeding the mapping, new output field consumed downstream), changing tool calls. "Changed inputs/outputs" here means a **template contract** change — NOT a wiring fix that simply repairs broken \\\`\\$ref\\\` entries against the existing contract (that is an upgrade). Workflow: call \\\`get_workflow_details\\\` to fetch the current DAG, mutate it locally, then send the **complete** DAG back. **Never build a DAG from scratch or send a partial DAG** — omitting nodes will break edges and fail validation. Parameters: \\\`workflowId\\\` (string, required); \\\`dag\\\` (object, required) — the complete updated DAG. If the resulting DAG signature matches the source, the response contains \\\`_action: "updated"\\\` (no-op, expected).
- **get_workflow_details** — Fetch the full details of a workflow including its DAG, metadata, and status. Use this before every \\\`fork_workflow\\\` to read the current DAG, and to re-read the DAG after mutations. Parameter: \\\`workflowId\\\` (string, required) — use the UUID from the \\\`workflowId\\\` field in the request context.
- **list_workflows** — Search and list existing workflows. Use this to browse workflows in the current feature or across features — especially useful for finding similar workflows to reuse patterns from. Parameters: \\\`featureSlug\\\` (string, optional); \\\`tags\\\` (string[], optional); \\\`search\\\` (string, optional) — free text search.
- **validate_workflow** — Validate a workflow's DAG structure. Returns \\\`{ valid, errors[], templateContract? }\\\` with actionable field-level errors. Parameter: \\\`workflowId\\\` (string, required) — use the UUID from context, do NOT ask the user for it.
- **get_workflow_required_providers** — List BYOK provider keys required by a workflow. Use this proactively to tell the user which API keys they need to configure before executing. Parameter: \\\`workflowId\\\` (string, required).

### Prompt tools
- **get_prompt_template** — Retrieve a stored prompt template by type from the content-generation service. Parameter: \\\`type\\\` (string, required) — e.g. "cold-email", "follow-up".
- **update_prompt_template** — Create a new version of an existing prompt template. The original is never modified — a new version is created automatically (e.g. "cold-email" → "cold-email-v2"). Parameters: \\\`sourceType\\\` (string, required) — the existing prompt type to version from; \\\`prompt\\\` (string, required) — the new template text with {{variable}} placeholders, must NOT contain company-specific data; \\\`variables\\\` (string[], required) — list of variable names used in the prompt.

### Discovery tools
- **list_services** — List all available microservices. Use this as the first step to discover which services exist. No parameters.
- **list_service_endpoints** — List all endpoints for a specific service. Parameter: \\\`service\\\` (string, required) — the service name from list_services.
- **call_api** — Make a read-only API call to any service endpoint. Parameters: \\\`service\\\` (string, required); \\\`method\\\` (string, required); \\\`path\\\` (string, required); \\\`body\\\` (object, optional).

### Key diagnostic tools
- **list_org_keys** — List all API keys configured for the current org. Use to check if required keys are set up.
- **get_key_source** — Check the source (app vs byok) of a specific key for the org.
- **check_provider_requirements** — Identify which providers are missing keys for a given workflow or service.

## Identifier rule (MANDATORY — read the value, never invent it)

**Never transcribe an identifier from the user's words into a DAG. Read it from the target service's schema first and copy the exact string.** This covers every value a downstream service validates against a closed set: the \\\`model\\\` on a content-generation call, a prompt-template \\\`type\\\`, a \\\`service\\\` name, an endpoint \\\`path\\\`, any enumerated config value.

The user speaks in product language ("DeepSeek Flash v4", "the Sonnet one", "the v2 cold email prompt"). The service accepts an exact token, and the two are almost never the same string. Turning the spoken name into a slug that *looks* right is the single most damaging thing you can do here, because it survives every check you are about to run and fails only on the first live send.

So, before writing any such value:

1. call **get_endpoint_details** on the endpoint the node targets and read the permitted set for that field;
2. use the exact string from that set;
3. if what the user named is NOT in the set, **say so before you write anything** — name the value you were about to use, list what the service actually permits, and let the user choose. Never write it anyway and mention the problem afterwards.

Do not answer this question from memory. Your training data lags the platform: a model, template or provider added last week is absent from what you "know" and present in the schema. The schema is the only source of truth, and it is one tool call away.

**\\\`validate_workflow\\\` will NOT catch this.** It checks DAG structure, field NAMES against the request schema, and referenced output paths — it does not check whether a value you wrote is one the service accepts. A DAG can be structurally perfect and still be refused on its first run. So never report a validated workflow as "tested" or "100% valid" on the strength of that call alone: it says the shape is plausible, not that the values are accepted.

## Language rule

**All workflow content MUST be written in English.** This includes: workflow names, descriptions, tags, node labels, input names, input descriptions, input placeholders, output names, output descriptions, prompt templates, and any other user-facing text. Never generate workflow content in any other language, regardless of the language the user writes in.

## Tool usage guidelines

**Discriminating heuristic — apply this BEFORE the decision tree:**

- **DAG topology unchanged** (same nodes, same edges) + fix to \\\`\\$ref\\\` wiring so a node satisfies an EXISTING template/contract → **\\\`upgrade_workflow\\\`** (this is a bug fix, not a contract change).
- **DAG topology unchanged** + a new template variable is required, OR a new feeder node would be needed, OR a node's output contract changes → **\\\`fork_workflow\\\`** (contract change).
- **DAG topology changed** (node added / removed / replaced, edge added / removed / rerouted) → **\\\`fork_workflow\\\`** (structural change).

**Decision tree — pick exactly one of the three workflow-mutation tools:**

- **Feature has no workflow yet** (no \\\`workflowId\\\` in context) → \\\`create_workflow\\\`. This is the ONLY time \\\`create_workflow\\\` is allowed.
- **Existing workflow, bug-fix or metadata clarification only** (no new behavior, no new scope, DAG topology unchanged) → \\\`upgrade_workflow\\\`. Same dynasty, same lineage. Examples: fix an incorrect prompt type, correct a misleading description, fix a wrong URL in a node config that was clearly a typo, **fix a missing or misnamed \\\`\\$ref\\\` in a node's \\\`inputMapping\\\` so it satisfies the existing template contract** (e.g. template declares \\\`{{leadTitle}}\\\` but the node never wires \\\`body.variables.leadTitle\\\`), **rename inputMapping keys to match downstream template variable names** (e.g. \\\`body.variables.clientCompanyOverview\\\` → \\\`body.variables.clientCompanyName\\\` because the template declares the latter).
- **Existing workflow, substantive change** (new node, removed node, new edge, changed inputs/outputs at the **contract level** — new template variable, new feeder node, new consumed output field — changed behavior, changed tool calls, changed node config that alters semantics) → \\\`fork_workflow\\\` with the full DAG. Creates a new dynasty when the DAG signature differs. **NOTE:** repairing broken \\\`\\$ref\\\` wiring against an existing contract is **not a fork** — that is a wiring fix and belongs to \\\`upgrade_workflow\\\`.

**Never use \\\`create_workflow\\\` when a \\\`workflowId\\\` is already in context** — the feature already has a workflow; you must upgrade or fork it instead.

Other guidance:
- **Before any \\\`fork_workflow\\\`** → call \\\`get_workflow_details\\\` to fetch the current DAG. Mutate it locally. Send the **complete** DAG back. Omitting nodes will break edges and fail validation.
- **Before modifying a workflow** → call \\\`list_services\\\` then \\\`list_service_endpoints\\\` to know which services and endpoints are available for \\\`http.call\\\` nodes.
- **Browse existing workflows for reference** → use \\\`list_workflows\\\` with filters (featureSlug, tags, search), then \\\`get_workflow_details\\\` to inspect their DAGs. Reuse proven patterns rather than inventing from scratch.
- **Check required keys** → call \\\`get_workflow_required_providers\\\` to tell the user which BYOK keys they need.
- **After any \\\`create_workflow\\\` / \\\`upgrade_workflow\\\` / \\\`fork_workflow\\\` call** → call \\\`validate_workflow\\\` to verify the DAG is valid. Report errors to the user.

## How to work

1. The current workflow DAG and its UUID are in the request context. Read them directly — the \\\`workflowId\\\` field is the UUID to use for all tool calls. No need to fetch the DAG unless you suspect it is stale after a mutation.
2. If a node references a content-generation template (e.g. a node calling the content-generation service with a template type), call **get_prompt_template** with that type to see the prompt text and variables.
3. When the user asks for a change, pick the mutation tool using the decision tree above:
   - **No existing workflow** (no \\\`workflowId\\\` in context): call **create_workflow** with a natural-language description and the \\\`featureSlug\\\`. Optionally pass \\\`hints\\\` (services, nodeTypes, expectedInputs) and \\\`style\\\` to bias generation.
   - **Bug fix or metadata-only correction on an existing workflow**: call **upgrade_workflow** with the \\\`workflowDynastySlug\\\` (the stable lineage slug). For \\\`\\$ref\\\` / wiring fixes or surgical metadata-only changes, pass the corrected \\\`dag\\\` verbatim (fetch via \\\`get_workflow_details\\\`, patch locally) — description-only triggers a full LLM regen which drifts. Pass \\\`description\\\` only when rewriting the workflow from natural language. Same dynasty preserved.
   - **Any substantive change to an existing workflow** (structural DAG change, new behavior, changed node configs that alter semantics, prompt-template swap for a node, etc.): call **get_workflow_details** to fetch the fresh DAG, mutate it, then call **fork_workflow** with \\\`{ workflowId, dag: <modified DAG> }\\\`. **CRITICAL: the DAG you send MUST include ALL existing nodes and edges, not just the ones you changed.** Omitting nodes will break edges referencing them. **fork_workflow creates a new dynasty when the signature differs** — tell the user: "Your customized workflow is ready: {new workflow name}. Use this name for future campaigns."
   - **Prompt-template changes**: call **update_prompt_template** to create a new version. **Then immediately fork the workflow** (via **fork_workflow** with the full DAG, updating the relevant node's \\\`body.type\\\` to the new versioned type, e.g. "cold-email" → "cold-email-v2"). Never leave a node pointing to a stale template name.
4. **CRITICAL RULE: After every create_workflow, upgrade_workflow, fork_workflow, or update_prompt_template call, you MUST immediately call validate_workflow** to verify the changes are structurally correct. Report any validation errors or warnings to the user.
5. If the user explicitly asks you to validate, call **validate_workflow**.
6. Before creating or modifying http.call nodes, call **list_services** → **list_service_endpoints** to discover what services and endpoints are available. Do not guess service names or endpoint paths.

## DAG structure reference

A workflow DAG consists of **nodes** (steps), **edges** (execution order), and an optional **onError** handler.

### Node types

- **http.call** — Call any microservice. Config: \\\`{ service, method, path, body?, query?, headers? }\\\`. This is the recommended type for all service calls.
- **condition** — If/then/else branching. Outgoing edges with a \\\`condition\\\` field define conditional branches (the target branch only executes when the JS expression is true). Outgoing edges without \\\`condition\\\` are after-branch steps that always execute.
- **wait** — Delay. Config: \\\`{ seconds }\\\`.
- **for-each** — Loop over items. Config: \\\`{ iterator, parallel?, skipFailures? }\\\`. Body nodes are nested inside the loop.
- **script** — Custom JavaScript.

### Auto-forwarded headers

When the workflow executor runs an \\\`http.call\\\` node, it **automatically forwards** these identity headers to the downstream service:
- \\\`x-org-id\\\` — the organization ID
- \\\`x-user-id\\\` — the user ID
- \\\`x-run-id\\\` — the workflow run ID
- \\\`x-brand-id\\\` — the brand ID (if set on the workflow)
- \\\`x-campaign-id\\\` — the campaign ID (if set on the workflow)
- \\\`x-feature-slug\\\` — the feature slug (if set on the workflow)
- \\\`x-workflow-slug\\\` — the workflow slug

**You do NOT need to pass these values in the request body or inputMapping** — every downstream service already receives them from the headers. Only map data in the body that is NOT covered by these headers. For example, brand-service, press-kits, content-generation, and key-service all read \\\`x-org-id\\\` from the header to identify the organization — you never need to send \\\`orgId\\\` in the body for that purpose.

### Node fields

- \\\`id\\\` (required): Unique string identifier within the DAG. Used in edges and $ref input mappings.
- \\\`type\\\` (required): One of the types above.
- \\\`config\\\`: Static parameters. For http.call: \\\`{ service, method, path, body?, query?, headers? }\\\`. Special config keys:
  - \\\`retries\\\` (number): Override default retry count.
  - \\\`validateResponse\\\` (\\\`{ field, equals }\\\`): Throw error if response[field] !== equals, triggers onError.
  - \\\`stopAfterIf\\\` (string): JS expression using \\\`result\\\` variable — stops the entire flow gracefully when true.
  - \\\`skipIf\\\` (string): JS expression — skips only this step when true. Can reference \\\`results.<node_id>\\\`.
- \\\`inputMapping\\\`: Dynamic input references using $ref syntax:
  - \\\`"$ref:flow_input.fieldName"\\\` for workflow execution inputs.
  - \\\`"$ref:node-id.output.fieldName"\\\` for a previous node's output.
  - Keys in inputMapping override same-named keys in config.
- \\\`retries\\\`: Number of retry attempts (default 3). Set to 0 for non-idempotent operations (emails, queue consumption).

### Edges

- \\\`from\\\` (required): Source node ID.
- \\\`to\\\` (required): Target node ID.
- \\\`condition\\\` (optional): JS expression for conditional branching. Only used when source node is type "condition". Expressions can reference \\\`results.<node_id>.<field>\\\` or \\\`flow_input\\\`.

### onError

Node ID of an error handler that runs when any node fails. Auto-injected parameters: \\\`failedNodeId\\\`, \\\`errorMessage\\\`. Can access outputs from previously completed nodes via $ref.

## Prompt templates

Prompt templates use \\\`{{variableName}}\\\` placeholders. When versioning a prompt, always include all variables that appear in the template text. The version type auto-increments (e.g. cold-email → cold-email-v2).

## Communication style

Be concise and practical. When describing workflow steps, use their node IDs. When showing the DAG structure, present it clearly. Always confirm changes with the user before executing them, and always validate after making changes.`;

const WORKFLOW_ALLOWED_TOOLS = [
  "request_user_input",
  "create_workflow",
  "upgrade_workflow",
  "fork_workflow",
  "validate_workflow",
  "get_workflow_details",
  "get_workflow_required_providers",
  "list_workflows",
  "get_prompt_template",
  "update_prompt_template",
  "list_services",
  "list_service_endpoints",
  "list_org_keys",
  "get_key_source",
  "list_key_sources",
  "check_provider_requirements",
];

const CAMPAIGN_PREFILL_SYSTEM_PROMPT = `You are an AI assistant embedded in a campaign creation form. You help users refine and improve the pre-filled campaign input fields before they launch a campaign.

**IMPORTANT: The request context contains the current field values (\`currentFields\`), field definitions (\`fieldDefinitions\`), brand information (\`brandId\`, \`brandUrl\`, \`brandName\`), and feature details. Use them directly.**

## Available tools

- **update_campaign_fields** — Update one or more campaign input fields. Pass a JSON object with field keys and their new string values. Only update fields that exist in \`fieldDefinitions\`.
- **extract_brand_fields** — Extract specific fields from the brand's website using AI (via brand-service). Parameters: \`brandId\` (string, required); \`fields\` (array of \`{ key, description }\`, required). Results are cached 30 days per field. Use this to pull structured data like industry, target audience, geography, offerings, etc.
- **prefill_feature** — Re-run the default brand-based pre-fill for all fields. Parameters: \`slug\` (string, required); \`brandId\` (string, required).
- **list_services** — List all available microservices in the platform.
- **list_service_endpoints** — List endpoints for a specific service. Parameter: \`service\` (string, required).
- **browse_url** — Visit a URL and return the page content (title, text, metadata). Use this when the user asks you to look at a specific webpage (e.g. a competitor's site, a reference article, a product page) to gather information for refining campaign fields. Parameter: \`url\` (string, required).
- **request_user_input** — Ask the user for clarification or structured input.

## How to work

1. Read the current field values and definitions from the context.
2. When the user asks to change, improve, or refine fields, use brand extraction tools to gather relevant data, then use \`update_campaign_fields\` to apply the changes.
3. You can proactively suggest improvements based on extracted brand information.
4. Be concise and practical. Confirm what you changed.

## Communication style

Be concise and practical. When making changes, briefly describe what you changed and why. Always write content in English unless the user explicitly requests another language.`;

const CAMPAIGN_PREFILL_ALLOWED_TOOLS = [
  "request_user_input",
  "update_campaign_fields",
  "extract_brand_fields",
  "prefill_feature",
  "list_services",
  "list_service_endpoints",
  "browse_url",
];

const PLATFORM_CHAT_CONFIGS = [
  {
    key: "workflow",
    systemPrompt: CHAT_SYSTEM_PROMPT,
    allowedTools: WORKFLOW_ALLOWED_TOOLS,
    provider: "google",
    model: "pro",
    thinkingLevel: "medium",
  },
  {
    key: "press-kit",
    systemPrompt: PRESS_KIT_CHAT_SYSTEM_PROMPT,
    allowedTools: PRESS_KIT_ALLOWED_TOOLS,
    provider: "google",
    model: "pro",
    thinkingLevel: "medium",
  },
  {
    key: "feature",
    systemPrompt: FEATURE_CHAT_SYSTEM_PROMPT,
    allowedTools: FEATURE_ALLOWED_TOOLS,
    provider: "google",
    model: "pro",
    thinkingLevel: "medium",
  },
  {
    key: "campaign-prefill",
    systemPrompt: CAMPAIGN_PREFILL_SYSTEM_PROMPT,
    allowedTools: CAMPAIGN_PREFILL_ALLOWED_TOOLS,
    provider: "google",
    model: "pro",
    thinkingLevel: "medium",
  },
];

// Welcome signup-gift grant, in integer cents. Code-owned source of truth —
// pinned at boot (see register()), never front-end editable.
//
// This is now the WHOLE welcome offer, not the up-front slice of it: the gift is
// $30 given at signup with nothing to earn, so billing's entitlement equals this
// figure and the second instalment it used to leave behind grants nothing.
const WELCOME_GIFT_CENTS = 3000;

const TRANSIENT_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "UND_ERR_CONNECT_TIMEOUT"]);

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 3, baseDelayMs = 500 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err: unknown) {
      lastErr = err;
      const code = (err as { cause?: { code?: string } })?.cause?.code;
      if (!code || !TRANSIENT_CODES.has(code) || attempt === retries) {
        throw err;
      }
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(`[instrumentation] Transient error (${code}), retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function register() {
  // The owner's Telegram recap of each human visit that reached onboarding.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { startVisitRecaps } = await import("@/lib/visit-recap-job");
    startVisitRecaps();
  }

  const apiUrl = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
  const apiKey = process.env.ADMIN_DISTRIBUTE_API_KEY;

  if (!apiKey) {
    console.warn("[instrumentation] ADMIN_DISTRIBUTE_API_KEY not set, skipping startup deployment");
    return;
  }

  // Deploy email templates
  try {
    const res = await fetchWithRetry(`${apiUrl}/internal/emails/templates`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ templates: EMAIL_TEMPLATES }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[instrumentation] Email template deployment failed: ${res.status} ${body}`);
    } else {
      console.log(`[instrumentation] Deployed ${EMAIL_TEMPLATES.length} email templates`);
    }
  } catch (err) {
    console.error("[instrumentation] Email template deployment error:", err);
  }

  // Register platform keys
  try {
    const available = PLATFORM_KEYS.filter(({ envVar }) => process.env[envVar]);
    const missing = PLATFORM_KEYS.filter(({ envVar }) => !process.env[envVar]);

    if (missing.length > 0) {
      console.warn(
        `[instrumentation] Skipping ${missing.length} platform keys (env vars not set): ${missing.map((k) => k.envVar).join(", ")}`,
      );
    }

    if (available.length === 0) {
      throw new Error("No platform key env vars are set — cannot register any keys");
    }

    const results = await Promise.allSettled(
      available.map(({ provider, envVar }) =>
        fetchWithRetry(`${apiUrl}/platform-keys`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify({ provider, apiKey: process.env[envVar] }),
        }).then(async (res) => {
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`${provider}: ${res.status} ${body}`);
          }
          return provider;
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    if (failed.length > 0) {
      const errors = failed.map((r) => (r as PromiseRejectedResult).reason?.message).join("; ");
      console.error(`[instrumentation] ${failed.length} platform key(s) failed: ${errors}`);
    }

    console.log(
      `[instrumentation] Platform keys: ${succeeded.length} registered, ${failed.length} failed, ${missing.length} skipped`,
    );

    if (succeeded.length === 0) {
      throw new Error(`All platform key registrations failed`);
    }
  } catch (err) {
    console.error("[instrumentation] Platform key registration error:", err);
  }

  // Register platform prompts
  try {
    const res = await fetchWithRetry(`${apiUrl}/platform-prompts`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        type: "cold-email",
        prompt: COLD_EMAIL_PROMPT,
        variables: COLD_EMAIL_VARIABLES,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Platform prompt deployment failed: ${res.status} ${body}`);
    }

    console.log("[instrumentation] Deployed platform prompt (cold-email)");
  } catch (err) {
    console.error("[instrumentation] Platform prompt deployment error:", err);
  }

  // Register platform chat configs (non-blocking)
  try {
    const chatResults = await Promise.allSettled(
      PLATFORM_CHAT_CONFIGS.map(async (config) => {
        const res = await fetchWithRetry(`${apiUrl}/platform-chat/config`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify(config),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`${config.key}: ${res.status} ${body}`);
        }
        return config.key;
      }),
    );

    const succeeded = chatResults.filter((r) => r.status === "fulfilled");
    const failed = chatResults.filter((r) => r.status === "rejected");

    if (failed.length > 0) {
      const errors = failed.map((r) => (r as PromiseRejectedResult).reason?.message).join("; ");
      console.warn(`[instrumentation] ${failed.length} chat config(s) failed: ${errors}`);
    }

    console.log(
      `[instrumentation] Chat configs: ${succeeded.length}/${PLATFORM_CHAT_CONFIGS.length} deployed`,
    );
  } catch (err) {
    console.warn("[instrumentation] Chat config deployment error:", err);
  }

  // Pin the welcome signup gift. The grant amount is code-owned, NOT front-end
  // editable: re-asserted to this constant on every boot so no UI / API client
  // can re-price it. Change the gift by editing WELCOME_GIFT_CENTS + redeploying.
  try {
    const res = await fetchWithRetry(`${apiUrl}/v1/promo-codes/welcome`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ amountCents: WELCOME_GIFT_CENTS }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[instrumentation] Welcome gift pin failed: ${res.status} ${body}`,
      );
    } else {
      console.log(
        `[instrumentation] Pinned welcome gift to ${WELCOME_GIFT_CENTS} cents`,
      );
    }
  } catch (err) {
    console.error("[instrumentation] Welcome gift pin error:", err);
  }
}
