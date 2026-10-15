import {logoPath} from './logo-geometry.js?v=1.3.1';

// A small physical object: continuous surfaces, a spring morph and angular momentum.
const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision highp float;
varying vec2 uv;uniform vec2 resolution;uniform vec2 angle;uniform vec2 pull;uniform vec2 pointer;uniform vec3 shape;uniform float tension;uniform sampler2D inscription;
mat2 rotate(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
vec3 local(vec3 p){p.xz=rotate(angle.x)*p.xz;p.yz=rotate(angle.y)*p.yz;return p;}
float ellipsoid(vec3 p,vec3 r){float k0=length(p/r),k1=length(p/(r*r));return k0*(k0-1.)/max(k1,.0001);}
float surface(vec3 world){
 vec3 p=local(world);float bend=tension*.16;
 p.z+=sin(p.x*3.7+pull.x*1.2)*bend+p.y*pull.y*.09;
 p.x/=1.+abs(pull.x)*.15;p.y/=1.+abs(pull.y)*.12;
 float a=atan(p.y,p.x),r=length(p.xy);
 float pebble=ellipsoid(p,vec3(.76,.53,.30));
 float orbit=length(vec2(r-(.48+.045*sin(a*3.+tension)),p.z))-.155;
 vec3 q=p;q.xz=rotate(.4)*q.xz;
 float b=atan(q.y,q.x),rr=length(q.xy);vec2 crossSection=vec2(rr-.46,q.z+.15*sin(b*2.));
 crossSection=rotate(b*.5+tension*.35)*crossSection;
 float ribbon=ellipsoid(vec3(crossSection,0.),vec3(.21,.075,1.));
 return pebble*shape.x+orbit*shape.y+ribbon*shape.z;
}
vec3 normalAt(vec3 p){vec2 e=vec2(.0012,0.);return normalize(vec3(surface(p+e.xyy)-surface(p-e.xyy),surface(p+e.yxy)-surface(p-e.yxy),surface(p+e.yyx)-surface(p-e.yyx)));}
vec3 environment(vec3 r){
 vec3 c=mix(vec3(.035,.055,.075),vec3(.84,.88,.85),smoothstep(-.55,.65,r.y));
 float darkBand=exp(-pow((r.y-.16)/.16,2.));c=mix(c,vec3(.025,.038,.045),darkBand*.95);
 float strip=exp(-pow((r.x*.72+r.z*.38-.18)/.095,2.));c=mix(c,vec3(1.,1.,.96),strip*.97);
 float horizon=exp(-pow((r.y+.12)/.055,2.));c+=vec3(.52,.57,.56)*horizon;
 float edge=exp(-pow((r.x+.65)/.10,2.));c+=vec3(.32,.36,.25)*edge;
 return c;
}
void main(){
 vec2 p=(uv-.5)*2.;p.x*=resolution.x/resolution.y;
 vec3 ro=vec3(0.,0.,3.3),rd=normalize(vec3(p*1.18,-3.15));float travel=0.;bool hit=false;
 for(int i=0;i<72;i++){float distance=surface(ro+rd*travel);if(distance<.0013){hit=true;break;}travel+=distance*.76;if(travel>5.5)break;}
 if(!hit){gl_FragColor=vec4(0.);return;}
 vec3 point=ro+rd*travel,n=normalAt(point),lp=local(point);vec3 reflected=normalize(reflect(rd,n)+vec3(pointer*.07,0.));
 vec3 color=environment(reflected);
 float facing=clamp(dot(n,-rd),0.,1.);float fresnel=pow(1.-facing,3.);color+=vec3(.12,.15,.15)*fresnel;
 float key=pow(max(0.,dot(reflect(normalize(vec3(-2.,3.,4.)),n),rd)),70.);color+=key*.7;
 vec2 stamp=vec2(lp.x/1.12+.5,.5-lp.y/.29);
 float ink=0.;if(stamp.x>0.&&stamp.x<1.&&stamp.y>0.&&stamp.y<1.&&lp.z>.12)ink=texture2D(inscription,stamp).a*shape.x;
 color=mix(color,color*.22,ink*.72);
 vec3 light=normalize(vec3(-2.,3.,4.));float diffuse=.7+.3*dot(n,light);color*=diffuse;
 // A narrow bevel around the incised mark catches the same studio light as the metal.
 vec2 texel=vec2(1./1024.,1./256.);float bevel=0.;if(stamp.x>0.&&stamp.x<1.&&stamp.y>0.&&stamp.y<1.&&lp.z>.12){bevel=texture2D(inscription,stamp+texel).a-texture2D(inscription,stamp-texel).a;}
 color+=bevel*.24*shape.x;float silver=dot(color,vec3(.299,.587,.114));color=vec3(silver)*vec3(.985,1.,1.01);gl_FragColor=vec4(pow(max(color,vec3(0.)),vec3(.94)),1.);
}`;

export function initIdentity({motion,on}){
 const host=document.querySelector('#identity-toy');if(!host)return()=>{};
 const canvas=host.querySelector('canvas'),control=host.querySelector('.toy-object'),modeButtons=[...host.querySelectorAll('[data-toy-mode]')],counter=host.querySelector('.toy-number');
 let gl=null,program=null,buffer=null,texture=null,uniforms={},w=0,h=0;
 let alive=true,visible=false,raf=0,last=0,mode=2,down=false,dragged=false;
 let yaw=-.18,pitch=.14,vYaw=0,vPitch=0,targetYaw=yaw,targetPitch=pitch,homeYaw=yaw,homePitch=pitch,tension=0,tensionVelocity=0;
 let pullX=0,pullY=0,hoverX=0,hoverY=0,startX=0,startY=0,previousX=0,previousY=0,previousTime=0,travel=0;
 let ambient=motion;const weights=[0,0,1],weightVelocity=[0,0,0];let easeFrames=motion?100:0;
 function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(message)}return shader}
 try{gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,powerPreference:'low-power'});if(gl){program=gl.createProgram();const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const location=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
  uniforms=Object.fromEntries(['resolution','angle','pull','pointer','shape','tension'].map(k=>[k,gl.getUniformLocation(program,k)]));
  const stamp=document.createElement('canvas');stamp.width=1024;stamp.height=256;const ctx=stamp.getContext('2d');ctx.scale(1024/733,256/184);ctx.fillStyle='#fff';ctx.fill(new Path2D(logoPath),'evenodd');texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,stamp);
  host.dataset.renderer='metal';
 }}catch(error){if(gl){gl.deleteProgram(program);gl=null}host.dataset.renderer='vector';}
 if(!gl)host.dataset.renderer='vector';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function schedule(){if(alive&&visible&&!raf)raf=requestAnimationFrame(tick)}
 function render(now=0){
  if(gl){gl.useProgram(program);gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl.uniform2f(uniforms.angle,yaw,pitch);gl.uniform2f(uniforms.pull,pullX,pullY);gl.uniform2f(uniforms.pointer,hoverX,hoverY);gl.uniform3f(uniforms.shape,...weights);gl.uniform1f(uniforms.tension,tension);gl.drawArrays(gl.TRIANGLES,0,6)}
  else{host.style.setProperty('--toy-yaw',`${yaw*30}deg`);host.style.setProperty('--toy-pitch',`${pitch*30}deg`);}
  host.style.setProperty('--toy-lift',down?'-.08':'0');
  host.dataset.toyState=down?'held':Math.abs(vYaw)+Math.abs(vPitch)>.12?'spinning':easeFrames>0?'settling':'rest';
 }
 function resize(){const r=control.getBoundingClientRect();w=r.width;h=r.height;if(gl){const d=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);gl.viewport(0,0,canvas.width,canvas.height)}render();schedule()}
 function setMode(next){ambient=false;mode=(next+3)%3;host.dataset.mode=mode;modeButtons.forEach((b,i)=>b.setAttribute('aria-pressed',i===mode));counter.textContent=`0${mode+1} / 03`;
  if(!motion){weights.forEach((v,i)=>weights[i]=i===mode?1:0);render();return}
  tensionVelocity+=.09;vYaw+=.055;easeFrames=180;schedule();
 }
 function tick(now){raf=0;if(!alive||!visible||document.hidden)return;const dt=clamp((now-last)/16.667||1,.25,2);last=now;
  if(motion){
   if(ambient){yaw+=.003*dt;pitch=.2+Math.sin(now*.0004)*.09;}
   if(down){vYaw=(targetYaw-yaw)*.18;vPitch=(targetPitch-pitch)*.18;yaw+=vYaw*dt;pitch+=vPitch*dt;}
   else{yaw+=vYaw*dt;pitch+=vPitch*dt;vYaw*=Math.pow(.965,dt);vPitch*=Math.pow(.94,dt);}
   const targetTension=down?clamp(Math.hypot(pullX,pullY)*.5+.25,0,1.2):0;tensionVelocity+=(targetTension-tension)*.065*dt;tensionVelocity*=Math.pow(.76,dt);tension+=tensionVelocity*dt;
   if(!down){pullX*=Math.pow(.89,dt);pullY*=Math.pow(.89,dt)}
   for(let i=0;i<3;i++){weightVelocity[i]+=((i===mode?1:0)-weights[i])*.052*dt;weightVelocity[i]*=Math.pow(.7,dt);weights[i]+=weightVelocity[i]*dt}
   const sum=weights.reduce((a,b)=>a+b,0);for(let i=0;i<3;i++)weights[i]=clamp(weights[i]/sum,0,1);
   easeFrames-=dt;
  }
  render(now);if(motion&&(ambient||down||Math.abs(vYaw)+Math.abs(vPitch)>.0007||Math.abs(tension)+Math.abs(tensionVelocity)>.002||easeFrames>0))schedule();
 }
 on(control,'pointerdown',e=>{if(e.button!==0)return;ambient=false;down=true;dragged=false;travel=0;startX=previousX=e.clientX;startY=previousY=e.clientY;previousTime=e.timeStamp;homeYaw=targetYaw=yaw;homePitch=targetPitch=pitch;vYaw=vPitch=0;control.dataset.flickX='0';control.dataset.flickY='0';control.setPointerCapture(e.pointerId);host.classList.add('is-held');easeFrames=120;schedule()});
 on(control,'pointermove',e=>{const r=control.getBoundingClientRect();hoverX=(e.clientX-r.left)/r.width-.5;hoverY=(e.clientY-r.top)/r.height-.5;
  if(down){const dx=e.clientX-startX,dy=e.clientY-startY;travel=Math.hypot(dx,dy);dragged=travel>5;pullX=clamp(dx/85,-2,2);pullY=clamp(dy/85,-1.5,1.5);targetYaw=homeYaw+dx*.017;targetPitch=homePitch+dy*.012;
   if(!motion){yaw=targetYaw;pitch=targetPitch;render()}
   const elapsed=Math.max(8,e.timeStamp-previousTime);control.dataset.flickX=clamp((e.clientX-previousX)/elapsed*.22,-.4,.4);control.dataset.flickY=clamp((e.clientY-previousY)/elapsed*.14,-.25,.25);previousX=e.clientX;previousY=e.clientY;previousTime=e.timeStamp;
  }else if(motion){ambient=false;vYaw+=hoverX*.002;vPitch+=hoverY*.001;easeFrames=50}
  schedule();
 });
 function release(e,cancelled=false){if(!down)return;down=false;host.classList.remove('is-held');if(control.hasPointerCapture(e.pointerId))control.releasePointerCapture(e.pointerId);if(motion&&dragged&&!cancelled){const freshness=clamp(1-(e.timeStamp-previousTime)/110,0,1);vYaw=Number(control.dataset.flickX||0)*freshness;vPitch=Number(control.dataset.flickY||0)*freshness;targetYaw=yaw;targetPitch=pitch;tensionVelocity-=.07}else if(!motion){vYaw=vPitch=0;pullX=pullY=0}easeFrames=180;schedule();}
 on(control,'pointerup',e=>release(e));on(control,'pointercancel',e=>release(e,true));on(control,'pointerleave',()=>{hoverX=hoverY=0;if(!down)schedule()});
 on(control,'click',()=>{if(!dragged)setMode(mode+1);dragged=false});
 on(control,'keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')vYaw=-.12;if(e.key==='ArrowRight')vYaw=.12;if(e.key==='ArrowUp')vPitch=-.1;if(e.key==='ArrowDown')vPitch=.1;if(!motion){yaw+=vYaw*3;pitch+=vPitch*3;vYaw=vPitch=0;render()}easeFrames=100;schedule()}if(e.key==='Escape')reset()});
 function reset(){mode=2;setMode(2);ambient=motion;yaw=targetYaw=homeYaw=-.18;pitch=targetPitch=homePitch=.14;vYaw=motion?.045:0;vPitch=0;pullX=pullY=0;tensionVelocity=motion?.04:0;easeFrames=180;render();schedule()}
 modeButtons.forEach(b=>on(b,'click',()=>setMode(Number(b.dataset.toyMode))));on(host.querySelector('[data-toy-reset]'),'click',reset);
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;document.body.classList.toggle('footer-at-play',visible);if(visible){last=0;schedule()}else{cancelAnimationFrame(raf);raf=0;down=false;host.classList.remove('is-held')}},{threshold:.08});observer.observe(host);
 const resizer=new ResizeObserver(resize);resizer.observe(control);resize();setMode(2);ambient=motion;vYaw=motion?.018:0;
 on(canvas,'webglcontextlost',e=>{e.preventDefault();gl=null;host.dataset.renderer='vector';schedule()});
 on(document,'visibilitychange',()=>{if(!document.hidden){last=0;schedule()}});
 return()=>{alive=false;document.body.classList.remove('footer-at-play');cancelAnimationFrame(raf);observer.disconnect();resizer.disconnect();if(gl){gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext()}};
}
