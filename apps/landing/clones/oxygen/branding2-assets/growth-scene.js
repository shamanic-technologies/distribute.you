/** A paused video scrubbed by the position of the pinned hero. */
export function createGrowthScene({ page, hero, onChange, onPreferenceChange }) {
  const video = document.getElementById('growth-film');
  const track = document.getElementById('hero-scroll');
  const source = video.querySelector('source');
  const connection = navigator.connection;
  // Phones, 3:5 or narrower, see only the film's centre. They load a 2.9 MB
  // portrait encode of it, and only from their first scroll or touch: nobody
  // sees the film move before scrolling, and fetched with the page the 16 MB
  // film's first frame became a phone's largest paint (8.9 s on throttled 4G,
  // 2026-10-15).
  const portrait = window.matchMedia?.('(max-aspect-ratio: 3/5)');
  const engageEvents = ['scroll', 'touchstart', 'pointerdown', 'keydown', 'wheel'];
  let engaged = false;
  let active = false;
  let suspended = true;
  let loaded = false;
  let status = 'idle';
  let target = 0;
  let timer;
  let frame;
  // The film is 16 MB. It is fetched only after the document's own load event,
  // so the poster (the hero's largest paint), fonts and stylesheets never share
  // the connection with it; a sync before then keeps the poster and resumes on load.
  let documentLoaded = document.readyState === 'complete';
  let lastSync;
  if (!documentLoaded) {
    addEventListener('load', () => {
      documentLoaded = true;
      if (lastSync) sync(lastSync);
    }, { once: true });
  }

  function engage() {
    engaged = true;
    for (const type of engageEvents) removeEventListener(type, engage);
    if (lastSync) sync(lastSync);
  }
  for (const type of engageEvents) addEventListener(type, engage, { passive: true });

  function shortViewport() {
    const barHeight = document.querySelector('.study-bar')?.getBoundingClientRect().height || 0;
    return innerHeight - barHeight < 560;
  }

  function publish(next) {
    status = next;
    page.classList.toggle('growth-ready', next === 'ready');
    onChange();
  }

  function fail() {
    clearTimeout(timer);
    publish('error');
  }

  function seek() {
    frame = undefined;
    if (!active || suspended || status === 'error' || video.readyState < 2 || video.seeking) return;
    // Wait for each decode before seeking again; rapid wheel/touch events retain
    // only the latest target, including reverse scrolling and anchor jumps.
    if (Math.abs(video.currentTime - target) > 1 / 48) video.currentTime = target;
  }

  function scheduleSeek() {
    if (frame === undefined) frame = requestAnimationFrame(seek);
  }

  function update() {
    if (!active || suspended) return;
    const top = Number.parseFloat(page.style.getPropertyValue('--study-height')) || 0;
    const distance = track.offsetHeight - hero.offsetHeight;
    const progress = Math.max(0, Math.min(1, (top - track.getBoundingClientRect().top) / Math.max(1, distance)));
    if (Number.isFinite(video.duration)) target = progress * Math.max(0, video.duration - 1 / 24);
    page.style.setProperty('--growth-progress', String(progress));
    scheduleSeek();
  }

  function sync(options) {
    const { selected, paused, reduced, visible, retry = false } = options;
    lastSync = { ...options, retry: false };
    active = selected;
    const saveData = Boolean(connection?.saveData);
    const still = reduced || saveData || shortViewport();
    page.classList.toggle('growth-static', selected && still);
    suspended = paused || still || !visible || document.hidden || page.hidden;
    // Never pause the film before it has a source: that runs the media
    // resource selection algorithm, which WebKit lets hold the load event open
    // (see pricing-motion.js), and the film itself waits for that event.
    if (source.getAttribute('src')) video.pause();
    if (!active || suspended) {
      clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      return;
    }
    const phone = Boolean(portrait?.matches && source.dataset.srcPortrait);
    if (documentLoaded && (!phone || engaged) && (retry || (!loaded && status !== 'error'))) {
      loaded = true;
      publish('loading');
      video.preload = 'auto';
      source.src = phone ? source.dataset.srcPortrait : source.dataset.src;
      video.load();
    }
    clearTimeout(timer);
    if (status === 'loading') timer = setTimeout(fail, 15000);
    update();
  }

  video.addEventListener('loadeddata', () => {
    clearTimeout(timer);
    publish('ready');
    update();
  });
  video.addEventListener('seeked', scheduleSeek);
  video.addEventListener('error', fail);
  source.addEventListener('error', fail);
  connection?.addEventListener?.('change', onPreferenceChange);

  return { sync, update, get status() { return connection?.saveData ? 'saving' : shortViewport() ? 'static' : status; } };
}
