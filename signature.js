import {logoContours} from './logo-geometry.js?v=1.3.1';

const groups=[[0,1],[2],[5],[3,6,7],[4]];
const centers=[82,220,338,500,660];
const labels={en:'Animate the MINJA signature',ja:'MINJAのサインを動かす','zh-Hans':'让 MINJA 签名流动','zh-Hant':'讓 MINJA 簽名流動',ko:'MINJA 서명 움직이기'};

// The original outlines remain real vectors, including their curved control points.
const geometry=logoContours.map(d=>d.match(/[MLQZ]|-?\d+(?:\.\d+)?/g).map(v=>/[MLQZ]/.test(v)?v:Number(v)));
export function signatureMarkup(language){
 const paths=groups.map((indices,i)=>`<g data-signature-glyph="${i}">${indices.map(n=>`<path data-outline="${n}" d="${logoContours[n]}"/>`).join('')}</g>`).join('');
 return `<button id="signature" class="note-reading-mark ink-signature" type="button" aria-label="${labels[language]||labels.en}"><svg viewBox="-40 -60 810 300" aria-hidden="true" focusable="false"><defs><linearGradient id="signature-ink" x1="0" y1="0" x2="733" y2="120" gradientUnits="userSpaceOnUse"><stop stop-color="#252a24"/><stop offset=".48" stop-color="#20211f"/><stop offset="1" stop-color="#53624b"/></linearGradient><radialGradient id="signature-light" cx="360" cy="90" r="180" gradientUnits="userSpaceOnUse"><stop stop-color="#ab92ae"/><stop offset=".48" stop-color="#7c8e68"/><stop offset="1" stop-color="#53624b" stop-opacity="0"/></radialGradient><g id="signature-shape">${paths}</g></defs><use class="signature-echo" href="#signature-shape"/><use class="signature-ink" href="#signature-shape"/><use class="signature-light" href="#signature-shape"/></svg></button>`;
}

