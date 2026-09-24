/* Local product illustrations only. Exploring a use case never calls an API. */
(() => {
  const root = document.querySelector('#gtm-plays');
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = 'true';
  const rail = root.querySelector('.plays-rail');
  const track = root.querySelector('.plays-track');
  const tabs = [...track.querySelectorAll('button')];
  const panel = root.querySelector('#plays-panel');
  // Scale the example as a desktop screen, leaving the title rail at touch size.
  if (typeof ResizeObserver === 'function') new ResizeObserver(([entry]) => {
    const width = entry.contentRect.width;
    panel.toggleAttribute('data-desktop-preview', width < 800);
    panel.style.setProperty('--preview-scale', String(Math.min(1, width / 1000)));
  }).observe(panel);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 0;
  let touching = false;
  let focused = false;
  let visible = false;
  let frame = 0;
  let lastTime = null;
  let position = 0;
  let cycleWidth = 0;
  let offsets = [];
  let widths = [];
  let railWidth = 0;
  const speed = 60; // Pixels per second, independent of title length or viewport.
  const gap = 12;
  let keyboard = false;

  rail.setAttribute('role', 'tablist');
  tabs.forEach((tab, index) => {
    tab.disabled = false;
    tab.id = `play-tab-${tab.dataset.play}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'plays-panel');
    tab.tabIndex = index === 0 ? 0 : -1;
  });
  panel.setAttribute('role', 'tabpanel');
  panel.tabIndex = 0;

  function render(index) {
    selected = (index + tabs.length) % tabs.length;
    const tab = tabs[selected];
    const template = root.querySelector(`[data-play-template="${tab.dataset.play}"]`);
    tabs.forEach((item, i) => {
      item.setAttribute('aria-selected', String(i === selected));
      item.tabIndex = i === selected ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tab.id);
    panel.dataset.view = tab.dataset.play;
    const window = panel.querySelector('.plays-workspace');
    const next = template.content.querySelector('.plays-workspace');
    window.replaceChildren(...next.cloneNode(true).childNodes);
  }

  // Six real tabs with a small edge-to-edge gap. Wrap outside the clipped rail: no clones,
  // DOM reordering or recentering at a selection boundary.
  function placeTabs() {
    tabs.forEach((tab, index) => {
      const distance = ((position - offsets[index] + cycleWidth * 1.5) % cycleWidth) - cycleWidth / 2;
      tab.style.transform = `translateX(${railWidth / 2 + distance - widths[index] / 2}px)`;
    });
  }

  function measure() {
    const progress = cycleWidth ? (position - offsets[selected] + cycleWidth) % cycleWidth : 0;
    widths = tabs.map(tab => tab.offsetWidth);
    offsets = [0];
    for (let i = 1; i < tabs.length; i++) offsets[i] = offsets[i - 1] + (widths[i - 1] + widths[i]) / 2 + gap;
    cycleWidth = widths.reduce((sum, width) => sum + width + gap, 0);
    // Keep one title's width outside the viewport so recycling is never visible.
    rail.style.maxWidth = `${cycleWidth - Math.max(...widths) - gap * 2}px`;
    railWidth = rail.clientWidth;
    const nextDistance = (widths[selected] + widths[(selected + 1) % tabs.length]) / 2 + gap;
    position = (offsets[selected] + Math.min(progress, nextDistance - 0.01)) % cycleWidth;
    track.style.height = `${Math.max(...tabs.map(tab => tab.offsetHeight)) + 16}px`;
    rail.scrollLeft = 0;
    placeTabs();
  }

  function advance(time) {
    frame = 0;
    if (!canAnimate()) return;
    if (lastTime !== null) position = (position + (time - lastTime) * speed / 1000) % cycleWidth;
    lastTime = time;
    placeTabs();
    // The incoming title crosses the rail's center. Switching the display never
    // resets the motion clock or changes the title positions.
    const next = offsets.findLastIndex(offset => offset <= position);
    if (next !== selected) render(next);
    frame = requestAnimationFrame(advance);
  }

  function canAnimate() {
    return !reducedMotion.matches && !touching && !focused && visible && !document.hidden;
  }

  function syncMotion() {
    const animate = canAnimate();
    root.dataset.animating = String(animate);
    if (!animate) { cancelAnimationFrame(frame); frame = 0; lastTime = null; }
    else if (!frame) frame = requestAnimationFrame(advance);
  }

  function choose(index, focusTab = false) {
    render(index);
    position = offsets[selected];
    lastTime = null;
    placeTabs();
    if (focusTab) tabs[selected].focus({ preventScroll: true });
    syncMotion();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => choose(index));
    tab.addEventListener('keydown', (event) => {
      const target = { ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      choose(target, true);
    });
  });
  // Keyboard inspection pauses; a resting pointer must not stall the showcase.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' || event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
      keyboard = true;
      focused = root.contains(document.activeElement);
      syncMotion();
    }
  }, true);
  document.addEventListener('pointerdown', () => { keyboard = false; focused = false; syncMotion(); }, true);
  rail.addEventListener('pointerdown', (event) => { touching = event.pointerType !== 'mouse'; syncMotion(); });
  const endTouch = () => { touching = false; syncMotion(); };
  document.addEventListener('pointerup', endTouch);
  document.addEventListener('pointercancel', endTouch);
  root.addEventListener('focusin', () => { focused = keyboard; syncMotion(); });
  root.addEventListener('focusout', (event) => { focused = keyboard && root.contains(event.relatedTarget); syncMotion(); });
  reducedMotion.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncMotion(); }, { threshold: .15 }).observe(panel);
  track.dataset.flow = 'continuous';
  new ResizeObserver(measure).observe(rail);
  render(0);
  measure();
  document.fonts.ready.then(measure);
  syncMotion();
})();
