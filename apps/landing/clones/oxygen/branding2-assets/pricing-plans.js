import { setupComposerPopover } from './composer-popover.js';

(() => {
  const selector = document.querySelector('#pricing-credits');
  const menu = document.querySelector('#pricing-credit-menu');
  const choice = document.querySelector('#pricing-credit-choice');
  const price = document.querySelector('#paid-price');
  const allowance = document.querySelector('#paid-credit-allowance');
  // The CTA carries the chosen rung through sign-up, so the plan the visitor
  // picked here is the plan /subscribe preselects. Without this the selector is
  // a price display that forgets the choice the moment you click Get started.
  const cta = document.querySelector('[data-pricing-cta]');
  if (!selector || !menu || !choice || !price || !allowance) return;
  const popover = setupComposerPopover(selector, menu);
  if (!popover) return;
  const options = [...menu.querySelectorAll('[role="menuitemradio"]')];

  const format = new Intl.NumberFormat('en-US');
  const update = (option) => {
    const monthlyPrice = Number(option.dataset.price);
    const credits = Number(option.dataset.credits);
    if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0 || !Number.isFinite(credits) || credits <= 0) return;
    price.textContent = format.format(monthlyPrice);
    allowance.textContent = `${format.format(credits)} credits every month`;
    choice.textContent = `${format.format(credits)} credits — $${format.format(monthlyPrice)}/month`;
    const planKey = option.dataset.plan;
    if (cta && planKey) cta.href = `/subscribe?plan=${encodeURIComponent(planKey)}`;
    options.forEach(item => item.setAttribute('aria-checked', String(item === option)));
    popover.close();
    selector.focus();
  };

  options.forEach(option => option.addEventListener('click', () => update(option)));
  menu.hidden = false;
  selector.disabled = false;
  document.querySelector('#pricing-tier-fallback')?.setAttribute('hidden', '');
})();
