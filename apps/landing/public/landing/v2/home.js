/*
  The homepage's own motion (index-v2.html only). Loaded after motion.js.

  1. Hero: the orbit and the WhatsApp thread play TOGETHER. When a message lands, the tools
     it used (`data-tools` on the row, `data-tool` on the orbit logo) light up and a line
     runs from each tool to the thread. The thread replays while the hero is on screen.
  2. "Why one agent" (treg.to's benefits, copied): the vendor comparison, the seat ledger
     and the 0% equation, each played when it scrolls in and stopped when it leaves.

  The markup is the final state; reduced motion leaves it as it is.
*/
(function () {
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var bens = document.querySelector(".bens");

  function loop(el, threshold, play, reset) {
    var timers = [], playing = false, visible = false;
    function T(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function stop() { timers.forEach(clearTimeout); timers = []; playing = false; }
    function run() {
      if (!visible) { playing = false; return; }
      playing = true; stop(); playing = true; reset();
      var total = play(T);
      T(run, total);
    }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        visible = e.isIntersecting;
        if (visible && !playing) run();
        if (!visible) stop();
      });
    }, { threshold: threshold }).observe(el);
  }

  /* ---------- 1. hero: the thread calls the tools ---------- */
  (function () {
    var stage = document.querySelector(".agent-stage");
    var body = stage && stage.querySelector(".wa-body");
    if (!stage || !body || REDUCED) return;
    var wa = stage.querySelector(".wa");
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "orbit-beams");
    svg.setAttribute("aria-hidden", "true");
    stage.appendChild(svg);
    var rows = [].slice.call(body.querySelectorAll(".wa-row"));
    var THREAD_MS = 9800;

    function beam(logo) {
      var s = stage.getBoundingClientRect(), l = logo.getBoundingClientRect(), w = wa.getBoundingClientRect();
      var x1 = l.left + l.width / 2 - s.left, y1 = l.top + l.height / 2 - s.top;
      // End on the thread's edge nearest the tool, not its centre (the line never crosses the chat).
      var x2 = Math.min(Math.max(x1, w.left - s.left), w.right - s.left);
      var y2 = Math.min(Math.max(y1, w.top - s.top + 40), w.bottom - s.top - 20);
      var line = document.createElementNS(NS, "line");
      line.setAttribute("x1", x1); line.setAttribute("y1", y1);
      line.setAttribute("x2", x2); line.setAttribute("y2", y2);
      svg.appendChild(line);
      requestAnimationFrame(function () { line.classList.add("on"); });
      setTimeout(function () { line.remove(); }, 1500);
    }
    function hit(tool) {
      var logo = stage.querySelector('.orbit-logo[data-tool="' + tool + '"]');
      if (!logo) return;
      logo.classList.remove("hit"); void logo.offsetWidth; logo.classList.add("hit");
      beam(logo);
    }

    loop(stage, 0.3, function (T) {
      rows.forEach(function (row) {
        var t = parseFloat(row.style.getPropertyValue("--t")) * 1000;
        var tools = (row.getAttribute("data-tools") || "").split(/\s+/).filter(Boolean);
        // The tools fire while the agent is typing, the answer lands right after.
        tools.forEach(function (tool, i) { T(function () { hit(tool); }, Math.max(0, t - 700 + i * 220)); });
        if (tools.length) T(function () { wa.classList.remove("got"); void wa.offsetWidth; wa.classList.add("got"); }, t);
      });
      return THREAD_MS;
    }, function () {
      // Restart the CSS thread: drop `play`, reflow, put it back.
      body.classList.remove("play"); void body.offsetWidth; body.classList.add("play");
    });
  })();

  if (!bens) return;
  bens.classList.add("js");

  /* ---------- 2a. compare the vendors: ask, rows pop, scan, the cheapest wins ---------- */
  (function () {
    var cap = document.getElementById("cap");
    var dataEl = document.getElementById("cap-data");
    if (!cap || !dataEl) return;
    var scenarios = [];
    try { scenarios = JSON.parse(dataEl.textContent || "[]"); } catch (e) { console.error("[landing] cap-data unreadable", e); }
    // The catalog read failed at render: the server already put the catalog line in the window.
    if (!scenarios.length) return;
    var q = document.getElementById("capq"), caret = document.getElementById("capcaret");
    var head = cap.querySelector(".cap-h"), list = document.getElementById("caprows");
    var wf = document.getElementById("capwf");
    var LOGO = "https://img.logo.dev/";
    var TOKEN = "?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png";
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    var sc = 0;
    function load(i) {
      var S = scenarios[i];
      document.getElementById("capt").textContent = S.title;
      document.getElementById("capn").textContent = S.count;
      list.innerHTML = S.rows.map(function (r) {
        return '<div class="cap-row"><span class="cap-logo">' + (r.domain ? '<img alt="" loading="lazy" src="' + LOGO + esc(r.domain) + TOKEN + '">' : "") +
          '</span><b>' + esc(r.tool) + '</b><small>' + esc(r.label) + '</small><code>' + esc(r.price) + '</code><span class="cap-pick">lowest ✓</span></div>';
      }).join("");
      document.getElementById("caprestxt").innerHTML = S.res;
      return S;
    }
    if (REDUCED) {
      var S0 = load(0); q.textContent = S0.ask; caret.style.display = "none"; head.classList.add("in");
      var r0 = list.querySelectorAll(".cap-row");
      [].forEach.call(r0, function (r) { r.classList.add("in"); });
      cap.classList.add("done"); r0[0].classList.add("picked"); wf.classList.add("in");
      return;
    }
    loop(cap, 0.35, function (T) {
      var S = load(sc); sc = (sc + 1) % scenarios.length;
      var rows = [].slice.call(list.querySelectorAll(".cap-row"));
      S.ask.split("").forEach(function (ch, i) { T(function () { q.textContent += ch; }, 300 + i * 36); });
      var tType = 300 + S.ask.length * 36;
      T(function () { caret.style.display = "none"; head.classList.add("in"); }, tType + 320);
      rows.forEach(function (r, i) { T(function () { r.classList.add("in"); }, tType + 700 + i * 140); });
      var tRows = tType + 700 + rows.length * 140;
      rows.forEach(function (r, i) {
        T(function () { r.classList.add("scan"); }, tRows + 220 + i * 150);
        T(function () { r.classList.remove("scan"); }, tRows + 220 + i * 150 + 160);
      });
      var tScan = tRows + 220 + rows.length * 150 + 190;
      T(function () { cap.classList.add("done"); rows[0].classList.add("picked"); }, tScan);
      T(function () { wf.classList.add("in"); }, tScan + 900);
      return tScan + 4800;
    }, function () {
      q.textContent = ""; caret.style.display = "";
      head.classList.remove("in"); wf.classList.remove("in"); cap.classList.remove("done");
    });
  })();

  /* ---------- 2b. the ledger: seat prices land, the strike draws, the action price takes over ---------- */
  (function () {
    var led = document.getElementById("ledger");
    if (!led) return;
    var rows = [].slice.call(led.querySelectorAll(".lrow"));
    var wf = document.getElementById("lwf");
    if (REDUCED) { rows.forEach(function (r) { r.classList.add("in", "flip"); }); wf.classList.add("in"); return; }
    loop(led, 0.35, function (T) {
      rows.forEach(function (r, i) { T(function () { r.classList.add("in"); }, 250 + i * 170); });
      var t0 = 250 + rows.length * 170 + 700;
      rows.forEach(function (r, i) { T(function () { r.classList.add("flip"); }, t0 + i * 380); });
      var tEnd = t0 + rows.length * 380 + 350;
      T(function () { wf.classList.add("in"); }, tEnd);
      return tEnd + 4600;
    }, function () {
      rows.forEach(function (r) { r.classList.remove("in", "flip"); }); wf.classList.remove("in");
    });
  })();

  /* ---------- 2c. 0% band: the equation types itself once ---------- */
  (function () {
    var band = document.getElementById("zeroband"), el = document.getElementById("zeqtxt");
    if (!band || !el || REDUCED) return;
    var segs = [{ t: "vendor price " }, { t: "+ $0.000 markup", b: 1 }, { t: " = your price" }];
    var total = segs.reduce(function (n, s) { return n + s.t.length; }, 0);
    function render(n) {
      var h = "", c = 0;
      segs.forEach(function (s) {
        var chunk = s.t.slice(0, Math.max(0, Math.min(s.t.length, n - c)));
        h += s.b ? "<b>" + chunk + "</b>" : chunk; c += s.t.length;
      });
      el.innerHTML = h;
    }
    render(0);
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        var n = 0;
        var tick = setInterval(function () { render(++n); if (n >= total) clearInterval(tick); }, 38);
      });
    }, { threshold: 0.5 });
    io.observe(band);
  })();
})();
