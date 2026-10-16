
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {toCreasedNormals} from "three/addons/utils/BufferGeometryUtils.js";

/* ============ CORE: geometría, malla y STL (sin DOM) ============ */
const PI=Math.PI, TAU=2*PI;

class TriBuf{
  constructor(){this.a=[]}
  t(ax,ay,az,bx,by,bz,cx,cy,cz){this.a.push(ax,ay,az,bx,by,bz,cx,cy,cz)}
  get pos(){return new Float32Array(this.a)}
}
const area=p=>{let s=0;for(let i=0,n=p.length;i<n;i++){const a=p[i],b=p[(i+1)%n];s+=a[0]*b[1]-b[0]*a[1]}return s/2};
const orient=(p,ccw)=>((area(p)>0)===ccw)?p:p.slice().reverse();
const rot=(p,a)=>{if(!a)return p;const c=Math.cos(a),s=Math.sin(a);return p.map(q=>[q[0]*c-q[1]*s,q[0]*s+q[1]*c])};

function cap(B,outer,holes,z,up){
  const V=p=>p.map(q=>new THREE.Vector2(q[0],q[1]));
  const faces=THREE.ShapeUtils.triangulateShape(V(outer),holes.map(V));
  const pts=outer.concat(...holes);
  for(const f of faces){
    let a=pts[f[0]],b=pts[f[1]],c=pts[f[2]];
    const ar=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    if((ar>0)!==up){const t=b;b=c;c=t}
    B.t(a[0],a[1],z,b[0],b[1],z,c[0],c[1],z);
  }
}
/* g = {outer:{pts,twist}, holes:[{pts,twist}]}  outer CCW, holes CW.
   theta(f) → ángulo de giro (rad) a fracción f∈[0,1] de la altura; solo afecta contornos con twist:true */
function extrude(B,g,z0,z1,theta=null,layers=1){
  const th=z=>theta?theta((z-z0)/(z1-z0)):0;
  const all=[g.outer,...g.holes];
  for(const c of all){
    const L=(c.twist&&theta)?layers:1;
    for(let i=0;i<L;i++){
      const za=z0+(z1-z0)*i/L,zb=z0+(z1-z0)*(i+1)/L;
      const A=c.twist?rot(c.pts,th(za)):c.pts,Bp=c.twist?rot(c.pts,th(zb)):c.pts,n=A.length;
      for(let j=0;j<n;j++){
        const k=(j+1)%n,a=A[j],b=A[k],c2=Bp[k],d=Bp[j];
        B.t(a[0],a[1],za,b[0],b[1],za,c2[0],c2[1],zb);
        B.t(a[0],a[1],za,c2[0],c2[1],zb,d[0],d[1],zb);
      }
    }
  }
  const at=z=>({o:g.outer.twist?rot(g.outer.pts,th(z)):g.outer.pts,h:g.holes.map(h=>h.twist?rot(h.pts,th(z)):h.pts)});
  const top=at(z1),bot=at(z0);
  cap(B,top.o,top.h,z1,true);
  cap(B,bot.o,bot.h,z0,false);
}

/* ---------- Engranajes (evolvente) ---------- */
function toothProfile(z,m,alpha,add,ded,extra,N=7){
  const rp=m*z/2,rb=rp*Math.cos(alpha),rf=Math.max(rp-ded,0.3*m);
  const invA=Math.tan(alpha)-alpha;
  const half=r=>{const ph=Math.acos(Math.min(1,rb/r));return PI/(2*z)+invA-(Math.tan(ph)-ph)+extra/(2*rp)};
  let ra=rp+add;
  while(ra>rp&&half(ra)<0.02)ra-=0.01*m;
  const r0=Math.max(rb,rf),h0=half(r0),pol=(r,a)=>[r*Math.cos(a),r*Math.sin(a)],pts=[],cut=rf<r0-1e-9;
  for(let k=0;k<z;k++){
    const c=TAU*k/z;
    if(cut)pts.push(pol(rf,c-h0));
    for(let i=0;i<=N;i++){const r=r0+(ra-r0)*i/N;pts.push(pol(r,c-half(r)))}
    const h1=half(ra);
    for(let i=1;i<3;i++)pts.push(pol(ra,c-h1+2*h1*i/3));
    for(let i=N;i>=0;i--){const r=r0+(ra-r0)*i/N;pts.push(pol(r,c+half(r)))}
    if(cut)pts.push(pol(rf,c+h0));
    const a0=c+h0,a1=TAU*(k+1)/z-h0;
    for(let i=1;i<3;i++)pts.push(pol(rf,a0+(a1-a0)*i/3));
  }
  return pts;
}
function circlePts(r,n=36,cx=0,cy=0){return Array.from({length:n},(_,i)=>{const a=TAU*i/n;return [cx+r*Math.cos(a),cy+r*Math.sin(a)]})}
function borePts(type,r,keyW,keyD){
  if(type==='D'){
    const xf=r*0.8,n=48;
    return Array.from({length:n},(_,i)=>{const a=TAU*i/n;return [Math.min(r*Math.cos(a),xf),r*Math.sin(a)]});
  }
  if(type==='key'){
    const a1=Math.acos(Math.min(1,(keyW/2)/r)),a2=PI-a1,sweep=a1+TAU-a2,n=48,pts=[];
    for(let i=0;i<=n;i++){const a=a2+sweep*i/n;pts.push([r*Math.cos(a),r*Math.sin(a)])}
    pts.push([keyW/2,r+keyD],[-keyW/2,r+keyD]);
    return pts;
  }
  return circlePts(r,48);
}
/* s: {z,m,alpha,T,internal,backlash,beta,sign,herring,boreType,boreD,boreClear,keyW,keyD,hubD,hubH,lightN,lightFrac,ringWall} */
function buildGear(s){
  const rp=s.m*s.z/2,B=new TriBuf();
  let theta=null,layers=1;
  if(s.beta>0){
    const D=(s.herring?s.T/2:s.T)*Math.tan(s.beta)/rp;
    theta=s.herring?(f=>s.sign*D*(1-Math.abs(2*f-1))):(f=>s.sign*D*f);
    layers=Math.max(4,Math.ceil(D*180/PI/1.2));
    if(s.herring)layers=2*Math.ceil(layers/2);
  }
  if(!s.internal){
    const prof=toothProfile(s.z,s.m,s.alpha,s.m,1.25*s.m,-s.backlash);
    const boreR=s.boreD/2+(s.boreClear||0);
    const holes=[];
    let bore=null;
    if(s.boreD>0){bore={pts:orient(borePts(s.boreType,boreR,s.keyW,s.keyD),false),twist:false};holes.push(bore)}
    let hubD=s.hubD>0?Math.max(s.hubD,s.boreD+4):0;
    const hubR=hubD>0?hubD/2:boreR+2;
    const rf=rp-1.25*s.m;
    if(s.lightN>0){
      const inner=hubR+2,outer=rf-2;
      if(outer-inner>=4){
        let hr=(outer-inner)/2*s.lightFrac;const c=(outer+inner)/2;
        const maxByChord=c*Math.sin(PI/s.lightN)-0.8;
        hr=Math.min(hr,maxByChord);
        if(hr>=1)for(let i=0;i<s.lightN;i++){
          const a=TAU*i/s.lightN+PI/s.lightN;
          holes.push({pts:orient(circlePts(hr,28,c*Math.cos(a),c*Math.sin(a)),false),twist:false});
        }
      }
    }
    extrude(B,{outer:{pts:orient(prof,true),twist:true},holes},0,s.T,theta,layers);
    if(hubD>0&&s.hubH>0){
      extrude(B,{outer:{pts:circlePts(hubD/2,64),twist:false},holes:bore?[bore]:[]},s.T-0.4,s.T+s.hubH);
    }
  }else{
    const prof=toothProfile(s.z,s.m,s.alpha,1.25*s.m,s.m,+s.backlash);
    const Ro=rp+1.25*s.m+s.ringWall;
    extrude(B,{outer:{pts:circlePts(Ro,128),twist:false},holes:[{pts:orient(prof,false),twist:true}]},0,s.T,theta,layers);
  }
  return B.pos;
}

