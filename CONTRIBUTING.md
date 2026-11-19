# Contributing

Thanks for helping improve result-kit. Bug reports, type inference puzzles,
documentation and new helpers are all welcome. If you are new to open
source, start with one of the [beginner issues](#good-first-issues) below;
each is small and comes with pointers to the files involved.

## Reporting a bug

Open an issue with:

- a minimal snippet (a TypeScript playground link is perfect for type
  problems)
- what you got and what you expected, including the inferred type if the
  problem is a type
- your result-kit, TypeScript and Node (or browser) versions

## Development setup

You need Node 20 or newer.

```console
$ git clone https://github.com/saizul/result-kit.git
$ cd result-kit
$ npm ci
$ npm test              # builds ESM + CJS, compiles the type tests, runs node:test
$ npm run test:types    # only the type tests (tsc --noEmit on test-d/)
$ npm run lint          # biome lint + tsc --noEmit + type tests
$ npm run format        # biome format --write
$ npm run format:check  # what CI runs
```

Try the examples against the build:

```console
$ node examples/basic.mjs
```

## Guidelines

- **Zero runtime dependencies.** Development tools go in `devDependencies`.
- **No Node built-ins in `src/`.** The library must keep working in
  browsers, Deno, Bun and edge runtimes. A test checks the build output.
- **Types are part of the API.** Every public function gets type tests in
  `test-d/types.test-d.ts`: `Expect<Equal<...>>` for what is inferred and
  `// @ts-expect-error` for what must not compile. If you change an
  inferred type, that is a breaking change.
- **Keep Ok and Err in sync.** Both classes must have the same method
  signatures, otherwise calling a method on a `Result` union stops
  compiling. The same goes for `Some` and `None`.
- **Expected failures are values.** Helpers return `Err`; they only throw
  for bugs (for example a callback that throws).
- **Tests use an injected `fetch`.** Never touch the network in tests.
- Every change comes with a test and a line in the `Unreleased` section of
  `CHANGELOG.md`. New exports also need a row in the README API reference
  (a test checks this).

## Project layout

```text
src/
  result.ts     Ok, Err, ok(), err(), safeTry(), UnwrapError
  async.ts      ResultAsync, okAsync(), errAsync(), fromPromise(), safeTryAsync()
  option.ts     Some, None, some(), none(), fromNullable()
  try.ts        tryCatch(), tryCatchAsync(), fromThrowable(), fromAsyncThrowable()
  combine.ts    all(), allWithErrors(), any(), combine(), partition(), allAsync(), anyAsync()
  errors.ts     TaggedError(), matchKind()
  json.ts       safeJsonParse(), safeJsonStringify(), validate()
  fetch.ts      safeFetch(), safeFetchJson() and the fetch error classes
test/           node:test suites, one per module
test-d/         type tests, compiled but never run
examples/       runnable ESM and CommonJS examples
```

## Good first issues

These are deliberately small. Each one lists where to start.

1. **`Result.flatten()`**: turn `Result<Result<T, E2>, E1>` into
   `Result<T, E1 | E2>`. Add it to both classes in `src/result.ts`, with
   runtime tests in `test/result.test.ts` and type tests in
   `test-d/types.test-d.ts`.
2. **`Option` combinators**: `allOptions([some(1), some('a')])` giving
   `Some([1, 'a'])`. Follow `all()` in `src/combine.ts`.
3. **`safeFetchText()`**: like `safeFetchJson()` but returns the body as a
   string. Add it to `src/fetch.ts` and tests to `test/fetch.test.ts`.
4. **`ResultAsync.toPromise()`**: resolves with the value or rejects with
   the error, for code that expects exceptions. `src/async.ts`.
5. **`retry()` helper**: `retry(() => safeFetch(url), { attempts: 3,
   delayMs: 200 })` returning the first `Ok` or the last `Err`. New file
   `src/retry.ts`, exported from `src/index.ts`; use fake timers or a tiny
   delay in tests.
6. **`Option.xor()` and `Option.and()`**: small methods from Rust's
   `Option`. Add them to both `Some` and `None` in `src/option.ts`.
7. **A React example**: `examples/react-hook.tsx` showing a
   `useResult(promiseFactory)` hook. Documentation only; it does not need
   to run in CI.
8. **Docs: a "Result vs exceptions" decision table** for the FAQ, with
   three or four real-world cases.

## Pull requests

Keep them focused: one fix or feature per pull request. Describe what
changed and how you tested it; the template has a short checklist. CI runs
lint, the type tests, format check and the runtime tests on Node 20 and 22
and 24 on Linux, and Node 22 on Windows and macOS.
