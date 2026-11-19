import { ResultAsync } from './async.js';
import { TaggedError } from './errors.js';
import { type ParseError, safeJsonParse, type ValidationError, type Validator, validate } from './json.js';
import { Err, Ok, type Result } from './result.js';

/** The request never got a response: DNS, refused connection, CORS, ... */
export class NetworkError extends TaggedError('network') {
  constructor(cause: unknown) {
    super(`Network error: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}

/** The request was cancelled with the `signal` you passed. */
export class AbortError extends TaggedError('abort') {
  constructor(cause: unknown) {
    super('The request was aborted', { cause });
  }
}

/** The request took longer than `timeoutMs`. */
export class TimeoutError extends TaggedError('timeout') {
  constructor(readonly timeoutMs: number) {
    super(`The request timed out after ${timeoutMs} ms`);
  }
}

/** The server answered with a status outside 200-299. */
export class HttpError extends TaggedError('http') {
  readonly status: number;
  readonly statusText: string;
  constructor(
    readonly response: Response,
    /** The response body as text, read so you can log it. Up to 64 KiB. */
    readonly body: string,
  ) {
    super(`HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`);
    this.status = response.status;
    this.statusText = response.statusText;
  }
}

/** Everything `safeFetch()` can fail with. */
export type FetchError = NetworkError | AbortError | TimeoutError | HttpError;

/** Everything `safeFetchJson()` can fail with. */
export type FetchJsonError = FetchError | ParseError | ValidationError;

/** The `fetch` signature this module needs. */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface SafeFetchOptions {
  /** Abort and fail with `TimeoutError` after this many milliseconds. */
  timeoutMs?: number;
  /** Treat non-2xx responses as success (default `false`: they are `HttpError`). */
  allowHttpErrors?: boolean;
  /** The fetch implementation. Defaults to `globalThis.fetch`. */
  fetch?: FetchLike;
}

const MAX_ERROR_BODY = 64 * 1024;

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > MAX_ERROR_BODY ? text.slice(0, MAX_ERROR_BODY) : text;
  } catch {
    return '';
  }
}

/**
 * `fetch` that never throws. Resolves to `Ok(Response)` for 2xx answers and
 * to `Err` with a tagged error otherwise.
 *
 * ```ts
 * const r = await safeFetch('https://api.example.com/users/1', undefined, { timeoutMs: 5000 });
 * if (!r.ok) console.error(r.error.kind, r.error.message);
 * ```
 */
export function safeFetch(
  input: string | URL | Request,
  init?: RequestInit,
  options: SafeFetchOptions = {},
): ResultAsync<Response, FetchError> {
  const fetchImpl = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
  if (typeof fetchImpl !== 'function') {
    return new ResultAsync(
      Promise.resolve(
        new Err<Response, FetchError>(new NetworkError(new TypeError('fetch is not available'))),
      ),
    );
  }
  return new ResultAsync(run(fetchImpl, input, init, options));
}

async function run(
  fetchImpl: FetchLike,
  input: string | URL | Request,
  init: RequestInit | undefined,
  options: SafeFetchOptions,
): Promise<Result<Response, FetchError>> {
  const outer = init?.signal ?? undefined;
  if (outer?.aborted) return new Err(new AbortError(outer.reason));

  const { timeoutMs } = options;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const onOuterAbort = () => controller?.abort(outer?.reason);

  if (timeoutMs !== undefined) {
    controller = new AbortController();
    timer = setTimeout(() => {
      timedOut = true;
      controller?.abort(new TimeoutError(timeoutMs));
    }, timeoutMs);
    outer?.addEventListener('abort', onOuterAbort, { once: true });
  }

  try {
    const response = await fetchImpl(input, controller ? { ...init, signal: controller.signal } : init);
    if (!response.ok && !options.allowHttpErrors) {
      return new Err(new HttpError(response, await readErrorBody(response)));
    }
    return new Ok(response);
  } catch (cause) {
    if (timedOut && timeoutMs !== undefined) return new Err(new TimeoutError(timeoutMs));
    if (outer?.aborted || isAbort(cause)) return new Err(new AbortError(cause));
    return new Err(new NetworkError(cause));
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    outer?.removeEventListener('abort', onOuterAbort);
  }
}

function isAbort(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && (cause as { name?: unknown }).name === 'AbortError';
}

export interface SafeFetchJsonOptions<T> extends SafeFetchOptions {
  /** A type guard or `Result`-returning validator for the parsed body. */
  validate?: Validator<T>;
}

/**
 * `safeFetch()` followed by reading and parsing the body as JSON. Pass
 * `validate` to get a typed value instead of `unknown`.
 */
export function safeFetchJson(
  input: string | URL | Request,
  init?: RequestInit,
  options?: SafeFetchOptions,
): ResultAsync<unknown, FetchError | ParseError>;
export function safeFetchJson<T>(
  input: string | URL | Request,
  init: RequestInit | undefined,
  options: SafeFetchJsonOptions<T> & { validate: Validator<T> },
): ResultAsync<T, FetchJsonError>;
export function safeFetchJson<T>(
  input: string | URL | Request,
  init?: RequestInit,
  options: SafeFetchJsonOptions<T> = {},
): ResultAsync<unknown, FetchJsonError> {
  const headers = new Headers(init?.headers);
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  return safeFetch(input, { ...init, headers }, options)
    .andThen((response) =>
      ResultAsync.fromPromise(response.text(), (cause): FetchJsonError => new NetworkError(cause)),
    )
    .andThen((text): Result<unknown, FetchJsonError> => {
      const parsed = safeJsonParse(text);
      if (!parsed.ok || !options.validate) return parsed;
      return validate(parsed.value, options.validate);
    });
}
