import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { M, Renderer } from '../src/renderer.js';
import { V } from '../src/optics.js';

const originalWindow = globalThis.window;
globalThis.window = { devicePixelRatio: 1 };
after(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

function close(actual, expected, tolerance = 1e-5) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
}

function vectorClose(actual, expected, tolerance = 1e-5) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => close(value, expected[index], tolerance));
}

// This records actual buffer allocations, uploaded bytes, and draw counts. It
// deliberately does not emulate rasterization; projection is tested separately.
function createRenderer(width = 800, height = 600) {
  const bound = new Map();
  const storage = new Map();
  const gl = {
    ARRAY_BUFFER: 'array',
    ELEMENT_ARRAY_BUFFER: 'element',
    STATIC_DRAW: 'static',
    DYNAMIC_DRAW: 'dynamic',
    VERTEX_SHADER: 'vertex',
    FRAGMENT_SHADER: 'fragment',
    TRIANGLES: 'triangles',
    LINES: 'lines',
    POINTS: 'points',
    FLOAT: 'float',
    UNSIGNED_SHORT: 'unsigned-short',
    DEPTH_TEST: 'depth',
    LEQUAL: 'lequal',
    BLEND: 'blend',
    SRC_ALPHA: 'src-alpha',
    ONE_MINUS_SRC_ALPHA: 'one-minus-src-alpha',
    COLOR_BUFFER_BIT: 1,
    DEPTH_BUFFER_BIT: 2,
    COMPILE_STATUS: 'compile-status',
    LINK_STATUS: 'link-status',
    allocations: [],
    uploads: [],
    draws: [],
    uniforms: new Map(),
    createShader: () => ({}),
    createProgram: () => ({}),
    createBuffer: () => ({}),
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getUniformLocation: (_program, name) => name,
    getAttribLocation: (_program, name) => (name === 'aPosition' ? 0 : 1),
    useProgram(program) {
      this.currentProgram = program;
    },
    bindBuffer(target, buffer) {
      bound.set(target, buffer);
    },
    bufferData(target, data, usage) {
      const bytes =
        typeof data === 'number'
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
      storage.set(bound.get(target), bytes);
      this.allocations.push({ buffer: bound.get(target), size: bytes.length, usage });
    },
    bufferSubData(target, offset, data) {
      storage
        .get(bound.get(target))
        .set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), offset);
      this.uploads.push({ buffer: bound.get(target), data: Array.from(data), source: data.buffer });
    },
    drawArrays(mode, first, count) {
      this.draws.push({ mode, first, count });
    },
    drawElements(mode, count, type, offset) {
      this.draws.push({ mode, count, type, offset });
    },
    uniformMatrix4fv(name, _transpose, value) {
      this.uniforms.set(name, Array.from(value));
    },
    uniformMatrix3fv(name, _transpose, value) {
      this.uniforms.set(name, Array.from(value));
    },
    uniform4fv(name, value) {
      this.uniforms.set(name, Array.from(value));
    },
    uniform3fv(name, value) {
      this.uniforms.set(name, Array.from(value));
    },
    uniform1f(name, value) {
      this.uniforms.set(name, value);
    },
    viewport(x, y, w, h) {
      this.lastViewport = [x, y, w, h];
    },
  };
  for (const name of [
    'shaderSource',
    'compileShader',
    'deleteShader',
    'attachShader',
    'linkProgram',
    'enable',
    'depthFunc',
    'blendFunc',
    'deleteBuffer',
    'enableVertexAttribArray',
    'vertexAttribPointer',
    'disableVertexAttribArray',
    'vertexAttrib3f',
    'clearColor',
    'clear',
    'depthMask',
  ])
    gl[name] = () => {};
  const rect = { width, height };
  const canvas = { width: 0, height: 0, getContext: () => gl, getBoundingClientRect: () => rect };
  return { renderer: new Renderer(canvas), gl, canvas, rect };
}

