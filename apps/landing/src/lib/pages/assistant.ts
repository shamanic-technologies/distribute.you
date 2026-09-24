import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SIGN_UP, shell } from "../v2-shell";

/**
 * `/lp/assistant`: a second homepage that tests a different VALUE PROPOSITION, not a
 * different design. Same charter, same nav, same footer, same conversion target as `/`
 * (the website field posting `url` to the picker), so a later A/B test between the two
 * measures the pitch and nothing else.
 *
 * Shape lifted from Cody Schneider's "AI assistant for people who [do the thing]"
 * wireframe: one field, one button in the hero, then a section saying the product lives
 * in channels the buyer already uses rather than in an app to learn. Every channel named
 * is a real capability: interested replies are forwarded to the brand's inbox, the sales
 * rep's phone rings within the minute (twilio-service, the brand-level sales rep), and
 * meetings land through the brand's own booking link.
 *
 * Not indexed, not in the sitemap, linked from nowhere: it is a candidate for review
 * until it is put into an A/B test. The styles it adds are page-scoped (`asst-*`) and
 * inline, so the shared stylesheet and its cache-busting version stay untouched.
 */

export const ASSISTANT_PATH = "/lp/assistant";

/**
 * Everything below the pitch is BORROWED from the homepage at render time, never
 * copied: the live client cards, proof, quotes, pipeline, features, stats band, fit,
 * pricing and FAQ are sliced out of `index-v2.html` by their own section markers, so an
 * edit to the homepage reaches this page too and the two cannot state different
 * figures. The live reseeds (showcase funnels, proof cards, founder count) key on data
 * attributes, so they resolve here exactly as on `/`.
 *
 * Only the homepage's "How it works" is left out: this page says it in its own three
 * steps. A marker the homepage no longer carries THROWS rather than rendering a page
 * with a section silently missing.
 */
export type HomepageBlocks = { showcase: string; proofAndQuotes: string; rest: string };

function between(html: string, start: string, end: string): string {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || html.split(start).length !== 2) {
    throw new Error(`[landing] homepage marker missing or ambiguous: ${start} .. ${end}`);
  }
  return html.slice(a, b);
}

export function homepageBlocks(home: string): HomepageBlocks {
  return {
    showcase: between(home, '<div class="showcase">', "\n  </div>\n</section>"),
    proofAndQuotes: between(home, "<!-- Proof -->", "<!-- How it works"),
    rest: between(home, "<!-- Pipeline", "<!-- CTA"),
  };
}

function readHomepage(): string {
  return readFileSync(join(process.cwd(), "public/landing", "index-v2.html"), "utf8");
}

const TITLE = "distribute.you: the AI sales assistant for founders";
const DESCRIPTION =
  "An AI sales assistant that finds the people who buy what you sell, writes to them, and hands you only the ones who want to talk. From $1/day, first $30 free.";

const ICON_MAIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`;
const ICON_PHONE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/></svg>`;
const ICON_CAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 15 2 2 4-4"/></svg>`;
const ARROW = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

const STYLE = `<style>
.asst-hero { min-height: 0; padding: 150px 0 48px; }
.asst-eyebrow { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 22px; padding: 5px 14px; border-radius: 100px; border: 1px solid var(--hair-2); background: #fff; font-size: 13px; color: var(--muted); }
.asst-eyebrow i { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--accent-100); }
.asst-hero h1 { max-width: 820px; }
.asst-hero .asst-sub { max-width: 580px; margin: 4px auto 30px; font-size: 19px; line-height: 1.5; color: var(--muted); }
.asst-fine { margin-top: 14px; font-size: 13px; color: var(--muted-2); }
.asst-proof { margin-top: 34px; }
.asst-grid { display: grid; grid-template-columns: minmax(0, 360px) minmax(0, 1fr); gap: 64px; align-items: center; }
.asst-phone { width: 100%; max-width: 320px; margin: 0 auto; border: 1px solid var(--hair-2); border-radius: 40px; padding: 18px 16px 20px; background: #fff; box-shadow: 0 24px 60px -30px rgba(10, 10, 10, 0.35); }
.asst-phone-top { display: flex; flex-direction: column; align-items: center; gap: 6px; padding-bottom: 14px; border-bottom: 1px solid var(--hair); }
.asst-phone-top img { width: 34px; height: 34px; }
.asst-phone-top b { font-size: 14px; font-weight: 500; color: var(--text); }
.asst-phone-top span { font-size: 12px; color: var(--muted-2); }
.asst-when { margin: 14px 0 10px; text-align: center; font-family: var(--font-mono, monospace); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-2); }
.asst-msg { max-width: 86%; margin-bottom: 10px; padding: 10px 13px; border-radius: 16px; font-size: 13.5px; line-height: 1.45; }
.asst-msg.them { background: var(--surface); border: 1px solid var(--hair); color: var(--text); border-bottom-left-radius: 5px; }
.asst-msg.them small { display: block; margin-bottom: 3px; font-size: 11px; color: var(--muted-2); }
.asst-msg.us { margin-left: auto; background: var(--accent); color: #fff; border-bottom-right-radius: 5px; }
.asst-msg.quote { font-style: italic; }
.asst-call { display: flex; align-items: center; gap: 10px; margin-top: 6px; padding: 10px 13px; border-radius: 16px; background: var(--accent-50); border: 1px solid var(--accent-100); font-size: 13px; color: var(--text); }
.asst-call svg { width: 18px; height: 18px; color: var(--accent); flex: none; }
.asst-copy h2 { margin-bottom: 30px; }
.asst-row { display: flex; gap: 16px; padding: 18px 0; border-top: 1px solid var(--hair); }
.asst-row:first-of-type { border-top: 0; padding-top: 0; }
.asst-ico { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--accent-50); border: 1px solid var(--accent-100); color: var(--accent); }
.asst-ico svg { width: 20px; height: 20px; }
.asst-row h3 { margin: 2px 0 6px; font-size: 17px; font-weight: 500; color: var(--text); }
.asst-row p { margin: 0; font-size: 15px; line-height: 1.55; color: var(--muted); }
.asst-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.asst-step { padding: 24px; border: 1px solid var(--hair); border-radius: 18px; background: #fff; }
.asst-step b { display: block; margin-bottom: 10px; font-family: var(--font-mono, monospace); font-size: 12px; color: var(--accent); }
.asst-step h3 { margin: 0 0 8px; font-size: 17px; font-weight: 500; color: var(--text); }
.asst-step p { margin: 0; font-size: 15px; line-height: 1.55; color: var(--muted); }
.asst-showcase { padding: 0 0 88px; }
.asst-showcase .showcase { margin-top: 0; }
@media (max-width: 860px) {
  .asst-hero { padding: 120px 0 56px; }
  .asst-grid { grid-template-columns: minmax(0, 1fr); gap: 44px; }
  .asst-steps { grid-template-columns: minmax(0, 1fr); }
}
</style>`;

