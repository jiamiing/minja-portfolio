const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const range = (v, a, b) => clamp((v - a) / (b - a));
const ease = (p) => p * p * (3 - 2 * p);
const mix = (a, b, p) => a + (b - a) * p;

// Keep real selectable type in the document; every glyph follows a damped local field.
function splitInk(root) {
  if (root.dataset.inkSplit) return;
  root.dataset.inkSplit = 'true';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT),
    nodes = [];
  while (walker.nextNode())
    if (
      walker.currentNode.textContent.trim() &&
      !walker.currentNode.parentElement.closest('.sr-only,canvas')
    )
      nodes.push(walker.currentNode);
  let count = 0;
  for (const node of nodes) {
    const fragment = document.createDocumentFragment(),
      run = document.createElement('span');
    run.className = 'ink-run';
    run.setAttribute('aria-hidden', 'true');
    const tokens = node.textContent.match(/\s+|[^\s]+/gu) || [];
    for (const token of tokens) {
      if (/^\s+$/u.test(token)) {
        run.append(document.createTextNode(token));
        continue;
      }
      const word = document.createElement('span');
      word.className = /[\u3000-\u9fff\uac00-\ud7af]/u.test(token) ? 'ink-cjk' : 'ink-word';
      for (const char of token) {
        const glyph = document.createElement('span');
        glyph.className = 'ink-glyph';
        glyph.textContent = char;
        glyph.style.setProperty('--glyph-index', count++);
        word.append(glyph);
      }
      run.append(word);
    }
    const accessible = document.createElement('span');
    accessible.className = 'sr-only';
    accessible.textContent = node.textContent;
    fragment.append(run, accessible);
    node.replaceWith(fragment);
  }
}
// Scroll handlers run every frame; skip text writes that would not change anything.
function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}
export function initLetterFields({ motion, on, targets }) {
  if (!motion) return () => {};
  const roots = targets.filter(Boolean),
    fields = [];
  let alive = true,
    raf = 0,
    px = -10000,
    py = -10000,
    pointer = false,
    last = 0;
  const fine = matchMedia('(pointer:fine)').matches;
  for (const root of roots) {
    splitInk(root);
    const field = { root, glyphs: [], visible: false, entered: false };
    fields.push(field);
  }
  function measure() {
    if (!alive) return;
    for (const f of fields) {
      const rootRect = f.root.getBoundingClientRect();
      for (const g of f.glyphs) {
        g.el
          .getAnimations()
          .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
          .forEach((a) => a.finish());
        g.el.style.transform = 'none';
      }
      f.glyphs = [...f.root.querySelectorAll('.ink-glyph')].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          el,
          tx: r.left + r.width / 2 - rootRect.left,
          ty: r.top + r.height / 2 - rootRect.top,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          angle: 0,
        };
      });
      f.width = rootRect.width;
    }
  }
  function schedule() {
    if (alive && !raf) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    raf = 0;
    if (!alive || document.hidden) return;
    const dt = Math.min(2, (now - last) / 16.67 || 1);
    last = now;
    let moving = false;
    for (const f of fields) {
      if (!f.visible) continue;
      const rect = f.root.getBoundingClientRect(),
        radius = clamp(innerWidth * 0.11, 80, 170),
        scale = rect.width / (f.width || rect.width);
      let distortion = 0;
      for (const g of f.glyphs) {
        const dx = rect.left + g.tx * scale - px,
          dy = rect.top + g.ty * scale - py,
          d = Math.hypot(dx, dy) || 1,
          force = pointer ? Math.max(0, 1 - d / radius) : 0;
        distortion = Math.max(distortion, force);
        const targetX = (dx / d) * force * 22,
          targetY = (dy / d) * force * 20;
        g.vx += (targetX - g.x) * 0.09 * dt;
        g.vy += (targetY - g.y) * 0.09 * dt;
        g.vx *= Math.pow(0.72, dt);
        g.vy *= Math.pow(0.72, dt);
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        if (force > 0.001 || Math.abs(g.x) + Math.abs(g.y) > 0.04) {
          moving = true;
          g.el.style.transform = `translate3d(${g.x.toFixed(2)}px,${g.y.toFixed(2)}px,0) rotate(${(g.x * 0.38).toFixed(2)}deg) scale(${(1 + force * 0.07).toFixed(3)},${(1 - force * 0.06).toFixed(3)})`;
          g.el.style.textShadow =
            force > 0.12
              ? `${force * 1.4}px 0 rgba(180,225,255,${force * 0.7}),${-force * 1.4}px 0 rgba(240,180,220,${force * 0.6})`
              : 'none';
        } else if (g.el.style.transform !== 'none') {
          g.el.style.transform = 'none';
          g.el.style.textShadow = 'none';
        }
      }
      if (f.root.classList.contains('opening-type'))
        document
          .querySelector('#ink-warp-scale')
          ?.setAttribute('scale', (distortion * 9).toFixed(2));
    }
    if (moving) schedule();
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const f = fields.find((v) => v.root === e.target);
        f.visible = e.isIntersecting;
        if (e.isIntersecting && !f.entered) {
          f.entered = true;
          f.glyphs.forEach((g, i) =>
            g.el.animate(
              [
                { transform: 'translateY(115%) rotate(6deg)', opacity: 0 },
                { transform: 'none', opacity: 1 },
              ],
              { duration: 1050, delay: Math.min(i * 13, 480), easing: 'cubic-bezier(.16,1,.3,1)' },
            ),
          );
        }
      }
      schedule();
    },
    { threshold: 0.04 },
  );
  roots.forEach((r) => observer.observe(r));
  measure();
  document.fonts.ready.then(measure);
  if (fine) {
    on(
      window,
      'pointermove',
      (e) => {
        px = e.clientX;
        py = e.clientY;
        pointer = true;
        schedule();
      },
      { passive: true },
    );
    on(document, 'pointerleave', () => {
      pointer = false;
      schedule();
    });
  }
  on(window, 'scroll', schedule, { passive: true });
  on(
    window,
    'resize',
    () => {
      measure();
      schedule();
    },
    { passive: true },
  );
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    observer.disconnect();
  };
}

