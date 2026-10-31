/* GTM path finder (GTM-PATH-FINDER-1031): the behaviour of treg.to/search, ported.
   Every tool we run is a logo tile; the tiles fall into a pile with real physics
   (matter.js 0.20.0, self-hosted under v2/vendor, loaded only when the section nears the
   viewport), can be grabbed and thrown, and jump while the agent "reads" the paths to a
   goal. Physics values are treg's (gravity 1.1, restitution .12, friction .55, static
   friction .9, air .012, density .0016, inertia x8, speed cap 38, a tile every 10 ms).
   The served paths come from the inline JSON (#pf-data); nothing is computed here but the
   layout. Without this script the section shows its plain list of paths. */
(function () {
  "use strict";
  var root = document.querySelector("[data-path-finder]");
  if (!root) return;
  var dataEl = document.getElementById("pf-data");
  if (!dataEl) return;
  var DATA = JSON.parse(dataEl.textContent);
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var LOGO = "https://img.logo.dev/";
  var TOKEN = "?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png";
  var MATTER = "/landing/v2/vendor/matter-0.20.0.min.js";
  var CAP = 38;
  var COLORS = ["#2563eb", "#0f766e", "#4f46e5", "#b45309", "#be185d", "#0369a1", "#7c3aed", "#15803d"];

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function initials(label) {
    var w = String(label).replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    return ((w[0] || "?").charAt(0) + (w[1] || "").charAt(0)).toUpperCase();
  }
  function hue(label) {
    var h = 0;
    for (var i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
    return COLORS[h % COLORS.length];
  }
  function markHtml(t, cls) {
    var src = t.src || (t.domain ? LOGO + t.domain + TOKEN : null);
    var inner = src
      ? '<img src="' + esc(src) + '" alt="" loading="lazy">'
      : '<span class="pf-i" style="background:' + hue(t.label) + '">' + esc(initials(t.label)) + "</span>";
    return '<span class="' + (cls || "pf-mark") + '" title="' + esc(t.label) + '">' + inner + "</span>";
  }

  /* ---------- the pile (treg's class, same constants) ---------- */
  function Pile(M, onFrame) {
    this.M = M;
    this.onFrame = onFrame;
    this.engine = M.Engine.create({ enableSleeping: true, gravity: { x: 0, y: 1.1, scale: 0.001 } });
    this.bodies = new Map();
    this.walls = [];
    this.raf = 0;
    this.grip = null;
    this.held = null;
    this.width = 0;
    this.height = 0;
    this.size = 48;
  }
  Pile.prototype.bounds = function (w, h) {
    var M = this.M;
    this.width = w; this.height = h;
    M.Composite.remove(this.engine.world, this.walls);
    this.walls = [
      M.Bodies.rectangle(w / 2, h + 100, w * 3, 200, { isStatic: true }),
      M.Bodies.rectangle(-100, h / 2 - h, 200, h * 4, { isStatic: true }),
      M.Bodies.rectangle(w + 100, h / 2 - h, 200, h * 4, { isStatic: true }),
    ];
    M.Composite.add(this.engine.world, this.walls);
    this.bodies.forEach(function (b) { M.Sleeping.set(b, false); });
    this.start();
  };
  Pile.prototype.add = function (key) {
    if (this.bodies.has(key)) return;
    var M = this.M, s = this.size;
    var x = s / 2 + Math.random() * Math.max(1, this.width - s);
    var y = -s - Math.random() * this.height * 0.6;
    var b = M.Bodies.rectangle(x, y, s, s, {
      chamfer: { radius: s * 0.22 }, restitution: 0.12, friction: 0.55, frictionStatic: 0.9,
      frictionAir: 0.012, density: 0.0016, label: key,
    });
    M.Body.setInertia(b, b.inertia * 8);
    this.bodies.set(key, b);
    M.Composite.add(this.engine.world, b);
    this.start();
  };
  Pile.prototype.clear = function () {
    this.M.Composite.remove(this.engine.world, Array.from(this.bodies.values()));
    this.bodies.clear();
  };
  Pile.prototype.poke = function (keys) {
    var M = this.M, self = this;
    keys.forEach(function (k) {
      var b = self.bodies.get(k);
      if (!b) return;
      M.Sleeping.set(b, false);
      M.Body.setVelocity(b, { x: (Math.random() - 0.5) * 2.4, y: -5 - Math.random() * 3 });
      M.Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.12);
    });
    this.start();
  };
  Pile.prototype.grab = function (key, x, y) {
    var M = this.M, b = this.bodies.get(key);
    if (!b) return false;
    this.release();
    M.Sleeping.set(b, false);
    this.held = b;
    this.grip = M.Constraint.create({
      pointA: { x: x, y: y }, bodyB: b, pointB: { x: x - b.position.x, y: y - b.position.y },
      length: 0, stiffness: 0.18, damping: 0.08,
    });
    M.Composite.add(this.engine.world, this.grip);
    this.start();
    return true;
  };
  Pile.prototype.drag = function (x, y) {
    if (!this.grip || !this.held) return;
    this.grip.pointA = { x: x, y: y };
    this.M.Sleeping.set(this.held, false);
    this.start();
  };
  Pile.prototype.release = function () {
    var M = this.M;
    if (this.grip) M.Composite.remove(this.engine.world, this.grip);
    this.grip = null; this.held = null;
    this.bodies.forEach(function (b) { M.Sleeping.set(b, false); });
    this.start();
  };
  Pile.prototype.awake = function () {
    var a = false;
    this.bodies.forEach(function (b) { if (!b.isSleeping) a = true; });
    return a;
  };
  Pile.prototype.settle = function () {
    for (var i = 0; i < 600 && this.awake(); i++) this.M.Engine.update(this.engine, 1000 / 60);
    this.emit(true);
  };
  Pile.prototype.start = function () {
    if (this.raf) return;
    var self = this, M = this.M, last = 0;
    var tick = function (now) {
      M.Engine.update(self.engine, last ? Math.min(1000 / 30, Math.max(1, now - last)) : 1000 / 60);
      last = now;
      self.bodies.forEach(function (b) {
        var v = b.velocity, n = Math.hypot(v.x, v.y);
        if (n > CAP) M.Body.setVelocity(b, { x: (v.x / n) * CAP, y: (v.y / n) * CAP });
      });
      self.emit(false);
      self.raf = self.grip || self.awake() ? requestAnimationFrame(tick) : 0;
    };
    this.raf = requestAnimationFrame(tick);
  };
  Pile.prototype.emit = function (all) {
    var s = this.size, out = new Map();
    this.bodies.forEach(function (b, k) {
      if (all || !b.isSleeping) out.set(k, { x: b.position.x - s / 2, y: b.position.y - s / 2, angle: b.angle });
    });
    this.onFrame(out);
  };

  /* treg's tile size: an area share of the stage, clamped */
  function tileSize(w, h, n, share, min) {
    var a = Math.sqrt((share * h * 0.7 * w) / Math.max(1, n));
    return Math.round(Math.max(min || 22, Math.min(58, a)));
  }
  function pose(p, s) {
    var n = s / 2;
    return "translate(" + (p.x + n) + "px," + (p.y + n) + "px) rotate(" + p.angle + "rad) translate(" + -n + "px," + -n + "px)";
  }

  /* ---------- the stage ---------- */
  var els = {};
  var pile = null;
  var floorEl = root.querySelector(".pf-floor");
  var tiles = DATA.tiles;
  root.classList.add("live");

  tiles.forEach(function (t) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "pf-tile";
    b.setAttribute("aria-hidden", "true");
    b.tabIndex = -1;
    b.title = t.label;
    var src = t.src || (t.domain ? LOGO + t.domain + TOKEN : null);
    b.innerHTML = src
      ? '<img src="' + esc(src) + '" alt="" loading="lazy" draggable="false">'
      : '<span class="pf-i" style="background:' + hue(t.label) + '">' + esc(initials(t.label)) + "</span>";
    // A logo that fails to load leaves the initials, never a blank tile (treg's onError).
    var img = b.querySelector("img");
    if (img) img.onerror = function () { b.innerHTML = '<span class="pf-i" style="background:' + hue(t.label) + '">' + esc(initials(t.label)) + "</span>"; };
    b.addEventListener("pointerdown", function (e) { press(t, e); });
    root.appendChild(b);
    els[t.key] = b;
  });

  function fit(first) {
    if (!pile) return;
    var w = root.clientWidth;
    var small = w < 640;
    var est = Math.max(560, Math.min(innerHeight, 900));
    var size = small ? tileSize(w, est, tiles.length, 0.08, 15) : tileSize(w, est, tiles.length, 0.25);
    var changed = first || size !== pile.size;
    pile.size = size;
    tiles.forEach(function (t) { els[t.key].style.width = els[t.key].style.height = size + "px"; });
    floorEl.style.height = Math.round((tiles.length * size * size) / ((small ? 1.1 : 0.62) * w) + size * 0.8) + "px";
    pile.bounds(w, root.clientHeight);
    if (!changed) return;
    pile.clear();
    if (REDUCED || !first) {
      tiles.forEach(function (t) { pile.add(t.key); });
      pile.settle();
    } else {
      tiles.forEach(function (t, i) { setTimeout(function () { pile.add(t.key); }, i * 10); });
    }
  }

  function press(t, e) {
    if (e.button !== 0 || !pile) return;
    var r = root.getBoundingClientRect();
    if (!pile.grab(t.key, e.clientX - r.left, e.clientY - r.top)) return;
    e.preventDefault();
    els[t.key].classList.add("held");
    var move = function (ev) { pile.drag(ev.clientX - r.left, ev.clientY - r.top); };
    var up = function () {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      pile.release();
      setTimeout(function () { els[t.key].classList.remove("held"); }, 1500);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  }

  function boot() {
    var go = function () {
      pile = new Pile(window.Matter, function (frame) {
        frame.forEach(function (p, k) {
          var el = els[k];
          if (!el) return;
          el.style.transform = pose(p, pile.size);
          el.style.visibility = "visible";
        });
      });
      fit(true);
      var timer = 0;
      addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(function () { fit(false); }, 120); });
      if (window.ResizeObserver) {
        new ResizeObserver(function () { if (pile) pile.bounds(root.clientWidth, root.clientHeight); }).observe(root);
      }
    };
    if (window.Matter) return go();
    var s = document.createElement("script");
    s.src = MATTER;
    s.onload = go;
    s.onerror = function () { console.error("[landing] path finder: could not load " + MATTER); };
    document.head.appendChild(s);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      boot();
    }, { rootMargin: "200px 0px" });
    io.observe(root);
  } else boot();

  /* ---------- asking ---------- */
  var input = root.querySelector("#pf-q");
  var meta = root.querySelector(".pf-meta");
  var panel = root.querySelector(".pf-panel");
  var startHref = root.querySelector(".pf-in").getAttribute("action");
  var metaIdle = meta.textContent;
  var timers = [];

  function goalFor(text) {
    var t = (text || "").toLowerCase();
    var key = input.getAttribute("data-goal-default");
    var rules = [
      [/meeting|demo|call|calendar/, "meeting_booked"],
      [/sign ?up|trial|account|install|user/, "signup"],
      [/repl|interest|answer|conversation/, "conversation"],
      [/visit|traffic|website|site|seo/, "website_visit"],
      [/client|customer|paid|pay|sale|revenue|close/, "paid_client"],
      [/lead|email|contact|prospect/, "lead_found"],
    ];
    for (var i = 0; i < rules.length; i++) if (rules[i][0].test(t)) { key = rules[i][1]; break; }
    return DATA.goals.filter(function (g) { return g.key === key; })[0] || DATA.goals[0];
  }

  function tileKeysOf(goal) {
    var doms = {}, keys = {};
    goal.paths.forEach(function (p) {
      p.tools.forEach(function (t) { keys[t.key] = 1; if (t.domain) doms[t.domain] = 1; });
    });
    return tiles.filter(function (t) { return keys[t.key] || (t.domain && doms[t.domain]); }).map(function (t) { return t.key; });
  }

  function clearTimers() { timers.forEach(clearTimeout); timers.forEach(clearInterval); timers = []; }

  function reset() {
    clearTimers();
    root.classList.remove("answered");
    panel.hidden = true;
    panel.innerHTML = "";
    meta.textContent = metaIdle;
    input.value = "";
    Object.keys(els).forEach(function (k) { els[k].classList.remove("read", "scan", "dim"); });
  }

  function cardHtml(p, best, plural) {
    var tools = p.tools.length
      ? '<span class="pf-tools">' + p.tools.map(function (t) { return markHtml(t); }).join("") + "</span>"
      : '<span class="pf-m">' + esc(p.who) + "</span>";
    var cost = p.expected
      ? '<span class="pf-m"><b>' + esc(p.expected) + "</b> per " + esc(p.to.toLowerCase()) + "</span>"
      : '<span class="pf-m">learning</span>';
    var lead = p.tools[0] || { label: p.name, domain: null };
    return (
      '<article class="pf-card' + (best ? " best" : "") + '">' +
      "<header>" + markHtml(lead) +
      '<span class="pf-plat"><span class="pf-vendor">' + esc(p.name) + "</span><small>" + esc(p.who) + "</small></span>" +
      (best ? '<span class="pf-fit">best path ✓</span>' : "") +
      '</header><p class="pf-route">' + p.route.map(esc).join(' <i>→</i> ') + "</p>" +
      (p.routes > 1 ? '<p class="pf-more">+ ' + (p.routes - 1) + " other route" + (p.routes > 2 ? "s" : "") + "</p>" : "") +
      "<ul>" +
      "<li><span>Tools</span>" + tools + "</li>" +
      "<li><span>Expected cost</span>" + cost + "</li>" +
      (p.roi ? '<li><span>Expected return</span><span class="pf-m"><b>' + esc(p.roi) + "</b> per $1 spent</span></li>" : "") +
      "</ul></article>"
    );
  }

  function answer(goal) {
    var shown = goal.paths.slice(0, 9);
    var best = shown[0] && shown[0].expected ? 0 : -1;
    panel.innerHTML =
      '<div class="pf-panel-h"><span><b>' + goal.paths.length + " paths</b> to " + esc(goal.plural) +
      (best === 0 ? ", cheapest expected first" : "") + '</span><span class="pf-actions">' +
      '<button class="pf-again" type="button">Try another goal</button>' +
      '<a class="pf-start" href="' + esc(startHref) + "?goal=" + encodeURIComponent(goal.key) + '">Run my best path</a></span></div>' +
      '<div class="pf-cards">' + shown.map(function (p, i) { return cardHtml(p, i === best, goal.plural); }).join("") + "</div>" +
      (goal.paths.length > shown.length ? '<p class="pf-more">+ ' + (goal.paths.length - shown.length) + " more paths our agent compares</p>" : "");
    panel.querySelector(".pf-again").addEventListener("click", function () { reset(); input.focus(); });
    root.classList.add("answered");
    panel.hidden = false;
    meta.textContent = "Our agent picks the best path for you, then runs it with our best templates.";
  }

  function ask(goal) {
    clearTimers();
    var lit = tileKeysOf(goal);
    var litSet = {};
    lit.forEach(function (k) { litSet[k] = 1; });
    Object.keys(els).forEach(function (k) {
      els[k].classList.toggle("read", !!litSet[k]);
      els[k].classList.toggle("dim", !litSet[k]);
      els[k].classList.remove("scan");
    });
    meta.textContent = "Reading " + goal.paths.length + " paths and " + lit.length + " tools…";
    if (REDUCED || !pile) return answer(goal);
    timers.push(setInterval(function () {
      pile.poke(lit.filter(function () { return Math.random() < 0.35; }).slice(0, 5));
    }, 420));
    var i = -1, scanned = null;
    timers.push(setInterval(function () {
      if (scanned) scanned.classList.remove("scan");
      if (!lit.length) return;
      scanned = els[lit[(i = (i + 1) % lit.length)]];
      scanned.classList.add("scan");
    }, 120));
    timers.push(setTimeout(function () {
      clearTimers();
      if (scanned) scanned.classList.remove("scan");
      answer(goal);
    }, 1600));
  }

  root.querySelectorAll(".pf-chip").forEach(function (c) {
    c.addEventListener("click", function () {
      var g = DATA.goals.filter(function (x) { return x.key === c.getAttribute("data-goal"); })[0];
      if (!g) return;
      input.value = g.chip;
      ask(g);
    });
  });
  root.querySelector(".pf-in").addEventListener("submit", function (e) {
    e.preventDefault();
    var g = goalFor(input.value);
    if (!input.value) input.value = g.chip;
    ask(g);
  });

  /* the placeholder types itself out, one goal after another (treg's typed hint) */
  if (!REDUCED) {
    var chips = DATA.goals.map(function (g) { return g.chip; });
    var gi = 0, ci = 0, typing = true;
    var typer = setInterval(function () {
      if (document.activeElement === input || input.value) return;
      var full = chips[gi];
      if (typing) {
        ci++;
        input.setAttribute("placeholder", full.slice(0, ci));
        if (ci >= full.length) { typing = false; ci = full.length + 30; }
      } else if (--ci <= full.length) {
        if (ci <= 0) { gi = (gi + 1) % chips.length; typing = true; ci = 0; }
        else input.setAttribute("placeholder", full.slice(0, ci));
      }
    }, 45);
    if (!chips.length) clearInterval(typer);
  }
})();
