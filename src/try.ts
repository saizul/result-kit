import { ResultAsync } from './async.js';
import { Err, Ok, type Result } from './result.js';

const identity = <E>(reason: unknown) => reason as E;

/**
 * Runs `fn` and catches what it throws. `onError` maps the thrown value to
 * your error type; without it the error type is `unknown`.
 *
 * ```ts
 * const config = tryCatch(() => JSON.parse(text), (e) => new ConfigError(e));
 * ```
 */
export function tryCatch<T>(fn: () => T): Result<T, unknown>;
export function tryCatch<T, E>(fn: () => T, onError: (thrown: unknown) => E): Result<T, E>;
export function tryCatch<T, E>(fn: () => T, onError: (thrown: unknown) => E = identity): Result<T, E> {
  try {
    return new Ok(fn());
  } catch (thrown) {
    return new Err(onError(thrown));
  }
}

/**
 * Runs an async function and catches both synchronous throws and
 * rejections.
 */
export function tryCatchAsync<T>(fn: () => PromiseLike<T>): ResultAsync<T, unknown>;
export function tryCatchAsync<T, E>(
  fn: () => PromiseLike<T>,
  onError: (thrown: unknown) => E,
): ResultAsync<T, E>;
export function tryCatchAsync<T, E>(
  fn: () => PromiseLike<T>,
  onError: (thrown: unknown) => E = identity,
): ResultAsync<T, E> {
  let promise: PromiseLike<T>;
  try {
    promise = fn();
  } catch (thrown) {
    return new ResultAsync(Promise.resolve(new Err<T, E>(onError(thrown))));
  }
  return ResultAsync.fromPromise(promise, onError);
}

/**
 * Turns a function that throws into one that returns a `Result`, keeping
 * its parameters.
 *
 * ```ts
 * const parseUrl = fromThrowable((s: string) => new URL(s), () => 'invalid url' as const);
 * parseUrl('nope'); // Err('invalid url')
 * ```
 */
export function fromThrowable<A extends readonly unknown[], T>(
  fn: (...args: A) => T,
): (...args: A) => Result<T, unknown>;
export function fromThrowable<A extends readonly unknown[], T, E>(
  fn: (...args: A) => T,
  onError: (thrown: unknown) => E,
): (...args: A) => Result<T, E>;
export function fromThrowable<A extends readonly unknown[], T, E>(
  fn: (...args: A) => T,
  onError: (thrown: unknown) => E = identity,
): (...args: A) => Result<T, E> {
  return (...args) => tryCatch(() => fn(...args), onError);
}

/** Like `fromThrowable()` for async functions. */
export function fromAsyncThrowable<A extends readonly unknown[], T>(
  fn: (...args: A) => PromiseLike<T>,
): (...args: A) => ResultAsync<T, unknown>;
export function fromAsyncThrowable<A extends readonly unknown[], T, E>(
  fn: (...args: A) => PromiseLike<T>,
  onError: (thrown: unknown) => E,
): (...args: A) => ResultAsync<T, E>;
export function fromAsyncThrowable<A extends readonly unknown[], T, E>(
  fn: (...args: A) => PromiseLike<T>,
  onError: (thrown: unknown) => E = identity,
): (...args: A) => ResultAsync<T, E> {
  return (...args) => tryCatchAsync(() => fn(...args), onError);
}