function launchForm(id: string): string {
  return `<form class="launch" action="${SIGN_UP}" method="get" id="${id}">
      <div class="launch-field">
        <input name="url" type="text" autocomplete="off" placeholder="Paste your website, e.g., acme.com" aria-label="Your website">
        <button class="btn btn-accent" type="submit"><span>Start free</span>${ARROW}</button>
      </div>
    </form>`;
}

export function renderAssistantPage(home: string = readHomepage()): string {
  const blocks = homepageBlocks(home);
  const body = `${STYLE}
<section class="hero asst-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="asst-eyebrow"><i></i>AI sales assistant</span>
    <h1>The AI sales assistant for founders who'd rather <span class="accent">build than prospect</span>.</h1>
    <p class="asst-sub">It finds the people who buy what you sell, writes to them, and hands you only the ones who want to talk.</p>
    ${launchForm("asst-hero-form")}
    <div class="asst-fine">First $30 free · Live in 2 minutes · Stop any time</div>
    <div class="asst-proof">__HOT_LEAD_ROW__</div>
  </div>
</section>

<section class="asst-showcase">
  <div class="wrap hero-inner">
    ${blocks.showcase}
  </div>
</section>

<section class="framed tint" id="where">
  <div class="wrap">
    <div class="asst-grid">
      <div class="asst-phone rv" role="img" aria-label="Illustration: a buyer's reply arriving in your inbox, then a call to your phone">
        <div class="asst-phone-top">
          <img src="/landing/v2/assets/logo-mark.svg" alt="">
          <b>distribute.you</b>
          <span>Your sales assistant</span>
        </div>
        <div class="asst-when">Today 9:41 am</div>
        <div class="asst-msg them"><small>New interested reply</small>The Head of Ops at a 40-person agency answered your campaign.</div>
        <div class="asst-msg them quote">"This is timely. Could we talk on Thursday?"</div>
        <div class="asst-msg us">The whole thread is in your inbox. Ringing your phone now.</div>
        <div class="asst-call">${ICON_PHONE}<span>Incoming call: an interested buyer</span></div>
      </div>
      <div class="asst-copy">
        <h2>No app to learn.<br>It works where you already are.</h2>
        <div class="asst-row rv">
          <span class="asst-ico">${ICON_MAIL}</span>
          <div><h3>Your inbox</h3><p>Every interested reply lands in your email with the whole thread, so you answer it like any other message.</p></div>
        </div>
        <div class="asst-row rv">
          <span class="asst-ico">${ICON_PHONE}</span>
          <div><h3>Your phone</h3><p>When a buyer says yes, your phone rings within the minute, while they are still thinking about you.</p></div>
        </div>
        <div class="asst-row rv">
          <span class="asst-ico">${ICON_CAL}</span>
          <div><h3>Your calendar</h3><p>Meetings go straight onto your calendar through your own booking link. Nothing to copy across.</p></div>
        </div>
      </div>
    </div>
  </div>
</section>

${blocks.proofAndQuotes}
<section class="framed" id="how">
  <div class="wrap">
    <div class="section-head"><h2>Three steps, and only the first one is yours.</h2></div>
    <div class="asst-steps">
      <div class="asst-step rv"><b>01</b><h3>Paste your website</h3><p>We read what you sell and who buys it. You check the result and change what is wrong.</p></div>
      <div class="asst-step rv"><b>02</b><h3>It goes looking</h3><p>It finds the people who match, writes to each of them, and follows up until they answer.</p></div>
      <div class="asst-step rv"><b>03</b><h3>You take the call</h3><p>You only hear about the ones who said yes. Everyone else stays out of your way.</p></div>
    </div>
  </div>
</section>

${blocks.rest}`;

  return shell({
    title: TITLE,
    description: DESCRIPTION,
    path: ASSISTANT_PATH,
    body,
    jsonLd: [],
    noindex: true,
  });
}
