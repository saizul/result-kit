import { Err, type InferErr, type InferOk, Ok, type Result } from './result.js';

/** Anything `ResultAsync` accepts where a result is expected. */
export type ResultLike<T, E> = Result<T, E> | PromiseLike<Result<T, E>>;

/** The value type of a `Result`, `ResultAsync` or `Promise<Result>`. */
export type InferAsyncOk<R> = R extends PromiseLike<infer X> ? InferOk<X> : InferOk<R>;

/** The error type of a `Result`, `ResultAsync` or `Promise<Result>`. */
export type InferAsyncErr<R> = R extends PromiseLike<infer X> ? InferErr<X> : InferErr<R>;

/**
 * A `Promise<Result<T, E>>` with the `Result` methods on it, so async steps
 * chain without `await` at every line. It never rejects as long as the
 * functions you pass in do not throw. `await` it to get the `Result`.
 */
export class ResultAsync<T, E> implements PromiseLike<Result<T, E>> {
  private readonly promise: Promise<Result<T, E>>;

  constructor(promise: PromiseLike<Result<T, E>>) {
    this.promise = Promise.resolve(promise);
  }

  /** Wraps a promise that may reject. `mapError` turns the rejection into `E`. */
  static fromPromise<T, E>(promise: PromiseLike<T>, mapError: (reason: unknown) => E): ResultAsync<T, E> {
    return new ResultAsync(
      Promise.resolve(promise).then(
        (value) => new Ok<T, E>(value),
        (reason) => new Err<T, E>(mapError(reason)),
      ),
    );
  }

  /** Wraps a promise you know does not reject. */
  static fromSafePromise<T, E = never>(promise: PromiseLike<T>): ResultAsync<T, E> {
    return new ResultAsync(Promise.resolve(promise).then((value) => new Ok<T, E>(value)));
  }

  /** Lifts a synchronous `Result` (or a promise of one). */
  static fromResult<T, E>(result: ResultLike<T, E>): ResultAsync<T, E> {
    return new ResultAsync(Promise.resolve(result));
  }

