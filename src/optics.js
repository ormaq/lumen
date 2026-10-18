/** Lumen 5 · deterministic, dependency-free geometric optics.
 * Right-handed, Y-up; lengths and powers use arbitrary consistent units.
 * Curved intersections are analytical, independent of the display meshes.
 */
export const EPS=1e-6;
export const POSITION_LIMIT=1_000_000;
export const MAX_SOURCE_RAYS=16_384;
export const MAX_TOTAL_RAYS=65_536;
export const SEGMENT_BUDGET=100_000;
const newSceneId=()=>globalThis.crypto?.randomUUID?.()||('scene-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
export const rad=d=>d*Math.PI/180;
export const deg=r=>r*180/Math.PI;
export const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export const V={
 add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,s)=>a.map(v=>v*s),
 dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 len:a=>Math.hypot(...a),unit(a){const l=Math.hypot(...a);return l>1e-12?a.map(v=>v/l):[0,0,0];},mix:(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t)
};
export const CATALOG={
 star:{label:'Distant star',group:'Light sources',icon:'star',description:'A sampled wavefront from infinity, with field angle and angular size.'},
 laser:{label:'Single ray',group:'Light sources',icon:'ray',description:'One precisely aimed ray.'},
 beam:{label:'Parallel beam',group:'Light sources',icon:'beam',description:'A circular bundle of parallel or divergent rays.'},
 point:{label:'Point source',group:'Light sources',icon:'sun',description:'Light emitted in all directions in 3D.'},
 spot:{label:'Spot source',group:'Light sources',icon:'spot',description:'A solid-angle cone from a single point.'},
 fan:{label:'Fan source',group:'Light sources',icon:'fan',description:'A planar fan; rotate its emission plane in 3D.'},
 line:{label:'Line source',group:'Light sources',icon:'line',description:'A line of parallel or spreading emitters.'},
 area:{label:'Area source',group:'Light sources',icon:'area',description:'A rectangular grid of directional emitters.'},
 mirror:{label:'Flat mirror',group:'Mirrors',icon:'mirror',description:'A finite, two-sided reflective plane.'},
 shaped:{label:'Inverse reflector',group:'Mirrors',icon:'spark',description:'An exact off-axis conic designed from a wavefront to a detector point.'},
 parabola:{label:'Parabolic dish',group:'Mirrors',icon:'dish',description:'A true paraboloid with an adjustable point focus.'},
 trough:{label:'Parabolic trough',group:'Mirrors',icon:'trough',description:'A parabolic cylinder with a line focus.'},
 spherical:{label:'Spherical mirror',group:'Mirrors',icon:'curved',description:'A concave or convex spherical cap.'},
 splitter:{label:'Beam splitter',group:'Optics',icon:'split',description:'Split power into reflected and transmitted branches.'},
 lens:{label:'Ideal thin lens',group:'Optics',icon:'lens',description:'A paraxial converging or diverging lens.'},
 glass:{label:'Glass sphere',group:'Optics',icon:'glass',description:'Snell refraction, total internal reflection, optional Fresnel branches.'},
 blocker:{label:'Blocker',group:'Screens & tools',icon:'block',description:'Absorb rays at a finite opaque screen.'},
 aperture:{label:'Aperture',group:'Screens & tools',icon:'aperture',description:'An opaque plate with a circular opening.'},
 detector:{label:'Detector',group:'Screens & tools',icon:'detector',description:'Measure sampled ray hits and incident power.'}
};
export const isSource=o=>!!o&&CATALOG[o.type]?.group==='Light sources';
export const isMirror=o=>!!o&&CATALOG[o.type]?.group==='Mirrors';
export function basis(o){
 const y=rad(o.yaw||0),t=rad(o.tilt||0),r=rad(o.roll||0);
 const n=[Math.sin(y)*Math.cos(t),Math.sin(t),Math.cos(y)*Math.cos(t)],u=[Math.cos(y),0,-Math.sin(y)],v=V.cross(n,u);
 return {n,u:V.add(V.mul(u,Math.cos(r)),V.mul(v,Math.sin(r))),v:V.sub(V.mul(v,Math.cos(r)),V.mul(u,Math.sin(r)))};
}
export function localVec(p,b){return [V.dot(p,b.u),V.dot(p,b.v),V.dot(p,b.n)];}
export function worldVec(p,b){return [
 (b.u[0]*p[0]+b.v[0]*p[1])+b.n[0]*p[2],
 (b.u[1]*p[0]+b.v[1]*p[1])+b.n[1]*p[2],
 (b.u[2]*p[0]+b.v[2]*p[1])+b.n[2]*p[2]
];}
export function aim(o,target){if(V.len(V.sub(target,o.p))<EPS)return o;const n=V.unit(V.sub(target,o.p));o.yaw=deg(Math.atan2(n[0],n[2]));o.tilt=deg(Math.asin(clamp(n[1],-1,1)));return o;}
export function reflect(d,n){return V.unit(V.sub(d,V.mul(n,2*V.dot(d,n))));}
/** n faces the incident medium. Returns null for total internal reflection. */
export function refract(d,n,eta){const cosI=clamp(-V.dot(d,n),0,1),k=1-eta*eta*(1-cosI*cosI);return k<0?null:V.unit(V.add(V.mul(d,eta),V.mul(n,eta*cosI-Math.sqrt(Math.max(0,k)))));}
export function fresnel(cosI,n1,n2){const sinT2=(n1/n2)**2*(1-cosI*cosI);if(sinT2>=1)return 1;const cosT=Math.sqrt(1-sinT2);const rs=(n1*cosI-n2*cosT)/(n1*cosI+n2*cosT),rp=(n2*cosI-n1*cosT)/(n2*cosI+n1*cosT);return (rs*rs+rp*rp)/2;}
export function quadratic(a,b,c){
 if(Math.abs(a)<1e-12)return Math.abs(b)<1e-12?[]:[-c/b];
 const disc=b*b-4*a*c;if(disc<-1e-10)return [];
 const sd=Math.sqrt(Math.max(0,disc)),q=-.5*(b+(b>=0?sd:-sd));
 if(Math.abs(q)<1e-14)return [-b/(2*a)];return [q/a,c/q].sort((x,y)=>x-y);
}
export function createObject(type,id='o1',p=[0,3,0]){
 if(!CATALOG[type])throw new Error('Unknown component type.');
 const common={id,name:CATALOG[type].label,type,enabled:true,locked:false,p:[...p],yaw:isSource({type})?90:-90,tilt:0,roll:0};
 if(isSource(common))return {...common,aimTarget:null,fieldX:0,fieldY:0,angularDiameter:0,color:'#ffbf69',colorMode:'rgb',wavelength:590,power:1,count:type==='laser'?1:type==='star'?768:type==='point'?192:61,aperture:1.2,spread:type==='spot'?30:type==='fan'?50:0,width:3,height:2};
 if(type==='shaped')return {...common,width:3,height:3,diameter:4.8,reflectivity:1,figure:{kind:'paraboloid',incoming:[0,0,-1],target:[0,0,3]},design:null};
 return {...common,width:3,height:3,diameter:4.8,focalLength:3,radius:type==='glass'?1.6:6,curvature:'concave',reflectivity:1,ratio:.5,transmission:1,ior:1.5,dispersion:0,fresnel:false,hole:1.2,absorb:true,minDepth:0};
}
export function surfaceZ(o,x,y){
 if(o.type==='shaped')return inverseSag(o,x,y);
 if(o.type==='parabola')return (x*x+y*y)/(4*o.focalLength);
 if(o.type==='trough')return x*x/(4*o.focalLength);
 if(o.type==='spherical'){const s=o.curvature==='convex'?-1:1,R=o.radius;return s*(R-Math.sqrt(Math.max(0,R*R-x*x-y*y)));}
 return 0;
}
export function surfaceNormal(o,x,y){
 if(o.type==='shaped'){const q=inverseQuadric(o),p=[x,y,inverseSag(o,x,y)];return V.unit(V.add(V.mul(matVec(q.A,p),2),q.l));}
 if(o.type==='parabola')return V.unit([-x/(2*o.focalLength),-y/(2*o.focalLength),1]);
 if(o.type==='trough')return V.unit([-x/(2*o.focalLength),0,1]);
 if(o.type==='spherical'){const s=o.curvature==='convex'?-1:1;return V.unit([-s*x,-s*y,Math.sqrt(Math.max(0,o.radius*o.radius-x*x-y*y))]);}
 return [0,0,1];
}
/** Finite optical surface intersection; t is distance for a unit ray. */
export function intersect(origin,direction,o,frame=null){
 if(!o.enabled||isSource(o))return null;
 const b=frame||basis(o),p=localVec(V.sub(origin,o.p),b),d=localVec(direction,b);let ts=[];
 if(o.type==='shaped'){const q=inverseQuadric(o),Ap=matVec(q.A,p);ts=quadricRoots(V.dot(d,matVec(q.A,d)),2*V.dot(d,Ap)+V.dot(q.l,d),V.dot(p,Ap)+V.dot(q.l,p));}
 else if(o.type==='glass')ts=quadratic(V.dot(d,d),2*V.dot(p,d),V.dot(p,p)-o.radius*o.radius);
 else if(o.type==='parabola'||o.type==='trough'){
  const q=o.type==='trough'?0:1,f=o.focalLength;
  ts=quadratic(d[0]*d[0]+q*d[1]*d[1],2*(p[0]*d[0]+q*p[1]*d[1])-4*f*d[2],p[0]*p[0]+q*p[1]*p[1]-4*f*p[2]);
 }else if(o.type==='spherical'){
  const R=o.radius*(o.curvature==='convex'?-1:1),q=V.sub(p,[0,0,R]);ts=quadratic(V.dot(d,d),2*V.dot(q,d),V.dot(q,q)-R*R);
 }else if(Math.abs(d[2])>EPS)ts=[-p[2]/d[2]];
 for(const t of ts){
  if(t<=EPS)continue;const q=V.add(p,V.mul(d,t));
  if(['parabola','shaped','spherical','lens'].includes(o.type)&&q[0]*q[0]+q[1]*q[1]>(o.diameter/2)**2+EPS)continue;
  if(o.type==='shaped'&&!onInversePatch(o,q))continue;
  if(o.type==='spherical'){const R=o.radius*(o.curvature==='convex'?-1:1);if(R>0?q[2]>R+EPS:q[2]<R-EPS)continue;}
  if(!['glass','parabola','shaped','spherical','lens'].includes(o.type)&&(Math.abs(q[0])>o.width/2+EPS||Math.abs(q[1])>o.height/2+EPS))continue;
  if(o.type==='aperture'&&q[0]*q[0]+q[1]*q[1]<(o.hole/2)**2-EPS)continue;
  const normal=worldVec(o.type==='glass'?V.unit(q):surfaceNormal(o,q[0],q[1]),b);
  return {t,point:V.add(origin,V.mul(direction,t)),normal,local:q,object:o};
 }
 return null;
}
export const BOUNDS={min:[-22,-10,-22],max:[22,26,22]};
export function boundaryDistance(p,d,bounds=BOUNDS){let near=-Infinity,far=Infinity;for(let i=0;i<3;i++){if(Math.abs(d[i])<EPS){if(p[i]<bounds.min[i]||p[i]>bounds.max[i])return 0;continue;}let a=(bounds.min[i]-p[i])/d[i],b=(bounds.max[i]-p[i])/d[i];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);}return far<Math.max(near,0)?0:Math.max(0,far);}
export const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
/** Display-only approximation, not a spectral colorimetry implementation. */
export function wavelengthRGB(w){
 let c=w<440?[(440-w)/60,0,1]:w<490?[0,(w-440)/50,1]:w<510?[0,1,(510-w)/20]:w<580?[(w-510)/70,1,0]:w<645?[1,(645-w)/65,0]:[1,0,0];
 const f=w<420?.3+.7*(w-380)/40:w>700?.3+.7*(780-w)/80:1;return c.map(x=>Math.pow(clamp(x*f,0,1),.75));
}
export const sourceColor=s=>s.colorMode==='wavelength'?wavelengthRGB(s.wavelength):rgb(s.color);
/** Deterministic samples; each carries an equal fraction of source power. */
/** Resolve aim constraints before tracing/editing. A missing target releases the lock.
 * Coincident centers retain the last valid direction. Transform lock is independent.
 */
