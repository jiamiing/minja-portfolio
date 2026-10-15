import {logoPath,logoBox} from './logo-geometry.js?v=1.3.0';

// The same vector contours draw both the continuous ink and every particle target.
export function initIdentity({motion,on}){
 const host=document.querySelector('#particle-logo');if(!host)return()=>{};
 const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d');if(!ctx)return()=>{};
 const outline=new Path2D(logoPath),probe=document.createElement('canvas').getContext('2d');
 let w=0,h=0,points=[],raf=0,alive=true,visible=false,entered=false,last=0,blast=0,brush=0,hover=false,px=-9999,py=-9999;
 const random=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n)};
 function drawBase(alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#171b17';const scale=(w-24)/logoBox[0];ctx.translate(12,(h-logoBox[1]*scale)/2);ctx.scale(scale,scale);ctx.fill(outline,'evenodd');ctx.restore()}
 function resize(){const r=host.getBoundingClientRect();w=r.width;h=r.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);points=[];const scale=(w-24)/logoBox[0],top=(h-logoBox[1]*scale)/2,step=Math.max(3.1,3/scale);
  for(let y=2;y<184;y+=step)for(let x=2;x<733;x+=step)if(probe.isPointInPath(outline,x,y,'evenodd')){const id=points.length;points.push({tx:12+x*scale,ty:top+y*scale,x:12+x*scale,y:top+y*scale,vx:0,vy:0,r:step*scale*.57,seed:random(id+1),angle:random(id+800)*Math.PI*2})}
  host.dataset.particles=points.length;ctx.clearRect(0,0,w,h);drawBase();host.classList.add('identity-ready');schedule();
 }
 function burst(power=1){if(!motion)return;blast=Math.max(blast,power);for(const p of points){const dx=p.tx-w/2,dy=p.ty-h/2,d=Math.hypot(dx,dy)||1;const speed=(22+p.seed*75)*power;p.vx+=dx/d*speed-Math.sin(p.angle)*speed*.6;p.vy+=dy/d*speed+Math.cos(p.angle)*speed*.6}schedule()}
 function schedule(){if(alive&&visible&&!raf)raf=requestAnimationFrame(tick)}
 function tick(now){raf=0;if(!alive||!visible)return;const dt=Math.min(2,(now-last)/16.67||1);last=now;
  blast*=Math.pow(.973,dt);brush+=(Number(hover)-brush)*.13;let movement=0;
  const radius=Math.min(190,Math.max(85,w*.13)),maskRadius=radius*1.15;
  ctx.clearRect(0,0,w,h);drawBase(Math.pow(1-blast,4));
  if(brush>.002){ctx.save();ctx.globalCompositeOperation='destination-out';const gradient=ctx.createRadialGradient(px,py,radius*.15,px,py,maskRadius);gradient.addColorStop(0,`rgba(0,0,0,${brush})`);gradient.addColorStop(.65,`rgba(0,0,0,${brush})`);gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(px-maskRadius,py-maskRadius,maskRadius*2,maskRadius*2);ctx.restore()}
  ctx.fillStyle='#171b17';ctx.beginPath();const accents=[];
  for(const p of points){let dx=p.x-px,dy=p.y-py,d=Math.hypot(dx,dy)||1;const force=hover?Math.max(0,1-d/radius):0;
   p.vx+=((p.tx-p.x)*(.012+.023*(1-blast))+dx/d*force*2.7-dy/d*force*1.9)*dt;p.vy+=((p.ty-p.y)*(.012+.023*(1-blast))+dy/d*force*2.7+dx/d*force*1.9)*dt;
   p.vx*=Math.pow(.86,dt);p.vy*=Math.pow(.86,dt);p.x+=p.vx*dt;p.y+=p.vy*dt;
   const displaced=Math.hypot(p.x-p.tx,p.y-p.ty);movement+=displaced;
   const targetDistance=Math.hypot(p.tx-px,p.ty-py),local=brush*Math.max(0,Math.min(1,(maskRadius-targetDistance)/(maskRadius-radius*.65)));
   const opacity=Math.max(blast,local,Math.min(1,displaced/14));if(opacity<.015)continue;
   const size=p.r*(.5+opacity*.5);if(p.seed>.92&&(force>.15||blast>.3)){accents.push([p.x,p.y,size]);continue}ctx.rect(p.x-size,p.y-size,size*2,size*2);
  }ctx.fill();ctx.fillStyle='#a6c743';ctx.beginPath();for(const [x,y,r]of accents){ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,Math.PI*2)}ctx.fill();
  host.dataset.identityState=blast>.03||brush>.1||movement>points.length?'dispersing':'assembled';
  if(hover||blast>.001||brush>.002||movement>points.length*.04)schedule();else{ctx.clearRect(0,0,w,h);drawBase();host.dataset.identityState='assembled'}
 }
 on(host,'pointermove',e=>{if(!motion||e.pointerType==='touch')return;const r=host.getBoundingClientRect();px=e.clientX-r.left;py=e.clientY-r.top;hover=true;schedule()});
 on(host,'pointerleave',()=>{hover=false;schedule()});
 on(host,'click',()=>{hover=false;if(blast>.08){blast=0;for(const p of points){p.vx*=.15;p.vy*=.15}schedule()}else burst(1)});
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){if(!entered){entered=true;burst(.55)}schedule()}else{cancelAnimationFrame(raf);raf=0;last=0}},{threshold:.1});observer.observe(host);
 const resizer=new ResizeObserver(resize);resizer.observe(host);resize();
 return()=>{alive=false;cancelAnimationFrame(raf);observer.disconnect();resizer.disconnect()};
}
