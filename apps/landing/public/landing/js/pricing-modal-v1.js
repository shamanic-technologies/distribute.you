/* ═══════════════════════════════════════════════
   Pricing modal (2-step: goal -> price + $25 credit + budget),
   ported verbatim from main.js for the self-contained index-v1
   homepage (dark theme, no styles.css / no main.js). Triggers on
   [data-pricing-modal]. Price = best workflow cost-per-outcome
   (avg-100 recent) from features-service public endpoints.
   ═══════════════════════════════════════════════ */
(function () {
  var SIGNUP = 'https://dashboard.distribute.you/sign-up';
  var API = 'https://api.distribute.you/v1/public/features';
  var SLUG = 'sales-cold-email-outreach';

  // Public visitors see the four non-beta onboarding goals. Purchases and
  // booked meetings are beta (gated in onboarding/dashboard), so they are
  // absent here. `objective` maps to the features-service cost-per-outcome
  // objective; `fallback` is a last-known-good BEST cost-per-outcome (USD),
  // used only if the endpoint is cold / unreachable (marketing estimate,
  // never $0).
  var GOALS = [
    { key: 'website_visits', objective: 'websiteVisit', fallback: 0.90, label: 'Website visits', unit: 'website visits', unitOne: 'website visit', desc: 'Maximize qualified website visits.' },
    { key: 'signups', objective: 'signup', fallback: 32.85, label: 'Sign-ups', unit: 'sign-ups', unitOne: 'sign-up', desc: 'Maximize free signups and trial starts.' },
    { key: 'form_submissions', objective: 'formSubmission', fallback: 45, label: 'Form submissions', unit: 'form submissions', unitOne: 'form submission', desc: 'Maximize lead-form submissions.' },
    { key: 'positive_replies', objective: 'positiveReply', fallback: 151, label: 'Positive replies', unit: 'positive replies', unitOne: 'positive reply', desc: 'Maximize positive replies for a sales meeting from prospects.' }
  ];
  var COUNT_TIERS = [5, 25, 125];
  var TIER_LABELS = ['Starter', 'Recommended', 'Growth'];

  /* ── BIG NUMBER — best workflow by the avg-100 going rate, from features-service
        (cached per objective). Fetches the public per-workflow cost-per-outcome and
        keeps the MIN recentCostPerOutcomeUsd (the trailing-100 moving average — the
        best-performing workflow's RECENT going rate, not its all-history lifetime).
        Cache: undefined = not fetched, null = fetched-but-empty (→ fallback),
        number = the best avg-100 cost-per-outcome. ── */
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
          // avg-100 going rate; null when the workflow has no recent backed window.
          var c = w.recentCostPerOutcomeUsd;
          if (typeof c === 'number' && c > 0 && (best == null || c < best)) best = c;
        });
        costCache[objective] = best;   // number, or null when nothing usable
        return best;
      })
      .catch(function () { costCache[objective] = null; return null; });
    return costPromise[objective];
  }
  // number = resolved BIG-number unit cost · undefined = still loading
  function unitCostFor(goal) {
    var v = costCache[goal.objective];
    if (v === undefined) return undefined;
    return (typeof v === 'number' && v > 0) ? v : goal.fallback;
  }

  /* ── BUDGET TIERS — fleet-average PROJECTED cost per outcome, from features-service
        cost-projection (avgCostPerOutcomeByObjective). Different model from the big
        number above (fleet-avg EV funnel vs best-workflow avg-100), so the $/day tiers
        need NOT be coherent with the headline price — that is intentional. One fetch
        per feature returns every objective. Cache: undefined = not fetched, null =
        fetched-but-empty (→ fallback), object = { <objective>: number|null }. ── */
  var projCache;            // undefined until first fetch
  var projPromise = null;
  function fetchProjection() {
    if (projCache !== undefined) return Promise.resolve(projCache);
    if (projPromise) return projPromise;
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    if (ctrl) setTimeout(function () { ctrl.abort(); }, 8000);
    projPromise = fetch(API + '/cost-projection?featureSlug=' + SLUG, ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        projCache = (d && d.avgCostPerOutcomeByObjective) ? d.avgCostPerOutcomeByObjective : null;
        return projCache;
      })
      .catch(function () { projCache = null; return null; });
    return projPromise;
  }
  // number = resolved BUDGET unit cost · undefined = still loading
  function budgetUnitFor(goal) {
    if (projCache === undefined) return undefined;
    var v = (projCache && typeof projCache === 'object') ? projCache[goal.objective] : null;
    return (typeof v === 'number' && v > 0) ? v : goal.fallback;
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
  var state = { step: 0, goal: null, count: null, url: '', unitCost: null, budgetUnitCost: null };

  /* ── Modal DOM (2 steps: goal → price+budget) ── */
  var overlay = document.createElement('div');
  overlay.className = 'pm-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML =
    '<div class="pm-card" role="dialog" aria-modal="true" aria-label="Custom pricing">'
    + '<button class="pm-close" type="button" aria-label="Close">✕</button>'
    + '<div class="pm-dots"><span class="pm-dot"></span><span class="pm-dot"></span></div>'
    + '<div class="pm-body"></div>'
    + '</div>';
  document.body.appendChild(overlay);
  var body = overlay.querySelector('.pm-body');
  var dots = overlay.querySelectorAll('.pm-dot');

  function open(url) {
    state = { step: 0, goal: null, count: null, url: url || '', unitCost: null, budgetUnitCost: null };
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
    return renderResult();
  }

  /* Step 1 — goal */
  function renderGoal() {
    var html = '<span class="pm-eyebrow">Custom pricing</span>'
      + '<h2 class="pm-title">What is your primary sales goal?</h2>'
      + '<p class="pm-sub">Pick the one outcome to price. We show the live cost at our best-performing playbook.</p>'
      + '<div class="pm-choices">';
    GOALS.forEach(function (g) {
      var sel = state.goal && state.goal.key === g.key ? ' sel' : '';
      html += '<button type="button" class="pm-choice' + sel + '" data-goal="' + g.key + '">'
        + '<div class="pm-choice-t">' + esc(g.label) + '</div>'
        + '<div class="pm-choice-d">' + esc(g.desc) + '</div></button>';
    });
    html += '</div>'
      + '<div class="pm-nav"><button type="button" class="button primary" data-next' + (state.goal ? '' : ' disabled') + '>See my price →</button></div>';
    body.innerHTML = html;
    body.querySelectorAll('[data-goal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.goal = GOALS.filter(function (x) { return x.key === btn.getAttribute('data-goal'); })[0];
        fetchBest(state.goal.objective);
        fetchProjection();
        render();
      });
    });
    var next = body.querySelector('[data-next]');
    if (next) next.addEventListener('click', function () { if (state.goal) { state.count = null; state.step = 1; render(); } });
  }

  /* Step 2 — price + $25 credit + budget + get started */
  function renderResult() {
    var g = state.goal;
    var uc = unitCostFor(g);              // BIG number (best avg-100), or undefined while loading
    state.unitCost = (uc === undefined) ? null : uc;
    // Budget uses the SAME live headline price as the big number above, so the
    // $/day tiers + summary stay coherent with "Cost per <outcome>" — one price
    // everywhere, never a second fleet-avg model that contradicts the headline.
    state.budgetUnitCost = state.unitCost;

    function priceBlock() {
      if (uc === undefined) {
        return '<div class="pm-price calc"><div class="pm-price-lbl">Cost per ' + esc(g.unitOne) + '</div>'
          + '<div class="pm-price-n">Calculating…</div></div>';
      }
      return '<div class="pm-price"><div class="pm-price-lbl">Cost per ' + esc(g.unitOne) + '</div>'
        + '<div class="pm-price-n">' + (fmtUsd(uc) || '-') + '</div>'
        + '<div class="pm-price-per">at our best-performing playbook, measured live</div></div>';
    }
    function tiersBlock() {
      var html = '<div class="pm-budget-h">How many ' + esc(g.unit) + ' a month?</div><div class="pm-tiers">';
      COUNT_TIERS.forEach(function (n, i) {
        var day = budgetForCount(n, state.budgetUnitCost);
        var sel = state.count === n ? ' sel' : '';
        var rec = i === 1 ? ' rec' : '';
        html += '<button type="button" class="pm-tier' + rec + sel + '" data-count="' + n + '">'
          + '<div class="pm-tier-eyebrow">' + TIER_LABELS[i] + '</div>'
          + '<div class="pm-tier-n">' + fmtInt(n) + '</div>'
          + '<div class="pm-tier-unit">' + esc(g.unit) + ' / mo</div>'
          + '<div class="pm-tier-day">' + (day != null ? '~' + fmtUsd(day) + ' / day' : '-') + '</div></button>';
      });
      var custom = (state.count != null && COUNT_TIERS.indexOf(state.count) === -1) ? state.count : '';
      var cday = custom !== '' ? budgetForCount(custom, state.budgetUnitCost) : null;
      html += '<div class="pm-tier pm-tier-custom' + (custom !== '' ? ' sel' : '') + '">'
        + '<div class="pm-tier-eyebrow">Custom</div>'
        + '<input type="text" inputmode="numeric" data-custom placeholder="Other" value="' + custom + '" aria-label="Custom monthly count">'
        + '<div class="pm-tier-day">' + (cday != null ? '~' + fmtUsd(cday) + ' / day' : '&nbsp;') + '</div></div>';
      html += '</div>';
      return html;
    }
    function summaryBlock() {
      var day = state.count != null ? budgetForCount(state.count, state.budgetUnitCost) : null;
      if (day == null) return '';
      return '<div class="pm-summary">Daily budget <b>' + fmtUsd(day) + ' / day</b> &middot; ~' + (fmtUsd(state.budgetUnitCost) || '-') + ' / ' + esc(g.unitOne) + '</div>';
    }
    var startDisabled = state.count == null || state.budgetUnitCost == null;
    body.innerHTML = priceBlock()
      + '<div class="pm-credit"><div><div class="pm-credit-t">Your first $25 is on us.</div>'
      + '<div class="pm-credit-d">Spend $25 and we match it, $1 for $1. The credits unlock the moment your spend reaches $25.</div></div></div>'
      + tiersBlock()
      + summaryBlock()
      + '<div class="pm-nav"><button type="button" class="pm-back" data-back>← Back</button>'
      + '<button type="button" class="button primary" data-start' + (startDisabled ? ' disabled' : '') + '>Get started →</button></div>';

    // Still loading the price → re-render once it lands to fill the price + $/day.
    function reRenderIfOpen() { if (state.step === 1 && overlay.classList.contains('open')) renderResult(); }
    if (uc === undefined) fetchBest(g.objective).then(reRenderIfOpen);

    body.querySelectorAll('[data-count]').forEach(function (btn) {
      btn.addEventListener('click', function () { state.count = parseInt(btn.getAttribute('data-count'), 10); renderResult(); });
    });
    var customInp = body.querySelector('[data-custom]');
    if (customInp) {
      customInp.addEventListener('input', function () {
        var v = parseInt(customInp.value.replace(/[^0-9]/g, ''), 10);
        state.count = (!isNaN(v) && v > 0) ? v : null;
        // Update only the day hints + summary + start state without stealing focus.
        var day = state.count != null ? budgetForCount(state.count, state.budgetUnitCost) : null;
        var hint = customInp.parentElement.querySelector('.pm-tier-day');
        if (hint) hint.innerHTML = day != null ? '~' + fmtUsd(day) + ' / day' : '&nbsp;';
        body.querySelectorAll('.pm-tier[data-count]').forEach(function (t) { t.classList.remove('sel'); });
        customInp.parentElement.classList.toggle('sel', state.count != null);
        var startBtn = body.querySelector('[data-start]');
        if (startBtn) { if (state.count != null && state.budgetUnitCost != null) startBtn.removeAttribute('disabled'); else startBtn.setAttribute('disabled', ''); }
      });
    }
    body.querySelector('[data-back]').addEventListener('click', function () { state.step = 0; render(); });
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

  // Warm both endpoints early so the price step is instant.
  function warm() { GOALS.forEach(function (g) { fetchBest(g.objective); }); fetchProjection(); }
  if ('requestIdleCallback' in window) requestIdleCallback(warm);
  else setTimeout(warm, 1200);
})();
