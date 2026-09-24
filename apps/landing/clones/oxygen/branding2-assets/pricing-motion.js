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
function fail() {
  clearTimeout(timer);
  failed = true;
  video.pause();
  video.classList.remove('ready');
}
function sync() {
  if (!visible || failed || blocked() || document.hidden) {
    clearTimeout(timer);
    video.pause();
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
connection?.addEventListener('change', sync);
document.addEventListener('visibilitychange', sync);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  }, { threshold: 0 }).observe(section);
}
