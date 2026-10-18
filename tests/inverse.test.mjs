import test from 'node:test';
import assert from 'node:assert/strict';
import {V,basis,worldVec,localVec,aim,reflect,createObject,createPreset,designMirror,designIsStale,syncInverseDesigns,auditMirror,auditFigure,inverseSurfaceMesh,inverseQuadric,surfaceZ,surfaceNormal,intersect,focalPoints,traceScene,validateScene,cloneObjects,mirrorOriginal,validateInverseAperture,telescopeReference} from '../src/optics.js';
const clone=o=>JSON.parse(JSON.stringify(o));
const close=(x,y,t=1e-9)=>assert.ok(Math.abs(x-y)<t,`${x} != ${y}`);
const vec=(a,b,t=1e-9)=>a.forEach((v,i)=>close(v,b[i],t));
const solve=(s,opts={})=>designMirror(s,{mirrorId:'o2',sourceId:'o1',detectorId:'o3',...opts});
const replace=(s,m)=>(s.objects[1]=m,s);

test('Inverse figure equals the ordinary parabola for on-axis focus',()=>{
 const s=createPreset('star'),m=solve(s).mirror,old=s.objects[1];
 for(let x=-1;x<=1;x+=.25)for(let y=-1;y<=1;y+=.25)close(surfaceZ(m,x,y),surfaceZ(old,x,y),1e-12);
});
test('Off-axis correction puts every probe on the target instead of a smear',()=>{
 const s=createPreset('inverse'),r=solve(s),before=auditMirror(s,s.objects[1],s.objects[0],s.objects[2]),after=auditMirror(s,r.mirror,s.objects[0],s.objects[2]);
 assert.ok(before.rms>.9);assert.ok(after.rms<1e-10);assert.equal(after.captured,2048);assert.equal(after.illuminated,2048);
});
test('Actual forward tracer, not a steering override, records all corrected rays',()=>{
 const s=createPreset('inverse');replace(s,solve(s).mirror);const t=traceScene(s);assert.equal(t.detectors.o3.count,1024);
 t.detectors.o3.hits.forEach(h=>assert.ok(Math.hypot(...h.local)<1e-10));
 for(const h of t.hits.filter(h=>h.objectId==='o2'))vec(h.outgoing,reflect(h.incoming,h.normal));
});
test('Finite source creates an ellipsoid and retains a measurable source capture fraction',()=>{
 const s=createPreset('finite'),m=solve(s).mirror;assert.equal(m.figure.kind,'ellipsoid');const a=auditMirror(s,m,s.objects[0],s.objects[2]);
 assert.ok(a.captured>1800&&a.captured<2048);assert.ok(a.rms<1e-10);assert.ok(auditFigure(m).oplPV<1e-10);
});
test('The mirror anchor, mount Euler angles, and all other objects stay fixed',()=>{
 const s=createPreset('inverse'),before=clone(s),m=solve(s).mirror;
 vec(m.p,before.objects[1].p);for(const k of ['yaw','tilt','roll','diameter','reflectivity'])assert.equal(m[k],before.objects[1][k]);
 // Aim locks may materialize orientation metadata; positions never change.
 s.objects.forEach((o,i)=>vec(o.p,before.objects[i].p));
});
test('A nonzero star field angle is used in the wavefront solve',()=>{
 const s=createPreset('coma'),m=solve(s).mirror;const a=auditMirror(s,m,s.objects[0],s.objects[2]);assert.ok(a.rms<1e-10);
 const incoming=worldVec(m.figure.incoming,basis(m));assert.ok(Math.abs(incoming[0])>.01);
});
test('A tilted and rolled detector can use an off-center target in its local coordinates',()=>{
 const s=createPreset('inverse');s.objects[2].roll+=29;s.objects[2].tilt+=15;const u=.55,v=-.37,m=solve(s,{u,v}).mirror;
 const a=auditMirror(s,m,s.objects[0],s.objects[2],u,v);assert.ok(a.rms<1e-10);assert.equal(a.captured,2048);
 vec(focalPoints(m)[0],V.add(s.objects[2].p,worldVec([u,v,0],basis(s.objects[2]))));
});
test('Rotating the detector about the central target does not change the solved figure',()=>{
 const s=createPreset('inverse'),a=solve(s).mirror;s.objects[2].roll+=47;s.objects[2].tilt+=8;const b=solve(s).mirror;
 vec(a.figure.target,b.figure.target);vec(a.figure.incoming,b.figure.incoming);
});
test('An extended star stays extended; the solver does not claim a point image',()=>{
 const s=createPreset('inverse');s.objects[0].angularDiameter=120;const r=solve(s),a=auditMirror(s,r.mirror,s.objects[0],s.objects[2]);
 assert.ok(r.warnings.some(w=>w.includes('extended')));assert.ok(a.rms>1e-4);assert.ok(auditFigure(r.mirror).maxMiss<1e-10);
});
test('A second source direction is reflected by the same geometry, not collapsed to the design target',()=>{
 const s=createPreset('binary'),m=solve(s).mirror;replace(s,m);s.objects[3].fieldX=1;
 const t=traceScene(s),a=t.detectors.o3.hits.filter(h=>h.sourceId==='o1'),b=t.detectors.o3.hits.filter(h=>h.sourceId==='o4');
 assert.equal(a.length,768);assert.equal(b.length,768);assert.ok(a.every(h=>Math.hypot(...h.local)<1e-10));assert.ok(b.some(h=>Math.hypot(...h.local)>.1));
});
test('Inverse normal agrees with finite-difference derivatives of the actual sag',()=>{
 for(const name of ['inverse','finite']){const m=solve(createPreset(name)).mirror;for(const [x,y]of [[.4,.7],[-1.1,.3],[1.7,-.8]]){
  const h=1e-5,dx=(surfaceZ(m,x+h,y)-surfaceZ(m,x-h,y))/(2*h),dy=(surfaceZ(m,x,y+h)-surfaceZ(m,x,y-h))/(2*h),a=V.unit([-dx,-dy,1]),b=surfaceNormal(m,x,y);assert.ok(Math.abs(V.dot(a,b))>1-1e-10);
 }}
});
test('Design rays obey reversibility at the solved surface',()=>{
 for(const name of ['inverse','finite']){const m=solve(createPreset(name)).mirror,q=[.6,-.8,surfaceZ(m,.6,-.8)],n=surfaceNormal(m,.6,-.8),f=m.figure;
 const d=f.kind==='paraboloid'?f.incoming:V.unit(V.sub(q,f.source)),out=reflect(d,n);vec(reflect(V.mul(out,-1),n),V.mul(d,-1));}
});
test('Only the chosen near-anchor ellipsoid patch is traced, never its far wall',()=>{
 const s=createPreset('finite'),m=solve(s).mirror,b=basis(m),near=surfaceZ(m,0,0),origin=V.add(m.p,worldVec([0,0,-5],b)),d=b.n,h=intersect(origin,d,m);
 assert.ok(h);close(h.local[2],near);assert.ok(h.local[2]<1e-8);
 const fromInside=V.add(m.p,worldVec([0,0,.1],b));assert.equal(intersect(fromInside,b.n,m),null);
});
test('The clear aperture rejects intersections outside its circular rim',()=>{
 const s=createPreset('star'),m=solve(s).mirror,b=basis(m),p=V.add(m.p,worldVec([m.diameter/2+.01,0,5],b));assert.equal(intersect(p,V.mul(b.n,-1),m),null);
});
test('A near-axis quadratic handles perfectly axial ray intersections',()=>{
 const m=createObject('shaped'),b=basis(m),p=V.add(m.p,V.mul(b.n,10)),h=intersect(p,V.mul(b.n,-1),m);assert.ok(h);vec(h.point,m.p);
});
test('Million-unit world coordinates retain a focused local figure',()=>{
 const s=createPreset('inverse');for(const o of s.objects)o.p=V.add(o.p,[800000,950000,-700000]);const m=solve(s).mirror,a=auditMirror(s,m,s.objects[0],s.objects[2]);assert.ok(a.rms<1e-7);assert.equal(a.captured,2048);
});
test('A frozen surface remains rigid and becomes stale when its detector moves',()=>{
 const s=createPreset('inverse');replace(s,solve(s).mirror);const f=clone(s.objects[1].figure);s.objects[2].p[2]-=1;assert.equal(designIsStale(s,s.objects[1]),true);traceScene(s);assert.deepEqual(s.objects[1].figure,f);
 assert.ok(auditMirror(s,s.objects[1],s.objects[0],s.objects[2]).rms>.1);
});
test('Explicit live correction changes the stored surface and follows a moved target',()=>{
 const s=createPreset('inverse');replace(s,solve(s,{live:true}).mirror);const f=clone(s.objects[1].figure);s.objects[2].p[2]-=1;
 assert.deepEqual(syncInverseDesigns(s),[]);assert.notDeepEqual(s.objects[1].figure,f);assert.equal(designIsStale(s,s.objects[1]),false);assert.ok(auditMirror(s,s.objects[1],s.objects[0],s.objects[2]).rms<1e-10);
});
test('A failed live solve preserves the last valid surface and returns an error',()=>{
 const s=createPreset('inverse');replace(s,solve(s,{live:true}).mirror);const f=clone(s.objects[1].figure);s.objects[2].p=[...s.objects[1].p];
 assert.equal(syncInverseDesigns(s).length,1);assert.deepEqual(s.objects[1].figure,f);assert.equal(designIsStale(s,s.objects[1]),true);
});
test('Locked mirrors reject an explicit solve and do not live-reshape',()=>{
 const s=createPreset('inverse');s.objects[1].locked=true;assert.throws(()=>solve(s),/Unlock/);s.objects[1].locked=false;replace(s,solve(s,{live:true}).mirror);s.objects[1].locked=true;const f=clone(s.objects[1].figure);s.objects[2].p[2]-=1;syncInverseDesigns(s);assert.deepEqual(f,s.objects[1].figure);
});
test('Invalid targets, dark sources and zero-distance geometry are rejected',()=>{
 for(const modify of [s=>s.objects[0].enabled=false,s=>s.objects[0].power=0,s=>s.objects[2].enabled=false,s=>s.objects[2].p=[...s.objects[1].p]]){const s=createPreset('inverse');modify(s);assert.throws(()=>solve(s));}
 assert.throws(()=>solve(createPreset('inverse'),{u:3}),/inside/);assert.throws(()=>solve(createPreset('inverse'),{v:NaN}));
});
test('Divergent distributed emitters are rejected instead of being treated as parallel light',()=>{
 const s=createPreset('inverse');s.objects[0].type='beam';s.objects[0].spread=3;assert.throws(()=>solve(s),/divergence/);
});
test('Planar fan source warns that it does not empirically sample a 3D aperture',()=>{
 const s=createPreset('finite');s.objects[0].type='fan';assert.ok(solve(s).warnings.some(w=>w.includes('fan')));
});
test('Whole-aperture validation rejects a folded or grazing height field',()=>{
 const s=createPreset('inverse'),m=solve(s).mirror;m.diameter=500;assert.throws(()=>validateInverseAperture(m),/fold|grazing/);
});
test('Degenerate straight-through ellipsoid is rejected',()=>{
 const m=createObject('shaped');m.figure={kind:'ellipsoid',source:[0,0,-5],target:[0,0,5]};assert.throws(()=>inverseQuadric(m),/straight-through/);
});
test('Constant optical path is independently checked over both full apertures',()=>{
 for(const name of ['inverse','finite']){const a=auditFigure(solve(createPreset(name)).mirror);assert.equal(a.samples,1537);assert.ok(a.oplPV<1e-10);assert.ok(a.maxMiss<1e-10);}
});
test('Blocking the input produces no metric, not a bogus zero-radius success',()=>{
 const s=createPreset('inverse'),m=solve(s).mirror;s.objects.push({...createObject('blocker','o4',[-5,5,0]),width:20,height:20});const a=auditMirror(s,m,s.objects[0],s.objects[2]);assert.equal(a.illuminated,0);assert.equal(a.captured,0);assert.equal(a.rms,null);assert.equal(a.blocked,2048);
});
test('Path limits and detector thresholds cannot hide zero throughput behind a small spot',()=>{
 const s=createPreset('inverse'),m=solve(s).mirror;s.settings.maxDistance=2;let a=auditMirror(s,m,s.objects[0],s.objects[2]);assert.equal(a.captured,0);assert.equal(a.pathLimited,2048);
 s.settings.maxDistance=45;s.objects[2].minDepth=2;a=auditMirror(s,m,s.objects[0],s.objects[2]);assert.equal(a.captured,0);assert.equal(a.ignored,2048);
});
test('Missing the mirror returns null spot errors',()=>{
 const s=createPreset('inverse'),m=solve(s).mirror;s.objects[0].p[2]+=50;s.objects[0].aimTarget=null;const a=auditMirror(s,m,s.objects[0],s.objects[2]);assert.equal(a.rms,null);assert.equal(a.captured,0);assert.equal(a.missMirror,2048);
});
test('The mirror audit does not discard rays outside a small detector to improve RMS',()=>{
 const s=createPreset('inverse');s.objects[2].width=.1;s.objects[2].height=.1;const a=auditMirror(s,s.objects[1],s.objects[0],s.objects[2]);assert.ok(a.rms>.9);assert.ok(a.captured<20);assert.equal(a.points.length,2048);
});
test('Reflectivity affects collected power, never the geometric surface solve',()=>{
 const s=createPreset('inverse');s.objects[1].reflectivity=.37;const m=solve(s).mirror,a=auditMirror(s,m,s.objects[0],s.objects[2]);close(a.power,.37,1e-12);assert.ok(a.rms<1e-10);
});
test('Solved surfaces and bindings survive V5 scene serialization',()=>{
 const s=createPreset('inverse');replace(s,solve(s,{live:true,u:.2,v:.1}).mirror);const q=validateScene(clone(s));assert.equal(q.version,5);assert.equal(q.objects[1].design.detectorId,'o3');assert.equal(q.objects[1].design.live,true);vec(q.objects[1].figure.target,s.objects[1].figure.target);assert.equal(traceScene(q).detectors.o3.count,1024);
});
test('Stored surface normals and trace do not depend on source/target bindings',()=>{
 const s=createPreset('inverse');replace(s,solve(s).mirror);const initial=traceScene(s).detectors.o3.count;delete s.objects[1].design;assert.equal(traceScene(s).detectors.o3.count,initial);
});
test('Deleting a design target leaves a valid saved rigid surface',()=>{
 const s=createPreset('inverse');replace(s,solve(s).mirror);s.objects.pop();const q=validateScene(clone(s));assert.equal(q.objects[1].design.detectorId,null);assert.ok(auditFigure(q.objects[1]).maxMiss<1e-10);
});
test('Group copy remaps both inverse bindings; pasted shapes start frozen',()=>{
 const s=createPreset('inverse');replace(s,solve(s,{live:true}).mirror);const copies=cloneObjects(s,{format:'lumen-objects',sceneUid:s.uid,objects:s.objects});const m=copies[1];assert.equal(m.design.sourceId,copies[0].id);assert.equal(m.design.detectorId,copies[2].id);assert.equal(m.design.live,false);vec(m.figure.target,s.objects[1].figure.target);
});
test('Cross-scene mirror-only copy releases external design references',()=>{
 const s=createPreset('inverse');replace(s,solve(s,{live:true}).mirror);const other=createPreset('empty'),m=cloneObjects(other,{format:'lumen-objects',sceneUid:s.uid,objects:[s.objects[1]]})[0];assert.equal(m.design.sourceId,null);assert.equal(m.design.detectorId,null);assert.equal(m.design.live,false);assert.ok(auditFigure(m).maxMiss<1e-10);
});
test('Restore original returns the true old parabola and preserves the current mount transform',()=>{
 const s=createPreset('inverse'),before=clone(s.objects[1]),m=solve(s).mirror;m.p[1]+=10;const old=mirrorOriginal(m);assert.equal(old.type,'parabola');assert.equal(old.focalLength,before.focalLength);assert.equal(old.figure,undefined);assert.equal(old.p[1],before.p[1]+10);
});
test('Malicious or nonfinite serialized figures cannot enter the renderer',()=>{
 const s=createPreset('inverse');replace(s,solve(s).mirror);
 for(const modify of [o=>o.figure.target=[Infinity,0,1],o=>o.figure.incoming=[0,0,0],o=>o.figure.kind='javascript',o=>o.figure.target=[0,0,0],o=>o.figure=null]){const q=clone(s);modify(q.objects[1]);assert.throws(()=>validateScene(q));}
});
test('Directly added inverse reflector is a valid default analytic surface',()=>{
 const s=createPreset('empty');s.objects.push(createObject('shaped'));const q=validateScene(clone(s));assert.ok(auditFigure(q.objects[0]).maxMiss<1e-10);
});
test('Surface export has finite points, unit normals and a connected circular triangulation',()=>{
 for(const name of ['inverse','finite']){const m=solve(createPreset(name)).mirror,mesh=inverseSurfaceMesh(m);assert.equal(mesh.vertices.length,4097);assert.equal(mesh.faces.length,8064);mesh.vertices.forEach(p=>assert.ok(p.every(Number.isFinite)));mesh.normals.forEach(n=>close(V.len(n),1));mesh.faces.forEach(f=>assert.ok(f.every(i=>i>=0&&i<mesh.vertices.length)));}
});
test('An arbitrary inverse reflector does not inherit an invalid on-axis Airy reference',()=>{assert.equal(telescopeReference(solve(createPreset('inverse')).mirror),null);});
test('Rectangular mirror conversion reports an inscribed circular aperture',()=>{
 const s=createPreset('inverse');s.objects[1].type='mirror';s.objects[1].width=6;s.objects[1].height=5;const r=solve(s);assert.equal(r.mirror.diameter,5);assert.ok(r.warnings.some(w=>w.includes('inscribed')));
});
test('Randomized non-axis-aligned point and plane wave geometries focus across the entire aperture',()=>{
 let seed=341;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(let i=0;i<35;i++){
  const s=createPreset('inverse'),P=[rand()*20-10,rand()*20,rand()*20-10],dir=V.unit([rand()-.5,rand()-.5,rand()-.5]),out=V.unit(V.add(V.mul(dir,-1),[rand()-.5,rand()-.5,rand()-.5]));
  const S=V.sub(P,V.mul(dir,12+rand()*10)),T=V.add(P,V.mul(out,8+rand()*9));s.objects[0].p=S;s.objects[0].type=i%2?'spot':'star';s.objects[1].p=P;s.objects[1].diameter=2+rand();s.objects[2].p=T;
  aim(s.objects[1],V.add(P,V.unit(V.sub(out,dir))));s.objects[1].roll=rand()*180-90;aim(s.objects[2],P);const r=solve(s);assert.ok(auditFigure(r.mirror,6,32).maxMiss<1e-10);
 }
});

