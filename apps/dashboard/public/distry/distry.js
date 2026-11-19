/*
 * The motion of Distry's world. The HTML is the finished page; this only adds movement,
 * and `html.js` (set in the head) is absent under reduced motion, so nothing here runs
 * for a visitor who asked for stillness.
 */
/*
 * A page hydrated by React (blog, docs, legal) throws away any markup added to its HTML,
 * so the server adds nothing to its body: it hands the pieces over in `window.__distry`
 * and `dress()` puts them in once the page has settled.
 */
function dress(cfg) {
  const body = document.body;
  // The site's mark becomes Distry's (the page's own images are swapped, not re-rendered).
  document.querySelectorAll('img[src*="logo-mark"]').forEach((img) => {
    img.removeAttribute("srcset");
    img.src = cfg.logo;
  });
  body.insertAdjacentHTML("afterbegin", cfg.sky);
  body.insertAdjacentHTML("beforeend", cfg.buddy);
  const sections = Array.from(document.querySelectorAll("section"));
  const said = { night: 0, dawn: 0, day: 0 };
  sections.forEach((el, i) => {
    const sky = i === 0 ? 0 : 1;
    const hour = sky === 0 ? "night" : "day";
    const lines = cfg.lines[hour];
    el.classList.add(`d-${hour}`);
    el.dataset.sky = sky.toFixed(2);
    el.dataset.say = lines[Math.min(said[hour], lines.length - 1)];
    said[hour] += 1;
  });
  const footer = document.querySelector("footer");
  if (footer && !footer.dataset.sky) {
    footer.dataset.sky = "1";
    footer.dataset.say = cfg.lines.day[cfg.lines.day.length - 1];
  }
  if (footer) footer.insertAdjacentHTML("beforebegin", `<div class="d-frame-band">${cfg.frame}</div>`);
  // A client-side page change would swap the content and drop all of the above: every
  // link on a dressed page is a full page load.
  document.addEventListener("click", (event) => {
    const link = event.target.closest && event.target.closest("a[href]");
    if (!link || link.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const url = new URL(link.href, location.href);
    if (url.hostname === "distribute.you") url.host = location.host;
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    event.preventDefault();
    event.stopPropagation();
    location.href = url.href;
  }, true);
}

function start() {
  const root = document.documentElement;
  if (!root.classList.contains("js")) return;

  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

  /* ---- the load-in ---- */
  const hero = document.querySelector(".hero");
  if (hero) {
    $$("[data-rise]", hero).forEach((el, i) => el.style.setProperty("--i", i));
    requestAnimationFrame(() => hero.classList.add("is-ready"));
  }

  /* ---- the sky follows the scroll: night (0) to dawn (0.5) to day (1) ---- */
  const skySections = $$("[data-sky]").map((el) => ({ el, sky: Number(el.dataset.sky) }));
  const nav = document.getElementById("nav") || document.querySelector(".nav") || document.querySelector("header");
  let skyT = 0;

  function readSky() {
    if (skySections.length === 0) return 0;
    const mid = window.innerHeight / 2;
    let before = skySections[0];
    let after = skySections[skySections.length - 1];
    let beforeY = -Infinity;
    let afterY = Infinity;
    for (const s of skySections) {
      const r = s.el.getBoundingClientRect();
      const y = r.top + Math.min(r.height, window.innerHeight) / 2;
      if (y <= mid && y > beforeY) { before = s; beforeY = y; }
      if (y > mid && y < afterY) { after = s; afterY = y; }
    }
    if (beforeY === -Infinity) return after.sky;
    if (afterY === Infinity) return before.sky;
    return lerp(before.sky, after.sky, clamp((mid - beforeY) / (afterY - beforeY)));
  }

  function paintSky() {
    skyT = readSky();
    const s = root.style;
    s.setProperty("--t", skyT.toFixed(3));
    s.setProperty("--dawn", clamp(skyT * 2.4).toFixed(3));
    s.setProperty("--day", clamp((skyT - 0.55) * 2.6).toFixed(3));
    s.setProperty("--stars", clamp(1 - skyT * 2.2).toFixed(3));
    s.setProperty("--moon", clamp(1 - skyT * 1.8).toFixed(3));
    if (nav) nav.classList.toggle("is-day", skyT > 0.74);
    document.body.classList.toggle("d-is-day", skyT > 0.74);
  }

  /* ---- parallax: each scene drifts slower than the page ---- */
  const scenes = $$("[data-parallax]").map((el) => ({ el, img: el.querySelector("img") }));
  function paintScenes() {
    const vh = window.innerHeight;
    for (const { el, img } of scenes) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      const p = clamp((vh - r.top) / (vh + r.height)); // 0 entering, 1 leaving
      img.style.setProperty("--py", `${((p - 0.5) * r.height * 0.16).toFixed(1)}px`);
      img.style.setProperty("--ps", (1.04 + p * 0.05).toFixed(3));
    }
  }

  /* ---- the dotted trail between the three steps draws itself ---- */
  const steps = document.getElementById("steps");
  function paintTrail() {
    if (!steps) return;
    const r = steps.getBoundingClientRect();
    steps.style.setProperty("--trail", clamp((window.innerHeight * 0.85 - r.top) / (r.height * 0.9)).toFixed(3));
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      paintSky();
      paintScenes();
      paintTrail();
      ticking = false;
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* ---- stars ---- */
  const starCanvas = document.getElementById("stars");
  const starCtx = starCanvas.getContext("2d");
  let stars = [];
  function sizeStars() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    starCanvas.width = innerWidth * dpr;
    starCanvas.height = innerHeight * dpr;
    starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((innerWidth * innerHeight) / 5200);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight * 0.92,
      r: Math.random() * 1.2 + 0.25,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.4,
    }));
  }
  function drawStars(time) {
    starCtx.clearRect(0, 0, innerWidth, innerHeight);
    for (const st of stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(st.phase + time * 0.001 * st.speed));
      starCtx.globalAlpha = a;
      starCtx.fillStyle = "#fdf8ec";
      starCtx.beginPath();
      starCtx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      starCtx.fill();
    }
    starCtx.globalAlpha = 1;
  }

  /* ---- fireflies: the messages Distry sends, drifting toward the pointer ---- */
  const flyCanvas = document.getElementById("fireflies");
  const flyCtx = flyCanvas.getContext("2d");
  const pointer = { x: -9999, y: -9999 };
  let flies = [];
  function sizeFlies() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    flyCanvas.width = innerWidth * dpr;
    flyCanvas.height = innerHeight * dpr;
    flyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = clamp(Math.round(innerWidth / 100), 5, 15);
    flies = Array.from({ length: count }, () => newFly(true));
  }
  function newFly(anywhere) {
    return {
      x: anywhere ? Math.random() * innerWidth : innerWidth + 20,
      y: Math.random() * innerHeight,
      vx: -(0.18 + Math.random() * 0.5),
      vy: (Math.random() - 0.5) * 0.3,
      size: 2 + Math.random() * 3.4,
      letter: Math.random() < 0.38,
      phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.6,
    };
  }
  function drawFlies(time) {
    flyCtx.clearRect(0, 0, innerWidth, innerHeight);
    // Gold fireflies at night; by day they turn into soft white-blue motes and thin out.
    const day = clamp((skyT - 0.55) * 2.4);
    const alphaBase = lerp(0.9, 0, day);
    if (alphaBase < 0.02) return;
    const rgb = day > 0.5 ? "255,255,255" : "246,198,103";
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i];
      const dx = pointer.x - f.x;
      const dy = pointer.y - f.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 220 && dist > 1) {
        f.vx += (dx / dist) * 0.012;
        f.vy += (dy / dist) * 0.012;
      }
      f.vx = lerp(f.vx, -(0.18 + (i % 5) * 0.09), 0.012);
      f.vy = lerp(f.vy, Math.sin(time * 0.0006 + f.phase) * 0.22, 0.02);
      f.x += f.vx;
      f.y += f.vy;
      if (f.x < -30 || f.y < -40 || f.y > innerHeight + 40) flies[i] = newFly(false);

      const pulse = 0.6 + 0.4 * Math.sin(time * 0.002 + f.phase);
      const alpha = alphaBase * pulse;
      const glow = flyCtx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * 5);
      glow.addColorStop(0, `rgba(${rgb},${(alpha * 0.55).toFixed(3)})`);
      glow.addColorStop(1, `rgba(${rgb},0)`);
      flyCtx.fillStyle = glow;
      flyCtx.beginPath();
      flyCtx.arc(f.x, f.y, f.size * 5, 0, Math.PI * 2);
      flyCtx.fill();

      flyCtx.save();
      flyCtx.translate(f.x, f.y);
      flyCtx.rotate(Math.sin(time * 0.001 + f.phase) * f.spin);
      flyCtx.globalAlpha = alpha;
      if (f.letter) {
        const w = f.size * 3.2;
        const h = f.size * 2.2;
        flyCtx.fillStyle = day > 0.5 ? "#ffffff" : "#ffe9b0";
        flyCtx.fillRect(-w / 2, -h / 2, w, h);
        flyCtx.strokeStyle = day > 0.5 ? "#2563eb" : "#b9801f";
        flyCtx.lineWidth = 0.8;
        flyCtx.beginPath();
        flyCtx.moveTo(-w / 2, -h / 2);
        flyCtx.lineTo(0, h * 0.12);
        flyCtx.lineTo(w / 2, -h / 2);
        flyCtx.stroke();
      } else {
        flyCtx.fillStyle = day > 0.5 ? "#ffffff" : "#fff3cf";
        flyCtx.beginPath();
        flyCtx.arc(0, 0, f.size * 0.6, 0, Math.PI * 2);
        flyCtx.fill();
      }
      flyCtx.restore();
    }
  }
  addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  addEventListener("pointerleave", () => { pointer.x = pointer.y = -9999; });

  sizeStars();
  sizeFlies();
  addEventListener("resize", () => { sizeStars(); sizeFlies(); });
  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(frame);
  });
  function frame(time) {
    if (!running) return;
    if (skyT < 0.46) drawStars(time);
    drawFlies(time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---- things light up as the visitor reaches them ---- */
  function playMessages(box, gap) {
    $$(".msg", box).forEach((msg, i) => setTimeout(() => msg.classList.add("is-on"), 350 + i * gap));
  }
  function playCalendar(box) {
    $$("i", box).forEach((ev) => setTimeout(() => ev.classList.add("is-on"), Number(ev.dataset.s) * 520));
  }
  function playCount(el) {
    const target = Number(el.dataset.count);
    const start = performance.now();
    (function tick(now) {
      const p = clamp((now - start) / 1400);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }
  function playTyped(el) {
    const text = el.textContent;
    const shown = document.createElement("span");
    const hidden = document.createElement("span");
    hidden.style.opacity = "0";
    hidden.textContent = text;
    el.textContent = "";
    el.append(shown, hidden);
    let n = 0;
    (function type() {
      n = Math.min(text.length, n + 3);
      shown.textContent = text.slice(0, n);
      hidden.textContent = text.slice(n);
      if (n < text.length) setTimeout(type, 16);
    })();
  }

  const lit = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      lit.unobserve(el);
      const order = Math.min(Array.from(el.parentElement.children).indexOf(el), 5);
      setTimeout(() => {
        el.classList.add("is-lit");
        const thread = el.querySelector("[data-thread]");
        if (thread) playMessages(thread, 900);
        const cal = el.querySelector("[data-cal]");
        if (cal) playCalendar(cal);
        const count = el.querySelector("[data-count]");
        if (count) playCount(count);
        const typed = el.querySelector("[data-typed]");
        if (typed) playTyped(typed);
      }, order * 160);
    }
  }, { threshold: 0.22, rootMargin: "0px 0px -6% 0px" });
  // On a skinned live page the cards are the live site's own: they join the lamps here.
  if (root.classList.contains("distry")) {
    $$(".feature, .step, .plan, .proof-card, .show-card, .cmp-card, .fit-card, .stack-card, .panel, .stat, .best-item").forEach((el) => el.setAttribute("data-lit", ""));
  }
  $$("[data-lit]").forEach((el) => lit.observe(el));

  const chat = document.querySelector("[data-chat]");
  if (chat) new IntersectionObserver((entries, self) => {
    if (!entries[0].isIntersecting) return;
    self.disconnect();
    playMessages(chat, 1100);
  }, { threshold: 0.45 }).observe(chat);

  /* ---- quotes: the track is doubled so the loop has no seam ---- */
  const track = document.querySelector(".marquee-track[data-double]");
  if (track) track.append(...Array.from(track.children).map((node) => {
    const copy = node.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    return copy;
  }));

  /* ---- Distry walks beside the visitor and says one line per scene ---- */
  const buddy = document.getElementById("buddy");
  const say = document.getElementById("buddy-say");
  let saying = "";
  function speak(line) {
    if (line === saying) return;
    saying = line;
    say.classList.remove("is-on");
    setTimeout(() => {
      say.textContent = line;
      say.classList.add("is-on");
    }, 260);
  }
  const talk = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) speak(entry.target.dataset.say);
  }, { rootMargin: "-45% 0px -45% 0px" });
  // Sober: Distry greets once and then stays quiet beside the visitor.
  void talk;
  setTimeout(() => say.classList.remove("is-on"), 9000);
  const firstLine = document.querySelector("[data-say]");
  if (firstLine) setTimeout(() => speak(firstLine.dataset.say), 1800);

  function sparks(x, y, count) {
    for (let i = 0; i < count; i++) {
      const sp = document.createElement("i");
      sp.className = "spark";
      sp.style.left = `${x}px`;
      sp.style.top = `${y}px`;
      sp.style.setProperty("--dx", `${(Math.random() - 0.5) * 150}px`);
      sp.style.setProperty("--dy", `${-50 - Math.random() * 120}px`);
      sp.style.setProperty("--dr", `${(Math.random() - 0.5) * 240}deg`);
      sp.style.animationDelay = `${i * 45}ms`;
      document.body.append(sp);
      setTimeout(() => sp.remove(), 1400 + i * 45);
    }
  }
  $$(".btn").forEach((btn) => {
    btn.addEventListener("pointerenter", () => {
      buddy.classList.add("is-excited");
      const face = buddy.querySelector(".buddy-face").getBoundingClientRect();
      sparks(face.left + face.width / 2, face.top, 6);
      const r = btn.getBoundingClientRect();
      sparks(r.left + r.width / 2, r.top, 5);
    });
    btn.addEventListener("pointerleave", () => buddy.classList.remove("is-excited"));
  });

  /* ---- copy the one command ---- */
  $$("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(document.querySelector(button.dataset.copy).textContent);
      button.textContent = "Copied";
      setTimeout(() => { button.textContent = "Copy"; }, 1600);
    });
  });

  /* ---- the hero comes alive: a short film over the still, on screens that can carry it ---- */
  const video = document.getElementById("hero-video");
  const saveData = navigator.connection && navigator.connection.saveData;
  if (video && innerWidth >= 760 && !saveData) {
    addEventListener("load", () => {
      video.src = video.dataset.src;
      video.addEventListener("canplaythrough", () => {
        video.play().then(() => video.classList.add("is-on")).catch(() => {});
      }, { once: true });
      // The film does not loop cleanly, so it fades to the still, rewinds and fades back in.
      video.addEventListener("timeupdate", () => {
        if (video.duration && video.currentTime > video.duration - 0.9) video.classList.remove("is-on");
      });
      video.addEventListener("ended", () => {
        video.currentTime = 0;
        video.play().then(() => video.classList.add("is-on")).catch(() => {});
      });
      video.load();
    });
  }
}

