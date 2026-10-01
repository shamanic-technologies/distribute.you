/**
 * The homepage's `subscription` arm: the same page as control, sold as a $99/month plan
 * with a 3-day free trial (Gojiberry's "$99/month, try it for free"), owner-decided
 * 2026-10-01. The signup it leads to is a card-required trial; the dashboard reads the
 * same `lp_variant` cookie and runs the subscription onboarding for this arm.
 *
 * Built by swapping the price copy out of `index-v2.html` rather than forking the file,
 * so every other change to the homepage reaches both arms and the test compares price
 * only. Each swap must match exactly the number of times it names (once by default,
 * the head's meta tags repeat): an anchor that drifted throws instead of serving a page
 * that still says "$30 free" next to "$99/month".
 */

/**
 * The monthly amounts the plan offers (owner 2026-10-01: the visitor picks what they
 * want from a dropdown, never a bare "+$100"). Byte-equal with the dashboard's
 * `SUBSCRIPTION_AMOUNT_OPTIONS_CENTS`; every value sits on billing's ladder.
 */
export const PLAN_AMOUNTS_USD = [99, 199, 299, 499, 999, 1999] as const;

/** The cookie carrying the pick to the dashboard's checkout (cents). */
export const PLAN_COOKIE = "lp_plan";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/**
 * The amount picker in the Pro card: the homepage's own field recipe (`.fake-field`:
 * 44px, 10px radius, hairline border), a native select over it so it opens the
 * platform's menu, and a script that moves the figures and remembers the pick.
 */
const AMOUNT_PICKER = `<label class="plan-amount">
          <span class="plan-amount-k">Monthly amount</span>
          <span class="plan-amount-v"><span data-plan-label>${usd(99)} / month</span><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <select data-plan-amount aria-label="Monthly amount">${PLAN_AMOUNTS_USD.map((n) => `<option value="${n * 100}">${usd(n)} / month</option>`).join("")}</select>
        </label>`;

const AMOUNT_STYLE = `<style>
.plan-amount { position: relative; display: flex; align-items: center; gap: 10px; height: 44px; margin: 14px 0 4px; padding: 0 14px; border-radius: 10px; background: #fff; border: 1px solid var(--hair-2); font-size: 15px; cursor: pointer; }
.plan-amount:hover { border-color: #bbb; }
.plan-amount:focus-within { border-color: var(--accent, #2563eb); }
.plan-amount-k { color: var(--muted); }
.plan-amount-v { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; color: var(--text); font-variant-numeric: tabular-nums; }
.plan-amount select { position: absolute; inset: 0; width: 100%; opacity: 0; cursor: pointer; font-size: 16px; }
</style>`;

const AMOUNT_SCRIPT = `<script>(function(){var s=document.querySelector("[data-plan-amount]");if(!s)return;
var f=function(c){return "$"+(c/100).toLocaleString("en-US")};
var m=document.cookie.match(/(?:^|; )${PLAN_COOKIE}=(\d+)/);if(m&&s.querySelector('option[value="'+m[1]+'"]'))s.value=m[1];
var paint=function(){var c=Number(s.value);document.querySelectorAll("[data-plan-price]").forEach(function(e){e.textContent=f(c)});
document.querySelectorAll("[data-plan-label]").forEach(function(e){e.textContent=f(c)+" / month"});
document.cookie="${PLAN_COOKIE}="+c+"; Path=/; Max-Age=7776000; Domain=.distribute.you; SameSite=Lax; Secure";};
s.addEventListener("change",function(){paint();if(window.posthog)posthog.capture("plan_amount_picked",{amount_cents:Number(s.value)})});paint();})();</script>`;

