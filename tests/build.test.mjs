import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { runInNewContext, Script } from 'node:vm';
import { bundle, buildApplication } from '../build.mjs';
import { createPreset, traceScene } from '../src/optics.js';

function fixture(t, files) {
  const directory = mkdtempSync(join(tmpdir(), 'lumen-build-test-'));
  t.after(() => {
    assert.equal(dirname(directory), resolve(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
  });
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(directory, name), contents);
  }
  return join(directory, 'entry.js');
}

test('Bundling supports multiline aliased imports and keeps module scopes private', (t) => {
  const entry = fixture(t, {
    'values.js': `const privateValue = 4; export const value = privateValue;`,
    'entry.js': `import {\n value as importedValue,\n} from './values.js';
      const privateValue = 3;
      export const total = importedValue + privateValue;
      export const literal = 'export const unchanged = 1;';`,
  });
  const output = runInNewContext(bundle(entry));
  assert.equal(output.total, 7);
  assert.equal(output.literal, 'export const unchanged = 1;');
});

test('Shared dependencies execute exactly once and named exports remain callable', (t) => {
  const entry = fixture(t, {
    'shared.js': `recordLoad(); export function double(n) { return n * 2; }`,
    'left.js': `import { double } from './shared.js'; export const left = double(2);`,
    'right.js': `import { double } from './shared.js'; export const right = double(3);`,
    'entry.js': `import { left } from './left.js'; import { right } from './right.js';
      const sum = left + right; export { sum as total };`,
  });
  let loads = 0;
  const output = runInNewContext(bundle(entry), { recordLoad: () => loads++ });
  assert.equal(output.total, 10);
  assert.equal(loads, 1);
});

test('Broken or unsupported module imports fail at build time', (t) => {
  const cases = [
    [`import { missing } from './dep.js';`, /Missing export missing/],
    [`import { value } from 'external';`, /Only local imports/],
    [`import value from './dep.js';`, /named imports/],
    [`export default 1;`, /named exports/],
    [`export { value } from './dep.js';`, /Re-exports/],
  ];
  for (const [source, error] of cases) {
    const entry = fixture(t, { 'entry.js': source, 'dep.js': 'export const value = 1;' });
    assert.throws(() => bundle(entry), error);
  }
});

test('Circular module imports fail clearly instead of recursing indefinitely', (t) => {
  const entry = fixture(t, {
    'entry.js': `import { value } from './cycle.js'; export const result = value;`,
    'cycle.js': `import './entry.js'; export const value = 1;`,
  });
  assert.throws(() => bundle(entry), /Circular module dependency/);
});

test('Offline distribution embeds styles and executable app/worker without placeholders', () => {
  const { html, script, worker } = buildApplication();
  assert.doesNotThrow(() => new Script(script));
  assert.doesNotThrow(() => new Script(worker));
  assert.ok(html.includes(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')));
  assert.doesNotMatch(html, /\/\*__(?:APP|STYLES)__\*\//);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+rel=["']stylesheet/i);
  assert.equal((html.match(/<\/script>/gi) || []).length, 1);
  assert.equal(html, readFileSync(new URL('../lumen-3d-v3.html', import.meta.url), 'utf8'));
});

test('Bundled worker returns the same optical results and reports request revisions/errors', () => {
  const { worker } = buildApplication();
  let reply;
  const self = {
    postMessage: (message) => {
      reply = message;
    },
  };
  runInNewContext(worker, { self, performance });
  for (const name of ['focus', 'splitter', 'glass', 'binary']) {
    const scene = createPreset(name);
    self.onmessage({ data: { scene: structuredClone(scene), revision: 7 } });
    assert.equal(reply.revision, 7);
    assert.ok(Number.isFinite(reply.ms));
    assert.deepEqual(
      JSON.parse(JSON.stringify(reply.trace)),
      JSON.parse(JSON.stringify(traceScene(scene))),
    );
  }
  self.onmessage({ data: { scene: null, revision: 8 } });
  assert.equal(reply.revision, 8);
  assert.equal(typeof reply.error, 'string');
});