const dynamicAllocations = (gl) =>
  gl.allocations.filter((allocation) => allocation.usage === gl.DYNAMIC_DRAW);
const triangle = () => [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 1];

test('120 unchanged frames reuse camera matrices and allocate each stream only once', () => {
  const { renderer, gl } = createRenderer();
  const projection = renderer.vp;
  const points = [
    [0, 0, 0],
    [1, 2, 3],
  ];
  const vertices = triangle();
  for (let frame = 0; frame < 120; frame++) {
    renderer.begin();
    renderer.lines(points, [1, 1, 1, 1]);
    renderer.batch(vertices);
    assert.strictEqual(renderer.vp, projection);
  }
  assert.equal(dynamicAllocations(gl).length, 2);
  assert.equal(gl.uploads.length, 240);
  assert.equal(gl.draws.length, 240);
  const lineUploads = gl.uploads.filter((upload) => upload.buffer === renderer.dynamic);
  const batchUploads = gl.uploads.filter((upload) => upload.buffer === renderer.batchBuffer);
  assert.equal(new Set(lineUploads.map((upload) => upload.source)).size, 1);
  assert.equal(new Set(batchUploads.map((upload) => upload.source)).size, 1);
});

test('stream reuse preserves edits, grows for larger batches, and draws only active vertices', () => {
  const { renderer, gl } = createRenderer();
  const vertices = new Float32Array(triangle());
  renderer.batch(vertices);
  vertices[0] = 42;
  renderer.batch(vertices, true, 5);
  assert.equal(gl.uploads.at(-1).data[0], 42);
  assert.strictEqual(gl.uploads.at(-1).source, vertices.buffer);
  assert.deepEqual(gl.draws.at(-1), { mode: gl.POINTS, first: 0, count: 3 });
  assert.equal(gl.uniforms.get('uSize'), 5);
  assert.equal(gl.uniforms.get('uPoint'), 1);
  assert.strictEqual(gl.currentProgram, renderer.program);
  assert.equal(dynamicAllocations(gl).length, 1);

  renderer.batch(new Float32Array(7 * 300));
  assert.equal(dynamicAllocations(gl).length, 2);
  renderer.batch([9, 8, 7, 1, 1, 1, 1], true);
  assert.deepEqual(gl.uploads.at(-1).data, [9, 8, 7, 1, 1, 1, 1]);
  assert.deepEqual(gl.draws.at(-1), { mode: gl.POINTS, first: 0, count: 1 });
  assert.equal(dynamicAllocations(gl).length, 2);
});

test('line uploads observe in-place edits without stale trailing vertices', () => {
  const { renderer, gl } = createRenderer();
  const points = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [10, 11, 12],
  ];
  renderer.lines(points, [1, 0, 0, 1]);
  points[0][0] = -8;
  points.splice(2);
  renderer.lines(points, [0, 1, 0, 1]);
  assert.deepEqual(gl.uploads.at(-1).data, [-8, 2, 3, 4, 5, 6]);
  assert.deepEqual(gl.draws.at(-1), { mode: gl.LINES, first: 0, count: 2 });
  assert.deepEqual(gl.uniforms.get('uColor'), [0, 1, 0, 1]);
  assert.deepEqual(gl.uniforms.get('uModel'), Array.from(M.identity()));
  assert.equal(dynamicAllocations(gl).length, 1);
});

test('empty overlays do not compile batch shaders, upload, allocate, or draw', () => {
  const { renderer, gl } = createRenderer();
  renderer.lines([], [1, 1, 1, 1]);
  renderer.batch([]);
  assert.equal(renderer.batchProgram, undefined);
  assert.equal(dynamicAllocations(gl).length, 0);
  assert.equal(gl.uploads.length, 0);
  assert.equal(gl.draws.length, 0);
});

