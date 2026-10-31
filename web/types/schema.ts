// A schema declared in code (`@fennecdb/web/schema`), as a caller writes
// it, type-checked under --strict (`make types-check`): each line the types
// must take, each `@ts-expect-error` one they must refuse -- and the row
// types a table infers held equal to what `fennec types` generates for the
// same collections (schema-generated.d.ts, made from schema-tables.ts).

import { Fennec, connect, from, openFile, sync, type InsertRow, type Row, type TableRef } from '../fennec.js';
import { useLiveQuery } from '../../integrations/react/index.js';
import {
  fennecTable,
  text,
  integer,
  boolean,
  timestamp,
  json,
  vector,
  index,
  uniqueIndex,
  defineRelations,
  describe,
  toFennecQL,
  getColumns,
  rename,
  drop,
  dropTable,
  dropIndex,
  rebuild,
} from '../schema.js';
import { articles, reviews, tables, relations } from './schema-tables.ts';
import type { FennecSchema } from './schema-generated.d.ts';

type Simplify<T> = { [K in keyof T]: T[K] } & {};
/** True when `A` and `B` are the one type, not merely assignable either way. */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const equal = <T extends true>(_: T) => {};
const expect = <T>(value: T): T => value;

// --------------------------------------------- what fennec types generates

equal<Equal<typeof articles.$inferSelect, Simplify<Row<FennecSchema['articles']>>>>(true);
equal<Equal<typeof reviews.$inferSelect, Simplify<Row<FennecSchema['reviews']>>>>(true);
equal<Equal<typeof articles.$inferInsert, Simplify<InsertRow<FennecSchema['articles']>>>>(true);
equal<Equal<typeof reviews.$inferInsert, Simplify<InsertRow<FennecSchema['reviews']>>>>(true);
equal<Equal<(typeof reviews)['$fields'], FennecSchema['reviews']>>(true);
// A nullable column reads `T | null`, a `.notNull()` one `T`.
expect<string>(null as unknown as typeof articles.$inferSelect.title);
expect<number | null>(null as unknown as typeof articles.$inferSelect.year);
// @ts-expect-error -- a nullable column may read null
expect<number>(null as unknown as typeof articles.$inferSelect.year);
// An insert gives the `.notNull()` columns, and may leave the rest.
const written: typeof reviews.$inferInsert = { articleId: 1 };
void written;
// @ts-expect-error -- `articleId` is required
const missing: typeof reviews.$inferInsert = { stars: 5 };
void missing;

// ------------------------------------------------------------- declaring

const todos = fennecTable(
  'todos',
  {
    title: text().notNull().collate('tr'),
    owner: text().collate('tr').nocase().notNull(),
    done: boolean(),
    at: timestamp(),
    meta: json(),
    embed: vector({ dimensions: 3 }),
  },
  (t) => [
    index('todos_at').on(t.at).ttl('30d'),
    index('todos_done').using('hash', t.done),
    index('todos_embed').using('hnsw', t.embed.op('vector_cosine_ops')).with({ m: 16, ef_construction: 200 }),
    index('todos_title').using('bm25', t.title).with({ prefix: 6 }),
    uniqueIndex('todos_lang').on(t.meta.path('lang')),
    index('todos_open').on(t.done, t.at.desc()),
    uniqueIndex('todos_title_at').on(t.title, t.meta.path('k').desc(), t.at.asc()),
    index().using('btree', t.done, t.title),
  ],
);
expect<readonly { kind: 'sorted' | 'unique' }[]>(todos.$indexes);
expect<TableRef<'todos'>>(todos);
expect<string>(todos.title.name);
describe({ todos }, [
  rename(todos, 'name', 'title'),
  drop('todos', 'old'),
  dropTable('gone'),
  rebuild(todos, 'done'),
  dropIndex(todos, 'done', 'at'),
]);
expect<{ title: unknown }>(getColumns(todos));

// @ts-expect-error -- FennecQL has no defaults
text().default('x');
// @ts-expect-error -- `id` is every document's own
integer().primaryKey();
// @ts-expect-error -- collation orders text
integer().collate('tr');
// @ts-expect-error -- a collation fennecdb has not got
text().collate('fr');
// @ts-expect-error -- nocase compares text
integer().nocase();
// @ts-expect-error -- nocase is a text's, not a list's
text().array().nocase();
// @ts-expect-error -- a path reads into json
fennecTable('x', { a: text() }, (t) => [index().on(t.a.path('k'))]);
// @ts-expect-error -- an hnsw index is on a vector
fennecTable('x', { a: text() }, (t) => [index().using('hnsw', t.a)]);
// @ts-expect-error -- bm25 indexes text
fennecTable('x', { a: integer() }, (t) => [index().using('bm25', t.a)]);
// @ts-expect-error -- an hnsw index takes no prefix
fennecTable('x', { v: vector({ dimensions: 3 }) }, (t) => [index().using('hnsw', t.v.op('vector_l2_ops')).with({ prefix: 3 })]);
// @ts-expect-error -- pgvector has no such operator class
fennecTable('x', { v: vector({ dimensions: 3 }) }, (t) => [index().using('hnsw', t.v.op('vector_hamming_ops'))]);
// @ts-expect-error -- a duration is a number and a unit
fennecTable('x', { at: timestamp() }, (t) => [index().on(t.at).ttl('soon')]);
// @ts-expect-error -- an index over several fields is ordered: no hash
fennecTable('x', { a: text(), b: text() }, (t) => [index().using('hash', t.a, t.b)]);
// @ts-expect-error -- an index over several fields expires nothing
fennecTable('x', { a: timestamp(), b: text() }, (t) => [index().on(t.a, t.b).ttl('1h')]);