/* ---------- Máscara → contornos (marching squares) ---------- */
function dpArr(p,eps){
  const n=p.length;if(n<3)return p;
  const keep=new Uint8Array(n);keep[0]=keep[n-1]=1;
  const st=[[0,n-1]];
  while(st.length){
    const [i0,i1]=st.pop();
    const a=p[i0],b=p[i1],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1e-12;
    let md=0,mi=-1;
    for(let i=i0+1;i<i1;i++){const d=Math.abs((p[i][0]-a[0])*dy-(p[i][1]-a[1])*dx)/L;if(d>md){md=d;mi=i}}
    if(md>eps){keep[mi]=1;st.push([i0,mi],[mi,i1])}
  }
  return p.filter((_,i)=>keep[i]);
}
function simplifyClosed(p,eps){
  if(p.length<8)return p;
  let j=0,md=0;
  for(let i=1;i<p.length;i++){const d=(p[i][0]-p[0][0])**2+(p[i][1]-p[0][1])**2;if(d>md){md=d;j=i}}
  const A=dpArr(p.slice(0,j+1),eps),Bp=dpArr(p.slice(j).concat([p[0]]),eps);
  return A.concat(Bp.slice(1,-1));
}
const inPoly=(pt,poly)=>{
  let c=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])c=!c;
  }
  return c;
};
/* al: Float32Array alfa 0..1 (W×H). Devuelve [{outer, holes}] en mm (CCW/CW), y hacia arriba. */
function maskToGroups(al,W,H,ppm,hx,hy,epsMm=0.03,minArea=0.04){
  const E=(t,x,y)=>(y*W+x)*2+t,adj=new Map();
  const add=(a,b)=>{let l=adj.get(a);if(!l)adj.set(a,l=[]);l.push(b);l=adj.get(b);if(!l)adj.set(b,l=[]);l.push(a)};
  for(let y=0;y<H-1;y++){
    const r1=y*W,r2=r1+W;
    for(let x=0;x<W-1;x++){
      const vtl=al[r1+x],vtr=al[r1+x+1],vbr=al[r2+x+1],vbl=al[r2+x];
      const c=(vtl>=.5?8:0)|(vtr>=.5?4:0)|(vbr>=.5?2:0)|(vbl>=.5?1:0);
      if(c===0||c===15)continue;
      const T=E(0,x,y),Bt=E(0,x,y+1),L=E(1,x,y),R=E(1,x+1,y);
      switch(c){
        case 1:add(L,Bt);break;case 2:add(Bt,R);break;case 3:add(L,R);break;case 4:add(T,R);break;
        case 5:if((vtl+vtr+vbr+vbl)/4>=.5){add(T,L);add(Bt,R)}else{add(T,R);add(L,Bt)}break;
        case 6:add(T,Bt);break;case 7:add(T,L);break;case 8:add(T,L);break;case 9:add(T,Bt);break;
        case 10:if((vtl+vtr+vbr+vbl)/4>=.5){add(T,R);add(L,Bt)}else{add(T,L);add(Bt,R)}break;
        case 11:add(T,R);break;case 12:add(L,R);break;case 13:add(Bt,R);break;case 14:add(L,Bt);break;
      }
    }
  }
  const pointOf=id=>{
    const t=id&1,idx=id>>1,x=idx%W,y=(idx-x)/W;
    if(t===0){const a=al[y*W+x],b=al[y*W+x+1];return [x+(0.5-a)/(b-a),y]}
    const a=al[y*W+x],b=al[(y+1)*W+x];return [x,y+(0.5-a)/(b-a)];
  };
  const seen=new Set(),loops=[];
  for(const start of adj.keys()){
    if(seen.has(start))continue;
    const ids=[];let prev=-1,cur=start,ok=true;
    for(let guard=0;guard<4e6;guard++){
      ids.push(cur);seen.add(cur);
      const nb=adj.get(cur);
      if(!nb||nb.length!==2){ok=false;break}
      const nx=(nb[0]!==prev)?nb[0]:nb[1];
      prev=cur;cur=nx;
      if(cur===start)break;
    }
    if(!ok||ids.length<4)continue;
    let pts=ids.map(id=>{const p=pointOf(id);return [(p[0]+0.5)/ppm-hx,hy-(p[1]+0.5)/ppm]});
    pts=simplifyClosed(pts,epsMm);
    if(pts.length<3||Math.abs(area(pts))<minArea)continue;
    loops.push({pts,a:Math.abs(area(pts))});
  }
  const bb=l=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const p of l.pts){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])}l.b=[x0,y0,x1,y1]};
  loops.forEach(bb);
  const contains=(A,Bl)=>A!==Bl&&A.a>Bl.a&&Bl.b[0]>=A.b[0]&&Bl.b[2]<=A.b[2]&&Bl.b[1]>=A.b[1]&&Bl.b[3]<=A.b[3]&&inPoly(Bl.pts[0],A.pts);
  for(const l of loops){l.par=loops.filter(o=>contains(o,l));l.depth=l.par.length}
  const groups=[],byLoop=new Map();
  for(const l of loops)if(l.depth%2===0){const g={outer:orient(l.pts,true),holes:[]};groups.push(g);byLoop.set(l,g)}
  for(const l of loops)if(l.depth%2===1){
    const p=l.par.filter(o=>o.depth===l.depth-1).sort((a,b)=>a.a-b.a)[0];
    if(p&&byLoop.get(p))byLoop.get(p).holes.push(orient(l.pts,false));
  }
  return groups;
}
function extrudeGroups(B,groups,z0,z1){
  for(const g of groups)extrude(B,{outer:{pts:g.outer,twist:false},holes:g.holes.map(h=>({pts:h,twist:false}))},z0,z1);
}

/* ---------- Medidas y STL sobre sopa de triángulos ---------- */
function soupInfo(pos){
  let vol=0;const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(let i=0;i<pos.length;i+=9){
    for(let k=0;k<9;k++){const c=k%3;mn[c]=Math.min(mn[c],pos[i+k]);mx[c]=Math.max(mx[c],pos[i+k])}
    vol+=(pos[i]*(pos[i+4]*pos[i+8]-pos[i+5]*pos[i+7])+pos[i+1]*(pos[i+5]*pos[i+6]-pos[i+3]*pos[i+8])+pos[i+2]*(pos[i+3]*pos[i+7]-pos[i+4]*pos[i+6]))/6;
  }
  return {tris:pos.length/9,volume:vol/1000,min:mn,max:mx,size:mx.map((v,i)=>v-mn[i])};
}
function offsetSoup(pos,dx,dy,dz){const o=new Float32Array(pos.length);for(let i=0;i<pos.length;i+=3){o[i]=pos[i]+dx;o[i+1]=pos[i+1]+dy;o[i+2]=pos[i+2]+dz}return o}
function concatSoup(...a){const n=a.reduce((s,x)=>s+x.length,0),o=new Float32Array(n);let k=0;for(const x of a){o.set(x,k);k+=x.length}return o}
function soupToSTL(pos){
  const n=pos.length/9,buf=new ArrayBuffer(84+n*50),dv=new DataView(buf);
  new Uint8Array(buf).set(new TextEncoder().encode("Toolkit 3D - millimeters - Z up"));
  dv.setUint32(80,n,true);let o=84;
  for(let i=0;i<pos.length;i+=9){
    const ux=pos[i+3]-pos[i],uy=pos[i+4]-pos[i+1],uz=pos[i+5]-pos[i+2],vx=pos[i+6]-pos[i],vy=pos[i+7]-pos[i+1],vz=pos[i+8]-pos[i+2];
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;
    dv.setFloat32(o,nx/l,true);dv.setFloat32(o+4,ny/l,true);dv.setFloat32(o+8,nz/l,true);o+=12;
    for(let k=0;k<9;k++){dv.setFloat32(o,pos[i+k],true);o+=4}
    o+=2;
  }
  return buf;
}

/* ---------- Tapas de botella (barrido de revolución) ---------- */
function threadA(z,th,pitch){const i=(((z/pitch-th/TAU)%1)+1)%1;return clamp01(Math.min((i-.12)/.25,(.88-i)/.25))}
function clamp01(v){return Math.min(1,Math.max(0,v))}
function sweepRings(rings,seg=192){
  const n=rings.length,P=new Float32Array(n*seg*3);
  for(let i=0;i<n;i++)for(let a=0;a<seg;a++){
    const th=TAU*a/seg,rz=rings[i](th),k=(i*seg+a)*3;
    P[k]=rz[0]*Math.cos(th);P[k+1]=rz[0]*Math.sin(th);P[k+2]=rz[1];
  }
  const out=new Float32Array(n*seg*18);let o=0;
  const put=idx=>{out[o++]=P[idx*3];out[o++]=P[idx*3+1];out[o++]=P[idx*3+2]};
  for(let i=0;i<n;i++){const j=(i+1)%n;
    for(let a=0;a<seg;a++){const b=(a+1)%seg,s=i*seg+a,q=i*seg+b,c=j*seg+b,l=j*seg+a;put(s);put(q);put(c);put(s);put(c);put(l)}}
  return out;
}
function capGeom(p){
  const rc=p.neckA/2,re=p.neckB/2,depth=Math.max(0.05,rc-re);
  return {rc,re,depth,c:p.clearance,Ro:p.capD/2};
}
function capSoup(p,test=false,seg=192){
  const {rc,re,depth,c,Ro}=capGeom(p);
  const Hc=test?p.testH:p.neckE+p.gap,T=test?1.6:p.topT,Ht=Hc+T;
  const outer=th=>p.ribN>0?Ro-p.ribH*0.5*(1-Math.cos(p.ribN*th)):Ro;
  const rg=rc+c+0.1,Lth=Hc-0.8,ch=Math.min(1,T*0.45);
  const R=[th=>[outer(th),0],th=>[outer(th),Ht-ch],th=>[outer(th)-ch,Ht]];
  if(test){R.push(()=>[rg,Ht],()=>[rg,Hc])}
  else{
    const chan=(p.topType==='cone')?Math.max(0.05,p.holeD/2):0.05;
    if(p.topType==='cone'){
      const tipR=Math.max(p.coneTip/2,chan+0.25),baseR=Math.max(p.coneBase/2,tipR);
      R.push(()=>[baseR,Ht],()=>[tipR,Ht+p.coneL],()=>[chan,Ht+p.coneL]);
    }
    else R.push(()=>[chan,Ht]);
    R.push(()=>[chan,Hc]);
    if(p.plug){
      const pr=Math.max(chan+0.4,p.neckC/2-0.15);
      R.push(()=>[chan,Hc-p.plugL],()=>[pr,Hc-p.plugL],()=>[pr,Hc]);
    }
    R.push(()=>[rg,Hc]);
  }
  const nz=Math.ceil(Lth/p.pitch*28);
  for(let k=0;k<=nz;k++){
    const z=Lth*(1-k/nz),lead=(1-clamp01(z/1.0))*0.5;
    R.push(th=>[re+c+depth*threadA(z,th,p.pitch)+lead,z]);
  }
  return sweepRings(R,seg);
}
function ghostSoup(p,seg=96){
  const {rc,re,depth}=capGeom(p);
  const Hc=p.neckE+p.gap,zr=Hc-0.3,zRingTop=zr-p.neckE,zRingBot=zRingTop-2.2,Rb=Math.max(p.ringD/2+3,16),zSh=zRingBot-7,zBot=zSh-34,ringR=p.ringD/2;
  const R=[()=>[0.05,zBot],()=>[Rb,zBot],()=>[Rb,zSh]];
  for(let k=1;k<=6;k++){const t=k/6,e=t*t*(3-2*t);R.push(()=>[Rb+(re+0.8-Rb)*e,zSh+(zRingBot-zSh)*t])}
  R.push(()=>[ringR,zRingBot],()=>[ringR,zRingTop],()=>[re,zRingTop]);
  const z0=zRingTop+0.5,z1=zr-0.8,nz=Math.max(4,Math.ceil((z1-z0)/p.pitch*28));
  for(let k=0;k<=nz;k++){const z=z0+(z1-z0)*k/nz;R.push(th=>[re+depth*threadA(z,th,p.pitch),z])}
  R.push(()=>[re,zr],()=>[p.neckC/2,zr],()=>[p.neckC/2,zr-8],()=>[0.05,zr-8]);
  return {pos:sweepRings(R,seg),zBot};
}
/* ============ /CORE ============ */


