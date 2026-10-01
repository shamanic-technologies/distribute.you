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

const SWAPS: ReadonlyArray<readonly [string, string, number?]> = [
  ['Get revenue in 24h, from $1/day">', 'Get revenue in 24h, $99/month">', 2],
  ['First $30 free, no commitment.">', '3-day free trial, then $99 a month. Cancel anytime.">', 2],
  [
    "<title>distribute.you. Get revenue in 24h, from $1/day</title>",
    "<title>distribute.you. Get revenue in 24h, $99/month</title>",
  ],
  [
    '<span class="accent">revenue in 24h</span><br>From $1/day',
    '<span class="accent">revenue in 24h</span><br>$99/month',
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
  ["Set a daily budget, stop it whenever you want.", "3 days free, then $99 a month. Cancel anytime."],
  ['<span class="plan-tag"><i></i>Pay as you go</span>', '<span class="plan-tag"><i></i>Pro</span>'],
  ['<div class="plan-price">From $1<small>/day</small></div>', '<div class="plan-price">$99<small>/month</small></div>'],
  ['<p class="plan-desc">Self-serve, no commitment</p>', '<p class="plan-desc">3-day free trial, then $99 a month</p>'],
  ["Start free with $30 credits</a>", "Start my free trial</a>"],
  [
    "<li><i></i>First $30 free, no card needed to look around</li>",
    "<li><i></i>3 days free, your campaign starts sending on day one</li>",
  ],
  [
    "<li><i></i>No commitment, no seat, no retainer</li>",
    "<li><i></i>Your $99 becomes campaign credit, spent on your outreach</li>\n          <li><i></i>Add $100 a month any time to reach more leads</li>\n          <li><i></i>Cancel anytime</li>",
  ],
  ["Everything in Pay as you go", "Everything in Pro"],
  [
    "Your first $30 of budget is free, so the first sends cost you nothing.",
    "The first 3 days are free: we take a card, your campaign starts right away, and nothing is charged before day 3.",
  ],
  [
    "<p>You set a daily budget, from $1. We spend it on your campaign and charge you what the campaign spent, nothing else. No subscription, no seat, no retainer. Our margin sits inside the budget. What a meeting or a signup costs you is measured on your account and shown on your dashboard.</p>",
    "<p>$99 a month, after a 3-day free trial. Your $99 becomes campaign credit: we spend it on your outreach and show what each reply and meeting cost you on your dashboard. Add $100 a month any time to reach more leads. No seat, no setup fee, cancel anytime.</p>",
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
  return html;
}