test('camera cache invalidates for every control, in-place target edits, and viewport dimensions', () => {
  const { renderer, rect } = createRenderer();
  const changes = [
    () => (renderer.camera.yaw += 0.1),
    () => (renderer.camera.pitch += 0.1),
    () => (renderer.camera.radius += 1),
    () => (renderer.camera.target[0] += 1),
    () => (renderer.camera.target[1] += 1),
    () => (renderer.camera.target[2] += 1),
    () => (renderer.camera.orthographic = true),
    () => {
      rect.width += 100;
      renderer.resize();
    },
    () => {
      rect.height += 100;
      renderer.resize();
    },
  ];
  for (const change of changes) {
    const before = renderer.vp;
    change();
    renderer.updateCamera();
    assert.notStrictEqual(renderer.vp, before);
    const updated = renderer.vp;
    renderer.updateCamera();
    assert.strictEqual(renderer.vp, updated);
  }
});

test('perspective and orthographic pointer rays project back to their screen coordinates', () => {
  const { renderer } = createRenderer();
  for (const orthographic of [false, true]) {
    renderer.camera.orthographic = orthographic;
    renderer.updateCamera();
    const center = renderer.project(renderer.camera.target);
    close(center.x, 400);
    close(center.y, 300);
    assert.equal(center.visible, true);
    for (const [x, y] of [
      [400, 300],
      [80, 90],
      [720, 510],
    ]) {
      const ray = renderer.pointerRay(x, y);
      const projected = renderer.project(V.add(ray.origin, V.mul(ray.direction, 12)));
      close(projected.x, x, 0.001);
      close(projected.y, y, 0.001);
      assert.equal(projected.visible, true);
      close(V.len(ray.direction), 1);
    }
  }
});

test('resize caps pixel density and keeps collapsed canvas projections finite', () => {
  globalThis.window.devicePixelRatio = 3;
  try {
    const { renderer, canvas, gl, rect } = createRenderer();
    assert.equal(canvas.width, 1600);
    assert.equal(canvas.height, 1200);
    assert.deepEqual(gl.lastViewport, [0, 0, 1600, 1200]);
    rect.width = 0;
    rect.height = 0;
    renderer.resize();
    assert.equal(canvas.width, 1);
    assert.equal(canvas.height, 1);
    assert.ok(renderer.vp.every(Number.isFinite));
    assert.ok(renderer.pointerRay(0, 0).direction.every(Number.isFinite));
  } finally {
    globalThis.window.devicePixelRatio = 1;
  }
});

test('normal matrices preserve perpendiculars under rotation and non-uniform scale', () => {
  const u = V.unit([1, 2, -1]);
  const n = V.unit(V.cross(u, [0, 0, 1]));
  const v = V.cross(n, u);
  const model = M.model([3, 4, 5], u, v, n, [2, 5, 0.5]);
  const destination = new Float32Array(9);
  assert.strictEqual(M.normal(model, destination), destination);
  const normal = V.unit([
    destination[0] + destination[3] + destination[6],
    destination[1] + destination[4] + destination[7],
    destination[2] + destination[5] + destination[8],
  ]);
  const transformDirection = (point) => [
    model[0] * point[0] + model[4] * point[1] + model[8] * point[2],
    model[1] * point[0] + model[5] * point[1] + model[9] * point[2],
    model[2] * point[0] + model[6] * point[1] + model[10] * point[2],
  ];
  close(V.dot(normal, transformDirection([1, -1, 0])), 0);
  close(V.dot(normal, transformDirection([1, 0, -1])), 0);
  vectorClose(Array.from(M.normal(M.identity())), [1, 0, 0, 0, 1, 0, 0, 0, 1]);

  const { renderer, gl } = createRenderer();
  renderer.draw('box', model, [1, 1, 1, 1]);
  vectorClose(gl.uniforms.get('uNormal'), Array.from(destination));
  renderer.draw('box', M.identity(), [1, 1, 1, 1]);
  vectorClose(gl.uniforms.get('uNormal'), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
});
