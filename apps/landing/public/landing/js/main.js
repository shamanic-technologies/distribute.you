/* ═══════════════════════════════════════════════
   DISTRIBUTE: main.js  (page-specific interactions)
   ═══════════════════════════════════════════════ */

/* ── Scroll reveal ── */
const revealEls = document.querySelectorAll('.r');
if (revealEls.length) {
  const revealObs = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('on');
    }),
    { threshold: 0.06 }
  );
  revealEls.forEach(el => revealObs.observe(el));
}


/* ── Counter animation ── */
function animateCounter(el) {
  const target   = parseFloat(el.dataset.n);
  const prefix   = el.dataset.pre  || '';
  const suffix   = el.dataset.suf  || '';
  const decimals = parseInt(el.dataset.dec) || 0;
  const duration = 1400;
  let startTime  = null;

  function step(ts) {
    if (!startTime) startTime = ts;
    const progress = Math.min((ts - startTime) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = prefix + (eased * target).toFixed(decimals) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

let countersRan = false;
const statsInner = document.querySelector('.stats-inner');
if (statsInner) {
  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !countersRan) {
      countersRan = true;
      document.querySelectorAll('[data-n]').forEach(animateCounter);
    }
  }, { threshold: 0.3 }).observe(statsInner);
}


/* ── Typing animation (email section) ── */
const typingTarget = document.getElementById('email-body-text');
if (typingTarget) {
  const emailLines = [
    'Hi,',
    '',
    'See your message about cutting our onboarding time. We are 14 people and onboarding still takes 3 weeks. Where can I book 15 minutes this week?',
    '',
    'Marcus',
  ];
  const fullText = emailLines.join('\n');
  let charIndex = 0;
  let typingStarted = false;

  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !typingStarted) {
      typingStarted = true;
      const cursor = document.createElement('span');
      cursor.className = 'email-typing-cursor';
      typingTarget.after(cursor);

      function typeChar() {
        if (charIndex < fullText.length) {
          typingTarget.textContent = fullText.slice(0, ++charIndex);
          const delay = fullText[charIndex - 1] === '\n'
            ? 180
            : Math.random() * 28 + 12;
          setTimeout(typeChar, delay);
        } else {
          cursor.remove();
        }
      }
      setTimeout(typeChar, 600);
    }
  }, { threshold: 0.4 }).observe(
    typingTarget.closest('.s-email') || typingTarget.parentElement
  );
}


/* ── Sidebar bar fills (data-width) ── */
const barFills = document.querySelectorAll('.uid-bar-fill[data-width]');
if (barFills.length) {
  const barObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.width = e.target.dataset.width;
        barObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  barFills.forEach(el => {
    el.style.width = '0';
    barObs.observe(el);
  });
}