const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const store={get(k,d){try{const v=JSON.parse(localStorage.getItem(k)||"null");return v?{...d,...v}:{...d}}catch(e){return {...d}}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
function download(data,name,type){
  const url=URL.createObjectURL(new Blob([data],{type}));
  const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
const slug=t=>(t||"llavero").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"").toLowerCase().slice(0,24)||"llavero";
const num=(v,d=1)=>Number(v).toLocaleString("es-AR",{maximumFractionDigits:d,minimumFractionDigits:0});

/* ---------- Visor 3D común ---------- */
function createViewer(box){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,0.1,4000);camera.up.set(0,0,1);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})}catch(e){box.querySelector(".err").hidden=false;return null}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  box.appendChild(renderer.domElement);
  const orbit=new OrbitControls(camera,renderer.domElement);
  orbit.enableDamping=true;orbit.minDistance=20;orbit.maxDistance=1600;orbit.maxPolarAngle=Math.PI*0.95;
  scene.add(new THREE.HemisphereLight(0xffffff,0xb6c4db,2.4));
  const key=new THREE.DirectionalLight(16774375,3.5);key.position.set(90,-100,520);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-260,right:260,top:260,bottom:-260,near:1,far:1000});
  key.shadow.bias=-2e-5;key.shadow.normalBias=0.04;scene.add(key);
  const fill=new THREE.DirectionalLight(15004415,1.8);fill.position.set(-250,80,250);scene.add(fill);
  const rim=new THREE.DirectionalLight(14740223,2.1);rim.position.set(180,220,280);scene.add(rim);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),new THREE.ShadowMaterial({opacity:0.22}));
  ground.position.z=-0.05;ground.receiveShadow=true;scene.add(ground);
  const group=new THREE.Group();scene.add(group);
  const clock=new THREE.Clock();
  const V={scene,camera,orbit,group,renderer,ground,tick:null,running:false,
    resize(){const w=box.clientWidth,h=box.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()},
    start(){if(V.running)return;V.running=true;clock.getDelta();V.resize();renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),0.1);V.tick&&V.tick(dt);orbit.update();renderer.render(scene,camera)})},
    stop(){V.running=false;renderer.setAnimationLoop(null)},
    fit(){
      const bb=new THREE.Box3();group.updateMatrixWorld(true);
      group.traverse(o=>{if(o.isMesh&&o.visible)bb.expandByObject(o)});
      if(bb.isEmpty())return;
      const size=bb.getSize(new THREE.Vector3()),c=bb.getCenter(new THREE.Vector3());
      const tn=Math.tan(camera.fov*Math.PI/360),asp=camera.aspect||1;
      const d=Math.max(size.z/2/tn,Math.max(size.x,size.y)/2/tn/asp)*1.55;
      camera.position.copy(c).add(new THREE.Vector3(0.9,-1.5,1.1).normalize().multiplyScalar(d));
      orbit.target.copy(c);orbit.update();
    },
    setWire(b){group.traverse(o=>{if(o.isMesh)o.material.wireframe=b})}
  };
  new ResizeObserver(()=>V.resize()).observe(box);
  return V;
}
function soupMesh(pos,color){
  let g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(pos,3));
  g=toCreasedNormals(g,0.62);
  const m=new THREE.Mesh(g,new THREE.MeshPhysicalMaterial({color,roughness:0.62,metalness:0,side:THREE.DoubleSide}));
  m.castShadow=true;return m;
}
function disposeMesh(m){if(!m)return;m.parent&&m.parent.remove(m);m.geometry.dispose();m.material.dispose()}

/* ---------- Panel genérico ---------- */
function buildPanel(root,schema,state,onChange){
  const refs=[];
  for(const g of schema){
    const d=document.createElement("details");d.open=g.open!==false;
    d.innerHTML=`<summary>${g.title}</summary>`;
    for(const f of g.fields){
      const w=document.createElement("div");w.className="field";
      let ctl;
      if(f.t==="range"){
        w.innerHTML=`<div class="lbl"><span>${f.label}</span><span class="numwrap"><input type="number" class="numin" min="${f.min}" max="${f.max}" step="${f.step}" aria-label="${f.label}"><em>${f.unit||""}</em></span></div><input type="range" min="${f.min}" max="${f.max}" step="${f.step}">`;ctl=w.querySelector("input[type=range]");
      }else if(f.t==="select"){
        w.innerHTML=`<label><span>${f.label}</span></label><select>${f.opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select>`;ctl=w.querySelector("select");
      }else if(f.t==="check"){
        w.innerHTML=`<label class="chk"><input type="checkbox"><span>${f.label}</span></label>`;ctl=w.querySelector("input");
      }else if(f.t==="textarea"){
        w.innerHTML=`<label><span>${f.label}</span></label><textarea rows="3" maxlength="60"></textarea>`;ctl=w.querySelector("textarea");
      }else if(f.t==="color"){
        w.innerHTML=`<label><span>${f.label}</span></label><input type="color">`;ctl=w.querySelector("input");
      }
      if(f.hint)w.insertAdjacentHTML("beforeend",`<div class="hint">${f.hint}</div>`);
      ctl.addEventListener("input",()=>{
        state[f.k]=f.t==="range"?Number(ctl.value):f.t==="check"?ctl.checked:ctl.value;
        if(f.t==="select"&&f.num)state[f.k]=Number(ctl.value);
        sync();onChange(f.k);
      });
      const ni=w.querySelector(".numin");
      if(ni){
        ni.addEventListener("input",()=>{const v=parseFloat(ni.value);if(!isFinite(v)||v<f.min||v>f.max)return;state[f.k]=v;sync();onChange(f.k)});
        ni.addEventListener("change",()=>{let v=parseFloat(ni.value);if(!isFinite(v))v=state[f.k];state[f.k]=Math.min(f.max,Math.max(f.min,v));sync();onChange(f.k)});
      }
      refs.push({f,w,ctl,ni});d.append(w);
    }
    root.append(d);
  }
  function sync(){
    for(const {f,w,ctl,ni} of refs){
      const v=state[f.k];
      if(f.t==="check")ctl.checked=!!v;else ctl.value=v;
      if(f.t==="range"){
        if(ni&&document.activeElement!==ni)ni.value=String(+Number(v).toFixed(2));
        ctl.style.setProperty("--p",((v-f.min)/(f.max-f.min)*100)+"%");
      }
      w.hidden=f.show?!f.show(state):false;
    }
  }
  sync();
  return {sync};
}

/* =====================================================
   ENGRANAJES
   ===================================================== */
const GEAR_DEF={type:"spur",module:2,teeth:24,alpha:20,thickness:8,helix:20,backlash:0.1,
  pair:true,mateTeeth:16,animate:true,speed:1,
  boreType:"round",boreD:5,boreClear:0.1,keyW:2,keyD:1,hubD:14,hubH:6,lightN:5,lightFrac:0.8,ringWall:6,
  color:"#e7b86b",mateColor:"#2b6f78"};
