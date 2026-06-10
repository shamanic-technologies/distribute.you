/* ═══════════════════════════════════════════════
   DISTRIBUTE: shared nav + footer components
   ═══════════════════════════════════════════════ */

const NAV_HTML = `
<nav id="nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo">
      <img src="/logo/logo-distribute.svg" class="nav-logo-img" alt="Distribute">
      distribute <span class="nav-chip">beta</span>
    </a>
    <ul class="nav-links">
      <li><a href="/how-it-works" data-path="/how-it-works">How it works</a></li>
      <li><a href="/use-cases" data-path="/use-cases">Use cases</a></li>
      <li><a href="/#pricing">Pricing</a></li>
    </ul>
    <div class="nav-right">
      <button class="nav-toggle" id="themeBtn" aria-label="Switch to light mode">
        <svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      </button>
      <a href="/sign-in" class="btn btn-g">Sign in</a>
      <a href="/sign-up" class="btn btn-p">Start free</a>
      <button class="nav-burger" id="navBurger" aria-label="Open menu" aria-expanded="false">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><line x1="3" y1="6" x2="17" y2="6"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="14" x2="17" y2="14"/></svg>
      </button>
    </div>
  </div>
</nav>
<div class="nav-mobile-overlay" id="navMobile" aria-hidden="true">
  <div class="nav-mobile-top">
    <a href="/" class="nav-mobile-logo">
      <img src="/logo/logo-distribute.svg" alt="">
      distribute
    </a>
    <button class="nav-mobile-close" id="navClose" aria-label="Close menu">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><line x1="4" y1="4" x2="16" y2="16"/><line x1="16" y1="4" x2="4" y2="16"/></svg>
    </button>
  </div>
  <ul class="nav-mobile-links">
    <li><a href="/how-it-works">How it works</a></li>
    <li><a href="/use-cases">Use cases</a></li>
    <li><a href="/#pricing">Pricing</a></li>
  </ul>
  <div class="nav-mobile-actions">
    <a href="/sign-in" class="btn btn-g btn-lg">Sign in</a>
    <a href="/sign-up" class="btn btn-p btn-lg">Start free</a>
  </div>
</div>`;

const FOOTER_HTML = `
<footer>
  <div class="wrap">
    <div class="ft-grid">
      <div class="ft-brand">
        <a href="/" class="nav-logo">
          <img src="/logo/logo-distribute.svg" class="nav-logo-img" alt="Distribute">
          distribute <span class="nav-chip">beta</span>
        </a>
        <p>AI outreach automation for solo founders and micro-SaaS builders. Drop a URL, set a budget, get qualified replies.</p>
        <p class="ft-by">Built by <a href="https://twitter.com/kevinlourd">@kevinlourd</a> and contributors.</p>
      </div>
      <div class="ft-col">
        <h4>Product</h4>
        <ul>
          <li><a href="/how-it-works">How it works</a></li>
          <li><a href="/use-cases">Use cases</a></li>
          <li><a href="/#pricing">Pricing</a></li>
        </ul>
      </div>
      <div class="ft-col">
        <h4>Guides</h4>
        <ul>
          <li><a href="/cold-email-cost-guide">Cold email cost guide</a></li>
          <li><a href="/cold-email-vs-linkedin">Cold email vs LinkedIn</a></li>
          <li><a href="/cold-email-for-saas-founders">Cold email for SaaS founders</a></li>
          <li><a href="/cold-email-cost-per-contact">Cost per contact breakdown</a></li>
          <li><a href="/linkedin-inmail-cost-vs-cold-email">InMail cost vs cold email</a></li>
          <li><a href="/ai-cold-email-saas-founders">AI cold email for SaaS</a></li>
        </ul>
      </div>
      <div class="ft-col">
        <h4>Company</h4>
        <ul>
          <li><a href="https://x.com/distribute_you">Twitter / X</a></li>
          <li><a href="/sign-in">Sign in</a></li>
          <li><a href="/sign-up">Sign up</a></li>
        </ul>
      </div>
    </div>
    <div class="ft-bottom">
      <span class="ft-copy">© 2026 distribute. MIT License. 100% open source.</span>
      <div class="ft-links">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </div>
    </div>
  </div>
</footer>`;

(function () {
  /* ── Inject nav (sync — runs right after #site-nav div) ── */
  const navEl = document.getElementById('site-nav');
  if (navEl) navEl.outerHTML = NAV_HTML;

  /* ── Inject footer after DOM is ready ── */
  function injectFooter() {
    const ftEl = document.getElementById('site-footer');
    if (ftEl) ftEl.outerHTML = FOOTER_HTML;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }

  /* ── Active nav link ── */
  const path = window.location.pathname.replace(/\/$/, '');
  document.querySelectorAll('#nav [data-path]').forEach(a => {
    if (a.dataset.path === path) a.classList.add('active');
  });

  /* ── Theme ── */
  const html = document.documentElement;
  function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('dt', theme);
    const btn = document.getElementById('themeBtn');
    if (btn) btn.setAttribute('aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
  setTheme(localStorage.getItem('dt') || 'light');
  document.getElementById('themeBtn')?.addEventListener('click', () => {
    setTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ── Nav scroll ── */
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }

  /* ── Burger menu ── */
  function openMobileMenu() {
    const m = document.getElementById('navMobile');
    const b = document.getElementById('navBurger');
    if (!m) return;
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    b?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeMobileMenu() {
    const m = document.getElementById('navMobile');
    const b = document.getElementById('navBurger');
    if (!m) return;
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
    b?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  document.getElementById('navBurger')?.addEventListener('click', openMobileMenu);
  document.getElementById('navClose')?.addEventListener('click', closeMobileMenu);
  document.getElementById('navMobile')?.addEventListener('click', e => {
    if (e.target === document.getElementById('navMobile')) closeMobileMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('navMobile')?.classList.contains('open'))
      closeMobileMenu();
  });
})();
