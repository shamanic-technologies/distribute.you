import { CONTACT } from "./concierge";
import { footerHtml } from "../site-chrome";

/**
 * `/desktop`: the private-beta page for distribute for Mac (`apps/desktop`).
 *
 * Owner-decided 2026-10-04: a separate page, never linked from the main landing, not in
 * the sitemap, `noindex`. The app is free; campaigns run on PREPAID credit the user tops
 * up from the app (never the monthly plan). Inspiration: conductor.build, so the hero is
 * the product itself, a drawn app window, not a claim about it.
 *
 * Since LOCAL-CLAUDE-1116 (owner 2026-11-16, « Exact as web ») the app IS the web dashboard
 * in its own window, and its one difference is that the org's AI runs on the user's own
 * Claude Code plan, charged $0. The page says exactly that and draws that: the dashboard
 * plus the menu bar item. The old native chat and its panels are gone; never draw them.
 *
 * Downloads come from the `desktop-latest` GitHub pre-release, rebuilt by
 * `.github/workflows/desktop.yml` on every merge that touches `apps/desktop`. The app is
 * ad-hoc signed (no Apple Developer ID yet), so the terminal one-liner is the primary
 * path: a file fetched by curl carries no quarantine flag and opens without a warning.
 */

export const DESKTOP_PATH = "/desktop";
export const DESKTOP_INSTALL_PATH = "/desktop/install.sh";
export const DESKTOP_TOPPED_UP_PATH = "/desktop/topped-up";
export const DESKTOP_DOWNLOAD_URL =
  "https://github.com/shamanic-technologies/distribute.you/releases/download/desktop-latest/Distribute.zip";
export const DESKTOP_INSTALL_COMMAND = `curl -fsSL https://distribute.you${DESKTOP_INSTALL_PATH} | sh`;
const CLAUDE_CODE_URL = "https://docs.anthropic.com/en/docs/claude-code/setup";

const TITLE = "distribute for Mac (private beta)";
const DESCRIPTION =
  "Your distribute.you dashboard on your Mac. Our AI runs on the Claude Code plan you already have, and we charge $0 for those calls.";

