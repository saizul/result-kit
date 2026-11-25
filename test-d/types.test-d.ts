// Type tests. These are never run: `npm run test:types` compiles them with
// `tsc --noEmit`, and every `Expect<Equal<...>>` or `@ts-expect-error` that
// does not hold fails the build.
import {
  all,
  allAsync,
  any,
  combine,
  combineWithErrors,
  type Err,
  err,
  errAsync,
  type FetchError,
  type FetchJsonError,
  fromNullable,
  fromPromise,
  fromThrowable,
  type HttpError,
  type InferErr,
  type InferOk,
  matchKind,
  none,
  type Ok,
  type Option,
  ok,
  okAsync,
  type ParseError,
  partition,
  type Result,
  type ResultAsync,
  safeFetch,
  safeFetchJson,
  safeJsonParse,
  safeTry,
  safeTryAsync,
  some,
  TaggedError,
  tryCatch,
  tryCatchAsync,
  type ValidationError,
} from '../src/index.js';

type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

declare const numOrStr: Result<number, string>;

// --- constructors ---------------------------------------------------------

const o = ok(1);
type _o = Expect<Equal<typeof o, Ok<number, never>>>;
const e = err('boom' as const);
type _e = Expect<Equal<typeof e, Err<never, 'boom'>>>;
const v = ok();
type _v = Expect<Equal<typeof v, Ok<void, never>>>;

// --- narrowing ------------------------------------------------------------

if (numOrStr.ok) {
  type _n1 = Expect<Equal<typeof numOrStr.value, number>>;
} else {
  type _n2 = Expect<Equal<typeof numOrStr.error, string>>;
}
if (numOrStr.isErr()) {
  type _n3 = Expect<Equal<typeof numOrStr.error, string>>;
}
// @ts-expect-error value is only there after narrowing
numOrStr.value;

// --- map / mapErr / andThen / orElse -------------------------------------

const mapped = numOrStr.map((n) => n.toFixed(2));
type _m = Expect<Equal<typeof mapped, Result<string, string>>>;

const mappedErr = numOrStr.mapErr((s) => new Error(s));
type _me = Expect<Equal<typeof mappedErr, Result<number, Error>>>;

class NotFound extends TaggedError('NotFound') {}
class Forbidden extends TaggedError('Forbidden') {}
declare function find(id: number): Result<{ id: number }, NotFound>;
declare function check(user: { id: number }): Result<{ id: number; admin: true }, Forbidden>;

const chained = numOrStr.andThen(find).andThen(check);
type _c = Expect<Equal<typeof chained, Result<{ id: number; admin: true }, string | NotFound | Forbidden>>>;

const branching = numOrStr.andThen((n) => (n > 0 ? ok(n) : err('negative' as const)));
type _b = Expect<Equal<typeof branching, Result<number, string>>>;

const recovered = numOrStr.orElse(() => ok('fallback'));
type _r = Expect<Equal<typeof recovered, Result<number | string, never>>>;

const matched = numOrStr.match(
  (n) => n * 2,
  (s) => s.length > 0,
);
type _mt = Expect<Equal<typeof matched, number | boolean>>;

const fallback = numOrStr.unwrapOr(null);
type _f = Expect<Equal<typeof fallback, number | null>>;

// @ts-expect-error map must receive the value type
numOrStr.map((s: string) => s);

// --- inference helpers ----------------------------------------------------

type _io = Expect<Equal<InferOk<typeof chained>, { id: number; admin: true }>>;
type _ie = Expect<Equal<InferErr<typeof chained>, string | NotFound | Forbidden>>;

// --- tagged errors and matchKind ------------------------------------------

declare const tagged: NotFound | Forbidden;
type _k = Expect<Equal<typeof tagged.kind, 'NotFound' | 'Forbidden'>>;
const status = matchKind(tagged, { NotFound: () => 404, Forbidden: () => 403 });
type _st = Expect<Equal<typeof status, number>>;
// @ts-expect-error every kind needs a handler
matchKind(tagged, { NotFound: () => 404 });

// --- safeTry --------------------------------------------------------------

const tried = safeTry(function* () {
  const a = yield* numOrStr;
  const b = yield* find(a);
  type _a = Expect<Equal<typeof a, number>>;
  return ok(b.id + a);
});
type _t = Expect<Equal<typeof tried, Result<number, string | NotFound>>>;

// --- tryCatch / fromThrowable ---------------------------------------------

const tc1 = tryCatch(() => JSON.parse('1') as number);
type _tc1 = Expect<Equal<typeof tc1, Result<number, unknown>>>;
const tc2 = tryCatch(
  () => 1,
  () => 'bad' as const,
);
type _tc2 = Expect<Equal<typeof tc2, Result<number, 'bad'>>>;
const safeUrl = fromThrowable(
  (s: string) => new URL(s),
  () => 'invalid' as const,
);
type _fu = Expect<Equal<ReturnType<typeof safeUrl>, Result<URL, 'invalid'>>>;
// @ts-expect-error parameters are kept
safeUrl(1);

// --- combinators ----------------------------------------------------------

