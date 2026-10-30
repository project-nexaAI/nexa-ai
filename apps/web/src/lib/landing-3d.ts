// @ts-nocheck
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function init3d() {


const N=window.__NX, clamp=N.clamp, sm=N.sm, lerp=(a,b,t)=>a+(b-a)*t;
const BG=0x0A0A0A;

function glowTex(){
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,240,225,1)');r.addColorStop(.2,'rgba(255,150,80,.75)');r.addColorStop(.55,'rgba(255,90,31,.18)');r.addColorStop(1,'rgba(255,90,31,0)');
  g.fillStyle=r;g.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const PT_FRAG=`varying float vA; uniform vec3 uC;
void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d); gl_FragColor=vec4(uC*(1.+smoothstep(.25,0.,d)*1.5), a*vA); }`;

/* ===================== HERO: the visor mind ===================== */
(function hero(){
  const canvas=document.getElementById('hero3d');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  const PR=Math.min(devicePixelRatio,1.75);
  renderer.setPixelRatio(PR);
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  const scene=new THREE.Scene(); scene.background=new THREE.Color(BG);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const studio=new THREE.Scene(); studio.background=new THREE.Color(0x030303);
  const strip=(w,h,col,k,pos)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(k),side:THREE.DoubleSide}));m.position.set(...pos);m.lookAt(0,0,0);studio.add(m);};
  strip(9,1.2,0xffffff,.55,[0,6,2.5]); strip(.7,7,0xff5a1f,2.4,[7,0,-3]); strip(1,5,0xffc6a0,.45,[-7,1.5,2]); strip(7,.25,0xffffff,.6,[0,-5,4]); strip(2.2,2.2,0xff7a3d,.5,[-3,-2,-7]);
  scene.environment=pmrem.fromScene(studio,0.02).texture;
  scene.fog=new THREE.Fog(BG,12,26);
  const camera=new THREE.PerspectiveCamera(30,1,.1,100);

  const key=new THREE.DirectionalLight(0xfff1e6,.5); key.position.set(-5,6,6); scene.add(key);
  const rim=new THREE.DirectionalLight(0xff6a2b,4.2); rim.position.set(6,2,-5); scene.add(rim);
  const back=new THREE.DirectionalLight(0xffc6a0,.9); back.position.set(-6,3,-6); scene.add(back);

  const rig=new THREE.Group(); scene.add(rig);
  const head=new THREE.Group(); rig.add(head);

  // engraved lines + perforation, used as bump and roughness
  function surfaceTex(){
    const W=2048,H=1024,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
    g.fillStyle='#808080';g.fillRect(0,0,W,H);
    g.strokeStyle='#3a3a3a';g.lineWidth=2;
    for(let k=1;k<16;k++){ if(k>=6&&k<=8) continue; const y=k/16*H; g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke(); }
    for(let k=0;k<32;k++){ const x=k/32*W; g.beginPath();g.moveTo(x,H*.07);g.lineTo(x,H*.33);g.stroke(); }
    g.fillStyle='#262626';
    for(let row=0,y=H*.62;y<H*.86;y+=13,row++){ for(let x=(row%2)*6.5;x<W;x+=13){ g.beginPath();g.arc(x,y,3,0,7);g.fill(); } }
    g.strokeStyle='#2a2a2a'; g.lineWidth=4; [H*.585,H*.895].forEach(y=>{g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();});
    const t=new THREE.CanvasTexture(c); t.wrapS=THREE.RepeatWrapping; t.anisotropy=8; return t;
  }
  const surf=surfaceTex();
  const coreMat=new THREE.MeshPhysicalMaterial({color:0x0a0a0b,metalness:.25,roughness:.62,roughnessMap:surf,bumpMap:surf,bumpScale:2.4,clearcoat:1,clearcoatRoughness:.09,envMapIntensity:1});
  const core=new THREE.Mesh(new THREE.SphereGeometry(1.5,192,192),coreMat);
  core.scale.set(1,1.14,1); head.add(core);
  const shell=new THREE.Mesh(new THREE.SphereGeometry(1.515,128,128),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
    vertexShader:`varying vec3 vN; varying vec3 vV; void main(){vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.-max(dot(vN,vV),0.),3.2); float side=smoothstep(-.3,.9,vN.x)*.75+.25; gl_FragColor=vec4(vec3(1.,.42,.14)*f*side*1.25,f); }`}));
  core.add(shell);

  // visor: dark glass recess, segmented LED strip, chrome lips
  core.add(new THREE.Mesh(new THREE.SphereGeometry(1.504,220,16,Math.PI/2-1.42,2.84,Math.PI/2-.245,.215),
    new THREE.MeshPhysicalMaterial({color:0x020202,metalness:.2,roughness:.06,clearcoat:1,clearcoatRoughness:.02,envMapIntensity:1.4})));
  const ledMat=new THREE.ShaderMaterial({uniforms:{uT:{value:0},uI:{value:1}},toneMapped:false,transparent:true,depthWrite:false,
    vertexShader:`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv; uniform float uT; uniform float uI;
    float h(float n){return fract(sin(n*91.345)*47453.21);}
    void main(){
      float N=84.; float id=floor(vUv.x*N); float f=fract(vUv.x*N);
      float cell=smoothstep(0.,.14,f)*smoothstep(1.,.78,f);
      float row=smoothstep(.1,.3,vUv.y)*smoothstep(.9,.7,vUv.y);
      float ends=smoothstep(0.,.08,vUv.x)*smoothstep(1.,.92,vUv.x);
      float sp=.5+.43*sin(uT*.85); float d=abs((id+.5)/N-sp);
      float peak=exp(-d*d*260.); float trail=exp(-d*d*28.)*.55;
      float tw=step(.965,h(id+floor(uT*7.)))*.5;
      float lvl=(.16+trail+peak*2.2+tw)*uI;
      vec3 col=mix(vec3(1.,.26,.04),vec3(1.,.62,.3),clamp(trail*1.4,0.,1.)); col=mix(col,vec3(1.,.9,.78),peak);
      gl_FragColor=vec4(col*lvl*1.6,cell*row*ends);
    }`});
  core.add(new THREE.Mesh(new THREE.SphereGeometry(1.507,220,8,Math.PI/2-1.36,2.72,Math.PI/2-.205,.135),ledMat));
  const chrome=new THREE.MeshPhysicalMaterial({color:0x8a7f76,metalness:1,roughness:.38,envMapIntensity:.32});
  [[-.255,.016],[-.026,.016]].forEach(([o,hh])=>core.add(new THREE.Mesh(new THREE.SphereGeometry(1.512,220,3,Math.PI/2-1.44,2.88,Math.PI/2+o,hh),chrome)));
  const modLED=[];

  // soft light pool under the head
  const tex=glowTex();
  const pool=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:.32,depthWrite:false,blending:THREE.AdditiveBlending}));
  pool.scale.set(5.5,1.1,1); pool.position.set(0,-2.25,0); rig.add(pool);

  // particles drifting in (the chain being read)
  const IN=700, ig=new THREE.BufferGeometry(), dirs=new Float32Array(IN*3), seeds=new Float32Array(IN), spd=new Float32Array(IN);
  for(let i=0;i<IN;i++){const v=new THREE.Vector3().randomDirection(); v.y*=.7; v.normalize(); dirs.set([v.x,v.y,v.z],i*3); seeds[i]=Math.random(); spd[i]=.04+Math.random()*.08;}
  ig.setAttribute('position',new THREE.BufferAttribute(new Float32Array(IN*3),3));
  ig.setAttribute('aDir',new THREE.BufferAttribute(dirs,3)); ig.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1)); ig.setAttribute('aSpd',new THREE.BufferAttribute(spd,1));
  const inMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
    uniforms:{uT:{value:0},uPR:{value:PR},uAmt:{value:1}},
    vertexShader:`attribute vec3 aDir; attribute float aSeed; attribute float aSpd; uniform float uT; uniform float uPR; uniform float uAmt; varying float vA; varying float vW;
    void main(){ float p=fract(aSeed+uT*aSpd); float e=p*p*(3.-2.*p);
      vec3 pos=mix(aDir*(6.5+aSeed*5.),aDir*1.8,e);
      vA=smoothstep(0.,.25,p)*(1.-smoothstep(.8,1.,p))*uAmt*.7; vW=step(.8,aSeed);
      vec4 mv=modelViewMatrix*vec4(pos,1.); gl_PointSize=uPR*(1.+aSeed*2.)*(16./-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`varying float vA; varying float vW; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); vec3 c=mix(vec3(1.,.42,.12),vec3(1.,.86,.72),vW); gl_FragColor=vec4(c*(1.+smoothstep(.22,0.,d)),a*vA); }`});
  const inflow=new THREE.Points(ig,inMat); inflow.frustumCulled=false; rig.add(inflow);

  // rings: instrument ticks, fine line with riders, dashed commit orbit
  const spins=[];
  function pivot(rx,rz){const pv=new THREE.Group();pv.rotation.set(rx,0,rz);rig.add(pv);const sp=new THREE.Group();pv.add(sp);return [pv,sp];}
  {
    const [pv,sp]=pivot(1.25,.25), R=2.35, N=240;
    const im=new THREE.InstancedMesh(new THREE.BoxGeometry(.007,.05,.007),new THREE.MeshBasicMaterial({color:new THREE.Color(1,.45,.18),transparent:true,opacity:.6,toneMapped:false}),N);
    const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),ps=new THREE.Vector3(),z=new THREE.Vector3(0,0,1);
    for(let i=0;i<N;i++){const a=i/N*Math.PI*2,lg=i%10===0;ps.set(Math.cos(a)*R,Math.sin(a)*R,0);q.setFromAxisAngle(z,a-Math.PI/2);sc.set(1,lg?2.6:1,1);m4.compose(ps,q,sc);im.setMatrixAt(i,m4);}
    sp.add(im); spins.push([sp,.12]);
  }
  let riderMat;
  {
    const [pv,sp]=pivot(1.05,-.35), R=2.85;
    pv.add(new THREE.Mesh(new THREE.TorusGeometry(R,.0035,6,360),new THREE.MeshBasicMaterial({color:new THREE.Color(1,.5,.25),transparent:true,opacity:.32,toneMapped:false})));
    const n=4,g=new THREE.BufferGeometry(),off=new Float32Array(n),sp2=new Float32Array(n);
    for(let i=0;i<n;i++){off[i]=i/n*6.283+Math.random()*.4;sp2[i]=-.22*(.8+Math.random()*.5);}
    g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3)); g.setAttribute('aOff',new THREE.BufferAttribute(off,1)); g.setAttribute('aSpd',new THREE.BufferAttribute(sp2,1));
    riderMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,uniforms:{uT:{value:0},uR:{value:R},uPR:{value:PR},uC:{value:new THREE.Color(1.6,.75,.3)}},
      vertexShader:`attribute float aOff; attribute float aSpd; uniform float uT; uniform float uR; uniform float uPR; varying float vA; void main(){ float a=aOff+uT*aSpd; vec3 pos=vec3(cos(a)*uR,sin(a)*uR,0.); vA=1.; vec4 mv=modelViewMatrix*vec4(pos,1.); gl_PointSize=uPR*8.*(12./-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader:PT_FRAG});
    const rd=new THREE.Points(g,riderMat); rd.frustumCulled=false; pv.add(rd);
  }
  const [pvC,spC]=pivot(1.32,.08), RC=3.35;
  const cpts=[]; for(let i=0;i<=480;i++){const a=i/480*Math.PI*2;cpts.push(new THREE.Vector3(Math.cos(a)*RC,Math.sin(a)*RC,0));}
  const dash=new THREE.Line(new THREE.BufferGeometry().setFromPoints(cpts),new THREE.LineDashedMaterial({color:new THREE.Color(1,.5,.25),dashSize:.06,gapSize:.08,transparent:true,opacity:.25,toneMapped:false}));
  dash.computeLineDistances(); pvC.add(dash); spins.push([spC,.12]);

  // commit crystals
  const BN=9, blocks=[];
  const bGeo=new RoundedBoxGeometry(.36,.36,.36,4,.06);
  const bMat=new THREE.MeshPhysicalMaterial({color:0x101012,metalness:.3,roughness:.1,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:1.1,transparent:true,opacity:.62});
  const eGeo=new THREE.EdgesGeometry(new THREE.BoxGeometry(.372,.372,.372));
  const kGeo=new THREE.OctahedronGeometry(.085,0);
  for(let i=0;i<BN;i++){
    const g=new THREE.Group();
    const kern=new THREE.Mesh(kGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(2.6,1.,.36),toneMapped:false})); g.add(kern);
    g.add(new THREE.Mesh(bGeo,bMat));
    const em=new THREE.LineBasicMaterial({color:new THREE.Color(1.3,.5,.16),transparent:true,toneMapped:false}); g.add(new THREE.LineSegments(eGeo,em));
    const a=Math.PI/2-1.75+i/(BN-1)*3.5;
    g.visible=false; spC.add(g);
    blocks.push({g,em,kern,target:new THREE.Vector3(Math.cos(a)*RC,Math.sin(a)*RC,0),spin:(Math.random()-.5)*2});
  }
  const linkGeo=new THREE.BufferGeometry(), linkPos=new Float32Array((BN-1)*6);
  linkGeo.setAttribute('position',new THREE.BufferAttribute(linkPos,3));
  const links=new THREE.LineSegments(linkGeo,new THREE.LineBasicMaterial({color:new THREE.Color(1.5,.55,.18),transparent:true,opacity:.7,toneMapped:false}));
  links.frustumCulled=false; spC.add(links);

  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256,256),.7,.42,1.0));
  composer.addPass(new OutputPass());

  let W=0,H=0;
  function layout(){
    const w=canvas.clientWidth,h=canvas.clientHeight; if(!w||!h) return;
    if(w!==W||h!==H){W=w;H=h;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  }
  let visible=true; new IntersectionObserver(e=>visible=e[0].isIntersecting).observe(canvas);
  const clock=new THREE.Clock(); let p=0,mx=0,my=0;
  const tmp=new THREE.Vector3(), ss=v=>v*v*(3-2*v);

  (function tick(){
    requestAnimationFrame(tick);
    if(!visible) return;
    layout();
    const dt=Math.min(clock.getDelta(),.05), t=clock.elapsedTime, idle=N.reduce?0:1;
    p+=(N.heroP-p)*(1-Math.exp(-dt*6));
    mx+=(N.mouse.x-mx)*(1-Math.exp(-dt*3)); my+=(N.mouse.y-my)*(1-Math.exp(-dt*3));
    const narrow=innerWidth<860, ph=innerWidth<620;
    camera.position.set(0,0,lerp(11,10.4,sm(.4,1,p))); camera.lookAt(0,0,0);
    camera.fov=ph?44:30; camera.updateProjectionMatrix();
    rig.position.set(narrow?0:2.75, ph?-2.75:(narrow?-2.45:-.05), 0);
    rig.scale.setScalar(ph?.62:(narrow?.68:.86));

    head.rotation.y=lerp(head.rotation.y,-.18+mx*.38+Math.sin(t*.4)*.06*idle,.08);
    head.rotation.x=lerp(head.rotation.x,my*.2+Math.sin(t*.55)*.03*idle,.08);
    head.position.y=Math.sin(t*.9)*.05*idle;

    const c=sm(.48,.92,p); let flash=0, settled=0;
    spC.worldToLocal(tmp.copy(rig.position));
    blocks.forEach((b,i)=>{
      const k=clamp((c-i*.075)/.28), e=ss(k);
      b.g.visible=k>0;
      b.g.position.lerpVectors(tmp,b.target,e);
      b.g.scale.setScalar(.2+.8*e);
      b.g.rotation.set(b.spin*(1-e)*3+t*.15*idle,(1-e)*4+t*.2*idle,b.spin*(1-e)*2);
      b.kern.rotation.x+=dt*1.4; b.kern.rotation.y+=dt*1.1;
      flash=Math.max(flash,k>0&&k<1?Math.sin(k*Math.PI):0);
      b.em.opacity=.3+.7*e;
      if(k>=1) settled++;
    });
    for(let i=0;i<BN-1;i++){const a=blocks[i].g.position,b=blocks[i+1].g.position;linkPos.set([a.x,a.y,a.z,b.x,b.y,b.z],i*6);}
    linkGeo.setDrawRange(0,Math.max(0,settled-1)*2); linkGeo.attributes.position.needsUpdate=true;
    dash.material.opacity=.2+c*.3;
    spins.forEach(([sp,s])=>sp.rotation.z+=dt*s*.25*idle);
    riderMat.uniforms.uT.value=t;
    ledMat.uniforms.uT.value=idle?t:1.2; ledMat.uniforms.uI.value=1+flash*.8+c*.2;
    const pulse=.55+.45*Math.sin(t*2.4); modLED.forEach(m=>m.color.setRGB(1.6*pulse,.55*pulse,.18*pulse));
    inMat.uniforms.uT.value=t; inMat.uniforms.uAmt.value=1-c*.55;
    pool.material.opacity=.26+flash*.25;
    composer.render();
  })();
})();

