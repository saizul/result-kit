import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  err,
  errAsync,
  fromPromise,
  fromSafePromise,
  ok,
  okAsync,
  type Result,
  ResultAsync,
  safeTryAsync,
  UnwrapError,
} from '../src/index.js';

const delay = <T>(value: T, ms = 1) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

const findUser = (id: number): ResultAsync<{ id: number; name: string }, 'not-found'> =>
  id === 1 ? okAsync({ id, name: 'Ada' }) : errAsync('not-found');

describe('ResultAsync', () => {
  it('is awaitable and resolves to a Result', async () => {
    assert.deepEqual(await okAsync(1), ok(1));
    assert.deepEqual(await errAsync('x'), err('x'));
    assert.deepEqual(await okAsync(), ok());
    assert.deepEqual(await errAsync(), err());
  });

  it('works with Promise.all and .then chains', async () => {
    const [a, b] = await Promise.all([okAsync(1), errAsync('e')]);
    assert.deepEqual(a, ok(1));
    assert.deepEqual(b, err('e'));
    const caught = await okAsync(1)
      .then(() => {
        throw new Error('boom');
      }, undefined)
      .then(undefined, (e: Error) => e.message);
    assert.equal(caught, 'boom');
  });

  it('map and mapErr accept sync and async functions', async () => {
    assert.deepEqual(await okAsync(1).map((n) => n + 1), ok(2));
    assert.deepEqual(await okAsync(1).map(async (n) => delay(n + 2)), ok(3));
    assert.deepEqual(await errAsync('e').map((n: number) => n + 1), err('e'));
    assert.deepEqual(await errAsync('e').mapErr(async (e) => delay(`${e}!`)), err('e!'));
    assert.deepEqual(await okAsync(1).mapErr(() => 'never'), ok(1));
  });

  it('andThen accepts Result, ResultAsync and Promise<Result>', async () => {
    const r = await okAsync(1)
      .andThen((id) => findUser(id))
      .andThen((u) => ok(u.name))
      .andThen(async (name) => {
        await delay(0);
        return ok(name.length);
      });
    assert.deepEqual(r, ok(3));

    const calls: string[] = [];
    const failed = await okAsync(2)
      .andThen(findUser)
      .andThen((u) => {
        calls.push(u.name);
        return ok(u);
      });
    assert.deepEqual(failed, err('not-found'));
    assert.deepEqual(calls, []);
  });

  it('orElse recovers', async () => {
    assert.deepEqual(
      await findUser(2).orElse(() => okAsync({ id: 0, name: 'guest' })),
      ok({ id: 0, name: 'guest' }),
    );
    assert.deepEqual(
      await findUser(1).orElse(() => ok({ id: 0, name: 'guest' })),
      ok({ id: 1, name: 'Ada' }),
    );
    assert.deepEqual(await findUser(2).orElse(async (e) => err(`${e}!`)), err('not-found!'));
  });

  it('match resolves to the branch value', async () => {
    assert.equal(
      await findUser(1).match(
        (u) => u.name,
        (e) => e,
      ),
      'Ada',
    );
    assert.equal(
      await findUser(2).match(
        (u) => u.name,
        async (e) => delay(e.toUpperCase()),
      ),
      'NOT-FOUND',
    );
  });

  it('tap and tapErr await side effects in order', async () => {
    const log: string[] = [];
    await findUser(1)
      .tap(async (u) => {
        await delay(null, 5);
        log.push(`tap ${u.name}`);
      })
      .tapErr(() => log.push('never'))
      .map((u) => log.push(`map ${u.name}`));
    await findUser(2)
      .tap(() => log.push('never'))
      .tapErr((e) => log.push(`tapErr ${e}`));
    assert.deepEqual(log, ['tap Ada', 'map Ada', 'tapErr not-found']);
  });

  it('unwrap, unwrapOr, unwrapOrElse', async () => {
    assert.equal(await okAsync(1).unwrap(), 1);
    await assert.rejects(errAsync('bad').unwrap(), UnwrapError);
    assert.equal(await errAsync('bad').unwrapOr(0), 0);
    assert.equal(await errAsync('bad').unwrapOrElse((e) => e.length), 3);
    assert.equal(await okAsync(5).unwrapOrElse(() => 0), 5);
  });

  it('a function that throws rejects the ResultAsync', async () => {
    await assert.rejects(
      async () =>
        okAsync(1).map(() => {
          throw new Error('bug');
        }),
      { message: 'bug' },
    );
  });
});

describe('fromPromise and fromSafePromise', () => {
  it('turns rejections into Err with the mapper', async () => {
    assert.deepEqual(await fromPromise(Promise.resolve(1), () => 'x'), ok(1));
    assert.deepEqual(
      await fromPromise(Promise.reject(new Error('down')), (e) => `wrapped: ${(e as Error).message}`),
      err('wrapped: down'),
    );
    const reason = new Error('raw');
    assert.deepEqual(await fromPromise(Promise.reject(reason)), err(reason));
    assert.deepEqual(await ResultAsync.fromPromise(delay(2), String), ok(2));
  });

  it('fromSafePromise and fromResult', async () => {
    assert.deepEqual(await fromSafePromise(delay('v')), ok('v'));
    assert.deepEqual(await ResultAsync.fromResult(err('x')), err('x'));
    assert.deepEqual(await ResultAsync.fromResult(Promise.resolve(ok(1))), ok(1));
  });

  it('accepts thenables that are not real promises', async () => {
    const thenable: PromiseLike<number> = {
      // biome-ignore lint/suspicious/noThenProperty: testing a custom thenable on purpose
      then: (resolve) => Promise.resolve(resolve?.(7)) as never,
    };
    assert.deepEqual(await fromPromise(thenable, String), ok(7));
  });
});

describe('safeTryAsync', () => {
  it('unwraps Result and ResultAsync with yield*', async () => {
    const r = await safeTryAsync(async function* () {
      const user = yield* findUser(1);
      const n = yield* ok(2) as Result<number, 'bad'>;
      return ok(`${user.name} x${n}`);
    });
    assert.deepEqual(r, ok('Ada x2'));
  });

  it('stops at the first Err', async () => {
    const log: string[] = [];
    const r = await safeTryAsync(async function* () {
      try {
        const user = yield* findUser(2);
        log.push(user.name);
        return ok(user);
      } finally {
        log.push('cleanup');
      }
    });
    assert.deepEqual(r, err('not-found'));
    assert.deepEqual(log, ['cleanup']);
  });
});