/*
 * The chat: a click on Distry opens a conversation in the page with the same assistant
 * as on WhatsApp and email (the site only carries the messages). A visitor can go all the
 * way here: their plan, their account (an email code typed in the chat), the payment link,
 * the launch. The transcript is kept in this browser so a reload shows it again; the
 * conversation itself lives server-side. When the chat cannot answer, the visitor is
 * offered the WhatsApp conversation instead.
 */
function setupChat() {
  const face = document.querySelector("a.buddy-face");
  if (!face) return;
  const STORE = "distry_chat_v1";
  const ACCOUNT = "distry_chat_account";
  const whatsapp = face.href;
  let panel = null;
  let log = [];
  try { log = JSON.parse(localStorage.getItem(STORE) || "[]"); } catch (e) { log = []; }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(log.slice(-60))); } catch (e) { /* private mode */ } };
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));

  function bubble(list, who, text) {
    const p = document.createElement("p");
    p.className = `dc-msg dc-${who}`;
    // Plain text only; URLs become links.
    String(text).split(/(https?:\/\/[^\s]+)/g).forEach((part, i) => {
      if (i % 2 === 1) {
        const link = document.createElement("a");
        link.href = part; link.textContent = part; link.target = "_blank"; link.rel = "noopener noreferrer";
        p.append(link);
      } else if (part) p.append(document.createTextNode(part));
    });
    list.append(p);
    list.scrollTop = list.scrollHeight;
    return p;
  }

  function openChat() {
    if (panel) { panel.hidden = false; panel.querySelector("input").focus(); return; }
    // A div, not a section: the page's own section rules must not reach the panel.
    panel = document.createElement("div");
    panel.className = "dc";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Chat with Distry");
    panel.innerHTML = `<header class="dc-top"><img src="${face.querySelector("img").src}" alt="" width="36" height="36"><div><b>Distry</b><small>distribute.you assistant</small></div><button type="button" class="dc-close" aria-label="Close the chat">×</button></header><div class="dc-list" aria-live="polite"></div><form class="dc-form"><input type="text" name="text" autocomplete="off" maxlength="2000" placeholder="Ask Distry anything" aria-label="Your message"><button type="submit">Send</button></form><a class="dc-wa" href="${whatsapp}" target="_blank" rel="noopener noreferrer">Continue on WhatsApp</a>`;
    document.body.append(panel);
    const list = panel.querySelector(".dc-list");
    const form = panel.querySelector("form");
    const input = form.querySelector("input");
    const who = panel.querySelector(".dc-top small");
    // Their own email, once they proved it in the chat: the conversation acts with their account.
    const showAccount = (email) => { who.textContent = email ? `Signed in as ${email}` : "distribute.you assistant"; };
    try { showAccount(localStorage.getItem(ACCOUNT)); } catch (e) { /* private mode */ }
    bubble(list, "them", "Hi, I'm Distry. Share your website and I will build your plan right here.");
    log.forEach((m) => bubble(list, m.who, m.text));
    panel.querySelector(".dc-close").addEventListener("click", () => { panel.hidden = true; });
    panel.addEventListener("keydown", (e) => { if (e.key === "Escape") panel.hidden = true; });

    // The answers the assistant offers, as buttons under its message: a click sends the label.
    function offer(choices) {
      const box = document.createElement("div");
      box.className = "dc-choices";
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", choices.question || "Your answer");
      choices.choices.forEach((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = choice.label;
        if (choice.description) {
          const more = document.createElement("small");
          more.textContent = choice.description;
          button.append(more);
        }
        button.addEventListener("click", () => send(choice.label));
        box.append(button);
      });
      list.append(box);
      list.scrollTop = list.scrollHeight;
    }

    // One message, asked again with the same id while a long turn is still running.
    async function ask(messageId, text) {
      let failures = 0;
      for (let tries = 0; tries < 100; tries++) {
        let answer = null;
        try {
          const res = await fetch("/api/chat/distry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageId, text }) });
          if (res.ok) answer = await res.json();
        } catch (e) { answer = null; }
        if (!answer || answer.status === "in_progress") {
          if (!answer && ++failures > 2) return null;
          await wait(3000);
          continue;
        }
        return answer;
      }
      return null;
    }

    async function send(text) {
      if (!text || form.dataset.busy) return;
      form.dataset.busy = "1";
      list.querySelectorAll(".dc-choices").forEach((box) => box.remove());
      bubble(list, "me", text);
      log.push({ who: "me", text }); save();
      const typing = bubble(list, "them", "…");
      typing.classList.add("dc-typing");
      const messageId = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      const answer = await ask(messageId, text);
      typing.remove();
      delete form.dataset.busy;
      const answered = Boolean(answer && answer.reply);
      const reply = answered
        ? answer.reply
        : answer && answer.status === "busy"
          ? "I am answering a lot of people right now. Send it again in a minute, or continue on WhatsApp below."
          : "I could not answer just now. Send it again, or continue on WhatsApp below.";
      bubble(list, "them", reply);
      if (answered) { log.push({ who: "them", text: reply }); save(); }
      if (answer && answer.choices) {
        if (answer.choices.question && answer.choices.question !== reply) bubble(list, "them", answer.choices.question);
        offer(answer.choices);
      }
      if (answer && answer.account) {
        const email = answer.account.signedIn ? answer.account.email : null;
        showAccount(email);
        try { if (email) localStorage.setItem(ACCOUNT, email); else localStorage.removeItem(ACCOUNT); } catch (e) { /* private mode */ }
      }
      panel.classList.toggle("dc-ask", !answered);
      input.focus();
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || form.dataset.busy) return;
      input.value = "";
      send(text);
    });
    input.focus();
  }

  face.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    openChat();
  });
}

if (window.__distry && window.__distry.late) {
  const late = () => setTimeout(() => { dress(window.__distry); start(); setupChat(); }, 700);
  if (document.readyState === "complete") late();
  else addEventListener("load", late);
} else {
  start();
  setupChat();
}
