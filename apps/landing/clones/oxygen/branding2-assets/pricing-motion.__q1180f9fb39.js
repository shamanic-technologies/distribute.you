// An independent scene: hero selection and scroll seeking never drive pricing.
// The scenery has no visible control. It plays only while the section is on
// screen and never under reduced-motion or data-saver preferences.
const section = document.getElementById('pricing');
const video = document.getElementById('pricing-film');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const connection = navigator.connection;
let visible = false;
let failed = false;
let timer;

function blocked() { return reduced.matches || connection?.saveData; }
// pause() on a film with no source yet runs the media resource selection
// algorithm, and WebKit then holds the document's load event open for good:
// in Playwright's WebKit the landing stayed `interactive` in 5 of 6 loads
// because this observer's first "not visible" callback paused the sourceless
// film (closeout 18, 2026-10-06). A film that never loaded has nothing to pause.
function pause() {
  if (video.querySelector('source').getAttribute('src')) video.pause();
}
function fail() {
  // A lazy <source data-src> can emit error before resource selection begins.
  // Only a source we activated can fail the scene permanently.
  if (!video.querySelector('source').getAttribute('src')) return;
  clearTimeout(timer);
  failed = true;
  pause();
  video.classList.remove('ready');
}
function sync() {
  if (!visible || failed || blocked() || document.hidden) {
    clearTimeout(timer);
    pause();
    if (blocked()) video.classList.remove('ready');
    return;
  }
  const source = video.querySelector('source');
  if (!source.getAttribute('src')) {
    source.src = source.dataset.src;
    video.load();
  }
  clearTimeout(timer);
  timer = setTimeout(() => { if (video.readyState < 2) fail(); }, 12000);
  video.play().catch(() => {
    // A preference change or leaving the section can interrupt a pending play.
    if (visible && !blocked() && !document.hidden) fail();
  });
}
video.addEventListener('playing', () => {
  clearTimeout(timer);
  if (!blocked()) video.classList.add('ready');
});
video.addEventListener('error', fail);
video.querySelector('source').addEventListener('error', fail);
reduced.addEventListener('change', sync);
// A partial Network Information API may expose saveData without EventTarget.
if (typeof connection?.addEventListener === 'function') connection.addEventListener('change', sync);
document.addEventListener('visibilitychange', sync);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  }, { threshold: 0 }).observe(section);
}
