import {test} from 'node:test';
import assert from 'node:assert/strict';
import {V,rad,basis,emit,aim,createObject,createPreset,traceScene,validateScene,syncAimLocks,cloneObjects,spotStatistics,telescopeReference,POSITION_LIMIT,MAX_SOURCE_RAYS,MAX_TOTAL_RAYS,SEGMENT_BUDGET} from '../src/optics.js';
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const vc=(a,b,tol=1e-8)=>a.forEach((x,i)=>close(x,b[i],tol));
const payload=(scene,objects=scene.objects)=>({format:'lumen-objects',sceneUid:scene.uid,objects});

test('Positions preserve ±1,000,000 world units in scene round-trips',()=>{
 const s=createPreset('focus');s.objects[0].p=[-POSITION_LIMIT,POSITION_LIMIT,100000];
 vc(validateScene(s).objects[0].p,s.objects[0].p);
});
test('The tracer works far outside the former 22-by-26 world boundary',()=>{
 for(const shift of [[0,1000,0],[100000,900000,-600000],[-5000,-8000,4000]]){
  const s=createPreset('focus');for(const o of s.objects)o.p=V.add(o.p,shift);
  const t=traceScene(validateScene(s));assert.equal(t.hits.length,37);assert.ok(t.segments.every(q=>q.a.every(Number.isFinite)&&q.b.every(Number.isFinite)));
 }
});
test('Long optical paths are not prematurely cut by fixed world bounds',()=>{
 const s=createPreset('empty');s.settings.maxDistance=20000;
 s.objects=[createObject('laser','o1',[-9000,1000,0]),createObject('detector','o2',[8000,1000,0])];
 close(traceScene(validateScene(s)).detectors.o2.power,1);
});
test('Per-source density grows to 16,384 samples without changing power',()=>{
 const s=createObject('beam');s.count=8192;s.power=2;
 const rays=emit(s,8);assert.equal(rays.length,MAX_SOURCE_RAYS);close(rays.reduce((n,r)=>n+r.energy,0),2);
});
test('Global ray budget is fair, finite and power-normalized per source',()=>{
 const s=createPreset('empty');s.objects=Array.from({length:5},(_,i)=>({...createObject('beam','o'+(i+1)),count:16384,power:i+1}));
 const t=traceScene(s);assert.ok(t.seeds<=MAX_TOTAL_RAYS);assert.ok(t.seedLimited);close(t.emittedPower,15,1e-9);
 for(const o of s.objects)close(t.segments.filter(q=>q.sourceId===o.id).reduce((n,r)=>n+r.energy,0),o.power,1e-9);
});
test('100,000-segment ceiling cannot be bypassed by scene input',()=>{
 const s=createPreset('focus');s.settings.segmentBudget=100000000;
 assert.ok(traceScene(s).segments.length<=SEGMENT_BUDGET);
});
test('Persistent aim follows the target and the source in all three dimensions',()=>{
 const s=createPreset('focus');s.objects[0].aimTarget='o2';
 for(const a of [[3,10,-3],[12,1000,16]]){s.objects[1].p=a;syncAimLocks(s);vc(basis(s.objects[0]).n,V.unit(V.sub(a,s.objects[0].p)));}
 s.objects[0].p=[50,60,70];syncAimLocks(s);vc(basis(s.objects[0]).n,V.unit(V.sub(s.objects[1].p,s.objects[0].p)));
});
test('Removing an aim target releases the link and retains orientation',()=>{
 const s=createPreset('focus');s.objects[0].aimTarget='o2';syncAimLocks(s);const before=basis(s.objects[0]).n;
 s.objects.pop();syncAimLocks(s);assert.equal(s.objects[0].aimTarget,null);vc(basis(s.objects[0]).n,before);
});
test('Coincident target centers do not generate invalid orientation',()=>{
 const s=createPreset('focus');s.objects[0].aimTarget='o2';s.objects[1].p=[...s.objects[0].p];const n=basis(s.objects[0]).n;syncAimLocks(s);vc(basis(s.objects[0]).n,n);
});
test('Scene validation remaps arbitrary object IDs and target references together',()=>{
 const s=createPreset('focus');s.objects[0].id='source-custom';s.objects[1].id='mirror-custom';s.objects[0].aimTarget='mirror-custom';s.settings.primaryId='mirror-custom';
 const q=validateScene(s);assert.equal(q.objects[0].aimTarget,'o2');assert.equal(q.settings.primaryId,'o2');
});
test('Self links and unknown links release; duplicate IDs are rejected',()=>{
 const s=createPreset('focus');s.objects[0].aimTarget='o1';assert.equal(validateScene(s).objects[0].aimTarget,null);
 s.objects[0].aimTarget='nonexistent';assert.equal(validateScene(s).objects[0].aimTarget,null);
 s.objects[1].id='o1';assert.throws(()=>validateScene(s),/Duplicate/);
});
test('Copying a group remaps internal aim links to the copied target',()=>{
 const s=createPreset('focus');s.objects[0].aimTarget='o2';const copies=cloneObjects(s,payload(s));
 assert.equal(copies[0].id,'o3');assert.equal(copies[1].id,'o4');assert.equal(copies[0].aimTarget,'o4');vc(copies[0].p,V.add(s.objects[0].p,[.7,0,.7]));
 assert.equal(s.objects.length,2); // cloning is non-mutating
});
test('Single source paste preserves external target only in its own scene',()=>{
 const s=createPreset('focus');s.objects[0].aimTarget='o2';const c=payload(s,[s.objects[0]]);
 assert.equal(cloneObjects(s,c)[0].aimTarget,'o2');
 const foreign=createPreset('focus');assert.equal(cloneObjects(foreign,c)[0].aimTarget,null);
});
test('Paste in place retains every coordinate and optical property',()=>{
 const s=createPreset('binary');const copies=cloneObjects(s,payload(s),[0,0,0]);
 copies.forEach((o,i)=>{vc(o.p,s.objects[i].p);assert.equal(o.type,s.objects[i].type);assert.equal(o.count,s.objects[i].count);});
});
test('Clipboard validation rejects malformed, over-limit and NaN payloads',()=>{
 const s=createPreset('empty');assert.throws(()=>cloneObjects(s,{}));
 assert.throws(()=>cloneObjects(s,{format:'lumen-objects',objects:Array(81).fill(createObject('mirror'))}));
 const o=createObject('mirror');o.p[1]=NaN;assert.throws(()=>cloneObjects(s,payload(s,[o])));
});
test('A point star emits parallel rays at a specified angular field',()=>{
 const s={...createObject('star'),fieldX:1.1,fieldY:-.4,count:300};const rays=emit(s);
 for(const r of rays)vc(r.d,rays[0].d);assert.ok(V.len(V.sub(rays[0].p,rays[100].p))>.1);
});
test('On-axis stellar rays form a geometric point on the virtual focal plane',()=>{
 const t=traceScene(createPreset('star')),d=t.detectors.o3;
 assert.equal(d.count,768);close(d.power,1);assert.ok(spotStatistics(d.hits).rms<1e-10);
 assert.ok(d.hits.every(h=>h.depth===1));
});
test('Off-axis star produces coma without launch-plane sampling vignetting',()=>{
 const t=traceScene(createPreset('coma')),st=spotStatistics(t.detectors.o3.hits);
 assert.equal(st.count,768);assert.ok(st.rms>1e-4);assert.ok(st.centroid[0]>.2);
});
test('Moving a target-locked star launch plane does not move its pupil or focal spot',()=>{
 const s=createPreset('coma'),first=traceScene(s);s.objects[0].p[1]+=250;s.settings.maxDistance=400;
 const second=traceScene(s);assert.equal(second.detectors.o3.count,768);
 for(let i=0;i<768;i++)vc(second.detectors.o3.hits[i].local,first.detectors.o3.hits[i].local,1e-9);
});
test('Finite star disk has a finite angular extent and geometric focal footprint',()=>{
 const s=createPreset('star');s.objects[0].angularDiameter=60;const t=traceScene(s),st=spotStatistics(t.detectors.o3.hits);
 assert.equal(st.count,768);const expected=12*Math.tan(rad(30/3600))/Math.sqrt(2);close(st.rms,expected,expected*.12);
});
test('Double-star scene records both independent colored sources',()=>{
 const t=traceScene(createPreset('binary'));assert.equal(t.detectors.o3.count,1536);close(t.detectors.o3.power,2);
 const a=spotStatistics(t.detectors.o3.hits.filter(h=>h.sourceId==='o1')),b=spotStatistics(t.detectors.o3.hits.filter(h=>h.sourceId==='o4'));
 assert.ok(a.centroid[0]<0&&b.centroid[0]>0);assert.ok(a.rms<Math.abs(a.centroid[0])*.1);
});
test('Detector encounter gate distinguishes a virtual image plane from a physical blocker',()=>{
 const s=createPreset('star');s.objects[2].minDepth=0;s.objects[2].width=5;s.objects[2].height=5;const t=traceScene(s);
 assert.equal(t.hits.filter(h=>h.type==='parabola').length,0);assert.ok(t.detectors.o3.hits.every(h=>h.depth===0));
});
test('Weighted spot statistics calculate centroid, RMS and 80% encircled radius',()=>{
 const st=spotStatistics([{local:[0,0,0],energy:1},{local:[2,0,0],energy:3}]);
 vc(st.centroid,[1.5,0]);close(st.rms,Math.sqrt(.75));close(st.radius80,1.5);assert.equal(spotStatistics([]).centroid,null);
});
test('Telescope scaling converts focal length, plate scale and Airy reference consistently',()=>{
 const s=createPreset('star'),r=telescopeReference(s.objects[1],50,550);
 close(r.diameterMm,200);close(r.focalMm,600);close(r.fNumber,3);close(r.plateScale,206264.806247/600);close(r.airyRadiusWorld*50,1.22*.00055*3);
 const r2=telescopeReference(s.objects[1],100,550);close(r2.plateScale,r.plateScale/2);close(r2.rayleighArcsec,r.rayleighArcsec/2);
});
test('Version 2 scenes import into version 5 without altering optical geometry',()=>{
 const s=createPreset('focus');s.version=2;delete s.uid;const v=validateScene(s);
 assert.equal(v.version,5);assert.equal(traceScene(v).hits.length,37);assert.equal(v.settings.rayStyle,'clarity');
});
test('Source aim locks and telescope settings survive JSON round trips',()=>{
 const s=createPreset('binary');s.settings.mmPerUnit=100;s.settings.rayStage='interacted';s.settings.rayStyle='bounce';
 const q=validateScene(JSON.parse(JSON.stringify(s)));assert.equal(q.objects[3].aimTarget,'o2');assert.equal(q.settings.detectorId,'o3');assert.equal(q.settings.mmPerUnit,100);assert.equal(q.settings.rayStage,'interacted');
});
