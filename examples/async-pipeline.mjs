// Run after `npm run build`: node examples/async-pipeline.mjs
import { errAsync, matchKind, ok, okAsync, safeTryAsync, TaggedError } from '../dist/esm/index.js';

class NotFound extends TaggedError('NotFound') {}
class OutOfStock extends TaggedError('OutOfStock') {}

const users = new Map([['1', { id: '1', name: 'Ada' }]]);
const stock = new Map([['book', 2]]);

const findUser = (id) => (users.has(id) ? okAsync(users.get(id)) : errAsync(new NotFound(`No user ${id}`)));
const reserve = (item) =>
  (stock.get(item) ?? 0) > 0 ? okAsync({ item, left: stock.get(item) - 1 }) : errAsync(new OutOfStock(item));

const order = (userId, item) =>
  safeTryAsync(async function* () {
    const user = yield* findUser(userId);
    const reservation = yield* reserve(item);
    return ok(`${user.name} reserved a ${reservation.item} (${reservation.left} left)`);
  });

for (const [userId, item] of [
  ['1', 'book'],
  ['2', 'book'],
  ['1', 'lamp'],
]) {
  const message = await order(userId, item).match(
    (text) => text,
    (e) =>
      matchKind(e, {
        NotFound: (x) => `404: ${x.message}`,
        OutOfStock: (x) => `409: ${x.message} is out of stock`,
      }),
  );
  console.log(message);
}
