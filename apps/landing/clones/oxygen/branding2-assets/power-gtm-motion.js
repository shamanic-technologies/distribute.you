(() => {
  // Power GTM ambient motion: the provider orbit and the agent-mark signal.
  // Founder-directed (2026-09-15): no visible pause control. Each animation
  // still stops for reduced motion, a hidden document and an offscreen target.
  const targets = [...document.querySelectorAll('#power-gtm [data-ambient-motion]')];
  if (!targets.length) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const visible = new Map(targets.map((target) => [target, false]));
  const update = () => {
    for (const target of targets) {
      target.dataset.running = String(Boolean(visible.get(target)) && !document.hidden && !reducedMotion.matches);
    }
  };
  reducedMotion.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
    update();
  });
  for (const target of targets) observer.observe(target);
  update();
})();
