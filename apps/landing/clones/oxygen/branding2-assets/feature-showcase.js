// Local, illustrative branding preview. No product data or provider calls.
//
// Scroll-driven onboarding phases. The showcase (phase list + stage) pins while
// its runway scrolls past; the runway is one step per phase, so the phase in
// view follows the scroll position and its description opens while the others
// stay collapsed. Selecting a phase scrolls the page to that phase's step, so
// the scroll position and the selected phase never disagree. When the pinned
// pair would not fit the viewport (short or narrow screens), the phases fall
// back to plain selection with no pinning.
//
// Each phase's scene builds in steps. While the pair is pinned, the scroll
// position drives the build: the scene grows through the first half of its
// phase's step and holds complete through the second half, so scrolling is the
// animation. Where the pair is not pinned, the active scene's --step counts up
// one beat at a time instead, holds, clears and grows again. Idle motion inside
// the scenes (drift, link traces, the agent mark) runs continuously. Motion
// stops (and shows the finished picture) under reduced motion, when the visitor
// pauses it, when the page is hidden, or when the stage is off screen.

/** Which phase a runway progress (0..1) lands on, and how far through it. */
export function phaseAt(progress, count) {
  const scaled = Math.min(Math.max(progress, 0), 1) * count;
  const index = Math.min(Math.floor(scaled), count - 1);
  return { index, within: Math.min(Math.max(scaled - index, 0), 1) };
}

/** The --step value at a scroll position within a phase (0..1): the first element is
 * there from the start, and the scene is complete by the middle of the phase. */
export function sceneStepFor(within, steps) {
  if (steps <= 0) return 0;
  return Math.min(steps, Math.max(1, 1 + within * 2 * (steps - 1)));
}

/** The --step value for a beat of a scene with `steps` steps: reveal, hold four beats, clear. */
export function sceneStepAt(beat, steps) {
  const cycle = steps + 5;
  const position = ((beat % cycle) + cycle) % cycle;
  return Math.min(position, steps);
}

