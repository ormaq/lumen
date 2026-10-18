// Fixed scenes shared by correctness checks and the before/after benchmarks.
import {createPreset,createObject,isSource,designMirror} from '../tests/fixtures/performance/optics.js';

export function workloads() {
  const cases=[];
  const add=(name,preset,count,configure=()=>{})=>{
    const scene=createPreset(preset);
    scene.uid='performance-'+name;
    if(count)for(const o of scene.objects)if(isSource(o))o.count=count;
    configure(scene);
    cases.push({name,scene});
  };
  add('focus-default','focus');
  add('focus-16k','focus',16384);
  add('binary-32k','binary',16384);
  add('splitter-8k','splitter',8192);
  add('glass-fresnel-4k','glass',4096,s=>s.objects[1].fresnel=true);
  add('inverse-8k','inverse',8192,s=>s.objects[1]=designMirror(s,{mirrorId:'o2',sourceId:'o1',detectorId:'o3'}).mirror);
  add('finite-4k','finite',4096,s=>s.objects[1]=designMirror(s,{mirrorId:'o2',sourceId:'o1',detectorId:'o3'}).mirror);
  add('many-surfaces-2k','lens',2048,s=>{
    for(let i=0;i<48;i++)s.objects.push(createObject('mirror','extra-'+i,[i-24,30+i,20]));
  });
  return cases;
}
