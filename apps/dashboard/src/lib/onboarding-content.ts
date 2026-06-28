// First-visit onboarding copy + reminder copy. Kept in a pure module so the
// strings are unit-testable (presence + no em-dash) and reusable by both the
// welcome carousel and the reminder modals. User-facing copy: humanized,
// no em-dash (per project copy discipline). Rich blocks (example email,
// timeline) are styled with the landing design tokens (brand accent, mono).

export interface WelcomeStep {
  /** Centered modal title. */
  title: string;
  /** HTML description rendered inside the welcome carousel card. */
  description: string;
}

// The example outreach email shown in the "we email on your behalf" step. The
// caption makes clear the real emails differ; the point is to convey the
// spirit, not a literal template.
const EXAMPLE_EMAIL_HTML = `
<div style="margin:14px 0 6px;border:1px solid var(--color-brand-200,#c7d2fe);border-radius:12px;overflow:hidden;background:#fff;">
  <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--color-brand-50,#eef2ff);border-bottom:1px solid var(--color-brand-100,#e0e7ff);font-family:var(--font-mono);font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-brand-700,#4338ca);">
    <span style="width:6px;height:6px;border-radius:999px;background:var(--color-brand-500,#6366f1);flex:none;"></span>From: distribute.you
  </div>
  <pre style="white-space:pre-wrap;font-family:var(--font-mono);font-size:12px;line-height:1.6;padding:12px 14px;margin:0;color:#334155;">Hey Sophie,

I reached out on behalf of your brand because what they offer lines up with what you do at your company.

Their site: your-url.com

Best,
Kevin
Founder, distribute.you</pre>
</div>
<span style="display:block;margin-top:6px;font-size:11px;color:#94a3b8;">Your emails will not read exactly like this. It is just the idea.</span>`;

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
      "<ul style='margin:10px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px;'>" +
      "<li style='display:flex;gap:10px;align-items:flex-start;'><span style='flex:none;margin-top:1px;width:18px;height:18px;border-radius:999px;background:var(--color-brand-50,#eef2ff);color:var(--color-brand-700,#4338ca);font-family:var(--font-mono);font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;'>1h</span><span>Within 1 hour, your first emails start going out.</span></li>" +
      "<li style='display:flex;gap:10px;align-items:flex-start;'><span style='flex:none;margin-top:1px;width:18px;height:18px;border-radius:999px;background:var(--color-brand-50,#eef2ff);color:var(--color-brand-700,#4338ca);font-family:var(--font-mono);font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;'>2d</span><span>Within 2 to 3 days, your first website clicks arrive.</span></li>" +
      "<li style='display:flex;gap:10px;align-items:flex-start;'><span style='flex:none;margin-top:1px;width:18px;height:18px;border-radius:999px;background:var(--color-brand-50,#eef2ff);color:var(--color-brand-700,#4338ca);font-family:var(--font-mono);font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;'>∞</span><span>Every day, you get a recap email with the clicks you got that day.</span></li>" +
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
  topupRecharge: {
    title: "Add credits to keep going",
    body: "Your credits ran out, so outreach has paused. Auto top-up isn't available for your card's country, so add credits to start it again.",
    cta: "Add credits",
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
