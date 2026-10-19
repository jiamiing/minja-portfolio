// Native scroll remains the timeline. Each sticky chapter has a distinct composition and pace.
export function initStory({ motion, on }) {
  const tracks = [...document.querySelectorAll('[data-scene]')],
    body = document.body;
  body.classList.toggle('story-motion', motion && tracks.length > 0);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const ease = (v) => v * v * (3 - 2 * v);
  const mix = (a, b, p) => a + (b - a) * p;
  let frame = 0,
    alive = true,
    dirty = true,
    current = '',
    viewportHeight = innerHeight,
    viewportWidth = innerWidth;
  const states = tracks.map((el) => ({ el, type: el.dataset.scene, p: null }));
  const parallax = [
    ...document.querySelectorAll(
      '.project-cover,.expanded-gallery .gallery-frame,.collab-banner,.note-photo',
    ),
  ].map((el) => ({ el, img: el.querySelector('img') }));
  const chapterLinks = [...document.querySelectorAll('[data-chapter]')];
  // Geometry is measured once per layout change, so scrolled frames never read layout.
  function measure() {
    const y = scrollY;
    viewportHeight = innerHeight;
    viewportWidth = innerWidth;
    for (const state of states) {
      state.top = state.el.getBoundingClientRect().top + y;
      state.height = state.el.offsetHeight;
    }
    for (const item of parallax) {
      const r = item.el.getBoundingClientRect();
      item.top = r.top + y;
      item.height = r.height;
    }
    dirty = true;
  }
  const layout = new ResizeObserver(measure);
  layout.observe(document.body);
  on(window, 'resize', measure, { passive: true });
  measure();
  on(window, 'scroll', () => (dirty = true), { passive: true });
  if (!motion) {
    document
      .querySelectorAll('.world-scene,.rail-card,[data-collage]')
      .forEach((el) => (el.inert = false));
    layout.disconnect();
    return () => body.classList.remove('story-motion');
  }
  // Scroll handlers run every frame; skip text writes that would not change anything.
  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }
  function set(el, k, v) {
    el.style.setProperty(k, typeof v === 'number' ? v.toFixed(5) : v);
  }
  function paint(state, p) {
    const el = state.el;
    if (state.type === 'opening') {
      const fill = ease(range(p, 0.05, 0.55)),
        exit = ease(range(p, 0.58, 1));
      const art = el.querySelector('.opening-art');
      art.style.clipPath = `inset(${mix(11, 0, fill)}% ${mix(5, 0, fill)}% ${mix(5, 0, fill)}%)`;
      art.style.transform = `scale(${mix(0.96, 1.04, fill)}) translateY(${-exit * 7}vh)`;
      const type = el.querySelector('.opening-type');
      type.style.transform = `translate3d(0,${-fill * 6 - exit * 40}vh,0) rotateX(${exit * 12}deg)`;
      type.style.opacity = 1 - range(p, 0.58, 0.7);
      const end = el.querySelector('.opening-exit');
      end.style.opacity = range(p, 0.7, 0.84) * (1 - range(p, 0.9, 1));
      end.style.transform = `translateY(${mix(12, -10, exit)}vh) scale(${mix(0.9, 1.05, exit)})`;
    }
    if (state.type === 'statement') {
      const compact = viewportWidth < 700,
        triptych = ease(range(p, 0.36, 0.62)),
        takeover = ease(range(p, 0.67, 0.92));
      const positions = compact
        ? [
            [-28, -23, -10],
            [0, 12, 4],
            [29, -19, 12],
            [-28, 29, 7],
            [30, 34, -8],
            [0, -37, 5],
          ]
        : [
            [-33, -10, -10],
            [0, 9, 6],
            [33, -14, 11],
            [-25, 28, 8],
            [27, 31, -7],
            [2, -28, -4],
          ];
      el.querySelectorAll('[data-signal-panel]').forEach((panel, i) => {
        const [x, y, r] = positions[i],
          arrive = ease(range(p, -0.12 + i * 0.025, 0.24 + i * 0.025)),
          front = i < 3;
        let px = mix(x * 2.1, x, arrive),
          py = mix(y + 40, y, arrive),
          rotate = mix(r * 3, r, arrive),
          width = compact ? 43 : 29,
          height = compact ? 24 : 35;
        if (front) {
          px = mix(px, (i - 1) * 33.4, triptych);
          py = mix(py, 0, triptych);
          rotate = mix(rotate, 0, triptych);
          width = mix(width, 33.6, triptych);
          height = mix(height, 84, triptych);
          if (i === 1) {
            width = mix(width, 100, takeover);
            height = mix(height, 100, takeover);
          } else {
            px += Math.sign(i - 1) * takeover * 80;
          }
        }
        panel.style.width = width + 'vw';
        panel.style.height = height + 'vh';
        panel.style.transform = `translate3d(calc(-50% + ${px}vw),calc(-50% + ${py}vh),0) perspective(1200px) rotateY(${(1 - arrive) * (i % 2 ? 25 : -25)}deg) rotate(${rotate}deg)`;
        panel.style.opacity = arrive * (front ? 1 : 1 - triptych);
        panel.style.clipPath = `inset(${(1 - arrive) * 100}% 0 0 0)`;
        panel.querySelector('img').style.transform =
          `scale(${mix(1.2, 1.02, arrive)}) translateY(${-p * 3}%)`;
      });
      const type = el.querySelector('.signal-type');
      type.style.transform = `translateY(${mix(8, -13, triptych) + takeover * 8}vh) scale(${mix(1, 0.7, triptych)})`;
      type.style.opacity = (0.7 + 0.3 * range(p, 0, 0.12)) * (1 - range(p, 0.9, 1));
      el.querySelector('.signal-copy').style.opacity = range(p, 0.48, 0.65);
      el.querySelector('.signal-copy').style.transform =
        `translateY(${mix(8, 0, ease(range(p, 0.48, 0.78)))}vh)`;
      setText(el.querySelector('.signal-state'), `0${p < 0.36 ? 1 : p < 0.67 ? 2 : 3} / 03`);
      el.querySelector('.signal-meter i').style.transform = `scaleX(${p})`;
    }
    if (state.type === 'worlds') {
      let active = 0;
      [...el.querySelectorAll('.world-scene')].forEach((panel, i) => {
        const reveal = i === 0 ? 1 : ease(range(p, i === 1 ? 0.23 : 0.62, i === 1 ? 0.43 : 0.83));
        const revealOther =
          i === 0 ? 1 : ease(range(p, i === 1 ? 0.28 : 0.67, i === 1 ? 0.48 : 0.88));
        panel.style.clipPath = `polygon(0 ${100 - reveal * 100}%,50% ${100 - reveal * 100}%,50% ${100 - revealOther * 100}%,100% ${100 - revealOther * 100}%,100% 100%,0 100%)`;
        const local =
          i === 0 ? range(p, 0, 0.42) : i === 1 ? range(p, 0.23, 0.83) : range(p, 0.62, 1);
        panel.querySelector('.world-photo img').style.transform =
          `scale(${mix(1.2, 1.02, local)}) translateX(${mix(4, -3, local)}%)`;
        panel.querySelector('.world-detail').style.transform =
          `translate3d(${mix(18, -3, ease(local))}vw,${mix(8, -5, local)}vh,0) rotate(${mix(14, -4, local)}deg)`;
        panel.querySelector('h2').style.transform = `translateY(${mix(13, -7, local)}vh)`;
        if (reveal > 0.55) active = i;
      });
      [...el.querySelectorAll('.world-scene')].forEach((panel, i) => (panel.inert = i !== active));
      [...el.querySelectorAll('[data-world-dot]')].forEach((dot, i) =>
        dot.classList.toggle('active', i === active),
      );
      setText(el.querySelector('.world-count'), `0${active + 1} / 03`);
    }
    if (state.type === 'rail') {
      const rail = el.querySelector('.cinema-rail'),
        max = Math.max(0, rail.scrollWidth - viewportWidth),
        travel = ease(range(p, 0, 1));
      rail.style.transform = `translate3d(${-max * travel}px,0,0)`;
      const cards = [...el.querySelectorAll('.rail-card')],
        progress = travel * (cards.length - 1),
        active = Math.round(progress);
      cards.forEach((card, i) => {
        const d = i - progress;
        card.style.transform = `perspective(1400px) rotateY(${clamp(d, -1, 1) * -7}deg) translateY(${Math.min(1, Math.abs(d)) * 3}vh)`;
        card.querySelector('img').style.transform =
          `scale(1.1) translateX(${clamp(d, -1, 1) * -4}%)`;
        card.inert = Math.abs(d) > 1.3;
      });
      setText(el.querySelector('.rail-count'), `0${active + 1} / 06`);
      el.querySelector('.rail-meter i').style.transform = `scaleX(${travel})`;
    }
    if (state.type === 'glass') {
      const take = ease(range(p, 0.1, 0.88));
      set(el, '--takeover', take);
      el.querySelector('.glass-scroll-heading').style.transform = `translateY(${-p * 25}vh)`;
      el.querySelector('.glass-scroll-heading').style.opacity = 1 - range(p, 0.12, 0.35);
      el.querySelector('.glass-ghost-type').style.transform = `translateX(${mix(18, -22, p)}vw)`;
      el.querySelector('.glass-ghost-type').style.opacity =
        range(p, 0.1, 0.3) * (1 - range(p, 0.8, 1));
      set(el.querySelector('.glass-surface'), '--takeover', take);
    }
    if (state.type === 'collage') {
      const positions = [
        [-27, -23, 31],
        [12, -27, 25],
        [33, 9, 23],
        [-24, 26, 30],
        [8, 23, 13],
        [0, -3, 31],
        [-43, -1, 14],
        [33, -21, 23],
      ];
      const compact = viewportWidth < 700;
      el.querySelectorAll('[data-collage]').forEach((photo, i) => {
        const start = i * 0.035,
          arrive = ease(range(p, start, 0.36 + start)),
          leave = ease(range(p, 0.78, 1));
        let [x, y, w] = positions[i];
        if (compact) {
          const col = i % 2,
            row = Math.floor(i / 2);
          x = col ? 24 : -24;
          y = -29 + row * 20;
          w = i === 4 || i === 6 ? 25 : 43;
        }
        const r = (i % 2 ? 1 : -1) * (9 + i * 1.3);
        photo.style.width = `${w}vw`;
        photo.style.opacity = arrive * (1 - leave);
        photo.style.transform = `translate3d(calc(-50% + ${mix(x * 2.4, x, arrive) + leave * x * 0.7}vw),calc(-50% + ${mix(y * 2.5 + 45, y, arrive) - leave * 55}vh),0) rotate(${mix(r * 2, r * 0.25, arrive) + leave * r}deg) scale(${mix(0.72, 1, arrive)})`;
        photo.inert = arrive < 0.8 || leave > 0.6;
      });
      el.querySelector('.collage-heading').style.opacity = 1 - range(p, 0.12, 0.42);
      el.querySelector('.collage-heading').style.transform = `scale(${mix(0.85, 1.1, p)})`;
      el.querySelector('.collage-bottom').style.opacity = range(p, 0.4, 0.6);
    }
    if (state.type === 'outro') {
      const open = ease(range(p, 0, 0.65));
      el.querySelector('.outro-art').style.clipPath =
        `inset(${mix(12, 0, open)}% ${mix(18, 0, open)}%)`;
      el.querySelector('.outro-art img').style.transform = `scale(${mix(1.22, 1.02, p)})`;
      el.querySelector('.outro-copy').style.transform = `translateY(${mix(9, -5, p)}vh)`;
    }
  }
  function tick() {
    if (!alive) return;
    if (!document.hidden && dirty) {
      dirty = false;
      const y = scrollY;
      let active = 'opening';
      for (const state of states) {
        const top = state.top - y,
          bottom = top + state.height,
          target = clamp(-top / Math.max(1, state.height - viewportHeight));
        if (!state.ready && top < viewportHeight * 2 && bottom > 0) {
          state.ready = true;
          state.el.querySelectorAll('img[loading=lazy]').forEach((im) => (im.loading = 'eager'));
        }
        if (top < viewportHeight * 0.5 && bottom > viewportHeight * 0.4)
          active = state.type === 'glass' ? 'glass' : state.el.id || active;
        // Scenes follow the scroll position exactly; the scroll itself carries the easing.
        if (state.p !== target) {
          state.p = target;
          paint(state, target);
        }
      }
      if (active !== current) {
        current = active;
        chapterLinks.forEach((a) => a.classList.toggle('current', a.dataset.chapter === active));
      }
      for (const { el, img, top, height } of parallax) {
        const t = top - y;
        if (t + height < 0 || t > viewportHeight) continue;
        const q = clamp((viewportHeight - t) / (viewportHeight + height));
        if (img) {
          img.style.transform = `scale(${mix(1.13, 1.02, q).toFixed(4)}) translateY(${mix(-3, 3, q).toFixed(3)}%)`;
          img.style.willChange = 'transform';
        }
        if (el.classList.contains('gallery-frame')) {
          el.style.clipPath = `inset(${mix(10, 0, ease(range(q, 0, 0.3))).toFixed(3)}% 0 0 0)`;
        }
      }
    }
    frame = requestAnimationFrame(tick);
  }
  if (states.length || parallax.length) tick();
  return () => {
    alive = false;
    layout.disconnect();
    cancelAnimationFrame(frame);
    body.classList.remove('story-motion');
  };
}
