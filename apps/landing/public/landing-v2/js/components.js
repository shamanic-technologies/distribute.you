/* ═══════════════════════════════════════════════
   DISTRIBUTE: shared nav + footer components
   ═══════════════════════════════════════════════ */

const NAV_HTML = `
<nav id="nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo">
      <img src="/landing-v2/logo/logo-distribute.svg" class="nav-logo-img" alt="Distribute">
      distribute <span class="nav-chip">beta</span>
    </a>
    <ul class="nav-links">
      <li><a href="/how-it-works" data-path="/how-it-works">How it works</a></li>
      <li><a href="/use-cases" data-path="/use-cases">Use cases</a></li>
      <li><a href="/#pricing">Pricing</a></li>
    </ul>
    <div class="nav-right">
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
      <img src="/landing-v2/logo/logo-distribute.svg" alt="">
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
          <img src="/landing-v2/logo/logo-distribute.svg" class="nav-logo-img" alt="Distribute">
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
      <span class="ft-copy">&copy; 2026 distribute. MIT License. 100% open source.</span>
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