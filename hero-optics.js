// Pointer-responsive image field for the hero artwork.
const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision highp float;
varying vec2 uv;uniform sampler2D artwork,previousArtwork;uniform float clarity;uniform vec2 resolution,photo,mouse;
uniform float time,energy;
vec3 sampleArtwork(vec2 p){return mix(texture2D(previousArtwork,p).rgb,texture2D(artwork,p).rgb,clarity);}
void main(){
 float ratio=resolution.x/resolution.y,sourceRatio=photo.x/photo.y;
 vec2 cover=vec2(min(ratio/sourceRatio,1.),min(sourceRatio/ratio,1.));
 vec2 q=(uv-.5)*cover+.5+vec2(0.,-.04)*(1.-cover);
 vec2 delta=uv-mouse;float distance=length(delta*vec2(ratio,1.));
 float wave=sin(distance*24.-time*3.)*exp(-distance*3.5)*energy;
 vec2 ripple=normalize(delta+vec2(.0001))*wave*.006;
 vec2 shift=ripple;
 vec2 fringe=ripple*.18;
 vec3 color=sampleArtwork(q+shift);
 color.r=sampleArtwork(q+shift+fringe).r;
 color.b=sampleArtwork(q+shift-fringe).b;
 gl_FragColor=vec4(color,1.);
}`;

export function initHeroOptics({canvas,img,motion,on}){
 if(!canvas||!img||!motion)return()=>{};
 const host=canvas.closest('.hero-art');
 let gl=null,program=null,buffer=null,texture=null,previousTexture=null,uniforms={};
 let alive=true,ready=false,visible=false,raf=0,last=0,clock=0,energy=0,px=.5,py=.5,tx=.5,ty=.5,clarity=1;
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw Error('Optical shader')}return s;}
 try{
  gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!gl)return()=>{};
  program=gl.createProgram();const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Optical program');
  gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  uniforms=Object.fromEntries(['clarity','resolution','photo','mouse','time','energy'].map(key=>[key,gl.getUniformLocation(program,key)]));
  [texture,previousTexture]=[gl.createTexture(),gl.createTexture()];
  for(const tex of [texture,previousTexture]){gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
  gl.uniform1i(gl.getUniformLocation(program,'artwork'),0);gl.uniform1i(gl.getUniformLocation(program,'previousArtwork'),1);
 }catch{if(gl){gl.deleteProgram(program);gl.deleteBuffer(buffer)}return()=>{};}
 function schedule(){if(alive&&visible&&ready&&!document.hidden&&!raf)raf=requestAnimationFrame(draw)}
 function upload(){if(!alive||!gl||gl.isContextLost()||!img.naturalWidth)return;
  if(ready){[texture,previousTexture]=[previousTexture,texture];clarity=0;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);}
  else for(const tex of [texture,previousTexture]){gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);}
  ready=true;schedule();}
 function draw(now){
  raf=0;if(!alive||!visible||document.hidden)return;
  const dt=Math.min(.04,(now-last)/1000||.016);last=now;clock+=dt;clarity=Math.min(1,clarity+dt*1.8);
  const rect=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,1.25);
  const width=Math.round(rect.width*d),height=Math.round(rect.height*d);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height)}
  const ease=1-Math.exp(-dt*5);px+=(tx-px)*ease;py+=(ty-py)*ease;energy*=Math.exp(-dt*1.05);
  gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,previousTexture);gl.uniform1f(uniforms.clarity,clarity);gl.uniform2f(uniforms.resolution,width,height);gl.uniform2f(uniforms.photo,img.naturalWidth,img.naturalHeight);
  gl.uniform2f(uniforms.mouse,px,py);gl.uniform1f(uniforms.time,clock);gl.uniform1f(uniforms.energy,energy);
  gl.drawArrays(gl.TRIANGLES,0,6);canvas.classList.add('ready');schedule();
 }
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=0;schedule()}else{cancelAnimationFrame(raf);raf=0;}},{threshold:.01});observer.observe(host);
 on(img,'load',upload);if(img.complete)upload();
 on(host.closest('.opening-pin')||host,'pointermove',event=>{const rect=host.getBoundingClientRect();tx=(event.clientX-rect.left)/rect.width;ty=(event.clientY-rect.top)/rect.height;energy=1;schedule()},{passive:true});
 on(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else{last=0;schedule()}});
 on(canvas,'webglcontextlost',event=>{event.preventDefault();ready=false;canvas.classList.remove('ready');cancelAnimationFrame(raf);raf=0;});
 return()=>{alive=false;observer.disconnect();cancelAnimationFrame(raf);canvas.classList.remove('ready');gl.deleteTexture(texture);gl.deleteTexture(previousTexture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();};
}
