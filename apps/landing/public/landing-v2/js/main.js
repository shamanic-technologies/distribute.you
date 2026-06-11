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

  /* ── Bar chart loop ── */
  // Bars grouped by day (indices into querySelectorAll('.uid-chart-bar'))
  const DAY_GROUPS = [[0,1],[2,3,4],[5,6,7],[8,9],[10,11,12],[13,14,15],[16,17]];

  function runBarsLoop() {
    const bars = dashEl.querySelectorAll('.uid-chart-bar');

    // Reset all
    bars.forEach(b => {
      b.style.transition = 'none';
      b.style.transform  = 'scaleY(0)';
    });

    // After reset frame, grow day by day
    let delay = 60;
    DAY_GROUPS.forEach(group => {
      group.forEach(idx => {
        const bar = bars[idx];
        if (!bar) return;
        setTimeout(() => {
          bar.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
          bar.style.transform  = 'scaleY(1)';
        }, delay);
        delay += 30;
      });
      delay += 90; // pause between days
    });

    // Loop: wait until all bars finished + pause, then restart
    setTimeout(runBarsLoop, delay + 2800);
  }

  function runDashAnim() {
    if (dashDone) return;
    dashDone = true;

    /* KPI count-up */
    const kpiNums = dashEl.querySelectorAll('.uid-kpi-n');
    [
      { target: 312, prefix: '', suffix: '',  decimals: 0, delay: 80  },
      { target: 84,  prefix: '', suffix: '',  decimals: 0, delay: 110 },
      { target: 7,   prefix: '', suffix: '',  decimals: 0, delay: 140 },
    ].forEach((d, i) => {
      const el = kpiNums[i];
      if (el) setTimeout(() => countUp(el, d.target, 900, d.prefix, d.suffix, d.decimals), d.delay);
    });

    /* ROI count-up (indices 1-3 skip budget which has id) */
    const roiVals = dashEl.querySelectorAll('.uid-roi-val');
    [
      { target: 45,   prefix: '',  suffix: 'x', decimals: 0, delay: 200 },
      { target: 9800, prefix: '$', suffix: '',  decimals: 0, delay: 260 },
      { target: 0.07, prefix: '$', suffix: '',  decimals: 2, delay: 320 },
    ].forEach((d, i) => {
      const el = roiVals[i + 1]; // +1 because index 0 is budget (managed by loop)
      if (el) {
        el.textContent = d.prefix + (d.decimals ? (0).toFixed(d.decimals) : '0') + d.suffix;
        setTimeout(() => countUp(el, d.target, 950, d.prefix, d.suffix, d.decimals), d.delay);
      }
    });

    /* Table rows stagger */
    dashEl.querySelectorAll('.uid-table tbody tr').forEach((row, i) => {
      setTimeout(() => row.classList.add('dash-row-in'), 500 + i * 100);
    });

    /* Start loops */
    runBarsLoop();
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
    { url: '/cold-email-cost-guide/cold-email-cost-per-contact', tag: 'Cost breakdown', title: 'Cold email cost per contact: the real numbers', desc: 'DIY stacks, agencies, and Distribute. What each approach actually costs once you count everything.' },
    { url: '/cold-email-cost-guide/linkedin-inmail-cost-vs-cold-email', tag: 'Channel comparison', title: 'LinkedIn InMail cost vs cold email: what the math says', desc: 'Sales Navigator at $3-5 per message vs cold email at $0.07. The full cost-per-reply breakdown.' },
    { url: '/cold-email-cost-guide/cold-email-roi', tag: 'ROI analysis', title: 'Cold email ROI: how to calculate real returns', desc: 'The formula, benchmarks, and sensitivity table. How deal size changes everything.' },
    { url: '/cold-email-for-saas-founders/ai-cold-email-saas-founders', tag: 'AI outreach', title: 'AI cold email for SaaS founders: does it actually work?', desc: 'Per-prospect research at $0.07 per contact with a 27% open rate. Real campaign numbers.' },
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
  if (!grid) return;

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
