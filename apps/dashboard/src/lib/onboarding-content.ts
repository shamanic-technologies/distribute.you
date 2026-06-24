// First-visit onboarding copy + reminder copy. Kept in a pure module so the
// strings are unit-testable (presence + no em-dash) and reusable by both the
// driver.js welcome tour and the reminder modals. User-facing copy: humanized,
// no em-dash (per project copy discipline).

export interface WelcomeStep {
  /** Centered modal title. */
  title: string;
  /** HTML description rendered inside the driver.js popover. */
  description: string;
}

// The example outreach email shown in the "we email on your behalf" step. The
// caption makes clear the real emails differ; the point is to convey the
// spirit, not a literal template.
const EXAMPLE_EMAIL_HTML = `
<pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin:8px 0 4px;color:#334155;">Hey Sophie,

I reached out on behalf of your brand because what they offer lines up with what you do at your company.

Their site: your-url.com

Best,
Kevin
Founder, distribute.you</pre>
<span style="font-size:11px;color:#94a3b8;">Your emails will not read exactly like this. It is just the idea.</span>`;

export const WELCOME_STEPS: WelcomeStep[] = [
  {
    title: "Welcome to distribute",
    description:
      "We run your cold email outreach end to end. You give us a URL and a budget. We find the right people, write every email, send it from our own inboxes, and report back. Nothing for you to set up.",
  },
  {
    title: "Your $25 in free credits",
    description:
      "We match your first $25 of spend, dollar for dollar. Add $25 and you get $50 to work with, so your first results cost you half. The match applies on its own as your outreach runs.",
  },
  {
    title: "We email on your behalf",
    description:
      "Every email goes out from our own warmed inboxes, on your behalf. Your domain never touches cold outreach, so your reputation stays clean. Replies come to us first, we screen them, and we forward the good ones to you." +
      EXAMPLE_EMAIL_HTML,
  },
  {
    title: "What happens next",
    description:
      "<ul style='margin:0;padding-left:18px;line-height:1.7;'>" +
      "<li>Within 1 hour, your first emails start going out.</li>" +
      "<li>Within 2 to 3 days, your first website clicks arrive.</li>" +
      "<li>Every day, you get a recap email with the clicks you got that day.</li>" +
      "</ul>",
  },
  {
    title: "Find your best audience",
    description:
      "Build a few audiences and we test all of them at once. Watch which one gets the lowest cost per click, scale that one, and archive the rest. That is how you find the customers worth reaching.",
  },
];

export const REMINDER_COPY = {
  topup: {
    title: "Turn on auto top-up",
    body: "Outreach pauses the moment your credits run out. Turn on auto top-up so it keeps sending and you never have to watch the balance.",
    cta: "Turn on auto top-up",
  },
  audience: {
    title: "Add an audience to start",
    body: "We need at least one active audience to know who to contact. Add one and we start finding leads for you right away.",
    cta: "Add an audience",
  },
} as const;

export const NO_AUDIENCE_BANNER_COPY = {
  message: "No active audience yet. Outreach cannot run until you add one.",
  cta: "Add an audience",
} as const;
