// The archive has its own pacing: editorial placement, image parallax and real layout transitions.
export function initArchive({ motion, on }) {
  const main = document.querySelector('.archive');
  if (!main) return () => {};
  const intro = main.querySelector('.archive-intro'),
    toolbar = main.querySelector('.archive-toolbar');
  const projects = main.querySelector('#projects-view'),
    frames = main.querySelector('#images-view');
  const cards = [...main.querySelectorAll('.work-card,.atlas-card')],
    visible = new Set(),
    animations = new Set();
  let alive = true,
    raf = 0,
    last = 0,
    heroProgress = 0,
    hover = null,
    layoutFrame = 0;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fragmentFactors = [-0.55, 0.3, 0.8];
  const fragments = [...intro.querySelectorAll('.archive-hero-fragment')];
  const status = main.querySelector('.archive-results');
  function animate(el, keyframes, options) {
    const animation = el.animate(keyframes, options);
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
    return animation;
  }
  function refresh() {
    const shown = [...projects.children].filter((card) => !card.hidden);
    shown.forEach((card, i) => (card.dataset.slot = String(i)));
    projects.dataset.count = shown.length;
    main.dataset.archiveView = frames.hidden ? 'projects' : 'images';
    const section = frames.hidden ? projects : frames;
    if (status)
      status.textContent = `${[...section.children].filter((card) => !card.hidden).length} ${section.getAttribute('aria-label')}`;
    schedule();
  }
  function schedule() {
    if (alive && motion && !document.hidden && !raf) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    raf = 0;
    if (!alive || document.hidden) return;
    const dt = clamp((now - last) / 16.667 || 1, 0.25, 2.5);
    last = now;
    let settling = false;
    const heroRect = intro.getBoundingClientRect(),
      target = clamp(-heroRect.top / heroRect.height, 0, 1);
    heroProgress += (target - heroProgress) * (1 - Math.pow(0.86, dt));
    if (Math.abs(target - heroProgress) > 0.0003) settling = true;
    if (heroRect.bottom > 0) {
      fragments.forEach((el, i) =>
        el.style.setProperty('--fragment-scroll', `${heroProgress * 150 * fragmentFactors[i]}px`),
      );
      intro.style.setProperty('--title-shift', `${heroProgress * -60}px`);
    }
    for (const card of visible) {
      const surface = card.querySelector('.work-image');
      if (!surface) continue;
      const rect = surface.getBoundingClientRect(),
        progress = clamp(
          (innerHeight * 0.5 - rect.top - rect.height * 0.5) / (innerHeight + rect.height),
          -0.5,
          0.5,
        );
      const goal = progress * 70,
        current = Number(card.dataset.imageY || 0),
        value = current + (goal - current) * (1 - Math.pow(0.84, dt));
      surface.style.setProperty('--image-y', `${value.toFixed(2)}px`);
      card.dataset.imageY = value;
      if (Math.abs(goal - value) > 0.05) settling = true;
    }
    if (hover) {
      hover.x += (hover.tx - hover.x) * (1 - Math.pow(0.82, dt));
      hover.y += (hover.ty - hover.y) * (1 - Math.pow(0.82, dt));
      hover.el.style.setProperty('--reveal-left', `${hover.x - 14}%`);
      hover.el.style.setProperty('--reveal-right', `${hover.x + 14}%`);
      hover.el.style.setProperty('--slice-x', `${hover.x}%`);
      hover.el.style.setProperty('--image-x', `${(hover.x - 50) * -0.08}px`);
      if (Math.abs(hover.tx - hover.x) + Math.abs(hover.ty - hover.y) > 0.05) settling = true;
    }
    const collection = projects.hidden ? frames : projects,
      rect = collection.getBoundingClientRect();
    toolbar.style.setProperty(
      '--collection-progress',
      clamp((innerHeight * 0.6 - rect.top) / Math.max(1, rect.height), 0, 1),
    );
    if (settling) schedule();
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const card = entry.target;
        if (entry.isIntersecting) {
          visible.add(card);
          if (!card.classList.contains('is-revealed')) {
            card.classList.add('is-revealed');
            const img = card.querySelector('.archive-image-main img');
            if (motion && img)
              animate(img, [{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }], {
                duration: 1600,
                easing: 'cubic-bezier(.16,1,.3,1)',
              });
          }
        } else visible.delete(card);
      }
      schedule();
    },
    { rootMargin: '60px 0px', threshold: 0.02 },
  );
  if (motion) {
    main.classList.add('archive-motion');
    cards.forEach((card) => observer.observe(card));
    animate(
      intro.querySelector('.archive-title'),
      [
        { opacity: 0, transform: 'translateY(45px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 1200, easing: 'cubic-bezier(.16,1,.3,1)' },
    );
    fragments.forEach((el, i) =>
      animate(
        el,
        [
          {
            opacity: 0,
            translate: `${i % 2 ? 18 : -18}px ${45 + i * 12}px`,
            rotate: `${i % 2 ? 4 : -4}deg`,
          },
          { opacity: 1, translate: '0px 0px', rotate: '0deg' },
        ],
        { duration: 1450, delay: i * 110, easing: 'cubic-bezier(.16,1,.3,1)' },
      ),
    );
  } else cards.forEach((card) => card.classList.add('is-revealed'));
  main.querySelectorAll('.work-image').forEach((el) => {
    function enter(event) {
      if (!motion || event.pointerType === 'touch') return;
      hover = { el, x: 50, y: 50, tx: 50, ty: 50 };
      el.classList.add('is-hovered');
      schedule();
    }
    on(el, 'pointerenter', enter);
    on(el, 'focus', enter);
    on(el, 'pointermove', (event) => {
      if (!motion || event.pointerType === 'touch') return;
      if (hover?.el !== el) enter(event);
      const rect = el.getBoundingClientRect();
      hover.tx = clamp(((event.clientX - rect.left) / rect.width) * 100, 4, 96);
      hover.ty = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
      schedule();
    });
    const leave = () => {
      el.classList.remove('is-hovered');
      el.style.setProperty('--image-x', '0px');
      if (hover?.el === el) hover = null;
    };
    on(el, 'pointerleave', leave);
    on(el, 'blur', leave);
  });
  on(
    toolbar,
    'click',
    (event) => {
      if (!event.target.closest('[data-filter],[data-view]')) return;
      const beforeScroll = scrollY;
      const old = new Map(
        cards
          .filter((card) => !card.hidden && card.getClientRects().length)
          .map((card) => [card, card.getBoundingClientRect()]),
      );
      cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(() => {
        if (!alive) return;
        refresh();
        // Keep results beneath the sticky controls after a category or view change.
        const target =
          main.getBoundingClientRect().top +
          scrollY +
          intro.offsetHeight -
          parseFloat(getComputedStyle(toolbar).top);
        scrollTo({ top: Math.max(0, target), behavior: 'instant' });
        const moved = Math.abs(scrollY - beforeScroll) > 100;
        if (!motion) return;
        cards
          .filter((card) => !card.hidden && card.getClientRects().length)
          .forEach((card, i) => {
            const rect = card.getBoundingClientRect();
            if (rect.top > innerHeight + 150 || rect.bottom < 0) return;
            const previous = moved ? null : old.get(card);
            card.classList.add('is-revealed');
            animate(
              card,
              [
                {
                  transform: `translate(${previous ? previous.left - rect.left : 0}px,${previous ? previous.top - rect.top : 35}px)`,
                  opacity: previous ? 1 : 0,
                },
                { transform: 'translate(0,0)', opacity: 1 },
              ],
              { duration: 850, delay: (i % 6) * 35, easing: 'cubic-bezier(.16,1,.3,1)' },
            );
          });
      });
    },
    { capture: true },
  );
  on(window, 'scroll', schedule, { passive: true });
  on(window, 'resize', schedule, { passive: true });
  on(document, 'visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      last = 0;
      schedule();
    }
  });
  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(main);
  refresh();
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(layoutFrame);
    observer.disconnect();
    resizeObserver.disconnect();
    animations.forEach((animation) => animation.cancel());
  };
}
