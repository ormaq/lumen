import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  V,
  CATALOG,
  EPS,
  basis,
  createObject,
  createPreset,
  emit,
  intersect,
  isSource,
  traceScene,
  worldVec,
} from '../src/optics.js';

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
};

test('source color conversion stays constant as sampling grows, with independent ray colors', () => {
  const source = { ...createObject('beam'), count: 4096 };
  let colorReads = 0;
  Object.defineProperty(source, 'color', {
    get() {
      colorReads++;
      return '#80c7ff';
    },
  });
  const rays = emit(source);
  assert.equal(colorReads, 1);
  assert.equal(rays.length, 4096);
  assert.deepEqual(rays[0].color, [128 / 255, 199 / 255, 1]);
  rays[0].color[0] = 0;
  assert.deepEqual(rays[1].color, [128 / 255, 199 / 255, 1]);
  close(
    rays.reduce((sum, ray) => sum + ray.energy, 0),
    source.power,
  );
});

test('a lens resolves its frame once per trace, including after its orientation changes', () => {
  const scene = createPreset('lens');
  scene.objects[0].count = 512;
  const lens = scene.objects.find((object) => object.type === 'lens');
  let yaw = lens.yaw;
  let yawReads = 0;
  Object.defineProperty(lens, 'yaw', {
    get() {
      yawReads++;
      return yaw;
    },
  });

  for (const rotation of [-90, -83]) {
    yaw = rotation;
    yawReads = 0;
    const trace = traceScene(scene);
    assert.equal(yawReads, 1, 'frame preparation must not scale with ray count');
    const frame = basis(lens);
    const lensHits = trace.hits.filter((hit) => hit.type === 'lens');
    assert.equal(lensHits.length, 512);
    for (const hit of lensHits) {
      const incoming = [
        V.dot(hit.incoming, frame.u),
        V.dot(hit.incoming, frame.v),
        V.dot(hit.incoming, frame.n),
      ];
      const axial = Math.max(EPS, Math.abs(incoming[2]));
      const expected = worldVec(
        V.unit([
          incoming[0] / axial - hit.local[0] / lens.focalLength,
          incoming[1] / axial - hit.local[1] / lens.focalLength,
          Math.sign(incoming[2]),
        ]),
        frame,
      );
      hit.outgoing.forEach((component, index) => close(component, expected[index]));
    }
  }
});

test('nearest-hit pruning agrees with unrestricted intersections for every surface type', () => {
  const types = Object.keys(CATALOG).filter((type) => !isSource({ type }));
  for (const type of types) {
    for (const yaw of [0, 17, -32]) {
      const scene = createPreset('empty');
      scene.settings.maxBounces = 0;
      scene.settings.maxDistance = 20;
      const source = {
        ...createObject('beam', 'source', [0, 0, -8]),
        yaw: 0,
        count: 41,
        aperture: 3,
      };
      const candidate = { ...createObject(type, 'candidate', [0, 0, 0]), yaw, tilt: 9, roll: 23 };
      const screen = {
        ...createObject('detector', 'screen', [0, 0, 5]),
        yaw: 0,
        width: 20,
        height: 20,
      };
      for (const surfaces of [
        [candidate, screen],
        [screen, candidate],
      ]) {
        scene.objects = [source, ...surfaces];
        const rays = emit(source);
        const trace = traceScene(scene);
        assert.equal(trace.segments.length, rays.length);
        for (const ray of rays) {
          const expected = surfaces
            .map((surface) => intersect(ray.p, ray.d, surface))
            .filter((hit) => hit && hit.t < scene.settings.maxDistance)
            .sort((a, b) => a.t - b.t)[0];
          const hit = trace.hits.find((record) => record.rayIndex === ray.rayIndex);
          assert.equal(
            hit?.objectId,
            expected?.object.id,
            `${type}, yaw ${yaw}, ray ${ray.rayIndex}`,
          );
          if (expected) assert.deepEqual(hit.local, expected.local);
          close(trace.segments[ray.rayIndex].length, expected?.t ?? scene.settings.maxDistance);
        }
      }
    }
  }
});

test('distance pruning preserves the strict path limit and stable ordering of coincident surfaces', () => {
  const scene = createPreset('empty');
  const source = { ...createObject('laser', 'source', [0, 0, 0]), yaw: 0 };
  const first = { ...createObject('detector', 'first', [0, 0, 5]), yaw: 0 };
  const second = { ...first, id: 'second' };
  scene.objects = [source, first, second];
  scene.settings.maxDistance = 5;
  assert.equal(traceScene(scene).hits.length, 0);
  scene.settings.maxDistance = 5 + EPS;
  assert.equal(traceScene(scene).hits[0].objectId, 'first');
  scene.objects = [source, second, first];
  assert.equal(traceScene(scene).hits[0].objectId, 'second');
});

test('large off-path scenes preserve all trace results and refresh moved surfaces', () => {
  const scene = createPreset('lens');
  scene.objects[0].count = 512;
  const original = traceScene(scene);
  for (let index = scene.objects.length; index < 80; index++) {
    scene.objects.push({
      ...createObject('mirror', `o${index + 1}`, [index % 11, 30 + index, index % 7]),
      yaw: index * 17,
      tilt: index * 11,
      roll: index * 7,
    });
  }
  assert.deepEqual(traceScene(scene), original);
  const blocker = scene.objects.at(-1);
  Object.assign(blocker, {
    type: 'blocker',
    p: [-3, 3, 0],
    yaw: -90,
    tilt: 0,
    roll: 0,
    width: 10,
    height: 10,
  });
  const blocked = traceScene(scene);
  assert.equal(blocked.hits.length, 512);
  assert.ok(blocked.hits.every((hit) => hit.objectId === blocker.id));
  assert.equal(blocked.detectors.o3.power, 0);
});
