import { preview, decodeImage, setProgressiveImage } from './images.js?v=2.0.1';
// A small glass screen made from the portfolio itself. No stock 3D object.
const vertex = `attribute vec2 position;varying vec2 uv;
void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision highp float;
varying vec2 uv;
uniform sampler2D imageA,imageB;
uniform vec2 resolution,pointer,velocity;
uniform float time,assembly,attention,transition;
uniform vec4 ripple0,ripple1,ripple2;
mat2 turn(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float wave(vec2 p,vec4 r){float d=length((p-r.xy)*vec2(1.5,1.));
 return sin(d*48.-r.z*11.)*exp(-d*3.5-r.z*2.7)*r.w*smoothstep(0.,.12,r.z);}
vec3 photograph(sampler2D tex,vec2 p,float blur,float chroma){
 vec2 b=vec2(blur,blur*.45);
 vec3 color=texture2D(tex,p).rgb*.36;
 color+=texture2D(tex,p+b).rgb*.16+texture2D(tex,p-b).rgb*.16;
 color+=texture2D(tex,p+vec2(-b.x,b.y)).rgb*.16+texture2D(tex,p+vec2(b.x,-b.y)).rgb*.16;
 color.r=mix(color.r,texture2D(tex,p+vec2(chroma,0.)).r,.48);
 color.b=mix(color.b,texture2D(tex,p-vec2(chroma,0.)).b,.48);
 return color;
}
void main(){
 float aspect=resolution.x/resolution.y;
 vec2 p=(uv-.5)*vec2(aspect,1.);
 vec2 m=(pointer-.5)*vec2(aspect,1.);
 float scattered=1.-assembly;
 float rings=wave(uv,ripple0)+wave(uv,ripple1)+wave(uv,ripple2);
 vec4 result=vec4(0.);
 // Fill subpixel seams only as the nine panes become a single photograph.
 vec2 whole=p/vec2(1.179,.67)+.5;
 if(whole.x>0.&&whole.x<1.&&whole.y>0.&&whole.y<1.){
  float blend=transition<=.001?0.:smoothstep(0.,1.,transition);
  result=vec4(mix(texture2D(imageA,whole).rgb,texture2D(imageB,whole).rgb,blend),smoothstep(.92,1.,assembly));
 }
 for(int i=0;i<9;i++){
  float n=float(i),offset=n-4.;
  float width=.131;
  float influence=exp(-pow((offset*.145-m.x)*3.4,2.))*attention;
  vec2 center=vec2(offset*width*(1.+.075*scattered),0.);
  center.y=(sin(n*1.37)*.036+sin(time*.62+n*.78)*.011)*scattered;
  center+=vec2(velocity.x*.07,velocity.y*.04)*influence*scattered;
  float angle=(offset*.018+sin(time*.4+n)*.014+influence*(m.y*.12+velocity.x*.16))*scattered;
  vec2 q=turn(angle)*(p-center);
  float height=.67+(cos(n*1.27)*.025)*scattered;
  vec2 edge=vec2(width*.5-abs(q.x),height*.5-abs(q.y));
  float mask=smoothstep(0.,.0017,min(edge.x,edge.y));
  if(mask>.001){
   float band=clamp(q.x/width+.5,0.,1.);
   vec2 photo=vec2((n+band)/9.,q.y/.67+.5);
   vec2 delta=uv-pointer;float distance=length(delta*vec2(aspect,1.));
   float lens=exp(-distance*distance*25.)*attention*scattered;
   float fold=sin(band*3.14159);
   photo.x+=(fold*.011+sin(q.y*16.+time*.7+n)*.004)*scattered;
   photo+=delta*lens*.12+normalize(delta+vec2(.001))*rings*.016*scattered;
   photo+=velocity*influence*.018*scattered;
   float blur=(.0014+.0055*(1.-influence))*scattered;
   float chroma=(.002+influence*.004+abs(rings)*.004)*scattered;
   float wipe=smoothstep(0.,.65,transition*1.8-n*.055);
   if(transition<=.001)wipe=0.;
   photo.x+=sin(wipe*3.14159)*(.032+offset*.004)*scattered;
   vec3 color=mix(photograph(imageA,photo,blur,chroma),photograph(imageB,photo,blur,chroma),wipe);
   float sheen=pow(max(0.,1.-band),10.)*.15+pow(band,16.)*.10;
   color=mix(color,vec3(.89,.92,.89),sheen*scattered);
   color+=vec3(.03,.035,.025)*sin(band*3.14159)*scattered;
   float topEdge=smoothstep(.006,0.,edge.y)*.1;
   color=mix(color,vec3(.96,.97,.92),topEdge*scattered);
   result=mix(result,vec4(color,1.),mask);
  }
 }
 gl_FragColor=result;
}`;