export function syncAimLocks(scene){
 const byId=new Map(scene.objects.map(o=>[o.id,o]));
 for(const s of scene.objects){if(!isSource(s))continue;s.aimDistance=0;if(!s.aimTarget)continue;const target=byId.get(s.aimTarget);if(!target||target.id===s.id){s.aimTarget=null;continue;}aim(s,target.p);s.aimDistance=V.len(V.sub(target.p,s.p));}
 return scene;
}
export function requestedSamples(s,density=1){return s.enabled&&s.power>0?(s.type==='laser'?1:clamp(Math.round(s.count*density),1,MAX_SOURCE_RAYS)):0;}
function radicalInverse(index,base){let out=0,f=1/base;while(index>0){out+=(index%base)*f;index=Math.floor(index/base);f/=base;}return out;}
export function emit(s,density=1,sampleLimit=MAX_SOURCE_RAYS){
 if(!s.enabled||s.power<=0)return [];
 const b=basis(s),N=Math.min(requestedSamples(s,density),Math.max(1,sampleLimit)),out=[],ga=2.399963229728653;
 for(let i=0;i<N;i++){
  let pos=[0,0,0],dir=[0,0,1];const r=i===0||N===1?0:Math.sqrt(i/(N-1)),a=i*ga,x=r*Math.cos(a),y=r*Math.sin(a),q=N===1?0:(i/(N-1)*2-1);
  if(s.type==='star'){
   // A finite entrance sampling plane represents a star at infinity, not its distance.
   // Pupil and angular-disc samples use independent low-discrepancy sequences.
   pos=[x*s.aperture/2,y*s.aperture/2,0];const ar=Math.tan(rad((s.angularDiameter||0)/7200))*Math.sqrt(radicalInverse(i+1,2)),aa=2*Math.PI*radicalInverse(i+1,3);
   dir=V.unit([Math.tan(rad(s.fieldX||0))+ar*Math.cos(aa),Math.tan(rad(s.fieldY||0))+ar*Math.sin(aa),1]);
   // When target-locked, sample the same pupil at the target vertex plane.
   // Moving the launch plane must not invent field-dependent vignetting.
   if(s.aimDistance>0){pos[0]-=dir[0]/dir[2]*s.aimDistance;pos[1]-=dir[1]/dir[2]*s.aimDistance;}
  }else if(s.type==='point'){const z=1-2*(i+.5)/N,t=Math.sqrt(1-z*z);dir=[t*Math.cos(a),t*Math.sin(a),z];}
  else if(s.type==='spot'){
   const cos=1-(i===0||N===1?0:i/(N-1))*(1-Math.cos(rad(s.spread))),sn=Math.sqrt(Math.max(0,1-cos*cos));dir=[sn*Math.cos(a),sn*Math.sin(a),cos];
  }else if(s.type==='fan'){const t=rad(q*s.spread);dir=[Math.sin(t),0,Math.cos(t)];}
  else if(s.type==='line'){pos=[q*s.width/2,0,0];dir=V.unit([Math.tan(rad(q*s.spread)),0,1]);}
  else if(s.type==='area'){
   const cols=Math.ceil(Math.sqrt(N*s.width/Math.max(.1,s.height))),rows=Math.ceil(N/cols),xx=cols===1?0:((i%cols)/(cols-1)-.5),yy=rows===1?0:(Math.floor(i/cols)/(rows-1)-.5);
   pos=[xx*s.width,yy*s.height,0];dir=V.unit([xx*2*Math.tan(rad(s.spread)),yy*2*Math.tan(rad(s.spread)),1]);
  }else if(s.type==='beam'){pos=[x*s.aperture/2,y*s.aperture/2,0];dir=V.unit([x*Math.tan(rad(s.spread)),y*Math.tan(rad(s.spread)),1]);}
  out.push({p:V.add(s.p,worldVec(pos,b)),d:worldVec(dir,b),energy:s.power/N,visual:s.power,color:sourceColor(s),wavelength:s.colorMode==='wavelength'?s.wavelength:550,sourceId:s.id,rayIndex:i,sampleCount:N});
 }
 return out;
}
export function focalPoints(o){const b=basis(o);if(o.type==='shaped')return [V.add(o.p,worldVec(o.figure.target,b))];if(o.type==='parabola'||o.type==='trough')return [V.add(o.p,V.mul(b.n,o.focalLength))];if(o.type==='spherical')return [V.add(o.p,V.mul(b.n,o.radius/2*(o.curvature==='convex'?-1:1)))];if(o.type==='lens')return [-1,1].map(s=>V.add(o.p,V.mul(b.n,s*o.focalLength)));return [];}
// Keep queued rays in one predictable shape. Spreading each seed and then adding
// fields creates a different object layout from its descendants in dense traces.
function queuedRay(r,p,d,energy,depth,startLength,relative,kind){
 return {p,d,energy,visual:r.visual,color:r.color,wavelength:r.wavelength,sourceId:r.sourceId,rayIndex:r.rayIndex,sampleCount:r.sampleCount,depth,startLength,relative,kind};
}
export function traceScene(scene){
 syncAimLocks(scene);syncInverseDesigns(scene);
 const settings=scene.settings,surfaces=scene.objects.filter(o=>!isSource(o)&&o.enabled),frames=surfaces.map(basis),sources=scene.objects.filter(isSource);
 const requested=sources.map(s=>requestedSamples(s,settings.density)),requestedTotal=requested.reduce((a,b)=>a+b,0),scale=Math.min(1,MAX_TOTAL_RAYS/Math.max(1,requestedTotal));
 const seeds=sources.flatMap((s,i)=>requested[i]?emit(s,settings.density,Math.max(1,Math.floor(requested[i]*scale))):[]);
 const segments=[],hits=[],detectors={};for(const o of surfaces)if(o.type==='detector')detectors[o.id]={hits:[],power:0,count:0};
 const budget=clamp(settings.segmentBudget||SEGMENT_BUDGET,1,SEGMENT_BUDGET),queue=seeds.map(r=>queuedRay(r,r.p,r.d,r.energy,0,0,1,'emitted'));let index=0,limited=false,prunedPower=0;
 while(index<queue.length&&segments.length<budget){
  const r=queue[index++];if(r.relative<.003||r.energy<1e-10){prunedPower+=r.energy;continue;}
  let distance=Math.max(0,settings.maxDistance-r.startLength),hit=null;
  for(let si=0;si<surfaces.length;si++){const o=surfaces[si];if(o.type==='detector'&&r.depth<(o.minDepth||0))continue;const h=intersect(r.p,r.d,o,frames[si]);if(h&&h.t<distance){distance=h.t;hit=h;}}
  if(distance<EPS)continue;const end=V.add(r.p,V.mul(r.d,distance));
  segments.push({a:r.p,b:end,energy:r.energy,visual:r.visual*r.relative,color:r.color,sourceId:r.sourceId,rayIndex:r.rayIndex,sampleCount:r.sampleCount,startLength:r.startLength,length:distance,depth:r.depth,kind:r.kind,terminal:!hit});
  if(!hit)continue;
  const o=hit.object,entering=V.dot(r.d,hit.normal)<0,n=entering?hit.normal:V.mul(hit.normal,-1),cos=clamp(-V.dot(r.d,n),0,1);
  const record={objectId:o.id,sourceId:r.sourceId,rayIndex:r.rayIndex,point:end,normal:n,local:hit.local,incoming:r.d,incidence:deg(Math.acos(cos)),energy:r.energy,wavelength:r.wavelength,color:r.color,type:o.type,depth:r.depth};hits.push(record);
  if(o.type==='detector'){const det=detectors[o.id];det.hits.push(record);det.count++;det.power+=r.energy;if(o.absorb)continue;}
  if(o.type==='blocker'||o.type==='aperture')continue;
  if(r.depth>=settings.maxBounces){limited=true;continue;}
  const push=(d,factor,kind)=>{if(factor<=0)return;queue.push(queuedRay(r,V.add(end,V.mul(d,EPS*8)),d,r.energy*factor,r.depth+1,r.startLength+distance,r.relative*factor,kind));};
  if(o.type==='detector'){push(r.d,1,'transmitted');continue;}
  if(o.type==='splitter'){
   const rd=reflect(r.d,n);record.outgoing=rd;record.reflection=deg(Math.acos(clamp(V.dot(rd,n),-1,1)));push(rd,o.ratio,'reflected');push(r.d,1-o.ratio,'transmitted');
  }else if(o.type==='lens'){
   const b=basis(o),ld=localVec(r.d,b),z=Math.max(EPS,Math.abs(ld[2]));
   const outgoing=worldVec(V.unit([ld[0]/z-hit.local[0]/o.focalLength,ld[1]/z-hit.local[1]/o.focalLength,Math.sign(ld[2])]),b);
   record.outgoing=outgoing;push(outgoing,o.transmission,'refracted');
  }else if(o.type==='glass'){
   // Each sphere is bounded by air. Overlapping/nested dielectric volumes are unsupported.
   const ior=clamp(o.ior+o.dispersion*(1/(r.wavelength/1000)**2-1/.55**2),1.001,2.8),n1=entering?1:ior,n2=entering?ior:1,td=refract(r.d,n,n1/n2);
   const R=td?(o.fresnel?fresnel(cos,n1,n2):0):1;record.tir=!td;record.outgoing=td||reflect(r.d,n);record.refraction=td?deg(Math.acos(clamp(-V.dot(td,n),-1,1))):null;
   if(td)push(td,(1-R)*o.transmission,'refracted');if(R>0)push(reflect(r.d,n),R,'reflected');
  }else{
   const rd=reflect(r.d,n);record.outgoing=rd;record.reflection=deg(Math.acos(clamp(V.dot(rd,n),-1,1)));push(rd,o.reflectivity,'reflected');
  }
 }
 if(index<queue.length)limited=true;
 return {segments,hits,detectors,seeds:seeds.length,emittedPower:seeds.reduce((n,r)=>n+r.energy,0),limited,prunedPower,requestedSeeds:requestedTotal,seedLimited:scale<1};
}
export const PRESETS={
 inverse:{title:'Off-axis correction',subtitle:'Reshape an angled primary to put a distant star on the detector.',icon:'spark'},
 finite:{title:'Finite-source relay',subtitle:'An ellipsoidal surface images one source point onto a tilted detector.',icon:'spot'},
 star:{title:'Star at infinity',subtitle:'A distant star, a parabolic primary, and a virtual focal plane.',icon:'star'},
 coma:{title:'Off-axis star',subtitle:'See geometric coma as a star moves off the optical axis.',icon:'star'},
 binary:{title:'Double-star field',subtitle:'Two colored stars, one telescope, and two focal spots.',icon:'star'},
 focus:{title:'Parabolic focus',subtitle:'Parallel rays meet at a true 3D focus.',icon:'dish'},
 collimator:{title:'Point to parallel',subtitle:'Put a source at the focus; the dish collimates it.',icon:'spot'},
 trough:{title:'A line of light',subtitle:'A parabolic trough focuses in one dimension.',icon:'trough'},
 splitter:{title:'Split & steer',subtitle:'A splitter divides one beam into two paths.',icon:'split'},
 rgb:{title:'RGB light lab',subtitle:'Three independently colored sources meet on a detector.',icon:'sun'},
 lens:{title:'Lens bench',subtitle:'A converging ideal thin lens brings a beam to focus.',icon:'lens'},
 glass:{title:'Through the glass',subtitle:'Follow refraction at the two surfaces of a sphere.',icon:'glass'},
 spherical:{title:'Spherical aberration',subtitle:'Spherical mirrors do not have one exact focus.',icon:'curved'},
 relay:{title:'Up & over',subtitle:'Three mirrors turn a beam through three dimensions.',icon:'mirror'},
 empty:{title:'Empty workbench',subtitle:'Add sources and optics to build your own experiment.',icon:'plus'}
};
function mirrorPath(id,p,before,after){const o=createObject('mirror',id,p),n=V.unit(V.sub(V.unit(V.sub(p,before)),V.unit(V.sub(after,p))));o.yaw=deg(Math.atan2(n[0],n[2]));o.tilt=deg(Math.asin(n[1]));return o;}
export function createPreset(name='focus'){
 if(!PRESETS[name])name='focus';let objects=[];
 const add=(t,p,props={})=>{const o={...createObject(t,'o'+(objects.length+1),p),...props};objects.push(o);return o;};
 if(name==='inverse'||name==='finite'){
  const finiteSource=name==='finite',P=[4,5,0],T=[-1,3,-6],S=[-9,5,0];
  const src=add(finiteSource?'spot':'star',S,{name:finiteSource?'Finite point source':'Design star',yaw:90,tilt:0,aperture:4.8,spread:finiteSource?13:0,count:1024,color:'#ffbf69',aimTarget:'o2'});
  const m=add('parabola',P,{name:'Angled primary',diameter:6,focalLength:5.4});
  const incoming=V.unit(V.sub(P,S)),outgoing=V.unit(V.sub(T,P));aim(m,V.add(P,V.unit(V.sub(outgoing,incoming))));
  const screen=add('detector',T,{name:'Target detector',width:4.5,height:4.5,minDepth:1,absorb:true});aim(screen,P);screen.roll=12;
 }else if(['star','coma','binary'].includes(name)){
  const base={name:'Distant star',p:[0,144,0],yaw:0,tilt:-90,aperture:3.8,count:768,color:'#91caff',aimTarget:'o2',fieldX:name==='coma'?1.2:0};
  add('star',base.p,base);
  add('parabola',[0,120,0],{name:'Primary mirror',yaw:0,tilt:90,diameter:4,focalLength:12});
  add('detector',[0,132,0],{name:'Virtual focal plane',yaw:0,tilt:90,width:1.5,height:1.5,minDepth:1,absorb:true});
  if(name==='binary'){objects[0].name='Star A';objects[0].fieldX=-.08;add('star',base.p,{...base,id:'o4',name:'Star B',color:'#ffc27a',fieldX:.08});}
 }else if(name==='focus'||name==='spherical'){
  add('beam',[-6,3,0],{name:'Amber beam',aperture:4.0,count:37});
  add(name==='focus'?'parabola':'spherical',[4,3,0],{name:name==='focus'?'Parabolic reflector':'Spherical reflector',diameter:5,focalLength:3,radius:6});
 }else if(name==='collimator'){
  add('spot',[1,3,0],{name:'Source at focus',spread:34,count:61,color:'#79dcb5'});add('parabola',[4,3,0],{name:'Collimating dish',diameter:5});
 }else if(name==='trough'){
  add('area',[-6,3,0],{width:4.3,height:3.6,count:49,name:'Rectangular beam',color:'#80c7ff'});add('trough',[4,3,0],{name:'Parabolic trough',width:5,height:4.4});
 }else if(name==='splitter'){
  add('beam',[-6,3,1.5],{aperture:.55,count:13,name:'Input beam',color:'#75dcb4'});
  add('splitter',[-1,3,1.5],{yaw:45,width:3,height:3,name:'Beam splitter'});
  add('detector',[6,3,1.5],{width:3,height:3,name:'Transmission screen'});
  add('detector',[-1,3,-5.5],{yaw:0,width:3,height:3,name:'Reflection screen'});
 }else if(name==='rgb'){
  const target=[4,3,0];for(const [i,color]of ['#ff6575','#70e5a7','#6bafff'].entries())aim(add('beam',[-6,3+(i===1?1.8:-.6),(i-1)*3.2],{color,aperture:.45,count:13,name:['Red source','Green source','Blue source'][i]}),target);
  add('detector',target,{name:'Color screen',width:6,height:5});
 }else if(name==='lens'){
  add('beam',[-6,3,0],{aperture:3.6,count:49,color:'#80c7ff',name:'Parallel input'});add('lens',[0,3,0],{diameter:4.5,focalLength:3,name:'Converging lens'});add('detector',[5.6,3,0],{width:4,height:4,name:'Image screen'});
 }else if(name==='glass'){
  add('beam',[-6,3,0],{aperture:2.7,count:49,colorMode:'wavelength',wavelength:510,name:'Green beam'});add('glass',[0,3,0],{radius:1.9,ior:1.5,name:'Glass sphere'});add('detector',[6,3,0],{width:5,height:5,name:'Caustic screen'});
 }else if(name==='relay'){
  const s=add('beam',[-6,1.6,2.5],{aperture:.3,count:7,name:'Violet beam',color:'#bc9fff'}),a=[-1.8,1.6,2.5],b=[-1.8,5,-2.5],c=[4,5,-2.5];
  objects.push(mirrorPath('o2',a,s.p,b),mirrorPath('o3',b,a,c),mirrorPath('o4',c,b,[4,1,6]));objects.slice(1).forEach((o,i)=>o.name='Relay mirror '+(i+1));
 }
 const stellar=['star','coma','binary'].includes(name);
 return {version:5,workspace:{camera:null,views:[],notes:'',monitor:false},uid:newSceneId(),name:PRESETS[name].title,preset:name,objects,settings:{maxBounces:12,maxDistance:stellar?60:['inverse','finite'].includes(name)?45:['focus','spherical','trough'].includes(name)?18:30,density:1,normals:false,grid:!stellar,animate:false,labels:false,foci:true,glow:false,extensions:false,snap:false,hideStands:stellar||['inverse','finite'].includes(name),background:'studio',incidentOpacity:1,spotCentroids:true,spotRms:false,analysisSourceId:null,starMode:stellar||['inverse','finite'].includes(name),mmPerUnit:50,primaryId:stellar||['inverse','finite'].includes(name)?'o2':null,detectorId:stellar||['inverse','finite'].includes(name)?'o3':null,airyReference:true,spotAutoFit:true,rayStyle:'clarity',rayStage:'all',rayOpacity:.82,rayWidth:1,displayBudget:24000,showMeasurements:false}};
}
const finite=(x,min,max,label)=>{if(typeof x!=='number'||!Number.isFinite(x))throw new Error('Invalid '+label+'.');return clamp(x,min,max);};
export function validateScene(raw){
 if(raw?.version===1&&raw.source&&Array.isArray(raw.mirrors)){
  const s=raw.source,scene=createPreset('empty');scene.name='Imported v1 scene';
  scene.objects=[{...createObject(s.mode==='single'?'laser':'beam','o1',s.p),yaw:90-s.yaw,tilt:s.pitch,aperture:s.aperture,spread:s.spread,count:s.count},...raw.mirrors.map((m,i)=>({...createObject('mirror','o'+(i+2),m.p),...m,id:'o'+(i+2),name:'Mirror '+(i+1)}))];
  scene.settings={...scene.settings,...raw.settings};return validateScene(scene);
 }
 if(!raw||![2,3,4,5].includes(raw.version)||!Array.isArray(raw.objects)||raw.objects.length>80)throw new Error('Choose a Lumen scene JSON file (up to 80 objects).');
 const ids=new Set(),idMap=new Map(),scene=createPreset('empty');
 raw.objects.forEach((o,i)=>{const old=String(o?.id||('o'+(i+1)));if(idMap.has(old))throw new Error('Duplicate object identifiers.');idMap.set(old,'o'+(i+1));});
 scene.uid=typeof raw.uid==='string'?raw.uid.slice(0,100):scene.uid;scene.name=String(raw.name||'Untitled scene').slice(0,80);scene.preset=PRESETS[raw.preset]?raw.preset:'empty';
 scene.objects=raw.objects.map((r,i)=>{
  if(!r||!CATALOG[r.type])throw new Error('Unsupported optical component.');
  if(!Array.isArray(r.p)||r.p.length!==3)throw new Error('Invalid object position.');
  const id='o'+(i+1),o=createObject(r.type,id,r.p.map((v,j)=>finite(v,-POSITION_LIMIT,POSITION_LIMIT,'position')));ids.add(id);
  o.name=String(r.name||CATALOG[r.type].label).slice(0,60);o.enabled=r.enabled!==false;o.locked=r.locked===true;
  for(const key of ['yaw','tilt','roll'])o[key]=finite(r[key]??o[key],-180,180,'orientation');
  const fields=isSource(o)?{count:[1,16384],power:[0,5],aperture:[0,10000],spread:[0,89],width:[.1,10000],height:[.1,10000],wavelength:[380,780],fieldX:[-30,30],fieldY:[-30,30],angularDiameter:[0,3600]}:{width:[.01,10000],height:[.01,10000],diameter:[.1,10000],focalLength:[-10000,10000],radius:[.15,20000],reflectivity:[0,1],ratio:[0,1],transmission:[0,1],ior:[1.001,2.5],dispersion:[0,.02],hole:[.01,10000],minDepth:[0,32]};
  for(const [k,[a,b]]of Object.entries(fields))o[k]=finite(r[k]??o[k]??createObject('mirror')[k],a,b,k);
  if(isSource(o)){o.count=Math.round(o.count);o.aimTarget=typeof r.aimTarget==='string'?idMap.get(r.aimTarget)||null:null;if(o.aimTarget===id)o.aimTarget=null;o.color=/^#[\da-f]{6}$/i.test(r.color)?r.color:'#ffbf69';o.colorMode=r.colorMode==='wavelength'?'wavelength':'rgb';}
  else{
   if(o.type==='shaped'){o.figure=validateFigure(r.figure);validateInverseAperture(o);o.design=validateDesignBinding(r.design,idMap);}
   o.minDepth=Math.round(o.minDepth);o.curvature=r.curvature==='convex'?'convex':'concave';o.absorb=r.absorb!==false;o.fresnel=r.fresnel===true;
   if(['parabola','trough'].includes(o.type))o.focalLength=clamp(Math.abs(o.focalLength),.3,10000);
   if(o.type==='lens'&&Math.abs(o.focalLength)<.3)o.focalLength=o.focalLength<0?-.3:.3;
   if(o.type==='spherical')o.diameter=Math.min(o.diameter,o.radius*1.98);
   if(o.type==='aperture')o.hole=Math.min(o.hole,o.width,o.height);
  }
  return o;
 });
 const t=raw.settings||{};for(const k of ['normals','grid','animate','labels','foci','glow','extensions','snap','starMode','airyReference','spotAutoFit','showMeasurements'])if(typeof t[k]==='boolean')scene.settings[k]=t[k];
 scene.settings.maxBounces=Math.round(finite(t.maxBounces??12,1,32,'interaction limit'));scene.settings.maxDistance=finite(t.maxDistance??30,1,4_000_000,'ray length');scene.settings.density=finite(t.density??1,.25,8,'ray density');
 scene.settings.mmPerUnit=finite(t.mmPerUnit??50,.001,1_000_000,'world scale');
 scene.settings.rayOpacity=finite(t.rayOpacity??.82,.05,1,'ray opacity');scene.settings.rayWidth=finite(t.rayWidth??1,.4,3,'ray width');scene.settings.displayBudget=Math.round(finite(t.displayBudget??24000,1000,100000,'display budget'));
 scene.settings.rayStyle=['clarity','glow','bounce'].includes(t.rayStyle)?t.rayStyle:'clarity';
 scene.settings.rayStage=t.rayStage==='interacted'?'interacted':'all';
 scene.settings.primaryId=idMap.get(t.primaryId)||null;scene.settings.detectorId=idMap.get(t.detectorId)||null;
 scene.settings.hideStands=typeof t.hideStands==='boolean'?t.hideStands:!!t.starMode;
 scene.settings.background=['studio','midnight','slate'].includes(t.background)?t.background:'studio';
 scene.settings.incidentOpacity=finite(t.incidentOpacity??1,.05,1,'incoming ray opacity');
 scene.settings.spotCentroids=t.spotCentroids!==false;scene.settings.spotRms=t.spotRms===true;
 scene.settings.analysisSourceId=idMap.get(t.analysisSourceId)||null;
 scene.workspace=validateWorkspace(raw.workspace);
 return syncAimLocks(scene);
}

/** Power-weighted geometric spot statistics. Not a diffraction PSF. */
export function spotStatistics(hits){
 const useful=hits.filter(h=>h.energy>0&&h.local&&h.local.every(Number.isFinite));
 const power=useful.reduce((a,h)=>a+h.energy,0);if(!power)return {count:0,power:0,centroid:null,rms:null,radius80:null};
 const centroid=[0,1].map(i=>useful.reduce((a,h)=>a+h.local[i]*h.energy,0)/power);
 const radii=useful.map(h=>({r:Math.hypot(h.local[0]-centroid[0],h.local[1]-centroid[1]),e:h.energy})).sort((a,b)=>a.r-b.r);
 const rms=Math.sqrt(radii.reduce((a,h)=>a+h.r*h.r*h.e,0)/power);let sum=0,radius80=0;
 for(const q of radii){sum+=q.e;radius80=q.r;if(sum>=power*.8)break;}
 return {count:useful.length,power,centroid,rms,radius80};
}
/** Unobstructed circular-aperture diffraction reference; this does not diffract rays. */
export function telescopeReference(primary,mmPerUnit=50,wavelength=550){
 if(!primary||primary.type==='shaped')return null;const f=Math.abs(primary.type==='spherical'?primary.radius/2:primary.focalLength),D=primary.diameter;
 if(!(f>0&&D>0&&mmPerUnit>0))return null;
 const fmm=f*mmPerUnit,Dmm=D*mmPerUnit,lambdaMm=wavelength*1e-6;
 return {focalMm:fmm,diameterMm:Dmm,fNumber:f/D,plateScale:206264.806247/fmm,rayleighArcsec:1.22*lambdaMm/Dmm*206264.806247,airyRadiusWorld:1.22*lambdaMm*f/D/mmPerUnit};
}
/** Clipboard clone: internal links remap as a group; foreign external links release. */
export function cloneObjects(scene,payload,offset=[.7,0,.7]){
 if(!payload||payload.format!=='lumen-objects'||!Array.isArray(payload.objects)||!payload.objects.length)throw new Error('The clipboard does not contain Lumen objects.');
 if(scene.objects.length+payload.objects.length>80)throw new Error('Pasting would exceed the 80-object scene limit.');
 const checked=validateScene({version:3,objects:payload.objects,settings:{}}).objects;
 let next=1+Math.max(0,...scene.objects.map(o=>Number(o.id.slice(1))||0));const remap=new Map(payload.objects.map(o=>[o.id,'o'+next++]));
 return checked.map((o,i)=>{
  const raw=payload.objects[i],oldTarget=raw.aimTarget;
  if(o.type==='shaped'&&o.design){const link=id=>remap.get(id)||(payload.sceneUid===scene.uid&&scene.objects.some(t=>t.id===id)?id:null);o.design.sourceId=link(raw.design?.sourceId);o.design.detectorId=link(raw.design?.detectorId);o.design.live=false;}
  return {...o,id:remap.get(raw.id),name:(o.name+' copy').slice(0,60),p:o.p.map((v,k)=>clamp(v+offset[k],-POSITION_LIMIT,POSITION_LIMIT)),aimTarget:isSource(o)?remap.get(oldTarget)||(payload.sceneUid===scene.uid&&scene.objects.some(t=>t.id===oldTarget)?oldTarget:null):undefined};
 });
}

/* ---------------------- Inverse reflector design -----------------------
 * A physical, continuous conic is constructed, not per-ray steering.
 * The vertex/anchor and the aperture coordinate frame stay fixed.
 * Plane wave: d·q + |T-q| = |T|.  Finite point: |S-q|+|T-q| = |S|+|T|.
 * Both reduce to qᵀAq + l·q = 0 (the anchor q=0 is on the surface).
 * The aperture retains the single-valued branch through that anchor.
 */
const figureCache=new WeakMap();
export const matVec=(A,p)=>[0,1,2].map(i=>A[i*3]*p[0]+A[i*3+1]*p[1]+A[i*3+2]*p[2]);
export function quadricRoots(a,b,c){
 if(Math.abs(a)<1e-15)return Math.abs(b)<1e-15?[]:[-c/b];
 const D=b*b-4*a*c,tol=64*Number.EPSILON*(b*b+Math.abs(4*a*c)+1);
 if(D< -tol)return [];const sd=Math.sqrt(Math.max(0,D)),q=-.5*(b+(b>=0?sd:-sd));
 return Math.abs(q)<1e-25?[-b/(2*a)]:[q/a,c/q].sort((x,y)=>x-y);
}
export function validateFigure(raw){
 const vec=(p,label)=>{if(!Array.isArray(p)||p.length!==3||p.some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>4e6))throw new Error('Invalid inverse-mirror '+label+'.');return [...p];};
 if(!raw||!['paraboloid','ellipsoid'].includes(raw.kind))throw new Error('Invalid inverse-mirror figure.');
 const f={kind:raw.kind,target:vec(raw.target,'focus')};if(V.len(f.target)<.01)throw new Error('The focus must be away from the mirror anchor.');
 if(f.kind==='paraboloid'){f.incoming=vec(raw.incoming,'wavefront direction');const n=V.len(f.incoming);if(n<.99||n>1.01)throw new Error('The wavefront direction must be a unit vector.');f.incoming=V.unit(f.incoming);}
 else{f.source=vec(raw.source,'source focus');if(V.len(f.source)<.01)throw new Error('The source must be away from the mirror anchor.');}
 return f;
}
export function inverseQuadric(o){
 const f=o.figure;const cached=figureCache.get(f);if(cached)return cached;
 let A,l;
 if(f.kind==='paraboloid'){
  const d=f.incoming,R=V.len(f.target);A=Array.from({length:9},(_,i)=>(i%4===0?1:0)-d[Math.floor(i/3)]*d[i%3]);l=V.mul(V.sub(V.mul(d,R),f.target),2);
 }else{
  const S=f.source,T=f.target,m=V.mul(V.add(S,T),.5),a=(V.len(S)+V.len(T))/2,c=V.len(V.sub(T,S))/2,ratio=(a-c)*(a+c)/(a*a);
  if(!(ratio>1e-9))throw new Error('This geometry degenerates to a straight-through path. Move the detector off that line.');
  const e=c>1e-12?V.mul(V.sub(T,S),1/(2*c)):[0,0,1];A=Array.from({length:9},(_,i)=>(i%4===0?1:0)+(ratio-1)*e[Math.floor(i/3)]*e[i%3]);l=V.mul(matVec(A,m),-2);
 }
 const len=V.len(l);if(len<1e-10||Math.abs(l[2])/len<.025)throw new Error('The required surface is almost edge-on in this mount. Rotate the mount closer to the incident/reflected bisector.');
 const out={A,l,branch:Math.sign(l[2])};figureCache.set(f,out);return out;
}
export function inverseSag(o,x,y){
 const {A,l,branch}=inverseQuadric(o),b=2*(A[2]*x+A[5]*y)+l[2],c=A[0]*x*x+2*A[1]*x*y+A[4]*y*y+l[0]*x+l[1]*y;
 for(const z of quadricRoots(A[8],b,c))if(Number.isFinite(z)&&(2*A[8]*z+b)*branch>0){
  if(o.figure.kind==='paraboloid'&&V.len(o.figure.target)-V.dot(o.figure.incoming,[x,y,z])< -EPS)continue;
  return z;
 }
 return NaN;
}
export function onInversePatch(o,p){
 const q=inverseQuadric(o),gz=2*matVec(q.A,p)[2]+q.l[2];
 if(gz*q.branch<=1e-12)return false;
 if(o.figure.kind==='paraboloid'&&V.len(o.figure.target)-V.dot(o.figure.incoming,p)< -EPS)return false;
 return true;
}
/** Conservative discriminant bound over the complete circular aperture.
 * For these convex quadrics D is concave over the disk: its minimum lies on
 * the rim. A Lipschitz bound between rim samples avoids accepting a fold
 * that happens to lie between the sampled angles.
 */
