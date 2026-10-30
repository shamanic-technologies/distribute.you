/*
  The distribute.you motion kit (SITE-FOUNDATION-1029). One module of NAMED effects every
  page calls with a data attribute, never hand-rolled per page:

    <div data-motion="reveal">            fade and rise on enter (children stagger with data-motion-stagger)
    <span data-motion="count-up">$4.21    counts up to the number already printed
    <div data-motion="marquee">           children loop sideways (data-motion-axis="y": upward, data-motion-reverse),
                                          pause on hover and on a [data-motion-pause="<id>"] button
    <div data-motion="sticky-story">      steps through [data-step] children (adds .is-active) as each crosses the
                                          reading line; the page keeps scrolling, nothing pins
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
    <div data-motion="wa-thread">         a WhatsApp thread: typing bubble, their message, our ticks turn read;
                                          a quiet lead comes back, in a loop while on screen (explee)
    <section data-motion="pin-scrub">     a hero that PINS while the page scrolls under it; the scroll walks the
                                          [data-scrub-scene] through its [data-scrub-step] children (oxygen
                                          growth-scene). Sets --p 0..1, data-stage and each step's data-status.
    <div data-motion="post-reel">         [data-reel-grid] cards scroll in columns, alternate directions; the
                                          [data-reel-toggle] button pauses and shows every card (oxygen posts)
    <div data-motion="signal-thread">     a signals feed beside a WhatsApp thread: each [data-beat] arrives in order,
                                          a signal lights up and the message that answers it follows (explee, light)
    <div data-motion="signup-roll">       an odometer: each [data-roll] counter rolls its digits up by one as each
                                          [data-beat] that names it (data-adds) lands in the feed (explee rolling numbers)
    <div data-motion="traffic-beams">     a buyers-to-site map: a dot runs from a buyer down its beam to the AI judge,
                                          then to the site (a visit is listed) or to the scanners bin (graphed)

  Rules every effect keeps:
  - The HTML is the FINAL state. A visitor who asks for reduced motion, a crawler, or a page
    whose script fails sees the finished section; motion only plays on the way there.
  - Transforms and opacity only (count-up reserves its final width first): no layout shift.
  - GSAP + ScrollTrigger (free since 2025, self-hosted under v2/vendor) load only on a page
    that carries a data-motion element, so a page without motion pays nothing.
  Ported from the clones listed in geneva-v2 .context/motion-and-pricing-refs.md (11x
  scroll-scrub, oxygen growth-scene pin, oxygen orbit + sticky story, explee chat + rolling numbers, outrank bars,
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
      // data-motion-axis="y" rolls the children upward (a feed); data-motion-reverse runs the
      // other way. A <button data-motion-pause="<this element's id>"> anywhere on the page
      // pauses and resumes it (aria-pressed), so a visitor can stop a loop that never ends.
      var vertical = el.getAttribute("data-motion-axis") === "y";
      var track = document.createElement("div");
      track.style.display = "flex";
      track.style.flexDirection = vertical ? "column" : "row";
      track.style.gap = getComputedStyle(el).gap || "0px";
      if (!vertical) track.style.width = "max-content";
      toArray(el.children).forEach(function (c) { track.appendChild(c); });
      toArray(track.children).forEach(function (c) {
        var copy = c.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        track.appendChild(copy);
      });
      el.style.overflow = "hidden";
      el.appendChild(track);
      el.classList.add("is-playing");
      var to = {}, from = {};
      to[vertical ? "yPercent" : "xPercent"] = -50;
      from[vertical ? "yPercent" : "xPercent"] = 0;
      var reverse = el.hasAttribute("data-motion-reverse");
      var tween = gsap.fromTo(track, reverse ? to : from, Object.assign({}, reverse ? from : to, {
        ease: "none", duration: Number(el.getAttribute("data-motion-speed")) || 40, repeat: -1,
      }));
      var held = false;
      el.addEventListener("mouseenter", function () { tween.pause(); });
      el.addEventListener("mouseleave", function () { if (!held) tween.resume(); });
      var btn = el.id ? document.querySelector('[data-motion-pause="' + el.id + '"]') : null;
      if (btn) {
        btn.hidden = false;
        btn.addEventListener("click", function () {
          held = !held;
          btn.setAttribute("aria-pressed", String(held));
          if (held) tween.pause(); else tween.resume();
        });
      }
    },

    "sticky-story": function (el, gsap) {
      var steps = toArray(el.querySelectorAll("[data-step]"));
      if (!steps.length) return;
      function activate(at) { steps.forEach(function (s, i) { s.classList.toggle("is-active", i === at); }); }
      activate(0);
      // No pin (owner 2026-10-31: a section frozen for 2.4 screens read as "scrolling is
      // broken", worst on mobile where the scene panel is hidden). Each step lights up
      // when it reaches the reading line, and the page scrolls on under the visitor.
      // The active step is the last one whose top has passed the line, read on every update
      // (a fast wheel jumps past a whole step between two frames: a per-step toggle missed it).
      window.ScrollTrigger.create({
        trigger: el, start: "top bottom", end: "bottom top",
        onUpdate: function () {
          var line = window.innerHeight * 0.65, at = 0;
          steps.forEach(function (s, i) { if (s.getBoundingClientRect().top <= line) at = i; });
          activate(at);
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

    "wa-thread": function (el, gsap) {
      // A WhatsApp thread where a quiet lead comes back (explee agent chat): each [data-msg]
      // arrives in turn; before a message of theirs the typing bubble [data-typing] sits in its
      // slot and the header [data-presence] reads "typing", ours turn read a beat later. Every
      // message keeps its place (opacity only, no reflow). Loops while on screen, parks off it.
      var msgs = toArray(el.querySelectorAll("[data-msg]"));
      var typing = el.querySelector("[data-typing]");
      var presence = el.querySelector("[data-presence]");
      if (!msgs.length || !typing) return;
      var idle = presence ? presence.textContent : "";
      function say(t) { return function () { if (presence) presence.textContent = t; }; }
      el.classList.add("is-playing");
      var tl = null, onScreen = false;
      function cycle() {
        tl = gsap.timeline({ onComplete: function () { tl = null; if (onScreen) cycle(); } });
        tl.call(function () { msgs.forEach(function (m) { m.classList.remove("is-read"); }); say(idle)(); }, null, 0)
          .set(msgs, { opacity: 0, y: 10 }, 0)
          .set(typing, { opacity: 0 }, 0);
        msgs.forEach(function (m) {
          var from = m.getAttribute("data-msg");
          if (from === "them") {
            tl.call(function () { typing.style.top = m.offsetTop + "px"; say("typing...")(); }, null, "+=0.7")
              .to(typing, { opacity: 1, duration: 0.2 })
              .to(typing, { opacity: 0, duration: 0.15 }, "+=1.4")
              .call(say("online"))
              .to(m, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, "<");
          } else {
            tl.to(m, { opacity: 1, y: 0, duration: 0.4, ease: from === "event" ? "back.out(1.6)" : "power2.out" }, "+=0.9");
            if (from === "us") tl.call(function () { m.classList.add("is-read"); }, null, "+=0.7");
          }
        });
        tl.to({}, { duration: 3.4 }).to(msgs, { opacity: 0, duration: 0.4 });
      }
      window.ScrollTrigger.create({
        trigger: el, start: "top 85%", end: "bottom top",
        onToggle: function (self) {
          onScreen = self.isActive;
          if (!onScreen) { if (tl) tl.pause(); return; }
          if (tl) tl.play(); else cycle();
        },
      });
    },

    /*
      pin-scrub (oxygen growth-scene): the section grows a scroll track (.is-pinned, the page's
      CSS sets its height and makes its first child sticky) and the scroll position inside that
      track becomes the scene's progress. Pinned only on a screen tall and wide enough to hold
      the whole hero (oxygen's shortViewport); elsewhere the scene plays as it crosses the
      viewport, unpinned. Stage k = k steps done, step k+1 active; the last stretch of the
      track holds every step done, the final state the HTML already shows.
    */
    "pin-scrub": function (el, gsap) {
      var scene = el.querySelector("[data-scrub-scene]") || el;
      var steps = toArray(scene.querySelectorAll("[data-scrub-step]"));
      var n = steps.length;
      if (!n) return;
      function paint(p) {
        var stage = Math.min(n, Math.floor(p * (n + 1)));
        el.style.setProperty("--p", p.toFixed(4));
        scene.setAttribute("data-stage", String(stage));
        scene.style.setProperty("--s", String(Math.min(stage, n - 1)));
        steps.forEach(function (s, i) { s.setAttribute("data-status", i < stage ? "done" : i === stage ? "active" : "idle"); });
      }
      // The page names the screens that can hold its whole hero pinned (data-motion-pin).
      var pinMedia = el.getAttribute("data-motion-pin") || "(min-width: 1101px) and (min-height: 700px)";
      var mm = gsap.matchMedia();
      mm.add({ pin: pinMedia, flow: "not all and " + pinMedia }, function (ctx) {
        el.classList.toggle("is-pinned", !!ctx.conditions.pin);
        el.classList.add("is-playing");
        window.ScrollTrigger.refresh();
        var st = ctx.conditions.pin
          ? window.ScrollTrigger.create({ trigger: el, start: "top top", end: "bottom bottom", onUpdate: function (self) { paint(self.progress); } })
          : window.ScrollTrigger.create({ trigger: scene, start: "top 80%", end: "bottom 35%", onUpdate: function (self) { paint(self.progress); } });
        paint(st.progress);
        return function () { el.classList.remove("is-pinned", "is-playing"); paint(1); };
      });
    },

    "post-reel": function (el, gsap) {
      // Oxygen's community posts: the cards of [data-reel-grid] split into as many columns as the
      // grid has, each column scrolls (the middle one downward), a copy follows so the seam never
      // shows. The [data-reel-toggle] button stops the reel and puts every card back in its plain
      // grid (the finished HTML); a second press plays again. Paused on hover and off screen.
      var grid = el.querySelector("[data-reel-grid]");
      var toggle = el.querySelector("[data-reel-toggle]");
      if (!grid) return;
      var originals = toArray(grid.children);
      if (!originals.length) return;
      var paused = false, onScreen = false, hover = false, tweens = [], cols = 0, frame = 0;
      function columns() { return getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length || 1; }
      function sync() {
        tweens.forEach(function (t) { if (paused || !onScreen || hover) t.pause(); else t.play(); });
      }
      function clear() { while (grid.firstChild) grid.removeChild(grid.firstChild); }
      function render() {
        tweens.forEach(function (t) { t.kill(); });
        tweens = [];
        el.classList.toggle("is-paused", paused);
        el.classList.toggle("is-playing", !paused);
        if (toggle) {
          toggle.textContent = paused ? "Play the threads" : "Pause and show every thread";
          toggle.setAttribute("aria-pressed", paused ? "true" : "false");
        }
        grid.classList.remove("is-scrolling");
        clear();
        originals.forEach(function (c) { grid.appendChild(c); });
        if (paused) return;
        cols = columns();
        grid.classList.add("is-scrolling");
        clear();
        var reels = [];
        for (var c = 0; c < cols; c++) {
          var reel = document.createElement("div");
          reel.className = "reel-col";
          var track = document.createElement("div");
          track.className = "reel-track";
          originals.forEach(function (card, i) { if (i % cols === c) track.appendChild(card.cloneNode(true)); });
          reel.appendChild(track);
          grid.appendChild(reel);
          reels.push({ reel: reel, track: track, up: c % 2 === 0 });
        }
        reels.forEach(function (r) {
          var gap = parseFloat(getComputedStyle(r.track).rowGap) || 0;
          var first = toArray(r.track.children);
          var cycle = first.reduce(function (sum, k) { return sum + k.getBoundingClientRect().height + gap; }, 0);
          if (!cycle) return;
          for (var h = cycle; h < r.reel.clientHeight + cycle; h += cycle) {
            first.forEach(function (k) {
              var copy = k.cloneNode(true);
              copy.setAttribute("aria-hidden", "true");
              r.track.appendChild(copy);
            });
          }
          tweens.push(gsap.fromTo(r.track, { y: r.up ? 0 : -cycle }, { y: r.up ? -cycle : 0, duration: cycle / 26, ease: "none", repeat: -1 }));
        });
        sync();
      }
      if (toggle) toggle.addEventListener("click", function () { paused = !paused; render(); });
      grid.addEventListener("mouseenter", function () { hover = true; sync(); });
      grid.addEventListener("mouseleave", function () { hover = false; sync(); });
      // A keyboard visitor gets the plain grid, never a card sliding away from the focus.
      grid.addEventListener("focusin", function () { if (!paused) { paused = true; render(); } });
      window.addEventListener("resize", function () {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(function () {
          if (paused) return;
          grid.classList.remove("is-scrolling");
          var n = columns();
          grid.classList.add("is-scrolling");
          if (n !== cols) render();
        });
      });
      window.ScrollTrigger.create({
        trigger: el, start: "top bottom", end: "bottom top",
        onToggle: function (self) { onScreen = self.isActive; sync(); },
      });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
      else render();
    },

    "signal-thread": function (el, gsap) {
      // A day of signals answered (explee agent chat, light): every [data-beat] arrives in its
      // number's order. A signal row (data-kind="signal") slides in and lights up (.is-live);
      // "them" waits behind the typing bubble [data-typing] placed in its slot; "us" turns read
      // a beat later; an "event" pops. Opacity and transforms only, every element keeps its
      // place. Loops while on screen, parks off it.
      var beats = toArray(el.querySelectorAll("[data-beat]")).sort(function (a, b) {
        return Number(a.getAttribute("data-beat")) - Number(b.getAttribute("data-beat"));
      });
      var typing = el.querySelector("[data-typing]");
      var presence = el.querySelector("[data-presence]");
      if (!beats.length || !typing) return;
      var signals = beats.filter(function (b) { return b.getAttribute("data-kind") === "signal"; });
      var msgs = beats.filter(function (b) { return b.getAttribute("data-kind") !== "signal"; });
      var idle = presence ? presence.textContent : "";
      function say(t) { return function () { if (presence) presence.textContent = t; }; }
      function light(s) { return function () { signals.forEach(function (x) { x.classList.toggle("is-live", x === s); }); }; }
      el.classList.add("is-playing");
      var tl = null, onScreen = false;
      function cycle() {
        tl = gsap.timeline({ onComplete: function () { tl = null; if (onScreen) cycle(); } });
        tl.call(function () {
          msgs.forEach(function (m) { m.classList.remove("is-read"); });
          signals.forEach(function (s) { s.classList.remove("is-live"); });
          say(idle)();
        }, null, 0)
          .set(msgs, { opacity: 0, y: 10 }, 0)
          .set(signals, { opacity: 0, x: -14 }, 0)
          .set(typing, { opacity: 0 }, 0);
        beats.forEach(function (b) {
          var kind = b.getAttribute("data-kind");
          if (kind === "signal") {
            tl.call(light(b), null, "+=0.9")
              .to(b, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }, "<");
          } else if (kind === "them") {
            tl.call(function () { typing.style.top = b.offsetTop + "px"; say("typing...")(); }, null, "+=0.7")
              .to(typing, { opacity: 1, duration: 0.2 })
              .to(typing, { opacity: 0, duration: 0.15 }, "+=1.3")
              .call(say(idle))
              .to(b, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, "<");
          } else {
            tl.to(b, { opacity: 1, y: 0, duration: 0.4, ease: kind === "event" ? "back.out(1.6)" : "power2.out" }, "+=0.9");
            if (kind === "us") tl.call(function () { b.classList.add("is-read"); }, null, "+=0.6");
          }
        });
        tl.call(light(null), null, "+=0.8").to({}, { duration: 2.6 }).to(beats, { opacity: 0, duration: 0.4 });
      }
      window.ScrollTrigger.create({
        trigger: el, start: "top 85%", end: "bottom top",
        onToggle: function (self) {
          onScreen = self.isActive;
          if (!onScreen) { if (tl) tl.pause(); return; }
          if (tl) tl.play(); else cycle();
        },
      });
    },

    "signup-roll": function (el, gsap) {
      // Explee's rolling numbers, as an odometer: every [data-roll] counter is cut into digit
      // windows, each a strip 0..9 that slides (yPercent) to its digit. The [data-beat] feed rows
      // arrive in order; a row with data-adds="<key>" rolls that counter up by one and flashes it.
      // The HTML is the final state (every row shown, every counter at its printed total, which is
      // the count of rows that add to it), so the loop starts each counter that many below.
      // Transforms and opacity only. Loops while on screen, parks off it.
      var beats = toArray(el.querySelectorAll("[data-beat]"));
      var counters = {};
      toArray(el.querySelectorAll("[data-roll]")).forEach(function (c) {
        var key = c.getAttribute("data-roll");
        var end = parseInt(c.textContent.replace(/[^0-9]/g, ""), 10);
        if (isNaN(end)) return;
        var adds = beats.filter(function (b) { return b.getAttribute("data-adds") === key; }).length;
        var width = String(end).length;
        c.setAttribute("aria-label", String(end));
        c.textContent = "";
        var strips = [];
        for (var i = 0; i < width; i++) {
          var win = document.createElement("span");
          win.className = "roll-d";
          win.setAttribute("aria-hidden", "true");
          var strip = document.createElement("span");
          strip.className = "roll-s";
          for (var d = 0; d < 10; d++) {
            var digit = document.createElement("span");
            digit.textContent = String(d);
            strip.appendChild(digit);
          }
          win.appendChild(strip);
          c.appendChild(win);
          strips.push(strip);
        }
        counters[key] = { el: c, end: end, start: Math.max(0, end - adds), value: end, strips: strips, width: width };
      });
      function show(k, value, duration) {
        var digits = String(value);
        while (digits.length < k.width) digits = " " + digits;
        k.value = value;
        k.strips.forEach(function (s, i) {
          var ch = digits.charAt(i);
          // A leading blank keeps its window (no layout shift) but shows nothing.
          gsap.to(s.parentNode, { opacity: ch === " " ? 0 : 1, duration: duration ? 0.2 : 0 });
          gsap.to(s, { yPercent: ch === " " ? 0 : -10 * Number(ch), duration: duration, ease: "back.out(1.4)" });
        });
      }
      Object.keys(counters).forEach(function (key) { show(counters[key], counters[key].end, 0); });
      if (!beats.length) return;
      el.classList.add("is-playing");
      var tl = null, onScreen = false;
      function cycle() {
        tl = gsap.timeline({ onComplete: function () { tl = null; if (onScreen) cycle(); } });
        tl.call(function () {
          Object.keys(counters).forEach(function (key) { show(counters[key], counters[key].start, 0.5); });
          beats.forEach(function (b) { b.classList.remove("is-new"); });
        }, null, 0).set(beats, { opacity: 0, y: -10 }, 0);
        beats.forEach(function (b) {
          var k = counters[b.getAttribute("data-adds")];
          tl.to(b, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, "+=1.1")
            .call(function () {
              beats.forEach(function (x) { x.classList.toggle("is-new", x === b); });
              if (!k) return;
              show(k, k.value + 1, 0.7);
              k.el.classList.remove("is-bump");
              void k.el.offsetWidth;
              k.el.classList.add("is-bump");
            }, null, "<0.15");
        });
        tl.call(function () { beats.forEach(function (b) { b.classList.remove("is-new"); }); }, null, "+=1.4")
          .to({}, { duration: 2.4 })
          .to(beats, { opacity: 0, duration: 0.4, stagger: 0.03 });
      }
      window.ScrollTrigger.create({
        trigger: el, start: "top 85%", end: "bottom top",
        onToggle: function (self) {
          onScreen = self.isActive;
          if (!onScreen) { if (tl) tl.pause(); return; }
          if (tl) tl.play(); else cycle();
        },
      });
    },

    "traffic-beams": function (el, gsap) {
      // Website visits as data beams (graphed infrastructure flow + agent status pulse): a dot
      // leaves the buyer whose message was clicked, runs down its beam to the AI judge, which
      // pulses, then on to the site (the visit is listed at the top, the oldest drops off) or
      // down to the link scanners bin. The clicks come from the card's own JSON, in a loop while
      // the map is on screen. Dots move on SVG attributes; the list keeps its three rows.
      var svg = el.querySelector("svg");
      var beams = toArray(el.querySelectorAll('[data-beam="buyer"]'));
      var site = el.querySelector('[data-beam="site"]');
      var drop = el.querySelector('[data-beam="drop"]');
      var list = el.querySelector("[data-visits]");
      var judge = el.querySelector("[data-judge]");
      var bin = el.querySelector("[data-drop]");
      var chips = toArray(el.querySelectorAll("[data-buyer]"));
      var json = el.querySelector("script[data-beam-data]");
      var data = null;
      try { data = JSON.parse(json ? json.textContent : "null"); } catch (e) { console.error("motion kit: traffic-beams data", e); }
      if (!svg || !beams.length || !site || !drop || !list || !data || !data.clicks || !data.clicks.length) return;
      var NS = "http://www.w3.org/2000/svg";
      el.classList.add("is-playing");
      // The beams draw first, as the static beams effect does.
      toArray(svg.querySelectorAll("path")).forEach(function (p, i) {
        var len = p.getTotalLength();
        gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, {
          strokeDashoffset: 0, duration: 1, delay: i * 0.08, ease: "power2.inOut",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
          onComplete: function () { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; },
        });
      });
      function flash(node, cls) {
        if (!node) return;
        node.classList.remove(cls);
        void node.offsetWidth;
        node.classList.add(cls);
      }
      function travel(tl, dot, path, at, dur) {
        var len = path.getTotalLength(), st = { t: 0 };
        tl.to(st, {
          t: 1, duration: dur, ease: "power1.inOut",
          onUpdate: function () { var pt = path.getPointAtLength(st.t * len); dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y); },
        }, at);
      }
      function addVisit(buyer) {
        var li = document.createElement("li");
        li.className = "is-new";
        var b = document.createElement("b"); b.textContent = buyer.role;
        var s = document.createElement("span"); s.textContent = buyer.page;
        var m = document.createElement("em"); m.textContent = "Human";
        li.appendChild(b); li.appendChild(s); li.appendChild(m);
        list.insertBefore(li, list.firstChild);
        while (list.children.length > 3) list.removeChild(list.lastChild);
        gsap.fromTo(li, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" });
      }
      var i = 0, tl = null, onScreen = false;
      function cycle() {
        var click = data.clicks[i % data.clicks.length];
        i += 1;
        var path = beams[click.buyer % beams.length];
        var dot = document.createElementNS(NS, "circle");
        dot.setAttribute("r", "5");
        dot.setAttribute("class", "tb-dot" + (click.human ? "" : " scan"));
        svg.appendChild(dot);
        tl = gsap.timeline({ onComplete: function () { tl = null; if (onScreen) cycle(); } });
        tl.call(function () { flash(chips[click.buyer], "is-live"); }, null, 0);
        tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0);
        travel(tl, dot, path, 0, 1.1);
        tl.call(function () { flash(judge, "is-judging"); }, null, 1.1);
        travel(tl, dot, click.human ? site : drop, 1.45, 0.55);
        tl.call(function () {
          if (click.human) { addVisit(data.buyers[click.buyer]); flash(el.querySelector("[data-site]"), "is-hit"); }
          else flash(bin, "is-hit");
        }, null, 2);
        tl.to(dot, { opacity: 0, duration: 0.25, onComplete: function () { dot.remove(); } }, 2);
        tl.to({}, { duration: 0.6 });
      }
      // Plays only while the map is on screen; parks wherever it is when it leaves.
      window.ScrollTrigger.create({
        trigger: el, start: "top 85%", end: "bottom top",
        onToggle: function (self) {
          onScreen = self.isActive;
          if (!onScreen) { if (tl) tl.pause(); return; }
          if (tl) tl.play(); else gsap.delayedCall(1.2, function () { if (onScreen && !tl) cycle(); });
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
