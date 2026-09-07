/* Lab landing behaviours. No dependencies. */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Nav pill morphs once the page scrolls (gojiberry). Height stays constant. */
  var nav = document.getElementById("nav");
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle("compact", window.scrollY > 60);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Reveal on scroll. */
  var revealed = document.querySelectorAll(".rv");
  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    revealed.forEach(function (el) {
      io.observe(el);
    });
  } else {
    revealed.forEach(function (el) {
      el.classList.add("in");
    });
  }

  /* Count-up on the stat numerals and the proof ROI figures. */
  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var suffix = el.querySelector("small");
    var start = null;
    var duration = 1200;
    function frame(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      var value = (target * eased).toFixed(decimals);
      el.firstChild.nodeValue = value;
      if (t < 1) requestAnimationFrame(frame);
      else el.firstChild.nodeValue = target.toFixed(decimals);
    }
    if (reduced) {
      el.firstChild.nodeValue = target.toFixed(decimals);
      return;
    }
    requestAnimationFrame(frame);
    void suffix;
  }
  var counters = document.querySelectorAll("[data-count]");
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            countUp(e.target);
            cio.unobserve(e.target);
          }
        });
      },
      { threshold: 0.4 },
    );
    counters.forEach(function (el) {
      cio.observe(el);
    });
  } else {
    counters.forEach(countUp);
  }

  /* Audience bars fill when seen. */
  var bars = document.querySelectorAll(".bar .fill");
  if ("IntersectionObserver" in window) {
    var bio = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.style.width = e.target.getAttribute("data-w") + "%";
            bio.unobserve(e.target);
          }
        });
      },
      { threshold: 0.3 },
    );
    bars.forEach(function (el) {
      bio.observe(el);
    });
  } else {
    bars.forEach(function (el) {
      el.style.width = el.getAttribute("data-w") + "%";
    });
  }

  /* Steps side nav follows the step in view. */
  var stepLinks = document.querySelectorAll("#steps-nav a");
  var steps = document.querySelectorAll(".step");
  if (stepLinks.length && "IntersectionObserver" in window) {
    var sio = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          stepLinks.forEach(function (a) {
            a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id);
          });
        });
      },
      { rootMargin: "-40% 0px -50% 0px" },
    );
    steps.forEach(function (s) {
      sio.observe(s);
    });
  }

  /* FAQ accordion (explee). One open at a time. */
  var items = document.querySelectorAll(".faq-item");
  function setOpen(item, open) {
    item.classList.toggle("open", open);
    var q = item.querySelector(".faq-q");
    var a = item.querySelector(".faq-a");
    q.setAttribute("aria-expanded", open ? "true" : "false");
    a.style.maxHeight = open ? a.scrollHeight + "px" : "0px";
  }
  items.forEach(function (item) {
    setOpen(item, item.classList.contains("open"));
    item.querySelector(".faq-q").addEventListener("click", function () {
      var willOpen = !item.classList.contains("open");
      items.forEach(function (other) {
        setOpen(other, other === item && willOpen);
      });
    });
  });

  /* Pricing calculator (explee slider window). */
  var slider = document.getElementById("calc-slider");
  var budgetEl = document.getElementById("calc-budget");
  var meetingsEl = document.getElementById("calc-meetings");
  var feeEl = document.getElementById("calc-fee");
  var COST_PER_MEETING = 600;
  var FEE_SHARE = 0.3;
  function fmt(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }
  function updateCalc() {
    if (!slider) return;
    var budget = parseInt(slider.value, 10);
    var pct = ((budget - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty("--pct", pct + "%");
    budgetEl.textContent = fmt(budget);
    var meetings = Math.max(1, Math.round(budget / COST_PER_MEETING));
    meetingsEl.textContent = "~" + meetings;
    feeEl.textContent = fmt(budget * FEE_SHARE);
  }
  if (slider) {
    slider.addEventListener("input", updateCalc);
    updateCalc();
  }

  /* Live showcase cards (explee): counters seeded from the last read of each brand's
     ongoing campaign, then nudged in-session. A tick paints the number green and floats a
     "+N" above it (lp-delta-flash). Contacted moves often, the deeper steps rarely. */
  var STATUSES = ["Sending", "Writing emails", "Reading replies", "Finding leads", "Following up"];
  var liveCards = Array.prototype.slice.call(document.querySelectorAll("[data-live]"));
  function fmtInt(n) { return n.toLocaleString("en-US"); }
  function tick() {
    if (!liveCards.length || document.hidden) return;
    var card = liveCards[Math.floor(Math.random() * liveCards.length)];
    var steps = card.getAttribute("data-steps").split(",").map(Number);
    var r = Math.random();
    var idx = r < 0.82 ? 0 : r < 0.97 ? 1 : 2;
    if (idx >= steps.length) idx = 0;
    var add = idx === 0 ? 1 + Math.floor(Math.random() * 6) : 1;
    steps[idx] += add;
    card.setAttribute("data-steps", steps.join(","));
    var el = card.querySelector('[data-n="' + idx + '"]');
    if (!el) return;
    el.textContent = fmtInt(steps[idx]);
    el.classList.add("up");
    setTimeout(function () { el.classList.remove("up"); }, 1400);
    var d = document.createElement("span");
    d.className = "delta";
    d.textContent = "+" + add;
    el.parentElement.appendChild(d);
    setTimeout(function () { d.remove(); }, 1500);
    var st = card.querySelector("[data-status]");
    if (st && Math.random() < 0.5) st.textContent = STATUSES[Math.floor(Math.random() * STATUSES.length)];
  }
  function schedule() {
    setTimeout(function () { tick(); schedule(); }, 2500 + Math.random() * 5500);
  }
  if (liveCards.length && !reduced) schedule();

  /* Hero line art (explee canvas): curves from both edges converging on the launch
     field, with dots travelling along them toward the centre. */
  var canvas = document.getElementById("hero-lines");
  if (canvas && !reduced) {
    var ctx = canvas.getContext("2d");
    var W = 0;
    var H = 0;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var curves = [];
    var dots = [];
    function resize() {
      var r = canvas.parentElement.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }
    function build() {
      curves = [];
      dots = [];
      var field = document.getElementById("hero-website");
      var cx = W / 2;
      var cy = H * 0.5;
      if (field) {
        var fr = field.getBoundingClientRect();
        var pr = canvas.parentElement.getBoundingClientRect();
        cy = fr.top - pr.top + fr.height / 2;
      }
      var n = W < 700 ? 4 : 7;
      for (var side = -1; side <= 1; side += 2) {
        for (var i = 0; i < n; i++) {
          var t = (i + 0.5) / n;
          var y0 = H * (0.08 + 0.84 * t);
          var x0 = side < 0 ? -20 : W + 20;
          var x1 = cx + side * (W < 700 ? 200 : 290);
          var c1x = side < 0 ? W * 0.28 : W * 0.72;
          var c2x = side < 0 ? cx - 380 : cx + 380;
          curves.push({ p0: [x0, y0], p1: [c1x, y0], p2: [c2x, cy], p3: [x1, cy], seed: Math.random() });
        }
      }
      curves.forEach(function (c, idx) {
        var count = idx % 2 === 0 ? 2 : 1;
        for (var k = 0; k < count; k++) dots.push({ c: c, t: Math.random(), speed: 0.0009 + Math.random() * 0.0012 });
      });
    }
    function bez(c, t) {
      var mt = 1 - t;
      var x = mt * mt * mt * c.p0[0] + 3 * mt * mt * t * c.p1[0] + 3 * mt * t * t * c.p2[0] + t * t * t * c.p3[0];
      var y = mt * mt * mt * c.p0[1] + 3 * mt * mt * t * c.p1[1] + 3 * mt * t * t * c.p2[1] + t * t * t * c.p3[1];
      return [x, y];
    }
    var last = 0;
    function draw(ts) {
      var dt = last ? Math.min(50, ts - last) : 16;
      last = ts;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      curves.forEach(function (c) {
        var g = ctx.createLinearGradient(c.p0[0], 0, c.p3[0], 0);
        var from = c.p0[0] < c.p3[0];
        g.addColorStop(0, from ? "rgba(37,99,235,0)" : "rgba(37,99,235,0.22)");
        g.addColorStop(1, from ? "rgba(37,99,235,0.22)" : "rgba(37,99,235,0)");
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(c.p0[0], c.p0[1]);
        ctx.bezierCurveTo(c.p1[0], c.p1[1], c.p2[0], c.p2[1], c.p3[0], c.p3[1]);
        ctx.stroke();
      });
      dots.forEach(function (d) {
        d.t += d.speed * dt;
        if (d.t > 1) d.t = 0;
        var p = bez(d.c, d.t);
        var a = Math.sin(d.t * Math.PI);
        ctx.fillStyle = "rgba(37,99,235," + (0.15 + 0.6 * a) + ")";
        ctx.beginPath();
        ctx.arc(p[0], p[1], 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    resize();
    window.addEventListener("resize", resize);
    requestAnimationFrame(draw);
  }
})();
