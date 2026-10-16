import {logoSvg} from './logo-geometry.js?v=1.3.1';

export function signatureMarkup({image,alternate,label}){
 return `<div id="signature" class="signature-anchor"><button class="note-reading-mark signature-plate" type="button" data-lightbox="eastern-bloom" aria-label="${label}"><span class="signature-picture">${image}${alternate}<canvas class="signature-optics" aria-hidden="true"></canvas></span><span class="signature-imprint">${logoSvg()}</span></button></div>`;
}

const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision highp float;
varying vec2 uv;uniform sampler2D artwork,previousArtwork,alternateArtwork,previousAlternate;
uniform vec2 resolution,photo,mouse,drift;uniform vec4 wakes[4];
uniform float time,activity,pressure,clarity,secondaryClarity,blend,reading;
vec3 sampleArt(vec2 p){
 vec3 first=mix(texture2D(previousArtwork,p).rgb,texture2D(artwork,p).rgb,clarity);
 vec3 second=mix(texture2D(previousAlternate,p).rgb,texture2D(alternateArtwork,p).rgb,secondaryClarity);
 vec2 delta=(uv-mouse)*vec2(resolution.x/resolution.y,1.);
 float local=exp(-dot(delta,delta)*7.);
 float dissolve=clamp(blend+sin(blend*3.14159265)*(local-.45)*.28,0.,1.);
 return mix(first,second,dissolve);
}
void main(){
 float ratio=resolution.x/resolution.y,sourceRatio=photo.x/photo.y;
 vec2 cover=vec2(min(ratio/sourceRatio,1.),min(sourceRatio/ratio,1.));
 float breath=sin(time*.62)*.002;
 vec2 q=(uv-.5)*cover/(1.08-pressure*.065+breath)+.5;
 q+=vec2(-drift.x*.026,drift.y*.018+reading*.028)*cover;
 vec2 delta=uv-mouse,metric=delta*vec2(ratio,1.);
 float radius=length(metric),lens=exp(-dot(metric,metric)*10.)*activity*(1.-pressure*.82);
 q-=delta*cover*lens*.19;
 vec2 refraction=vec2(0.);
 for(int i=0;i<4;i++){
  vec2 d=uv-wakes[i].xy;float dist=length(d*vec2(ratio,1.));
  float age=max(0.,time-wakes[i].z),envelope=exp(-age*2.4)*exp(-dist*4.8)*wakes[i].w;
  float wave=sin(dist*30.-age*8.)*envelope;
  refraction+=normalize(d+vec2(.0001))*wave*.014;
 }
 refraction*=1.-pressure*.9;
 q+=refraction*cover;
 // The surface follows the photograph's highlights rather than drawing a UI ring.
 vec3 color=sampleArt(q);
 float dispersion=lens*.0011+length(refraction)*.07;
 color.r=sampleArt(q+vec2(dispersion,0.)*cover).r;
 color.b=sampleArt(q-vec2(dispersion,0.)*cover).b;
 float defocus=activity*(1.-pressure)*smoothstep(.14,.65,radius)*.0016;
 vec3 soft=sampleArt(q+vec2(defocus,0.))+sampleArt(q-vec2(defocus,0.))+sampleArt(q+vec2(0.,defocus))+sampleArt(q-vec2(0.,defocus));
 color=mix(color,soft*.25,activity*(1.-pressure)*.6);
 gl_FragColor=vec4(color,1.);
}`;

function createSurface(canvas,images,on){
 let gl,program,buffer,textures=[],uniforms={},alive=true,ready=false,sourceRatio=1;
 const stages=images.map(()=>({ready:false,clarity:1,textures:[]}));
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw Error('Signature optics shader')}return s;}
 function dispose(){alive=false;canvas.classList.remove('ready');if(!gl)return;for(const texture of textures)gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}
 try{
  gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!gl)return null;
  const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Signature optics program');
  gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  for(const key of ['resolution','photo','mouse','drift','time','activity','pressure','clarity','secondaryClarity','blend','reading','wakes[0]'])uniforms[key]=gl.getUniformLocation(program,key);
  textures=Array.from({length:4},()=>gl.createTexture());
  for(const texture of textures){gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([242,241,236,255]));}
  stages[0].textures=textures.slice(0,2);stages[1].textures=textures.slice(2,4);
  ['artwork','previousArtwork','alternateArtwork','previousAlternate'].forEach((key,i)=>gl.uniform1i(gl.getUniformLocation(program,key),i));
 }catch{dispose();return null;}
 function upload(img,index){if(!alive||!img.naturalWidth||gl.isContextLost())return;
  const stage=stages[index];
  try{
   gl.activeTexture(gl.TEXTURE0);
   if(stage.ready){stage.textures.reverse();gl.bindTexture(gl.TEXTURE_2D,stage.textures[0]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);stage.clarity=0;}
   else for(const texture of stage.textures){gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);}
   stage.ready=true;if(index===0){sourceRatio=img.naturalWidth/img.naturalHeight;ready=true;}
  }catch{if(index===0){ready=false;canvas.classList.remove('ready');}}
 }
 images.forEach((img,index)=>{on(img,'load',()=>upload(img,index));if(img.complete)upload(img,index)});
 on(canvas,'webglcontextlost',e=>{e.preventDefault();ready=false;canvas.classList.remove('ready')});
 return {draw(state,dt){if(!ready||!alive||gl.isContextLost())return;
  const d=Math.min(Math.max(devicePixelRatio||1,1.5),2),w=Math.max(1,Math.round(canvas.clientWidth*d)),h=Math.max(1,Math.round(canvas.clientHeight*d));
  if(w!==canvas.width||h!==canvas.height){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}
  stages.forEach(stage=>stage.clarity=Math.min(1,stage.clarity+dt*1.8));gl.useProgram(program);stages.flatMap(stage=>stage.textures).forEach((texture,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,texture)});
  gl.uniform2f(uniforms.resolution,w,h);gl.uniform2f(uniforms.photo,sourceRatio,1);gl.uniform2f(uniforms.mouse,state.mx,state.my);gl.uniform2f(uniforms.drift,state.x,state.y);
  for(const key of ['time','activity','pressure','reading'])gl.uniform1f(uniforms[key],state[key]);gl.uniform1f(uniforms.clarity,stages[0].clarity);gl.uniform1f(uniforms.secondaryClarity,stages[1].clarity);gl.uniform1f(uniforms.blend,stages[1].ready?state.activity:0);gl.uniform4fv(uniforms['wakes[0]'],state.wakes);
  gl.drawArrays(gl.TRIANGLES,0,6);canvas.classList.add('ready');
 },dispose};
}

export function initSignature({motion,on}){
 const root=document.querySelector('.signature-plate');if(!root)return()=>{};
 const frame=root.querySelector('.signature-picture'),photo=frame.querySelector('img'),imprint=root.querySelector('.signature-imprint'),canvas=root.querySelector('canvas');
 const photos=[...frame.querySelectorAll('img')],alternate=photos[1];
 function setImage(mix){alternate.style.opacity=mix.toFixed(3);root.dataset.lightbox=mix>.5?'eastern-a':'eastern-bloom';root.dataset.imageMix=mix.toFixed(3);}
 if(!motion){
  on(root,'pointerenter',()=>setImage(1));on(root,'pointerleave',()=>setImage(0));on(root,'focus',()=>setImage(1));on(root,'blur',()=>setImage(0));return()=>{};
 }
 const surface=createSurface(canvas,photos,on);
 let alive=true,raf=0,last=0,time=0,x=0,y=0,tx=0,ty=0,mx=.5,my=.5,activity=0,pressure=0,reading=0,open=0,entered=0;
 let hovering=false,focused=false,held=false,pointerId=null,downAt=0,downX=0,downY=0,moved=false,suppressUntil=0;
 const wakes=new Float32Array(16);for(let i=0;i<4;i++)wakes[i*4+2]=-100;
 let wakeIndex=0,wakeX=-1,wakeY=-1;
 function ripple(px,py,strength){const i=(wakeIndex++%4)*4;wakes.set([px,py,time,strength],i);wakeX=px;wakeY=py;}
 function schedule(){if(alive&&!raf&&!document.hidden)raf=requestAnimationFrame(tick)}
 function locate(e){const r=frame.getBoundingClientRect();const px=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),py=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));tx=px-.5;ty=py-.5;if(Math.hypot(px-wakeX,py-wakeY)>.075)ripple(px,py,.35);schedule()}
 on(root,'pointerenter',e=>{if(e.pointerType==='touch')return;hovering=true;locate(e)});
 on(root,'pointermove',e=>{if(e.pointerType==='touch'&&!held)return;if(held&&Math.hypot(e.clientX-downX,e.clientY-downY)>8)moved=true;locate(e)},{passive:true});
 on(root,'pointerleave',()=>{hovering=false;if(!held)tx=ty=0;schedule()});
 on(root,'focus',()=>{focused=root.matches(':focus-visible');schedule()});on(root,'blur',()=>{focused=false;schedule()});
 on(root,'pointerdown',e=>{if(e.button!==0)return;held=true;pointerId=e.pointerId;downAt=performance.now();downX=e.clientX;downY=e.clientY;moved=false;locate(e);ripple(tx+.5,ty+.5,.65)},{passive:true});
 function release(e){if(pointerId!==e.pointerId)return;const heldTime=performance.now()-downAt;held=false;pointerId=null;if(heldTime>260||moved)suppressUntil=performance.now()+650;ripple(tx+.5,ty+.5,heldTime>260?1:.45);if(e.pointerType==='touch')hovering=false;if(!hovering)tx=ty=0;schedule()}
 on(window,'pointerup',release,{passive:true});on(root,'pointercancel',e=>{held=false;pointerId=null;hovering=false;tx=ty=0;suppressUntil=performance.now()+650;schedule()},{passive:true});
 // A deliberate hold explores the surface; a normal click still opens the artwork.
 on(root,'click',e=>{if(e.detail!==0&&performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation()}},{capture:true});
 on(window,'blur',()=>{held=false;pointerId=null;hovering=false;tx=ty=0;schedule()});
 on(window,'scroll',schedule,{passive:true});on(window,'resize',schedule,{passive:true});on(document,'visibilitychange',()=>{last=0;schedule()});
 function tick(now){
  raf=0;if(!alive||document.hidden)return;
  const r=root.getBoundingClientRect();if(r.bottom<-60||r.top>innerHeight+60){last=0;return}
  if(!hovering&&!focused&&!held&&now-last<1000/30){schedule();return}
  const dt=Math.min(.05,(now-last)/1000||.016);last=now;time+=dt;
  const follow=1-Math.exp(-dt*7),settle=1-Math.exp(-dt*4.5);
  x+=(tx-x)*follow;y+=(ty-y)*follow;mx+=(tx+.5-mx)*follow;my+=(ty+.5-my)*follow;
  activity+=((hovering||focused||held?1:0)-activity)*settle;pressure+=((held?1:0)-pressure)*(1-Math.exp(-dt*5));
  open+=((hovering||focused||held?1:0)-open)*settle;entered+=(1-entered)*(1-Math.exp(-dt*2.8));
  const targetReading=Math.max(-1,Math.min(1,(innerHeight*.5-r.top-r.height*.5)/innerHeight));reading+=(targetReading-reading)*follow;
  frame.style.clipPath=`inset(${(1-entered)*6}% ${((1-open)*18).toFixed(3)}% 0 0)`;
  frame.style.transform=`perspective(850px) translate3d(${(x*6).toFixed(2)}px,${(reading*14+(1-entered)*16).toFixed(2)}px,0) rotateX(${(-y*6*activity).toFixed(3)}deg) rotateY(${(x*7*activity).toFixed(3)}deg)`;
  imprint.style.transform=`translate3d(${(-x*5).toFixed(2)}px,${(-reading*10-y*4).toFixed(2)}px,0)`;
  photos.forEach(img=>img.style.transform=`translate3d(${(-x*10).toFixed(2)}px,${(y*7+reading*8).toFixed(2)}px,0) scale(${(1.08-pressure*.065).toFixed(4)})`);setImage(activity);
  surface?.draw({time,x,y,mx,my,activity,pressure,reading,wakes},dt);
  root.dataset.signatureState=held?'held':activity>.03?'responding':'resting';root.dataset.surface=canvas.classList.contains('ready')?'ready':'fallback';
  schedule();
 }
 schedule();
 return()=>{alive=false;cancelAnimationFrame(raf);surface?.dispose()};
}
