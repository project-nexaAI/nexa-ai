// @ts-nocheck
// Skrip gerak dari desain, dibungkus agar dipanggil dari efek client (lihat docs/DECISIONS.md).
export function initMotion(NX_DATA) {

(function(){
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine=matchMedia('(pointer: fine)').matches;
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const sm=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t)};
  window.__NX={reduce,fine,clamp,sm,heroP:0,ctaP:0,mouse:{x:0,y:0}};

  // data API (fixture atau asli): label hari Prediction of the Day dan gauge win rate. Tanpa data: tampilan desain apa adanya.
  if(NX_DATA&&NX_DATA.currentDay){const e=document.querySelector('.pod-big em'),sp=document.querySelector('.pod-big span');if(e)e.textContent='Day '+NX_DATA.currentDay;if(sp)sp.textContent='of '+NX_DATA.horizonDays}
  if(NX_DATA&&NX_DATA.winRate!==null){const a=document.getElementById('gArc');if(a){a.style.strokeDashoffset=String(1-NX_DATA.winRate);a.style.opacity='1';const c=a.closest('.card'),p=c&&c.querySelector('p');if(p)p.textContent='Win rate '+NX_DATA.winRateText+(NX_DATA.avgReturnText?' · average return '+NX_DATA.avgReturnText:'')+' across '+NX_DATA.scored+' scored calls. Each commit links to Blockscout.'}const t=document.getElementById('gTxt');if(t){t.textContent=NX_DATA.winRateText;t.setAttribute('font-size','26');t.setAttribute('fill','#F2EFEA');t.setAttribute('font-family','inherit')}}
  else if(NX_DATA&&NX_DATA.latest){const a=document.getElementById('gArc'),p=a&&a.closest('.card')&&a.closest('.card').querySelector('p');if(p){const d=new Date(NX_DATA.latest.maturesAt).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});p.textContent='No call has been scored yet. The first one is committed on-chain and matures on '+d+' (UTC); the oracle scores it then. Average return sits next to it, with a Blockscout link for every commit.'}}

  // split headings into words
  document.querySelectorAll('[data-split]').forEach(h=>{
    let i=0;
    const walk=n=>{
      [...n.childNodes].forEach(c=>{
        if(c.nodeType===3){
          const frag=document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(part=>{
            if(!part) return;
            if(/^\s+$/.test(part)){frag.appendChild(document.createTextNode(part));return;}
            const w=document.createElement('span');w.className='w';
            const s=document.createElement('span');s.textContent=part;s.style.transitionDelay=(i++*55)+'ms';
            w.appendChild(s);frag.appendChild(w);
          });
          c.replaceWith(frag);
        } else if(c.nodeType===1) walk(c);
      });
    };
    walk(h);
  });
  requestAnimationFrame(()=>document.querySelector('#copyA [data-split]').classList.add('in'));

  // example commit: grouped hash, countdown and progress (example started 3 days ago)
  const hex=()=>{const a=new Uint8Array(32);crypto.getRandomValues(a);return '0x'+[...a].map(b=>b.toString(16).padStart(2,'0')).join('')};
  const exHash=document.getElementById('exHash'), finalHash=(NX_DATA&&NX_DATA.latest?NX_DATA.latest.hash:hex());
  const grouped=h=>'<span>0x</span>'+h.slice(2).match(/.{1,8}/g).map(x=>'<span>'+x+'</span>').join('');
  exHash.innerHTML=grouped('0x'+'·'.repeat(64));
  function scramble(el,final){
    if(reduce){el.innerHTML=grouped(final);return}
    const ch='0123456789abcdef';let f=0;const tot=40;
    (function step(){const cur='0x'+final.slice(2).split('').map((c,i)=>i<(f/tot)*64?c:ch[Math.random()*16|0]).join('');el.innerHTML=grouped(cur);if(++f<=tot)requestAnimationFrame(step);else el.innerHTML=grouped(final)})();
  }
  const DAY=864e5, L=NX_DATA&&NX_DATA.latest, start=L?Date.parse(L.committedAt):Date.now()-3*DAY-37*6e4, end=L?Date.parse(L.maturesAt):start+7*DAY;
  const exCount=document.getElementById('exCount'), exBar=document.getElementById('exBar');
  function tickCount(){let s=Math.max(0,(end-Date.now())/1000|0);const d=s/86400|0;s%=86400;const h=String(s/3600|0).padStart(2,'0');s%=3600;exCount.textContent=`${d}d ${h}:${String(s/60|0).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
  tickCount(); setInterval(tickCount,1000);
  const copyBtn=document.getElementById('copyHash');
  copyBtn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(finalHash);copyBtn.textContent='Copied'}catch(_){copyBtn.textContent='Copy failed'}setTimeout(()=>copyBtn.textContent='Copy',1600)});
  if(reduce) document.querySelectorAll('.tile svg').forEach(v=>v.pauseAnimations&&v.pauseAnimations());

  // counters
  function count(el){
    const to=+el.dataset.count, t0=performance.now(), dur=reduce?1:1300;
    (function f(n){const k=clamp((n-t0)/dur),e=1-Math.pow(1-k,4);el.textContent=Math.round(to*e);if(k<1)requestAnimationFrame(f)})(t0);
  }

  // reveal observer
  const io=new IntersectionObserver(es=>es.forEach(e=>{
    if(!e.isIntersecting) return;
    const t=e.target; t.classList.add('in'); io.unobserve(t);
    if(t.hasAttribute('data-stagger')) [...t.children].forEach((c,i)=>c.style.transitionDelay=(i*90)+'ms');
    t.querySelectorAll('[data-count]').forEach(count);
    t.querySelectorAll('.bar span').forEach((s,i)=>setTimeout(()=>s.style.width=s.dataset.w+'%',i*150));
    if(t.classList.contains('ledger')){ scramble(exHash,finalHash); setTimeout(()=>exBar.style.width=Math.min(100,(Date.now()-start)/(7*DAY)*100)+'%',300); }
    if(t.classList.contains('mini')){ const ds=[...document.querySelectorAll('#days i')]; ds.forEach((d,i)=>setTimeout(()=>{const cd=(NX_DATA&&NX_DATA.currentDay)?NX_DATA.currentDay-1:3;d.classList.toggle('on',i<cd);d.classList.toggle('cur',i===cd)},400+i*140)); }
  }),{threshold:.16,rootMargin:'0px 0px -6% 0px'});
  document.querySelectorAll('[data-reveal],[data-stagger],[data-split]:not(#copyA [data-split])').forEach(el=>io.observe(el));

  // draw-on SVG paths when visible
  const dio=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.querySelectorAll('.draw').forEach(p=>p.classList.add('on')); dio.unobserve(e.target);} }),{threshold:.3});
  const st=document.createElement('style');
  st.textContent='.draw{stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1)}.draw.on{stroke-dashoffset:0}';
  document.head.appendChild(st);
  document.querySelectorAll('.card,.tile').forEach(c=>{ if(c.querySelector('.draw')) dio.observe(c); });

  // rules carousel
  const rules=[
    ['Disclosure','The account is labelled automated on X, and the bio says: AI agent, not financial advice.'],
    ['No trade calls','No "buy", no "sell", no "guaranteed to go up", and no price target for any token.'],
    ['No self-promotion','$NEXA only comes up in technical and burn announcements.'],
    ['Sponsored label','Sponsored content opens with the word Sponsored.'],
    ['One-hour floor','Tokens younger than one hour are off limits, so NEXA can\'t be used to pump a launch.'],
    ['No guessing','When the data is incomplete, NEXA says it doesn\'t know.']
  ];
  const shield='<svg viewBox="0 0 96 96" fill="none" aria-hidden="true"><path d="M48 8 L80 20 V46 C80 66 66 80 48 88 C30 80 16 66 16 46 V20Z" stroke="#FF7A3D" stroke-width="2.5"/><path d="M48 18 L72 27 V46 C72 61 62 72 48 78 C34 72 24 61 24 46 V27Z" fill="rgba(255,90,31,.14)"/><rect x="32" y="43" width="32" height="8" rx="4" fill="#FF5A1F"/></svg>';
  const car=document.getElementById('rcar'), rNum=document.getElementById('ruleNum'), rProg=document.getElementById('rProg');
  const nR=rules.length; let ri=0, rTimer=null, paused=false;
  rules.forEach((r,k)=>{
    const a=document.createElement('article'); a.className='rc'; a.setAttribute('aria-roledescription','slide');
    a.innerHTML='<div class="rc-ic">'+shield+'</div><div class="rc-body"><span class="mono"></span><p></p><span class="rc-tag">Enforced in RiskGuard</span></div>';
    a.querySelector('.mono').textContent=r[0]; a.querySelector('p').textContent=r[1];
    a.addEventListener('click',()=>{const pos=+a.dataset.pos; if(pos===1)go(ri+1); else if(pos===-1)go(ri-1);});
    car.appendChild(a);
  });
  const rCards=[...car.children];
  function go(k){
    ri=(k+nR)%nR;
    rCards.forEach((c,idx)=>{let d=idx-ri; if(d>nR/2)d-=nR; if(d<-nR/2)d+=nR; c.dataset.pos=Math.abs(d)<=1?d:'x'; c.setAttribute('aria-hidden',d!==0);});
    rNum.textContent='Rule '+(ri+1)+' of '+nR;
    schedule();
  }
  function schedule(){
    clearTimeout(rTimer); rProg.style.animation='none'; void rProg.offsetWidth;
    if(reduce||paused) return;
    rProg.style.animation='rprog 5.5s linear forwards';
    rTimer=setTimeout(()=>go(ri+1),5500);
  }
  document.getElementById('rPrev').onclick=()=>go(ri-1);
  document.getElementById('rNext').onclick=()=>go(ri+1);
  car.addEventListener('keydown',e=>{if(e.key==='ArrowRight')go(ri+1);if(e.key==='ArrowLeft')go(ri-1)});
  car.addEventListener('pointerenter',()=>{paused=true;schedule()});
  car.addEventListener('pointerleave',()=>{paused=false;schedule()});
  let sx=null; car.addEventListener('pointerdown',e=>sx=e.clientX); car.addEventListener('pointerup',e=>{if(sx!==null&&Math.abs(e.clientX-sx)>40)go(ri+(e.clientX<sx?1:-1));sx=null});
  go(0);

  // mobile menu
  const mb=document.querySelector('.menu-btn'), mn=document.getElementById('mnav');
  function setMenu(o){mn.hidden=!o;mb.setAttribute('aria-expanded',o);mb.setAttribute('aria-label',o?'Close menu':'Open menu');document.documentElement.style.overflow=o?'hidden':'';if(o)mn.querySelector('a').focus()}
  mb.addEventListener('click',()=>setMenu(mn.hidden));
  mn.addEventListener('click',e=>{if(e.target.closest('a'))setMenu(false)});
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!mn.hidden){setMenu(false);mb.focus()}});
  addEventListener('resize',()=>{if(innerWidth>1080&&!mn.hidden)setMenu(false)});

  // pointer: magnetic, tilt, spotlight
  addEventListener('pointermove',e=>{__NX.mouse.x=e.clientX/innerWidth*2-1;__NX.mouse.y=e.clientY/innerHeight*2-1},{passive:true});
  document.querySelectorAll('.spot').forEach(c=>c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect();c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px')}));
  if(fine&&!reduce){
    document.querySelectorAll('.magnet').forEach(b=>{
      b.addEventListener('pointermove',e=>{const r=b.getBoundingClientRect();b.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.22}px,${(e.clientY-r.top-r.height/2)*.32}px)`});
      b.addEventListener('pointerleave',()=>{b.style.transition='transform .6s cubic-bezier(.22,1,.36,1)';b.style.transform='';setTimeout(()=>b.style.transition='',600)});
    });
    document.querySelectorAll('.tilt').forEach(c=>{
      c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;c.style.transform=`perspective(1000px) rotateX(${(.5-py)*5}deg) rotateY(${(px-.5)*7}deg)`});
      c.addEventListener('pointerleave',()=>{c.style.transition='transform .7s cubic-bezier(.22,1,.36,1)';c.style.transform='';setTimeout(()=>c.style.transition='',700)});
    });
  }

  // BurnVault: rotating dial, glowing slot, rising embers
  const ec=document.getElementById('embers'), ex=ec.getContext('2d'); let eOn=false;
  new IntersectionObserver(es=>eOn=es[0].isIntersecting).observe(ec);
  const spr=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,236,214,1)');r.addColorStop(.25,'rgba(255,150,70,.7)');r.addColorStop(1,'rgba(255,90,31,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return c})();
  const spawn=init=>({x:(Math.random()-.5),y:init?Math.random()*.8:0,vx:(Math.random()-.5)*.06,vy:.16+Math.random()*.3,life:init?Math.random()*1.5:0,max:1+Math.random()*1.6,r:.5+Math.random()*1.4,w:Math.random()*6.28});
  const em=[...Array(120)].map(()=>spawn(true)); let rot=0;
  function sizeE(){const d=Math.min(devicePixelRatio,2),r=ec.getBoundingClientRect();ec.width=r.width*d;ec.height=r.height*d}
  sizeE(); addEventListener('resize',sizeE);
  function drawE(t,dt){
    const W=ec.width,H=ec.height,d=Math.min(devicePixelRatio,2); ex.clearRect(0,0,W,H);
    const cx=W/2, cy=H*.47, R=Math.min(W*.4,H*.36); if(!reduce) rot+=dt*.25;
    let g=ex.createRadialGradient(cx,cy,R*.2,cx,cy,R*2.1); g.addColorStop(0,'rgba(255,90,31,.2)'); g.addColorStop(1,'rgba(255,90,31,0)'); ex.fillStyle=g; ex.fillRect(0,0,W,H);
    ex.save(); ex.translate(cx,cy); ex.rotate(rot*.3);
    for(let i=0;i<120;i++){const a=i/120*Math.PI*2,lg=i%10===0,r1=R*(lg?.89:.94);ex.strokeStyle=lg?'rgba(255,160,110,.75)':'rgba(255,160,110,.22)';ex.lineWidth=(lg?1.6:1)*d;ex.beginPath();ex.moveTo(Math.cos(a)*r1,Math.sin(a)*r1);ex.lineTo(Math.cos(a)*R,Math.sin(a)*R);ex.stroke()}
    ex.restore();
    ex.save(); ex.translate(cx,cy); ex.rotate(-rot*.8); ex.lineCap='round';
    for(let k=0;k<3;k++){const a0=k*2.094,gr=ex.createLinearGradient(Math.cos(a0)*R,Math.sin(a0)*R,Math.cos(a0+1.4)*R,Math.sin(a0+1.4)*R);gr.addColorStop(0,'rgba(255,90,31,0)');gr.addColorStop(1,'rgba(255,150,80,.95)');ex.strokeStyle=gr;ex.lineWidth=3*d;ex.beginPath();ex.arc(0,0,R*.8,a0,a0+1.4);ex.stroke()}
    ex.restore();
    g=ex.createRadialGradient(cx-R*.2,cy-R*.25,R*.05,cx,cy,R*.7); g.addColorStop(0,'#2C1B14'); g.addColorStop(1,'#0A0807'); ex.fillStyle=g; ex.beginPath(); ex.arc(cx,cy,R*.66,0,7); ex.fill();
    ex.strokeStyle='rgba(255,170,120,.28)'; ex.lineWidth=d; ex.beginPath(); ex.arc(cx,cy,R*.66,0,7); ex.stroke();
    ex.strokeStyle='rgba(255,232,214,.16)'; ex.lineWidth=2*d; ex.beginPath(); ex.arc(cx,cy,R*.6,Math.PI*1.08,Math.PI*1.62); ex.stroke();
    const sw=R*.92, sh=R*.15, pulse=.85+.15*Math.sin(t*.003);
    ex.fillStyle='#050404'; ex.beginPath(); ex.roundRect(cx-sw/2-3*d,cy-sh/2-3*d,sw+6*d,sh+6*d,sh); ex.fill();
    ex.globalCompositeOperation='lighter'; ex.globalAlpha=.55*pulse; ex.drawImage(spr,cx-sw,cy-sh*3,sw*2,sh*6); ex.globalAlpha=1; ex.globalCompositeOperation='source-over';
    g=ex.createLinearGradient(cx-sw/2,0,cx+sw/2,0); g.addColorStop(0,'#7A1604'); g.addColorStop(.28,'#FF5A1F'); g.addColorStop(.5,'#FFE6CF'); g.addColorStop(.72,'#FF5A1F'); g.addColorStop(1,'#7A1604');
    ex.fillStyle=g; ex.globalAlpha=pulse; ex.beginPath(); ex.roundRect(cx-sw/2,cy-sh/2,sw,sh,sh/2); ex.fill(); ex.globalAlpha=1;
    ex.globalCompositeOperation='lighter';
    em.forEach((p,i)=>{
      if(!reduce){p.life+=dt;p.y+=p.vy*dt*.45;p.x+=(p.vx+Math.sin(p.w+t*.0018)*.025)*dt;if(p.life>p.max)em[i]=spawn(false)}
      const k=Math.min(1,p.life/p.max), a=(1-k)*Math.min(1,k*8);
      const px=cx+p.x*sw*.9, py=cy-p.y*H*.9, s=p.r*d*(1-k*.5)*5;
      ex.globalAlpha=Math.max(0,a); ex.drawImage(spr,px-s,py-s,s*2,s*2);
    });
    ex.globalAlpha=1; ex.globalCompositeOperation='source-over';
  }

  // marquee
  const mq=document.getElementById('mq'); mq.innerHTML+=mq.innerHTML;
  let mqX=0,lastY=scrollY,vel=0,dir=1,lt=performance.now();

  const hero=document.getElementById('hero'), copyA=document.getElementById('copyA'), copyB=document.getElementById('copyB');
  const pb=[...document.querySelectorAll('.prog b')], nav=document.getElementById('nav');
  const pipe=document.getElementById('pipe'), pipeFill=document.getElementById('pipeFill'), steps=[...document.querySelectorAll('.step')];
  const road=document.getElementById('road'), roadFill=document.getElementById('roadFill'), wks=[...document.querySelectorAll('.wk')];
  const cta=document.getElementById('cta'), gArc=document.getElementById('gArc');

  function frame(t){
    const dt=Math.min((t-lt)/1000,.05); lt=t;
    const y=scrollY, vh=innerHeight;
    const hr=hero.getBoundingClientRect(), p=clamp(-hr.top/(hr.height-vh)); __NX.heroP=p;
    const fa=sm(.32,.5,p), fb=sm(.52,.68,p);
    copyA.style.opacity=1-fa; copyA.style.filter=`blur(${fa*12}px)`; copyA.style.transform=`translateY(${-fa*40}px)`; copyA.style.pointerEvents=fa>.5?'none':'';
    copyB.style.opacity=fb; copyB.style.filter=`blur(${(1-fb)*12}px)`;
    pb[0].style.transform=`scaleY(${clamp(p/.5)})`; pb[1].style.transform=`scaleY(${clamp((p-.5)/.5)})`;

    const dy=y-lastY; lastY=y; vel+=(dy-vel)*.1; if(Math.abs(dy)>.5) dir=Math.sign(dy);
    if(!reduce){mqX-=(.6+Math.min(Math.abs(vel),40)*.35)*dir;const half=mq.scrollWidth/2;if(mqX<-half)mqX+=half;if(mqX>0)mqX-=half;mq.style.transform=`translate3d(${mqX}px,0,0)`}
    if(dy>4&&y>vh*1.4) nav.classList.add('hide'); if(dy<-2) nav.classList.remove('hide');

    const pr=pipe.getBoundingClientRect(), pp=clamp((vh*.6-pr.top)/pr.height);
    pipeFill.style.transform=`scaleY(${pp})`;
    steps.forEach(s=>s.classList.toggle('lit',s.getBoundingClientRect().top<vh*.6));
    const rr=road.getBoundingClientRect(), rp=clamp((vh*.85-rr.top)/(rr.height+vh*.3));
    roadFill.style.transform=`scaleX(${rp})`;
    wks.forEach((w,i)=>w.classList.toggle('lit', innerWidth>1080 ? rp>=i/wks.length+.02 : w.getBoundingClientRect().top<vh*.85));
    const cr=cta.getBoundingClientRect(); __NX.ctaP=clamp((vh-cr.top)/(cr.height+vh));
    if(eOn) drawE(t,dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

}
