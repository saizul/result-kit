/**
 * Thrown by `unwrap()`, `unwrapErr()`, `expect()` and `expectErr()` when the
 * result (or option) holds the other variant. The original value or error is
 * kept in `cause`.
 */
export class UnwrapError extends Error {
  override readonly name = 'UnwrapError';
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
  }
}

function describe(value: unknown): string {
  let text: string | undefined;
  if (value instanceof Error) text = `${value.name}: ${value.message}`;
  else {
    try {
      text = JSON.stringify(value);
    } catch {
      // cycles and BigInt: fall back to String()
    }
  }
  text ??= String(value);
  return text.length > 200 ? `${text.slice(0, 200)}...` : text;
}

/** A successful result holding a `value` of type `T`. */
export class Ok<T, E = never> {
  /** `true` for `Ok`, `false` for `Err`. Narrows the union in `if (r.ok)`. */
  readonly ok = true as const;

  constructor(readonly value: T) {}

  isOk(): this is Ok<T, E> {
    return true;
  }

  isErr(): this is Err<T, E> {
    return false;
  }

  /** Transforms the value. Errors pass through untouched. */
  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Ok(fn(this.value));
  }

  /** Transforms the error. Values pass through untouched. */
  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return this as unknown as Ok<T, F>;
  }

  /** Chains a step that can fail. The error type becomes the union `E | F`. */
  andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return fn(this.value);
  }

  /** Recovers from an error with a step that can fail. */
  orElse<U, F>(_fn: (error: E) => Result<U, F>): Result<T | U, F> {
    return this as unknown as Ok<T | U, F>;
  }

  /** Calls one of the two functions and returns what it returns. */
  match<A, B = A>(onOk: (value: T) => A, _onErr: (error: E) => B): A | B {
    return onOk(this.value);
  }

  /** Runs a side effect with the value and returns the same result. */
  tap(fn: (value: T) => void): Result<T, E> {
    fn(this.value);
    return this;
  }

  /** Runs a side effect with the error and returns the same result. */
  tapErr(_fn: (error: E) => void): Result<T, E> {
    return this;
  }

  /** The value, or throws `UnwrapError` with the error as `cause`. */
  unwrap(): T {
    return this.value;
  }

  /** The error, or throws `UnwrapError` with the value as `cause`. */
  unwrapErr(): E {
    throw new UnwrapError(`Called unwrapErr() on an Ok: ${describe(this.value)}`, this.value);
  }

  /** The value, or `fallback`. */
  unwrapOr<U>(_fallback: U): T | U {
    return this.value;
  }

  /** The value, or the result of `fn(error)`. */
  unwrapOrElse<U>(_fn: (error: E) => U): T | U {
    return this.value;
  }

  /** Like `unwrap()` with your own message. */
  expect(_message: string): T {
    return this.value;
  }

  /** Like `unwrapErr()` with your own message. */
  expectErr(message: string): E {
    throw new UnwrapError(message, this.value);
  }

  /** `true` if this is an `Ok` and `predicate(value)` holds. */
  isOkAnd(predicate: (value: T) => boolean): boolean {
    return predicate(this.value);
  }

  /** `true` if this is an `Err` and `predicate(error)` holds. */
  isErrAnd(_predicate: (error: E) => boolean): boolean {
    return false;
  }

  /** Lets `yield*` unwrap the value inside `safeTry()`. */
  // biome-ignore lint/correctness/useYield: an Ok finishes immediately with its value.
  *[Symbol.iterator](): Generator<Err<never, E>, T, unknown> {
    return this.value;
  }

  toString(): string {
    return `Ok(${describe(this.value)})`;
  }
}

/** A failed result holding an `error` of type `E`. */
export class Err<T = never, E = unknown> {
  /** `true` for `Ok`, `false` for `Err`. Narrows the union in `if (!r.ok)`. */
  readonly ok = false as const;

  constructor(readonly error: E) {}

  isOk(): this is Ok<T, E> {
    return false;
  }