const tuple = all([ok(1), ok('a'), numOrStr]);
type _all = Expect<Equal<typeof tuple, Result<[number, string, number], string>>>;
const firstOk = any([numOrStr, ok(true)]);
type _any = Expect<Equal<typeof firstOk, Result<number | boolean, [string, never]>>>;
const record = combine({ a: numOrStr, b: find(1) });
type _rec = Expect<Equal<typeof record, Result<{ a: number; b: { id: number } }, string | NotFound>>>;
const fields = combineWithErrors({ a: numOrStr, b: find(1) });
type _recErr = Expect<
  Equal<typeof fields, Result<{ a: number; b: { id: number } }, { a?: string; b?: NotFound }>>
>;
const parts = partition([numOrStr]);
type _p = Expect<Equal<typeof parts, [number[], string[]]>>;

// --- ResultAsync ------------------------------------------------------------

declare function fetchUser(id: number): ResultAsync<{ name: string }, 'offline'>;
const ra = okAsync(1)
  .map(async (n) => n + 1)
  .andThen(fetchUser)
  .andThen((u) => ok(u.name))
  .andThen(async (name) => (name ? ok(name.length) : err('empty' as const)));
type _ra = Expect<Equal<typeof ra, ResultAsync<number, 'offline' | 'empty'>>>;

async function awaited() {
  const r = await ra;
  type _aw = Expect<Equal<typeof r, Result<number, 'offline' | 'empty'>>>;
  const n = await ra.unwrapOr(0);
  type _n = Expect<Equal<typeof n, number>>;
  const m = await ra.match(
    (x) => String(x),
    (e) => e,
  );
  type _mm = Expect<Equal<typeof m, string>>;
}
void awaited;

const fp = fromPromise(Promise.resolve(1), () => 'rejected' as const);
type _fp = Expect<Equal<typeof fp, ResultAsync<number, 'rejected'>>>;
const fpUnknown = fromPromise(Promise.resolve(1));
type _fpu = Expect<Equal<typeof fpUnknown, ResultAsync<number, unknown>>>;
const tca = tryCatchAsync(async () => 'x');
type _tca = Expect<Equal<typeof tca, ResultAsync<string, unknown>>>;
const ea = errAsync(new Forbidden());
type _ea = Expect<Equal<typeof ea, ResultAsync<never, Forbidden>>>;

const aa = allAsync([okAsync(1), Promise.resolve(numOrStr), ok('x')]);
type _aa = Expect<Equal<typeof aa, ResultAsync<[number, number, string], string | never>>>;

const sta = safeTryAsync(async function* () {
  const user = yield* fetchUser(1);
  const n = yield* numOrStr;
  return ok(`${user.name}${n}`);
});
type _sta = Expect<Equal<typeof sta, ResultAsync<string, 'offline' | string>>>;

// --- Option ---------------------------------------------------------------

const opt = fromNullable(null as string | null | undefined);
type _opt = Expect<Equal<typeof opt, Option<string>>>;
const len = opt.map((s) => s.length).unwrapOr(0);
type _len = Expect<Equal<typeof len, number>>;
const asResult = opt.okOr('missing' as const);
type _ar = Expect<Equal<typeof asResult, Result<string, 'missing'>>>;
const zipped = some(1).zip(some('a'));
type _z = Expect<Equal<typeof zipped, Option<[number, string]>>>;
const filtered = some<string | number>(1).filter((x): x is number => typeof x === 'number');
type _fi = Expect<Equal<typeof filtered, Option<number>>>;
declare const n0: Option<number>;
const _none: Option<number> = none();
if (n0.isSome()) {
  type _ns = Expect<Equal<typeof n0.value, number>>;
}

// --- JSON and fetch helpers -------------------------------------------------

interface User {
  name: string;
}
const isUser = (v: unknown): v is User => typeof v === 'object' && v !== null && 'name' in v;
const j1 = safeJsonParse('{}');
type _j1 = Expect<Equal<typeof j1, Result<unknown, ParseError>>>;
const j2 = safeJsonParse('{}', isUser);
type _j2 = Expect<Equal<typeof j2, Result<User, ParseError | ValidationError>>>;

const sf = safeFetch('https://example.com');
type _sf = Expect<Equal<typeof sf, ResultAsync<Response, FetchError>>>;
const sfj = safeFetchJson('https://example.com', undefined, { validate: isUser });
type _sfj = Expect<Equal<typeof sfj, ResultAsync<User, FetchJsonError>>>;

async function handle() {
  const r = await sfj;
  if (r.ok) return r.value.name;
  return matchKind(r.error, {
    network: () => 'offline',
    abort: () => 'cancelled',
    timeout: (e) => `slow: ${e.timeoutMs}`,
    http: (e: HttpError) => `HTTP ${e.status}`,
    parse: (e) => `bad json: ${e.input.length}`,
    validation: () => 'unexpected shape',
  });
}
void handle;

// --- assignability ----------------------------------------------------------

function parseNumber(s: string): Result<number, 'nan'> {
  const n = Number(s);
  return Number.isNaN(n) ? err('nan') : ok(n);
}
void parseNumber;

function wrongError(): Result<number, 'nan'> {
  // @ts-expect-error the error type must match the declared one
  return err('other');
}
void wrongError;

function wrongValue(): Result<number, 'nan'> {
  // @ts-expect-error the value type must match the declared one
  return ok('1');
}
void wrongValue;

async function asyncReturn(): Promise<Result<number, 'nan'>> {
  return okAsync(1);
}
void asyncReturn;
