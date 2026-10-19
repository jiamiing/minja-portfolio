import { previews } from './previews.js?v=2.0.1';

export const preview = (name) => {
  const entry = previews[name.replace(/-sm$/, '')];
  return entry ? new URL(entry.src, import.meta.url).href : '';
};
const records = new WeakMap(),
  decoded = new Map();
let observeImage = null,
  queue = [],
  active = 0;

// Share requests between DOM images and optical canvases; failed requests can retry.
export function decodeImage(src, { srcset = '', sizes = '', priority = 'auto' } = {}) {
  const key = src + '|' + srcset + '|' + sizes;
  if (decoded.has(key)) return decoded.get(key);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = priority;
    image.onload = async () => {
      // decode() only pre-warms; it can reject for a loaded, usable image (e.g. a background page).
      await image.decode().catch(() => {});
      resolve(image);
    };
    image.onerror = () => reject(new Error('Image could not load'));
    if (sizes) image.sizes = sizes;
    if (srcset) image.srcset = srcset;
    image.src = src;
  });
  decoded.set(key, promise);
  // Keep only in-flight HD requests; don't retain every decoded full-size bitmap.
  promise.then(
    () => decoded.delete(key),
    () => decoded.delete(key),
  );
  return promise;
}

function pump() {
  while (active < 4 && queue.length) {
    const task = queue.shift();
    if (task.valid()) {
      active++;
      task.run().finally(() => {
        active--;
        pump();
      });
    }
  }
}
function enqueue(task, priority) {
  if (priority === 'high') task.run();
  else {
    queue.push(task);
    pump();
  }
}

export function setProgressiveImage(
  image,
  { name, src, srcset = '', sizes = '100vw', priority = 'auto' },
) {
  records.delete(image);
  image.removeAttribute('srcset');
  image.removeAttribute('sizes');
  image.dataset.fullSrc = src;
  image.dataset.fullSrcset = srcset;
  image.dataset.fullSizes = sizes;
  image.dataset.imageState = 'preview';
  image.dataset.imageName = name;
  image.dataset.priority = priority;
  image.draggable = false;
  image.loading = priority === 'high' ? 'eager' : 'lazy';
  image.src = preview(name);
  image.decoding = 'async';
  observeImage?.(image);
}

export function initImages() {
  let alive = true;
  function upgrade(image) {
    const state = records.get(image);
    if (!state || state.started) return;
    state.started = true;
    const valid = () => alive && image.isConnected && records.get(image) === state;
    enqueue(
      {
        valid,
        async run() {
          if (!valid()) return;
          image.dataset.imageState = 'loading';
          try {
            await decodeImage(state.src, {
              srcset: state.srcset,
              sizes: state.sizes,
              priority: state.priority,
            });
            if (!valid()) return;
            // Keep the placeholder until a decoded, correctly sized image is in cache.
            image.loading = 'eager';
            image.sizes = state.sizes;
            if (state.srcset) image.srcset = state.srcset;
            image.src = state.src;
            await image.decode().catch(() => {});
            if (!valid()) return;
            image.dataset.imageState = 'ready';
          } catch {
            if (!valid()) return;
            image.removeAttribute('srcset');
            image.src = preview(image.dataset.imageName);
            image.dataset.imageState = 'preview';
            state.started = false;
          }
        },
      },
      state.priority,
    );
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) upgrade(entry.target);
    },
    { rootMargin: '450px' },
  );
  function register(image) {
    if (!image.dataset.fullSrc || records.has(image)) return;
    records.set(image, {
      src: image.dataset.fullSrc,
      srcset: image.dataset.fullSrcset || '',
      sizes: image.dataset.fullSizes || '100vw',
      priority: image.dataset.priority || 'auto',
      started: false,
    });
    observer.observe(image);
    if (image.dataset.priority === 'high') upgrade(image);
  }
  observeImage = (image) => {
    observer.unobserve(image);
    register(image);
  };
  function scan(root) {
    if (root.matches?.('img[data-full-src]')) register(root);
    root.querySelectorAll?.('img[data-full-src]').forEach(register);
  }
  const mutations = new MutationObserver((entries) => {
    for (const entry of entries) {
      for (const node of entry.addedNodes) if (node.nodeType === 1) scan(node);
      for (const node of entry.removedNodes)
        if (node.nodeType === 1) {
          if (node.matches?.('img')) observer.unobserve(node);
          node.querySelectorAll?.('img').forEach((image) => observer.unobserve(image));
        }
    }
  });
  mutations.observe(document.body, { childList: true, subtree: true });
  scan(document);
  const retry = () =>
    document.querySelectorAll('img[data-image-state="preview"]').forEach((image) => {
      const r = image.getBoundingClientRect();
      if (r.width && r.bottom > -450 && r.top < innerHeight + 450) upgrade(image);
    });
  window.addEventListener('online', retry);
  return () => {
    alive = false;
    observeImage = null;
    observer.disconnect();
    mutations.disconnect();
    window.removeEventListener('online', retry);
    queue = [];
  };
}

// Textures begin with a recognizable preview, then upgrade when their section is near.
// GPU uploads block the main thread, so hand images over when the page is idle.
const whenIdle = (fn) =>
  window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 60);

export function progressiveTexture({ target, name, src, onImage }) {
  let alive = true,
    highSeen = false;
  decodeImage(preview(name))
    .then((image) => {
      whenIdle(() => alive && !highSeen && onImage(image, false));
    })
    .catch(() => {});
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      decodeImage(src)
        .then((image) => {
          highSeen = true;
          whenIdle(() => alive && onImage(image, true));
        })
        .catch(() => {});
    },
    { rootMargin: '150% 0px' },
  );
  observer.observe(target);
  return () => {
    alive = false;
    observer.disconnect();
  };
}
