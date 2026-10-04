import { CONTACT } from "./concierge";

/**
 * `/desktop`: the private-beta page for distribute for Mac (`apps/desktop`).
 *
 * Owner-decided 2026-10-04: a separate page, never linked from the main landing, not in
 * the sitemap, `noindex`. The app is free; campaigns run on PREPAID credit the user tops
 * up from the app (never the monthly plan). Inspiration: conductor.build, so the hero is
 * the product itself, a drawn app window, not a claim about it.
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
  "Chat with your cold email from your Mac. It runs on your own Claude Code. Click a channel to see what it sent and what it got back.";

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
.panes { display: grid; grid-template-columns: 210px 1fr 300px; min-height: 380px; }
.side { padding: 14px 10px; border-right: 1px solid var(--line-subtle); display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.side h3 { font-size: 11.5px; font-weight: 500; color: var(--fg-3); padding: 12px 8px 4px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 8px; border-radius: 8px; }
.row.on { background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--line); }
.row small { color: var(--fg-3); font-size: 11.5px; }
.row.off { color: var(--fg-4); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--run); }
.chat { min-width: 0; padding: 18px; display: flex; flex-direction: column; gap: 12px; font-size: 13px; line-height: 20px; }
.me { align-self: flex-end; max-width: 80%; padding: 8px 12px; border-radius: 10px; background: #2563eb1a; }
.ai { max-width: 92%; color: var(--fg-1); }
.tool { font-size: 11.5px; color: var(--fg-3); }
.input { margin-top: auto; padding: 10px 12px; border-radius: 10px; background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--line); color: var(--fg-4); }
.panel { border-left: 1px solid var(--line-subtle); padding: 16px; display: flex; flex-direction: column; gap: 10px; background: var(--bg-raised); font-size: 12.5px; }
.panel h4 { font-size: 13px; font-weight: 600; }
.camp { padding: 12px; border-radius: 10px; background: var(--bg-surface); box-shadow: inset 0 0 0 1px var(--line); display: grid; gap: 10px; }
.camp b { font-weight: 600; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stats span { display: block; font-weight: 600; font-variant-numeric: tabular-nums; font-size: 13px; }
.stats .bone { width: 70%; height: 10px; margin: 3px 0 5px; border-radius: 4px; background: var(--bg-inset); box-shadow: inset 0 0 0 1px var(--line-subtle); }
.stats em { font-style: normal; color: var(--fg-3); font-size: 11px; }
@media (max-width: 900px) { .panes { grid-template-columns: 180px 1fr; } .panel { display: none; } }
@media (max-width: 600px) { .panes { grid-template-columns: 1fr; } .side { display: none; } .hero h1 { font-size: 32px; line-height: 38px; } }

.how { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; padding: 56px 0 24px; }
.how h2 { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
.how p { color: var(--fg-2); }
.how ol { counter-reset: s; list-style: none; display: grid; gap: 10px; color: var(--fg-2); }
.how li { counter-increment: s; display: grid; grid-template-columns: 22px 1fr; }
.how li::before { content: counter(s); font-variant-numeric: tabular-nums; color: var(--fg-3); }
@media (max-width: 800px) { .how { grid-template-columns: 1fr; } }
.note { color: var(--fg-3); font-size: 13px; padding-bottom: 32px; max-width: 640px; }
.legal { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0 20px; border-top: 1px solid var(--line-subtle); color: var(--fg-3); font-size: 12px; margin-top: auto; }
.legal a { text-decoration: none; }
.legal a:hover { color: var(--fg-1); }

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

function legal(): string {
  return `<footer class="wrap legal"><p>© ${new Date().getUTCFullYear()} distribute.you. Revenue made easy.</p><nav><a href="/privacy">Privacy</a> &nbsp; <a href="/terms">Terms</a></nav></footer>`;
}

/** A drawn app window. No figures in it: a number on a public page is live or sourced, never invented. */
function windowMock(): string {
  return `<figure class="window" aria-label="The distribute app: channels on the left, the chat in the middle, the cold email panel on the right.">
<div class="bar"><i></i><i></i><i></i></div>
<div class="panes">
<nav class="side">
<div class="row on"><span>Your brand</span></div>
<h3>Channels</h3>
<div class="row on"><span>Cold email</span><span class="dot" aria-label="running"></span></div>
<h3>Credits</h3>
<div class="row"><span>Prepaid</span><small>Top up</small></div>
</nav>
<div class="chat">
<div class="me">How is cold email doing this week?</div>
<div class="tool">Read campaign results</div>
<div class="ai">Here is each campaign: what it sent, the clicks, the positive replies and what each one cost. The panel on the right shows the same figures.</div>
<div class="me">Pause the London one.</div>
<div class="ai">That stops sending for "Agencies in London". Go ahead?</div>
<div class="input">Ask about your results, or tell it what to change</div>
</div>
<aside class="panel">
<h4>Cold email</h4>
<div class="camp"><b>Founders in Paris</b><div class="stats"><div><span class="bone"></span><em>Sent</em></div><div><span class="bone"></span><em>Clicks</em></div><div><span class="bone"></span><em>Positive replies</em></div></div></div>
<div class="camp"><b>Agencies in London</b><div class="stats"><div><span class="bone"></span><em>Sent</em></div><div><span class="bone"></span><em>Clicks</em></div><div><span class="bone"></span><em>Positive replies</em></div></div></div>
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
<h1>Run your cold email from a chat on your Mac.</h1>
<p>Ask how it is going, and ask for changes. It uses your own Claude Code. Click a channel to see what it sent, what came back, and what each positive reply cost.</p>
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
<div><h2>What it costs</h2><p>The app is free during the beta. Campaigns spend prepaid credit. You top up from the app, when you want, and you can stop sending at any time.</p></div>
<div><h2>What it does today</h2><p>Cold email is the channel we run. The chat reads your results and can pause sending, change a daily budget or stop a campaign. It asks before every change.</p></div>
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
<p>If you paid, your credit shows in the app within a minute. Click refresh in the cold email panel to see it.</p>
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
