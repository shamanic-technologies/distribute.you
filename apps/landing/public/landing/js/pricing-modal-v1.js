/* ═══════════════════════════════════════════════
   Custom-pricing modal for the self-contained index-v1 homepage
   (dark theme, no styles.css / no main.js). Triggers on
   [data-pricing-modal].

   Mirrors the dashboard onboarding flow:
     • Two DIRECT outcomes are measured live by features-service —
       cost per website VISIT and cost per positive REPLY (the atoms).
     • A DIRECT goal (website visits, positive replies) shows its atom
       cost straight away — no conversion step.
     • An INDIRECT goal (sign-ups, form submissions, sales meetings,
       sales) first asks the visitor for their conversion rate(s),
       PREFILLED with sane defaults, then derives the cost per outcome
       from the measured atom(s) ÷ those rates — exactly like onboarding.
       The atoms are server-measured; the rates are the visitor's own
       what-if inputs, so the derivation is a client-side calculator
       (same as the onboarding / launch pricing preview), not a
       server-owned stat.

   Flow: goal → [rates, indirect only] → price + $25 credit + budget.
   ═══════════════════════════════════════════════ */
(function () {
  var SIGNUP = 'https://dashboard.distribute.you/sign-up';
  var API = 'https://api.distribute.you/v1/public/features';
  var SLUG = 'sales-cold-email-outreach';

  // Last-known-good measured atoms (USD), used only if the endpoint is cold /
  // unreachable (marketing estimate, never $0).
  var VISIT_FALLBACK = 0.90;   // cost per website visit
  var REPLY_FALLBACK = 52;     // cost per positive reply

  // Rate defaults mirror the onboarding DEFAULT_RATES (percentages).
  var RATE_META = {
    v2s: { label: 'Website visit → sign-up', hint: 'Of visitors who land on your site, how many sign up.', def: 5 },
    v2f: { label: 'Website visit → form submission', hint: 'Of visitors who land on your site, how many submit a form.', def: 5 },
    r2m: { label: 'Positive reply → sales meeting', hint: 'Of prospects who reply with buying interest, how many become a booked meeting.', def: 30 },
    v2m: { label: 'Website visit → sales meeting', hint: 'Set above 0 only if prospects can book a meeting directly from your site.', def: 3 },
    v2p: { label: 'Website visit → paid client', hint: 'Of visitors who land on your site, how many become paying customers.', def: 1 },
    r2p: { label: 'Positive reply → paid client', hint: 'Of prospects who reply positively, how many become paying customers.', def: 5 }
  };

  // Each goal declares the measured atoms it needs, the rate fields it asks
  // (empty = direct outcome, no conversion step), and how to derive the cost
  // per outcome from the atoms + rates. `cost(a, r)` receives resolved atom
  // dollars (a.visit / a.reply) and rate percentages (r.<key>); returns the
  // cost per outcome, or null when it can't be computed.
  var GOALS = [
    {
      key: 'website_visits', label: 'Website visits', unit: 'website visits', unitOne: 'website visit',
      desc: 'Maximize qualified website visits.', atoms: ['visit'], rates: [], fallback: VISIT_FALLBACK,
      note: 'measured live across active campaigns',
      cost: function (a) { return a.visit; }
    },
    {
      key: 'positive_replies', label: 'Positive replies', unit: 'positive replies', unitOne: 'positive reply',
      desc: 'Maximize positive replies for a sales meeting from prospects.', atoms: ['reply'], rates: [], fallback: REPLY_FALLBACK,
      note: 'measured live across active campaigns',
      cost: function (a) { return a.reply; }
    },
    {
      key: 'signups', label: 'Sign-ups', unit: 'sign-ups', unitOne: 'sign-up',
      desc: 'Maximize free signups and trial starts.', atoms: ['visit'], rates: ['v2s'], fallback: 32.85,
      note: 'from the live cost per website visit and your conversion rate',
      cost: function (a, r) { return (a.visit > 0 && r.v2s > 0) ? a.visit / (r.v2s / 100) : null; }
    },
    {
      key: 'form_submissions', label: 'Form submissions', unit: 'form submissions', unitOne: 'form submission',
      desc: 'Maximize lead-form submissions.', atoms: ['visit'], rates: ['v2f'], fallback: 45,
      note: 'from the live cost per website visit and your conversion rate',
      cost: function (a, r) { return (a.visit > 0 && r.v2f > 0) ? a.visit / (r.v2f / 100) : null; }
    },
    {
      key: 'sales_meetings', label: 'Sales meetings', unit: 'sales meetings', unitOne: 'sales meeting',
      desc: 'Maximize booked sales meetings.', atoms: ['reply', 'visit'], rates: ['r2m', 'v2m'], fallback: 76,
      note: 'from the live cost per positive reply and website visit, and your rates',
      cost: function (a, r) {
        var perDollar = 0;
        if (a.reply > 0 && r.r2m > 0) perDollar += (1 / a.reply) * (r.r2m / 100);
        if (a.visit > 0 && r.v2m > 0) perDollar += (1 / a.visit) * (r.v2m / 100);
        return perDollar > 0 ? 1 / perDollar : null;
      }
    },
    {
      key: 'sales', label: 'Sales', unit: 'sales', unitOne: 'sale',
      desc: 'Maximize paying clients won via website visits or positive replies.', atoms: ['visit', 'reply'], rates: ['v2p', 'r2p'], fallback: 72,
      note: 'from the live cost per website visit and positive reply, and your rates',
      cost: function (a, r) {
        var perDollar = 0;
        if (a.visit > 0 && r.v2p > 0) perDollar += (1 / a.visit) * (r.v2p / 100);
        if (a.reply > 0 && r.r2p > 0) perDollar += (1 / a.reply) * (r.r2p / 100);
        return perDollar > 0 ? 1 / perDollar : null;
      }
    }
  ];
  var COUNT_TIERS = [5, 25, 125];
  var TIER_LABELS = ['Starter', 'Recommended', 'Growth'];

  /* ── Measured atoms — best workflow by the avg-100 recent going rate, from
        features-service public per-workflow cost-per-outcome (MIN across
        workflows). Cache: undefined = not fetched, null = fetched-but-empty
        (→ fallback), number = the best avg-100 cost. Two atoms: websiteVisit,
        positiveReply. ── */
  var ATOM_OBJECTIVE = { visit: 'websiteVisit', reply: 'positiveReply' };
  var ATOM_FALLBACK = { visit: VISIT_FALLBACK, reply: REPLY_FALLBACK };
  var costCache = {};
  var costPromise = {};
  function fetchBest(objective) {
    if (objective in costCache) return Promise.resolve(costCache[objective]);
    if (costPromise[objective]) return costPromise[objective];
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    if (ctrl) setTimeout(function () { ctrl.abort(); }, 8000);
    costPromise[objective] = fetch(API + '/workflow-cost-per-outcome?featureSlug=' + SLUG + '&objective=' + objective,
      ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var best = null;
        if (d && d.workflows) d.workflows.forEach(function (w) {
          var c = w.recentCostPerOutcomeUsd;
          if (typeof c === 'number' && c > 0 && (best == null || c < best)) best = c;
        });
        costCache[objective] = best;   // number, or null when nothing usable
        return best;
      })
      .catch(function () { costCache[objective] = null; return null; });
    return costPromise[objective];
  }
  // Resolved atom dollars for a name ('visit' / 'reply'):
  //   undefined = still loading · number = best measured (or fallback when empty).
  function atomValue(name) {
    var v = costCache[ATOM_OBJECTIVE[name]];
    if (v === undefined) return undefined;
    return (typeof v === 'number' && v > 0) ? v : ATOM_FALLBACK[name];
  }
  // Ensure the atoms a goal needs are fetched. Returns a promise for all of them.
  function fetchAtomsFor(goal) {
    return Promise.all(goal.atoms.map(function (name) { return fetchBest(ATOM_OBJECTIVE[name]); }));
  }
  // Cost per outcome for a goal + rates: undefined while any needed atom loads,
  // number once resolved (falls back to goal.fallback if the formula can't compute).
  function unitCostFor(goal, rates) {
    var a = {};
    for (var i = 0; i < goal.atoms.length; i++) {
      var name = goal.atoms[i];
      var v = atomValue(name);
      if (v === undefined) return undefined;   // still loading
      a[name] = v;
    }
    var c = goal.cost(a, rates || {});
    return (typeof c === 'number' && isFinite(c) && c > 0) ? c : goal.fallback;
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

  function defaultRates() {
    var r = {};
    for (var k in RATE_META) if (RATE_META.hasOwnProperty(k)) r[k] = RATE_META[k].def;
    return r;
  }

  /* ── State ──
     step 0 = goal · (indirect) step 1 = rates · result = last step.
     unitCost = the resolved cost per outcome (drives price + budget, one number). */
  var state = { step: 0, goal: null, count: null, url: '', rates: defaultRates(), unitCost: null };

  var overlay = document.createElement('div');
  overlay.className = 'pm-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML =
    '<div class="pm-card" role="dialog" aria-modal="true" aria-label="Custom pricing">'
    + '<button class="pm-close" type="button" aria-label="Close">✕</button>'
    + '<div class="pm-dots"></div>'
    + '<div class="pm-body"></div>'
    + '</div>';
  document.body.appendChild(overlay);
  var body = overlay.querySelector('.pm-body');
  var dotsEl = overlay.querySelector('.pm-dots');

  function open(url) {
    state = { step: 0, goal: null, count: null, url: url || '', rates: defaultRates(), unitCost: null };
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

  // A goal with rate fields is indirect → its result lives at step 2 (after the
  // rate step); a direct goal has no rate step, so its result is step 1.
  function hasRates() { return !!(state.goal && state.goal.rates.length); }
  function resultStep() { return hasRates() ? 2 : 1; }

  function renderDots() {
    var total = hasRates() ? 3 : 2;
    var html = '';
    for (var i = 0; i < total; i++) html += '<span class="pm-dot' + (i <= state.step ? ' on' : '') + '"></span>';
    dotsEl.innerHTML = html;
  }

  function render() {
    renderDots();
    if (state.step === 0) return renderGoal();
    if (hasRates() && state.step === 1) return renderRates();
    return renderResult();
  }

  /* Step 0 — goal */
  function renderGoal() {
    var html = '<span class="pm-eyebrow">Custom pricing</span>'
      + '<h2 class="pm-title">What is your primary sales goal?</h2>'
      + '<p class="pm-sub">Pick the one outcome to price. We show the live cost, measured across active campaigns.</p>'
      + '<div class="pm-choices">';
    GOALS.forEach(function (g) {
      var sel = state.goal && state.goal.key === g.key ? ' sel' : '';
      html += '<button type="button" class="pm-choice' + sel + '" data-goal="' + g.key + '">'
        + '<div class="pm-choice-t">' + esc(g.label) + '</div>'
        + '<div class="pm-choice-d">' + esc(g.desc) + '</div></button>';
    });
    html += '</div>'
      + '<div class="pm-nav"><button type="button" class="button primary" data-next' + (state.goal ? '' : ' disabled') + '>' + (state.goal && state.goal.rates.length ? 'Next →' : 'See my price →') + '</button></div>';
    body.innerHTML = html;
    body.querySelectorAll('[data-goal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.goal = GOALS.filter(function (x) { return x.key === btn.getAttribute('data-goal'); })[0];
        fetchAtomsFor(state.goal);
        render();
      });
    });
    var next = body.querySelector('[data-next]');
    if (next) next.addEventListener('click', function () { if (state.goal) { state.count = null; state.step = 1; render(); } });
  }

  /* Step 1 (indirect only) — conversion rates, prefilled + editable */
  function renderRates() {
    var g = state.goal;
    var html = '<span class="pm-eyebrow">Your conversion rates</span>'
      + '<h2 class="pm-title">A couple of your rates</h2>'
      + '<p class="pm-sub">We price ' + esc(g.unit) + ' from your live cost per website visit / positive reply and how they convert. Prefilled with typical rates, adjust to yours.</p>'
      + '<div class="pm-rates">';
    g.rates.forEach(function (key) {
      var m = RATE_META[key];
      html += '<div class="pm-rate"><div class="pm-rate-l">'
        + '<div class="pm-rate-lbl">' + esc(m.label) + '</div>'
        + '<div class="pm-rate-hint">' + esc(m.hint) + '</div></div>'
        + '<div class="pm-rate-in"><input type="text" inputmode="decimal" data-rate="' + key + '" value="' + esc(String(state.rates[key])) + '" aria-label="' + esc(m.label) + '"><span>%</span></div></div>';
    });
    html += '</div>'
      + '<div class="pm-nav"><button type="button" class="pm-back" data-back>← Back</button>'
      + '<button type="button" class="button primary" data-next>See my price →</button></div>';
    body.innerHTML = html;
    body.querySelectorAll('[data-rate]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var v = parseFloat(inp.value.replace(/[^0-9.]/g, ''));
        state.rates[inp.getAttribute('data-rate')] = (!isNaN(v) && v >= 0) ? v : 0;
      });
    });
    body.querySelector('[data-back]').addEventListener('click', function () { state.step = 0; render(); });
    body.querySelector('[data-next]').addEventListener('click', function () { state.count = null; state.step = 2; render(); });
  }

  /* Result — price + $25 credit + budget + get started */
  function renderResult() {
    var g = state.goal;
    var uc = unitCostFor(g, state.rates);   // number, or undefined while atoms load
    state.unitCost = (uc === undefined) ? null : uc;

    function priceBlock() {
      if (uc === undefined) {
        return '<div class="pm-price calc"><div class="pm-price-lbl">Cost per ' + esc(g.unitOne) + '</div>'
          + '<div class="pm-price-n">Calculating…</div></div>';
      }
      return '<div class="pm-price"><div class="pm-price-lbl">Cost per ' + esc(g.unitOne) + '</div>'
        + '<div class="pm-price-n">' + (fmtUsd(uc) || '-') + '</div>'
        + '<div class="pm-price-per">' + esc(g.note) + '</div></div>';
    }
    function tiersBlock() {
      var html = '<div class="pm-budget-h">How many ' + esc(g.unit) + ' a month?</div><div class="pm-tiers">';
      COUNT_TIERS.forEach(function (n, i) {
        var day = budgetForCount(n, state.unitCost);
        var sel = state.count === n ? ' sel' : '';
        var rec = i === 1 ? ' rec' : '';
        html += '<button type="button" class="pm-tier' + rec + sel + '" data-count="' + n + '">'
          + '<div class="pm-tier-eyebrow">' + TIER_LABELS[i] + '</div>'
          + '<div class="pm-tier-n">' + fmtInt(n) + '</div>'
          + '<div class="pm-tier-unit">' + esc(g.unit) + ' / mo</div>'
          + '<div class="pm-tier-day">' + (day != null ? '~' + fmtUsd(day) + ' / day' : '-') + '</div></button>';
      });
      var custom = (state.count != null && COUNT_TIERS.indexOf(state.count) === -1) ? state.count : '';
      var cday = custom !== '' ? budgetForCount(custom, state.unitCost) : null;
      html += '<div class="pm-tier pm-tier-custom' + (custom !== '' ? ' sel' : '') + '">'
        + '<div class="pm-tier-eyebrow">Custom</div>'
        + '<input type="text" inputmode="numeric" data-custom placeholder="Other" value="' + custom + '" aria-label="Custom monthly count">'
        + '<div class="pm-tier-day">' + (cday != null ? '~' + fmtUsd(cday) + ' / day' : '&nbsp;') + '</div></div>';
      html += '</div>';
      return html;
    }
    function summaryBlock() {
      var day = state.count != null ? budgetForCount(state.count, state.unitCost) : null;
      if (day == null) return '';
      return '<div class="pm-summary">Daily budget <b>' + fmtUsd(day) + ' / day</b> &middot; ~' + (fmtUsd(state.unitCost) || '-') + ' / ' + esc(g.unitOne) + '</div>';
    }
    var startDisabled = state.count == null || state.unitCost == null;
    body.innerHTML = priceBlock()
      + '<div class="pm-credit"><div><div class="pm-credit-t">Your first $25 is on us.</div>'
      + '<div class="pm-credit-d">Spend $25 and we match it, $1 for $1. The credits unlock the moment your spend reaches $25.</div></div></div>'
      + tiersBlock()
      + summaryBlock()
      + '<div class="pm-nav"><button type="button" class="pm-back" data-back>← Back</button>'
      + '<button type="button" class="button primary" data-start' + (startDisabled ? ' disabled' : '') + '>Get started. $25 free →</button></div>';

    // Atoms still loading → re-render once they land to fill the price + $/day.
    function reRenderIfOpen() { if (state.step === resultStep() && overlay.classList.contains('open')) renderResult(); }
    if (uc === undefined) fetchAtomsFor(g).then(reRenderIfOpen);

    body.querySelectorAll('[data-count]').forEach(function (btn) {
      btn.addEventListener('click', function () { state.count = parseInt(btn.getAttribute('data-count'), 10); renderResult(); });
    });
    var customInp = body.querySelector('[data-custom]');
    if (customInp) {
      customInp.addEventListener('input', function () {
        var v = parseInt(customInp.value.replace(/[^0-9]/g, ''), 10);
        state.count = (!isNaN(v) && v > 0) ? v : null;
        var day = state.count != null ? budgetForCount(state.count, state.unitCost) : null;
        var hint = customInp.parentElement.querySelector('.pm-tier-day');
        if (hint) hint.innerHTML = day != null ? '~' + fmtUsd(day) + ' / day' : '&nbsp;';
        body.querySelectorAll('.pm-tier[data-count]').forEach(function (t) { t.classList.remove('sel'); });
        customInp.parentElement.classList.toggle('sel', state.count != null);
        var startBtn = body.querySelector('[data-start]');
        if (startBtn) { if (state.count != null && state.unitCost != null) startBtn.removeAttribute('disabled'); else startBtn.setAttribute('disabled', ''); }
      });
    }
    body.querySelector('[data-back]').addEventListener('click', function () { state.step = hasRates() ? 1 : 0; render(); });
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

  // Warm both atoms early so the price step is instant.
  function warm() { fetchBest('websiteVisit'); fetchBest('positiveReply'); }
  if ('requestIdleCallback' in window) requestIdleCallback(warm);
  else setTimeout(warm, 1200);
})();