/** Dashboard v2's Keel tokens, restated: this page cannot import the dashboard's CSS. */
const STYLE = `<style>
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
:root { --bg-canvas: #f3f3f4; --bg-surface: #fafafa; --bg-raised: #ffffff; --bg-inset: #f5f5f6; --bg-hover: #1010120a;
  --bg-strong: #18181b; --bg-strong-hover: #27272b; --fg-1: #101012; --fg-2: #5e5e66; --fg-3: #74747c; --fg-4: #a9a9b0;
  --line-subtle: #10101211; --line: #10101217; --line-strong: #10101224; --accent: #2563eb; --run: #16a34a;
  --elev-control: 0 1px 1px #0000000d; }
html, body { background: var(--bg-canvas); }
.site { display: flex; flex-direction: column; min-height: 100dvh; color: var(--fg-1);
  font-family: "Geist", "Inter", ui-sans-serif, system-ui, sans-serif; font-size: 14px; line-height: 22px; -webkit-font-smoothing: antialiased; }
.site a { color: inherit; }
.wrap { width: 100%; max-width: 1120px; margin: 0 auto; padding: 0 20px; }
.top { display: flex; align-items: center; justify-content: space-between; padding-top: 24px; }
.top img { display: block; width: 28px; height: 28px; border-radius: 7px; }
.beta { font-size: 12px; color: var(--fg-2); padding: 3px 10px; border-radius: 999px; background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--line); }
.hero { padding: 56px 0 40px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; max-width: 640px; }
.hero h1 { font-size: 40px; line-height: 44px; font-weight: 600; letter-spacing: -0.03em; text-wrap: balance; }
.hero p { font-size: 17px; line-height: 27px; color: var(--fg-2); text-wrap: pretty; }
.cmd { display: inline-flex; align-items: center; gap: 10px; height: 42px; padding: 0 6px 0 14px; border-radius: 10px; background: var(--bg-raised);
  box-shadow: inset 0 0 0 1px var(--line), var(--elev-control); font-family: "Geist Mono", ui-monospace, monospace; font-size: 12.5px; color: var(--fg-1); max-width: 100%; }
.cmd code { min-width: 0; overflow-x: auto; white-space: nowrap; }
.copy { height: 30px; padding: 0 10px; border: 0; border-radius: 7px; background: var(--bg-inset); font: inherit; font-family: "Geist", sans-serif; font-size: 12px; color: var(--fg-2); cursor: pointer; }
.copy:hover { color: var(--fg-1); background: var(--bg-hover); }
.install { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; margin-top: 4px; }
.install__label { display: flex; align-items: center; gap: 8px; font-size: 14px !important; line-height: 20px !important; color: var(--fg-1) !important; font-weight: 500; }
.install__label svg { width: 16px; height: 16px; }
.install .cmd { height: 48px; width: fit-content; max-width: 100%; padding-left: 16px; font-size: 13px; }
.install .copy { height: 36px; padding: 0 14px; background: var(--bg-strong); color: #fafafa; font-size: 13px; font-weight: 500; }
.install .copy:hover { background: var(--bg-strong-hover); color: #fafafa; }
.alt { font-size: 13px !important; line-height: 20px !important; color: var(--fg-3) !important; }
.alt a { color: var(--fg-1); }
.cta:focus-visible, .copy:focus-visible, .site a:focus-visible { outline: 2px solid color-mix(in oklab, var(--accent) 60%, transparent); outline-offset: 2px; }

/* The one bold thing: the app itself, drawn. */
.window { border-radius: 14px; background: var(--bg-surface); box-shadow: inset 0 0 0 1px var(--line), 0 24px 60px -24px #10101240, 0 2px 6px #0000000a; overflow: hidden; }
.bar { display: flex; gap: 7px; padding: 12px 14px; border-bottom: 1px solid var(--line-subtle); }
.bar i { width: 11px; height: 11px; border-radius: 50%; background: #e3e3e6; }
.panes { display: grid; grid-template-columns: 200px 1fr; min-height: 380px; position: relative; }
.side { padding: 14px 10px; border-right: 1px solid var(--line-subtle); display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.side h3 { font-size: 11.5px; font-weight: 500; color: var(--fg-3); padding: 12px 8px 4px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 8px; border-radius: 8px; }
.row.on { background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--line); }
.row small { color: var(--fg-3); font-size: 11.5px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--run); flex: none; }
.page { min-width: 0; padding: 22px 288px 22px 22px; display: flex; flex-direction: column; gap: 14px; background: var(--bg-raised); }
.page h4 { font-size: 20px; line-height: 26px; font-weight: 600; letter-spacing: -0.01em; }
.page .sub { color: var(--fg-2); font-size: 13px; }
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.tile { padding: 12px; border-radius: 10px; background: var(--bg-surface); box-shadow: inset 0 0 0 1px var(--line); display: grid; gap: 8px; font-size: 11px; color: var(--fg-3); }
.bone { display: block; height: 10px; border-radius: 4px; background: var(--bg-inset); box-shadow: inset 0 0 0 1px var(--line-subtle); }
.bone.big { height: 18px; width: 60%; }
.chart { height: 110px; border-radius: 10px; background: var(--bg-surface); box-shadow: inset 0 0 0 1px var(--line); position: relative; overflow: hidden; }
.chart svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.menu { position: absolute; top: 10px; right: 14px; width: 250px; padding: 12px; border-radius: 12px; background: var(--bg-raised);
  box-shadow: inset 0 0 0 1px var(--line), 0 18px 40px -18px #10101240; display: grid; gap: 10px; font-size: 12.5px; }
.menu b { font-weight: 600; font-size: 13px; }
.menu .line { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.menu .state { display: inline-flex; align-items: center; gap: 6px; color: var(--fg-2); }
.switch { width: 30px; height: 18px; border-radius: 999px; background: var(--run); position: relative; flex: none; }
.switch::after { content: ""; position: absolute; top: 2px; right: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; }
.menu small { color: var(--fg-3); font-size: 11.5px; line-height: 16px; }
@media (max-width: 900px) { .panes { grid-template-columns: 170px 1fr; } .page { padding-right: 22px; } .menu { position: static; width: auto; margin: 0 14px 14px; grid-column: 1 / -1; } }
@media (max-width: 600px) { .panes { grid-template-columns: 1fr; } .side { display: none; } .hero h1 { font-size: 32px; line-height: 38px; } }

.how { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; padding: 56px 0 24px; }
.how h2 { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
.how p { color: var(--fg-2); }
.how ol { counter-reset: s; list-style: none; display: grid; gap: 10px; color: var(--fg-2); }
.how li { counter-increment: s; display: grid; grid-template-columns: 22px 1fr; }
.how li::before { content: counter(s); font-variant-numeric: tabular-nums; color: var(--fg-3); }
@media (max-width: 800px) { .how { grid-template-columns: 1fr; } }
.note { color: var(--fg-3); font-size: 13px; padding-bottom: 32px; max-width: 640px; }
/* The site footer (links from site-chrome.ts), drawn in this page's Keel tokens. */
.site-foot { margin-top: auto; border-top: 1px solid var(--line-subtle); }
.site-foot footer { padding: 40px 0 24px; }
.site-foot .foot { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 28px 24px; }
.site-foot .foot-brand { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; }
.site-foot .brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 500; color: var(--fg-1); text-decoration: none; }
.site-foot .brand img { width: 22px; height: 22px; }
.site-foot .tag { color: var(--fg-3); font-size: 13px; }
.site-foot h4 { font-size: 13px; font-weight: 500; color: var(--fg-1); margin: 0 0 8px; }
.site-foot ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.site-foot .foot a { color: var(--fg-3); font-size: 13px; text-decoration: none; display: inline-block; padding: 3px 0; }
.site-foot .foot a:hover { color: var(--fg-1); }
.site-foot .foot-bottom { margin-top: 28px; color: var(--fg-3); font-size: 12px; }

@keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.window { animation: rise 640ms cubic-bezier(.23,1,.32,1) 120ms both; }
@media (prefers-reduced-motion: reduce) { .window { animation: none; } }
</style>`;