export function validateInverseAperture(o){
 const {A,l}=inverseQuadric(o),R=o.diameter/2,a=A[8],N=720;
 const px=4*(l[2]*A[2]-a*l[0]),py=4*(l[2]*A[5]-a*l[1]);
 const hxx=4*(A[2]*A[2]-a*A[0]),hxy=4*(A[2]*A[5]-a*A[1]),hyy=4*(A[5]*A[5]-a*A[4]);
 const derivativeBound=R*Math.hypot(px,py)+2*R*R*Math.hypot(hxx,Math.SQRT2*hxy,hyy);
 let minD=Infinity,min=0,max=0,maxSlope=0;
 for(let i=0;i<N;i++){
  const x=R*Math.cos(i*2*Math.PI/N),y=R*Math.sin(i*2*Math.PI/N),D=l[2]*l[2]+px*x+py*y+hxx*x*x+2*hxy*x*y+hyy*y*y;
  minD=Math.min(minD,D);const z=inverseSag(o,x,y);
  if(!Number.isFinite(z))throw new Error('This surface folds inside the aperture. Reduce the mirror diameter or rotate its mount; no shape was applied.');
  min=Math.min(min,z);max=Math.max(max,z);const g=V.add(V.mul(matVec(A,[x,y,z]),2),l);maxSlope=Math.max(maxSlope,Math.hypot(g[0],g[1])/Math.abs(g[2]));
 }
 if(minD-derivativeBound*Math.PI/N<=1e-12*l[2]*l[2])throw new Error('The aperture reaches a grazing/folded part of the surface. Reduce its diameter or rotate the mount.');
 if(Math.max(Math.abs(min),Math.abs(max))>1e6)throw new Error('The required sag exceeds the supported surface extent.');
 // Interior samples also cover extrema away from the mount anchor/rim.
 for(let j=0;j<16;j++)for(let i=0;i<(j?96:1);i++){
  const x=R*j/16*Math.cos(i*2*Math.PI/96),y=R*j/16*Math.sin(i*2*Math.PI/96),z=inverseSag(o,x,y);
  if(!Number.isFinite(z))throw new Error('The inverse surface is not finite inside the aperture.');
  min=Math.min(min,z);max=Math.max(max,z);const g=V.add(V.mul(matVec(A,[x,y,z]),2),l);maxSlope=Math.max(maxSlope,Math.hypot(g[0],g[1])/Math.abs(g[2]));
 }
 return {minSag:min,maxSag:max,sagPV:max-min,maxSlope,sampled:true};
}
export function validateDesignBinding(raw,idMap){
 if(!raw)return null;
 const get=id=>typeof id==='string'?(idMap?.get(id)||null):null;
 const n=(v)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,-10000,10000):0;
 let original=null;
 if(raw.original&&['mirror','parabola','trough','spherical'].includes(raw.original.type)){
  // Restore only a small, explicit optical-property whitelist, never nested scenes.
  const r=raw.original,defaults=createObject(r.type);original={type:r.type};
  const limits={diameter:[.1,10000],width:[.01,10000],height:[.01,10000],focalLength:[.3,10000],radius:[.15,20000],reflectivity:[0,1]};
  for(const [k,[lo,hi]]of Object.entries(limits)){const v=typeof r[k]==='number'&&Number.isFinite(r[k])?r[k]:defaults[k];original[k]=clamp(k==='focalLength'?Math.abs(v):v,lo,hi);}
  if(r.type==='spherical')original.diameter=Math.min(original.diameter,original.radius*1.98);
  original.curvature=r.curvature==='convex'?'convex':'concave';
 }
 return {sourceId:get(raw.sourceId),detectorId:get(raw.detectorId),u:n(raw.u),v:n(raw.v),live:raw.live===true,original};
}
export function mirrorOriginal(o){
 if(o.type==='shaped'&&o.design?.original)return {...o,...o.design.original,figure:undefined,design:undefined};
 return JSON.parse(JSON.stringify(o));
}
function shapeOriginal(o){
 if(o.type==='shaped')return o.design?.original||null;
 const r={type:o.type};for(const k of ['diameter','width','height','focalLength','radius','reflectivity','curvature'])if(o[k]!==undefined)r[k]=o[k];return r;
}
export function designWavefront(source,frame){
 if(!source||!isSource(source))throw new Error('Choose an enabled light source.');
 if(!source.enabled||source.power<=0)throw new Error('Enable the source and give it nonzero power first.');
 if(['point','spot','fan'].includes(source.type))return {kind:'ellipsoid',source:localVec(V.sub(source.p,frame.p),basis(frame)),warnings:source.type==='fan'?['A planar fan does not sample the full 3D aperture. Validate with a spot or point source as well.']:[]};
 if(['beam','line','area'].includes(source.type)&&source.spread>1e-10)throw new Error('Set this source’s divergence to 0° for a plane-wave solve, or use a point/spot source for a finite-conjugate solve.');
 const sb=basis(source),d=source.type==='star'?worldVec(V.unit([Math.tan(rad(source.fieldX||0)),Math.tan(rad(source.fieldY||0)),1]),sb):sb.n;
 const warnings=[];if(source.type==='star'&&source.angularDiameter>0)warnings.push('The chief direction is corrected. An extended stellar disk keeps a finite image; its other directions are not stigmatic.');
 if(source.type==='laser'||source.type==='line')warnings.push('This source does not fill a 2D pupil. The analytic surface is valid, but the emitted rays alone do not test the full aperture.');
 return {kind:'paraboloid',incoming:localVec(d,basis(frame)),warnings};
}
export function designMirror(scene,{mirrorId,sourceId,detectorId,u=0,v=0,live=false}={}){
 syncAimLocks(scene);const mirror=scene.objects.find(o=>o.id===mirrorId),source=scene.objects.find(o=>o.id===sourceId),detector=scene.objects.find(o=>o.id===detectorId);
 if(!isMirror(mirror)||!mirror.enabled)throw new Error('Choose an enabled mirror.');
 if(mirror.locked)throw new Error('Unlock the mirror before changing its surface.');
 if(!detector||detector.type!=='detector'||!detector.enabled)throw new Error('Choose an enabled detector.');
 if(!Number.isFinite(u)||!Number.isFinite(v)||Math.abs(u)>detector.width/2||Math.abs(v)>detector.height/2)throw new Error('The target point must be inside the detector.');
 const targetWorld=V.add(detector.p,worldVec([u,v,0],basis(detector))),target=localVec(V.sub(targetWorld,mirror.p),basis(mirror));
 if(V.len(target)<.01)throw new Error('Move the detector away from the mirror anchor.');
 const wave=designWavefront(source,mirror),figure=validateFigure({...wave,target}),diameter=['mirror','trough'].includes(mirror.type)?Math.min(mirror.width,mirror.height):mirror.diameter;
 const result={...mirror,type:'shaped',diameter,figure,design:{sourceId,detectorId,u,v,live,original:shapeOriginal(mirror)}};
 const geometry=validateInverseAperture(result),warnings=[...wave.warnings];
 if(['mirror','trough'].includes(mirror.type))warnings.push('The rectangular aperture is replaced by its inscribed circular aperture.');
 if(detector.minDepth>1)warnings.push('This detector ignores a single reflection. Set “Record after interactions” to 1 or 0 to receive these rays.');
 if(Math.abs(V.dot(V.unit(V.sub(targetWorld,mirror.p)),basis(detector).n))<.05)throw new Error('The detector plane is grazing to the central reflected ray. Tilt it toward the mirror.');
 if(scene.objects.filter(o=>isSource(o)&&o.enabled&&o.power>0).length>1)warnings.push('One source/wavefront is corrected. Other field directions are still traced and may remain aberrated.');
 if(scene.objects.some(o=>o.enabled&&['lens','glass','splitter'].includes(o.type)))warnings.push('The solve assumes this source reaches the mirror directly in air. Upstream optics are not included in the wavefront constraint.');
 return {mirror:result,geometry,warnings,targetWorld};
}
export function designIsStale(scene,o){
 if(o.type!=='shaped'||!o.design)return false;
 try{const c=designMirror({...scene,objects:scene.objects.map(p=>p===o?{...p,locked:false}:p)},{mirrorId:o.id,...o.design}).mirror;
 const f=o.figure,g=c.figure;if(f.kind!==g.kind)return true;
 const scale=Math.max(1,V.len(f.target)),waveScale=f.kind==='paraboloid'?1:Math.max(1,V.len(f.source));return V.len(V.sub(f.target,g.target))>scale*1e-9||V.len(V.sub(f.kind==='paraboloid'?f.incoming:f.source,g.kind==='paraboloid'?g.incoming:g.source))>waveScale*1e-9;
 }catch{return true;}
}
/** Live re-solving is an explicit shape edit, not a ray-tracer steering rule. */
export function syncInverseDesigns(scene){
 const errors=[];for(let i=0;i<scene.objects.length;i++){
  const o=scene.objects[i];if(o.type!=='shaped'||!o.design?.live||o.locked)continue;
  try{const next=designMirror(scene,{mirrorId:o.id,...o.design}).mirror;if(JSON.stringify(next.figure)!==JSON.stringify(o.figure)||next.diameter!==o.diameter)scene.objects[i]=next;}
  catch(e){errors.push({id:o.id,message:e.message});}
 }
 return errors;
}
/** Identical, deterministic source samples are used before and after.
 * RMS is measured to the requested target on the INFINITE detector plane,
 * including samples outside its finite frame. Throughput is reported
 * separately and includes obstructions, path length and detector minDepth.
 * This is a one-reflection audit, not a multi-element optimizer.
 */