const GKEY="tk3d-gear-v1";
let G=store.get(GKEY,GEAR_DEF);
const isRing=s=>s.type==="ring";
const hasHelix=s=>s.type==="helical"||s.type==="herringbone"||s.type==="ring";
const GEAR_SCHEMA=[
 {title:"Engranaje",fields:[
  {k:"type",t:"select",label:"Tipo",opts:[["spur","Recto"],["helical","Helicoidal"],["herringbone","Espina de pez"],["ring","Corona interna"]]},
  {k:"module",t:"range",label:"Módulo",min:0.5,max:6,step:0.25,unit:"mm",hint:"Tamaño del diente. Más módulo = dientes más grandes y fuertes."},
  {k:"teeth",t:"range",label:"Cantidad de dientes",min:8,max:120,step:1},
  {k:"alpha",t:"select",num:1,label:"Ángulo de presión",opts:[[14.5,"14,5°"],[20,"20° (estándar)"],[25,"25° (más resistente)"]]},
  {k:"thickness",t:"range",label:"Espesor",min:2,max:40,step:0.5,unit:"mm"},
  {k:"helix",t:"range",label:"Ángulo de hélice",min:5,max:35,step:1,unit:"°",show:s=>hasHelix(s)},
  {k:"backlash",t:"range",label:"Holgura de diente",min:0,max:0.5,step:0.02,unit:"mm",hint:"Por flanco, para compensar la tolerancia de la impresora."},
  {k:"ringWall",t:"range",label:"Pared de la corona",min:3,max:20,step:0.5,unit:"mm",show:isRing}]},
 {title:"Pareja engranada",fields:[
  {k:"pair",t:"check",label:"Mostrar engranaje pareja"},
  {k:"mateTeeth",t:"range",label:"Dientes de la pareja",min:8,max:120,step:1,show:s=>s.pair},
  {k:"animate",t:"check",label:"Animar giro",show:s=>s.pair},
  {k:"speed",t:"range",label:"Velocidad",min:0.2,max:3,step:0.1,unit:"×",show:s=>s.pair&&s.animate}]},
 {title:"Eje, cubo y aligerado",open:true,fields:[
  {k:"boreType",t:"select",label:"Tipo de eje",opts:[["round","Redondo"],["D","Plano en D (motor)"],["key","Con chavetero"]],show:s=>!isRing(s)},
  {k:"boreD",t:"range",label:"Diámetro del eje",min:0,max:30,step:0.5,unit:"mm",hint:"0 = sin agujero.",show:s=>!isRing(s)},
  {k:"boreClear",t:"range",label:"Holgura del eje",min:0,max:0.4,step:0.05,unit:"mm",show:s=>!isRing(s)&&s.boreD>0},
  {k:"keyW",t:"range",label:"Ancho del chavetero",min:1,max:8,step:0.5,unit:"mm",show:s=>!isRing(s)&&s.boreType==="key"},
  {k:"keyD",t:"range",label:"Profundidad del chavetero",min:0.5,max:4,step:0.25,unit:"mm",show:s=>!isRing(s)&&s.boreType==="key"},
  {k:"hubD",t:"range",label:"Diámetro del cubo",min:0,max:60,step:1,unit:"mm",hint:"0 = sin cubo.",show:s=>!isRing(s)},
  {k:"hubH",t:"range",label:"Altura del cubo",min:0,max:30,step:1,unit:"mm",show:s=>!isRing(s)&&s.hubD>0},
  {k:"lightN",t:"range",label:"Agujeros de aligerado",min:0,max:12,step:1,show:s=>!isRing(s)},
  {k:"lightFrac",t:"range",label:"Tamaño de los agujeros",min:0.4,max:0.95,step:0.05,show:s=>!isRing(s)&&s.lightN>0}]},
 {title:"Colores",open:false,fields:[
  {k:"color",t:"color",label:"Engranaje principal"},{k:"mateColor",t:"color",label:"Pareja"}]}
];
const GEAR_PRESETS={
 "Par recto":{type:"spur",teeth:24,mateTeeth:16,module:2,thickness:8,pair:true},
 "Reducción 1:3":{type:"spur",teeth:15,mateTeeth:45,module:2,thickness:8,lightN:5,pair:true},
 "Helicoidal":{type:"helical",teeth:24,mateTeeth:16,module:2,helix:20,thickness:10,pair:true},
 "Espina de pez":{type:"herringbone",teeth:28,mateTeeth:16,module:2,helix:25,thickness:12,pair:true},
 "Corona interna":{type:"ring",teeth:40,mateTeeth:16,module:2,helix:20,thickness:8,ringWall:6,pair:true},
 "Motor 5 mm":{type:"spur",teeth:20,mateTeeth:40,module:1.5,thickness:6,boreType:"D",boreD:5,hubD:12,hubH:5,lightN:0,pair:true}
};
const gv=createViewer($("#gearVp"));
let gMain=null,gMate=null,gData=null,gTheta=0,gDirty=true,gFitNext=true;
function gearSpec(over={}){
  const s=G,al=s.alpha*PI/180;
  const common={m:s.module,alpha:al,T:s.thickness,backlash:s.backlash,beta:hasHelix(s)&&s.type!=="spur"?s.helix*PI/180:0,herring:s.type==="herringbone",
    boreType:s.boreType,boreD:s.boreD,boreClear:s.boreClear,keyW:s.keyW,keyD:s.keyD,hubD:s.hubD,hubH:s.hubH,lightN:s.lightN,lightFrac:s.lightFrac,ringWall:s.ringWall};
  const main={...common,z:s.teeth,internal:isRing(s),sign:1};
  const mate={...common,z:s.mateTeeth,internal:false,sign:isRing(s)?1:-1};
  return {main,mate};
}
function gearRebuild(){
  gDirty=false;
  const {main,mate}=gearSpec();
  const t0=performance.now();
  const pm=buildGear(main);
  gData={main:pm,mate:G.pair?buildGear(mate):null};
  disposeMesh(gMain);disposeMesh(gMate);gMain=gMate=null;
  if(gv){
    gMain=soupMesh(gData.main,G.color);gv.group.add(gMain);
    if(gData.mate){gMate=soupMesh(gData.mate,G.mateColor);gv.group.add(gMate)}
    placeGears();
    gv.setWire($("#gearWire").checked);
    if(gFitNext){gv.fit();gFitNext=false}
  }
  gearInfo(performance.now()-t0);
}
function centerDist(){return isRing(G)?G.module*(G.teeth-G.mateTeeth)/2:G.module*(G.teeth+G.mateTeeth)/2}
function placeGears(){
  if(!gMain)return;
  if(gMate)gMate.position.set(centerDist(),0,0);
  poseGears();
}
function poseGears(){
  if(!gMain)return;
  if(!gMate){gMain.rotation.z=gTheta;return}
  if(isRing(G)){ // el piñón es el motriz
    gMate.rotation.z=gTheta;gMain.rotation.z=gTheta*G.mateTeeth/G.teeth;
  }else{
    gMain.rotation.z=gTheta;
    gMate.rotation.z=PI-PI/G.mateTeeth-gTheta*G.teeth/G.mateTeeth;
  }
}
function gearInfo(ms){
  const m=G.module,al=G.alpha*PI/180,z=G.teeth;
  const rp=m*z/2,ra=isRing(G)?rp-m:rp+m,rf=isRing(G)?rp+1.25*m:rp-1.25*m;
  const rows=[["Diámetro primitivo",num(2*rp,2)+" mm"],
    [isRing(G)?"Diámetro interior (cabeza)":"Diámetro exterior",num(2*ra,2)+" mm"],
    [isRing(G)?"Diámetro de raíz":"Diámetro de raíz",num(2*rf,2)+" mm"],
    ["Diámetro base",num(2*rp*Math.cos(al),2)+" mm"],
    ["Paso circular",num(PI*m,2)+" mm"]];
  if(isRing(G))rows.push(["Diámetro exterior",num(2*(rp+1.25*m+G.ringWall),1)+" mm"]);
  if(G.pair){
    rows.push(["Distancia entre centros",num(centerDist(),2)+" mm"]);
    rows.push(["Relación (pareja/principal)",num(G.mateTeeth/G.teeth,3)+" : 1"]);
  }
  const i=soupInfo(gData.main);
  rows.push(["Triángulos (principal)",num(i.tris,0)]);
  $("#gearStats").innerHTML=rows.map(([a,b])=>`<dt>${a}</dt><dd>${b}</dd>`).join("");
  const w=[];
  const zmin=Math.round(2/Math.sin(al)**2*0.82);
  if(!isRing(G)&&G.teeth<zmin)w.push(`Con ${G.teeth} dientes y ${G.alpha}° hay socavado en la raíz (mínimo práctico: ${zmin}). Subí los dientes o el ángulo.`);
  if(G.pair&&!isRing(G)&&G.mateTeeth<zmin)w.push(`La pareja tiene pocos dientes (mínimo práctico: ${zmin}).`);
  if(isRing(G)&&G.pair&&G.teeth-G.mateTeeth<8)w.push("La corona y el piñón difieren en menos de 8 dientes: puede haber interferencia.");
  if(isRing(G)&&G.pair&&G.mateTeeth<zmin)w.push(`El piñón tiene pocos dientes (mínimo práctico: ${zmin}).`);
  if(m<1)w.push("Módulo menor a 1 mm: los dientes quedan finos para una boquilla de 0,4 mm.");
  if(!isRing(G)&&G.boreD>0&&G.hubD===0&&G.boreD>G.module*G.teeth/2-3)w.push("El eje es muy grande para este engranaje.");
  $("#gearWarn").innerHTML=w.map(t=>`<div class="warn">${t}</div>`).join("");
  $("#gearMatePart").hidden=!G.pair;
  $("#gearStatus").textContent=`Modelo generado en ${Math.round(ms)} ms · medidas en milímetros`;
}
function gearChanged(k){
  store.set(GKEY,G);
  if(k==="pair")gFitNext=true;
  if(k==="color"||k==="mateColor"){if(gMain)gMain.material.color.set(G.color);if(gMate)gMate.material.color.set(G.mateColor);return}
  if(k==="animate"||k==="speed")return;
  gDirty=true;
}
const gearPanelApi={sync(){$("#gearPanel").innerHTML="";buildPanel($("#gearPanel"),GEAR_SCHEMA,G,gearChanged)}};
gearPanelApi.sync();
$("#gearPresets").innerHTML=Object.keys(GEAR_PRESETS).map(n=>`<button data-gp="${n}">${n}</button>`).join("");
$("#gearPresets").addEventListener("click",e=>{
  const b=e.target.closest("[data-gp]");if(!b)return;
  Object.assign(G,GEAR_DEF,GEAR_PRESETS[b.dataset.gp]);store.set(GKEY,G);gearPanelApi.sync();gFitNext=true;gDirty=true;
});
$("#gearReset").onclick=()=>{Object.assign(G,GEAR_DEF);store.set(GKEY,G);gearPanelApi.sync();gFitNext=true;gDirty=true};
$("#gearFit").onclick=()=>gv&&gv.fit();
$("#gearWire").onchange=()=>gv&&gv.setWire($("#gearWire").checked);
if(gv)gv.tick=dt=>{
  if(gDirty)gearRebuild();
  if(G.pair&&G.animate&&gMain){gTheta+=dt*1.2*G.speed/(isRing(G)?1:Math.max(1,G.teeth/G.mateTeeth));poseGears()}
};
$$("[data-gx]").forEach(b=>b.onclick=()=>{
  try{
    if(gDirty||!gData)gearRebuild();
    const tag=`m${num(G.module,2).replace(",",".")}`;
    let pos,name;
    if(b.dataset.gx==="main"){pos=gData.main;name=`${isRing(G)?"corona":"engranaje"}-${G.type}-z${G.teeth}-${tag}.stl`}
    else if(b.dataset.gx==="mate"){pos=gData.mate;name=`pinon-z${G.mateTeeth}-${tag}.stl`}
    else{
      const a=soupInfo(gData.main),c=soupInfo(gData.mate);
      pos=concatSoup(offsetSoup(gData.main,-a.max[0]-3,0,0),offsetSoup(gData.mate,-c.min[0]+3,0,0));
      name=`par-z${G.teeth}-z${G.mateTeeth}-${tag}.stl`;
    }
    download(soupToSTL(pos),name,"model/stl");
    $("#gearStatus").textContent="STL descargado: "+name;
  }catch(e){$("#gearStatus").textContent="No se pudo exportar: "+e.message}
});

