// Adaptive quality: weak laptops and software rendering get a lighter compositing path
// (no backdrop blur, smaller WebGL buffers); capable machines keep the full design.
const root = document.documentElement;
const KEY = 'minja-perf-lite';

export const isLite = () => root.classList.contains('perf-lite');

function enable(reason) {
  if (isLite()) return;
  root.classList.add('perf-lite');
  root.dataset.perfReason = reason;
  try {
    sessionStorage.setItem(KEY, reason);
  } catch {}
  window.dispatchEvent(new Event('minja:perf-lite'));
}

export function initPerf() {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) enable(saved);
  } catch {}
  if (isLite()) return;
  // Software WebGL means every blur and canvas is drawn on the CPU.
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    if (!gl || /swiftshader|llvmpipe|software|basic render/i.test(name)) {
      enable('software-gl');
      return;
    }
  } catch {}
  // Otherwise judge by real frames, counted only while the page is being scrolled or played with.
  let active = 0,
    last = 0,
    slow = 0,
    total = 0;
  const touch = () => (active = performance.now());
  for (const type of ['scroll', 'pointermove', 'wheel'])
    addEventListener(type, touch, { passive: true, capture: true });
  function frame(now) {
    if (isLite()) return;
    const dt = now - last;
    last = now;
    if (now - active < 250 && dt < 500 && !document.hidden) {
      total++;
      if (dt > 28) slow++;
      if (total >= 120) {
        // A quarter of interactive frames below ~35 fps reads as stutter.
        if (slow / total > 0.25) enable('slow-frames');
        slow = total = 0;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
