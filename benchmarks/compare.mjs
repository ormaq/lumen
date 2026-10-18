import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {cpus,platform,arch} from 'node:os';
import {performance} from 'node:perf_hooks';
import {traceScene as before} from '../tests/fixtures/performance/optics.js';
import {traceScene as after} from '../src/optics.js';
import {workloads} from './workloads.mjs';

const rounds=Number(process.env.BENCH_ROUNDS||9);
assert.ok(Number.isInteger(rounds)&&rounds>=5,'BENCH_ROUNDS must be at least 5');
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const hash=path=>createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex');
const results=[];
for(const {name,scene} of workloads()){
  const oldScene=structuredClone(scene),newScene=structuredClone(scene);
  const expected=before(oldScene),actual=after(newScene);
  // Timings are accepted only when every ray, hit, power and limit flag agrees.
  assert.deepEqual(actual,expected,name+': optical output changed');
  for(let i=0;i<4;i++){before(oldScene);after(newScene);}
  const iterations=name==='focus-default'?100:3;
  const times={before:[],after:[]};
  for(let round=0;round<rounds;round++){
    for(const key of round%2?['after','before']:['before','after']){
      globalThis.gc?.();
      const fn=key==='before'?before:after,s=key==='before'?oldScene:newScene;
      const start=performance.now();
      for(let i=0;i<iterations;i++)fn(s);
      times[key].push((performance.now()-start)/iterations);
    }
  }
  const baselineMs=median(times.before),optimizedMs=median(times.after),speedup=baselineMs/optimizedMs;
  results.push({name,rays:actual.seeds,segments:actual.segments.length,hits:actual.hits.length,baselineMs,optimizedMs,speedup,identical:true,samples:times});
  console.log(`${name.padEnd(23)} ${baselineMs.toFixed(2).padStart(8)} -> ${optimizedMs.toFixed(2).padStart(8)} ms  ${speedup.toFixed(2)}x; identical output`);
}
const geometricMeanSpeedup=Math.exp(results.reduce((s,r)=>s+Math.log(r.speedup),0)/results.length);
const report={recordedAt:new Date().toISOString(),environment:{node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model},rounds,baselineSha256:hash('../tests/fixtures/performance/optics.js'),optimizedSha256:hash('../src/optics.js'),geometricMeanSpeedup,results};
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9);
if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(`Geometric mean: ${geometricMeanSpeedup.toFixed(2)}x`);
// Dedicated performance gate, separate from ordinary unit tests and CI jitter.
if(process.argv.includes('--check')){
  assert.ok(geometricMeanSpeedup>=1.15,'Expected at least 15% aggregate tracing speedup');
  for(const r of results)assert.ok(r.speedup>=.8,`${r.name}: more than 25% slower than baseline`);
}
