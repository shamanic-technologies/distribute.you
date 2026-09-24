import { createGrowthScene } from './growth-scene.js';
import { createLogoMarquee } from './customer-logos.js';
import { setupComposer } from './composer.js';

const page = document.getElementById('page');
const hero = document.getElementById('hero');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let visible = true;
let frame;
const growth = createGrowthScene({
  page, hero,
  onChange() { page.dataset.playbackState = growth.status; },
  onPreferenceChange: sync
});
page.dataset.scene = 'growth';
page.style.setProperty('--study-height', '0px');

function sync() {
  page.classList.toggle('motion-paused', reduced.matches);
  page.classList.toggle('motion-suspended', !visible || document.hidden);
  growth.sync({ selected: true, paused: false, reduced: reduced.matches, visible });
}
function requestMotion() {
  if (frame !== undefined) return;
  frame = requestAnimationFrame(() => {
    frame = undefined;
    growth.update();
  });
}
window.addEventListener('scroll', requestMotion, { passive: true });
window.addEventListener('resize', () => { sync(); requestMotion(); }, { passive: true });
document.addEventListener('visibilitychange', sync);
reduced.addEventListener('change', sync);
new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  sync();
}, { threshold: 0 }).observe(hero);
sync();

setupComposer();
document.querySelectorAll('[data-tour]').forEach(link => link.addEventListener('click', () =>
  document.querySelector('oxygen-product-tour').select(link.dataset.tour)));

createLogoMarquee(document.querySelector('.customer-section'));
