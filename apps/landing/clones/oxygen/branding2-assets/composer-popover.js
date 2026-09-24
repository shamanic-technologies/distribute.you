/** Native top-layer menus share positioning and keyboard navigation. */
export function setupComposerPopover(trigger, menu) {
  if (typeof menu.showPopover !== 'function') return null;
  const options = [...menu.querySelectorAll('[role^="menuitem"]')];
  trigger.hidden = false;
  function positionMenu() {
    if (!menu.matches(':popover-open')) return;
    const rect = trigger.getBoundingClientRect();
    const gutter = 12;
    const gap = 8;
    const height = menu.offsetHeight;
    const above = rect.top - height - gap;
    const top = above >= gutter ? above : Math.max(gutter, Math.min(rect.bottom + gap, innerHeight - height - gutter));
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(gutter, Math.min(rect.left, innerWidth - menu.offsetWidth - gutter))}px`;
  }
  function closeMenu() {
    menu.hidePopover();
    trigger.setAttribute('aria-expanded', 'false');
  }
  function openMenu() {
    menu.showPopover();
    trigger.setAttribute('aria-expanded', 'true');
    positionMenu();
    (options.find(option => option.getAttribute('aria-checked') === 'true') ?? options[0]).focus();
  }
  trigger.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu();
    }
  });
  menu.addEventListener('toggle', () => {
    const open = menu.matches(':popover-open');
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      positionMenu();
      if (!menu.contains(document.activeElement)) {
        (options.find(option => option.getAttribute('aria-checked') === 'true') ?? options[0]).focus();
      }
    }
  });
  menu.addEventListener('keydown', event => {
    const index = options.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % options.length;
    if (event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = options.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      options[next].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      trigger.focus();
    } else if (event.key === 'Tab') {
      closeMenu();
      trigger.focus();
    }
  });
  window.addEventListener('resize', positionMenu, { passive: true });
  window.addEventListener('scroll', positionMenu, { passive: true });
  return { close: closeMenu };
}