// --------------------------------------------------------------- opening

export async function opened(bytes: Uint8Array) {
  const db = await Fennec.open(bytes, { schema: tables, relations, migrations: [rename(articles, 'name', 'title')] });

  // By the table, and by its name: typed the same.
  const rows = await db.from(articles).select('title', 'year').where('year', '>=', 2024).rows();
  expect<{ title: string; year: number | null }[]>(rows);
  expect<{ title: string }[]>(await db.from('articles').select('title').rows());
  // @ts-expect-error -- a misspelt field in `select`
  db.from(articles).select('titel');
  // @ts-expect-error -- a misspelt field in `where`
  db.from(articles).where('yaer', 2024);
  // @ts-expect-error -- a misspelt field in `order`
  db.from(articles).order('publshed');
  // @ts-expect-error -- a wrong value's type
  db.from(articles).where('year', 'twenty');
  // @ts-expect-error -- a wrong value's type, in an object
  db.from(articles).where({ draft: 'no' });
  // @ts-expect-error -- `near` takes a vector field
  db.from(articles).near('title', [1, 2, 3]);
  // @ts-expect-error -- a collection the schema does not declare
  db.from('nothing');

  // An insert gives the required columns.
  await db.from(articles).insert({ title: 'a', draft: false, counts: [] });
  // @ts-expect-error -- `draft` is `.notNull()`, and not given
  await db.from(articles).insert({ title: 'a', counts: [] });
  // @ts-expect-error -- a wrong type
  await db.from(articles).insert({ title: 1, draft: false, counts: [] });
  await db.from(articles).where('id', 1).update({ year: 2025 });

  // A relation by its name: its rows typed by the table it reaches.
  const withReviews = await db.from(articles).select('title').lookup('reviews', { where: { stars: 5 } }).rows();
  expect<{ title: string; reviews: { id: number; articleId: number; stars: number | null; note: string | null }[] }[]>(withReviews);
  const back = await db.from(reviews).lookup('article').rows();
  expect<string>(back[0].articles[0].title);
  // @ts-expect-error -- no such relation
  db.from(articles).lookup('authors');
  // Given `on`, the call names the key rather than the relation.
  db.from(articles).lookup('reviews', { on: 'stars' });
  // A table by itself, with the key.
  const byTable = await db.from(articles).lookup(reviews, { on: 'articleId', order: 'stars' }).rows();
  expect<(number | null)[]>(byTable[0].reviews.map((r) => r.stars));
  // @ts-expect-error -- no such field of the child
  db.from(articles).lookup(reviews, { on: 'nope' });

  // React: the rows typed from the query, no generic given.
  const live = useLiveQuery(db.from(articles).select('title').where('draft', false));
  expect<{ title: string }[] | undefined>(live);
  // The unbound builder takes a table too.
  expect<string>(from(articles).collection);
  const raw = db.checkSchema({ format: 1, fennecql: toFennecQL(tables) }, 'plan');
  // A schema written as FennecQL, typed by the caller.
  const text = await Fennec.open<{ notes: { title: string } }>(bytes, { schema: 'create collection notes (title text required)' });
  expect<{ title: string }[]>(await text.from('notes').select('title').rows());
  expect<string[]>(raw.statements);
  expect<string | null>(raw.refusals[0].field);
}

export async function elsewhere() {
  // Over HTTP the server owns the schema: compared, and applied only when asked.
  const http = await connect('http://127.0.0.1:8080', { schema: tables, token: 't' });
  expect<{ title: string }[]>(await http.from(articles).select('title').rows());
  await connect('http://127.0.0.1:8080', { schema: tables, migrate: true, token: 'admin' });
  // Without a schema it is what it was.
  connect('http://127.0.0.1:8080').from('anything');

  const replica = await sync({ url: 'http://127.0.0.1:8080', schema: tables, relations, shapes: [{ collection: articles }] });
  expect<{ title: string }[]>(await replica.from(articles).select('title').rows());
  // @ts-expect-error -- a field the table does not have
  replica.from(articles).where('nope', 1);

  const db = await Fennec.open('./fennec.wasm');
  await openFile(db, 'app.fennec', { schema: tables });
}
