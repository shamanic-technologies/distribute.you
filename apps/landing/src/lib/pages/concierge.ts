import { SIGN_UP, shell } from "../v2-shell";
import { between, readHomepage } from "./assistant";

/**
 * `/lp/concierge`: the third homepage candidate, and the one furthest from a SaaS.
 * distribute.you is an AI assistant you MESSAGE: email, WhatsApp, Telegram, the chat on
 * this page, or the API / MCP for technical people. No signup form, no dashboard in the
 * pitch. Payment happens by a checkout link sent in the conversation.
 *
 * The primary conversion is starting a conversation, so every contact control carries
 * `data-contact="<channel>"` and is tagged in PostHog as `contact_clicked`.
 *
 * The chat widget talks to `/api/chat/*`, which relays to the team's Telegram; when that
 * bridge is not configured the widget says the chat is offline and offers the other
 * channels rather than accepting a message nobody will read.
 *
 * Below the pitch it borrows the homepage's proof, quotes, stats band and FAQ from
 * `index-v2.html` at render time (one source). Pipeline, features and pricing are left
 * out: they describe a dashboard this page tells the visitor they never need to open.
 */

export const CONCIERGE_PATH = "/lp/concierge";

export const CONTACT = {
  email: "grow@distribute.you",
  whatsapp: "33680478702",
  telegram: "kevin_lourd",
} as const;

const EMAIL_HREF = `mailto:${CONTACT.email}?subject=${encodeURIComponent("Get me customers")}&body=${encodeURIComponent("Hi, my website is: ")}`;
const WHATSAPP_HREF = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent("Hi! I want more customers. My website is: ")}`;
const TELEGRAM_HREF = `https://t.me/${CONTACT.telegram}`;

const TITLE = "distribute.you: your AI sales assistant. Just message it.";
const DESCRIPTION =
  "Message your AI sales assistant by email, WhatsApp, Telegram or chat. It finds your buyers, writes to them and books the meetings. No app, no setup. First $30 free.";

const I = {
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>`,
  wa: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
  tg: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5L20.5 2.8c.9-.3 1.6.2 1.4 1.5z"/></svg>`,
  code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 7-5 5 5 5M16 7l5 5-5 5"/></svg>`,
  card: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
};

