import { setupComposerPopover } from './composer-popover.js';

const nav = document.querySelector('.forest-site-nav');
const trigger = nav?.querySelector('.forest-nav-menu-trigger');
const menu = document.querySelector('#forest-nav-menu');

if (nav && trigger && menu && typeof menu.showPopover === 'function' && !nav.dataset.mobileMenuReady) {
  // Keep one source for the desktop and mobile destinations. Without popover
  // support the existing two-row navigation remains available on small screens.
  for (const link of nav.querySelectorAll('.forest-nav-links a, .forest-nav-actions a')) {
    const item = link.cloneNode(true);
    item.className = 'forest-nav-menu-link';
    item.setAttribute('role', 'menuitem');
    item.tabIndex = -1;
    if (link.classList.contains('forest-nav-signin')) {
      const separator = document.createElement('div');
      separator.className = 'forest-nav-menu-separator';
      separator.setAttribute('role', 'separator');
      menu.append(separator);
    }
    if (link.classList.contains('forest-nav-action')) item.classList.add('forest-nav-menu-action');
    if (link.classList.contains('forest-nav-signup')) item.classList.add('forest-nav-menu-signup');
    menu.append(item);
  }
  menu.hidden = false;
  const popover = setupComposerPopover(trigger, menu);
  if (popover) {
    nav.dataset.mobileMenuReady = 'true';
    menu.addEventListener('click', event => {
      if (event.target instanceof Element && event.target.closest('a')) {
        popover.close();
        trigger.focus();
      }
    });
    window.addEventListener('resize', () => {
      if (getComputedStyle(trigger).display === 'none' && menu.matches(':popover-open')) popover.close();
    }, { passive: true });
    window.addEventListener('scroll', () => {
      if (menu.matches(':popover-open')) popover.close();
    }, { passive: true });
  }
}
