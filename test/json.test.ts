import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  err,
  ok,
  ParseError,
  safeJsonParse,
  safeJsonStringify,
  StringifyError,
  ValidationError,
  validate,
} from '../src/index.js';

interface User {
  name: string;
}
const isUser = (v: unknown): v is User =>
  typeof v === 'object' && v !== null && typeof (v as { name?: unknown }).name === 'string';

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    assert.deepEqual(safeJsonParse('{"a":[1,2]}'), ok({ a: [1, 2] }));
    assert.deepEqual(safeJsonParse('null'), ok(null));
  });

  it('returns ParseError for invalid JSON', () => {
    const r = safeJsonParse('{"a":');
    assert.ok(!r.ok);
    assert.ok(r.error instanceof ParseError);
    assert.ok(r.error instanceof Error);
    assert.equal(r.error.kind, 'parse');
    assert.equal(r.error.name, 'parse');
    assert.equal(r.error.input, '{"a":');
    assert.ok(r.error.cause instanceof SyntaxError);
    assert.match(r.error.message, /^Invalid JSON: /);
  });

  it('validates with a type guard', () => {
    assert.deepEqual(safeJsonParse('{"name":"Ada"}', isUser), ok({ name: 'Ada' }));
    const bad = safeJsonParse('{"name":1}', isUser);
    assert.ok(!bad.ok && bad.error instanceof ValidationError);
    assert.ok(!bad.ok && bad.error.kind === 'validation');
    assert.deepEqual(!bad.ok && (bad.error as ValidationError).value, { name: 1 });
  });

  it('validates with a Result-returning validator', () => {
    const positive = (v: unknown) =>
      typeof v === 'number' && v > 0 ? ok(v) : err(`expected a positive number, got ${JSON.stringify(v)}`);
    assert.deepEqual(safeJsonParse('3', positive), ok(3));
    const r = safeJsonParse('-1', positive);
    assert.ok(!r.ok);
    assert.equal(r.error.message, 'expected a positive number, got -1');
    const withError = validate(1, () => err(new Error('custom')));
    assert.ok(!withError.ok && withError.error.message === 'custom');
    const blank = validate(1, () => err(null));
    assert.ok(!blank.ok && blank.error.message === 'The value did not match the expected shape');
  });

  it('a validator that throws becomes a ValidationError', () => {
    const r = validate('x', () => {
      throw new Error('validator crashed');
    });
    assert.ok(!r.ok && r.error.message === 'validator crashed');
  });
});

describe('safeJsonStringify', () => {
  it('stringifies', () => {
    assert.deepEqual(safeJsonStringify({ a: 1 }), ok('{"a":1}'));
    assert.deepEqual(safeJsonStringify([1], 2), ok('[\n  1\n]'));
  });

  it('fails on cycles, BigInt and undefined', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const value of [cyclic, 1n, undefined, () => 1]) {
      const r = safeJsonStringify(value);
      assert.ok(!r.ok && r.error instanceof StringifyError && r.error.kind === 'stringify');
    }
  });
});
