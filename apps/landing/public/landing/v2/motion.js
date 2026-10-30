/*
  The distribute.you motion kit (SITE-FOUNDATION-1029). One module of NAMED effects every
  page calls with a data attribute, never hand-rolled per page:

    <div data-motion="reveal">            fade and rise on enter (children stagger with data-motion-stagger)
    <span data-motion="count-up">$4.21    counts up to the number already printed
    <div data-motion="marquee">           children loop sideways, pause on hover
    <div data-motion="sticky-story">      pins, steps through [data-step] children (adds .is-active)
    <div data-motion="scrub">             sets --scrub 0..1 as the element crosses the viewport
    <div data-motion="orbit">             children (centred at left/top 50%) circle the centre, kept upright
    <p data-motion="typewriter">          types its own text
    <div data-motion="chat">              [data-msg] children arrive one by one after typing dots
    <div data-motion="bar-grow">          [data-bar] children grow from zero to their size
    <svg data-motion="beams">             every <path> draws, then a pulse travels along it
    <ol data-motion="lead-rows">          children drop in one by one and get .is-judged (the page's CSS flashes
                                          the verdict), then re-judges them in a loop while on screen (origami)
    <div data-motion="mail-flow">         a workflow card: steps run, the email types, Send is pressed, the step
                                          collapses, the reply is answered; next buyer (default.com)

  Rules every effect keeps:
  - The HTML is the FINAL state. A visitor who asks for reduced motion, a crawler, or a page
    whose script fails sees the finished section; motion only plays on the way there.
  - Transforms and opacity only (count-up reserves its final width first): no layout shift.
  - GSAP + ScrollTrigger (free since 2025, self-hosted under v2/vendor) load only on a page
    that carries a data-motion element, so a page without motion pays nothing.
  Ported from the clones listed in geneva-v2 .context/motion-and-pricing-refs.md (11x
  scroll-scrub, oxygen orbit + sticky story, explee chat + rolling numbers, outrank bars,
  graphed beams, oxygen marquee, origami lead rows, default workflow).
*/
(function () {
  "use strict";
  var VENDOR = "/landing/v2/vendor/";
  var FILES = ["gsap-3.15.0.min.js", "ScrollTrigger-3.15.0.min.js"];

  function load(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = VENDOR + src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("motion kit: could not load " + src)); };
      document.head.appendChild(s);
    });
  }

  function toArray(list) { return Array.prototype.slice.call(list || []); }

  /* ---------- effects: each takes (el, gsap) and returns nothing ---------- */
  var EFFECTS = {
    reveal: function (el, gsap) {
      var kids = el.hasAttribute("data-motion-stagger") ? toArray(el.children) : [el];
      gsap.from(kids, {
        opacity: 0, y: 18, duration: 0.7, ease: "power3.out", stagger: 0.08,
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
      });
    },

    "count-up": function (el, gsap) {
      var text = el.textContent;
      var m = /-?[\d,]*\.?\d+/.exec(text);
      if (!m) return;
      var end = parseFloat(m[0].replace(/,/g, ""));
      var decimals = (m[0].split(".")[1] || "").length;
      var before = text.slice(0, m.index), after = text.slice(m.index + m[0].length);
      // Pin the box to the final width (measured once the web font is in): proportional
      // digits differ in width, so the box, not the text, holds the line still. Released
      // when the final text is back.
      if (getComputedStyle(el).display === "inline") el.style.display = "inline-block";
      var state = { v: 0 };
      function draw() {
        var n = state.v.toFixed(decimals);
        el.textContent = before + Number(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + after;
      }
      var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      fonts.then(function () {
        el.style.width = el.getBoundingClientRect().width + "px";
        el.style.whiteSpace = "nowrap";
        draw();
        gsap.to(state, {
          v: end, duration: 1.4, ease: "power2.out", onUpdate: draw,
          onComplete: function () { el.textContent = text; el.style.width = ""; el.style.whiteSpace = ""; },
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        });
      });
    },

    marquee: function (el, gsap) {
      var track = document.createElement("div");
      track.style.display = "flex";
      track.style.gap = getComputedStyle(el).gap || "0px";
      track.style.width = "max-content";
      toArray(el.children).forEach(function (c) { track.appendChild(c); });
      toArray(track.children).forEach(function (c) {
        var copy = c.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        track.appendChild(copy);
      });
      el.style.overflow = "hidden";
      el.appendChild(track);
      var tween = gsap.to(track, { xPercent: -50, ease: "none", duration: Number(el.getAttribute("data-motion-speed")) || 40, repeat: -1 });
      el.addEventListener("mouseenter", function () { tween.pause(); });
      el.addEventListener("mouseleave", function () { tween.resume(); });
    },

    "sticky-story": function (el, gsap) {
      var steps = toArray(el.querySelectorAll("[data-step]"));
      if (!steps.length) return;
      steps.forEach(function (s, i) { s.classList.toggle("is-active", i === 0); });
      window.ScrollTrigger.create({
        trigger: el, start: "top top", end: "+=" + steps.length * 60 + "%", pin: true,
        onUpdate: function (self) {
          var at = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
          steps.forEach(function (s, i) { s.classList.toggle("is-active", i === at); });
        },
      });
    },

    scrub: function (el) {
      window.ScrollTrigger.create({
        trigger: el, start: "top bottom", end: "bottom top", scrub: true,
        onUpdate: function (self) { el.style.setProperty("--scrub", self.progress.toFixed(4)); },
      });
    },

    orbit: function (el, gsap) {
      var kids = toArray(el.children);
      // A page may place the children on the circle in CSS (`translate` + `--orbit-r`, the
      // final state with no script): the orbit reads that radius and takes the same
      // positions over, so nothing jumps when it starts.
      var cssRadius = parseFloat(getComputedStyle(el).getPropertyValue("--orbit-r"));
      var radius = Number(el.getAttribute("data-motion-radius")) || cssRadius || el.clientWidth / 2.6;
      kids.forEach(function (k) { k.style.translate = "none"; });
      var state = { a: 0 };
      function place() {
        kids.forEach(function (k, i) {
          var t = state.a + (i / kids.length) * Math.PI * 2;
          // Children are centred on the middle of the orbit (left/top 50%, the -50% kept here).
          gsap.set(k, { xPercent: -50, yPercent: -50, x: Math.cos(t) * radius, y: Math.sin(t) * radius });
        });
      }
      gsap.to(state, { a: Math.PI * 2, duration: Number(el.getAttribute("data-motion-speed")) || 30, ease: "none", repeat: -1, onUpdate: place });
    },

    typewriter: function (el, gsap) {
      var text = el.textContent;
      el.style.minHeight = el.getBoundingClientRect().height + "px";
      var state = { n: 0 };
      gsap.to(state, {
        n: text.length, duration: Math.min(3, text.length * 0.035), ease: "none",
        onStart: function () { el.textContent = ""; },
        onUpdate: function () { el.textContent = text.slice(0, Math.round(state.n)); },
        onComplete: function () { el.textContent = text; },
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
      });
    },

    chat: function (el, gsap) {
      var msgs = toArray(el.querySelectorAll("[data-msg]"));
      var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 80%", once: true } });
      msgs.forEach(function (m) {
        var dots = document.createElement("span");
        dots.className = "motion-dots";
        dots.setAttribute("aria-hidden", "true");
        dots.innerHTML = "<i></i><i></i><i></i>";
        m.appendChild(dots);
        tl.from(m, { opacity: 0, y: 10, duration: 0.35, ease: "power2.out" })
          .to(dots, { opacity: 1, duration: 0.01 }, "<")
          .to(dots, { opacity: 0, duration: 0.2, delay: 0.7, onComplete: function () { dots.remove(); } });
      });
    },

    "bar-grow": function (el, gsap) {
      var bars = toArray(el.querySelectorAll("[data-bar]"));
      var axis = el.getAttribute("data-motion-axis") === "x" ? "scaleX" : "scaleY";
      var from = {}; from[axis] = 0;
      gsap.from(bars, Object.assign(from, {
        transformOrigin: axis === "scaleX" ? "left center" : "center bottom",
        duration: 0.9, ease: "power3.out", stagger: 0.06,
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
      }));
    },

    beams: function (el, gsap) {
      toArray(el.querySelectorAll("path")).forEach(function (p, i) {
        var len = p.getTotalLength();
        gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, {
          strokeDashoffset: 0, duration: 1.2, delay: i * 0.12, ease: "power2.inOut",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
          onComplete: function () { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; },
        });
      });
    },

    "lead-rows": function (el, gsap) {
      var rows = toArray(el.children);
      if (!rows.length) return;
      el.classList.add("is-playing");
      function judge(r) { return function () { r.classList.add("is-judged"); }; }
      // First pass: each row drops in, then its verdict flashes.
      var current = gsap.timeline({ paused: true });
      rows.forEach(function (r, i) {
        current.fromTo(r, { opacity: 0, y: -18 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, i * 0.8);
        current.call(judge(r), null, i * 0.8 + 0.5);
      });
      // Then the rows stay and the feed re-judges them in a loop, so the panel is never empty.
      current.call(function () {
        current = gsap.timeline({ repeat: -1, repeatDelay: 2.6 });
        current.call(function () { rows.forEach(function (r) { r.classList.remove("is-judged"); }); }, null, 0);
        rows.forEach(function (r, i) { current.call(judge(r), null, 0.6 + i * 0.55); });
      }, null, "+=2.6");
      // Plays only while the feed is on screen; parks wherever it is when it leaves.
      window.ScrollTrigger.create({
        trigger: el, start: "top 85%", end: "bottom top",
        onToggle: function (self) { if (self.isActive) current.play(); else current.pause(); },
      });
    },

    "mail-flow": function (el, gsap) {
      // A workflow that writes and sends (default.com): buyer found, researched, the email is
      // typed, Send is pressed, the step collapses, the reply is answered; one buyer after
      // another from the card's own JSON. Every [data-node] carries data-status idle|active|done
      // (the page's CSS draws each), the write step opens with .is-open.
      var nodes = toArray(el.querySelectorAll("[data-node]"));
      var write = el.querySelector('[data-node="write"]');
      var typeEl = el.querySelector("[data-type]");
      var send = el.querySelector("[data-send]");
      var cursor = el.querySelector("[data-cursor]");
      var json = el.querySelector("script[data-leads]");
      var leads = [];
      try { leads = JSON.parse(json ? json.textContent : "[]"); } catch (e) { console.error("motion kit: mail-flow leads", e); }
      if (!nodes.length || !write || !typeEl || !send || !leads.length) return;
      function status(key, s) { return function () { var n = el.querySelector('[data-node="' + key + '"]'); if (n) n.setAttribute("data-status", s); }; }
      function fill(lead) {
        toArray(el.querySelectorAll("[data-field]")).forEach(function (f) {
          var v = lead[f.getAttribute("data-field")];
          if (typeof v === "string") f.textContent = v;
        });
      }
      function aim() {
        if (!cursor) return;
        var b = send.getBoundingClientRect(), c = el.getBoundingClientRect();
        gsap.fromTo(cursor, { x: b.left - c.left - 70, y: b.top - c.top + 60, opacity: 0 },
          { x: b.left - c.left + b.width * 0.55, y: b.top - c.top + b.height * 0.5, opacity: 1, duration: 0.7, ease: "power2.inOut" });
      }
      el.classList.add("is-playing");
      var i = 0, tl = null, onScreen = false;
      function cycle() {
        var lead = leads[i % leads.length];
        i += 1;
        var text = lead.body || "";
        var st = { n: 0 };
        tl = gsap.timeline({ onComplete: function () { tl = null; if (onScreen) cycle(); } });
        tl.call(function () {
          nodes.forEach(function (n) { n.setAttribute("data-status", "idle"); });
          write.classList.remove("is-open");
          fill(lead);
          typeEl.textContent = "";
        }, null, 0)
          .call(status("found", "active"), null, 0.4).call(status("found", "done"), null, 1.3)
          .call(status("research", "active"), null, 1.4).call(status("research", "done"), null, 2.3)
          .call(function () { status("write", "active")(); write.classList.add("is-open"); typeEl.classList.add("is-typing"); }, null, 2.4)
          .to(st, {
            n: text.length, duration: Math.min(2.8, text.length * 0.022), ease: "none",
            onUpdate: function () { typeEl.textContent = text.slice(0, Math.round(st.n)); },
          }, 2.9)
          .call(function () { typeEl.textContent = text; typeEl.classList.remove("is-typing"); aim(); })
          .call(function () { send.classList.add("is-pressed"); if (cursor) cursor.classList.add("is-click"); }, null, "+=0.85")
          .call(function () {
            send.classList.remove("is-pressed");
            if (cursor) { cursor.classList.remove("is-click"); gsap.to(cursor, { opacity: 0, duration: 0.3 }); }
            status("write", "done")();
            write.classList.remove("is-open");
          }, null, "+=0.3")
          .call(status("reply", "active"), null, "+=0.7")
          .call(status("reply", "done"), null, "+=1.5")
          .to({}, { duration: 2.8 });
      }
      // Plays only while the card is on screen; parks wherever it is when it leaves.
      window.ScrollTrigger.create({
        trigger: el, start: "top 85%", end: "bottom top",
        onToggle: function (self) {
          onScreen = self.isActive;
          if (!onScreen) { if (tl) tl.pause(); return; }
          if (tl) tl.play(); else cycle();
        },
      });
    },
  };

  function run() {
    var els = toArray(document.querySelectorAll("[data-motion]"));
    if (!els.length) return;
    // Reduced motion: the HTML already shows the finished state; load nothing.
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    load(FILES[0])
      .then(function () { return load(FILES[1]); })
      .then(function () {
        var gsap = window.gsap;
        gsap.registerPlugin(window.ScrollTrigger);
        var mm = gsap.matchMedia();
        // A visitor who turns reduced motion on mid-visit gets every effect reverted.
        mm.add("(prefers-reduced-motion: no-preference)", function () {
          els.forEach(function (el) {
            var name = el.getAttribute("data-motion");
            var fx = EFFECTS[name];
            if (!fx) { console.error("motion kit: no effect named", name, el); return; }
            fx(el, gsap);
          });
        });
      })
      .catch(function (e) { console.error(e); });
  }

  window.DyMotion = { effects: EFFECTS, run: run };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
