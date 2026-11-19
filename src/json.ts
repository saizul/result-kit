import { TaggedError } from './errors.js';
import { Err, Ok, type Result } from './result.js';

/** The text was not valid JSON. `cause` is the `SyntaxError`. */
export class ParseError extends TaggedError('parse') {
  constructor(
    readonly input: string,
    cause: unknown,
  ) {
    super(`Invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}

/** The JSON was valid but did not pass your type guard or validator. */
export class ValidationError extends TaggedError('validation') {
  constructor(
    readonly value: unknown,
    message = 'The value did not match the expected shape',
    cause?: unknown,
  ) {
    super(message, { cause });
  }
}

/** The value could not be turned into JSON (a cycle, a BigInt, ...). */
export class StringifyError extends TaggedError('stringify') {
  constructor(cause: unknown) {
    super(`Could not serialize to JSON: ${cause instanceof Error ? cause.message : String(cause)}`, {
      cause,
    });
  }
}

/**
 * Checks a parsed value. Either a type guard (`(v) => v is T`) or a
 * function that returns a `Result<T, string | Error>` such as a schema
 * library adapter.
 */
export type Validator<T> = ((value: unknown) => value is T) | ((value: unknown) => Result<T, unknown>);

/** Runs a validator and turns its answer into a `Result`. */
export function validate<T>(value: unknown, validator: Validator<T>): Result<T, ValidationError> {
  let answer: boolean | Result<T, unknown>;
  try {
    answer = validator(value);
  } catch (thrown) {
    return new Err(new ValidationError(value, messageOf(thrown), thrown));
  }
  if (typeof answer === 'boolean') {
    return answer ? new Ok(value as T) : new Err(new ValidationError(value));
  }
  return answer.ok
    ? new Ok(answer.value)
    : new Err(new ValidationError(value, messageOf(answer.error), answer.error));
}

function messageOf(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string' && reason !== '') return reason;
  return 'The value did not match the expected shape';
}

/**
 * `JSON.parse` that returns a `Result` instead of throwing. Pass a
 * validator to get a typed value instead of `unknown`.
 *
 * ```ts
 * safeJsonParse('{"a":1}');                 // Ok({ a: 1 })  typed unknown
 * safeJsonParse(text, isUser);              // Result<User, ParseError | ValidationError>
 * ```
 */
export function safeJsonParse(text: string): Result<unknown, ParseError>;
export function safeJsonParse<T>(
  text: string,
  validator: Validator<T>,
): Result<T, ParseError | ValidationError>;
export function safeJsonParse<T>(
  text: string,
  validator?: Validator<T>,
): Result<unknown, ParseError | ValidationError> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    return new Err(new ParseError(text, cause));
  }
  return validator ? validate(value, validator) : new Ok(value);
}

/** `JSON.stringify` that returns a `Result`. `undefined` input gives an error too. */
export function safeJsonStringify(value: unknown, space?: number | string): Result<string, StringifyError> {
  try {
    const text = JSON.stringify(value, null, space);
    if (text === undefined) return new Err(new StringifyError(new TypeError(`${typeof value} is not JSON`)));
    return new Ok(text);
  } catch (cause) {
    return new Err(new StringifyError(cause));
  }
}