const STYLE = `<style>
.cc-hero { min-height: 0; padding: 150px 0 64px; }
.cc-eyebrow { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 22px; padding: 5px 14px; border-radius: 100px; border: 1px solid var(--hair-2); background: #fff; font-size: 13px; color: var(--muted); }
.cc-eyebrow i { width: 7px; height: 7px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 0 3px #dcfce7; }
.cc-hero h1 { max-width: 820px; }
.cc-sub { max-width: 600px; margin: 4px auto 30px; font-size: 19px; line-height: 1.5; color: var(--muted); }
.cc-ctas { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.cc-btn { display: inline-flex; align-items: center; gap: 9px; height: 50px; padding: 0 20px; border-radius: 14px; font-size: 15px; font-weight: 500; border: 1px solid var(--hair-2); background: #fff; color: var(--text); cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
.cc-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 24px -14px rgba(10, 10, 10, 0.4); }
.cc-btn svg { width: 19px; height: 19px; }
.cc-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.cc-btn.wa svg { color: #16a34a; }
.cc-btn.tg svg { color: #229ed9; }
.cc-fine { margin-top: 16px; font-size: 13px; color: var(--muted-2); }
.cc-proof { margin-top: 32px; }
.cc-asks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.cc-ask { padding: 20px 22px; border: 1px solid var(--hair); border-radius: 18px; background: #fff; }
.cc-ask q { display: block; font-size: 16px; line-height: 1.5; color: var(--text); quotes: "\\201C" "\\201D"; }
.cc-ask span { display: block; margin-top: 12px; font-size: 14px; line-height: 1.5; color: var(--muted); }
.cc-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.cc-step { padding: 22px; border: 1px solid var(--hair); border-radius: 18px; background: #fff; }
.cc-step b { display: block; margin-bottom: 10px; font-family: var(--font-mono, monospace); font-size: 12px; color: var(--accent); }
.cc-step h3 { margin: 0 0 8px; font-size: 17px; font-weight: 500; color: var(--text); }
.cc-step p { margin: 0; font-size: 15px; line-height: 1.55; color: var(--muted); }
.cc-dev { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.cc-dev a { display: block; padding: 20px 22px; border: 1px solid var(--hair); border-radius: 18px; background: #fff; }
.cc-dev b { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 500; color: var(--text); }
.cc-dev b svg { width: 18px; height: 18px; color: var(--accent); }
.cc-dev code { display: block; margin-top: 10px; font-family: var(--font-mono, monospace); font-size: 12.5px; color: var(--muted); word-break: break-all; }
.cc-close { text-align: center; }
.cc-close h2 { margin-bottom: 12px; }
.cc-close p { max-width: 560px; margin: 0 auto 26px; font-size: 17px; line-height: 1.55; color: var(--muted); }
.cc-fab { position: fixed; right: 20px; bottom: 20px; z-index: 60; display: inline-flex; align-items: center; gap: 8px; height: 52px; padding: 0 20px; border: 0; border-radius: 100px; background: var(--accent); color: #fff; font-size: 15px; font-weight: 500; box-shadow: 0 14px 34px -12px rgba(37, 99, 235, 0.7); cursor: pointer; }
.cc-fab svg { width: 20px; height: 20px; }
.cc-panel { position: fixed; right: 20px; bottom: 84px; z-index: 61; display: none; flex-direction: column; width: 360px; max-width: calc(100vw - 24px); height: 520px; max-height: calc(100dvh - 110px); border: 1px solid var(--hair-2); border-radius: 22px; background: #fff; box-shadow: 0 30px 70px -30px rgba(10, 10, 10, 0.45); overflow: hidden; }
.cc-panel.open { display: flex; }
.cc-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--hair); }
.cc-head img { width: 30px; height: 30px; }
.cc-head b { display: block; font-size: 14px; font-weight: 500; color: var(--text); }
.cc-head span { display: block; font-size: 12px; color: var(--muted-2); }
.cc-head button { margin-left: auto; border: 0; background: none; font-size: 22px; line-height: 1; color: var(--muted); cursor: pointer; }
.cc-log { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.cc-m { max-width: 85%; padding: 9px 12px; border-radius: 15px; font-size: 14px; line-height: 1.45; white-space: pre-wrap; word-wrap: break-word; }
.cc-m.team { background: var(--surface); border: 1px solid var(--hair); color: var(--text); border-bottom-left-radius: 5px; }
.cc-m.visitor { margin-left: auto; background: var(--accent); color: #fff; border-bottom-right-radius: 5px; }
.cc-note { font-size: 12px; color: var(--muted-2); text-align: center; }
.cc-mail { display: none; gap: 6px; padding: 10px 14px; border-top: 1px solid var(--hair); }
.cc-mail.show { display: flex; }
.cc-mail input, .cc-form textarea { flex: 1; min-width: 0; border: 1px solid var(--hair-2); border-radius: 12px; padding: 9px 11px; font: inherit; font-size: 14px; }
.cc-mail button, .cc-form button { border: 0; border-radius: 12px; padding: 0 14px; background: var(--accent); color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; }
.cc-form { display: flex; gap: 6px; padding: 12px 14px; border-top: 1px solid var(--hair); }
.cc-form textarea { resize: none; height: 44px; }
@media (max-width: 860px) {
  .cc-hero { padding: 120px 0 52px; }
  .cc-asks, .cc-dev { grid-template-columns: minmax(0, 1fr); }
  .cc-steps { grid-template-columns: minmax(0, 1fr); }
  .cc-btn { width: 100%; justify-content: center; }
  .cc-panel { right: 12px; bottom: 80px; }
}
</style>`;

function ctas(where: string): string {
  return `<div class="cc-ctas">
      <button class="cc-btn primary" type="button" data-contact="chat" data-where="${where}">${I.chat}Chat now</button>
      <a class="cc-btn wa" href="${WHATSAPP_HREF}" target="_blank" rel="noopener" data-contact="whatsapp" data-where="${where}">${I.wa}WhatsApp</a>
      <a class="cc-btn" href="${EMAIL_HREF}" data-contact="email" data-where="${where}">${I.mail}${CONTACT.email}</a>
      <a class="cc-btn tg" href="${TELEGRAM_HREF}" target="_blank" rel="noopener" data-contact="telegram" data-where="${where}">${I.tg}Telegram</a>
    </div>`;
}