/* =====================================================
   LLAVEROS
   ===================================================== */
const FONTS={
  rubik:['800 {s}px "Rubik", "Arial Black", sans-serif',"Rubik · negrita"],
  fredoka:['600 {s}px "Fredoka", "Trebuchet MS", sans-serif',"Fredoka · redondeada"],
  bungee:['400 {s}px "Bungee", Impact, sans-serif',"Bungee · bloque"],
  slab:['800 {s}px "Roboto Slab", Georgia, serif',"Roboto Slab · serif"],
  pacifico:['400 {s}px "Pacifico", "Brush Script MT", cursive',"Pacifico · manuscrita"],
  lobster:['400 {s}px "Lobster", "Brush Script MT", cursive',"Lobster · cursiva"],
  marker:['400 {s}px "Permanent Marker", "Comic Sans MS", cursive',"Marcador"],
  impact:['400 {s}px Impact, "Arial Black", sans-serif',"Impact · sistema"],
  mono:['700 {s}px "Courier New", monospace',"Monoespaciada"]
};
const KEY_DEF={text:"LLAVERO",font:"rubik",fontSize:10,textMode:"raised",textHeight:1.2,
  shape:"pill",height:22,minWidth:40,padding:4,corner:4,thickness:3,rim:0,
  eyePos:"left",eyeStyle:"tab",holeD:5,eyeWall:2.5,baseColor:"#12264A",textColor:"#F5B41A",quality:10};
