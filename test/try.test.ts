import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { err, fromAsyncThrowable, fromThrowable, ok, tryCatch, tryCatchAsync } from '../src/index.js';

describe('tryCatch', () => {
  it('returns Ok for a normal return', () => {
    assert.deepEqual(
      tryCatch(() => 1),
      ok(1),
    );
  });

  it('keeps the thrown value without a mapper', () => {
    const r = tryCatch(() => JSON.parse('{'));
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.error instanceof SyntaxError);
  });

  it('maps the thrown value', () => {
    assert.deepEqual(
      tryCatch(
        () => {
          throw new Error('nope');
        },
        (e) => `caught ${(e as Error).message}`,
      ),
      err('caught nope'),
    );
  });

  it('catches thrown non-Error values', () => {
    assert.deepEqual(
      tryCatch(() => {
        throw 42;
      }),
      err(42),
    );
  });
});

describe('tryCatchAsync', () => {
  it('catches rejections and synchronous throws', async () => {
    assert.deepEqual(await tryCatchAsync(async () => 1), ok(1));
    assert.deepEqual(
      await tryCatchAsync(
        async () => {
          throw new Error('async');
        },
        (e) => (e as Error).message,
      ),
      err('async'),
    );
    const syncThrow = (): Promise<number> => {
      throw new Error('sync');
    };
    assert.deepEqual(await tryCatchAsync(syncThrow, (e) => (e as Error).message), err('sync'));
  });
});

describe('fromThrowable', () => {
  it('wraps a function and keeps its arguments', () => {
    const parseUrl = fromThrowable(
      (s: string, base?: string) => new URL(s, base).href,
      () => 'invalid url' as const,
    );
    assert.deepEqual(parseUrl('/a', 'https://example.com'), ok('https://example.com/a'));
    assert.deepEqual(parseUrl('nope'), err('invalid url'));
    const raw = fromThrowable((s: string) => JSON.parse(s) as unknown);
    assert.equal(raw('[').ok, false);
  });

  it('fromAsyncThrowable', async () => {
    const load = fromAsyncThrowable(
      async (n: number) => {
        if (n < 0) throw new RangeError('negative');
        return n * 2;
      },
      (e) => (e as Error).name,
    );
    assert.deepEqual(await load(2), ok(4));
    assert.deepEqual(await load(-1), err('RangeError'));
    const raw = fromAsyncThrowable(async () => {
      throw 'x';
    });
    assert.deepEqual(await raw(), err('x'));
  });
});