/**
 * The chat widget: a thread per browser (id + secret in localStorage), a poll every 3s
 * while the panel is open and the tab visible, and an honest offline state when the
 * server has no Telegram bridge configured.
 */
const WIDGET = `<button class="cc-fab" type="button" data-contact="chat" data-where="fab">${I.chat}Chat with us</button>
<div class="cc-panel" id="cc-panel" role="dialog" aria-label="Chat with distribute.you">
  <div class="cc-head"><img src="/landing/v2/assets/logo-mark.svg" alt=""><div><b>distribute.you</b><span id="cc-status">Your AI sales assistant · online</span></div><button type="button" id="cc-close" aria-label="Close">&times;</button></div>
  <div class="cc-log" id="cc-log"><div class="cc-m team">Hi! Tell me what you sell and who you want as customers, and I will take it from there.</div></div>
  <form class="cc-mail" id="cc-mail"><input type="email" name="email" placeholder="Your email, so we can follow up" autocomplete="email"><button type="submit">Save</button></form>
  <form class="cc-form" id="cc-form"><textarea name="body" placeholder="Type your message" maxlength="2000"></textarea><button type="submit">Send</button></form>
</div>
<script>
(function () {
  var KEY = "dy_chat_thread";
  var panel = document.getElementById("cc-panel");
  var log = document.getElementById("cc-log");
  var form = document.getElementById("cc-form");
  var mail = document.getElementById("cc-mail");
  var status = document.getElementById("cc-status");
  var thread = null, lastId = 0, timer = null, offline = false;
  try { thread = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { thread = null; }
  function track(name, props) { if (window.posthog) posthog.capture(name, props || {}); }
  function line(cls, text) {
    var d = document.createElement("div");
    d.className = cls;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  function setOffline() {
    if (offline) return;
    offline = true;
    status.textContent = "Chat offline right now";
    line("cc-note", "The chat is offline. Reach us on WhatsApp, Telegram or at ${CONTACT.email} and we answer fast.");
  }
  function poll() {
    var q = thread ? "?id=" + encodeURIComponent(thread.id) + "&secret=" + encodeURIComponent(thread.secret) + "&after=" + lastId : "";
    return fetch("/api/chat/messages" + q).then(function (r) { return r.json(); }).then(function (j) {
      if (j.online === false) setOffline();
      (j.messages || []).forEach(function (m) { if (m.id > lastId) { lastId = m.id; line("cc-m " + m.sender, m.body); } });
    }).catch(function () {});
  }
  function open() {
    panel.classList.add("open");
    poll();
    if (!timer) timer = setInterval(function () { if (!document.hidden && panel.classList.contains("open")) poll(); }, 3000);
    form.body.focus();
  }
  document.getElementById("cc-close").addEventListener("click", function () { panel.classList.remove("open"); });
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-contact]") : null;
    if (!el) return;
    var channel = el.getAttribute("data-contact");
    track("contact_clicked", { channel: channel, where: el.getAttribute("data-where") });
    if (channel === "chat") { e.preventDefault(); open(); }
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var body = form.body.value.trim();
    if (!body || offline) return;
    form.body.value = "";
    fetch("/api/chat/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ thread: thread, body: body, page: location.pathname }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 503) { setOffline(); return; }
        if (!res.ok) { form.body.value = body; line("cc-note", "That message did not go through. Try again, or use WhatsApp or email."); return; }
        var first = !thread;
        thread = res.j.thread;
        localStorage.setItem(KEY, JSON.stringify(thread));
        track("chat_message_sent", { first: first });
        if (first) mail.classList.add("show");
        poll();
      }).catch(function () { form.body.value = body; line("cc-note", "That message did not go through. Try again, or use WhatsApp or email."); });
  });
  form.body.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  mail.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = mail.email.value.trim();
    if (!email || !thread) return;
    fetch("/api/chat/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ thread: thread, email: email }) })
      .then(function (r) { if (r.ok) { mail.classList.remove("show"); line("cc-note", "Saved. We will follow up at " + email + " if you leave."); track("chat_email_left", {}); } });
  });
})();
</script>`;

export type ConciergeServing = { at: "candidate" | "homepage" };

