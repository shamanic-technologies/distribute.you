import { CONTACT } from "./concierge";

/**
 * `/lp/instinct`: the homepage candidate built as close as we can get to instinct.com
 * (clone on disk at `clones/instinct/`, onboarding notes in `clones/ONBOARDING-MAP.md`).
 *
 * Their whole site is one page: a small mark, one paragraph in semibold, two in
 * regular, one underlined call to action, a copyright line. The call to action leads to
 * a single screen, "Start texting Instinct", with an iMessage | WhatsApp switch, a QR
 * code and the number. We reproduce both screens with two differences, owner-decided:
 * our channels are WhatsApp and Telegram (we have no iMessage), and we skip their
 * phone-number sign-in in between, since it would create nothing on our side.
 *
 * Their spirit, our UI: the content and the flow are theirs (one page of prose, one call
 * to action, one channel picker), the styling is dashboard v2's (Keel tokens, Geist,
 * raised cards on the canvas, 8px controls), so the page reads as distribute.you. No
 * brush stroke and none of their assets: an earlier cut copied their hand-drawn
 * underline and read as a copy (owner, 2026-10-01).
 *
 * The conversion is starting a conversation: every channel link carries
 * `data-contact="<channel>"` and is captured in PostHog as `contact_clicked`, the same
 * event the concierge candidate used, so the two tests read side by side.
 */

export const INSTINCT_PATH = "/lp/instinct";
export const INSTINCT_START_PATH = "/lp/instinct/start";

const WHATSAPP_MESSAGE = "Hi! I want more customers. My website is: ";
export const WHATSAPP_HREF = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
export const TELEGRAM_HREF = `https://t.me/${CONTACT.telegram}`;

const TITLE = "distribute.you";
const DESCRIPTION =
  "distribute.you is a sales assistant that finds the companies that need what you sell and gets them talking to you. You text it on WhatsApp or Telegram.";

