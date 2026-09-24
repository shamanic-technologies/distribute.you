export function createLogoMarquee(section) {
  const marquee = section.querySelector('.logo-marquee');
  const track = section.querySelector('.logo-track');
  const duplicate = track.querySelector('.customer-logos').cloneNode(true);
  duplicate.setAttribute('aria-hidden', 'true');
  duplicate.inert = true;
  track.append(duplicate);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  function sync() {
    marquee.classList.toggle('paused', !visible || document.hidden || reduced.matches);
  }
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  }).observe(marquee);
  marquee.classList.add('ready');
  sync();
}