export function renderConciergePage(
  home: string = readHomepage(),
  serving: ConciergeServing = { at: "candidate" },
): string {
  const proofAndQuotes = between(home, "<!-- Proof -->", "<!-- How it works");
  const stats = between(home, "<!-- Stats band", "<!-- Fit -->");
  const faq = between(home, "<!-- FAQ", "<!-- CTA");

  const body = `${STYLE}
<section class="hero cc-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="cc-eyebrow"><i></i>AI sales assistant · answers in seconds</span>
    <h1>Your AI sales assistant.<br><span class="accent">Just message it.</span></h1>
    <p class="cc-sub">Tell it what you sell. It finds your buyers, writes to them, books the meetings and reports back, right where you already talk. No app, no setup.</p>
    ${ctas("hero")}
    <div class="cc-fine">First $30 free · It answers instantly, day and night · Stop any time</div>
    <div class="cc-proof">__HOT_LEAD_ROW__</div>
  </div>
</section>

<section class="framed tint" id="ask">
  <div class="wrap">
    <div class="section-head"><h2>Ask it like you would ask a person.</h2></div>
    <div class="cc-asks">
      <div class="cc-ask rv"><q>Here is my website. Find me clinic owners in Texas who could use it.</q><span>It reads what you sell, builds the list, writes to each of them and follows up.</span></div>
      <div class="cc-ask rv"><q>How many meetings did we book this week?</q><span>It answers with the numbers, the names and what each one cost you.</span></div>
      <div class="cc-ask rv"><q>Spend $20 a day, not $50. And pause the UK.</q><span>Done in the same conversation. No settings page to find.</span></div>
    </div>
  </div>
</section>

<section class="framed" id="how">
  <div class="wrap">
    <div class="section-head"><h2>From first message to booked meetings.</h2></div>
    <div class="cc-steps">
      <div class="cc-step rv"><b>01</b><h3>Message it</h3><p>Chat here, WhatsApp, Telegram or email. It recognises you on every channel.</p></div>
      <div class="cc-step rv"><b>02</b><h3>It sets you up</h3><p>It reads your website, asks what it needs to know and shows you who it will write to.</p></div>
      <div class="cc-step rv"><b>03</b><h3>Pay by link</h3><p>You get a secure checkout link in the conversation. Your first $30 are on us.</p></div>
      <div class="cc-step rv"><b>04</b><h3>Buyers reply</h3><p>Interested replies and meetings come to you. Ask for a report whenever you like.</p></div>
    </div>
  </div>
</section>

${proofAndQuotes}
${stats}

<section class="framed" id="developers">
  <div class="wrap">
    <div class="section-head"><h2>Rather use code? It speaks that too.</h2></div>
    <div class="cc-dev">
      <a class="rv" href="https://mcp.distribute.you/mcp" data-contact="mcp" data-where="developers"><b>${I.code}MCP</b><code>mcp.distribute.you/mcp</code></a>
      <a class="rv" href="https://api.distribute.you/docs" data-contact="api" data-where="developers"><b>${I.code}API</b><code>api.distribute.you/openapi.json</code></a>
      <a class="rv" href="/developers" data-contact="developers" data-where="developers"><b>${I.code}CLI and docs</b><code>distribute.you/developers</code></a>
    </div>
  </div>
</section>

${faq}

<section class="framed tint" id="talk">
  <div class="wrap cc-close">
    <h2>Say hi. It answers now.</h2>
    <p>From $1/day, and you only pay what your campaign spends. You get a checkout link in the conversation when you are ready.</p>
    ${ctas("close")}
  </div>
</section>
${WIDGET}`;

  const html = shell({
    title: TITLE,
    description: DESCRIPTION,
    path: serving.at === "homepage" ? "/" : CONCIERGE_PATH,
    body,
    jsonLd: [],
    noindex: serving.at === "candidate",
    noCta: true,
  });
  // The shared nav's primary button opens the app's signup; this page's pitch is that
  // there is no app, so the same button opens the chat instead.
  const navCta = `<a class="btn btn-primary" href="${SIGN_UP}">Start free</a>`;
  if (html.split(navCta).length !== 2) throw new Error("[landing] concierge: nav CTA not found exactly once");
  return html.replace(
    navCta,
    `<button class="btn btn-primary" type="button" data-contact="chat" data-where="nav">Chat now</button>`,
  );
}