const ARROW = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8h9M8.5 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Dashboard v2's Keel tokens (`apps/dashboard/src/components/v2/keel.css`), restated: this page cannot import that file. */
const STYLE = `<style>
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
:root { --bg-canvas: #f3f3f4; --bg-surface: #fafafa; --bg-raised: #ffffff; --bg-inset: #f5f5f6; --bg-hover: #1010120a;
  --bg-strong: #18181b; --bg-strong-hover: #27272b; --fg-1: #101012; --fg-2: #5e5e66; --fg-3: #74747c; --fg-4: #a9a9b0;
  --line-subtle: #10101211; --line: #10101217; --line-strong: #10101224; --accent: #2563eb; --run: #16a34a;
  --elev-control: 0 1px 1px #0000000d; }
html, body { background: var(--bg-canvas); }
.site { display: flex; flex-direction: column; min-height: 100dvh; color: var(--fg-1); background: var(--bg-canvas);
  font-family: "Geist", "Inter", ui-sans-serif, system-ui, sans-serif; font-size: 13px; line-height: 20px; -webkit-font-smoothing: antialiased; }
.site a { color: inherit; text-decoration: none; }
.mono { font-family: "Geist Mono", "DM Mono", ui-monospace, monospace; }
.label { font-family: "Geist Mono", "DM Mono", ui-monospace, monospace; font-size: 10.5px; font-weight: 500; line-height: 14px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-3); }
.topbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 16px; background: var(--bg-surface); border-bottom: 1px solid var(--line-subtle); }
.topbar img { width: 20px; height: 20px; border-radius: 5px; }
.topbar span { font-size: 13px; font-weight: 500; }
@media (min-width: 768px) { .topbar { padding: 0 24px; } }
.home { flex: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 56px; width: 100%; max-width: 1280px; margin: 0 auto; padding: 72px 16px 0; }
@media (min-width: 768px) { .home { padding: 104px 24px 0; } }
.home__wrapper { display: flex; flex-direction: column; gap: 40px; }
.home__intro { display: flex; flex-direction: column; gap: 14px; max-width: 640px; }
.home h1 { font-size: 24px; line-height: 32px; font-weight: 600; letter-spacing: -0.02em; color: var(--fg-1); text-wrap: pretty; }
.home__intro p { font-size: 15px; line-height: 24px; color: var(--fg-2); text-wrap: pretty; }
@media (min-width: 1280px) { .home h1 { font-size: 28px; line-height: 36px; } .home__intro p { font-size: 16px; line-height: 26px; } }
.cta { display: inline-flex; align-items: center; gap: 8px; width: fit-content; height: 40px; padding: 0 14px 0 16px; border-radius: 10px;
  background: var(--bg-strong); color: #fafafa !important; font-size: 14px; font-weight: 500; transition: background 120ms, transform 120ms; }
.cta:hover { background: var(--bg-strong-hover); }
.cta:active { transform: scale(0.98); }
.cta svg { width: 16px; height: 16px; transition: transform 160ms cubic-bezier(.23,1,.32,1); }
.cta:hover svg { transform: translateX(2px); }
.cta:focus-visible, .tab:focus-visible, .link:focus-visible, .back:focus-visible { outline: 2px solid color-mix(in oklab, var(--accent) 60%, transparent); outline-offset: 2px; }
.legal { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 0; border-top: 1px solid var(--line-subtle); color: var(--fg-3); font-size: 12px; white-space: nowrap; }
.legal nav { display: flex; gap: 20px; }
.legal a:hover { color: var(--fg-1); }
.legal .mail { display: none; }
@media (min-width: 768px) { .legal .mail { display: block; } }
@media (max-width: 359px) { .legal { flex-wrap: wrap; } }

.start { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 16px 64px; }
.card { width: 100%; max-width: 360px; padding: 24px; background: var(--bg-raised); border-radius: 12px; box-shadow: inset 0 0 0 1px var(--line-subtle), 0 1px 2px #0000000a; display: flex; flex-direction: column; }
.start h1 { margin-top: 8px; font-size: 20px; line-height: 28px; font-weight: 600; letter-spacing: -0.015em; }
.start__sub { margin-top: 4px; font-size: 13px; color: var(--fg-2); }
.tabs { display: flex; gap: 20px; margin-top: 20px; border-bottom: 1px solid var(--line-subtle); }
.tab { position: relative; display: inline-flex; align-items: center; gap: 6px; height: 40px; border: 0; background: none; font: inherit; font-size: 13px; color: var(--fg-2); cursor: pointer; }
.tab[aria-selected="true"] { color: var(--fg-1); }
.tab[aria-selected="true"]::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1.5px; background: var(--fg-1); }
.tab svg { width: 16px; height: 16px; border-radius: 4px; }
.panel { display: flex; flex-direction: column; align-items: stretch; margin-top: 16px; }
.panel[hidden] { display: none; }
.qr { align-self: center; width: 184px; height: 184px; padding: 14px; background: var(--bg-raised); border-radius: 12px; box-shadow: inset 0 0 0 1px var(--line); }
.qr img { display: block; width: 100%; height: 100%; }
.panel p { margin-top: 16px; font-size: 12px; color: var(--fg-3); text-align: center; }
.link { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 36px; margin-top: 8px; padding: 0 12px; border-radius: 8px;
  background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--line), var(--elev-control); font-size: 13px; transition: background 120ms; }
.link:hover { background: var(--bg-inset); }
.link svg { width: 14px; height: 14px; color: var(--fg-3); }
.back { align-self: center; display: inline-flex; align-items: center; height: 28px; margin-top: 16px; padding: 0 8px; border-radius: 8px; color: var(--fg-2); font-size: 13px; }
.back:hover { background: var(--bg-hover); color: var(--fg-1); }

/* A sales surface moves: the prose rises in, line after line, then the call to action. */
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.rise { animation: rise 520ms cubic-bezier(.23,1,.32,1) both; }
.rise:nth-child(2) { animation-delay: 80ms; } .rise:nth-child(3) { animation-delay: 160ms; }
.cta.rise, .card.rise { animation-delay: 260ms; }
@media (prefers-reduced-motion: reduce) { .rise { animation: none; } .cta, .cta svg { transition: none; } }
</style>`;

const ICON_WA = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#25d366"/><path fill="#fff" d="M12 5.2a6.8 6.8 0 0 0-5.85 10.27L5.2 18.8l3.41-.9A6.8 6.8 0 1 0 12 5.2zm3.06 9.6c-.13.36-.75.7-1.05.73-.27.03-.6.04-.97-.06a8.85 8.85 0 0 1-3.67-2.83c-.27-.36-.64-.97-.64-1.7 0-.72.38-1.08.51-1.23.14-.14.3-.18.4-.18h.29c.09 0 .21-.03.33.25l.47 1.14c.04.08.06.17.01.27-.05.1-.08.17-.15.25l-.22.26c-.08.08-.15.16-.07.3.09.15.38.63.82 1.02.56.5 1.04.66 1.19.73.14.08.23.06.31-.03l.47-.55c.1-.14.2-.12.33-.07l1.11.52c.14.07.23.1.26.16.04.06.04.34-.08.7z"/></svg>`;
const ICON_TG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#229ed9"/><path fill="#fff" d="M17.6 7.1 15.7 16.4c-.13.6-.52.76-1.06.47l-2.93-2.16-1.41 1.36c-.16.16-.29.29-.6.29l.21-3 5.46-4.93c.24-.21-.05-.33-.37-.12l-6.75 4.25-2.9-.91c-.63-.2-.64-.63.13-.93l11.33-4.37c.53-.19.99.13.83.93z"/></svg>`;
const ICON_OUT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>`;

function head(title: string, description: string, path: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#fafafa">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="https://distribute.you${path}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@500&display=swap" rel="stylesheet">
${STYLE}
</head>`;
}

