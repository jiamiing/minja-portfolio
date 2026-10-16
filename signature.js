import {logoSvg} from './logo-geometry.js?v=1.3.1';

export function signatureMarkup({image,label}){
 return `<button id="signature" class="note-reading-mark signature-plate" type="button" data-lightbox="eastern-bloom" aria-label="${label}"><span class="signature-picture">${image}</span><span class="signature-imprint">${logoSvg()}</span></button>`;
}

// One photographic plane follows reading and reveals more of the actual artwork.
// The identity stays intact, and the interaction opens the original image.
export function initSignature({motion,on}){
 const root=document.querySelector('.signature-plate');if(!root||!motion)return()=>{};
 const frame=root.querySelector('.signature-picture'),photo=frame.querySelector('img');
 let alive=true,raf=0,last=0,x=0,y=0,tx=0,ty=0,open=0,targetOpen=0,reading=0;
 let hovering=false,focused=false;
 function schedule(){if(alive&&!raf&&!document.hidden)raf=requestAnimationFrame(tick)}
 function updateOpen(){targetOpen=hovering||focused?1:0;schedule()}
 on(root,'pointerenter',e=>{if(e.pointerType==='touch')return;hovering=true;updateOpen()});
 on(root,'pointermove',e=>{if(e.pointerType==='touch')return;const r=root.getBoundingClientRect();tx=((e.clientX-r.left)/r.width-.5)*6;ty=((e.clientY-r.top)/r.height-.5)*5;schedule()},{passive:true});
 on(root,'pointerleave',()=>{hovering=false;tx=ty=0;updateOpen()});
 on(root,'focus',()=>{focused=root.matches(':focus-visible');updateOpen()});
 on(root,'blur',()=>{focused=false;updateOpen()});
 on(root,'pointercancel',()=>{hovering=false;tx=ty=0;updateOpen()},{passive:true});
 on(window,'scroll',schedule,{passive:true});on(window,'resize',schedule,{passive:true});on(document,'visibilitychange',schedule);
 const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))schedule()},{rootMargin:'60px'});observer.observe(root);
 function tick(now){
  raf=0;if(!alive||document.hidden)return;
  const r=root.getBoundingClientRect();if(r.bottom<-60||r.top>innerHeight+60){last=0;return}
  const dt=Math.min(2,(now-last)/16.667||1);last=now;
  const follow=1-Math.pow(.9,dt),unfold=1-Math.pow(.94,dt);
  x+=(tx-x)*follow;y+=(ty-y)*follow;open+=(targetOpen-open)*unfold;
  const targetReading=Math.max(-1,Math.min(1,(innerHeight*.5-r.top-r.height*.5)/innerHeight));reading+=(targetReading-reading)*follow;
  frame.style.clipPath=`inset(0 ${(1-open)*18}% 0 0)`;
  photo.style.transform=`translate3d(${x.toFixed(2)}px,${(y+reading*14).toFixed(2)}px,0) scale(1.08)`;
  root.dataset.signatureState=open>.01?'revealing':'resting';
  if(Math.abs(tx-x)+Math.abs(ty-y)+Math.abs(targetReading-reading)+Math.abs(targetOpen-open)>.002)schedule();
 }
 schedule();
 return()=>{alive=false;cancelAnimationFrame(raf);observer.disconnect()};
}
