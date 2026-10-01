import { CONTACT } from "./concierge";

/**
 * `/lp/instinct`: the homepage candidate built as close as we can get to instinct.com
 * (clone on disk at `clones/instinct/`, onboarding notes in `clones/ONBOARDING-MAP.md`).
 *
 * Their whole site is one cream page: a small mark, one paragraph in semibold, two in
 * regular, one underlined call to action, a copyright line. The call to action leads to
 * a single screen, "Start texting Instinct", with an iMessage | WhatsApp switch, a QR
 * code and the number. We reproduce both screens with two differences, owner-decided:
 * our channels are WhatsApp and Telegram (we have no iMessage), and we skip their
 * phone-number sign-in in between, since it would create nothing on our side.
 *
 * Their layout, not their assets: the mark is ours, the brush stroke under the call to
 * action is an SVG drawn in our blue, and the type is Inter (their Melange is licensed).
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

const BRUSH = `<svg class="cta__brush" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true"><path d="M6 26 C 70 14, 150 10, 230 13 S 360 20, 394 12" fill="none" stroke="#2563eb" stroke-width="9" stroke-linecap="round" opacity="0.85"/><path d="M40 31 C 120 22, 220 21, 330 24" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round" opacity="0.55"/></svg>`;

const STYLE = `<style>
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #f4efec; }
.site { display: flex; flex-direction: column; min-height: 100dvh; background: #f4efec; color: #1f2322;
  font-family: "Inter", ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  --text: 18px; --leading: 115%; }
@media (min-width: 80rem) { .site { --text: 22px; --leading: 120%; } }
.site a { color: inherit; text-decoration: none; }
.reg, .semi, .btn { font-size: var(--text); line-height: var(--leading); letter-spacing: -0.01em; }
.reg { font-weight: 400; }
.semi, .btn { font-weight: 600; }
.site-header { padding: 20px 16px; flex-shrink: 0; }
.site-header a { display: block; width: fit-content; }
.site-header img { display: block; width: 28px; height: 28px; }
@media (min-width: 80rem) { .site-header { padding: 20px 20px 0; } .site-header img { width: 34px; height: 34px; } }
.home { display: flex; flex-direction: column; justify-content: space-between; flex: 1; gap: 64px; padding: 44px 16px 20px; }
@media (min-width: 80rem) { .home { padding: 64px 20px 20px; } }
.home__wrapper { display: flex; flex-direction: column; gap: 64px; }
.home__intro { display: flex; flex-direction: column; gap: 16px; max-width: 41rem; }
.cta { position: relative; display: flex; width: fit-content; }
.cta:hover .btn, .cta:focus-visible .btn { color: #2563eb; }
.cta__brush { position: absolute; top: 100%; left: 8%; width: 92%; height: 0.9em; rotate: -2deg; pointer-events: none; }
.legal { display: flex; justify-content: space-between; align-items: center; gap: 16px; width: 100%;
  font-size: clamp(0.625rem, 2vw, 1rem); line-height: 102%; letter-spacing: -0.01em; white-space: nowrap; }
.legal nav { display: flex; gap: 24px; }
.legal a:hover { color: #2563eb; }
.legal .mail { display: none; }
@media (min-width: 80rem) { .legal nav { gap: 96px; } .legal .mail { display: block; } }
@media (max-width: 359px) { .legal { flex-wrap: wrap; } }

.start { flex: 1; display: flex; align-items: center; justify-content: center; padding: 32px 16px 64px; }
.start__card { width: 100%; max-width: 340px; display: flex; flex-direction: column; }
.start h1 { font-size: 32px; line-height: 1.1; font-weight: 600; letter-spacing: -0.03em; }
.start__sub { margin-top: 10px; font-size: 15px; color: #6b6f6e; }
.tabs { display: flex; margin-top: 44px; border-bottom: 1px solid #ddd6d1; }
.tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; height: 44px; border: 0; background: none;
  font: inherit; font-size: 14px; font-weight: 500; color: #6b6f6e; cursor: pointer; box-shadow: inset 0 -2px 0 transparent; }
.tab[aria-selected="true"] { color: #1f2322; box-shadow: inset 0 -2px 0 #1f2322; }
.tab svg { width: 22px; height: 22px; border-radius: 6px; }
.panel { display: flex; flex-direction: column; align-items: center; margin-top: 20px; }
.panel[hidden] { display: none; }
.qr { width: 200px; height: 200px; padding: 14px; background: #fff; border: 1px solid #e3ddd8; border-radius: 12px; }
.qr img { display: block; width: 100%; height: 100%; }
.panel p { margin-top: 26px; font-size: 14px; color: #6b6f6e; text-align: center; }
.link { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 46px; margin-top: 12px;
  border: 1px solid #ddd6d1; border-radius: 10px; background: #fdfcfb; font-size: 15px; font-weight: 600; }
.link:hover { border-color: #2563eb; color: #2563eb; }
.link svg { width: 16px; height: 16px; }
.back { margin: 28px auto 0; font-size: 14px; color: #6b6f6e; }
.back:hover { color: #1f2322; }
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
<meta name="theme-color" content="#f4efec">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="https://distribute.you${path}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
${STYLE}
</head>`;
}

function header(): string {
  return `<header class="site-header"><a href="/" aria-label="distribute.you home"><img src="/landing/v2/assets/logo-mark.svg" alt="distribute.you" width="34" height="34"></a></header>`;
}

function legal(): string {
  return `<div class="legal">
<p>Copyright © ${new Date().getUTCFullYear()} distribute.you</p>
<nav><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a></nav>
<p class="mail">${CONTACT.email.replace("@", "[at]").replace(".", "[dot]")}</p>
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
<h1 class="semi">distribute.you is a sales assistant that finds the companies that need what you sell and gets them talking to you. It reads your website, picks the people worth writing to, and sends the cold emails from inboxes we run.</h1>
<p class="reg">The interface is simple: there is no new interface. You text it, on WhatsApp or Telegram. It answers like a colleague, shows you who it plans to email, and tells you what each reply cost.</p>
<p class="reg">It learned from more than 125,000 cold emails sent for our clients: which audiences answer, which emails get read, which AI writes them best. It keeps testing all three for you, and hands you the people who want to talk.</p>
</div>
<a href="${INSTINCT_START_PATH}" class="cta" data-track="instinct_cta_clicked"><span class="btn">Text distribute.you to get started</span>${BRUSH}</a>
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
<div class="start__card">
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
