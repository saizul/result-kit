// Run after `npm run build`: node examples/basic.mjs
import { all, err, fromNullable, ok } from '../dist/esm/index.js';

/** @param {string} input */
function parsePort(input) {
  const n = Number(input);
  if (!Number.isInteger(n)) return err(`"${input}" is not a whole number`);
  if (n < 1 || n > 65535) return err(`${n} is not between 1 and 65535`);
  return ok(n);
}

for (const input of ['8080', 'http', '70000']) {
  console.log(
    input,
    '->',
    parsePort(input).match(
      (port) => `port ${port}`,
      (e) => `error: ${e}`,
    ),
  );
}

const env = { HOST: 'localhost', PORT: '3000' };
const config = all([
  fromNullable(env.HOST).okOr('HOST is not set'),
  fromNullable(env.PORT).okOr('PORT is not set').andThen(parsePort),
]).map(([host, port]) => `${host}:${port}`);

console.log('config ->', config.unwrapOr('invalid config'));