  // biome-ignore lint/suspicious/noThenProperty: ResultAsync is a thenable on purpose, so `await` works.
  then<A = Result<T, E>, B = never>(
    onfulfilled?: ((value: Result<T, E>) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.promise.then(onfulfilled, onrejected);
  }

  /** Transforms the value; `fn` may be async. */
  map<U>(fn: (value: T) => U | PromiseLike<U>): ResultAsync<U, E> {
    return new ResultAsync(
      this.promise.then(async (r) => (r.ok ? new Ok<U, E>(await fn(r.value)) : (r as unknown as Err<U, E>))),
    );
  }

  /** Transforms the error; `fn` may be async. */
  mapErr<F>(fn: (error: E) => F | PromiseLike<F>): ResultAsync<T, F> {
    return new ResultAsync(
      this.promise.then(async (r) => (r.ok ? (r as unknown as Ok<T, F>) : new Err<T, F>(await fn(r.error)))),
    );
  }

  /**
   * Chains a step that can fail. `fn` may return a `Result`, a `ResultAsync`
   * or a `Promise<Result>`; the error type becomes the union.
   */
  andThen<R extends ResultLike<unknown, unknown>>(
    fn: (value: T) => R,
  ): ResultAsync<InferAsyncOk<R>, E | InferAsyncErr<R>> {
    return new ResultAsync(
      this.promise.then((r) => (r.ok ? fn(r.value) : r)) as PromiseLike<
        Result<InferAsyncOk<R>, E | InferAsyncErr<R>>
      >,
    );
  }

  /** Recovers from an error with a step that can fail. */
  orElse<R extends ResultLike<unknown, unknown>>(
    fn: (error: E) => R,
  ): ResultAsync<T | InferAsyncOk<R>, InferAsyncErr<R>> {
    return new ResultAsync(
      this.promise.then((r) => (r.ok ? r : fn(r.error))) as PromiseLike<
        Result<T | InferAsyncOk<R>, InferAsyncErr<R>>
      >,
    );
  }

  /** Resolves to whatever the matching function returns. */
  match<A, B = A>(
    onOk: (value: T) => A | PromiseLike<A>,
    onErr: (error: E) => B | PromiseLike<B>,
  ): Promise<A | B> {
    return this.promise.then((r) => (r.ok ? onOk(r.value) : onErr(r.error)));
  }

  /** Runs a side effect with the value (awaited if async). */
  tap(fn: (value: T) => unknown): ResultAsync<T, E> {
    return new ResultAsync(
      this.promise.then(async (r) => {
        if (r.ok) await fn(r.value);
        return r;
      }),
    );
  }

  /** Runs a side effect with the error (awaited if async). */
  tapErr(fn: (error: E) => unknown): ResultAsync<T, E> {
    return new ResultAsync(
      this.promise.then(async (r) => {
        if (!r.ok) await fn(r.error);
        return r;
      }),
    );
  }

  /** Resolves to the value, or `fallback`. */
  unwrapOr<U>(fallback: U): Promise<T | U> {
    return this.promise.then((r) => r.unwrapOr(fallback));
  }

  /** Resolves to the value, or the result of `fn(error)`. */
  unwrapOrElse<U>(fn: (error: E) => U): Promise<T | U> {
    return this.promise.then((r) => r.unwrapOrElse(fn));
  }

  /** Resolves to the value, or rejects with `UnwrapError`. */
  unwrap(): Promise<T> {
    return this.promise.then((r) => r.unwrap());
  }

  /** Lets `yield*` unwrap the value inside `safeTryAsync()`. */
  async *[Symbol.asyncIterator](): AsyncGenerator<Err<never, E>, T, unknown> {
    const r = await this.promise;
    return yield* r;
  }
}

/** A `ResultAsync` that resolves to `Ok(value)`. */
export function okAsync(): ResultAsync<void, never>;
export function okAsync<T>(value: T): ResultAsync<T, never>;
export function okAsync<T>(value?: T): ResultAsync<T | undefined, never> {
  return new ResultAsync(Promise.resolve(new Ok<T | undefined, never>(value)));
}

/** A `ResultAsync` that resolves to `Err(error)`. */
export function errAsync(): ResultAsync<never, void>;
export function errAsync<E>(error: E): ResultAsync<never, E>;
export function errAsync<E>(error?: E): ResultAsync<never, E | undefined> {
  return new ResultAsync(Promise.resolve(new Err<never, E | undefined>(error)));
}

/**
 * Wraps a promise that may reject. Without `mapError` the error type is
 * `unknown`, which is honest: a rejection can be anything.
 */
export function fromPromise<T>(promise: PromiseLike<T>): ResultAsync<T, unknown>;
export function fromPromise<T, E>(
  promise: PromiseLike<T>,
  mapError: (reason: unknown) => E,
): ResultAsync<T, E>;
export function fromPromise<T, E>(
  promise: PromiseLike<T>,
  mapError: (reason: unknown) => E = (reason) => reason as E,
): ResultAsync<T, E> {
  return ResultAsync.fromPromise(promise, mapError);
}

/** Wraps a promise you know does not reject. */
export function fromSafePromise<T, E = never>(promise: PromiseLike<T>): ResultAsync<T, E> {
  return ResultAsync.fromSafePromise(promise);
}

/**
 * The async version of `safeTry()`. Use `yield*` on a `Result` or a
 * `ResultAsync` inside an `async function*`.
 */
export function safeTryAsync<Y extends Err<never, unknown>, R extends Result<unknown, unknown>>(
  body: () => AsyncGenerator<Y, R, unknown>,
): ResultAsync<InferOk<R>, InferErr<R> | InferErr<Y>> {
  return new ResultAsync(
    (async (): Promise<Result<InferOk<R>, InferErr<R> | InferErr<Y>>> => {
      const gen = body();
      const step = await gen.next();
      if (step.done) return step.value as Result<InferOk<R>, InferErr<R>>;
      await gen.return(undefined as never);
      return step.value as Err<never, InferErr<Y>>;
    })(),
  );
}
