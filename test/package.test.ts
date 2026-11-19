import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import * as esm from '../src/index.js';

const require = createRequire(import.meta.url);
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('package', () => {
  it('the CommonJS build exposes the same API', () => {
    const cjs = require('../cjs/index.js') as typeof esm;
    assert.deepEqual(Object.keys(cjs).sort(), Object.keys(esm).sort());
    assert.equal(
      cjs
        .ok(1)
        .map((n) => n + 1)
        .unwrap(),
      2,
    );
    assert.equal(cjs.safeJsonParse('[').isErr(), true);
  });

  it('the CommonJS folder is marked as commonjs', () => {
    assert.equal(JSON.parse(read('../cjs/package.json')).type, 'commonjs');
  });

  it('has no runtime dependencies and versions agree', () => {
    const pkg = JSON.parse(read('../../package.json'));
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.version, esm.VERSION);
    assert.equal(pkg.name, '@saizul/result-kit');
    assert.equal(pkg.sideEffects, false);
  });

  it('the library modules do not import Node built-ins', () => {
    for (const file of ['index', 'result', 'option', 'async', 'combine', 'try', 'errors', 'json', 'fetch']) {
      const source = read(`../esm/${file}.js`);
      assert.doesNotMatch(source, /from ['"]node:/, file);
    }
  });

  it('the README API section mentions every export', () => {
    const readme = read('../../README.md');
    for (const name of Object.keys(esm)) {
      if (name === 'VERSION') continue;
      assert.ok(readme.includes(`\`${name}`), name);
    }
  });
});
