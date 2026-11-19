import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Err, err, isResult, Ok, ok, type Result, safeTry, UnwrapError } from '../src/index.js';

const parse = (s: string): Result<number, string> => {
  const n = Number(s);
  return Number.isNaN(n) ? err(`not a number: ${s}`) : ok(n);
};

describe('Ok and Err', () => {
  it('construct and narrow', () => {
    const a = ok(1);
    const b = err('x');
    assert.ok(a instanceof Ok);
    assert.ok(b instanceof Err);
    assert.equal(a.ok, true);
    assert.equal(b.ok, false);
    assert.equal(a.isOk(), true);
    assert.equal(a.isErr(), false);
    assert.equal(b.isOk(), false);
    assert.equal(b.isErr(), true);
    assert.equal(a.value, 1);
    assert.equal(b.error, 'x');
    assert.equal(ok().value, undefined);
    assert.equal(err().error, undefined);
  });

  it('map and mapErr touch only their side', () => {
    assert.deepEqual(
      parse('2').map((n) => n * 2),
      ok(4),
    );
    assert.deepEqual(
      parse('x').map((n) => n * 2),
      err('not a number: x'),
    );
    assert.deepEqual(
      parse('2').mapErr((e) => e.length),
      ok(2),
    );
    assert.deepEqual(
      parse('x').mapErr((e) => e.length),
      err(15),
    );
  });

  it('andThen short-circuits on the first error', () => {
    const calls: number[] = [];
    const half = (n: number): Result<number, string> => {
      calls.push(n);
      return n % 2 === 0 ? ok(n / 2) : err(`${n} is odd`);
    };
    assert.deepEqual(parse('8').andThen(half).andThen(half), ok(2));
    assert.deepEqual(parse('6').andThen(half).andThen(half), err('3 is odd'));
    assert.deepEqual(parse('x').andThen(half), err('not a number: x'));
    assert.deepEqual(calls, [8, 4, 6, 3]);
  });

  it('orElse recovers', () => {
    assert.deepEqual(
      parse('x').orElse(() => ok(0)),
      ok(0),
    );
    assert.deepEqual(
      parse('1').orElse(() => ok(0)),
      ok(1),
    );
    assert.deepEqual(
      parse('x').orElse((e) => err(e.toUpperCase())),
      err('NOT A NUMBER: X'),
    );
  });

  it('match calls exactly one branch', () => {
    const show = (r: Result<number, string>) =>
      r.match(
        (n) => `ok ${n}`,
        (e) => `err ${e}`,
      );
    assert.equal(show(parse('1')), 'ok 1');
    assert.equal(show(parse('?')), 'err not a number: ?');
  });

  it('unwrap family', () => {
    assert.equal(parse('3').unwrap(), 3);
    assert.equal(parse('3').unwrapOr(0), 3);
    assert.equal(parse('x').unwrapOr(0), 0);
    assert.equal(
      parse('x').unwrapOrElse((e) => e.length),
      15,
    );
    assert.equal(parse('3').expect('need a number'), 3);
    assert.equal(parse('x').unwrapErr(), 'not a number: x');
    assert.equal(parse('x').expectErr('should fail'), 'not a number: x');

    assert.throws(
      () => parse('x').unwrap(),
      (e: unknown) =>
        e instanceof UnwrapError && e.cause === 'not a number: x' && /unwrap\(\) on an Err/.test(e.message),
    );
    assert.throws(() => parse('x').expect('need a number'), {
      name: 'UnwrapError',
      message: 'need a number',
    });
    assert.throws(() => parse('1').unwrapErr(), {
      name: 'UnwrapError',
      message: 'Called unwrapErr() on an Ok: 1',
    });
    assert.throws(() => parse('1').expectErr('boom'), { message: 'boom' });
  });

  it('unwrap error messages describe Error causes and odd values', () => {
    assert.throws(() => err(new TypeError('bad')).unwrap(), {
      message: 'Called unwrap() on an Err: TypeError: bad',
    });
    assert.throws(() => err(10n).unwrap(), { message: 'Called unwrap() on an Err: 10' });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    assert.throws(() => err(cyclic).unwrap(), { message: 'Called unwrap() on an Err: [object Object]' });
    assert.throws(
      () => err('x'.repeat(300)).unwrap(),
      (e: Error) => e.message.length < 300,
    );
  });

  it('tap and tapErr run side effects and return the same result', () => {
    const seen: unknown[] = [];
    const a = parse('1');
    const b = parse('x');
    assert.equal(
      a.tap((v) => seen.push(v)).tapErr((e) => seen.push(e)),
      a,
    );
    assert.equal(
      b.tap((v) => seen.push(v)).tapErr((e) => seen.push(e)),
      b,
    );
    assert.deepEqual(seen, [1, 'not a number: x']);
  });

  it('isOkAnd and isErrAnd', () => {
    assert.equal(
      parse('2').isOkAnd((n) => n > 1),
      true,
    );
    assert.equal(
      parse('0').isOkAnd((n) => n > 1),
      false,
    );
    assert.equal(
      parse('x').isOkAnd(() => true),
      false,
    );
    assert.equal(
      parse('x').isErrAnd((e) => e.startsWith('not')),
      true,
    );
    assert.equal(
      parse('1').isErrAnd(() => true),
      false,
    );
  });

  it('toString and isResult', () => {
    assert.equal(String(ok({ a: 1 })), 'Ok({"a":1})');
    assert.equal(String(err('no')), 'Err("no")');
    assert.equal(isResult(ok(1)), true);
    assert.equal(isResult(err(1)), true);
    assert.equal(isResult({ ok: true, value: 1 }), false);
    assert.equal(isResult(null), false);
  });
});

describe('safeTry', () => {
  it('returns the final result when every step succeeds', () => {
    const r = safeTry(function* () {
      const a = yield* parse('2');
      const b = yield* parse('3');
      return ok(a * b);
    });
    assert.deepEqual(r, ok(6));
  });

  it('stops at the first Err and runs finally blocks', () => {
    const log: string[] = [];
    const r = safeTry(function* () {
      try {
        const a = yield* parse('2');
        log.push(`a=${a}`);
        const b = yield* parse('oops');
        log.push(`b=${b}`);
        return ok(a + b);
      } finally {
        log.push('cleanup');
      }
    });
    assert.deepEqual(r, err('not a number: oops'));
    assert.deepEqual(log, ['a=2', 'cleanup']);
  });

  it('can return an Err directly', () => {
    const r = safeTry(function* () {
      const a = yield* parse('-1');
      if (a < 0) return err('negative' as const);
      return ok(a);
    });
    assert.deepEqual(r, err('negative'));
  });
});