export function auditMirror(scene,mirror,source,detector,u=0,v=0,samples=2048){
 const s={...source,count:source.type==='laser'?1:samples},rays=emit(s,1,samples),db=basis(detector),mb=basis(mirror),points=[];
 const others=scene.objects.filter(o=>o.enabled&&!isSource(o)&&o.id!==mirror.id),otherFrames=others.map(basis);
 let illuminated=0,captured=0,blocked=0,missMirror=0,noForward=0,pathLimited=0,ignored=0,power=0;
 for(const ray of rays){
  const h=intersect(ray.p,ray.d,mirror,mb);if(!h){missMirror++;continue;}
  let obstructed=false;for(let i=0;i<others.length;i++){const o=others[i];if(o.type==='detector'&&o.minDepth>0)continue;const a=intersect(ray.p,ray.d,o,otherFrames[i]);if(a&&a.t<h.t-EPS*16){obstructed=true;break;}}
  if(obstructed){blocked++;continue;}illuminated++;
  const d=reflect(ray.d,h.normal),z=V.dot(V.sub(detector.p,h.point),db.n),den=V.dot(d,db.n),t=Math.abs(den)>1e-12?z/den:-1;
  if(!(t>EPS)){noForward++;continue;}
  const p=V.add(h.point,V.mul(d,t)),local=localVec(V.sub(p,detector.p),db),inside=Math.abs(local[0])<=detector.width/2+EPS&&Math.abs(local[1])<=detector.height/2+EPS;
  const limited=h.t+t>scene.settings.maxDistance||scene.settings.maxBounces<1;
  const start=V.add(h.point,V.mul(d,EPS*8));let afterBlocked=false;
  for(let i=0;i<others.length;i++){const o=others[i];if(o.id===detector.id||(o.type==='detector'&&o.minDepth>1))continue;const a=intersect(start,d,o,otherFrames[i]);if(a&&a.t<t-EPS*16){afterBlocked=true;break;}}
  const accepted=inside&&!limited&&!afterBlocked&&(detector.minDepth||0)<=1&&mirror.reflectivity>0;
  if(accepted){captured++;power+=ray.energy*mirror.reflectivity;}
  if(afterBlocked)blocked++;if(limited)pathLimited++;if(detector.minDepth>1)ignored++;
  points.push({u:local[0],v:local[1],captured:accepted,energy:ray.energy,rayIndex:ray.rayIndex});
 }
 const sum=points.reduce((a,p)=>a+p.energy,0),centroid=sum?[points.reduce((a,p)=>a+p.u*p.energy,0)/sum,points.reduce((a,p)=>a+p.v*p.energy,0)/sum]:null;
 const rms=sum?Math.sqrt(points.reduce((a,p)=>a+((p.u-u)**2+(p.v-v)**2)*p.energy,0)/sum):null;
 const spotRms=sum?Math.sqrt(points.reduce((a,p)=>a+((p.u-centroid[0])**2+(p.v-centroid[1])**2)*p.energy,0)/sum):null;
 const peak=points.length?Math.max(...points.map(p=>Math.hypot(p.u-u,p.v-v))):null;
 return {launched:rays.length,illuminated,captured,missMirror,blocked,noForward,pathLimited,ignored,power,rms,spotRms,peak,centroid,points};
}
/** Full-aperture independent check: design wavefront, not the display rays. */
export function auditFigure(o,rings=16,sectors=96){
 const f=o.figure,R=o.diameter/2;let maxMiss=0,lo=Infinity,hi=-Infinity,n=0,maxSlope=0;
 for(let j=0;j<=rings;j++)for(let i=0;i<(j?sectors:1);i++){
  const a=i*2*Math.PI/sectors,x=R*j/rings*Math.cos(a),y=R*j/rings*Math.sin(a),q=[x,y,surfaceZ(o,x,y)];
  const inc=f.kind==='paraboloid'?f.incoming:V.unit(V.sub(q,f.source)),out=reflect(inc,surfaceNormal(o,x,y)),t=V.sub(f.target,q),err=V.len(V.cross(t,out));
  if(V.dot(t,out)<=0)throw new Error('The surface sends a design ray away from the focus.');
  maxMiss=Math.max(maxMiss,err);const opl=(f.kind==='paraboloid'?V.dot(f.incoming,q):V.len(V.sub(q,f.source)))+V.len(t);lo=Math.min(lo,opl);hi=Math.max(hi,opl);n++;
  const normal=surfaceNormal(o,x,y);maxSlope=Math.max(maxSlope,Math.hypot(normal[0],normal[1])/Math.abs(normal[2]));
 }
 return {samples:n,maxMiss,oplPV:hi-lo,maxSlope};
}
/** Open surface tessellation for inspection, not a fabrication-ready solid. */
export function inverseSurfaceMesh(o,rings=32,sectors=128){
 const vertices=[[0,0,0]],normals=[surfaceNormal(o,0,0)],faces=[],R=o.diameter/2;
 for(let j=1;j<=rings;j++)for(let i=0;i<sectors;i++){const a=i*2*Math.PI/sectors,x=R*j/rings*Math.cos(a),y=R*j/rings*Math.sin(a);vertices.push([x,y,surfaceZ(o,x,y)]);normals.push(surfaceNormal(o,x,y));}
 for(let i=0;i<sectors;i++)faces.push([0,1+i,1+(i+1)%sectors]);
 for(let j=1;j<rings;j++)for(let i=0;i<sectors;i++){const a=1+(j-1)*sectors+i,b=1+(j-1)*sectors+(i+1)%sectors,c=a+sectors,d=b+sectors;faces.push([a,c,b],[b,c,d]);}
 return {vertices,normals,faces};
}

/** Camera/view metadata is optional; malformed metadata cannot invalidate optical geometry. */
export function validateWorkspace(raw) {
 const camera=c=>{
  if(!c||!Array.isArray(c.target)||c.target.length!==3||!c.target.every(Number.isFinite)||!['yaw','pitch','radius'].every(k=>Number.isFinite(c[k])))return null;
  return {target:c.target.map(v=>clamp(v,-2e6,2e6)),yaw:c.yaw%(Math.PI*2),pitch:clamp(c.pitch,-Math.PI/2+.00001,Math.PI/2-.00001),radius:clamp(c.radius,.1,5e6),orthographic:!!c.orthographic};
 };
 return {camera:camera(raw?.camera),views:Array.isArray(raw?.views)?raw.views.slice(0,8).flatMap((v,i)=>{
  const c=camera(v?.camera);return c?[{id:'v'+i,name:String(v.name||'View '+(i+1)).slice(0,40),camera:c}]:[];
 }):[],notes:typeof raw?.notes==='string'?raw.notes.slice(0,2000):'',monitor:raw?.monitor===true};
}
