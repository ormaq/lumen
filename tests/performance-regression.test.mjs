import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {traceScene,createPreset,PRESETS} from '../src/optics.js';
import {traceScene as baselineTrace} from './fixtures/performance/optics.js';
import {Renderer} from '../src/renderer.js';
import {Renderer as BaselineRenderer} from './fixtures/performance/renderer.js';
import {workloads} from '../benchmarks/workloads.mjs';
import {buildHtml} from '../build.mjs';

for(const {name,scene} of workloads())test(`Optimized trace exactly matches baseline: ${name}`,()=>{
  assert.deepEqual(traceScene(structuredClone(scene)),baselineTrace(structuredClone(scene)));
});
test('Every default preset retains all ray paths and detector measurements',()=>{
  for(const name of Object.keys(PRESETS)){
    const scene=createPreset(name);
    assert.deepEqual(traceScene(structuredClone(scene)),baselineTrace(structuredClone(scene)),name);
  }
});
test('Retracing changed, disabled and capped scenes never reuses stale optical data',()=>{
  const scene=createPreset('binary');
  for(const mutate of [s=>s.objects[0].fieldX=1.2,s=>s.objects[1].p[0]+=.2,s=>s.objects[3].enabled=false,s=>s.settings.segmentBudget=37]){
    mutate(scene);
    assert.deepEqual(traceScene(structuredClone(scene)),baselineTrace(structuredClone(scene)));
  }
});

// Record the real renderer's WebGL commands, without depending on GPU speed.
function recordingRenderer(Type=Renderer){
  const records={uploads:[],draws:[],deleted:[]};let id=0,bound;
  const gl={ARRAY_BUFFER:1,FLOAT:2,STATIC_DRAW:3,DYNAMIC_DRAW:4,TRIANGLES:5,POINTS:6,
    createBuffer:()=>++id,bindBuffer:(_target,buffer)=>bound=buffer,
    bufferData:(_target,data,usage)=>records.uploads.push({buffer:bound,data:[...data],usage}),
    drawArrays:(mode,_first,count)=>records.draws.push({buffer:bound,mode,count}),
    deleteBuffer:buffer=>records.deleted.push(buffer)};
  for(const key of ['useProgram','enableVertexAttribArray','vertexAttribPointer','uniformMatrix4fv','uniform1f','disableVertexAttribArray'])gl[key]=()=>{};
  const r=Object.assign(Object.create(Type.prototype),{gl,batchProgram:{},batchLoc:{},batchBuffer:0,program:{},vp:new Float32Array(16)});
  return {r,records};
}
globalThis.window={devicePixelRatio:1};
test('120 static ray frames use one upload and retain all 120 draws',()=>{
  const vertices=new Float32Array(42).fill(.25),old=recordingRenderer(BaselineRenderer),next=recordingRenderer();
  for(let i=0;i<120;i++){old.r.batch(vertices,false,4,'rays');next.r.batch(vertices,false,4,'rays');}
  assert.equal(old.records.uploads.length,120);
  assert.equal(next.records.uploads.length,1);
  assert.deepEqual(next.records.draws.map(d=>[d.mode,d.count]),old.records.draws.map(d=>[d.mode,d.count]));
  assert.deepEqual(next.records.uploads[0].data,old.records.uploads[0].data);
});
test('Camera/geometry replacements refresh a slot without accumulating GPU buffers',()=>{
  const {r,records}=recordingRenderer();
  for(let i=0;i<100;i++)r.batch(new Float32Array(42).fill(i),false,4,'core');
  assert.equal(records.uploads.length,100);
  assert.equal(new Set(records.uploads.map(u=>u.buffer)).size,1);
  assert.equal(r.batchCache.size,1);
  assert.ok(records.uploads.at(-1).data.every(n=>n===99));
});
test('Core, glow and extensions retain distinct buffers while animated dots stream',()=>{
  const {r,records}=recordingRenderer(),a=new Float32Array(42),dots=new Float32Array(7);
  for(let i=0;i<3;i++){
    for(const slot of ['core','glow','extensions'])r.batch(a,false,4,slot);
    dots[0]=i;r.batch(dots,true,3);
  }
  assert.equal(records.uploads.length,6);
  assert.equal(new Set(records.uploads.slice(0,3).map(u=>u.buffer)).size,3);
  assert.equal(records.uploads.at(-1).data[0],2);
  assert.equal(records.draws.filter(d=>d.mode===r.gl.POINTS).length,3);
});
test('Empty geometry frees a cached slot, and the slot can be drawn again',()=>{
  const {r,records}=recordingRenderer(),a=new Float32Array(42);
  r.batch(a,false,4,'glow');r.batch(new Float32Array(),false,4,'glow');
  assert.equal(records.deleted.length,1);assert.equal(r.batchCache.size,0);
  r.batch(a,false,4,'glow');assert.equal(records.uploads.length,2);
  assert.notEqual(records.uploads[0].buffer,records.uploads[1].buffer);
});
test('GitHub Pages and offline entry points remain identical self-contained bundles',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.equal(html,readFileSync(new URL('../lumen-3d-v5.html',import.meta.url),'utf8'));
  assert.equal(html,buildHtml(),'Rebuild both HTML files after source edits');
  assert.ok(!/\/\*__(APP|STUDIO_CSS)__\*\//.test(html));
  assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html));
});
