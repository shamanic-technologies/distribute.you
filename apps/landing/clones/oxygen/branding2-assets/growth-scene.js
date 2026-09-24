/** A paused video scrubbed by the position of the pinned hero. */
export function createGrowthScene({ page, hero, onChange, onPreferenceChange }) {
  const video = document.getElementById('growth-film');
  const track = document.getElementById('hero-scroll');
  const source = video.querySelector('source');
  const connection = navigator.connection;
  let active = false;
  let suspended = true;
  let loaded = false;
  let status = 'idle';
  let target = 0;
  let timer;
  let frame;

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

  function sync({ selected, paused, reduced, visible, retry = false }) {
    active = selected;
    const saveData = Boolean(connection?.saveData);
    const still = reduced || saveData || shortViewport();
    page.classList.toggle('growth-static', selected && still);
    suspended = paused || still || !visible || document.hidden || page.hidden;
    video.pause();
    if (!active || suspended) {
      clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      return;
    }
    if (retry || (!loaded && status !== 'error')) {
      loaded = true;
      publish('loading');
      video.preload = 'auto';
      source.src = source.dataset.src;
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
