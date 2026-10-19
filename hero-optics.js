// Pointer-responsive image field for the hero artwork.
import { isLite } from './perf.js?v=1.0.0';
const vertex = `attribute vec2 position;varying vec2 uv;void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision highp float;
varying vec2 uv;uniform sampler2D artwork,previousArtwork;uniform float clarity;uniform vec2 resolution,photo,mouse;
uniform float time,energy;
uniform vec4 ripple0,ripple1,ripple2,ripple3,ripple4,ripple5;
vec3 sampleArtwork(vec2 p){return mix(texture2D(previousArtwork,p).rgb,texture2D(artwork,p).rgb,clarity);}
// One expanding ring: xy = origin, z = age in seconds, w = strength.
vec2 ring(vec2 p,vec4 r,float ratio){
 vec2 d=(p-r.xy)*vec2(ratio,1.);float radius=length(d),front=radius-r.z*.42;
 float wave=sin(front*46.)*exp(-front*front*55.)*exp(-r.z*1.5)*r.w*smoothstep(0.,.05,r.z);
 return d/max(radius,.0001)*wave;
}
void main(){
 float ratio=resolution.x/resolution.y,sourceRatio=photo.x/photo.y;
 vec2 cover=vec2(min(ratio/sourceRatio,1.),min(sourceRatio/ratio,1.));
 vec2 q=(uv-.5)*cover+.5+vec2(0.,-.04)*(1.-cover);
 vec2 delta=uv-mouse;float distance=length(delta*vec2(ratio,1.));
 float wave=sin(distance*24.-time*3.)*exp(-distance*3.5)*energy;
 vec2 rings=ring(uv,ripple0,ratio)+ring(uv,ripple1,ratio)+ring(uv,ripple2,ratio)
  +ring(uv,ripple3,ratio)+ring(uv,ripple4,ratio)+ring(uv,ripple5,ratio);
 vec2 ripple=normalize(delta+vec2(.0001))*wave*.008+rings*vec2(1./ratio,1.)*.011;
 vec2 shift=ripple;
 vec2 fringe=ripple*.24;
 vec3 color=sampleArtwork(q+shift);
 color.r=sampleArtwork(q+shift+fringe).r;
 color.b=sampleArtwork(q+shift-fringe).b;
 color+=length(rings)*.05;
 gl_FragColor=vec4(color,1.);
}`;

