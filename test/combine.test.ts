import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  all,
  allAsync,
  allWithErrors,
  any,
  anyAsync,
  combine,
  combineWithErrors,
  err,
  errAsync,
  ok,
  okAsync,
  partition,
} from '../src/index.js';

describe('all', () => {
  it('collects values in order', () => {
    assert.deepEqual(all([ok(1), ok('a'), ok(true)]), ok([1, 'a', true]));
    assert.deepEqual(all([]), ok([]));
  });

  it('returns the first error', () => {
    assert.deepEqual(all([ok(1), err('first'), err('second')]), err('first'));
  });
});

describe('allWithErrors', () => {
  it('collects every error', () => {
    assert.deepEqual(allWithErrors([ok(1), err('a'), ok(2), err('b')]), err(['a', 'b']));
    assert.deepEqual(allWithErrors([ok(1), ok(2)]), ok([1, 2]));
  });
});

describe('any', () => {
  it('returns the first Ok', () => {
    assert.deepEqual(any([err('a'), ok(1), ok(2)]), ok(1));
  });

  it('returns every error when nothing succeeded', () => {
    assert.deepEqual(any([err('a'), err('b')]), err(['a', 'b']));
    assert.deepEqual(any([]), err([]));
  });
});

describe('combine', () => {
  it('combines an object of results', () => {
    assert.deepEqual(combine({ a: ok(1), b: ok('x') }), ok({ a: 1, b: 'x' }));
    assert.deepEqual(combine({ a: ok(1), b: err('bad b'), c: err('bad c') }), err('bad b'));
    assert.deepEqual(combine({}), ok({}));
  });
});

describe('partition', () => {
  it('splits values and errors', () => {
    assert.deepEqual(partition([ok(1), err('a'), ok(2)]), [[1, 2], ['a']]);
    function* gen() {
      yield ok(1);
      yield err('x');
    }
    assert.deepEqual(partition(gen()), [[1], ['x']]);
  });
});

describe('allAsync and anyAsync', () => {
  it('mixes ResultAsync, Promise<Result> and Result', async () => {
    assert.deepEqual(await allAsync([okAsync(1), Promise.resolve(ok('a')), ok(true)]), ok([1, 'a', true]));
    assert.deepEqual(
      await allAsync([okAsync(1), errAsync('late'), Promise.resolve(err('later'))]),
      err('late'),
    );
  });

  it('starts every item before waiting for any', async () => {
    const started: number[] = [];
    const slow = (n: number) => {
      started.push(n);
      return new Promise<ReturnType<typeof ok<number>>>((resolve) => setTimeout(() => resolve(ok(n)), 20));
    };
    const r = await allAsync([slow(1), slow(2), slow(3)]);
    assert.deepEqual(r, ok([1, 2, 3]));
    assert.deepEqual(started, [1, 2, 3]);
  });

  it('anyAsync', async () => {
    assert.deepEqual(await anyAsync([errAsync('a'), okAsync(2)]), ok(2));
    assert.deepEqual(await anyAsync([errAsync('a'), Promise.resolve(err('b'))]), err(['a', 'b']));
  });
});

describe('combineWithErrors', () => {
  it('returns every value when all keys succeed', () => {
    assert.deepEqual(combineWithErrors({ a: ok(1), b: ok('x') }), ok({ a: 1, b: 'x' }));
    assert.deepEqual(combineWithErrors({}), ok({}));
  });

  it('collects the error of every failed key and only those keys', () => {
    const r = combineWithErrors({ name: ok('Ada'), email: err('invalid email'), age: err('too young') });
    assert.deepEqual(r, err({ email: 'invalid email', age: 'too young' }));
    assert.equal(r.isErr() && 'name' in r.error, false);
  });

  it('keeps falsy errors', () => {
    assert.deepEqual(combineWithErrors({ a: err(0), b: err(undefined) }), err({ a: 0, b: undefined }));
  });
});