export function createFeatureShowcase(runway, { view = window, minimumGap = 48, beatMs = 600 } = {}) {
  const showcase = runway.querySelector('.feature-showcase');
  const stage = runway.querySelector('.feature-stage');
  const tabs = [...runway.querySelectorAll('[role=tab]')];
  const panels = [...runway.querySelectorAll('[role=tabpanel]')];
  const scenes = panels.map(panel => panel.querySelector('[data-scene-steps]'));
  const landscapes = [...runway.querySelectorAll('.feature-landscape')];
  const motionButton = runway.querySelector('[data-feature-motion]');
  const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const count = tabs.length;
  let active = -1;
  let pinned = true;
  let frame = null;
  // A phase selected by click or keyboard, held until the page has scrolled
  // there, so the phases the smooth scroll passes through do not flash by.
  let pending = null;
  let pendingUntil = 0;
  let motionPaused = false;
  let stageInView = true;
  let beatTimer = null;
  let beat = 0;
  // The tallest showcase seen at this viewport size. On stacked layouts the phase
  // list changes height as descriptions open, and pinning on the live height
  // would move the pinned block and its phase boundaries with every switch.
  let tallest = 0;
  let lastWithin = 0;
  // Geometry held while the pair is inside its runway: measuring live would let
  // the phase list's changing height move the boundaries under the reader.
  let frozen = null;

  function motionAllowed() {
    return !motionPaused && !reducedMotion.matches && stageInView && !runway.ownerDocument.hidden;
  }

  function syncScene() {
    if (beatTimer !== null) {
      view.clearInterval(beatTimer);
      beatTimer = null;
    }
    runway.dataset.motionPaused = String(!motionAllowed());
    if (motionButton) {
      motionButton.setAttribute('aria-pressed', String(motionPaused));
      motionButton.textContent = motionPaused ? 'Play animations' : 'Pause animations';
    }
    const scene = scenes[active];
    if (!scene) return;
    const steps = Number(scene.dataset.sceneSteps) || 0;
    if (!motionAllowed()) {
      scene.style.setProperty('--step', String(steps));
      return;
    }
    if (pinned) {
      // The scroll position owns the build while pinned; render() keeps it current.
      scene.style.setProperty('--step', sceneStepFor(lastWithin, steps).toFixed(2));
      return;
    }
    beat = 1;
    scene.style.setProperty('--step', String(sceneStepAt(beat, steps)));
    beatTimer = view.setInterval(() => {
      beat += 1;
      scene.style.setProperty('--step', String(sceneStepAt(beat, steps)));
    }, beatMs);
  }

  function render(index, within) {
    lastWithin = within;
    if (index !== active) {
      active = index;
      tabs.forEach((tab, i) => {
        const selected = i === index;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[i].classList.toggle('is-active', selected);
        panels[i].setAttribute('aria-hidden', String(!selected));
        panels[i].inert = !selected;
        panels[i].tabIndex = selected ? 0 : -1;
        landscapes[i]?.classList.toggle('is-active', selected);
      });
      syncScene();
    } else if (pinned && motionAllowed() && scenes[active]) {
      scenes[active].style.setProperty('--step', sceneStepFor(within, Number(scenes[active].dataset.sceneSteps) || 0).toFixed(2));
    }
    runway.style.setProperty('--feature-progress', within.toFixed(3));
  }

  // Pin the pair centred in the viewport when it fits; otherwise unpin.
  function measure() {
    if (frozen !== null && pinned && view.scrollY >= frozen.start && view.scrollY <= frozen.start + frozen.travel) return frozen;
    tallest = Math.max(tallest, showcase.offsetHeight);
    const height = tallest;
    pinned = height + minimumGap <= view.innerHeight;
    runway.dataset.featurePinned = String(pinned);
    const pinTop = pinned ? Math.max(minimumGap / 2, Math.round((view.innerHeight - height) / 2)) : 0;
    runway.style.setProperty('--feature-pin-top', `${pinTop}px`);
    const start = runway.getBoundingClientRect().top + view.scrollY - pinTop;
    frozen = { start, travel: Math.max(runway.offsetHeight - showcase.offsetHeight, 1) };
    return frozen;
  }

  function update() {
    frame = null;
    const wasPinned = pinned;
    const { start, travel } = measure();
    if (!pinned) {
      render(active < 0 ? 0 : active, 1);
    } else {
      const { index, within } = phaseAt((view.scrollY - start) / travel, count);
      if (pending !== null && (index === pending || view.performance.now() > pendingUntil)) pending = null;
      if (pending !== null) render(pending, 0);
      else render(index, within);
    }
    // Pinning decides whether the scroll or a timer builds the scene.
    if (wasPinned !== pinned) syncScene();
  }

  function requestUpdate() {
    if (frame === null) frame = view.requestAnimationFrame(update);
  }

  function select(index, focus = false) {
    const target = (index + count) % count;
    const { start, travel } = measure();
    if (pinned) {
      pending = target;
      pendingUntil = view.performance.now() + 1200;
      // Land in the middle of the phase's step so a nudge does not flip it back.
      view.scrollTo({ top: Math.round(start + ((target + 0.5) * travel) / count), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      render(target, 0);
    } else {
      render(target, 1);
    }
    if (focus) tabs[target].focus({ preventScroll: true });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      const destination = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: count - 1 }[event.key];
      if (destination === undefined) return;
      event.preventDefault();
      select(destination, true);
    });
  });
  motionButton?.addEventListener('click', () => {
    motionPaused = !motionPaused;
    syncScene();
  });
  reducedMotion.addEventListener?.('change', syncScene);
  runway.ownerDocument.addEventListener('visibilitychange', syncScene);
  if (stage && typeof view.IntersectionObserver === 'function') {
    new view.IntersectionObserver(entries => {
      stageInView = entries[0].isIntersecting;
      syncScene();
    }, { threshold: 0 }).observe(stage);
  }
  // The user taking over the scroll releases a pending selection.
  ['wheel', 'touchstart'].forEach(type => view.addEventListener(type, () => { pending = null; }, { passive: true }));
  view.addEventListener('scroll', requestUpdate, { passive: true });
  view.addEventListener('resize', () => { tallest = 0; frozen = null; requestUpdate(); }, { passive: true });
  if (typeof view.ResizeObserver === 'function') {
    new view.ResizeObserver(requestUpdate).observe(showcase);
    // The compact stage keeps complete desktop scenes, including every flow node
    // and agent card. Its surrounding text and tabs remain unscaled.
    if (stage) new view.ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      stage.toggleAttribute('data-compact-scene', width < 460);
      stage.style.setProperty('--feature-scene-scale', String(Math.min(1, width / 460)));
    }).observe(stage);
  }
  // Only now may the stylesheet hide scene steps: without the script the complete picture stays visible.
  runway.dataset.featureReady = 'true';
  update();

  return { select, update };
}

const runway = document.querySelector('[data-feature-showcase]');
if (runway) createFeatureShowcase(runway);