export function initNavigation({ motion, on }) {
  const header = document.querySelector('.site-header'),
    overlay = document.querySelector('#nav-overlay'),
    toggle = document.querySelector('#menu-toggle'),
    nav = header.querySelector('.desktop-nav'),
    slider = header.querySelector('.nav-slider');
  let opened = false,
    generation = 0,
    animations = [];
  function slide(link) {
    if (!slider || !link) return;
    const a = nav.getBoundingClientRect(),
      b = link.getBoundingClientRect();
    slider.style.width = b.width + 'px';
    slider.style.transform = `translateX(${b.left - a.left}px)`;
    slider.style.opacity = '1';
  }
  header.querySelectorAll('.desktop-nav a').forEach((link) => {
    on(link, 'pointerenter', () => slide(link));
    on(link, 'focus', () => slide(link));
    on(link, 'pointermove', (e) => {
      if (!motion) return;
      const r = link.getBoundingClientRect();
      link.style.setProperty('--mx', (e.clientX - r.left - r.width / 2) * 0.11 + 'px');
      link.style.setProperty('--my', (e.clientY - r.top - r.height / 2) * 0.18 + 'px');
    });
    on(link, 'pointerleave', () => {
      link.style.setProperty('--mx', '0px');
      link.style.setProperty('--my', '0px');
    });
  });
  on(nav, 'pointerleave', () => {
    const current = nav.querySelector('[aria-current]');
    if (current) slide(current);
    else if (slider) slider.style.opacity = '0';
  });
  on(header, 'pointermove', (e) => {
    const r = header.getBoundingClientRect();
    header.style.setProperty('--light-x', `${e.clientX - r.left}px`);
  });
  function setScrolled() {
    header.classList.toggle('is-scrolled', scrollY > 60);
  }
  on(window, 'scroll', setScrolled, { passive: true });
  on(window, 'resize', () => slide(nav.querySelector('[aria-current]')), { passive: true });
  setScrolled();
  async function setOpen(value) {
    const token = ++generation;
    opened = value;
    document.querySelector('main').inert = value;
    document.querySelector('footer').inert = value;
    animations.forEach((a) => a.cancel());
    animations = [];
    toggle.setAttribute('aria-expanded', value);
    document.body.classList.toggle('menu-open', value);
    if (value) {
      overlay.hidden = false;
      overlay.inert = false;
      if (motion) {
        const a = overlay.animate(
          [
            { clipPath: 'inset(0 0 100% 0 round 0 0 35% 0)' },
            { clipPath: 'inset(0 0 0% 0 round 0 0 0 0)' },
          ],
          { duration: 800, easing: 'cubic-bezier(.76,0,.24,1)' },
        );
        animations.push(a);
        overlay.querySelectorAll('.menu-line').forEach((line, i) =>
          animations.push(
            line.animate(
              [
                { transform: 'translateY(115%) rotate(5deg)', opacity: 0 },
                { transform: 'none', opacity: 1 },
              ],
              { duration: 1000, delay: 140 + i * 65, easing: 'cubic-bezier(.16,1,.3,1)' },
            ),
          ),
        );
      }
      overlay.querySelector('a')?.focus({ preventScroll: true });
    } else {
      overlay.inert = true;
      if (motion) {
        const a = overlay.animate(
          [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }],
          { duration: 500, easing: 'cubic-bezier(.76,0,.24,1)' },
        );
        animations.push(a);
        try {
          await a.finished;
        } catch {}
      }
      if (token === generation) {
        overlay.hidden = true;
        overlay.inert = false;
        toggle.focus({ preventScroll: true });
      }
    }
  }
  on(toggle, 'click', () => setOpen(!opened));
  overlay.querySelectorAll('[data-menu-target]').forEach((link) => {
    const activate = () => {
      overlay.dataset.preview = link.dataset.menuTarget;
      overlay
        .querySelectorAll('[data-menu-frame]')
        .forEach((im) =>
          im.classList.toggle('active', im.dataset.menuFrame === link.dataset.menuTarget),
        );
    };
    on(link, 'pointerenter', activate);
    on(link, 'focus', activate);
  });
  requestAnimationFrame(() => slide(nav.querySelector('[aria-current]')));
  return () => {
    generation++;
    animations.forEach((a) => a.cancel());
    document.querySelector('main').inert = false;
    document.querySelector('footer').inert = false;
    document.body.classList.remove('menu-open');
  };
}

