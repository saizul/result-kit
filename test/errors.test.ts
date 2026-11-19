import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { err, matchKind, ok, type Result, TaggedError } from '../src/index.js';

class NotFound extends TaggedError('NotFound') {
  constructor(readonly id: string) {
    super(`No user with id ${id}`);
  }
}
class Forbidden extends TaggedError('Forbidden') {}

const load = (id: string): Result<string, NotFound | Forbidden> => {
  if (id === 'root') return err(new Forbidden());
  if (id !== '1') return err(new NotFound(id));
  return ok('Ada');
};

describe('TaggedError', () => {
  it('creates real Error subclasses with a kind', () => {
    const e = new NotFound('7');
    assert.ok(e instanceof Error);
    assert.ok(e instanceof NotFound);
    assert.equal(e.kind, 'NotFound');
    assert.equal(e.name, 'NotFound');
    assert.equal(e.message, 'No user with id 7');
    assert.equal(e.id, '7');
    assert.equal(NotFound.kind, 'NotFound');
    assert.match(String(e.stack), /NotFound/);
  });

  it('defaults the message to the kind and keeps the cause', () => {
    const cause = new Error('db down');
    const e = new Forbidden(undefined, { cause });
    assert.equal(e.message, 'Forbidden');
    assert.equal(e.cause, cause);
  });

  it('classes from different calls are distinct', () => {
    assert.ok(!(new Forbidden() instanceof NotFound));
  });
});

describe('matchKind', () => {
  it('dispatches on kind', () => {
    const status = (id: string) =>
      load(id).match(
        () => 200,
        (e) => matchKind(e, { NotFound: () => 404, Forbidden: () => 403 }),
      );
    assert.equal(status('1'), 200);
    assert.equal(status('2'), 404);
    assert.equal(status('root'), 403);
  });

  it('passes the narrowed error to the handler', () => {
    const r = load('9');
    assert.ok(!r.ok);
    assert.equal(matchKind(r.error, { NotFound: (e) => e.id, Forbidden: () => '' }), '9');
  });

  it('throws on a kind without a handler at runtime', () => {
    const rogue = { kind: 'Other' } as unknown as NotFound;
    assert.throws(() => matchKind(rogue, { NotFound: () => 1 }), TypeError);
  });

  it('works on plain objects with a kind', () => {
    type Shape = { kind: 'circle'; r: number } | { kind: 'square'; side: number };
    const area = (s: Shape) =>
      matchKind(s, { circle: (c) => Math.round(Math.PI * c.r ** 2), square: (q) => q.side ** 2 });
    assert.equal(area({ kind: 'circle', r: 1 }), 3);
    assert.equal(area({ kind: 'square', side: 3 }), 9);
  });
});
