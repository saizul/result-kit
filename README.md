# result-kit

[![CI](https://github.com/saizul/result-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/saizul/result-kit/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/saizul/result-kit?sort=semver)](https://github.com/saizul/result-kit/releases)
[![npm (GitHub Packages)](https://img.shields.io/badge/npm-%40saizul%2Fresult--kit-blue)](https://github.com/saizul/result-kit/pkgs/npm/result-kit)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![TypeScript](https://img.shields.io/badge/types-included-blue)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Errors you can see in the type signature. A tiny `Result<T, E>` and
`Option<T>` for TypeScript, with async chaining, typed error unions and safe
`fetch` / `JSON.parse` helpers.

- **`Result<T, E>` and `Option<T>`** with `map`, `andThen`, `orElse`,
  `match`, `unwrapOr`, `tap` and friends. Narrow with `if (r.ok)`.
- **`ResultAsync`** wraps a `Promise<Result>` so async steps chain without
  `await` on every line, and you can still `await` it.
- **Error unions add up by themselves**: `a.andThen(b).andThen(c)` has the
  error type `EA | EB | EC`, and `matchKind()` makes handling them
  exhaustive.
- **Bridges to throwing code**: `tryCatch`, `fromThrowable`, `fromPromise`,
  `tryCatchAsync`.
- **Combinators**: `all`, `any`, `combine` (objects), `partition`,
  `allWithErrors`, `combineWithErrors` (per-field errors), `allAsync`, `anyAsync`.
- **`safeTry` generators** for early-return style without nesting.
- **`safeFetch`, `safeFetchJson`, `safeJsonParse`, `safeJsonStringify`**
  that never throw and return tagged errors (`network`, `timeout`, `http`,
  `parse`, ...).

Zero runtime dependencies, no Node APIs (works in browsers, Deno, Bun and
edge runtimes), ESM + CommonJS + type declarations, `sideEffects: false`.

```ts
import { safeFetchJson, matchKind } from '@saizul/result-kit';

const user = await safeFetchJson('/api/users/1', undefined, { validate: isUser, timeoutMs: 5000 });

if (user.ok) {
  console.log(`Hello ${user.value.name}`);
} else {
  console.error(
    matchKind(user.error, {
      network: () => 'You are offline',
      abort: () => 'Cancelled',
      timeout: (e) => `No answer after ${e.timeoutMs} ms`,
      http: (e) => `The server said ${e.status}`,
      parse: () => 'The server sent something that is not JSON',
      validation: () => 'The server sent an unexpected shape',
    }),
  );
}
```

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Why: compared with throwing code](#why-compared-with-throwing-code)
- [Migration recipes](#migration-recipes)
- [API reference](#api-reference)
- [Examples](#examples)
- [FAQ](#faq)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Install

The package is published to GitHub Packages as `@saizul/result-kit`. Tell
npm where the `@saizul` scope lives (once per project or in `~/.npmrc`):

```console
$ echo "@saizul:registry=https://npm.pkg.github.com" >> .npmrc
$ npm install @saizul/result-kit
```

GitHub Packages needs a token with `read:packages` even for public packages;
see [Authenticating to GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages).

TypeScript 5.0 or newer is recommended (the combinators use `const` type
parameters). Node 20 or newer for the CommonJS and ESM builds.

## Quick start

```ts
import { ok, err, type Result } from '@saizul/result-kit';

function parseAge(input: string): Result<number, 'not-a-number' | 'out-of-range'> {
  const n = Number(input);
  if (!Number.isInteger(n)) return err('not-a-number');
  if (n < 0 || n > 150) return err('out-of-range');
  return ok(n);
}

const r = parseAge('42');

if (r.ok) {
  r.value; // number
} else {
  r.error; // 'not-a-number' | 'out-of-range'
}

parseAge('x')
  .map((age) => age + 1)
  .unwrapOr(0); // 0

parseAge('200').match(
  (age) => `You are ${age}`,
  (e) => (e === 'out-of-range' ? 'Really?' : 'Please type a number'),
); // 'Really?'
```

Async steps chain the same way:

```ts
import { ResultAsync, fromPromise, ok, err } from '@saizul/result-kit';

const getUser = (id: string) =>
  fromPromise(db.users.findById(id), (cause) => new DbError(cause)).andThen((user) =>
    user ? ok(user) : err(new NotFound(id)),
  );

const greeting = await getUser('7')
  .andThen((user) => sendWelcomeMail(user)) // returns ResultAsync<MailId, MailError>
  .map((mailId) => `sent ${mailId}`)
  .unwrapOr('could not send'); // string
// The error type along the way is DbError | NotFound | MailError.
```

## Why: compared with throwing code

Throwing is fine for bugs. It is a poor fit for failures you expect, such
as "user not found", "the API is down" or "that is not a valid email",
because nothing in the signature tells the caller they can happen.

| | `throw` / `try...catch` | `Result<T, E>` |
| --- | --- | --- |
| Can it fail? | Read the source (or find out in production) | In the return type |
| How can it fail? | `catch (e)` gives you `unknown` | `E` is a union you can `switch` on |
| Forgetting to handle | Compiles, crashes later | You must unwrap to get the value |
| Adding a new failure | Silent for every caller | Callers that `matchKind` get a compile error |
| Async | `try/await/catch` blocks around everything | `ResultAsync` chains, still awaitable |
| Control flow | Jumps up the stack to an unknown handler | Plain values, easy to log, test and pass around |
| Cost | Stack capture on every throw | An object allocation |

The same function, both ways:

```ts
// Throwing: the signature says nothing about failure.
async function loadSettings(userId: string): Promise<Settings> {
  const res = await fetch(`/api/settings/${userId}`); // may throw (network)
  if (!res.ok) throw new Error(`HTTP ${res.status}`); // you might forget this line
  const data = await res.json(); // may throw (invalid JSON)
  if (!isSettings(data)) throw new Error('bad shape');
  return data;
}

try {
  render(await loadSettings(id));
} catch (e) {
  // e is unknown: was it the network, a 404, or a bug in render()?
  showError(String(e));
}
```

```ts
// With result-kit: every failure is in the type.
const loadSettings = (userId: string) =>
  safeFetchJson(`/api/settings/${userId}`, undefined, { validate: isSettings });
// ResultAsync<Settings, NetworkError | AbortError | TimeoutError | HttpError | ParseError | ValidationError>

const settings = await loadSettings(id);
if (settings.ok) render(settings.value); // a bug in render() still throws, as it should
else if (settings.error.kind === 'http' && settings.error.status === 404) showDefaults();
else showError(settings.error.message);
```

Keep `throw` for programmer errors and invariants (`unwrap()` throws
`UnwrapError` on purpose). Use `Result` for failures a caller should decide
about.

## Migration recipes

You do not have to convert a whole code base. Start at the edges, where
throwing code comes in, and work inwards.

### 1. Wrap a function that throws

```ts
// Before
const config = JSON.parse(text); // throws SyntaxError

// After
import { safeJsonParse, tryCatch, fromThrowable } from '@saizul/result-kit';

const config = safeJsonParse(text); // Result<unknown, ParseError>
const url = tryCatch(() => new URL(input), () => 'invalid-url' as const); // Result<URL, 'invalid-url'>

// Or wrap once and reuse, keeping the parameters:
const parseUrl = fromThrowable((s: string) => new URL(s), () => 'invalid-url' as const);
parseUrl('https://example.com'); // Ok(URL)
```

### 2. Wrap a promise that rejects

```ts
// Before
try {
  const user = await db.users.findById(id);
} catch (e) {
  /* ... */
}

// After
import { fromPromise, tryCatchAsync } from '@saizul/result-kit';

const user = await fromPromise(db.users.findById(id), (cause) => new DbError(cause));
// or, if the call itself can throw synchronously:
const user2 = await tryCatchAsync(() => db.users.findById(id), (cause) => new DbError(cause));
```

### 3. Replace `null` returns with `Option`

```ts
// Before
function findUser(id: string): User | undefined

// After
import { fromNullable, type Option } from '@saizul/result-kit';

function findUser(id: string): Option<User> {
  return fromNullable(users.get(id));
}

findUser('1').map((u) => u.name).unwrapOr('anonymous');
findUser('1').okOr(new NotFound('1')); // to a Result when absence is an error
```

### 4. Replace a chain of `try` blocks with `andThen`

```ts
// Before
function signUp(input: unknown) {
  const data = validate(input); // throws ValidationError
  const user = createUser(data); // throws DuplicateEmail
  sendWelcome(user); // throws MailError
  return user;
}

// After: each step returns a Result; the error types add up.
const signUp = (input: unknown) =>
  validate(input)
    .andThen(createUser)
    .andThen((user) => sendWelcome(user).map(() => user));
// Result<User, ValidationError | DuplicateEmail | MailError>
```

### 5. Many steps: `safeTry` instead of nesting

```ts
import { safeTry, ok } from '@saizul/result-kit';

const order = safeTry(function* () {
  const user = yield* findUser(id).okOr(new NotFound(id));
  const cart = yield* loadCart(user);
  const total = yield* priceCart(cart);
  return ok({ user, total });
});
// Result<{ user; total }, NotFound | CartError | PricingError>
```

Use `safeTryAsync(async function* () { ... })` with `ResultAsync` values.

### 6. Typed errors instead of `new Error('...')`

```ts
import { TaggedError, matchKind } from '@saizul/result-kit';

class NotFound extends TaggedError('NotFound') {
  constructor(readonly id: string) {
    super(`No user with id ${id}`);
  }
}
class Forbidden extends TaggedError('Forbidden') {}

// They are real Errors (stack, cause, instanceof) with a literal `kind`:
const status = matchKind(error, { NotFound: () => 404, Forbidden: () => 403 });
// Forget a kind and it does not compile.
```

### 7. Back to throwing at the boundary

Framework handlers often expect exceptions. Convert at the very edge:

```ts
app.get('/users/:id', async (req, res) => {
  const user = await getUser(req.params.id);
  if (!user.ok) return res.status(toStatus(user.error)).json({ error: user.error.message });
  res.json(user.value);
});

// or, when a failure really is a bug:
const user = (await getUser(id)).unwrap(); // throws UnwrapError with the error as `cause`
```

### 8. Coming from neverthrow

The names mostly match: `ok`, `err`, `okAsync`, `errAsync`, `ResultAsync`,
`fromPromise`, `fromSafePromise`, `fromThrowable`, `safeTry`, `map`,
`mapErr`, `andThen`, `orElse`, `match`, `unwrapOr`. Differences:
`Result.combine` is `all()` (arrays/tuples) and `combine()` (objects);
`combineWithAllErrors` is `allWithErrors()`; `andTee` is `tap()`; there is
an `Option` type, `r.ok` narrowing, and the fetch/JSON helpers.

## API reference

Everything is exported from the package root.

### Result

| Export | Description |
| --- | --- |
| `ok(value)` / `ok()` | Creates `Ok<T, never>`, assignable to any `Result<T, E>` |
| `err(error)` / `err()` | Creates `Err<never, E>`, assignable to any `Result<T, E>` |
| `Result<T, E>` | `Ok<T, E> \| Err<T, E>` |
| `Ok`, `Err` | The classes, for `instanceof` |
| `isResult(value)` | `true` for an `Ok` or `Err` |
| `safeTry(function* () { ... })` | `yield*` a result to unwrap it; the first `Err` is returned |
| `InferOk<R>`, `InferErr<R>` | The value and error types of a result type |
| `UnwrapError` | Thrown by `unwrap()`, `expect()` and friends; the other side is in `cause` |

Methods on every result:

| Method | `Ok(v)` | `Err(e)` |
| --- | --- | --- |
| `.ok` | `true` | `false` |
| `.value` / `.error` | `v` | `e` |
| `isOk()`, `isErr()` | type guards | type guards |
| `isOkAnd(p)`, `isErrAnd(p)` | `p(v)` / `false` | `false` / `p(e)` |
| `map(f)` | `Ok(f(v))` | unchanged |
| `mapErr(f)` | unchanged | `Err(f(e))` |
| `andThen(f)` | `f(v)` | unchanged |
| `orElse(f)` | unchanged | `f(e)` |
| `match(onOk, onErr)` | `onOk(v)` | `onErr(e)` |
| `tap(f)`, `tapErr(f)` | runs `f(v)` / nothing | nothing / runs `f(e)` |
| `unwrap()` | `v` | throws |
| `unwrapErr()` | throws | `e` |
| `unwrapOr(d)` | `v` | `d` |
| `unwrapOrElse(f)` | `v` | `f(e)` |
| `expect(msg)`, `expectErr(msg)` | like `unwrap` with your message | |

### ResultAsync

| Export | Description |
| --- | --- |
| `ResultAsync<T, E>` | A `PromiseLike<Result<T, E>>` with `map`, `mapErr`, `andThen`, `orElse`, `match`, `tap`, `tapErr`, `unwrap`, `unwrapOr`, `unwrapOrElse`. Callbacks may be async; `andThen` and `orElse` accept a `Result`, a `ResultAsync` or a `Promise<Result>` |
| `okAsync(value)`, `errAsync(error)` | Already-resolved `ResultAsync` |
| `fromPromise(promise, mapError?)` | Rejections become `Err(mapError(reason))`; without `mapError` the error is `unknown` |
| `fromSafePromise(promise)` | For promises that do not reject |
| `ResultAsync.fromPromise`, `ResultAsync.fromSafePromise`, `ResultAsync.fromResult` | Static versions; `fromResult` lifts a `Result` or `Promise<Result>` |
| `safeTryAsync(async function* () { ... })` | `safeTry` for async code; `yield*` works on `Result` and `ResultAsync` |
| `ResultLike<T, E>`, `InferAsyncOk<R>`, `InferAsyncErr<R>` | Helper types |

`ResultAsync` only rejects if one of your callbacks throws (a bug); every
expected failure is an `Err`.

### Throwing code

| Export | Description |
| --- | --- |
| `tryCatch(fn, onError?)` | Runs `fn`, catching what it throws |
| `tryCatchAsync(fn, onError?)` | Same for async functions; catches sync throws and rejections |
| `fromThrowable(fn, onError?)` | Wraps a throwing function, keeping its parameters |
| `fromAsyncThrowable(fn, onError?)` | Same for async functions |

### Combinators

| Export | Description |
| --- | --- |
| `all([r1, r2, ...])` | `Ok([v1, v2, ...])` typed as a tuple, or the first `Err` |
| `allWithErrors([...])` | Like `all` but `Err` holds every error |
| `any([...])` | The first `Ok`, or `Err([e1, e2, ...])` |
| `combine({ a: r1, b: r2 })` | `Ok({ a: v1, b: v2 })`, or the first `Err` |
| `combineWithErrors({ a: r1, b: r2 })` | Like `combine` but `Err({ b: e2 })` holds the error of every failed key |
| `partition(results)` | `[values, errors]` |
| `allAsync([...])`, `anyAsync([...])` | Concurrent versions for `ResultAsync`, `Promise<Result>` and `Result` |
| `OkValues<R>`, `ErrValues<R>`, `ErrRecord<R>` | The tuple types used by `all` and `any`, and the per-key error object of `combineWithErrors` |

### Option

| Export | Description |
| --- | --- |
| `some(value)`, `none()` | Constructors; `none()` is one frozen instance |
| `Option<T>`, `Some`, `None` | The type and classes |
| `fromNullable(value)` | `None` for `null`/`undefined`, otherwise `Some` (keeps `0`, `''`, `false`) |
| `fromResult(result)` | `Some(value)` or `None` |
| `isOption(value)` | `true` for a `Some` or `None` |

Methods: `.some`, `isSome()`, `isNone()`, `map`, `andThen`, `filter` (type
guards narrow), `or`, `orElse`, `match`, `tap`, `unwrap`, `unwrapOr`,
`unwrapOrElse`, `expect`, `okOr(error)`, `okOrElse(fn)`, `zip(other)`,
`toNullable()`, `toUndefined()`.

### Typed errors

| Export | Description |
| --- | --- |
| `TaggedError(kind)` | Base class factory for errors with a literal `kind` |
| `matchKind(error, handlers)` | Exhaustive dispatch on `kind`; returns the union of handler results |
| `TaggedErrorClass`, `TaggedErrorInstance`, `KindHandlers`, `HandlerReturn` | Helper types |

### JSON helpers

| Export | Description |
| --- | --- |
| `safeJsonParse(text)` | `Result<unknown, ParseError>` |
| `safeJsonParse(text, validator)` | `Result<T, ParseError \| ValidationError>` |
| `safeJsonStringify(value, space?)` | `Result<string, StringifyError>` (cycles, BigInt, `undefined`) |
| `validate(value, validator)` | Runs a validator and returns `Result<T, ValidationError>` |
| `Validator<T>` | A type guard `(v) => v is T`, or a function returning `Result<T, unknown>` |
| `ParseError` (`kind: 'parse'`) | Has `input` and `cause` |
| `ValidationError` (`kind: 'validation'`) | Has `value` and an optional `cause` |
| `StringifyError` (`kind: 'stringify'`) | Has `cause` |

A schema library plugs in as a validator with one line, for example
`(v) => { const r = schema.safeParse(v); return r.success ? ok(r.data) : err(r.error); }`.

### Fetch helpers

| Export | Description |
| --- | --- |
| `safeFetch(input, init?, options?)` | `ResultAsync<Response, FetchError>`; non-2xx is an `HttpError` |
| `safeFetchJson(input, init?, options?)` | Reads and parses JSON; with `options.validate` the value is typed |
| `SafeFetchOptions` | `timeoutMs`, `allowHttpErrors`, `fetch` (inject your own, e.g. in tests) |
| `SafeFetchJsonOptions<T>` | Adds `validate` |
| `FetchLike` | The `fetch` signature |
| `FetchError` | `NetworkError \| AbortError \| TimeoutError \| HttpError` |
| `FetchJsonError` | `FetchError \| ParseError \| ValidationError` |
| `NetworkError` (`'network'`) | No response; the original error is in `cause` |
| `AbortError` (`'abort'`) | Your `signal` aborted |
| `TimeoutError` (`'timeout'`) | Has `timeoutMs` |
| `HttpError` (`'http'`) | Has `status`, `statusText`, `response` and `body` (text, up to 64 KiB) |

`safeFetchJson` sets `Accept: application/json` unless you pass one.

## Examples

Runnable files in [`examples/`](examples/) (run `npm run build` first):

- [`basic.mjs`](examples/basic.mjs): parsing input with `Result`, `Option` and `all`.
- [`async-pipeline.mjs`](examples/async-pipeline.mjs): `ResultAsync`, `safeTryAsync` and `matchKind`.
- [`fetch.mjs`](examples/fetch.mjs): `safeFetchJson` with a validator and a fake `fetch`.
- [`commonjs.cjs`](examples/commonjs.cjs): the `require()` build.

Validating a form with every error at once:

```ts
const form = allWithErrors([parseName(input.name), parseEmail(input.email), parseAge(input.age)]);
if (!form.ok) showErrors(form.error); // every problem, not only the first
```

Or keyed by field, so each message lands next to its input:

```ts
const form = combineWithErrors({ name: parseName(input.name), email: parseEmail(input.email) });
if (!form.ok) setFieldErrors(form.error); // { email: 'invalid email' }
```

Trying mirrors until one answers:

```ts
const data = await anyAsync(mirrors.map((url) => safeFetchJson(url, undefined, { timeoutMs: 2000 })));
// Ok(first success) or Err([one error per mirror])
```

## FAQ

**Why classes with methods instead of plain objects and free functions?**
Method chaining reads top to bottom and TypeScript infers it well. The
classes are small, there is no global state, and each feature (Option,
async, fetch helpers) lives in its own module, so a bundler drops what you
do not import (`sideEffects: false`).

**Is `r.ok` the same as `r.isOk()`?** Yes. `r.ok` is a literal `true` or
`false`, so `if (r.ok)` narrows like a discriminated union and works well
with destructuring. `isOk()` is there for people used to other libraries.

**Why is the error type `unknown` when I do not pass a mapper?** Anything
can be thrown in JavaScript, so that is the honest type. Pass a mapper to
`tryCatch`, `fromPromise` and friends to get a real type.

**Does `ResultAsync` ever reject?** Only if one of your callbacks throws,
which is a bug. Expected failures are `Err` values.

**Should every function return a `Result`?** No. Use it where callers
should decide what to do about a failure: I/O, parsing, validation,
business rules. Plain values and exceptions for bugs are fine elsewhere.

**Does `safeFetch` read the body?** Only for `HttpError`, so you can log
what the server said. For successful responses you get the untouched
`Response`.

**Can I use it in the browser?** Yes. Nothing imports Node built-ins; the
fetch helpers use the global `fetch` unless you inject one.

## Roadmap

Ideas, many of them good first issues (see
[CONTRIBUTING.md](CONTRIBUTING.md#good-first-issues)):

- `Option` combinators: `all()` and `any()` for options, `flatten()`.
- `Result.flatten()` and `Result.and()` / `Result.or()`.
- `retry(fn, { attempts, delay })` for `ResultAsync` steps.
- `safeFetchText()` and `safeFetchBlob()`.
- `toPromise()`: turn a `ResultAsync` back into a rejecting promise.
- An ESLint rule (in a separate package) that flags unhandled results.
- A Standard Schema adapter so any compliant validator plugs into
  `safeJsonParse` directly.

## Contributing

Bug reports, type inference puzzles, docs and new helpers are all welcome.
See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the check commands and a
list of beginner-friendly issues. Please follow the
[code of conduct](CODE_OF_CONDUCT.md), and report security problems
privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Saizul Amin
