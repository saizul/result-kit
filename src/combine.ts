import { type InferAsyncErr, type InferAsyncOk, ResultAsync, type ResultLike } from './async.js';
import { Err, type InferErr, type InferOk, Ok, type Result } from './result.js';

type AnyResult = Result<unknown, unknown>;

/** The tuple (or array) of values of a tuple of results. */
export type OkValues<R extends readonly unknown[]> = { -readonly [K in keyof R]: InferOk<R[K]> };

/** The tuple (or array) of errors of a tuple of results. */
export type ErrValues<R extends readonly unknown[]> = { -readonly [K in keyof R]: InferErr<R[K]> };

/**
 * `Ok` with every value (as a tuple, in order) if all results are `Ok`,
 * otherwise the first `Err`.
 *
 * ```ts
 * all([ok(1), ok('a')]);        // Ok([1, 'a'])  typed [number, string]
 * all([ok(1), err('boom')]);    // Err('boom')
 * ```
 */
export function all<const R extends readonly AnyResult[]>(
  results: R,
): Result<OkValues<R>, InferErr<R[number]>> {
  const values: unknown[] = [];
  for (const r of results) {
    if (!r.ok) return r as unknown as Err<OkValues<R>, InferErr<R[number]>>;
    values.push(r.value);
  }
  return new Ok(values as OkValues<R>);
}

/** Like `all()` but collects every error instead of stopping at the first. */
export function allWithErrors<const R extends readonly AnyResult[]>(
  results: R,
): Result<OkValues<R>, InferErr<R[number]>[]> {
  const values: unknown[] = [];
  const errors: unknown[] = [];
  for (const r of results) {
    if (r.ok) values.push(r.value);
    else errors.push(r.error);
  }
  return errors.length > 0 ? new Err(errors as InferErr<R[number]>[]) : new Ok(values as OkValues<R>);
}

/**
 * The first `Ok`, or `Err` with every error (in order) if none succeeded.
 * An empty list gives `Err([])`.
 */
export function any<const R extends readonly AnyResult[]>(
  results: R,
): Result<InferOk<R[number]>, ErrValues<R>> {
  const errors: unknown[] = [];
  for (const r of results) {
    if (r.ok) return r as unknown as Ok<InferOk<R[number]>, ErrValues<R>>;
    errors.push(r.error);
  }
  return new Err(errors as ErrValues<R>);
}

/**
 * `all()` for an object of results: `Ok` with an object of values, or the
 * first `Err` in key order.
 *
 * ```ts
 * combine({ name: parseName(x), age: parseAge(y) }); // Result<{ name: string; age: number }, ...>
 * ```
 */
export function combine<const R extends Record<string, AnyResult>>(
  results: R,
): Result<{ -readonly [K in keyof R]: InferOk<R[K]> }, InferErr<R[keyof R]>> {
  const values: Record<string, unknown> = {};
  for (const key of Object.keys(results)) {
    const r = results[key]!;
    if (!r.ok) return r as unknown as Err<never, InferErr<R[keyof R]>>;
    values[key] = r.value;
  }
  return new Ok(values as { -readonly [K in keyof R]: InferOk<R[K]> });
}

/** Splits results into `[values, errors]`. */
export function partition<T, E>(results: Iterable<Result<T, E>>): [T[], E[]] {
  const values: T[] = [];
  const errors: E[] = [];
  for (const r of results) {
    if (r.ok) values.push(r.value);
    else errors.push(r.error);
  }
  return [values, errors];
}

type AnyResultLike = ResultLike<unknown, unknown>;
type AsyncOkValues<R extends readonly unknown[]> = { -readonly [K in keyof R]: InferAsyncOk<R[K]> };
type AsyncErrValues<R extends readonly unknown[]> = { -readonly [K in keyof R]: InferAsyncErr<R[K]> };

/**
 * `all()` for `ResultAsync`, `Promise<Result>` and plain results. Everything
 * runs concurrently; resolves to the first `Err` in list order.
 */
export function allAsync<const R extends readonly AnyResultLike[]>(
  results: R,
): ResultAsync<AsyncOkValues<R>, InferAsyncErr<R[number]>> {
  return new ResultAsync(
    Promise.all(results).then((settled) => all(settled as AnyResult[])) as PromiseLike<
      Result<AsyncOkValues<R>, InferAsyncErr<R[number]>>
    >,
  );
}

/** `any()` for `ResultAsync`, `Promise<Result>` and plain results. */
export function anyAsync<const R extends readonly AnyResultLike[]>(
  results: R,
): ResultAsync<InferAsyncOk<R[number]>, AsyncErrValues<R>> {
  return new ResultAsync(
    Promise.all(results).then((settled) => any(settled as AnyResult[])) as PromiseLike<
      Result<InferAsyncOk<R[number]>, AsyncErrValues<R>>
    >,
  );
}