/* ── Dashboard hero animation ── */
const dashEl = document.querySelector('.uid-dash-anim');
if (dashEl) {
  let dashDone = false;

  /* Count-up helper */
  function countUp(el, target, duration, prefix, suffix, decimals) {
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const val = (1 - Math.pow(1 - p, 3)) * target;
      el.textContent = prefix + (decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString()) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ── Budget loop ── */
  const BUDGET_STEPS = [22, 35, 58, 72, 85, 60, 45];
  const BUDGET_WAITS = [1600, 2000, 1800, 2200, 1500, 2400, 1700];
  let budgetIdx = 0;
  let budgetTimer = null;

  function stepBudget() {
    const val = BUDGET_STEPS[budgetIdx];
    const n   = document.getElementById('dash-budget-n');
    const bar = document.getElementById('dash-budget-bar');
    if (n)   n.textContent   = val + '%';
    if (bar) bar.style.width = val + '%';
    budgetIdx = (budgetIdx + 1) % BUDGET_STEPS.length;
    budgetTimer = setTimeout(stepBudget, BUDGET_WAITS[budgetIdx]);
  }

  /* ── Revenue chart loop ── */
  // Draws the actual (solid) pipeline-revenue line, then fades in areas,
  // the today marker, and the projected (dashed) line.
  function runRevLoop() {
    const actual = dashEl.querySelector('.uid-rev-actual');
    const proj   = dashEl.querySelector('.uid-rev-proj');
    const fades  = dashEl.querySelectorAll('.uid-rev-fade');

    // Reset
    if (actual) {
      const len = actual.getTotalLength();
      actual.style.transition       = 'none';
      actual.style.strokeDasharray  = len;
      actual.style.strokeDashoffset = len;
    }
    if (proj) { proj.style.transition = 'none'; proj.style.opacity = '0'; }
    fades.forEach(f => { f.style.transition = 'none'; f.style.opacity = '0'; });

    // Draw after reset frame
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (actual) {
        actual.style.transition       = 'stroke-dashoffset 1.1s cubic-bezier(0.16, 1, 0.3, 1)';
        actual.style.strokeDashoffset = '0';
      }
      fades.forEach((f, i) => {
        f.style.transition = 'opacity 0.7s ease';
        setTimeout(() => { f.style.opacity = '1'; }, 150 + i * 70);
      });
      if (proj) {
        proj.style.transition = 'opacity 0.9s ease';
        setTimeout(() => { proj.style.opacity = '1'; }, 1000);
      }
    }));

    // Loop
    setTimeout(runRevLoop, 6000);
  }

  function runDashAnim() {
    if (dashDone) return;
    dashDone = true;

    /* KPI count-up */
    const kpiNums = dashEl.querySelectorAll('.uid-kpi-n');
    [
      { target: 312, prefix: '', suffix: '',  decimals: 0, delay: 80  },
      { target: 84,  prefix: '', suffix: '',  decimals: 0, delay: 110 },
      { target: 67,  prefix: '', suffix: '',  decimals: 0, delay: 140 },
    ].forEach((d, i) => {
      const el = kpiNums[i];
      if (el) setTimeout(() => countUp(el, d.target, 900, d.prefix, d.suffix, d.decimals), d.delay);
    });



    /* Table rows stagger */
    dashEl.querySelectorAll('.uid-table tbody tr').forEach((row, i) => {
      setTimeout(() => row.classList.add('dash-row-in'), 500 + i * 100);
    });

    /* Start loops */
    runRevLoop();
    setTimeout(stepBudget, 400);
  }

  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) runDashAnim();
  }, { threshold: 0.25 }).observe(dashEl);
}


/* ── Reading progress bar ── */
const postProgress = document.querySelector('.post-progress');
if (postProgress) {
  window.addEventListener('scroll', () => {
    const total = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    postProgress.style.width = total > 0 ? (window.scrollY / total * 100) + '%' : '0';
  }, { passive: true });
}

/* ── Related articles (random 3) ── */
(function () {
  var ARTICLES = [
    { url: '/cold-email-cost-guide/cold-email-cost-per-contact', tag: 'Cost breakdown', title: 'Cold email cost per contact: the real numbers', desc: 'DIY stacks, agencies, and distribute. What each approach actually costs once you count everything.' },
    { url: '/cold-email-cost-guide/linkedin-inmail-cost-vs-cold-email', tag: 'Channel comparison', title: 'LinkedIn InMail cost vs cold email: what the math says', desc: 'Sales Navigator at $3-5 per message vs cold email at $4-7 per click. The full cost-per-reply breakdown.' },
    { url: '/cold-email-cost-guide/cold-email-roi', tag: 'ROI analysis', title: 'Cold email ROI: how to calculate real returns', desc: 'The formula, benchmarks, and sensitivity table. How deal size changes everything.' },
    { url: '/cold-email-for-saas-founders/ai-cold-email-saas-founders', tag: 'AI outreach', title: 'AI cold email for SaaS founders: does it actually work?', desc: 'Per-prospect research priced on outcomes — $4-7 per click — with a 27% open rate. Real campaign numbers.' },
    { url: '/cold-email-for-saas-founders/cold-email-subject-lines-saas', tag: 'Subject lines', title: 'Cold email subject lines for SaaS founders', desc: 'The patterns that get 30%+ open rates. With real examples for SaaS outreach.' },
    { url: '/cold-email-for-saas-founders/b2b-cold-email-reply-rate', tag: 'Benchmarks', title: 'B2B cold email reply rate benchmarks', desc: 'What 4% means and how to push it higher. Benchmarks by ICP specificity.' },
    { url: '/cold-email-vs-linkedin/cold-email-vs-linkedin-ads', tag: 'Channel comparison', title: 'Cold email vs LinkedIn ads: which converts better?', desc: 'CPL, conversion rates, and time to first lead. A direct comparison for B2B outbound.' },
    { url: '/cold-email-vs-linkedin/b2b-outbound-channel-comparison', tag: 'Channel guide', title: 'B2B outbound channel comparison: email, LinkedIn, cold calling', desc: 'Which outbound channel fits which use case. Cost, effort, and conversion data side by side.' },
    { url: '/cold-email-for-saas-founders/cold-email-personalization-at-scale', tag: 'Personalization', title: 'Cold email personalization at scale', desc: 'How to write emails that feel personal when you\'re sending hundreds. What works at volume.' },
    { url: '/cold-email-cost-guide/cold-email-setup-cost', tag: 'Infrastructure', title: 'Cold email setup cost: what building the infrastructure runs', desc: 'Domains, warmup, data, tools — $200-500/month before you send the first email. Every line item.' },
    { url: '/cold-email-vs-linkedin/linkedin-connection-request-vs-cold-email', tag: 'Channel comparison', title: 'LinkedIn connection requests vs cold email: which works better?', desc: 'LinkedIn caps at 100-200 requests per week. Cold email has no limit. The full funnel math.' },
    { url: '/cold-email-vs-linkedin/multichannel-outreach-strategy', tag: 'Strategy', title: 'Multichannel outreach: combining cold email and LinkedIn', desc: 'Cold email first, LinkedIn second. Prospects hit both channels convert at 2-3x the rate.' },
  ];

  var grid = document.querySelector('.post-related-grid');
  if (!grid || grid.children.length) return;

  var currentPath = window.location.pathname.replace(/\/$/, '');
  var pool = ARTICLES.filter(function (a) { return a.url !== currentPath; });

  for (var i = pool.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }

  grid.innerHTML = pool.slice(0, 3).map(function (a) {
    return '<a href="' + a.url + '" class="post-related-card">'
      + '<span class="post-related-tag">' + a.tag + '</span>'
      + '<p class="post-related-title">' + a.title + '</p>'
      + '<p class="post-related-desc">' + a.desc + '</p>'
      + '<span class="post-related-arrow">Read &rarr;</span>'
      + '</a>';
  }).join('');
})();