export function initIdentity({ motion, on }) {
  const host = document.querySelector('#identity-toy');
  if (!host) return () => {};
  const canvas = host.querySelector('canvas'),
    control = host.querySelector('.portal-object');
  const fallback = host.querySelector('.portal-backup img');
  const sourceNames = host.dataset.images.split(',');
  const sources = sourceNames.map(
    (name) => new URL(`assets/${name}-sm.webp?v=1.1.0`, import.meta.url).href,
  );
  const counter = host.querySelector('.portal-count');
  let alive = true,
    visible = false,
    loading = false,
    ready = false,
    raf = 0,
    last = 0,
    clock = 0;
  let gl = null,
    program = null,
    buffer = null,
    textures = [],
    uniforms = {};
  let index = 0,
    targetIndex = 0,
    desiredIndex = 0,
    progress = 1;
  let down = false,
    latched = false,
    assembly = 0,
    assemblySpeed = 0;
  let px = 0.5,
    py = 0.5,
    tx = 0.5,
    ty = 0.5,
    vx = 0,
    vy = 0,
    attention = 0,
    targetAttention = 0;
  let ripples = [
    { x: 0.5, y: 0.5, age: 4, power: 0 },
    { x: 0.5, y: 0.5, age: 4, power: 0 },
    { x: 0.5, y: 0.5, age: 4, power: 0 },
  ];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function schedule() {
    if (alive && visible && !document.hidden && !raf) raf = requestAnimationFrame(tick);
  }
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw Error(message);
    }
    return shader;
  }
  try {
    gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: 'low-power',
    });
    if (gl) {
      program = gl.createProgram();
      const vs = compile(gl.VERTEX_SHADER, vertex),
        fs = compile(gl.FRAGMENT_SHADER, fragment);
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(program));
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
          'imageA',
          'imageB',
          'resolution',
          'pointer',
          'velocity',
          'time',
          'assembly',
          'attention',
          'transition',
          'ripple0',
          'ripple1',
          'ripple2',
        ].map((key) => [key, gl.getUniformLocation(program, key)]),
      );
      gl.uniform1i(uniforms.imageA, 0);
      gl.uniform1i(uniforms.imageB, 1);
    }
  } catch (error) {
    if (gl) {
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    }
    gl = null;
  }
  host.dataset.renderer = 'image';
  function load() {
    if (loading || !gl) return;
    loading = true;
    function upload(images) {
      if (!alive || !gl) return;
      images.forEach((img, i) => {
        if (!textures[i]) textures[i] = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, textures[i]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      });
      ready = true;
      host.dataset.renderer = 'glass';
      render();
      schedule();
    }
    Promise.all(sourceNames.map((name) => decodeImage(preview(name))))
      .then((images) => {
        upload(images);
        return Promise.all(sources.map((src) => decodeImage(src)));
      })
      .then(upload)
      .catch(() => {});
  }
  function updateCaption() {
    counter.textContent = `0${targetIndex + 1} / 0${sources.length}`;
    host.dataset.frame = String(targetIndex);
    setProgressiveImage(fallback, {
      name: sourceNames[targetIndex],
      src: sources[targetIndex],
      sizes: '(max-width:700px) 70vw, 32vw',
    });
  }
  function change(step) {
    desiredIndex = (desiredIndex + step + sources.length) % sources.length;
    if (progress >= 1) startTransition();
    schedule();
  }
  function startTransition() {
    if (desiredIndex === index) return;
    targetIndex = desiredIndex;
    progress = motion ? 0 : 1;
    updateCaption();
    if (!motion) {
      index = targetIndex;
      render();
    }
  }
  function addRipple(x, y, power) {
    ripples.pop();
    ripples.unshift({ x, y, age: 0, power });
    schedule();
  }
  function setHeld(value) {
    down = value;
    control.setAttribute('aria-pressed', String(down || latched));
    host.classList.toggle('is-revealing', down || latched);
    if (!motion) {
      assembly = down || latched ? 1 : 0;
      render();
    }
    schedule();
  }
  function point(event) {
    const rect = control.getBoundingClientRect();
    tx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    ty = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  }
  function render() {
    if (gl && ready) {
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textures[index]);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, textures[targetIndex]);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.pointer, px, py);
      gl.uniform2f(uniforms.velocity, vx, vy);
      gl.uniform1f(uniforms.time, clock);
      gl.uniform1f(uniforms.assembly, assembly);
      gl.uniform1f(uniforms.attention, attention);
      gl.uniform1f(uniforms.transition, progress >= 1 ? 0 : progress);
      ripples.forEach((r, i) => gl.uniform4f(uniforms[`ripple${i}`], r.x, r.y, r.age, r.power));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    host.style.setProperty('--portal-shift', `${(px - 0.5) * 8}px`);
    host.dataset.assembled = String(assembly > 0.97);
  }
  function tick(now) {
    raf = 0;
    if (!alive || !visible || document.hidden) return;
    const dt = clamp((now - last) / 1000 || 0.016, 0, 0.04);
    last = now;
    if (motion) {
      clock += dt;
      const ease = 1 - Math.exp(-dt * 10),
        oldX = px,
        oldY = py;
      px += (tx - px) * ease;
      py += (ty - py) * ease;
      vx = (px - oldX) * 18;
      vy = (py - oldY) * 18;
      attention += (targetAttention - attention) * ease;
      const goal = down || latched ? 1 : 0;
      assemblySpeed += ((goal - assembly) * 105 - assemblySpeed * 18) * dt;
      assembly += assemblySpeed * dt;
      assembly = clamp(assembly, 0, 1);
      ripples.forEach((r) => (r.age += dt));
      if (progress < 1) {
        progress = Math.min(1, progress + dt * 1.25);
        if (progress === 1) {
          index = targetIndex;
          startTransition();
        }
      }
    }
    render();
    // An idle folded screen breathes slowly; leave it completely still when motion is off.
    if (motion) schedule();
  }
  function resize() {
    if (gl) {
      const rect = control.getBoundingClientRect(),
        d = Math.min(devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(rect.width * d);
      canvas.height = Math.round(rect.height * d);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    render();
    schedule();
  }
  on(control, 'pointerenter', () => {
    targetAttention = 1;
    schedule();
  });
  on(control, 'pointermove', (event) => {
    point(event);
    targetAttention = 1;
    if (!motion) {
      px = tx;
      py = ty;
      render();
    }
    schedule();
  });
  on(control, 'pointerdown', (event) => {
    if (event.button !== 0) return;
    point(event);
    latched = false;
    setHeld(true);
    control.setPointerCapture(event.pointerId);
    addRipple(tx, ty, 1);
  });
  function release(event) {
    if (!down) return;
    setHeld(false);
    if (control.hasPointerCapture(event.pointerId)) control.releasePointerCapture(event.pointerId);
    addRipple(tx, ty, 0.7);
  }
  on(control, 'pointerup', release);
  on(control, 'pointercancel', release);
  on(control, 'lostpointercapture', () => {
    if (down) setHeld(false);
  });
  on(control, 'pointerleave', () => {
    targetAttention = 0;
    tx = 0.5;
    ty = 0.5;
    schedule();
  });
  on(control, 'click', (event) => {
    if (event.detail !== 0) return;
    latched = !latched;
    setHeld(false);
    addRipple(0.5, 0.5, 0.8);
  });
  on(control, 'keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      change(event.key === 'ArrowRight' ? 1 : -1);
    }
    if (event.key === 'Escape') {
      latched = false;
      setHeld(false);
    }
  });
  on(control, 'blur', () => {
    latched = false;
    setHeld(false);
  });
  on(host.querySelector('[data-portal-prev]'), 'click', () => {
    change(-1);
    addRipple(0.2, 0.5, 0.7);
  });
  on(host.querySelector('[data-portal-next]'), 'click', () => {
    change(1);
    addRipple(0.8, 0.5, 0.7);
  });
  on(host.querySelector('[data-toy-reset]'), 'click', () => {
    latched = false;
    setHeld(false);
    desiredIndex = 0;
    if (progress >= 1) startTransition();
    tx = ty = 0.5;
    addRipple(0.5, 0.5, 0.8);
  });
  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      document.body.classList.toggle('footer-at-play', visible);
      if (visible) {
        load();
        last = 0;
        schedule();
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
        latched = false;
        setHeld(false);
      }
    },
    { threshold: 0.05 },
  );
  observer.observe(host);
  const resizer = new ResizeObserver(resize);
  resizer.observe(control);
  resize();
  updateCaption();
  on(canvas, 'webglcontextlost', (event) => {
    event.preventDefault();
    ready = false;
    gl = null;
    host.dataset.renderer = 'image';
  });
  on(document, 'visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      last = 0;
      schedule();
    }
  });
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    observer.disconnect();
    resizer.disconnect();
    document.body.classList.remove('footer-at-play');
    if (gl) {
      textures.forEach((texture) => gl.deleteTexture(texture));
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}