  isErr(): this is Err<T, E> {
    return true;
  }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return this as unknown as Err<U, E>;
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return new Err(fn(this.error));
  }

  andThen<U, F>(_fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return this as unknown as Err<U, E | F>;
  }

  orElse<U, F>(fn: (error: E) => Result<U, F>): Result<T | U, F> {
    return fn(this.error);
  }

  match<A, B = A>(_onOk: (value: T) => A, onErr: (error: E) => B): A | B {
    return onErr(this.error);
  }

  tap(_fn: (value: T) => void): Result<T, E> {
    return this;
  }

  tapErr(fn: (error: E) => void): Result<T, E> {
    fn(this.error);
    return this;
  }

  unwrap(): T {
    throw new UnwrapError(`Called unwrap() on an Err: ${describe(this.error)}`, this.error);
  }

  unwrapErr(): E {
    return this.error;
  }

  unwrapOr<U>(fallback: U): T | U {
    return fallback;
  }

  unwrapOrElse<U>(fn: (error: E) => U): T | U {
    return fn(this.error);
  }

  expect(message: string): T {
    throw new UnwrapError(message, this.error);
  }

  expectErr(_message: string): E {
    return this.error;
  }

  isOkAnd(_predicate: (value: T) => boolean): boolean {
    return false;
  }

  isErrAnd(predicate: (error: E) => boolean): boolean {
    return predicate(this.error);
  }

  *[Symbol.iterator](): Generator<Err<never, E>, T, unknown> {
    yield this as unknown as Err<never, E>;
    // safeTry() never resumes a generator after an Err.
    throw new UnwrapError('Resumed a generator after an Err was yielded', this.error);
  }

  toString(): string {
    return `Err(${describe(this.error)})`;
  }
}

/** Either `Ok<T>` with a value or `Err<E>` with an error. */
export type Result<T, E> = Ok<T, E> | Err<T, E>;

/** The value type of a `Result` (or a union of results). */
export type InferOk<R> = R extends Ok<infer T, unknown> ? T : R extends Err<infer T, unknown> ? T : never;

/** The error type of a `Result` (or a union of results). */
export type InferErr<R> = R extends Ok<unknown, infer E> ? E : R extends Err<unknown, infer E> ? E : never;

/**
 * Creates an `Ok`. `ok()` with no argument is `Ok<void>`. The error type is
 * `never`; an `Ok<T, never>` is assignable to any `Result<T, E>`.
 */
export function ok(): Ok<void, never>;
export function ok<T>(value: T): Ok<T, never>;
export function ok<T>(value?: T): Ok<T | undefined, never> {
  return new Ok(value);
}

/**
 * Creates an `Err`. `err()` with no argument is `Err<void>`. The value type
 * is `never`; an `Err<never, E>` is assignable to any `Result<T, E>`.
 */
export function err(): Err<never, void>;
export function err<E>(error: E): Err<never, E>;
export function err<E>(error?: E): Err<never, E | undefined> {
  return new Err(error);
}

/** `true` if `value` is an `Ok` or an `Err` from this library. */
export function isResult(value: unknown): value is Result<unknown, unknown> {
  return value instanceof Ok || value instanceof Err;
}

/**
 * Early-return style without nested `andThen` calls. Inside the generator,
 * `yield* result` gives you the value of an `Ok`; an `Err` stops the
 * generator and becomes the return value of `safeTry`.
 *
 * ```ts
 * const total = safeTry(function* () {
 *   const a = yield* parseNumber(x);
 *   const b = yield* parseNumber(y);
 *   return ok(a + b);
 * });
 * ```
 */
export function safeTry<Y extends Err<never, unknown>, R extends Result<unknown, unknown>>(
  body: () => Generator<Y, R, unknown>,
): Result<InferOk<R>, InferErr<R> | InferErr<Y>> {
  const gen = body();
  const step = gen.next();
  if (step.done) return step.value as Result<InferOk<R>, InferErr<R>>;
  gen.return(undefined as never);
  return step.value as Err<never, InferErr<Y>>;
}