function header(): string {
  return `<header class="topbar"><a href="/" aria-label="distribute.you home"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20"></a><span>distribute.you</span></header>`;
}

function legal(): string {
  return `<div class="legal">
<p>© ${new Date().getUTCFullYear()} distribute.you</p>
<nav><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a></nav>
<p class="mail mono">${CONTACT.email.replace("@", "[at]").replace(".", "[dot]")}</p>
</div>`;
}

/** A click on any `[data-contact]` or `[data-track]` element goes to PostHog. */
const TRACK = `<script>
(function () {
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-contact],[data-track]") : null;
    if (!el || !window.posthog) return;
    if (el.hasAttribute("data-contact")) posthog.capture("contact_clicked", { channel: el.getAttribute("data-contact"), where: el.getAttribute("data-where") });
    else posthog.capture(el.getAttribute("data-track"), {});
  });
})();
</script>`;

/** The landing: their single page, our words. */
export function renderInstinctPage(): string {
  return `${head(TITLE, DESCRIPTION, INSTINCT_PATH)}
<body>
<div class="site">
${header()}
<main class="home">
<div class="home__wrapper">
<div class="home__intro">
<h1 class="rise">distribute.you is a sales assistant that finds the companies that need what you sell and gets them talking to you. It reads your website, picks the people worth writing to, and sends the cold emails from inboxes we run.</h1>
<p class="rise">The interface is simple: there is no new interface. You text it, on WhatsApp or Telegram. It answers like a colleague, shows you who it plans to email, and tells you what each reply cost.</p>
<p class="rise">It learned from more than 125,000 cold emails sent for our clients: which audiences answer, which emails get read, which AI writes them best. It keeps testing all three for you, and hands you the people who want to talk.</p>
</div>
<a href="${INSTINCT_START_PATH}" class="cta rise" data-track="instinct_cta_clicked">Text distribute.you to get started${ARROW}</a>
</div>
${legal()}
</main>
</div>
${TRACK}
</body>
</html>
`;
}

/** Their `/onboarding` screen: pick a channel, scan or tap. WhatsApp first, as theirs is iMessage first. */
export function renderInstinctStartPage(): string {
  return `${head("Start texting distribute.you", DESCRIPTION, INSTINCT_START_PATH)}
<body>
<div class="site">
${header()}
<main class="start">
<div class="card rise">
<span class="label">Get started</span>
<h1>Start texting distribute.you</h1>
<p class="start__sub">You can reach distribute.you on WhatsApp or Telegram</p>
<div class="tabs" role="tablist">
<button class="tab" type="button" role="tab" id="tab-wa" aria-controls="panel-wa" aria-selected="true">${ICON_WA}WhatsApp</button>
<button class="tab" type="button" role="tab" id="tab-tg" aria-controls="panel-tg" aria-selected="false">${ICON_TG}Telegram</button>
</div>
<div class="panel" id="panel-wa" role="tabpanel" aria-labelledby="tab-wa">
<a class="qr" href="${WHATSAPP_HREF}" target="_blank" rel="noopener" data-contact="whatsapp" data-where="qr"><img src="/landing/instinct/qr-whatsapp.svg" alt="QR code to message distribute.you on WhatsApp" width="172" height="172"></a>
<p>Scan with your phone's camera or open the link</p>
<a class="link" href="${WHATSAPP_HREF}" target="_blank" rel="noopener" data-contact="whatsapp" data-where="link">wa.me/${CONTACT.whatsapp}${ICON_OUT}</a>
</div>
<div class="panel" id="panel-tg" role="tabpanel" aria-labelledby="tab-tg" hidden>
<a class="qr" href="${TELEGRAM_HREF}" target="_blank" rel="noopener" data-contact="telegram" data-where="qr"><img src="/landing/instinct/qr-telegram.svg" alt="QR code to message distribute.you on Telegram" width="172" height="172"></a>
<p>Scan with your phone's camera or open the link</p>
<a class="link" href="${TELEGRAM_HREF}" target="_blank" rel="noopener" data-contact="telegram" data-where="link">t.me/${CONTACT.telegram}${ICON_OUT}</a>
</div>
<a class="back" href="/">Back</a>
</div>
</main>
</div>
<script>
(function () {
  var tabs = document.querySelectorAll(".tab");
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      tabs.forEach(function (o) {
        var on = o === t;
        o.setAttribute("aria-selected", on ? "true" : "false");
        document.getElementById(o.getAttribute("aria-controls")).hidden = !on;
      });
      if (window.posthog) posthog.capture("instinct_tab_selected", { channel: t.id === "tab-tg" ? "telegram" : "whatsapp" });
    });
  });
})();
</script>
${TRACK}
</body>
</html>
`;
}
