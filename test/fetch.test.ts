import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AbortError,
  type FetchLike,
  HttpError,
  matchKind,
  NetworkError,
  ParseError,
  safeFetch,
  safeFetchJson,
  TimeoutError,
  ValidationError,
} from '../src/index.js';

// Every test injects its own fetch, so nothing touches the network.
const respond =
  (body: string, init: ResponseInit = {}): FetchLike =>
  async () =>
    new Response(body, init);

/** A fetch that never answers until the signal aborts, like a hung server. */
const hang: FetchLike = (_input, init) =>
  new Promise((_resolve, reject) => {
    const signal = init?.signal;
    signal?.addEventListener('abort', () => {
      const e = new Error('This operation was aborted');
      e.name = 'AbortError';
      reject(e);
    });
  });

describe('safeFetch', () => {
  it('resolves to Ok(Response) for 2xx', async () => {
    const r = await safeFetch('https://api.test/users', undefined, { fetch: respond('hi', { status: 201 }) });
    assert.ok(r.ok);
    assert.equal(r.value.status, 201);
    assert.equal(await r.value.text(), 'hi');
  });

  it('turns non-2xx into HttpError with the body', async () => {
    const r = await safeFetch('https://api.test/x', undefined, {
      fetch: respond('{"error":"nope"}', { status: 404, statusText: 'Not Found' }),
    });
    assert.ok(!r.ok);
    assert.ok(r.error instanceof HttpError);
    assert.equal(r.error.kind, 'http');
    assert.equal(r.error.status, 404);
    assert.equal(r.error.statusText, 'Not Found');
    assert.equal(r.error.body, '{"error":"nope"}');
    assert.equal(r.error.message, 'HTTP 404 Not Found');
    assert.equal(r.error.response.status, 404);
  });

  it('truncates very large error bodies', async () => {
    const r = await safeFetch('https://api.test/x', undefined, {
      fetch: respond('x'.repeat(100_000), { status: 500 }),
    });
    assert.ok(!r.ok && r.error instanceof HttpError && r.error.body.length === 64 * 1024);
    assert.ok(!r.ok && r.error.message === 'HTTP 500');
  });

  it('allowHttpErrors keeps non-2xx responses as Ok', async () => {
    const r = await safeFetch('https://api.test/x', undefined, {
      fetch: respond('', { status: 503 }),
      allowHttpErrors: true,
    });
    assert.ok(r.ok && r.value.status === 503);
  });

  it('turns a thrown TypeError into NetworkError', async () => {
    const failing: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    const r = await safeFetch('https://api.test', undefined, { fetch: failing });
    assert.ok(!r.ok && r.error instanceof NetworkError);
    assert.ok(!r.ok && r.error.cause instanceof TypeError);
    assert.ok(!r.ok && r.error.message === 'Network error: fetch failed');
  });

  it('reports a timeout as TimeoutError', async () => {
    const r = await safeFetch('https://api.test', undefined, { fetch: hang, timeoutMs: 10 });
    assert.ok(!r.ok && r.error instanceof TimeoutError);
    assert.ok(!r.ok && r.error.kind === 'timeout' && r.error.timeoutMs === 10);
  });

  it('reports your own abort as AbortError, with or without a timeout', async () => {
    for (const timeoutMs of [undefined, 5_000]) {
      const controller = new AbortController();
      const pending = safeFetch(
        'https://api.test',
        { signal: controller.signal },
        { fetch: hang, timeoutMs },
      );
      setTimeout(() => controller.abort(), 5);
      const r = await pending;
      assert.ok(!r.ok && r.error instanceof AbortError, String(timeoutMs));
    }
  });

  it('does not call fetch when the signal is already aborted', async () => {
    let called = false;
    const spy: FetchLike = async () => {
      called = true;
      return new Response('');
    };
    const r = await safeFetch('https://api.test', { signal: AbortSignal.abort() }, { fetch: spy });
    assert.ok(!r.ok && r.error.kind === 'abort');
    assert.equal(called, false);
  });

  it('passes the request through to fetch', async () => {
    let seen: [unknown, RequestInit | undefined] | undefined;
    const spy: FetchLike = async (input, init) => {
      seen = [input, init];
      return new Response('');
    };
    await safeFetch('https://api.test/a', { method: 'POST', body: 'x' }, { fetch: spy });
    assert.equal(seen?.[0], 'https://api.test/a');
    assert.equal(seen?.[1]?.method, 'POST');
  });

  it('fails cleanly when no fetch is available', async () => {
    const original = globalThis.fetch;
    // @ts-expect-error simulating a runtime without fetch
    globalThis.fetch = undefined;
    try {
      const r = await safeFetch('https://api.test');
      assert.ok(!r.ok && r.error instanceof NetworkError && /not available/.test(r.error.message));
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('safeFetchJson', () => {
  const isUser = (v: unknown): v is { name: string } =>
    typeof v === 'object' && v !== null && typeof (v as { name?: unknown }).name === 'string';

  it('parses the body', async () => {
    const r = await safeFetchJson('https://api.test', undefined, { fetch: respond('{"name":"Ada"}') });
    assert.deepEqual(r.ok && r.value, { name: 'Ada' });
  });

  it('sets an accept header unless you set one', async () => {
    const headers: string[] = [];
    const spy: FetchLike = async (_input, init) => {
      headers.push(new Headers(init?.headers).get('accept') ?? '');
      return new Response('1');
    };
    await safeFetchJson('https://api.test', undefined, { fetch: spy });
    await safeFetchJson(
      'https://api.test',
      { headers: { Accept: 'application/vnd.api+json' } },
      { fetch: spy },
    );
    assert.deepEqual(headers, ['application/json', 'application/vnd.api+json']);
  });

  it('validates the body', async () => {
    const good = await safeFetchJson('https://api.test', undefined, {
      fetch: respond('{"name":"Ada"}'),
      validate: isUser,
    });
    assert.ok(good.ok && good.value.name === 'Ada');
    const bad = await safeFetchJson('https://api.test', undefined, {
      fetch: respond('{"id":1}'),
      validate: isUser,
    });
    assert.ok(!bad.ok && bad.error instanceof ValidationError);
  });

  it('reports invalid JSON as ParseError and HTTP errors as HttpError', async () => {
    const parse = await safeFetchJson('https://api.test', undefined, { fetch: respond('<html>') });
    assert.ok(!parse.ok && parse.error instanceof ParseError && parse.error.input === '<html>');
    const http = await safeFetchJson('https://api.test', undefined, {
      fetch: respond('{}', { status: 401 }),
    });
    assert.ok(!http.ok && http.error instanceof HttpError && http.error.status === 401);
  });

  it('errors can be handled exhaustively with matchKind', async () => {
    const describeError = async (fetch: FetchLike) => {
      const r = await safeFetchJson('https://api.test', undefined, {
        fetch,
        validate: isUser,
        timeoutMs: 10,
      });
      if (r.ok) return `hello ${r.value.name}`;
      return matchKind(r.error, {
        network: () => 'offline',
        abort: () => 'cancelled',
        timeout: (e) => `timed out after ${e.timeoutMs} ms`,
        http: (e) => `server said ${e.status}`,
        parse: () => 'not json',
        validation: () => 'unexpected shape',
      });
    };
    assert.equal(await describeError(respond('{"name":"Ada"}')), 'hello Ada');
    assert.equal(await describeError(respond('', { status: 500 })), 'server said 500');
    assert.equal(await describeError(respond('nope')), 'not json');
    assert.equal(await describeError(respond('[]')), 'unexpected shape');
    assert.equal(await describeError(hang), 'timed out after 10 ms');
    assert.equal(
      await describeError(async () => {
        throw new TypeError('down');
      }),
      'offline',
    );
  });

  it('a body that fails to read is a NetworkError', async () => {
    const broken: FetchLike = async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.error(new Error('connection reset'));
          },
        }),
      );
    const r = await safeFetchJson('https://api.test', undefined, { fetch: broken });
    assert.ok(!r.ok && r.error instanceof NetworkError);
  });
});
