// Run after `npm run build`: node examples/commonjs.cjs
const { ok, safeJsonParse, tryCatch } = require('../dist/cjs/index.js');

console.log(
  ok(20)
    .map((n) => n + 1)
    .unwrap(),
);
console.log(safeJsonParse('{"a":1}').unwrapOr(null));
console.log(
  String(
    tryCatch(
      () => new URL('not a url'),
      () => 'invalid url',
    ),
  ),
);
