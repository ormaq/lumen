import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import * as os from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Point --module at a saved copy of optics.js to compare the same workloads
// before and after a change. Timing remains advisory, never a CI pass/fail gate.
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const modulePath = resolve(option('--module', 'src/optics.js'));
const samples = Number(option('--samples', '9'));
const iterations = Number(option('--iterations', '3'));
if (!Number.isInteger(samples) || samples < 1 || !Number.isInteger(iterations) || iterations < 1) {
  throw new Error('Samples and iterations must be positive integers.');
}
const optics = await import(pathToFileURL(modulePath));
const comparisonPath = option('--compare', null);
const comparison = comparisonPath ? await import(pathToFileURL(resolve(comparisonPath))) : null;
const scenes = ['star', 'binary', 'lens', 'glass'].map((name) => {
  const scene = optics.createPreset(name);
  for (const source of scene.objects.filter(optics.isSource)) source.count = 4096;
  if (name === 'glass') scene.objects.find((object) => object.type === 'glass').fresnel = true;
  return { name, scene };
});

const crowded = optics.createPreset('lens');
crowded.objects[0].count = 4096;
for (let index = crowded.objects.length; index < 80; index++) {
  crowded.objects.push({
    ...optics.createObject('mirror', `o${index + 1}`, [index % 11, 30 + index, index % 7]),
    yaw: index * 17,
    tilt: index * 11,
    roll: index * 7,
  });
}
scenes.push({ name: 'crowded-80-objects', scene: crowded });

const results = [];
for (const { name, scene } of scenes) {
  if (comparison) {
    assert.deepEqual(
      optics.traceScene(structuredClone(scene)),
      comparison.traceScene(structuredClone(scene)),
      `${name}: complete trace output must match the comparison module`,
    );
  }
  for (let warmup = 0; warmup < 3; warmup++) optics.traceScene(scene);
  const durations = [];
  let trace;
  for (let sample = 0; sample < samples; sample++) {
    const start = performance.now();
    for (let iteration = 0; iteration < iterations; iteration++) trace = optics.traceScene(scene);
    durations.push((performance.now() - start) / iterations);
  }
  durations.sort((a, b) => a - b);
  results.push({
    name,
    medianMs: Number(durations[Math.floor(durations.length / 2)].toFixed(3)),
    p90Ms: Number(durations[Math.ceil(durations.length * 0.9) - 1].toFixed(3)),
    seeds: trace.seeds,
    segments: trace.segments.length,
    hits: trace.hits.length,
    limited: trace.limited,
  });
}

console.log(
  JSON.stringify(
    {
      node: process.version,
      platform: `${process.platform}/${process.arch}`,
      cpu: os.cpus()[0]?.model,
      availableParallelism: os.availableParallelism?.() ?? os.cpus().length,
      module: modulePath,
      comparedAgainst: comparisonPath ? resolve(comparisonPath) : null,
      samples,
      iterations,
      results,
    },
    null,
    2,
  ),
);
