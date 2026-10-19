import {progressiveTexture} from './images.js?v=2.0.1';
const TAU=Math.PI*2;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};

// An inline landscape: page position steers the camera; time keeps the scene alive.
export function initPanorama({motion,on}){
 const stage=document.querySelector('.garden-viewer');if(!stage)return ()=>{};
 const pin=stage.querySelector('.garden-pin'),surface=stage.querySelector('.garden-surface'),canvas=stage.querySelector('canvas'),fallback=stage.querySelector('.garden-fallback');
 stage.classList.toggle('is-scroll-scene',motion);
 let alive=true,visible=false,ready=false,raf=0,last=0,elapsed=0,progress=0,yaw=0,offset=0,offsetTarget=0,speed=0,press=0,pressTarget=0,hover=0,hoverTarget=0,px=0,py=0,tx=0,ty=0,rippleAge=8,touch=null,clarity=1;
 let gl=null,program,texture,previousTexture,buffer,shaders=[],uniforms={},observer,resize;
 const ripple=[0,0];
 function geometry(){
  const r=stage.getBoundingClientRect();
  // Complete the turn as the original-size banner passes through the viewport.
  return clamp((innerHeight*.85-r.top)/Math.max(1,innerHeight*.85+r.height*.35));
 }
 function draw(){
  const angle=yaw+offset;
  fallback.style.backgroundPosition=`calc(50% + ${-angle/TAU*pin.clientHeight*3}px) 50%`;
  const breath=motion?1.025+Math.sin(elapsed*.68)*.012:1.025;
  fallback.style.transform=`scale(${breath}) translate(${px*-9}px,${py*-6}px)`;
  if(!ready||!gl)return;
  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,previousTexture);
  gl.uniform1f(uniforms.clarity,clarity);gl.uniform1f(uniforms.yaw,angle);gl.uniform1f(uniforms.aspect,canvas.width/canvas.height);
  gl.uniform1f(uniforms.time,elapsed);gl.uniform1f(uniforms.motion,motion?1:0);gl.uniform1f(uniforms.speed,speed);gl.uniform1f(uniforms.press,press);gl.uniform1f(uniforms.hover,hover);
  gl.uniform2f(uniforms.pointer,px,py);gl.uniform2f(uniforms.ripple,ripple[0],ripple[1]);gl.uniform1f(uniforms.rippleAge,rippleAge);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }
 function tick(now){
  raf=0;if(!alive||!visible||document.hidden)return;
  const dt=Math.min((now-last)/1000||.0167,.05);last=now;elapsed+=dt;rippleAge+=dt;clarity=Math.min(1,clarity+dt*1.6);
  progress=motion?geometry():0;
  // Damped scroll movement settles while the time-based water and breath continue.
  const target=TAU*smooth((progress-.035)/.93),oldYaw=yaw;
  yaw=motion?yaw+(target-yaw)*(1-Math.exp(-dt*8)):0;
  offset+=(offsetTarget-offset)*(motion?1-Math.exp(-dt*9):1);
  speed+=(Math.min(1,Math.abs(yaw-oldYaw)/Math.max(dt,.001)*.32)-speed)*(1-Math.exp(-dt*5));
  px+=(tx-px)*(1-Math.exp(-dt*5));py+=(ty-py)*(1-Math.exp(-dt*5));
  press+=(pressTarget-press)*(1-Math.exp(-dt*7));hover+=(hoverTarget-hover)*(1-Math.exp(-dt*4));
  draw();
  if(motion||Math.abs(offsetTarget-offset)>.0001)raf=requestAnimationFrame(tick);
 }
 function wake(){if(!raf&&alive&&visible&&!document.hidden){last=performance.now();raf=requestAnimationFrame(tick);}}
 function resizeView(){const r=pin.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,innerWidth<700?1.35:1.5);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));if(gl)gl.viewport(0,0,canvas.width,canvas.height);if(!motion)yaw=0;draw();wake();}
 function locate(e){const r=pin.getBoundingClientRect();tx=clamp((e.clientX-r.left)/r.width*2-1,-1,1);ty=clamp(1-(e.clientY-r.top)/r.height*2,-1,1);}
 on(surface,'pointerenter',e=>{locate(e);hoverTarget=1;wake();});
 on(surface,'pointermove',e=>{
  locate(e);hoverTarget=1;
  // Optional sideways touch exploration; vertical swipes always belong to the page.
  if(touch&&e.pointerId===touch.id){const dx=e.clientX-touch.x,dy=e.clientY-touch.y;if(!touch.horizontal&&Math.abs(dy)>Math.abs(dx)+6){touch=null;pressTarget=0;return;}if(Math.abs(dx)>Math.abs(dy)+8)touch.horizontal=true;if(touch.horizontal){offsetTarget=touch.offset-dx/pin.clientWidth*2.1;}}
  wake();
 });
 on(surface,'pointerdown',e=>{if(e.button!==0)return;locate(e);pressTarget=1;hoverTarget=1;ripple[0]=tx;ripple[1]=ty;rippleAge=0;if(e.pointerType==='touch')touch={id:e.pointerId,x:e.clientX,y:e.clientY,offset:offsetTarget,horizontal:false};wake();});
 function release(){pressTarget=0;touch=null;wake();}
 on(window,'pointerup',release);on(surface,'pointercancel',release);
 on(surface,'pointerleave',()=>{hoverTarget=0;pressTarget=0;tx=0;ty=0;touch=null;wake();});
 on(surface,'wheel',e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY)*1.2){offsetTarget+=clamp(e.deltaX,-160,160)*.0025;wake();}},{passive:true});
 on(surface,'keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();offsetTarget+=e.key==='ArrowLeft'?-.2:.2;wake();});
 on(window,'scroll',wake,{passive:true});on(window,'resize',resizeView,{passive:true});
 on(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else wake();});
 observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){yaw=motion?TAU*smooth((geometry()-.035)/.93):0;wake();}else{cancelAnimationFrame(raf);raf=0;pressTarget=0;hoverTarget=0;touch=null;}},{rootMargin:'80px'});observer.observe(stage);
 resize=new ResizeObserver(resizeView);resize.observe(pin);
 function disposeGL(){if(!gl)return;gl.deleteTexture(texture);gl.deleteTexture(previousTexture);gl.deleteBuffer(buffer);gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));gl=null;}
 function useFallback(){disposeGL();canvas.hidden=true;ready=true;stage.classList.remove('is-webgl');stage.classList.add('is-ready');draw();}
 on(canvas,'webglcontextlost',e=>{e.preventDefault();useFallback();});
 const sourceStop=progressiveTexture({target:stage,name:'garden-panorama',src:new URL('./assets/garden-panorama.webp?v=1.8.0',import.meta.url).href,onImage(img,high){
  if(!alive)return;
  if(high)fallback.style.backgroundImage=`url('${img.src}')`;
  if(ready&&gl){[texture,previousTexture]=[previousTexture,texture];gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);clarity=motion?0:1;wake();return;}
  try{
   gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,powerPreference:'low-power'});if(!gl){useFallback();return;}
   const vertex='attribute vec2 position;varying vec2 uv;void main(){uv=position;gl_Position=vec4(position,0.,1.);}';
   const fragment=`precision highp float;
    varying vec2 uv;uniform sampler2D scene,previousScene;uniform float clarity,yaw,aspect,time,motion,speed,press,hover,rippleAge;uniform vec2 pointer,ripple;
    vec3 sampleScene(vec2 p){return mix(texture2D(previousScene,p).rgb,texture2D(scene,p).rgb,clarity);}
    vec3 garden(vec2 p){float x=fract(p.x)*.9;float v=clamp(p.y,.006,.994);vec3 c=sampleScene(vec2(x,v));if(x<.1)c=mix(sampleScene(vec2(x+.9,v)),c,smoothstep(0.,.1,x));return c;}
    void main(){
     float breath=(.5+.5*sin(time*.68))*motion;
     vec2 screen=uv/(1.+breath*.028);
     screen.x+=sin(time*.31)*.008*motion;
     screen.y+=sin(time*.43+.8)*.004*motion;
     vec2 delta=screen-pointer;delta.x*=aspect;
     float nearPointer=exp(-dot(delta,delta)*3.8)*hover*motion;
     vec2 rd=screen-ripple;rd.x*=aspect;float radius=length(rd);
     float age=rippleAge;float wave=sin((radius-age*.36)*45.)*exp(-pow((radius-age*.36)*6.,2.))*exp(-age*1.2)*motion;
     screen+=vec2(rd.x/aspect,rd.y)/(radius+.12)*wave*.017;
     screen+=delta/vec2(aspect,1.)*nearPointer*(.014+press*.02);
     float x=screen.x*aspect*.35;float view=min(.30,aspect*.135);
     float u=.5555556+yaw/6.2831853+atan(x)/atan(aspect*.35)*view;
     float v=.5-screen.y*.455/sqrt(1.+x*x);
     float depth=smoothstep(.32,.97,v);
     // Sky barely responds; the near bank follows the gaze with more weight.
     vec2 p=vec2(u,v)+vec2(-pointer.x*.008,pointer.y*.012)*depth*hover*motion;
     p.y+=sin(time*.68)*.0035*depth*motion;
     vec3 raw=garden(p);
     float water=smoothstep(.018,.14,raw.b-raw.g)*smoothstep(.35,.78,v);
     vec2 flow=vec2(sin(v*36.+time*1.05)+sin(v*71.-time*.63)*.35,cos(u*56.-time*.72));
     p+=flow*.0032*water*motion;
     float petals=smoothstep(.055,.19,raw.r-raw.g)*smoothstep(.4,.9,v);
     p.x+=sin(v*24.+time*.85)*.00085*petals*motion;
     float peripheral=smoothstep(.3,1.4,length(uv*vec2(.8,1.)));
     float breathFocus=(.5+.5*sin(time*.68+.8))*.00065*peripheral;
     float blur=(breathFocus+.0012*speed*(.35+depth)+.0006*press*(1.-nearPointer))*motion;
     vec2 axis=vec2(blur,blur*.65);
     vec3 color=garden(p)*.4;
     color+=(garden(p+axis)+garden(p-axis)+garden(p+vec2(-axis.x,axis.y))+garden(p+vec2(axis.x,-axis.y)))*.15;
     float glint=sin(v*52.+time*.9+sin(u*41.-time*.55));
     color+=vec3(.55,.65,.9)*glint*.018*water*motion;
     color*=1.+sin(time*.51)*.012*motion;
     color+=vec3(.36,.43,.62)*wave*.02*water;
     color+=vec3(.12,.18,.2)*nearPointer*.025*motion;
     gl_FragColor=vec4(color,1.);
    }`;
   function compile(type,source){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
   program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Garden shader link');gl.useProgram(program);
   buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
   [texture,previousTexture]=[gl.createTexture(),gl.createTexture()];
   for(const [unit,tex] of [texture,previousTexture].entries()){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);}gl.uniform1i(gl.getUniformLocation(program,'scene'),0);gl.uniform1i(gl.getUniformLocation(program,'previousScene'),1);
   for(const name of ['clarity','yaw','aspect','time','motion','speed','press','hover','pointer','ripple','rippleAge'])uniforms[name]=gl.getUniformLocation(program,name);
   ready=true;resizeView();stage.classList.add('is-ready','is-webgl');wake();
  }catch(error){console.warn('Garden: using image fallback.',error);useFallback();}
 }});
 return ()=>{alive=false;cancelAnimationFrame(raf);observer.disconnect();resize.disconnect();sourceStop();disposeGL();};
}
