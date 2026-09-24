/* Decorative, source-local timelines. Resting markup is the complete still view. */
export function setupBenefits(section) {
  if (!section || section.dataset.motionReady || !Element.prototype.animate || !window.IntersectionObserver) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cards = [...section.querySelectorAll('.why-card')];
  const timelines = new Map(cards.map(card => [card, []]));
  const visible = new Set();
  // Build deliberately, then leave the completed illustration still for several seconds.
  const duration = 12000;
  const easing = getComputedStyle(section).getPropertyValue('--ox-ease').trim();

  function animate(element, frames) {
    const animation = element.animate(frames, { duration, iterations: Infinity });
    animation.pause();
    timelines.get(element.closest('.why-card')).push(animation);
  }
  function build(element, start, from = 'translateY(8px) scale(.9)') {
    start *= .6;
    const opacity = getComputedStyle(element).opacity;
    animate(element, [
      { opacity: 0, transform: from, offset: 0 },
      { opacity: 0, transform: from, offset: start, easing },
      { opacity, transform: 'none', offset: start + .072 },
      { opacity, transform: 'none', offset: .95 },
      { opacity: 0, transform: 'none', offset: 1 },
    ]);
  }
  function create() {
    section.querySelectorAll('.why-tools > span').forEach((tile, i) => {
      build(tile, .02 + i * .018);
      build(tile.querySelector('.why-tool-cross'), .32 + i * .012, 'scale(.65)');
      const logo = tile.querySelector('img');
      if (logo) animate(logo, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: .192 }, { opacity: .35, offset: .288 }, { opacity: .35, offset: 1 }]);
    });
    build(section.querySelector('.why-converge'), .27, 'translateX(-8px)');
    build(section.querySelector('.why-oxygen-mark'), .3, 'scale(.75)');
    section.querySelectorAll('.why-channel').forEach((channel, i) => {
      const [x, y] = channel.dataset.from.split(',');
      build(channel, .08 + i * .04, `translate(${Number(x) / 46 * 100}%, ${Number(y) / 46 * 100}%) scale(.4)`);
      build(channel.querySelector('.why-badge'), .38 + i * .025, 'scale(.7)');
      channel.querySelectorAll('.why-badge > span').forEach((digit, index) => {
        const start = .3 + i * .012 + index * .065;
        const end = index === 4 ? 1 : start + .065;
        animate(digit, [
          { opacity: 0, offset: 0 }, { opacity: 0, offset: start },
          { opacity: 1, offset: start + .008 }, { opacity: 1, offset: end - .008 },
          { opacity: 0, offset: end }, { opacity: 0, offset: 1 },
        ]);
      });
    });
    build(section.querySelector('.why-distribution-wires'), .36, 'none');
    section.querySelectorAll('.why-primitive').forEach((node, i) => build(node, .03 + i * .09));
    build(section.querySelector('.why-flow-wires'), .35, 'none');
    section.querySelectorAll('.why-flow-dot').forEach((dot, index) => {
      const points = dot.dataset.route.split(' ');
      const start = .4 + index * .06;
      const position = point => `translate(${Number(point.split(',')[0]) / 360 * 100}cqw, ${Number(point.split(',')[1]) / 360 * 100}cqw)`;
      animate(dot, [
        { opacity: 0, transform: position(points[0]), offset: 0 },
        { opacity: 0, transform: position(points[0]), offset: start },
        ...points.map((point, i) => ({ opacity: 1, transform: position(point), offset: start + .01 + i * .14 })),
        { opacity: 0, offset: start + .16 }, { opacity: 0, offset: 1 },
      ]);
    });
    build(section.querySelector('.why-knowledge-core'), .01, 'scale(.8)');
    section.querySelectorAll('.why-graph-branch').forEach((branch, i) => build(branch, .1 + i * .055, 'none'));
    section.querySelectorAll('.why-graph-leaf').forEach((leaf, i) => build(leaf, .42 + i * .04, 'none'));
  }
  function sync() {
    if (reduced.matches) {
      timelines.forEach(animations => { animations.forEach(animation => animation.cancel()); animations.length = 0; });
    } else {
      if (![...timelines.values()].some(animations => animations.length)) create();
      timelines.forEach((animations, card) => animations.forEach(animation => {
        if (document.hidden || !visible.has(card)) animation.pause();
        else animation.play();
      }));
    }
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    });
    sync();
  }, { threshold: .15 });
  cards.forEach(card => observer.observe(card));
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  section.dataset.motionReady = 'true';
  sync();
}

setupBenefits(document.querySelector('.why-section'));
