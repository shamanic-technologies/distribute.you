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