export function initHeroOptics({ canvas, img, motion, on }) {
  if (!canvas || !img || !motion) return () => {};
  const host = canvas.closest('.hero-art');
  let gl = null,
    program = null,
    buffer = null,
    texture = null,
    previousTexture = null,
    uniforms = {};
  let alive = true,
    ready = false,
    visible = false,
    raf = 0,
    last = 0,
    clock = 0,
    energy = 0,
    px = 0.5,
    py = 0.5,
    tx = 0.5,
    ty = 0.5,
    clarity = 1,
    trailX = -1,
    trailY = -1,
    trailTime = 0;
  // Rings left along the pointer path and on press; the oldest slot is reused.
  const ripples = Array.from({ length: 6 }, () => ({ x: 0.5, y: 0.5, age: 9, power: 0 }));
  function addRipple(x, y, power) {
    const r = ripples.pop();
    Object.assign(r, { x, y, age: 0, power });
    ripples.unshift(r);
    schedule();
  }
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      throw Error('Optical shader');
    }
    return s;
  }
  try {
    gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      powerPreference: 'low-power',
    });
    if (!gl) return () => {};
    program = gl.createProgram();
    const vs = shader(gl.VERTEX_SHADER, vertex),
      fs = shader(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Optical program');
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    uniforms = Object.fromEntries(
      [
        'clarity',
        'resolution',
        'photo',
        'mouse',
        'time',
        'energy',
        ...ripples.map((_, i) => `ripple${i}`),
      ].map((key) => [key, gl.getUniformLocation(program, key)]),
    );
    [texture, previousTexture] = [gl.createTexture(), gl.createTexture()];
    for (const tex of [texture, previousTexture]) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.uniform1i(gl.getUniformLocation(program, 'artwork'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'previousArtwork'), 1);
  } catch {
    if (gl) {
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    }
    return () => {};
  }
  function schedule() {
    if (alive && visible && ready && !document.hidden && !raf) raf = requestAnimationFrame(draw);
  }
  function upload() {
    if (!alive || !gl || gl.isContextLost() || !img.naturalWidth) return;
    if (ready) {
      [texture, previousTexture] = [previousTexture, texture];
      clarity = 0;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    } else
      for (const tex of [texture, previousTexture]) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      }
    ready = true;
    schedule();
  }
  function draw(now) {
    raf = 0;
    if (!alive || !visible || document.hidden) return;
    const dt = Math.min(0.04, (now - last) / 1000 || 0.016);
    last = now;
    clock += dt;
    clarity = Math.min(1, clarity + dt * 1.8);
    const d = isLite() ? 0.7 : Math.min(devicePixelRatio || 1, 1.25);
    const width = Math.round(canvas.clientWidth * d),
      height = Math.round(canvas.clientHeight * d);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    // Follow the pointer closely; the slow follow read as input lag.
    const ease = 1 - Math.exp(-dt * 22);
    px += (tx - px) * ease;
    py += (ty - py) * ease;
    energy *= Math.exp(-dt * 1.05);
    ripples.forEach((r) => (r.age += dt));
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, previousTexture);
    gl.uniform1f(uniforms.clarity, clarity);
    gl.uniform2f(uniforms.resolution, width, height);
    gl.uniform2f(uniforms.photo, img.naturalWidth, img.naturalHeight);
    gl.uniform2f(uniforms.mouse, px, py);
    gl.uniform1f(uniforms.time, clock);
    gl.uniform1f(uniforms.energy, energy);
    ripples.forEach((r, i) => gl.uniform4f(uniforms[`ripple${i}`], r.x, r.y, r.age, r.power));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    canvas.classList.add('ready');
    if (
      energy > 0.002 ||
      clarity < 1 ||
      Math.abs(tx - px) + Math.abs(ty - py) > 0.0005 ||
      ripples[0].age < 3.5
    )
      schedule();
  }
  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) {
        last = 0;
        schedule();
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    { threshold: 0.01 },
  );
  observer.observe(host);
  on(img, 'load', upload);
  if (img.complete) upload();
  const pin = host.closest('.opening-pin') || host;
  // Measure against the canvas itself: it is scaled and shifted by the parallax,
  // so the host box would place the ripple away from the pointer.
  function locate(event) {
    const rect = canvas.getBoundingClientRect();
    tx = (event.clientX - rect.left) / rect.width;
    ty = (event.clientY - rect.top) / rect.height;
  }
  on(
    pin,
    'pointermove',
    (event) => {
      locate(event);
      energy = 1;
      const ratio = canvas.clientWidth / Math.max(1, canvas.clientHeight),
        travel = Math.hypot((tx - trailX) * ratio, ty - trailY),
        now = event.timeStamp;
      if (travel > 0.06 || (travel > 0.012 && now - trailTime > 140)) {
        addRipple(tx, ty, Math.min(0.85, 0.35 + travel * 4));
        trailX = tx;
        trailY = ty;
        trailTime = now;
      }
      schedule();
    },
    { passive: true },
  );
  on(
    pin,
    'pointerdown',
    (event) => {
      if (event.button !== 0) return;
      locate(event);
      addRipple(tx, ty, 0.95);
    },
    { passive: true },
  );
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
  on(canvas, 'webglcontextlost', (event) => {
    event.preventDefault();
    ready = false;
    canvas.classList.remove('ready');
    cancelAnimationFrame(raf);
    raf = 0;
  });
  return () => {
    alive = false;
    observer.disconnect();
    cancelAnimationFrame(raf);
    canvas.classList.remove('ready');
    gl.deleteTexture(texture);
    gl.deleteTexture(previousTexture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
