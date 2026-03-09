/* ============================================================
   GACP LLC — hero.js
   Panoramic hero hover effects, parallax, counters
   ============================================================ */

function initHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  // Animate stat counters
  animateStatCounters();
}

/** Animate number counters in the stats bar */
function animateStatCounters() {
  const stats = document.querySelectorAll('.hero__stat-value[data-count]');
  if (!stats.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.count, 10);
          const suffix = el.dataset.suffix || '';
          const prefix = el.dataset.prefix || '';
          animateCount(el, target, prefix, suffix);
          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.5 }
  );

  stats.forEach(s => observer.observe(s));
}

function animateCount(el, target, prefix, suffix, duration = 1500) {
  const start = performance.now();
  const from = 0;

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out quad
    const eased = 1 - (1 - progress) * (1 - progress);
    const current = Math.round(from + (target - from) * eased);
    el.textContent = prefix + current.toLocaleString() + suffix;

    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

document.addEventListener('DOMContentLoaded', initHero);