/* ── TOC scroll-spy ── */
const tocLinks = document.querySelectorAll('.post-toc-list a[href^="#"]');
if (tocLinks.length) {
  const sections = [...tocLinks].map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  function updateActiveToc() {
    const scrollY = window.scrollY + 120;
    let active = sections[0];
    for (const s of sections) {
      if (s.offsetTop <= scrollY) active = s;
    }
    tocLinks.forEach(a => {
      a.classList.toggle('toc-active', a.getAttribute('href') === '#' + active.id);
    });
  }
  window.addEventListener('scroll', updateActiveToc, { passive: true });
  updateActiveToc();
}


/* ═══════════════════════════════════════════════
   CUSTOM PRICING MODAL (onboarding-style, no signup)
   Reproduces the dashboard onboarding pricing steps
   (goal → your rates → your price → $25 credit → budget)
   entirely client-side, then hands off to signup.
   Price = the BEST-performing workflow's live cost per
   base step (website visit / positive reply) applied to
   the visitor's own conversion rates — same as onboarding
   picking the cheapest workflow, NOT a cross-brand average.
   ═══════════════════════════════════════════════ */
(function () {
  var SIGNUP = 'https://dashboard.distribute.you/sign-up';
  var API = 'https://api.distribute.you/v1/public/features';
  var SLUG = 'sales-cold-email-outreach';
  // Last-known-good BEST-workflow base costs (USD), used only if the
  // public endpoint is cold / unreachable. Mirrors the ticker's
  // last-known-good fallback pattern (marketing estimate, never $0).
  var FALLBACK = { clickUsd: 1.81, replyUsd: 23.28 };

  // Public visitors see the two non-beta onboarding goals.
  var GOALS = [
    {
      key: 'signups', label: 'Sign-ups', unit: 'sign-ups', unitOne: 'sign-up',
      desc: 'Maximize free signups and trial starts.',
      rates: [{ k: 'v2s', label: 'Website visit → signup', hint: 'Of visitors who land on your site, the share that sign up.', def: 5 }]
    },
    {
      key: 'meetings', label: 'Booked meetings', unit: 'meetings', unitOne: 'meeting',
      desc: 'Maximize booked sales meetings.',
      rates: [
        { k: 'r2m', label: 'Positive reply → meeting', hint: 'Of prospects who reply with real interest, the share that book a meeting.', def: 30 },
        { k: 'v2m', label: 'Website visit → meeting', hint: 'Set above 0 only if prospects can book straight from your site.', def: 3 }
      ]
    }
  ];
  var COUNT_TIERS = [5, 25, 125];
  var TIER_LABELS = ['Starter', 'Recommended', 'Growth'];

  /* ── Base cost fetch (best workflow, cached) ── */
  var baseCache = null;   // [{ clickUsd, replyUsd }]
  var basePromise = null;
  function fetchObjective(obj) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    if (ctrl) setTimeout(function () { ctrl.abort(); }, 8000);
    return fetch(API + '/workflow-cost-per-outcome?featureSlug=' + SLUG + '&objective=' + obj,
      ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  function loadBase() {
    if (basePromise) return basePromise;
    basePromise = Promise.all([fetchObjective('websiteVisit'), fetchObjective('positiveReply')])
      .then(function (res) {
        var map = {};
        function absorb(payload, field) {
          if (!payload || !payload.workflows) return;
          payload.workflows.forEach(function (w) {
            var c = w.costPerOutcomeUsd;
            if (typeof c === 'number' && c > 0) {
              if (!map[w.workflowDynastySlug]) map[w.workflowDynastySlug] = {};
              map[w.workflowDynastySlug][field] = c;
            }
          });
        }
        absorb(res[0], 'clickUsd');
        absorb(res[1], 'replyUsd');
        var workflows = Object.keys(map).map(function (s) { return map[s]; });
        baseCache = workflows.length ? workflows : [FALLBACK];
        return baseCache;
      });
    return basePromise;
  }

  /* ── Best (cheapest) workflow unit cost for a goal + the visitor's rates.
        Mirrors onboarding's workflowOutcomeUnitCostFromRates over the
        cheapest workflow. ── */
  function bestUnitCost(goalKey, rates) {
    var wfs = (baseCache && baseCache.length) ? baseCache : [FALLBACK];
    var best = null;
    wfs.forEach(function (w) {
      var cost = null;
      if (goalKey === 'signups') {
        if (w.clickUsd > 0 && rates.v2s > 0) cost = w.clickUsd / (rates.v2s / 100);
      } else {
        var mpd = 0;
        if (w.replyUsd > 0 && rates.r2m > 0) mpd += (1 / w.replyUsd) * (rates.r2m / 100);
        if (w.clickUsd > 0 && rates.v2m > 0) mpd += (1 / w.clickUsd) * (rates.v2m / 100);
        if (mpd > 0) cost = 1 / mpd;
      }
      if (cost != null && cost > 0 && (best == null || cost < best)) best = cost;
    });
    return best;
  }

  /* ── Formatting ── */
  function fmtUsd(n) {
    if (n == null || !isFinite(n)) return null;
    return n >= 10 ? '$' + Math.round(n).toLocaleString() : '$' + n.toFixed(2);
  }
  function fmtInt(n) { return Math.round(n).toLocaleString(); }
  function budgetForCount(count, unitCost) {
    if (unitCost == null || unitCost <= 0) return null;
    return Math.max(1, Math.round((count * unitCost) / 30));
  }

  /* ── Only build the modal on pages that have a trigger ── */
  var triggers = document.querySelectorAll('#pricing-form, [data-pricing-modal]');
  if (!triggers.length) return;

  /* ── State ── */
  var state = { step: 0, goal: null, rates: {}, count: null, url: '', unitCost: null };

  /* ── Modal DOM ── */
  var overlay = document.createElement('div');
  overlay.className = 'pm-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML =
    '<div class="pm-card" role="dialog" aria-modal="true" aria-label="Custom pricing">'
    + '<button class="pm-close" type="button" aria-label="Close">✕</button>'
    + '<div class="pm-dots"><span class="pm-dot"></span><span class="pm-dot"></span><span class="pm-dot"></span></div>'
    + '<div class="pm-body"></div>'
    + '</div>';
  document.body.appendChild(overlay);
  var card = overlay.querySelector('.pm-card');
  var body = overlay.querySelector('.pm-body');
  var dots = overlay.querySelectorAll('.pm-dot');

  function open(url) {
    state = { step: 0, goal: null, rates: {}, count: null, url: url || '', unitCost: null };
    loadBase();
    render();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  overlay.querySelector('.pm-close').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function goSignup() {
    var site = state.url.replace(/^https?:\/\//i, '').trim();
    window.location.href = site ? SIGNUP + '?url=' + encodeURIComponent(site) : SIGNUP;
  }

  function render() {
    dots.forEach(function (d, i) { d.classList.toggle('on', i <= state.step); });
    if (state.step === 0) return renderGoal();
    if (state.step === 1) return renderRates();
    return renderResult();
  }

  /* Step 1 — goal */
  function renderGoal() {
    var html = '<span class="pm-eyebrow">Custom pricing</span>'
      + '<h2 class="pm-title">What is your primary sales goal?</h2>'
      + '<p class="pm-sub">Pick the one outcome to price. We show the cost at our best-performing playbook applied to your numbers.</p>'
      + '<div class="pm-choices">';
    GOALS.forEach(function (g) {
      var sel = state.goal && state.goal.key === g.key ? ' sel' : '';
      html += '<button type="button" class="pm-choice' + sel + '" data-goal="' + g.key + '">'
        + '<div class="pm-choice-t">' + esc(g.label) + '</div>'
        + '<div class="pm-choice-d">' + esc(g.desc) + '</div></button>';
    });
    html += '</div>'
      + '<div class="pm-nav"><button type="button" class="btn btn-p btn-lg" data-next' + (state.goal ? '' : ' disabled') + '>Continue →</button></div>';
    body.innerHTML = html;
    body.querySelectorAll('[data-goal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var g = GOALS.filter(function (x) { return x.key === btn.getAttribute('data-goal'); })[0];
        state.goal = g;
        if (!Object.keys(state.rates).length || state._lastGoal !== g.key) {
          state.rates = {};
          g.rates.forEach(function (r) { state.rates[r.k] = r.def; });
          state._lastGoal = g.key;
        }
        render();
      });
    });
    var next = body.querySelector('[data-next]');
    if (next) next.addEventListener('click', function () { if (state.goal) { state.step = 1; render(); } });
  }

  /* Step 2 — rates */
  function renderRates() {
    var html = '<span class="pm-eyebrow">Your conversion rates</span>'
      + '<h2 class="pm-title">Your conversion rates.</h2>'
      + '<p class="pm-sub">An estimate is fine. This tunes the price to your funnel.</p>'
      + '<div class="pm-rates">';
    state.goal.rates.forEach(function (r) {
      html += '<div class="pm-rate"><div class="pm-rate-l">'
        + '<div class="pm-rate-lbl">' + esc(r.label) + '</div>'
        + '<div class="pm-rate-hint">' + esc(r.hint) + '</div></div>'
        + '<div class="pm-rate-in"><input type="text" inputmode="decimal" data-rate="' + r.k + '" value="' + state.rates[r.k] + '" aria-label="' + esc(r.label) + '"><span>%</span></div></div>';
    });
    html += '</div>'
      + '<div class="pm-nav"><button type="button" class="pm-back" data-back>← Back</button>'
      + '<button type="button" class="btn btn-p btn-lg" data-next>See my price →</button></div>';
    body.innerHTML = html;
    body.querySelectorAll('[data-rate]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var v = parseFloat(inp.value.replace(/[^0-9.]/g, ''));
        if (isNaN(v)) v = 0;
        if (v > 100) v = 100;
        state.rates[inp.getAttribute('data-rate')] = v;
      });
    });
    body.querySelector('[data-back]').addEventListener('click', function () { state.step = 0; render(); });
    body.querySelector('[data-next]').addEventListener('click', function () { state.count = null; state.step = 2; render(); });
  }

  /* Step 3 — price + $25 credit + budget + get started */
  function renderResult() {
    var g = state.goal;
    function priceBlock() {
      state.unitCost = bestUnitCost(g.key, state.rates);
      var ready = baseCache != null;
      if (!ready && state.unitCost == null) {
        return '<div class="pm-price calc"><div class="pm-price-lbl">Your cost per ' + esc(g.unitOne) + '</div>'
          + '<div class="pm-price-n">Calculating…</div></div>';
      }
      var uc = state.unitCost;
      return '<div class="pm-price"><div class="pm-price-lbl">Your cost per ' + esc(g.unitOne) + '</div>'
        + '<div class="pm-price-n">' + (fmtUsd(uc) || '—') + '</div>'
        + '<div class="pm-price-per">at our best-performing playbook, your rates</div></div>';
    }
    function tiersBlock() {
      var uc = state.unitCost;
      var html = '<div class="pm-budget-h">How many ' + esc(g.unit) + ' a month?</div><div class="pm-tiers">';
      COUNT_TIERS.forEach(function (n, i) {
        var day = budgetForCount(n, uc);
        var sel = state.count === n ? ' sel' : '';
        var rec = i === 1 ? ' rec' : '';
        html += '<button type="button" class="pm-tier' + rec + sel + '" data-count="' + n + '">'
          + '<div class="pm-tier-eyebrow">' + TIER_LABELS[i] + '</div>'
          + '<div class="pm-tier-n">' + fmtInt(n) + '</div>'
          + '<div class="pm-tier-unit">' + esc(g.unit) + ' / mo</div>'
          + '<div class="pm-tier-day">' + (day != null ? '~' + fmtUsd(day) + ' / day' : '—') + '</div></button>';
      });
      var custom = (state.count != null && COUNT_TIERS.indexOf(state.count) === -1) ? state.count : '';
      var cday = custom !== '' ? budgetForCount(custom, uc) : null;
      html += '<div class="pm-tier pm-tier-custom' + (custom !== '' ? ' sel' : '') + '">'
        + '<div class="pm-tier-eyebrow">Custom</div>'
        + '<input type="text" inputmode="numeric" data-custom placeholder="Other" value="' + custom + '" aria-label="Custom monthly count">'
        + '<div class="pm-tier-day">' + (cday != null ? '~' + fmtUsd(cday) + ' / day' : '&nbsp;') + '</div></div>';
      html += '</div>';
      return html;
    }
    function summaryBlock() {
      var uc = state.unitCost;
      var day = state.count != null ? budgetForCount(state.count, uc) : null;
      if (day == null) return '';
      return '<div class="pm-summary">Daily budget <b>' + fmtUsd(day) + ' / day</b> &middot; ~' + (fmtUsd(uc) || '—') + ' / ' + esc(g.unitOne) + '</div>';
    }
    var startDisabled = state.count == null || state.unitCost == null;
    body.innerHTML = priceBlock()
      + '<div class="pm-credit"><div><div class="pm-credit-t">Your first $25 is on us.</div>'
      + '<div class="pm-credit-d">Spend $25 and we match it, $1 for $1. The credits unlock the moment your spend reaches $25.</div></div></div>'
      + tiersBlock()
      + summaryBlock()
      + '<div class="pm-nav"><button type="button" class="pm-back" data-back>← Back</button>'
      + '<button type="button" class="btn btn-p btn-lg" data-start' + (startDisabled ? ' disabled' : '') + '>Get started →</button></div>';

    // If base costs still loading, re-render once they land to fill the price + $/day.
    if (baseCache == null) loadBase().then(function () { if (state.step === 2 && overlay.classList.contains('open')) renderResult(); });

    body.querySelectorAll('[data-count]').forEach(function (btn) {
      btn.addEventListener('click', function () { state.count = parseInt(btn.getAttribute('data-count'), 10); renderResult(); });
    });
    var customInp = body.querySelector('[data-custom]');
    if (customInp) {
      customInp.addEventListener('input', function () {
        var v = parseInt(customInp.value.replace(/[^0-9]/g, ''), 10);
        state.count = (!isNaN(v) && v > 0) ? v : null;
        // Update only the day hints + summary + start state without stealing focus.
        var day = state.count != null ? budgetForCount(state.count, state.unitCost) : null;
        var hint = customInp.parentElement.querySelector('.pm-tier-day');
        if (hint) hint.innerHTML = day != null ? '~' + fmtUsd(day) + ' / day' : '&nbsp;';
        body.querySelectorAll('.pm-tier[data-count]').forEach(function (t) { t.classList.remove('sel'); });
        customInp.parentElement.classList.toggle('sel', state.count != null);
        var startBtn = body.querySelector('[data-start]');
        if (startBtn) { if (state.count != null && state.unitCost != null) startBtn.removeAttribute('disabled'); else startBtn.setAttribute('disabled', ''); }
      });
    }
    body.querySelector('[data-back]').addEventListener('click', function () { state.step = 1; render(); });
    body.querySelector('[data-start]').addEventListener('click', function () { if (state.count != null) goSignup(); });
  }

  /* ── Wire triggers ── */
  triggers.forEach(function (t) {
    if (t.id === 'pricing-form') {
      t.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = t.querySelector('#pricing-url, input[type="text"], input[type="url"]');
        open(input && input.value ? input.value.trim() : '');
      });
    } else {
      t.addEventListener('click', function (e) { e.preventDefault(); open(t.getAttribute('data-pricing-url') || ''); });
    }
  });

  // Warm the public endpoint early so the price step is instant.
  if ('requestIdleCallback' in window) requestIdleCallback(function () { loadBase(); });
  else setTimeout(loadBase, 1200);
})();
