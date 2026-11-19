import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  err,
  fromNullable,
  fromResult,
  isOption,
  None,
  none,
  ok,
  type Option,
  Some,
  some,
} from '../src/index.js';

const lookup = (key: string): Option<number> => fromNullable(({ a: 1, z: 0 } as Record<string, number>)[key]);

describe('Option', () => {
  it('fromNullable keeps falsy values that are not null or undefined', () => {
    assert.deepEqual(fromNullable(0), some(0));
    assert.deepEqual(fromNullable(''), some(''));
    assert.deepEqual(fromNullable(false), some(false));
    assert.equal(fromNullable(null), none());
    assert.equal(fromNullable(undefined), none());
    assert.equal(lookup('z').unwrap(), 0);
  });

  it('none() is a single frozen instance', () => {
    assert.equal(none(), none());
    assert.ok(none() instanceof None);
    assert.ok(Object.isFrozen(none()));
    assert.ok(some(1) instanceof Some);
  });

  it('map, andThen, filter', () => {
    assert.deepEqual(
      lookup('a').map((n) => n + 1),
      some(2),
    );
    assert.equal(
      lookup('b').map((n) => n + 1),
      none(),
    );
    assert.deepEqual(
      lookup('a').andThen((n) => (n > 0 ? some(n) : none())),
      some(1),
    );
    assert.equal(
      lookup('z').andThen((n) => (n > 0 ? some(n) : none())),
      none(),
    );
    assert.equal(
      lookup('b').andThen(() => some(1)),
      none(),
    );
    assert.deepEqual(
      lookup('a').filter((n) => n === 1),
      some(1),
    );
    assert.equal(
      lookup('a').filter((n) => n === 2),
      none(),
    );
    assert.equal(
      lookup('b').filter(() => true),
      none(),
    );
  });

  it('or and orElse', () => {
    assert.deepEqual(lookup('a').or(some(9)), some(1));
    assert.deepEqual(lookup('b').or(some(9)), some(9));
    assert.deepEqual(
      lookup('b').orElse(() => some(8)),
      some(8),
    );
    assert.deepEqual(
      lookup('a').orElse(() => some(8)),
      some(1),
    );
  });

  it('match, unwrap and friends', () => {
    const show = (o: Option<number>) =>
      o.match(
        (n) => `some ${n}`,
        () => 'none',
      );
    assert.equal(show(lookup('a')), 'some 1');
    assert.equal(show(lookup('b')), 'none');
    assert.equal(lookup('b').unwrapOr(5), 5);
    assert.equal(
      lookup('b').unwrapOrElse(() => 6),
      6,
    );
    assert.equal(
      lookup('a').unwrapOrElse(() => 6),
      1,
    );
    assert.equal(lookup('a').unwrapOr(5), 1);
    assert.equal(lookup('a').expect('need a'), 1);
    assert.throws(() => lookup('b').unwrap(), { name: 'UnwrapError', message: 'Called unwrap() on a None' });
    assert.throws(() => lookup('b').expect('need b'), { name: 'UnwrapError', message: 'need b' });
  });

  it('converts to and from Result', () => {
    assert.deepEqual(lookup('a').okOr('missing'), ok(1));
    assert.deepEqual(lookup('b').okOr('missing'), err('missing'));
    assert.deepEqual(
      lookup('b').okOrElse(() => 'lazy'),
      err('lazy'),
    );
    assert.deepEqual(
      lookup('a').okOrElse(() => 'lazy'),
      ok(1),
    );
    assert.deepEqual(fromResult(ok(1)), some(1));
    assert.equal(fromResult(err('x')), none());
  });

  it('zip, tap, toNullable, toUndefined, toString, isOption', () => {
    assert.deepEqual(some(1).zip(some('a')), some([1, 'a']));
    assert.equal(some(1).zip(none()), none());
    assert.equal(none().zip(some(1)), none());
    const seen: number[] = [];
    lookup('a').tap((n) => seen.push(n));
    lookup('b').tap((n) => seen.push(n));
    assert.deepEqual(seen, [1]);
    assert.equal(lookup('a').toNullable(), 1);
    assert.equal(lookup('b').toNullable(), null);
    assert.equal(lookup('a').toUndefined(), 1);
    assert.equal(lookup('b').toUndefined(), undefined);
    assert.equal(String(some(1)), 'Some(1)');
    assert.equal(String(none()), 'None');
    assert.equal(isOption(some(1)), true);
    assert.equal(isOption(none()), true);
    assert.equal(isOption(1), false);
  });

  it('isSome and isNone', () => {
    assert.equal(some(1).isSome(), true);
    assert.equal(some(1).isNone(), false);
    assert.equal(none().isSome(), false);
    assert.equal(none().isNone(), true);
    assert.equal(some(1).some, true);
    assert.equal(none().some, false);
  });
});