const KKEY="tk3d-key-v1";
let K=store.get(KKEY,KEY_DEF);
const squareShape=s=>["circle","hex","heart","star"].includes(s.shape);
const KEY_SCHEMA=[
 {title:"Texto",fields:[
  {k:"text",t:"textarea",label:"Texto (hasta 3 líneas)"},
  {k:"font",t:"select",label:"Tipografía",opts:Object.entries(FONTS).map(([v,a])=>[v,a[1]])},
  {k:"fontSize",t:"range",label:"Tamaño de letra",min:5,max:30,step:0.5,unit:"mm"},
  {k:"textMode",t:"select",label:"Estilo",opts:[["raised","Relieve"],["engraved","Grabado"],["cut","Calado (atraviesa)"]]},
  {k:"textHeight",t:"range",label:"Altura / profundidad",min:0.4,max:3,step:0.1,unit:"mm",show:s=>s.textMode!=="cut"}]},
 {title:"Placa",fields:[
  {k:"shape",t:"select",label:"Forma",opts:[["round","Rectángulo redondeado"],["pill","Cápsula"],["tag","Chapa militar"],["circle","Círculo"],["hex","Hexágono"],["heart","Corazón"],["star","Estrella"]]},
  {k:"height",t:"range",label:"Alto mínimo",min:12,max:70,step:1,unit:"mm"},
  {k:"minWidth",t:"range",label:"Ancho mínimo",min:20,max:120,step:1,unit:"mm",show:s=>!squareShape(s)},
  {k:"padding",t:"range",label:"Margen del texto",min:2,max:12,step:0.5,unit:"mm"},
  {k:"corner",t:"range",label:"Radio de esquinas",min:0,max:15,step:0.5,unit:"mm",show:s=>s.shape==="round"},
  {k:"thickness",t:"range",label:"Espesor de la placa",min:1.5,max:8,step:0.1,unit:"mm"},
  {k:"rim",t:"range",label:"Borde elevado",min:0,max:3,step:0.2,unit:"mm",hint:"0 = sin borde. Usa la altura del texto."}]},
 {title:"Ojal",fields:[
  {k:"eyePos",t:"select",label:"Posición",opts:[["left","Izquierda"],["right","Derecha"],["top","Arriba"],["none","Sin ojal"]]},
  {k:"eyeStyle",t:"select",label:"Tipo",opts:[["tab","Orejeta saliente"],["inside","Dentro de la placa"]],show:s=>s.eyePos!=="none"&&!squareShape(s)},
  {k:"holeD",t:"range",label:"Diámetro del agujero",min:3,max:10,step:0.5,unit:"mm",show:s=>s.eyePos!=="none"},
  {k:"eyeWall",t:"range",label:"Pared alrededor",min:1.5,max:5,step:0.25,unit:"mm",show:s=>s.eyePos!=="none"}]},
 {title:"Colores y calidad",open:false,fields:[
  {k:"baseColor",t:"color",label:"Color de la base"},{k:"textColor",t:"color",label:"Color del texto y borde"},
  {k:"quality",t:"select",num:1,label:"Resolución del contorno",opts:[[8,"Rápida"],[10,"Estándar"],[14,"Fina"]]}]}
];
const KEY_PRESETS={
 "Nombre":{text:"SEBAS",shape:"pill",font:"rubik",fontSize:11,textMode:"raised",eyePos:"left",eyeStyle:"tab"},
 "Chapa":{text:"NOMBRE\n11 0000 0000",shape:"tag",font:"slab",fontSize:6,height:30,textMode:"raised",eyePos:"left",eyeStyle:"inside",rim:0.8},
 "Mascota":{text:"LUNA\n11 0000 0000",shape:"circle",font:"fredoka",fontSize:7,textMode:"raised",eyePos:"top",rim:1},
 "Corazón":{text:"TE\nQUIERO",shape:"heart",font:"pacifico",fontSize:8,textMode:"raised",eyePos:"top"},
 "Estrella":{text:"TOP",shape:"star",font:"bungee",fontSize:8,textMode:"raised",eyePos:"top"},
 "Calado":{text:"HOME",shape:"round",font:"bungee",fontSize:9,textMode:"cut",eyePos:"left",eyeStyle:"inside"}
};
function shapePath(ctx,sh,w,h,corner){
  ctx.beginPath();
  if(sh==="round")ctx.roundRect(-w/2,-h/2,w,h,Math.min(corner,w/2,h/2));
  else if(sh==="pill")ctx.roundRect(-w/2,-h/2,w,h,Math.min(w,h)/2);
  else if(sh==="circle")ctx.ellipse(0,0,w/2,h/2,0,0,TAU);
  else if(sh==="hex"){for(let i=0;i<6;i++){const a=PI/3*i,x=w/2*Math.cos(a),y=h/2*Math.sin(a);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()}
  else if(sh==="tag"){
    const c=h*0.28,r=Math.min(corner+3,h*0.25);
    ctx.moveTo(-w/2+c,-h/2);ctx.lineTo(w/2-r,-h/2);ctx.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
    ctx.lineTo(w/2,h/2-r);ctx.quadraticCurveTo(w/2,h/2,w/2-r,h/2);ctx.lineTo(-w/2+c,h/2);
    ctx.lineTo(-w/2,h/2-c);ctx.lineTo(-w/2,-h/2+c);ctx.closePath();
  }else if(sh==="heart"){
    const s=w/2,P=(x,y)=>[x*s,y*s];
    const mv=(x,y)=>ctx.moveTo(...P(x,y)),bz=(a,b,c,d,e,f)=>ctx.bezierCurveTo(...P(a,b),...P(c,d),...P(e,f));
    mv(0,0.9);bz(-0.2,0.7,-1,0.2,-1,-0.3);bz(-1,-0.8,-0.4,-1,0,-0.55);bz(0.4,-1,1,-0.8,1,-0.3);bz(1,0.2,0.2,0.7,0,0.9);ctx.closePath();
  }else if(sh==="star"){
    for(let i=0;i<10;i++){const a=-PI/2+PI/5*i,r=(i%2?0.5:1)*w/2,x=r*Math.cos(a),y=r*Math.sin(a);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();
  }
}
let kBuild=0,kData=null,kBase=null,kRelief=null,kTimer=0;
const kv=createViewer($("#keyVp"));
async function keyBuild(p,ppm){
  const lines=p.text.split("\n").map(s=>s.trimEnd()).filter((s,i)=>s.length||i===0).slice(0,3);
  if(!lines.join("").trim())lines[0]=" ";
  const fpx=p.fontSize*ppm,fontStr=FONTS[p.font][0].replace("{s}",fpx.toFixed(1));
  try{await document.fonts.load(fontStr,lines.join(""))}catch(e){}
  const mc=document.createElement("canvas").getContext("2d");mc.font=fontStr;
  const lh=p.fontSize*1.12;
  const tw=Math.max(...lines.map(l=>mc.measureText(l).width))/ppm;
  const th=(lines.length-1)*lh+p.fontSize*0.78;
  const R=p.holeD/2+p.eyeWall,pad=p.padding,diag=Math.hypot(tw,th)+2*pad;
  let w,h;
  if(p.shape==="circle"||p.shape==="hex")w=h=Math.max(diag,p.height);
  else if(p.shape==="heart")w=h=Math.max(diag*1.35,p.height);
  else if(p.shape==="star")w=h=Math.max(diag*1.9,p.height);
  else{w=Math.max(p.minWidth,tw+2*pad);h=Math.max(p.height,th+2*pad);if(p.shape==="pill")w=Math.max(w,tw+h*0.7)}
  const sq=squareShape(p),inside=!sq&&p.eyeStyle==="inside"&&p.eyePos!=="none";
  let tx=0,ty=0;
  if(inside){
    if(p.eyePos==="left"){w+=2*R;tx=R}else if(p.eyePos==="right"){w+=2*R;tx=-R}else if(p.eyePos==="top"){h+=2*R;ty=R}
  }
  if(p.shape==="heart")ty+=-h*0.04;
  const hx=w/2+2*R+3,hy=h/2+2*R+3,W=Math.ceil(2*hx*ppm),H=Math.ceil(2*hy*ppm);
  const mk=()=>{const c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");x.setTransform(ppm,0,0,ppm,hx*ppm,hy*ppm);return [c,x]};
  const reset=x=>x.setTransform(ppm,0,0,ppm,hx*ppm,hy*ppm);
  // posición del ojal
  let ex=0,ey=0;
  if(p.eyePos!=="none"){
    if(inside){
      if(p.eyePos==="left"){ex=-w/2+R+1}else if(p.eyePos==="right"){ex=w/2-R-1}else{ey=-h/2+R+1}
    }else{
      const off=R*0.55;
      if(p.eyePos==="left")ex=-w/2-off;else if(p.eyePos==="right")ex=w/2+off;
      else{ey=-h/2-off;if(p.shape==="heart")ey=-(h/2)*0.62-R*0.35;if(p.shape==="star")ey=-h/2-R*0.35}
    }
  }
  // base
  const [cb,xb]=mk();
  xb.fillStyle="#000";shapePath(xb,p.shape,w,h,p.corner);xb.fill();
  if(p.eyePos!=="none"){
    if(!inside){xb.beginPath();xb.arc(ex,ey,R,0,TAU);xb.fill()}
    xb.globalCompositeOperation="destination-out";xb.beginPath();xb.arc(ex,ey,p.holeD/2,0,TAU);xb.fill();xb.globalCompositeOperation="source-over";
  }
  // texto
  const [ct,xt]=mk();
  xt.font=FONTS[p.font][0].replace("{s}",p.fontSize);xt.textAlign="center";xt.textBaseline="middle";xt.fillStyle="#000";
  const y0=ty-((lines.length-1)*lh)/2;
  lines.forEach((l,i)=>xt.fillText(l,tx,y0+i*lh+p.fontSize*0.04));
  xt.globalCompositeOperation="destination-in";shapePath(xt,p.shape,w,h,p.corner);xt.fill();xt.globalCompositeOperation="source-over";
  // borde
  const [cr,xr]=mk();
  if(p.rim>0){
    xr.save();shapePath(xr,p.shape,w,h,p.corner);xr.clip();
    xr.lineWidth=2*p.rim;xr.strokeStyle="#000";xr.lineJoin="round";shapePath(xr,p.shape,w,h,p.corner);xr.stroke();xr.restore();
    if(p.eyePos!=="none"){xr.globalCompositeOperation="destination-out";xr.beginPath();xr.arc(ex,ey,R+0.6,0,TAU);xr.fill();xr.globalCompositeOperation="source-over"}
  }
  const alpha=c=>{const d=c.getContext("2d",{willReadFrequently:true}).getImageData(0,0,W,H).data,a=new Float32Array(W*H);for(let i=0;i<a.length;i++)a[i]=d[i*4+3]/255;return a};
  const t=p.thickness,hgt=p.textHeight;
  const B=new TriBuf(),Rl=new TriBuf();
  const aBase=alpha(cb),aText=alpha(ct),aRim=p.rim>0?alpha(cr):null;
  const tr=a=>maskToGroups(a,W,H,ppm,hx,hy,0.03,0.04);
  if(p.textMode==="raised"){
    extrudeGroups(B,tr(aBase),0,t);
    const u=new Float32Array(W*H);for(let i=0;i<u.length;i++)u[i]=Math.max(aText[i],aRim?aRim[i]:0);
    extrudeGroups(Rl,tr(u),t-0.2,t+hgt);
  }else{
    const sub=new Float32Array(W*H);for(let i=0;i<sub.length;i++)sub[i]=Math.max(0,aBase[i]-aText[i]);
    const gSub=tr(sub);
    if(p.textMode==="cut"){extrudeGroups(B,gSub,0,t)}
    else{const d=Math.min(hgt,t-0.6);extrudeGroups(B,tr(aBase),0,t-d);extrudeGroups(B,gSub,t-d-0.02,t)}
    if(aRim)extrudeGroups(Rl,tr(aRim),t-0.2,t+Math.max(hgt,0.8));
  }
  return {base:B.pos,relief:Rl.pos,w,h,tw,th,lines:lines.length};
}
function keyShow(msg){const b=$("#keyVp .busy");b.hidden=!msg;if(msg)b.textContent=msg}
async function keyRefresh(fit=false){
  const id=++kBuild;keyShow("Generando…");
  await new Promise(r=>setTimeout(r,30));
  try{
    const t0=performance.now();
    const d=await keyBuild(K,8);
    if(id!==kBuild)return;
    kData=d;
    if(kv){
      disposeMesh(kBase);disposeMesh(kRelief);kBase=kRelief=null;
      kBase=soupMesh(d.base,K.baseColor);kv.group.add(kBase);
      if(d.relief.length){kRelief=soupMesh(d.relief,K.textColor);kv.group.add(kRelief)}
      kv.setWire($("#keyWire").checked);
      if(fit)kv.fit();
    }
    keyInfo(performance.now()-t0);
  }catch(e){console.error(e);$("#keyStatus").textContent="No se pudo generar: "+e.message}
  if(id===kBuild)keyShow("");
}
function keyInfo(ms){
  const all=concatSoup(kData.base,kData.relief),i=soupInfo(all);
  $("#keyStats").innerHTML=[["Tamaño total",i.size.map(v=>num(v,1)).join(" × ")+" mm"],["Placa",`${num(kData.w,1)} × ${num(kData.h,1)} mm`],
    ["Espesor total",num(i.size[2],1)+" mm"],["Volumen aprox.",num(i.volume,1)+" cm³"],["Triángulos",num(i.tris,0)]].map(([a,b])=>`<dt>${a}</dt><dd>${b}</dd>`).join("");
  const w=[];
  if(K.fontSize<6&&K.textMode!=="raised")w.push("Con letras menores a 6 mm el grabado y el calado pueden perder detalle.");
  if(K.fontSize<5)w.push("Las letras muy chicas pueden no salir con boquilla de 0,4 mm.");
  if(K.textMode==="cut"&&/[OAQPRBDeaobdpq@%&]/.test(K.text))w.push("En el calado, el interior de letras como O, A o B queda suelto. Elegí una tipografía tipo stencil o usá relieve.");
  if(K.eyePos!=="none"&&K.eyeWall<2)w.push("Pared del ojal menor a 2 mm: puede romperse con el uso.");
  $("#keyWarn").innerHTML=w.map(t=>`<div class="warn">${t}</div>`).join("");
  $("#keyReliefBtn").disabled=!kData.relief.length;
  $("#keyStatus").textContent=`Vista previa en ${Math.round(ms)} ms · la exportación usa la resolución elegida`;
}
function keyChanged(k){
  store.set(KKEY,K);
  if(k==="baseColor"||k==="textColor"){if(kBase)kBase.material.color.set(K.baseColor);if(kRelief)kRelief.material.color.set(K.textColor);return}
  clearTimeout(kTimer);kTimer=setTimeout(()=>keyRefresh(false),160);
}
const keyPanelApi=(()=>({sync(){$("#keyPanel").innerHTML="";buildPanel($("#keyPanel"),KEY_SCHEMA,K,keyChanged)}}))();
keyPanelApi.sync();
$("#keyPresets").innerHTML=Object.keys(KEY_PRESETS).map(n=>`<button data-kp="${n}">${n}</button>`).join("");
$("#keyPresets").addEventListener("click",e=>{
  const b=e.target.closest("[data-kp]");if(!b)return;
  Object.assign(K,KEY_DEF,KEY_PRESETS[b.dataset.kp]);store.set(KKEY,K);keyPanelApi.sync();keyRefresh(true);
});
$("#keyReset").onclick=()=>{Object.assign(K,KEY_DEF);store.set(KKEY,K);keyPanelApi.sync();keyRefresh(true)};
$("#keyFit").onclick=()=>kv&&kv.fit();
$("#keyWire").onchange=()=>kv&&kv.setWire($("#keyWire").checked);
$$("[data-kx]").forEach(b=>b.onclick=async()=>{
  const which=b.dataset.kx;
  $("#keyStatus").textContent="Generando STL en resolución "+(K.quality>=14?"fina":K.quality>=10?"estándar":"rápida")+"…";
  await new Promise(r=>setTimeout(r,30));
  try{
    const d=await keyBuild(K,K.quality),n=slug(K.text.split("\n")[0]);
    let pos,name;
    if(which==="base"){pos=d.base;name=`llavero-${n}-base.stl`}
    else if(which==="relief"){pos=d.relief;name=`llavero-${n}-texto.stl`}
    else{pos=concatSoup(d.base,d.relief);name=`llavero-${n}.stl`}
    download(soupToSTL(pos),name,"model/stl");
    $("#keyStatus").textContent="STL descargado: "+name;
  }catch(e){$("#keyStatus").textContent="No se pudo exportar: "+e.message}
});


/* =====================================================
   TAPAS DE BOTELLA
   ===================================================== */
const CAP_DEF={neckA:17.2,neckB:16,neckC:12,pitch:3.3,neckE:11,ringD:19.6,
  clearance:0.2,capD:22,topT:2.2,gap:0.8,ribN:24,ribH:0.6,
  topType:"cone",coneBase:14,coneTip:7,coneL:9,holeD:1.7,plug:true,plugL:5,
  testH:6,ghost:true,lift:0,color:"#2b6f78"};
const CKEY="tk3d-cap-v1";
let C=store.get(CKEY,CAP_DEF);
const CAP_SCHEMA=[
 {title:"Cuello del frasco (tus medidas)",fields:[
  {k:"neckA",t:"range",label:"A · Ø exterior de la rosca",min:8,max:45,step:0.1,unit:"mm",hint:"De cresta a cresta."},
  {k:"neckB",t:"range",label:"B · Ø en el fondo del filete",min:7,max:44,step:0.1,unit:"mm"},
  {k:"neckC",t:"range",label:"C · Ø interior de la boca",min:4,max:40,step:0.1,unit:"mm"},
  {k:"pitch",t:"range",label:"D · Paso de rosca",min:1.5,max:8,step:0.05,unit:"mm"},
  {k:"neckE",t:"range",label:"E · Altura del cuello libre",min:4,max:30,step:0.1,unit:"mm",hint:"De la boca al anillo de apoyo."},
  {k:"ringD",t:"range",label:"G · Ø del anillo de apoyo",min:10,max:60,step:0.1,unit:"mm",hint:"Solo para la vista de referencia."}]},
 {title:"Tapa",fields:[
  {k:"capD",t:"range",label:"Ø exterior de la tapa",min:14,max:60,step:0.5,unit:"mm"},
  {k:"topT",t:"range",label:"Espesor del techo",min:1.5,max:6,step:0.1,unit:"mm"},
  {k:"clearance",t:"range",label:"Holgura de rosca (radial)",min:0.05,max:0.5,step:0.05,unit:"mm"},
  {k:"gap",t:"range",label:"Luz contra el anillo",min:0,max:3,step:0.1,unit:"mm",hint:"Espacio entre el borde de la tapa y el anillo del frasco al cerrar."},
  {k:"ribN",t:"range",label:"Estrías de agarre",min:0,max:48,step:1,hint:"0 = pared lisa."},
  {k:"ribH",t:"range",label:"Profundidad de estrías",min:0.2,max:1.5,step:0.1,unit:"mm",show:s=>s.ribN>0}]},
 {title:"Remate",fields:[
  {k:"topType",t:"select",label:"Tipo",opts:[["cone","Con cono (aguja o gotero)"],["flat","Plana (tapa ciega)"]]},
  {k:"coneBase",t:"range",label:"Ø de la base del cono",min:2,max:30,step:0.1,unit:"mm",show:s=>s.topType==="cone"},
  {k:"coneTip",t:"range",label:"Ø de la punta del cono",min:1.5,max:25,step:0.1,unit:"mm",show:s=>s.topType==="cone"},
  {k:"coneL",t:"range",label:"Largo del cono",min:1,max:30,step:0.5,unit:"mm",show:s=>s.topType==="cone"},
  {k:"holeD",t:"range",label:"Ø del orificio",min:0.2,max:6,step:0.05,unit:"mm",hint:"Ø de la aguja más 0,1 a 0,2 mm para que entre justa. Para gotero, 1 a 1,5 mm.",show:s=>s.topType==="cone"},
  {k:"plug",t:"check",label:"Tapón interior que sella la boca"},
  {k:"plugL",t:"range",label:"Largo del tapón",min:2,max:10,step:0.5,unit:"mm",show:s=>s.plug}]},
 {title:"Vista",open:false,fields:[
  {k:"ghost",t:"check",label:"Mostrar frasco de referencia"},
  {k:"lift",t:"select",num:1,label:"Posición de la tapa",opts:[[0,"Puesta en el frasco"],[24,"Separada"]]},
  {k:"color",t:"color",label:"Color de la tapa"},
  {k:"testH",t:"range",label:"Altura del anillo de prueba",min:4,max:12,step:0.5,unit:"mm"}]}
];
const CAP_PRESETS={
 "Aguja (IPA)":{topType:"cone",coneBase:14,coneTip:7,coneL:9,holeD:1.7,plug:true},
 "Gotero":{topType:"cone",coneBase:10,coneTip:6,coneL:5,holeD:1.2,plug:false},
 "Pico fino":{topType:"cone",coneBase:9,coneTip:4,coneL:14,holeD:1,plug:false},
 "Pico ancho":{topType:"cone",coneBase:14,coneTip:8,coneL:12,holeD:3.5,plug:false},
 "Tapa ciega":{topType:"flat",plug:true}
};
const TOP_KEYS=["topType","coneBase","coneTip","coneL","holeD","plug","plugL"];
/* Roscas conocidas. T/E/H de tablas publicadas (SGS Bottle, Evergreen Resources); el paso NO figura en esas
   tablas: se estima en 3,2 mm (≈8 hilos/pulgada) y conviene medirlo. */
const THREADS=[
 {g:"Medido por vos",id:"mine",name:"Mi frasco 50 ml (aguja)",v:{neckA:17.2,neckB:16,neckC:12,pitch:3.3,neckE:11,ringD:19.6,capD:22},hint:"Medidas tomadas con calibre."},
 {g:"Gaseosas y agua (PET)",id:"pco1881",name:"PCO 1881 (gaseosa, agua)",v:{neckA:27.4,neckB:24.94,neckC:21.7,pitch:2.7,neckE:17,ringD:33,capD:32},hint:"Fondo de rosca 24,94 · paso 2,7 · cuello 17 mm. Cresta (27,4), Ø boca y anillo son aproximados; sin anillo de seguridad."},
 {g:"Gaseosas y agua (PET)",id:"pco1810",name:"PCO 1810 (gaseosa, agua, vieja)",v:{neckA:27.4,neckB:24.94,neckC:21.7,pitch:3.18,neckE:21,ringD:33,capD:32},hint:"Fondo de rosca 24,94 · paso 3,18 · cuello 21 mm. Cresta, Ø boca y anillo aproximados; sin anillo de seguridad."},
 {g:"Normalizadas (GPI/SPI)",id:"18-410",name:"18-410",v:{neckA:17.68,neckB:15.54,neckC:8.26,pitch:3.2,neckE:13.28,ringD:21},hint:"T 17,68 · E 15,54 · H 13,28 mm. Paso estimado."},
 {g:"Normalizadas (GPI/SPI)",id:"20-410",name:"20-410",v:{neckA:19.69,neckB:17.55,neckC:10.26,pitch:3.2,neckE:14.07,ringD:23},hint:"T 19,69 · E 17,55 · H 14,07 mm. Paso estimado."},
 {g:"Normalizadas (GPI/SPI)",id:"24-410",name:"24-410",v:{neckA:23.67,neckB:21.54,neckC:13.11,pitch:3.2,neckE:16.41,ringD:27},hint:"T 23,67 · E 21,54 · H 16,41 mm. Paso estimado."},
 {g:"Normalizadas (GPI/SPI)",id:"28-400",name:"28-400",v:{neckA:27.38,neckB:24.99,neckC:15.6,pitch:3.2,neckE:10.16,ringD:31},hint:"T 27,38 · E 24,99 · H 10,16 mm. Paso estimado."},
 {g:"Normalizadas (GPI/SPI)",id:"28-410",name:"28-410",v:{neckA:27.33,neckB:24.94,neckC:15.6,pitch:3.2,neckE:17.73,ringD:31},hint:"T 27,33 · E 24,94 · H 17,73 mm. Ø de boca estimado. Paso estimado."}
];
const NECK_KEYS=["neckA","neckB","neckC","pitch","neckE","ringD","capD"];
const CAP_RANGE={};CAP_SCHEMA.forEach(g=>g.fields.forEach(f=>{if(f.t==="range")CAP_RANGE[f.k]=[f.min,f.max]}));
function sanitizeCap(src){
  const out={};
  if(!src||typeof src!=="object")return out;
  for(const k of Object.keys(CAP_DEF)){
    if(!(k in src))continue;const d=CAP_DEF[k],v=src[k];
    if(typeof d==="number"){if(typeof v==="number"&&isFinite(v)){const r=CAP_RANGE[k];out[k]=r?Math.min(r[1],Math.max(r[0],v)):v}}
    else if(typeof d==="boolean"){if(typeof v==="boolean")out[k]=v}
    else if(k==="color"){if(typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v))out[k]=v}
    else if(k==="topType"){if(v==="cone"||v==="flat")out[k]=v}
  }
  return out;
}
const UKEY="tk3d-cap-user-v1";
let USER=(()=>{try{const u=JSON.parse(localStorage.getItem(UKEY)||"{}");const o={};for(const [n,v] of Object.entries(u||{}))if(typeof n==="string"&&n.length<60)o[n]=sanitizeCap(v);return o}catch(e){return {}}})();
const saveUser=()=>{try{localStorage.setItem(UKEY,JSON.stringify(USER))}catch(e){}};
const cv=createViewer($("#capVp"));
let cMesh=null,cGhost=null,cTimer=0,cData=null,cFitNext=true;
function capShow(m){const b=$("#capVp .busy");b.hidden=!m;if(m)b.textContent=m}
function capRefresh(){
  capShow("Generando…");
  setTimeout(()=>{
    try{
      const t0=performance.now();
      if(!(C.neckA>C.neckB)){$("#capStatus").textContent="A debe ser mayor que B (la cresta supera al fondo del filete).";capShow("");return}
      const pos=capSoup(C,false,192);
      cData={pos};
      if(cv){
        disposeMesh(cMesh);disposeMesh(cGhost);cMesh=cGhost=null;
        cMesh=soupMesh(pos,C.color);cMesh.position.z=C.lift;cv.group.add(cMesh);
        if(C.ghost){
          const g=ghostSoup(C,96);
          let geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(g.pos,3));geo=toCreasedNormals(geo,0.62);
          cGhost=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({color:0x6aa6d9,roughness:0.35,transparent:true,opacity:0.38,side:THREE.DoubleSide,depthWrite:false}));
          cv.group.add(cGhost);cv.ground.position.z=g.zBot-0.05;
        }else cv.ground.position.z=-0.05;
        cv.setWire($("#capWire").checked);
        if(cFitNext){cv.fit();cFitNext=false}
      }
      capInfo(performance.now()-t0,soupInfo(pos));
    }catch(e){console.error(e);$("#capStatus").textContent="No se pudo generar: "+e.message}
    capShow("");
  },30);
}
function capInfo(ms,i){
  const g=capGeom(C),Hc=C.neckE+C.gap,Ht=Hc+C.topT;
  const rows=[["Profundidad de rosca",num(g.depth,2)+" mm"],["Ø interior mínimo (puntas)",num(2*(g.re+g.c),2)+" mm"],["Ø interior en el surco",num(2*(g.rc+g.c),2)+" mm"],
    ["Altura de la cavidad",num(Hc,1)+" mm"],["Altura total",num(i.size[2],1)+" mm"],["Triángulos",num(i.tris,0)]];
  $("#capStats").innerHTML=rows.map(([a,b])=>`<dt>${a}</dt><dd>${b}</dd>`).join("");
  const w=[],wall=C.capD/2-(C.ribN>0?C.ribH:0)-(g.rc+C.clearance);
  if(!(C.neckA>C.neckB))w.push("A debe ser mayor que B.");
  if(wall<1.2)w.push(`La pared de la tapa queda en ${num(wall,2)} mm en el punto más delgado: conviene 1,2 mm o más. Subí el Ø exterior.`);
  if(C.neckB-C.neckC<1.6)w.push("La pared del cuello que medís es muy fina (B menos C): revisá las medidas.");
  if(C.topType==="cone"&&C.coneBase/2>C.capD/2-2)w.push("La base del cono es muy ancha para este diámetro de tapa.");
  if(C.topType==="cone"&&C.holeD>=C.coneTip-1.2)w.push("El orificio es muy grande para la punta del cono: queda una pared muy fina.");
  if(C.plug&&C.neckC-0.3<(C.topType==="cone"?C.holeD+1.6:2))w.push("La boca del frasco es chica para un tapón con ese orificio.");
  if(C.clearance<0.15)w.push("Holgura menor a 0,15 mm: con impresoras de poca precisión puede no enroscar.");
  $("#capWarn").innerHTML=w.map(t=>`<div class="warn">${t}</div>`).join("");
  $("#capStatus").textContent=`Vista previa en ${Math.round(ms)} ms · la exportación usa más resolución`;
}
function capChanged(k){
  store.set(CKEY,C);
  if(NECK_KEYS.includes(k)||k==="clearance"){const el=$("#capThread");if(el&&el.value){el.value="";hintFor("")}}
  if(k==="color"){if(cMesh)cMesh.material.color.set(C.color);return}
  if(k==="lift"){if(cMesh)cMesh.position.z=C.lift;if(cv)cv.fit();return}
  clearTimeout(cTimer);cTimer=setTimeout(capRefresh,150);
}
const capPanelApi={sync(){$("#capPanel").innerHTML="";buildPanel($("#capPanel"),CAP_SCHEMA,C,capChanged)}};
capPanelApi.sync();
function fillThreadSelect(sel=""){
  const el=$("#capThread");let h='<option value="">Personalizada (editada)</option>';
  const groups={};THREADS.forEach(t=>{(groups[t.g]=groups[t.g]||[]).push(t)});
  for(const [g,list] of Object.entries(groups))h+=`<optgroup label="${g}">`+list.map(t=>`<option value="t:${t.id}">${t.name}</option>`).join("")+"</optgroup>";
  const un=Object.keys(USER);
  if(un.length)h+='<optgroup label="Mis presets">'+un.map(n=>`<option value="u:${n.replace(/"/g,"&quot;")}">★ ${n.replace(/</g,"&lt;")}</option>`).join("")+"</optgroup>";
  el.innerHTML=h;el.value=sel;if(el.value!==sel)el.value="";
  hintFor(el.value);
}
function hintFor(v){
  let t="Elegí una rosca conocida o editá las medidas: se guarda como «Personalizada».";
  if(v.startsWith("t:")){const x=THREADS.find(q=>"t:"+q.id===v);if(x)t=x.hint}
  else if(v.startsWith("u:"))t="Preset guardado por vos en este navegador.";
  $("#capThreadHint").textContent=t;
}
function applyThread(v){
  let vals=null;
  if(v.startsWith("t:")){
    const x=THREADS.find(q=>"t:"+q.id===v);if(!x)return;
    vals={...x.v};
    if(!("capD" in vals)){vals.capD=Math.ceil((vals.neckA+2*(C.clearance+2.4+(C.ribN>0?C.ribH:0)))*2)/2}
    if(x.id!=="mine"){vals.neckC=Math.min(vals.neckC,vals.neckB-1.6)}
  }else if(v.startsWith("u:")){
    const u=USER[v.slice(2)];if(!u)return;vals=u;
  }
  if(!vals)return;
  Object.assign(C,sanitizeCap(vals));
  store.set(CKEY,C);capPanelApi.sync();hintFor(v);cFitNext=true;capRefresh();
}
$("#capThread").addEventListener("change",e=>{if(e.target.value)applyThread(e.target.value);else hintFor("")});
fillThreadSelect("t:mine");
$("#capSave").onclick=()=>{
  const n=(window.prompt("Nombre para guardar estas medidas:","Mi rosca")||"").trim().slice(0,40);
  if(!n)return;
  const o={...C};delete o.ghost;delete o.lift;
  USER[n]=sanitizeCap(o);saveUser();fillThreadSelect("u:"+n);
  $("#capStatus").textContent=`Guardado como «${n}» en este navegador.`;
};
$("#capDel").onclick=()=>{
  const v=$("#capThread").value;
  if(!v.startsWith("u:")){$("#capStatus").textContent="Elegí uno de tus presets (con ★) para borrarlo.";return}
  const n=v.slice(2);if(!window.confirm(`¿Borrar el preset «${n}»?`))return;
  delete USER[n];saveUser();fillThreadSelect("");$("#capStatus").textContent=`Preset «${n}» borrado.`;
};
$("#capExp").onclick=()=>{
  const cur={...C};delete cur.ghost;delete cur.lift;
  download(JSON.stringify({app:"Toolkit3D-tapas",version:1,current:cur,presets:USER},null,2),"tapas-mis-roscas.json","application/json");
  $("#capStatus").textContent="Archivo exportado: tapas-mis-roscas.json";
};
$("#capImp").onclick=()=>$("#capFile").click();
$("#capFile").onchange=async e=>{
  const f=e.target.files[0];e.target.value="";if(!f)return;
  try{
    if(f.size>1e5)throw Error("archivo demasiado grande");
    const j=JSON.parse(await f.text());
    if(!j||j.app!=="Toolkit3D-tapas")throw Error("no es un archivo de tapas de este toolkit");
    let n=0;
    if(j.presets&&typeof j.presets==="object")for(const [k,v] of Object.entries(j.presets).slice(0,50)){if(typeof k==="string"&&k.length<60){USER[k]=sanitizeCap(v);n++}}
    saveUser();
    if(j.current){Object.assign(C,sanitizeCap(j.current));store.set(CKEY,C);capPanelApi.sync();cFitNext=true;capRefresh()}
    fillThreadSelect("");
    $("#capStatus").textContent=`Importado: ${n} preset(s)${j.current?" y las medidas actuales":""}.`;
  }catch(err){$("#capStatus").textContent="No se pudo importar: "+err.message}
};
$("#capPresets").innerHTML=Object.keys(CAP_PRESETS).map(n=>`<button data-cp="${n}">${n}</button>`).join("");
$("#capPresets").addEventListener("click",e=>{
  const b=e.target.closest("[data-cp]");if(!b)return;
  TOP_KEYS.forEach(k=>{C[k]=CAP_DEF[k]});Object.assign(C,CAP_PRESETS[b.dataset.cp]);store.set(CKEY,C);capPanelApi.sync();cFitNext=true;capRefresh();
});
$("#capReset").onclick=()=>{Object.assign(C,CAP_DEF);store.set(CKEY,C);capPanelApi.sync();fillThreadSelect("t:mine");cFitNext=true;capRefresh()};
$("#capFit").onclick=()=>cv&&cv.fit();
$("#capWire").onchange=()=>cv&&cMesh&&(cMesh.material.wireframe=$("#capWire").checked);
$$("[data-cx]").forEach(b=>b.onclick=()=>{
  try{
    if(!(C.neckA>C.neckB))throw Error("A debe ser mayor que B");
    const test=b.dataset.cx==="test",pos=capSoup(C,test,360);
    const name=test?`tapa-prueba-A${num(C.neckA,1).replace(",",".")}-p${num(C.pitch,2).replace(",",".")}.stl`:`tapa-${C.topType==="cone"?"cono":"ciega"}-A${num(C.neckA,1).replace(",",".")}-p${num(C.pitch,2).replace(",",".")}.stl`;
    download(soupToSTL(pos),name,"model/stl");
    $("#capStatus").textContent="STL descargado: "+name;
  }catch(e){$("#capStatus").textContent="No se pudo exportar: "+e.message}
});

/* ---------- Pestañas, tema, lámparas ---------- */

const TABS=["gear","key","cap"];
let initial="gear";
try{const q=new URLSearchParams(location.search).get("m");if(TABS.includes(q))initial=q}catch(e){}
function showTab(t){
  $$(".module").forEach(m=>m.classList.toggle("on",m.id==="mod-"+t));
  gv&&(t==="gear"?gv.start():gv.stop());
  kv&&(t==="key"?kv.start():kv.stop());
  cv&&(t==="cap"?cv.start():cv.stop());
  if(t==="gear"&&gv){requestAnimationFrame(()=>{gv.resize();if(gFitNext||!gMain){gDirty=true}})}
  if(t==="key"&&kv){requestAnimationFrame(()=>{kv.resize();if(!kData)keyRefresh(true)})}
  if(t==="cap"&&cv){requestAnimationFrame(()=>{cv.resize();if(!cData)capRefresh()})}
}
showTab(initial);