test('Sampled sag bounds include interior extrema, not just rim and anchor',()=>{
 const m=createObject('shaped');m.figure={kind:'paraboloid',incoming:[0,0,-1],target:[.6,0,3]};
 const g=validateInverseAperture(m);assert.ok(g.sampled);assert.ok(g.minSag<-.02);assert.ok(g.maxSag>0);
});
test('Far-away focus does not weaken the source-direction stale tolerance',()=>{
 const s=createPreset('inverse');s.objects[0].p=[0,3,10];s.objects[0].aimTarget=null;s.objects[0].yaw=180;s.objects[0].tilt=0;
 s.objects[1].p=[0,3,0];s.objects[1].yaw=0;s.objects[1].tilt=0;s.objects[1].roll=0;s.objects[2].p=[0,3,1000000];s.objects[2].yaw=180;s.objects[2].tilt=0;
 replace(s,solve(s).mirror);assert.equal(designIsStale(s,s.objects[1]),false);s.objects[0].yaw+=.01;assert.equal(designIsStale(s,s.objects[1]),true);
});
test('Imported original-surface metadata cannot restore a zero-focus or invalid spherical cap',()=>{
 const s=createPreset('inverse');replace(s,solve(s).mirror);s.objects[1].design.original={type:'parabola',focalLength:0,diameter:99};
 let o=mirrorOriginal(validateScene(clone(s)).objects[1]);assert.equal(o.focalLength,.3);assert.ok(Number.isFinite(surfaceZ(o,1,1)));
 s.objects[1].design.original={type:'spherical',radius:0,diameter:9900};o=mirrorOriginal(validateScene(clone(s)).objects[1]);assert.equal(o.radius,.15);assert.ok(o.diameter<o.radius*2);
});
