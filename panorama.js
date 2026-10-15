// A cylindrical view of the outpainted garden; no 3D model or motion library.
export function initPanorama({motion,on}) {
 const stage=document.querySelector('.garden-viewer');if(!stage)return ()=>{};
 const surface=stage.querySelector('.garden-surface'),canvas=stage.querySelector('canvas'),fallback=stage.querySelector('.garden-fallback'),bearing=stage.querySelector('output'),track=stage.querySelector('.garden-compass-track');
 const TAU=Math.PI*2;let yaw=0,target=0,velocity=0,raf=0,last=0,visible=false,alive=true,ready=false,drag=null,gl=null,program,texture,buffer,shaders=[],observer,resize;
 const wrap=x=>((x%TAU)+TAU)%TAU;
 function draw(){
  const angle=wrap(yaw),degrees=Math.round(angle/TAU*360)%360;
  bearing.value=String(degrees).padStart(3,'0')+'°';stage.dataset.bearing=String(degrees);
  track.style.transform=`translateX(${-degrees/360*180}px)`;
  fallback.style.backgroundPosition=`calc(50% + ${-yaw/TAU*surface.clientHeight*3}px) 50%`;
  if(!gl||!ready)return;
  gl.useProgram(program);gl.uniform1f(gl.getUniformLocation(program,'yaw'),yaw);gl.uniform1f(gl.getUniformLocation(program,'aspect'),canvas.width/canvas.height);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }
 function tick(now){raf=0;if(!alive||!visible||document.hidden)return;
  const dt=Math.min((now-last)/16.667||1,2);last=now;
  if(!drag){target+=velocity*dt;velocity*=Math.pow(.92,dt);if(Math.abs(velocity)<.00002)velocity=0;}
  yaw=motion?yaw+(target-yaw)*(1-Math.pow(.78,dt)):target;draw();
  if(Math.abs(target-yaw)>.00005||Math.abs(velocity)>.00002)raf=requestAnimationFrame(tick);
 }
 function wake(){if(!raf&&visible&&!document.hidden){last=performance.now();raf=requestAnimationFrame(tick);}}
 function resizeView(){const r=surface.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);if(gl)gl.viewport(0,0,canvas.width,canvas.height);draw();}
 function nudge(amount){target+=amount;velocity=0;wake();}
 on(surface,'pointerdown',e=>{if(e.button!==0||!ready)return;velocity=0;drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,time:performance.now(),active:e.pointerType==='mouse'};if(drag.active){surface.setPointerCapture(e.pointerId);stage.classList.add('is-dragging');}surface.focus({preventScroll:true});});
 on(surface,'pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.active){if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>7){drag=null;return;}if(Math.abs(dx)<7)return;drag.active=true;surface.setPointerCapture(e.pointerId);stage.classList.add('is-dragging');}
  const now=performance.now(),step=-(e.clientX-drag.lastX)/surface.clientWidth*2.4;
  target+=step;velocity=motion?Math.max(-.045,Math.min(.045,step/Math.max(.5,(now-drag.time)/16.667))):0;drag.lastX=e.clientX;drag.time=now;stage.classList.add('has-explored');wake();
 });
 function release(e){if(!drag||e.pointerId!==drag.id)return;if(e.type==='pointercancel'||performance.now()-drag.time>90)velocity=0;if(surface.hasPointerCapture(e.pointerId))surface.releasePointerCapture(e.pointerId);drag=null;stage.classList.remove('is-dragging');wake();}
 on(surface,'pointerup',release);on(surface,'pointercancel',release);on(surface,'lostpointercapture',release);
 on(surface,'keydown',e=>{if(!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home'){target=yaw+Math.atan2(-Math.sin(yaw),Math.cos(yaw));velocity=0;wake();}else nudge(e.key==='ArrowLeft'?-.18:.18);stage.classList.add('has-explored');});
 on(stage.querySelector('[data-garden-left]'),'click',()=>nudge(-.4));on(stage.querySelector('[data-garden-right]'),'click',()=>nudge(.4));
 on(stage.querySelector('[data-garden-reset]'),'click',()=>{target=yaw+Math.atan2(-Math.sin(yaw),Math.cos(yaw));velocity=0;wake();});
 on(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;velocity=0;}else wake();});
 observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)wake();else{cancelAnimationFrame(raf);raf=0;velocity=0;}},{rootMargin:'120px'});observer.observe(stage);
 resize=new ResizeObserver(resizeView);resize.observe(surface);
 function disposeGL(){if(!gl)return;gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));gl=null;}
 function useFallback(){disposeGL();canvas.hidden=true;ready=true;stage.classList.add('is-ready');draw();}
 on(canvas,'webglcontextlost',e=>{e.preventDefault();useFallback();});
 const img=new Image();img.decoding='async';img.onload=()=>{
  if(!alive)return;
  try{
   gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,powerPreference:'low-power'});if(!gl){useFallback();return;}
   const vertex='attribute vec2 position;varying vec2 uv;void main(){uv=position;gl_Position=vec4(position,0.,1.);}';
   const fragment=`precision highp float;varying vec2 uv;uniform sampler2D scene;uniform float yaw;uniform float aspect;
    vec3 sampleGarden(vec2 p){float x=fract(p.x)*.9;vec3 col=texture2D(scene,vec2(x,p.y)).rgb;
     if(x<.1)col=mix(texture2D(scene,vec2(x+.9,p.y)).rgb,col,smoothstep(0.,.1,x));return col;}
    void main(){float x=uv.x*aspect*.35;float window=min(.30,aspect*.135);float across=atan(x)/atan(aspect*.35)*window;float u=.5555556+yaw/6.2831853+across;float v=.5-uv.y*.47/sqrt(1.+x*x);gl_FragColor=vec4(sampleGarden(vec2(u,clamp(v,.01,.99))),1.);}`;
   function compile(type,source){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Garden shader compilation');return s;}
   program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Garden shader link');gl.useProgram(program);
   buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
   texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);gl.uniform1i(gl.getUniformLocation(program,'scene'),0);
   ready=true;resizeView();stage.classList.add('is-ready','is-webgl');wake();
  }catch{useFallback();}
 };
 img.onerror=()=>{if(alive){useFallback();stage.classList.add('image-unavailable');}};
 img.src=new URL('./assets/garden-panorama.webp?v=1.8.0',import.meta.url).href;
 return ()=>{alive=false;cancelAnimationFrame(raf);observer.disconnect();resize.disconnect();img.onload=null;img.onerror=null;disposeGL();};
}
