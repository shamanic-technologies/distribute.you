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

  function countUp(el, target, duration, prefix, suffix, decimals) {
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const val = ease * target;
      el.textContent = prefix + (decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString()) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function runDashAnim() {
    if (dashDone) return;
    dashDone = true;

    /* 1 — Bar chart: staggered grow from bottom */
    const chartBars = dashEl.querySelectorAll('.uid-chart-bar');
    chartBars.forEach((bar, i) => {
      const dayIndex = Math.floor(i / 3);
      const delay = dayIndex * 55 + (i % 3) * 18;
      setTimeout(() => { bar.style.transform = 'scaleY(1)'; }, delay);
    });

    /* 2 — KPI counters */
    const kpiNums = dashEl.querySelectorAll('.uid-kpi-n');
    const kpiData = [
      { target: 312, prefix: '',  suffix: '',  decimals: 0, delay: 80  },
      { target: 84,  prefix: '',  suffix: '',  decimals: 0, delay: 110 },
      { target: 7,   prefix: '',  suffix: '',  decimals: 0, delay: 140 },
      { target: 72,  prefix: '',  suffix: '%', decimals: 0, delay: 170 },
    ];
    kpiNums.forEach((el, i) => {
      const d = kpiData[i];
      if (!d) return;
      setTimeout(() => countUp(el, d.target, 900, d.prefix, d.suffix, d.decimals), d.delay);
    });

    /* 3 — Progress bar */
    const progressFill = dashEl.querySelector('.uid-kpi-progress-fill');
    if (progressFill) {
      setTimeout(() => { progressFill.style.width = '72%'; }, 200);
    }

    /* 4 — ROI values */
    const roiVals = dashEl.querySelectorAll('.uid-roi-val');
    const roiData = [
      { target: 45,   prefix: '',  suffix: 'x',  decimals: 0, delay: 250 },
      { target: 9800, prefix: '$', suffix: '',    decimals: 0, delay: 310 },
      { target: 0.07, prefix: '$', suffix: '',    decimals: 2, delay: 370 },
    ];
    roiVals.forEach((el, i) => {
      const d = roiData[i];
      if (!d) return;
      el.textContent = d.prefix + (d.decimals ? (0).toFixed(d.decimals) : '0') + d.suffix;
      setTimeout(() => countUp(el, d.target, 950, d.prefix, d.suffix, d.decimals), d.delay);
    });

    /* 5 — Table rows: staggered fade+slide */
    const rows = dashEl.querySelectorAll('.uid-table tbody tr');
    rows.forEach((row, i) => {
      setTimeout(() => { row.classList.add('dash-row-in'); }, 550 + i * 100);
    });
  }

  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) runDashAnim();
  }, { threshold: 0.25 }).observe(dashEl);
}