/* ===================== CTA: horizon ===================== */
(function horizon(){
  const canvas=document.getElementById('cta3d');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  const PR=Math.min(devicePixelRatio,1.75); renderer.setPixelRatio(PR);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene(); scene.background=new THREE.Color(BG);
  const camera=new THREE.PerspectiveCamera(32,1,.1,200);

  const R=18, planetY=-R-1.6;
  const planet=new THREE.Mesh(new THREE.SphereGeometry(R,192,192),new THREE.ShaderMaterial({
    uniforms:{uT:{value:0}},
    vertexShader:`varying vec3 vN; varying vec3 vW; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vP=position; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader:`varying vec3 vN; varying vec3 vW; varying vec3 vP; uniform float uT;
    void main(){
      vec3 V=normalize(cameraPosition-vW); float f=1.-max(dot(normalize(vN),V),0.);
      float rim=pow(f,5.);
      float lat=abs(sin(atan(vP.z,vP.x)*36.+uT*.05))*.0+0.;
      float grid=smoothstep(.985,1.,abs(sin(vP.x*1.6)))*.06+smoothstep(.985,1.,abs(sin(vP.z*1.6)))*.06;
      vec3 base=vec3(.02,.016,.014)+vec3(.9,.3,.08)*grid*(1.-f)*.6;
      vec3 c=base+vec3(1.,.42,.12)*rim*1.8+vec3(1.,.86,.7)*pow(f,14.)*1.2;
      gl_FragColor=vec4(c,1.);
    }`}));
  planet.position.y=planetY; scene.add(planet);

  const atmo=new THREE.Mesh(new THREE.SphereGeometry(R*1.035,160,160),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(normalMatrix*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader:`varying vec3 vN; varying vec3 vW;
    void main(){ vec3 V=normalize(cameraPosition-vW); float d=dot(normalize(vN),V); float g=pow(clamp(1.+d*1.0,0.,1.),5.);
      gl_FragColor=vec4(vec3(1.,.38,.1)*g*1.25,g); }`}));
  atmo.position.y=planetY; scene.add(atmo);

  const tex=glowTex();
  const sun=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.95}));
  sun.scale.set(22,5.5,1); sun.position.set(0,-1.55,-2); scene.add(sun);
  const core=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  core.scale.set(5,1.6,1); core.position.set(0,-1.6,-1.9); scene.add(core);

  // dust
  const DN=500, dg=new THREE.BufferGeometry(), dp=new Float32Array(DN*3);
  for(let i=0;i<DN;i++){dp[i*3]=(Math.random()-.5)*30; dp[i*3+1]=Math.random()*12-1.5; dp[i*3+2]=-Math.random()*14;}
  dg.setAttribute('position',new THREE.BufferAttribute(dp,3));
  const dust=new THREE.Points(dg,new THREE.PointsMaterial({map:tex,size:.12,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending,color:0xffb38a}));
  scene.add(dust);

  // floating commit cards (glass, rounded, with sparkline)
  function tileTex(i){
    const W=1024,H=640,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
    const path=()=>{g.beginPath();g.roundRect(6,6,W-12,H-12,46)};
    path(); let gr=g.createLinearGradient(0,0,W,H); gr.addColorStop(0,'rgba(48,20,9,.95)'); gr.addColorStop(.55,'rgba(18,13,11,.95)'); gr.addColorStop(1,'rgba(10,10,10,.95)'); g.fillStyle=gr; g.fill();
    g.save(); path(); g.clip();
    g.strokeStyle='rgba(255,160,110,.05)'; g.lineWidth=2; for(let x=0;x<W;x+=48){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke()} for(let y=0;y<H;y+=48){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}
    gr=g.createLinearGradient(0,0,0,H*.55); gr.addColorStop(0,'rgba(255,210,180,.12)'); gr.addColorStop(1,'rgba(255,210,180,0)'); g.fillStyle=gr; g.fillRect(0,0,W,H*.55);
    g.restore();
    path(); gr=g.createLinearGradient(0,0,W,H); gr.addColorStop(0,'rgba(255,150,90,.95)'); gr.addColorStop(.5,'rgba(255,150,90,.12)'); gr.addColorStop(1,'rgba(255,150,90,.55)'); g.strokeStyle=gr; g.lineWidth=4; g.stroke();
    const revealed=i%2===0;
    g.fillStyle='#FF8A55'; g.font='500 30px "Geist Mono", monospace'; g.fillText('COMMIT',60,96);
    g.fillStyle='#8A7A70'; g.font='26px "Geist Mono", monospace'; g.fillText('day '+(i+1)+' / 30',60,138);
    const chip=revealed?'REVEALED':'COMMITTED'; g.font='500 24px "Geist Mono", monospace'; const cw=g.measureText(chip).width+64;
    g.beginPath(); g.roundRect(W-60-cw,62,cw,50,25); g.fillStyle=revealed?'rgba(255,90,31,.18)':'rgba(255,255,255,.05)'; g.fill(); g.strokeStyle=revealed?'rgba(255,140,80,.7)':'rgba(255,255,255,.18)'; g.lineWidth=2; g.stroke();
    g.fillStyle=revealed?'#FF8A55':'#A7A29C'; g.beginPath(); g.arc(W-60-cw+28,87,6,0,7); g.fill(); g.fillText(chip,W-60-cw+44,96);
    let h='';for(let k=0;k<16;k++)h+='0123456789abcdef'[Math.random()*16|0];
    g.fillStyle='#F2EFEA'; g.font='300 50px "Geist", sans-serif'; g.fillText('0x'+h.match(/.{4}/g).join(' ')+'…',60,250);
    const cols=[['ASSET','Stock Token'],['DIRECTION',i%3?'Down':'Up'],['HORIZON','7 days']];
    cols.forEach(([k,v],n)=>{const x=60+n*300; g.fillStyle='#8A7A70'; g.font='22px "Geist Mono", monospace'; g.fillText(k,x,320); g.fillStyle='#F2EFEA'; g.font='400 34px "Geist", sans-serif'; g.fillText(v,x,364);});
    const pts=[]; let y=0; for(let k=0;k<=40;k++){y+= (Math.random()-.46)*14; pts.push([60+k*(W-120)/40, 520+Math.max(-70,Math.min(40,y))]);}
    g.beginPath(); g.moveTo(pts[0][0],590); pts.forEach(([x,yy])=>g.lineTo(x,yy)); g.lineTo(pts[pts.length-1][0],590); g.closePath();
    gr=g.createLinearGradient(0,440,0,590); gr.addColorStop(0,'rgba(255,90,31,.35)'); gr.addColorStop(1,'rgba(255,90,31,0)'); g.fillStyle=gr; g.fill();
    g.beginPath(); pts.forEach(([x,yy],k)=>k?g.lineTo(x,yy):g.moveTo(x,yy)); g.strokeStyle='#FF6A2B'; g.lineWidth=4; g.stroke();
    const last=pts[pts.length-1]; g.fillStyle='#FFD2B5'; g.beginPath(); g.arc(last[0],last[1],8,0,7); g.fill();
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
  }
  const tiles=[];
  const spots=[[-5.8,2.6,-3.5,.1],[5.9,3,-3.5,-.14],[-5,-.15,-1.2,.06],[5.1,.2,-1.4,-.08]];
  spots.forEach((s,i)=>{
    const m=new THREE.Group();
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending}));
    halo.scale.set(4.4,3,1); halo.position.z=-.05; m.add(halo);
    m.add(new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.5),new THREE.MeshBasicMaterial({map:tileTex(i),transparent:true})));
    m.position.set(s[0],s[1],s[2]); m.rotation.set(0,-s[0]*.05,s[3]); scene.add(m);
    tiles.push({m,base:m.position.clone(),ph:Math.random()*6.28,depth:1/(1-s[2]*.2)});
  });

  let W=0,H=0;
  function layout(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;if(w!==W||h!==H){W=w;H=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
  let visible=false; new IntersectionObserver(e=>visible=e[0].isIntersecting).observe(canvas);
  const clock=new THREE.Clock(); let cp=0,mx=0,my=0;
  (function tick(){
    requestAnimationFrame(tick);
    if(!visible) return;
    layout();
    const dt=Math.min(clock.getDelta(),.05), t=clock.elapsedTime, idle=N.reduce?0:1;
    cp+=(N.ctaP-cp)*(1-Math.exp(-dt*4)); mx+=(N.mouse.x-mx)*.04; my+=(N.mouse.y-my)*.04;
    const narrow=innerWidth<760;
    camera.fov=narrow?58:32;
    camera.position.set(mx*.5,lerp(.6,-.1,cp)-my*.2,narrow?11:12); camera.lookAt(0,narrow?lerp(2.9,2.4,cp):lerp(.9,.3,cp),0);
    camera.updateProjectionMatrix();
    planet.rotation.y+=dt*.01*idle; planet.material.uniforms.uT.value=t;
    sun.material.opacity=.75+Math.sin(t*1.3)*.08*idle+cp*.15;
    tiles.forEach((o,i)=>{
      o.m.visible=innerWidth>=620&&(!narrow||i>1);
      o.m.position.x=o.base.x*(narrow?.55:1)+mx*.4*o.depth;
      o.m.position.y=o.base.y+Math.sin(t*.7+o.ph)*.12*idle-my*.2*o.depth+lerp(-.6,.4,cp)*o.depth*.6;
      o.m.rotation.x=Math.sin(t*.5+o.ph)*.05*idle;
    });
    dust.rotation.y=t*.01*idle;
    renderer.render(scene,camera);
  })();
})();

}
