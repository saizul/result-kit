import { Err, Ok, type Result, UnwrapError } from './result.js';

/** An option that holds a value. */
export class Some<T> {
  /** `true` for `Some`, `false` for `None`. */
  readonly some = true as const;

  constructor(readonly value: T) {}

  isSome(): this is Some<T> {
    return true;
  }

  isNone(): this is None<T> {
    return false;
  }

  map<U>(fn: (value: T) => U): Option<U> {
    return new Some(fn(this.value));
  }

  andThen<U>(fn: (value: T) => Option<U>): Option<U> {
    return fn(this.value);
  }

  /** Keeps the value only if `predicate` holds. Type guards narrow `T`. */
  filter<S extends T>(predicate: (value: T) => value is S): Option<S>;
  filter(predicate: (value: T) => boolean): Option<T>;
  filter(predicate: (value: T) => boolean): Option<T> {
    return predicate(this.value) ? this : NONE;
  }

  /** This option, or `other` when this is `None`. */
  or<U>(_other: Option<U>): Option<T | U> {
    return this;
  }

  orElse<U>(_fn: () => Option<U>): Option<T | U> {
    return this;
  }

  match<A, B = A>(onSome: (value: T) => A, _onNone: () => B): A | B {
    return onSome(this.value);
  }

  tap(fn: (value: T) => void): Option<T> {
    fn(this.value);
    return this;
  }

  unwrap(): T {
    return this.value;
  }

  unwrapOr<U>(_fallback: U): T | U {
    return this.value;
  }

  unwrapOrElse<U>(_fn: () => U): T | U {
    return this.value;
  }

  expect(_message: string): T {
    return this.value;
  }

  /** `Ok(value)` for `Some`, `Err(error)` for `None`. */
  okOr<E>(_error: E): Result<T, E> {
    return new Ok(this.value);
  }

  okOrElse<E>(_fn: () => E): Result<T, E> {
    return new Ok(this.value);
  }

  /** Pairs two options: `Some([a, b])` only if both are `Some`. */
  zip<U>(other: Option<U>): Option<[T, U]> {
    return other.isSome() ? new Some([this.value, other.value] as [T, U]) : NONE;
  }

  toNullable(): T | null {
    return this.value;
  }

  toUndefined(): T | undefined {
    return this.value;
  }

  toString(): string {
    return `Some(${String(this.value)})`;
  }
}

/** An option without a value. */
export class None<T = never> {
  readonly some = false as const;

  isSome(): this is Some<T> {
    return false;
  }

  isNone(): this is None<T> {
    return true;
  }

  map<U>(_fn: (value: T) => U): Option<U> {
    return NONE;
  }

  andThen<U>(_fn: (value: T) => Option<U>): Option<U> {
    return NONE;
  }

  filter<S extends T>(predicate: (value: T) => value is S): Option<S>;
  filter(predicate: (value: T) => boolean): Option<T>;
  filter(_predicate: (value: T) => boolean): Option<T> {
    return NONE;
  }

  or<U>(other: Option<U>): Option<T | U> {
    return other;
  }

  orElse<U>(fn: () => Option<U>): Option<T | U> {
    return fn();
  }

  match<A, B = A>(_onSome: (value: T) => A, onNone: () => B): A | B {
    return onNone();
  }

  tap(_fn: (value: T) => void): Option<T> {
    return this;
  }

  unwrap(): T {
    throw new UnwrapError('Called unwrap() on a None');
  }

  unwrapOr<U>(fallback: U): T | U {
    return fallback;
  }

  unwrapOrElse<U>(fn: () => U): T | U {
    return fn();
  }

  expect(message: string): T {
    throw new UnwrapError(message);
  }

  okOr<E>(error: E): Result<T, E> {
    return new Err(error);
  }

  okOrElse<E>(fn: () => E): Result<T, E> {
    return new Err(fn());
  }

  zip<U>(_other: Option<U>): Option<[T, U]> {
    return NONE;
  }

  toNullable(): T | null {
    return null;
  }

  toUndefined(): T | undefined {
    return undefined;
  }

  toString(): string {
    return 'None';
  }
}

/** Either `Some<T>` with a value or `None`. */
export type Option<T> = Some<T> | None<T>;

const NONE: None<never> = Object.freeze(new None<never>());

/** Creates a `Some`. */
export function some<T>(value: T): Some<T> {
  return new Some(value);
}

/** The `None` value. It is a single frozen instance, so `===` works. */
export function none<T = never>(): None<T> {
  return NONE;
}

/** `None` for `null` and `undefined`, `Some(value)` for everything else. */
export function fromNullable<T>(value: T | null | undefined): Option<NonNullable<T>> {
  return value === null || value === undefined ? NONE : new Some(value as NonNullable<T>);
}

/** `Some(value)` for `Ok`, `None` for `Err` (the error is dropped). */
export function fromResult<T, E>(result: Result<T, E>): Option<T> {
  return result.ok ? new Some(result.value) : NONE;
}

/** `true` if `value` is a `Some` or a `None` from this library. */
export function isOption(value: unknown): value is Option<unknown> {
  return value instanceof Some || value instanceof None;
}
