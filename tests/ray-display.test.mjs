import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreset, traceScene } from '../src/optics.js';
import { buildRayGeometry } from '../src/ray-display.js';

const cameraView = {
  camera: { orthographic: true, radius: 30 },
  fov: Math.PI / 4,
  height: 900,
  eye: [0, 10, 30],
  forward: [0, 0, -1],
  right: [1, 0, 0],
};
const vertexSize = 7; // XYZ position, RGB color, alpha.
const quadSize = 6 * vertexSize;

test('Display budgeting preserves complete ray paths and leaves traced data untouched', () => {
  const scene = createPreset('splitter');
  const trace = traceScene(scene);
  const before = structuredClone(trace);
  scene.settings.displayBudget = 12;
  const display = buildRayGeometry(trace.segments, scene.settings, cameraView);
  assert.ok(display.chosen.length > 0 && display.chosen.length <= 12);
  assert.equal(display.eligibleCount, trace.segments.length);
  for (const segment of display.chosen) {
    const path = trace.segments.filter(
      (s) => s.sourceId === segment.sourceId && s.rayIndex === segment.rayIndex,
    );
    assert.ok(path.every((part) => display.chosen.includes(part)));
  }
  assert.equal(display.core.length, display.chosen.length * quadSize);
  assert.deepEqual(trace, before);
});

test('Source isolation and interaction filtering affect only the visible paths', () => {
  const scene = createPreset('binary');
  const trace = traceScene(scene);
  scene.settings.rayStage = 'interacted';
  const display = buildRayGeometry(trace.segments, scene.settings, cameraView, new Set(), 'o4');
  assert.ok(display.chosen.length > 0);
  assert.ok(display.chosen.every((s) => s.sourceId === 'o4' && s.depth > 0));
  assert.equal(trace.detectors.o3.count, 1536);
});

test('Selecting a source dims other sources without changing colors or ray samples', () => {
  const scene = createPreset('binary');
  const trace = traceScene(scene);
  const normal = buildRayGeometry(trace.segments, scene.settings, cameraView);
  const selected = buildRayGeometry(trace.segments, scene.settings, cameraView, new Set(['o1']));
  assert.deepEqual(selected.chosen, normal.chosen);
  selected.chosen.forEach((segment, index) => {
    const offset = index * quadSize;
    assert.deepEqual(
      selected.core.slice(offset + 3, offset + 6),
      normal.core.slice(offset + 3, offset + 6),
    );
    if (segment.sourceId === 'o1') assert.equal(selected.core[offset + 6], normal.core[offset + 6]);
    else assert.ok(selected.core[offset + 6] < normal.core[offset + 6]);
  });
});

test('Glow ribbons and camera-parallel paths produce finite geometry', () => {
  const scene = createPreset('focus');
  const trace = traceScene(scene);
  scene.settings.rayStyle = 'glow';
  const view = { ...cameraView, forward: [1, 0, 0], right: [0, 0, 1] };
  const display = buildRayGeometry(trace.segments, scene.settings, view);
  assert.equal(display.glow.length, display.core.length);
  assert.ok(display.core.every(Number.isFinite));
  assert.ok(display.glow.every(Number.isFinite));
  assert.notDeepEqual(display.core.slice(0, 3), display.core.slice(vertexSize, vertexSize + 3));
});

test('Display output is deterministic for a camera and handles empty or hidden scenes', () => {
  const scene = createPreset('focus');
  const trace = traceScene(scene);
  const options = [trace.segments, scene.settings, cameraView];
  assert.deepEqual(buildRayGeometry(...options), buildRayGeometry(...options));
  assert.equal(buildRayGeometry([], scene.settings, cameraView).core.length, 0);
  assert.equal(buildRayGeometry(...options, new Set(), 'missing').chosen.length, 0);
});