const APPLE = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.37 12.62c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.61 2.25 2.75 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.67-2.14.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.31-.89-2.33-3.53zM14.17 6.15c.61-.74 1.02-1.76.91-2.78-.88.04-1.94.59-2.57 1.32-.56.65-1.06 1.69-.93 2.69.98.08 1.98-.5 2.59-1.23z"/></svg>`;

function head(title: string, description: string, path: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f3f3f4">
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

function top(): string {
  return `<header class="wrap top"><a href="/" aria-label="distribute.you home"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="28" height="28"></a><span class="beta">Private beta</span></header>`;
}

/** The site footer (catalogue-driven, `site-chrome.ts`), in its own scope so the page's Keel tokens stay untouched. */
function legal(): string {
  return `<div class="site-foot">${footerHtml(DESKTOP_PATH)}</div>`;
}

/** A drawn app window. No figures in it: a number on a public page is live or sourced, never invented. */
function windowMock(): string {
  return `<figure class="window" aria-label="The distribute app: your dashboard, and the menu bar item showing your Claude Code answering our AI.">
<div class="bar"><i></i><i></i><i></i></div>
<div class="panes">
<nav class="side">
<div class="row on"><span>Today</span></div>
<div class="row"><span>Unibox</span></div>
<div class="row"><span>Campaigns</span><span class="dot" aria-label="running"></span></div>
<div class="row"><span>Outcomes</span></div>
<h3>Setup</h3>
<div class="row"><span>Integrations</span></div>
</nav>
<div class="page">
<h4>Today</h4>
<p class="sub">Your campaigns, your outcomes, your revenue.</p>
<div class="tiles"><div class="tile">Revenue<span class="bone big"></span></div><div class="tile">Positive replies<span class="bone big"></span></div><div class="tile">Meetings booked<span class="bone big"></span></div></div>
<div class="chart" aria-hidden="true"><svg viewBox="0 0 400 110" preserveAspectRatio="none"><path d="M0 92 C60 88 90 70 140 66 S230 44 280 36 S360 18 400 12" fill="none" stroke="#2563eb" stroke-width="2"/></svg></div>
</div>
<aside class="menu">
<div class="line"><b>Claude Code</b><span class="state"><span class="dot"></span>Connected</span></div>
<div class="line"><span>Your organization</span><span class="switch" aria-label="on"></span></div>
<small>Our AI answers on your Mac, on your own plan. We charge nothing for it.</small>
</aside>
</div>
</figure>`;
}

export function renderDesktopPage(): string {
  return `${head(TITLE, DESCRIPTION, DESKTOP_PATH)}
<body>
<div class="site">
${top()}
<main class="wrap">
<section class="hero">
<h1>Your dashboard on your Mac, with our AI on your own Claude Code.</h1>
<p>The same distribute.you dashboard, in its own window. Our AI writes and decides on the Claude Code plan you already have. We charge $0 for those calls.</p>
<div class="install">
<p class="install__label">${APPLE}Install on your Mac: paste this in Terminal.</p>
<span class="cmd"><code id="cmd">${DESKTOP_INSTALL_COMMAND}</code><button class="copy" type="button" data-copy="cmd">Copy</button></span>
<p class="alt">Or <a href="${DESKTOP_DOWNLOAD_URL}" data-track="desktop_download_clicked">download the app</a>. macOS blocks it the first time. Open System Settings, then Privacy and Security, and click Open Anyway.</p>
</div>
</section>
${windowMock()}
<section class="how">
<div><h2>What you need</h2><ol>
<li><span>A Mac with macOS 14 or later.</span></li>
<li><span><a href="${CLAUDE_CODE_URL}">Claude Code</a>, logged in once in your terminal.</span></li>
<li><span>A distribute account. Sign in with Google or email when the app opens.</span></li>
</ol></div>
<div><h2>What you pay</h2><p>The app is free during the beta. AI calls your Claude Code answers are free on our side. Sending and other campaign spend use prepaid credit, topped up from Billing when you want.</p></div>
<div><h2>What it does</h2><p>Everything the web dashboard does, Sophie in the Copilot included. Switch on AI on my Claude Code from the menu bar or in Integrations. Keep the app open while your campaigns run.</p></div>
</section>
<p class="note">The beta is not notarized by Apple yet, so the Terminal install is the smooth path. Questions: ${CONTACT.email}.</p>
</main>
${legal()}
</div>
<script>
(function () {
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-copy],[data-track]") : null;
    if (!el) return;
    if (el.hasAttribute("data-copy")) {
      var text = document.getElementById(el.getAttribute("data-copy")).textContent;
      navigator.clipboard.writeText(text).then(function () { el.textContent = "Copied"; setTimeout(function () { el.textContent = "Copy"; }, 1600); });
      if (window.posthog) posthog.capture("desktop_install_copied", {});
    } else if (window.posthog) posthog.capture(el.getAttribute("data-track"), {});
  });
})();
</script>
</body>
</html>
`;
}

/** Where Stripe sends the buyer back after a top-up started in the app. */
export function renderDesktopToppedUpPage(): string {
  return `${head("Credit added", "Your distribute credit is added.", DESKTOP_TOPPED_UP_PATH)}
<body>
<div class="site">
${top()}
<main class="wrap"><section class="hero">
<h1>Back to the app.</h1>
<p>If you paid, your credit shows on the Billing page within a minute.</p>
</section></main>
${legal()}
</div>
</body>
</html>
`;
}

/** `curl … | sh`: fetches the zip with curl (no quarantine flag), installs to /Applications, opens it. */
export function renderDesktopInstallScript(): string {
  return `#!/bin/sh
# distribute for Mac, private beta installer.
set -eu
URL="${DESKTOP_DOWNLOAD_URL}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "Downloading distribute for Mac..."
curl -fsSL "$URL" -o "$TMP/Distribute.zip"
ditto -x -k "$TMP/Distribute.zip" "$TMP"
DEST="/Applications"
[ -w "$DEST" ] || DEST="$HOME/Applications"
mkdir -p "$DEST"
rm -rf "$DEST/Distribute.app"
mv "$TMP/Distribute.app" "$DEST/Distribute.app"
xattr -dr com.apple.quarantine "$DEST/Distribute.app" 2>/dev/null || true
if ! command -v claude >/dev/null 2>&1; then
  echo "Note: Claude Code is not on your PATH. Install it first: https://docs.anthropic.com/en/docs/claude-code/setup"
fi
echo "Installed in $DEST. Opening..."
open "$DEST/Distribute.app"
`;
}