const SWAPS: ReadonlyArray<readonly [string, string, number?]> = [
  ['Get revenue in 24h, from $1/day">', 'Get revenue in 24h, from $99/month">', 2],
  ['First $30 free, no commitment.">', '3-day free trial, then from $99 a month. Cancel anytime.">', 2],
  [
    "<title>distribute.you. Get revenue in 24h, from $1/day</title>",
    "<title>distribute.you. Get revenue in 24h, from $99/month</title>",
  ],
  [
    '<span class="accent">revenue in 24h</span><br>From $1/day',
    '<span class="accent">revenue in 24h</span><br>From $99/month',
  ],
  ["First $30 free, no commitment</div>", "3-day free trial, cancel anytime</div>"],
  [
    '<span class="sf"><b>$30</b><small>Free to start</small></span>',
    '<span class="sf"><b>3 days</b><small>Free trial</small></span>',
  ],
  [
    '<h2 style="margin-top:16px">Pay as you go. Or let us run it end to end.</h2>',
    '<h2 style="margin-top:16px">One plan. Start free.</h2>',
  ],
  ["Set a daily budget, stop it whenever you want.", "3 days free. Then pick your monthly amount, from $99. Cancel anytime."],
  ['<span class="plan-tag"><i></i>Pay as you go</span>', '<span class="plan-tag"><i></i>Pro</span>'],
  [
    '<div class="plan-price">From $1<small>/day</small></div>',
    `<div class="plan-price"><span data-plan-price>${usd(99)}</span><small>/month</small></div>`,
  ],
  ['<p class="plan-desc">Self-serve, no commitment</p>', `<p class="plan-desc">3-day free trial, then this each month</p>\n        ${AMOUNT_PICKER}`],
  ["Start free with $30 credits</a>", "Start my free trial</a>"],
  [
    "<li><i></i>First $30 free, no card needed to look around</li>",
    "<li><i></i>3 days free, your campaign starts sending on day one</li>",
  ],
  [
    "<li><i></i>No commitment, no seat, no retainer</li>",
    "<li><i></i>Every dollar becomes campaign credit, spent on your outreach</li>\n          <li><i></i>A bigger amount reaches more leads. Change it any time</li>\n          <li><i></i>Cancel anytime</li>",
  ],
  ["Everything in Pay as you go", "Everything in Pro"],
  [
    "Your first $30 of budget is free, so the first sends cost you nothing.",
    "The first 3 days are free: we take a card, your campaign starts right away, and nothing is charged before day 3.",
  ],
  [
    "<p>You set a daily budget, from $1. We spend it on your campaign and charge you what the campaign spent, nothing else. No subscription, no seat, no retainer. Our margin sits inside the budget. What a meeting or a signup costs you is measured on your account and shown on your dashboard.</p>",
    "<p>You pick a monthly amount, from $99, after a 3-day free trial. Every dollar becomes campaign credit: we spend it on your outreach and show what each reply and meeting cost you on your dashboard. A bigger amount reaches more leads, and you can change it any time. No seat, no setup fee, cancel anytime.</p>",
  ],
  [
    '<div class="fine">First $30 free · Live in 2 minutes · Stop any time</div>',
    '<div class="fine">3-day free trial · Live in 2 minutes · Cancel anytime</div>',
  ],
];

export function renderSubscriptionPage(controlHtml: string): string {
  let html = controlHtml;
  for (const [from, to, expected = 1] of SWAPS) {
    const parts = html.split(from);
    if (parts.length - 1 !== expected) {
      throw new Error(
        `[landing] subscription arm: expected ${expected} match(es), found ${parts.length - 1}, for ${JSON.stringify(from)}`,
      );
    }
    html = parts.join(to);
  }
  return withAmountPicker(html);
}

/** The picker's style in the head and its script before the body ends. */
function withAmountPicker(html: string): string {
  const head = html.indexOf("</head>");
  const body = html.lastIndexOf("</body>");
  if (head < 0 || body < 0) throw new Error("[landing] subscription arm: no </head> or </body> for the amount picker");
  return html.slice(0, head) + AMOUNT_STYLE + html.slice(head, body) + AMOUNT_SCRIPT + html.slice(body);
}
