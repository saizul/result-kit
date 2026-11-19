# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-19

### Added

- `Result<T, E>` with `Ok` and `Err`: `ok`, `err`, `isResult`, `r.ok`
  narrowing, `map`, `mapErr`, `andThen`, `orElse`, `match`, `tap`,
  `tapErr`, `unwrap`, `unwrapErr`, `unwrapOr`, `unwrapOrElse`, `expect`,
  `expectErr`, `isOkAnd`, `isErrAnd`, and `UnwrapError`.
- `safeTry` and `safeTryAsync` for `yield*`-based early returns.
- `ResultAsync` with `okAsync`, `errAsync`, `fromPromise`,
  `fromSafePromise` and `ResultAsync.fromResult`.
- `tryCatch`, `tryCatchAsync`, `fromThrowable` and `fromAsyncThrowable`.
- Combinators `all`, `allWithErrors`, `any`, `combine`, `partition`,
  `allAsync` and `anyAsync`, with tuple and object types preserved.
- `Option<T>` with `some`, `none`, `fromNullable`, `fromResult`,
  `isOption` and the usual methods, including `okOr` and `zip`.
- `TaggedError` and the exhaustive `matchKind`.
- `safeJsonParse`, `safeJsonStringify` and `validate` with `ParseError`,
  `ValidationError` and `StringifyError`.
- `safeFetch` and `safeFetchJson` with `NetworkError`, `AbortError`,
  `TimeoutError` and `HttpError`, a `timeoutMs` option and an injectable
  `fetch`.
- ESM and CommonJS builds with type declarations; no runtime dependencies.
- Type tests compiled with `tsc --noEmit`.

[Unreleased]: https://github.com/saizul/result-kit/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/saizul/result-kit/releases/tag/v0.1.0