export function initPageMotion({ motion, on }) {
  const main = document.querySelector('main'),
    tracks = [...main.querySelectorAll('[data-page-scene]')];
  let alive = true,
    raf = 0,
    dirty = true,
    settling = true;
  const states = tracks.map((el) => ({ el, type: el.dataset.pageScene, p: null }));
  const reading = [...main.querySelectorAll('[data-read]')];
  const headings = [
    ...main.querySelectorAll('.detail-title h1,.note-hero h1,.contact-top h1,.collab-intro h1'),
  ];
  const lettersStop = initLetterFields({ motion, on, targets: headings });
  if (!motion) {
    main.querySelectorAll('.sequence-panel').forEach((el) => (el.inert = false));
    return () => lettersStop();
  }
  main.classList.add('page-motion');
  reading.forEach((p) => {
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT),
      nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const frag = document.createDocumentFragment();
      for (const token of typeof Intl.Segmenter === 'function'
        ? [
            ...new Intl.Segmenter(document.documentElement.lang, { granularity: 'word' }).segment(
              n.textContent,
            ),
          ].map((s) => s.segment)
        : n.textContent.split(/(\s+)/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) frag.append(document.createTextNode(token));
        else {
          const span = document.createElement('span');
          span.className = 'read-word';
          span.textContent = token;
          frag.append(span);
        }
      }
      n.replaceWith(frag);
    }
  });
  function paint(s, p) {
    const el = s.el;
    el.dataset.progress = p.toFixed(3);
    el.style.setProperty('--scene-p', p.toFixed(5));
    if (s.type === 'cover') {
      const open = ease(range(p, 0, 0.65)),
        exit = ease(range(p, 0.4, 1));
      el.style.setProperty('--detail-meta', open > 0.25 ? '#f2f1ec' : '#171b17');
      el.style.setProperty('--detail-bottom', open > 0.55 ? '#f2f1ec' : '#171b17');
      const photo = el.querySelector('.detail-cover');
      photo.style.clipPath = `inset(${mix(20, 0, open)}% ${mix(6, 0, open)}% ${mix(8, 0, open)}%)`;
      photo.querySelector('img').style.transform = `scale(${mix(1.18, 1.01, p)})`;
      const title = el.querySelector('.detail-title');
      title.style.transform = `translateY(${-exit * 36}vh) scale(${mix(1, 0.93, exit)})`;
      title.style.opacity = 1 - range(p, 0.68, 1);
      el.querySelector('.detail-side-number').style.transform =
        `translateY(${mix(20, -15, p)}vh) rotate(-90deg)`;
    }
    if (s.type === 'sequence') {
      const panels = [...el.querySelectorAll('.sequence-panel')],
        progress = p * (panels.length - 1);
      let active = 0;
      panels.forEach((panel, i) => {
        const local = clamp(progress - i + 1),
          reveal = i === 0 ? 1 : ease(local);
        panel.style.clipPath =
          i % 2 ? `inset(0 0 ${100 - reveal * 100}% 0)` : `inset(${100 - reveal * 100}% 0 0 0)`;
        panel.querySelector('img').style.transform =
          `scale(${mix(1.18, 1.01, local)}) translateX(${mix(i % 2 ? -4 : 4, 0, local)}%)`;
        if (reveal > 0.5) active = i;
      });
      panels.forEach((panel, i) => (panel.inert = i !== active));
      setText(el.querySelector('.sequence-current'), String(active + 1).padStart(2, '0'));
      el.querySelector('.sequence-line i').style.transform = `scaleX(${p})`;
    }
    if (s.type === 'ledger') {
      let active = 0;
      const gates = [1, ease(range(p, 0.23, 0.38)), ease(range(p, 0.56, 0.72))];
      gates.forEach((gate, i) => {
        if (gate > 0.5) active = i;
      });
      el.dataset.active = active;
      el.querySelectorAll('.ledger-image').forEach((image, i) => {
        image.style.clipPath = `inset(0 ${100 - gates[i] * 100}% 0 0)`;
        image.querySelector('img').style.transform =
          `scale(${mix(1.14, 1.01, range(p, i === 0 ? 0 : i === 1 ? 0.23 : 0.56, i === 0 ? 0.38 : i === 1 ? 0.72 : 1))})`;
      });
      el.querySelectorAll('.ledger-entry').forEach((entry, i) => {
        const enter = gates[i],
          exit = i < 2 ? gates[i + 1] : 0;
        entry.style.transform = `translateY(${(1 - enter) * 105 - exit * 105}%)`;
        entry.style.opacity = enter * (1 - exit);
        entry.style.pointerEvents = i === active ? 'auto' : 'none';
      });
      setText(el.querySelector('.ledger-number'), `0${active + 1}`);
      el.querySelectorAll('.ledger-dots i').forEach((dot, i) =>
        dot.classList.toggle('active', i === active),
      );
    }
    if (s.type === 'portrait') {
      const open = ease(range(p, 0, 0.7));
      el.querySelector('.note-hero-picture').style.clipPath =
        `inset(${mix(12, 0, open)}% ${mix(8, 0, open)}% 0)`;
      el.querySelector('.note-hero-picture img').style.transform =
        `scale(${mix(1.18, 1.02, open)})`;
      el.querySelector('.note-hero-type').style.transform = `translateY(${mix(8, -12, p)}vh)`;
      el.querySelectorAll('.portrait-slice').forEach((slice, i) => {
        slice.style.transform = `translateX(${(i % 2 ? 1 : -1) * open * (i + 1) * 7}vw)`;
        slice.style.opacity = 1 - range(p, 0.45, 0.85);
      });
    }
  }
  function tick() {
    raf = 0;
    if (!alive) return;
    if (!document.hidden && (dirty || settling)) {
      dirty = false;
      settling = false;
      for (const s of states) {
        const r = s.el.getBoundingClientRect(),
          target = clamp(-r.top / Math.max(1, s.el.offsetHeight - innerHeight));
        if (r.top > innerHeight * 1.8 || r.bottom < -innerHeight) {
          if (s.p !== target) {
            s.p = target;
            paint(s, target);
          }
          continue;
        }
        if (!s.ready) {
          s.ready = true;
          s.el.querySelectorAll('img[loading=lazy]').forEach((im) => (im.loading = 'eager'));
        }
        s.p = s.p === null ? target : mix(s.p, target, 0.14);
        if (Math.abs(s.p - target) > 0.0002) settling = true;
        else s.p = target;
        paint(s, s.p);
      }
      reading.forEach((p) => {
        const r = p.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const q = range(innerHeight * 0.85 - r.top, 0, r.height + innerHeight * 0.2),
          words = [...p.querySelectorAll('.read-word')];
        words.forEach((word, i) => {
          const on = range(
            q,
            Math.max(0, i / words.length - 0.12),
            Math.min(1, i / words.length + 0.12),
          );
          word.style.opacity = 0.3 + 0.7 * on;
        });
      });
      main.querySelectorAll('.partner-ticker-track').forEach((track) => {
        const r = track.parentElement.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight)
          track.style.transform = `translateX(${-clamp((innerHeight - r.top) / (innerHeight + r.height)) * 18}%)`;
      });
    }
    if (states.length || reading.length || main.querySelector('.partner-ticker-track'))
      raf = requestAnimationFrame(tick);
  }
  on(
    window,
    'scroll',
    () => {
      dirty = true;
    },
    { passive: true },
  );
  on(
    window,
    'resize',
    () => {
      dirty = true;
    },
    { passive: true },
  );
  const revealObserver = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('motion-entered');
          revealObserver.unobserve(e.target);
        }
      }),
    { threshold: 0.1 },
  );
  main
    .querySelectorAll(
      '.project-overview,.inquiry-form-heading,.inquiry-field,.inquiry-aside,.note-reading-aside,.collab-end',
    )
    .forEach((el, i) => {
      el.classList.add('motion-entry');
      el.style.setProperty('--entry-delay', `${(i % 3) * 80}ms`);
      revealObserver.observe(el);
    });
  main.querySelectorAll('.contact-picture').forEach((el) => {
    on(el, 'pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect(),
        x = (e.clientX - r.left) / r.width - 0.5,
        y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--tilt-x', `${-y * 5}deg`);
      el.style.setProperty('--tilt-y', `${x * 7}deg`);
    });
    on(el, 'pointerleave', () => {
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    });
  });
  const form = main.querySelector('#inquiry-form');
  if (form) {
    const update = () => {
      const count = ['name', 'email', 'message'].filter(
        (name) =>
          form.elements.namedItem(name).validity.valid &&
          form.elements.namedItem(name).value.trim(),
      ).length;
      form.closest('.inquiry-form-wrap').style.setProperty('--form-progress', count / 3);
      const status = main.querySelector('.inquiry-progress span');
      if (status) status.textContent = `0${count} / 03`;
    };
    on(form, 'input', update);
    on(form, 'reset', () => requestAnimationFrame(update));
    update();
  }
  if (states.length || reading.length || main.querySelector('.partner-ticker-track')) tick();
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    revealObserver.disconnect();
    lettersStop();
  };
}
