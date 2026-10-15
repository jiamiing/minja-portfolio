// Native scroll remains the timeline. Each sticky chapter has a distinct composition and pace.
export function initStory({motion,on}){
 const tracks=[...document.querySelectorAll('[data-scene]')],body=document.body;
 body.classList.toggle('story-motion',motion&&tracks.length>0);
 const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
 const range=(v,a,b)=>clamp((v-a)/(b-a));
 const ease=v=>v*v*(3-2*v);
 const mix=(a,b,p)=>a+(b-a)*p;
 let frame=0,alive=true,dirty=true,settling=true,viewportHeight=innerHeight,viewportWidth=innerWidth;
 const states=tracks.map(el=>({el,type:el.dataset.scene,p:null}));
 const parallax=[...document.querySelectorAll('.project-cover,.expanded-gallery .gallery-frame,.collab-banner,.note-photo')];
 on(window,'resize',()=>{viewportHeight=innerHeight;viewportWidth=innerWidth;dirty=true},{passive:true});
 on(window,'scroll',()=>dirty=true,{passive:true});
 if(!motion){document.querySelectorAll('.world-scene,.rail-card,[data-collage]').forEach(el=>el.inert=false);tracks.forEach(el=>el.style.setProperty('--p','0'));return()=>body.classList.remove('story-motion')}
 function set(el,k,v){el.style.setProperty(k,typeof v==='number'?v.toFixed(5):v)}
 function paint(state,p){
  const el=state.el;set(el,'--p',p);el.dataset.progress=p.toFixed(3);
  if(state.type==='opening'){
   const fill=ease(range(p,.05,.55)),exit=ease(range(p,.58,1));set(el,'--fill',fill);set(el,'--exit',exit);
   const art=el.querySelector('.opening-art');art.style.clipPath=`inset(${mix(11,0,fill)}% ${mix(5,0,fill)}% ${mix(5,0,fill)}%)`;
   art.style.transform=`scale(${mix(.96,1.04,fill)}) translateY(${-exit*7}vh)`;
   const type=el.querySelector('.opening-type');type.style.transform=`translate3d(0,${-fill*6-exit*40}vh,0) rotateX(${exit*12}deg)`;type.style.opacity=1-exit;
   const end=el.querySelector('.opening-exit');end.style.opacity=range(p,.64,.83)*(1-range(p,.9,1));end.style.transform=`translateY(${mix(12,-10,exit)}vh) scale(${mix(.9,1.05,exit)})`;
  }
  if(state.type==='statement'){
   set(el,'--read',ease(range(p,.02,.6)));set(el,'--spread',ease(range(p,.2,.9)));
   const title=el.querySelector('.statement-title');title.style.transform=`translateY(${mix(11,-9,p)}vh) scale(${mix(.9,1.06,p)})`;title.style.clipPath=`inset(0 ${100-ease(range(p,.02,.55))*100}% 0 0)`;
   const a=el.querySelector('.statement-photo-a'),b=el.querySelector('.statement-photo-b');
   a.style.transform=`translate3d(${mix(-20,-3,p)}vw,${mix(15,-14,p)}vh,0) rotate(${mix(-16,-5,p)}deg)`;
   b.style.transform=`translate3d(${mix(20,2,p)}vw,${mix(20,-12,p)}vh,0) rotate(${mix(15,6,p)}deg)`;
   el.querySelector('.statement-copy').style.opacity=range(p,.25,.5)*(1-range(p,.9,1));
  }
  if(state.type==='worlds'){
   let active=0;
   [...el.querySelectorAll('.world-scene')].forEach((panel,i)=>{
    const reveal=i===0?1:ease(range(p,i===1?.23:.62,i===1?.43:.83));
    const revealOther=i===0?1:ease(range(p,i===1?.28:.67,i===1?.48:.88));
    panel.style.clipPath=`polygon(0 ${100-reveal*100}%,50% ${100-reveal*100}%,50% ${100-revealOther*100}%,100% ${100-revealOther*100}%,100% 100%,0 100%)`;
    const local=i===0?range(p,0,.42):i===1?range(p,.23,.83):range(p,.62,1);
    panel.querySelector('.world-photo img').style.transform=`scale(${mix(1.2,1.02,local)}) translateX(${mix(4,-3,local)}%)`;
    panel.querySelector('.world-detail').style.transform=`translate3d(${mix(18,-3,ease(local))}vw,${mix(8,-5,local)}vh,0) rotate(${mix(14,-4,local)}deg)`;
    panel.querySelector('h2').style.transform=`translateY(${mix(13,-7,local)}vh)`;
    if(reveal>.55)active=i;
   });
   [...el.querySelectorAll('.world-scene')].forEach((panel,i)=>panel.inert=i!==active);
   [...el.querySelectorAll('[data-world-dot]')].forEach((dot,i)=>dot.classList.toggle('active',i===active));
   el.querySelector('.world-count').textContent=`0${active+1} / 03`;
  }
  if(state.type==='rail'){
   const rail=el.querySelector('.cinema-rail'),max=Math.max(0,rail.scrollWidth-viewportWidth),travel=ease(range(p,0,1));
   rail.style.transform=`translate3d(${-max*travel}px,0,0)`;
   const cards=[...el.querySelectorAll('.rail-card')],progress=travel*(cards.length-1),active=Math.round(progress);
   cards.forEach((card,i)=>{const d=i-progress;card.style.transform=`perspective(1400px) rotateY(${clamp(d,-1,1)*-7}deg) translateY(${Math.min(1,Math.abs(d))*3}vh)`;card.querySelector('img').style.transform=`scale(1.1) translateX(${clamp(d,-1,1)*-4}%)`;card.inert=Math.abs(d)>1.3});
   el.querySelector('.rail-count').textContent=`0${active+1} / 06`;el.querySelector('.rail-meter i').style.transform=`scaleX(${travel})`;
  }
  if(state.type==='glass'){
   const take=ease(range(p,.1,.88));set(el,'--takeover',take);
   el.querySelector('.glass-scroll-heading').style.transform=`translateY(${-p*25}vh)`;el.querySelector('.glass-scroll-heading').style.opacity=1-range(p,.12,.35);
   el.querySelector('.glass-ghost-type').style.transform=`translateX(${mix(18,-22,p)}vw)`;el.querySelector('.glass-ghost-type').style.opacity=range(p,.1,.3)*(1-range(p,.8,1));
   set(el.querySelector('.glass-surface'),'--takeover',take);
  }
  if(state.type==='collage'){
   const positions=[[-27,-23,31],[12,-27,25],[33,9,23],[-24,26,30],[8,23,13],[0,-3,31],[-43,-1,14],[33,-21,23]];
   const compact=viewportWidth<700;
   el.querySelectorAll('[data-collage]').forEach((photo,i)=>{
    const start=i*.035,arrive=ease(range(p,start,.36+start)),leave=ease(range(p,.78,1));
    let [x,y,w]=positions[i];if(compact){const col=i%2,row=Math.floor(i/2);x=col?24:-24;y=-29+row*20;w=i===4||i===6?25:43;}
    const r=(i%2?1:-1)*(9+i*1.3);
    photo.style.width=`${w}vw`;photo.style.opacity=arrive*(1-leave);
    photo.style.transform=`translate3d(calc(-50% + ${mix(x*2.4,x,arrive)+leave*x*.7}vw),calc(-50% + ${mix(y*2.5+45,y,arrive)-leave*55}vh),0) rotate(${mix(r*2,r*.25,arrive)+leave*r}deg) scale(${mix(.72,1,arrive)})`;
    photo.inert=arrive<.8||leave>.6;
   });
   el.querySelector('.collage-heading').style.opacity=1-range(p,.12,.42);el.querySelector('.collage-heading').style.transform=`scale(${mix(.85,1.1,p)})`;
   el.querySelector('.collage-bottom').style.opacity=range(p,.4,.6);
  }
  if(state.type==='outro'){
   const open=ease(range(p,0,.65));el.querySelector('.outro-art').style.clipPath=`inset(${mix(12,0,open)}% ${mix(18,0,open)}%)`;
   el.querySelector('.outro-art img').style.transform=`scale(${mix(1.22,1.02,p)})`;
   el.querySelector('.outro-copy').style.transform=`translateY(${mix(9,-5,p)}vh)`;
  }
 }
 function tick(){if(!alive)return;
  if(!document.hidden&&(dirty||settling)){dirty=false;settling=false;let active='opening';
   for(const state of states){const rect=state.el.getBoundingClientRect(),distance=state.el.offsetHeight-viewportHeight;const target=clamp(-rect.top/Math.max(1,distance));
    if(!state.ready&&rect.top<viewportHeight*2&&rect.bottom>0){state.ready=true;state.el.querySelectorAll('img[loading=lazy]').forEach(im=>im.loading='eager');}
    if(rect.top<viewportHeight*.5&&rect.bottom>viewportHeight*.4)active=state.type==='glass'?'glass':state.el.id||active;
    if(rect.bottom<-viewportHeight||rect.top>viewportHeight*2){if(state.p!==target){state.p=target;paint(state,target)}continue}
    state.p=state.p===null?target:mix(state.p,target,.17);if(Math.abs(state.p-target)<.0002)state.p=target;else settling=true;paint(state,state.p);
   }
   document.querySelectorAll('[data-chapter]').forEach(a=>a.classList.toggle('current',a.dataset.chapter===active));
   parallax.forEach(el=>{const r=el.getBoundingClientRect();if(r.bottom<0||r.top>viewportHeight)return;const q=clamp((viewportHeight-r.top)/(viewportHeight+r.height));const im=el.querySelector('img');if(im){im.style.transform=`scale(${mix(1.13,1.02,q)}) translateY(${mix(-3,3,q)}%)`;im.style.willChange='transform'}if(el.classList.contains('gallery-frame')){el.style.clipPath=`inset(${mix(10,0,ease(range(q,0,.3)))}% 0 0 0)`;}});
  }
  frame=requestAnimationFrame(tick);
 }
 if(states.length||parallax.length)tick();
 return()=>{alive=false;cancelAnimationFrame(frame);body.classList.remove('story-motion')};
}
