// Eased wheel scrolling on top of native scroll: sticky chapters, anchors, keyboard
// and the scrollbar keep working, and every scene reads the same scrollY.
export function initSmoothScroll({ motion, on }) {
  if (
    !motion ||
    !matchMedia('(pointer: fine)').matches ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return () => {};
  const root = document.documentElement,
    body = document.body;
  let alive = true,
    raf = 0,
    last = 0,
    target = scrollY,
    current = scrollY,
    written = -1;
  const limit = () => Math.max(0, root.scrollHeight - innerHeight);
  // Leave wheel input to anything that scrolls on its own in that direction.
  function nestedScroller(node, dy) {
    for (let el = node; el && el !== body && el !== root; el = el.parentElement) {
      if (el.matches?.('dialog,[data-native-scroll]')) return true;
      if (el.scrollHeight <= el.clientHeight + 1) continue;
      const overflow = getComputedStyle(el).overflowY;
      if (overflow !== 'auto' && overflow !== 'scroll') continue;
      if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1)
        return true;
    }
    return false;
  }
  function frame(now) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 1 / 60);
    last = now;
    current += (target - current) * (1 - Math.exp(-dt * 10));
    if (Math.abs(target - current) < 0.4) current = target;
    written = Math.round(current);
    // The stylesheet sets scroll-behavior: smooth, which would re-ease each step.
    scrollTo({ top: current, behavior: 'instant' });
    if (current !== target) raf = requestAnimationFrame(frame);
  }
  on(
    window,
    'wheel',
    (e) => {
      if (e.defaultPrevented || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (body.classList.contains('menu-open') || body.classList.contains('lightbox-open')) return;
      if (nestedScroller(e.target, e.deltaY)) return;
      e.preventDefault();
      if (!raf) {
        current = target = scrollY;
        last = 0;
      }
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1;
      target = Math.max(0, Math.min(limit(), target + e.deltaY * unit));
      if (!raf) raf = requestAnimationFrame(frame);
    },
    { passive: false },
  );
  // Any scroll this loop did not write (keyboard, scrollbar, anchors, route changes) takes over.
  on(
    window,
    'scroll',
    () => {
      if (Math.abs(scrollY - written) <= 1) return;
      cancelAnimationFrame(raf);
      raf = 0;
      written = -1;
      current = target = scrollY;
    },
    { passive: true },
  );
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
  };
}
