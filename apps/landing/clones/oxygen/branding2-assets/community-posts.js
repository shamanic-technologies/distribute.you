/* Keep every original post readable when continuous motion is unavailable or paused. */
(() => {
  const section = document.querySelector('.community-section');
  if (!section || !Element.prototype.animate) return;
  const grid = section.querySelector('.community-grid');
  const toggle = section.querySelector('.community-motion');
  const originals = [...grid.querySelectorAll('.community-card')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const touch = matchMedia('(pointer: coarse)');
  let paused = false;
  let pointerTarget = null;
  let inView = false;
  let reels = [];
  let layoutFrame;

  const columnCount = () => getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const staticMode = () => paused || reduced.matches || touch.matches;
  const blocked = () => staticMode() || !inView || document.hidden;
  const heightOf = card => card.getBoundingClientRect().height;
  function clone(index) {
    const card = originals[index].cloneNode(true);
    card.dataset.post = index;
    return card;
  }
  function sync() {
    reels.forEach(reel => {
      if (blocked()) reel.animation?.pause();
      else reel.animation?.play();
    });
  }
  function scroll(reel, initialOffset = 0) {
    // Recycle outside the crop so both directions preserve the visible strip.
    if (!reel.upward) reel.track.prepend(reel.track.lastElementChild);
    const distance = heightOf(reel.track.firstElementChild) + reel.gap;
    const edge = `translateY(-${distance}px)`;
    reel.animation = reel.track.animate(
      [{ transform: reel.upward ? 'translateY(0)' : edge }, { transform: reel.upward ? edge : 'translateY(0)' }],
      { duration: distance / 30 * 1000, easing: 'linear', fill: 'forwards' },
    );
    reel.animation.currentTime = initialOffset / 30 * 1000;
    reel.animation.onfinish = () => {
      if (reel.upward) reel.track.append(reel.track.firstElementChild);
      reel.animation.cancel();
      scroll(reel);
    };
    sync();
  }
  function render() {
    reels.forEach(reel => reel.animation?.cancel());
    reels = [];
    toggle.textContent = paused ? 'Resume post animation' : 'Pause animation and show all posts';
    grid.classList.toggle('community-grid--scrolling', !staticMode());
    if (staticMode()) {
      grid.replaceChildren(...originals);
      return;
    }
    const columns = columnCount();
    reels = Array.from({ length: columns }, (_, column) => {
      const viewport = document.createElement('div');
      viewport.className = 'community-reel';
      const track = document.createElement('div');
      track.className = 'community-track';
      // Each column has its own repeating sequence; every source appears once
      // across the three sequences, regardless of the responsive column count.
      const indices = originals.map((_, index) => index).filter(index => index % columns === column);
      track.append(...indices.map(clone));
      viewport.append(track);
      return { viewport, track, indices, upward: column === 1, offset: [36, 72, 108][column], gap: 0, animation: null };
    });
    grid.replaceChildren(...reels.map(reel => reel.viewport));
    reels.forEach(reel => {
      reel.gap = parseFloat(getComputedStyle(reel.track).gap);
      const heights = [...reel.track.children].map(heightOf);
      const cycleHeight = heights.reduce((sum, height) => sum + height + reel.gap, 0);
      const required = reel.viewport.clientHeight + Math.max(...heights) + reel.gap;
      // Complete copies make the seam repeat in order, with enough offscreen
      // content that recycling can never uncover the bottom of the column.
      for (let height = cycleHeight; height < required; height += cycleHeight) {
        const copies = reel.indices.map(clone);
        copies.forEach(card => {
          card.setAttribute('aria-hidden', 'true');
          card.querySelectorAll('a').forEach(link => { link.tabIndex = -1; });
        });
        reel.track.append(...copies);
      }
      scroll(reel, reel.offset);
    });
  }
  function refresh() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(render);
  }
  toggle.hidden = reduced.matches || touch.matches;
  toggle.addEventListener('click', () => { paused = !paused; render(); });
  grid.addEventListener('pointerdown', event => { pointerTarget = event.target.closest('a'); });
  grid.addEventListener('pointerup', () => { pointerTarget = null; });
  grid.addEventListener('pointercancel', () => { pointerTarget = null; });
  grid.addEventListener('keydown', () => { pointerTarget = null; });
  grid.addEventListener('focusin', event => {
    if (staticMode()) return;
    if (pointerTarget === event.target) { sync(); return; }
    // Keyboard navigation opens the complete static reading view instead of
    // leaving a focused post clipped or allowing a moving link to escape focus.
    const card = event.target.closest('.community-card');
    const linkIndex = [...card?.querySelectorAll('a') ?? []].indexOf(event.target);
    const original = originals[Number(card?.dataset.post)];
    paused = true;
    render();
    const target = original?.querySelectorAll('a')[linkIndex];
    queueMicrotask(() => target?.focus());
  });
  grid.addEventListener('focusout', () => queueMicrotask(sync));
  const preferencesChanged = () => {
    toggle.hidden = reduced.matches || touch.matches;
    render();
  };
  reduced.addEventListener('change', preferencesChanged);
  touch.addEventListener('change', preferencesChanged);
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver(entries => { inView = entries[0].isIntersecting; sync(); }).observe(grid);
  let lastWidth = 0;
  new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (Math.abs(width - lastWidth) < 1) return;
    lastWidth = width;
    refresh();
  }).observe(grid);
  document.fonts?.ready.then(refresh);
  window.addEventListener('pagehide', () => reels.forEach(reel => reel.animation?.pause()));
  window.addEventListener('pageshow', sync);
  render();
})();
