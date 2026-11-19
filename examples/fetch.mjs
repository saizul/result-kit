// Run after `npm run build`: node examples/fetch.mjs
// Uses a fake fetch so the example works offline.
import { matchKind, safeFetchJson } from '../dist/esm/index.js';

const fakeFetch = async (url) => {
  if (url.endsWith('/1')) return new Response('{"id":1,"name":"Ada"}');
  if (url.endsWith('/2')) return new Response('<html>oops</html>');
  if (url.endsWith('/3'))
    return new Response('{"error":"not found"}', { status: 404, statusText: 'Not Found' });
  throw new TypeError('fetch failed');
};

const isUser = (v) => typeof v === 'object' && v !== null && typeof v.name === 'string';

for (const id of [1, 2, 3, 4]) {
  const result = await safeFetchJson(`https://api.example.com/users/${id}`, undefined, {
    fetch: fakeFetch,
    validate: isUser,
    timeoutMs: 1000,
  });
  const line = result.match(
    (user) => `user ${id}: ${user.name}`,
    (e) =>
      `user ${id}: ${matchKind(e, {
        network: () => 'network error',
        abort: () => 'aborted',
        timeout: () => 'timed out',
        http: (h) => `HTTP ${h.status}, body ${h.body}`,
        parse: () => 'not JSON',
        validation: () => 'unexpected shape',
      })}`,
  );
  console.log(line);
}
