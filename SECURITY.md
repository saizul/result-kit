# Security policy

## Supported versions

Only the latest release receives fixes.

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's
private vulnerability reporting ("Report a vulnerability" under the
repository's **Security** tab). You will get an answer within a week.

## Scope

result-kit is a small library without network access of its own, but its
helpers sit on trust boundaries. Reports in these areas are especially
welcome:

- **`safeFetch` / `safeFetchJson`.** A way to make them throw instead of
  returning an `Err`, to ignore a timeout or abort signal, to leak request
  data into error messages, or to read an unbounded amount of an error
  body (it is capped at 64 KiB).
- **`safeJsonParse`.** Any input that makes it throw, hang, or return a
  value that bypasses the validator you passed.
- **Error messages.** `UnwrapError` messages include a short description of
  the value. If that can leak more than about 200 characters or run
  user-controlled code, please report it.

## What result-kit is not

It does not sanitize data. A `ValidationError` only means your validator
said no; `safeJsonParse` without a validator returns `unknown` on purpose.
Validate untrusted input with a validator you trust.