export function initSignature({motion,on}){
 const root=document.querySelector('.ink-signature');if(!root)return()=>{};
 const svg=root.querySelector('svg'),glyphs=[...root.querySelectorAll('[data-signature-glyph]')],outlines=[...root.querySelectorAll('[data-outline]')];
 const light=root.querySelector('#signature-light'),echo=root.querySelector('.signature-echo'),glaze=root.querySelector('.signature-light');
 let alive=true,raf=0,visible=false,seen=false,last=0,time=0,px=365,py=90,tx=365,ty=90,near=0,targetNear=0,energy=0,phase=8,scroll=0,velocity=0,previousScroll=window.scrollY,focused=false;
 const states=glyphs.map(()=>({x:0,y:0,vx:0,vy:0}));
 function schedule(){if(alive&&!raf&&!document.hidden&&(visible||!motion))raf=requestAnimationFrame(tick)}
 function locate(e){const r=svg.getBoundingClientRect();tx=-40+(e.clientX-r.left)/r.width*810;ty=-60+(e.clientY-r.top)/r.height*300;targetNear=1;schedule()}
 function activate(){if(!motion){root.classList.toggle('signature-alternate');return}energy=Math.min(1.4,energy+.95);phase=0;schedule()}
 on(root,'pointermove',e=>{if(motion)locate(e)},{passive:true});
 on(root,'pointerenter',e=>{if(motion)locate(e)},{passive:true});
 on(root,'pointerleave',()=>{if(!focused)targetNear=0;schedule()});
 on(root,'pointerdown',e=>{if(motion)locate(e)},{passive:true});
 on(root,'pointerup',e=>{if(e.pointerType==='touch'){targetNear=0;schedule()}},{passive:true});
 on(root,'pointercancel',()=>{targetNear=0;schedule()},{passive:true});
 on(root,'click',activate);
 on(root,'focus',()=>{focused=root.matches(':focus-visible');if(focused){tx=365;ty=90;targetNear=motion?1:0;schedule()}});
 on(root,'blur',()=>{focused=false;targetNear=0;schedule()});
 on(window,'scroll',()=>{const now=window.scrollY;velocity=Math.max(-30,Math.min(30,now-previousScroll));previousScroll=now;schedule()},{passive:true});
 on(document,'visibilitychange',schedule);
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=0;if(!seen&&motion){seen=true;energy=.65;phase=0}schedule()}else{cancelAnimationFrame(raf);raf=0}},{threshold:0,rootMargin:'60px'});observer.observe(root);
 const resize=new ResizeObserver(schedule);resize.observe(root);
 function tick(now){
  raf=0;if(!alive||document.hidden||!visible||!motion)return;
  const dt=Math.min(2,(now-last)/16.667||1);last=now;time+=dt/60;phase+=dt/60;
  px+=(tx-px)*Math.min(1,.12*dt);py+=(ty-py)*Math.min(1,.12*dt);near+=(targetNear-near)*Math.min(1,.075*dt);
  energy*=Math.pow(.989,dt);velocity*=Math.pow(.88,dt);scroll+=(velocity-scroll)*Math.min(1,.06*dt);
  const waveAt=phase*540-140,waveGain=energy*Math.exp(-Math.max(0,phase-1.6)*3);
  glyphs.forEach((el,i)=>{
   const state=states[i],distance=Math.hypot(centers[i]-px,(90-py)*1.4),force=near*Math.exp(-distance*distance/42000);
   const wave=Math.exp(-Math.pow((centers[i]-waveAt)/150,2))*waveGain;
   const x=(centers[i]-px)*.075*force+Math.sin(time*.72+i*.7)*2.6;
   const y=Math.sin(time*.85+i*.76)*5.2-wave*46+(py-90)*force*.16+scroll*(i-2)*.085;
   state.vx=((state.vx+(x-state.x)*.045*dt)*Math.pow(.76,dt));state.vy=((state.vy+(y-state.y)*.045*dt)*Math.pow(.76,dt));state.x+=state.vx*dt;state.y+=state.vy*dt;
   const angle=Math.sin(time*.6+i)*.7+(i-2)*.4+force*(py-90)*.025+wave*(i-2)*2.6;
   const sx=1+force*.07+wave*.05,sy=1-force*.10-wave*.16;
   el.setAttribute('transform',`translate(${state.x.toFixed(2)} ${state.y.toFixed(2)}) translate(${centers[i]} 90) rotate(${angle.toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-centers[i]} -90)`);
  });
  // Bend the contours themselves; the narrow strokes stay connected and never pixelate.
  outlines.forEach(path=>{
   let coordinate=0;const source=geometry[Number(path.dataset.outline)];let x=0;
   const d=source.map((v,k)=>{if(typeof v==='string'){coordinate=0;return v}const horizontal=coordinate++%2===0;if(horizontal){x=v;return v.toFixed(2)}
    const local=near*Math.exp(-((x-px)**2+(v-py)**2)/18000),ripple=waveGain*Math.exp(-Math.pow((x-waveAt)/120,2));
    const bend=Math.sin((x-px)*.014+time*.65)*local*18+Math.sin((x-waveAt)*.019)*ripple*16;
    return (v+bend).toFixed(2);
   }).join(' ');path.setAttribute('d',d);
  });
  const contact=Math.min(1,near*.82+waveGain*.45);
  light.setAttribute('cx',px.toFixed(1));light.setAttribute('cy',py.toFixed(1));
  glaze.style.opacity=contact.toFixed(3);
  echo.style.opacity=(.12+contact*.36).toFixed(3);echo.setAttribute('transform',`translate(${(3+near*5+waveGain*9).toFixed(2)} ${(-5-near*5-waveGain*7).toFixed(2)})`);
  root.dataset.signatureState=phase<2.5&&energy>.1?'ripple':near>.05?'responding':'breathing';
  schedule();
 }
 return()=>{alive=false;cancelAnimationFrame(raf);observer.disconnect();resize.disconnect()};
}
