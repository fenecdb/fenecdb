#!/usr/bin/env bash
# The packages as the registries would take them, installed where a user
# would install them, and used: PyPI's `fennecdb`, npm's `@fennecdb/web`,
# `@fennecdb/react`, `@fennecdb/cloudflare` and `@fennecdb/langchain`. Needs `make wasm`
# first, since the web package carries the module. Run by `make packages`, by CI, and by
# packages.yml before anything is published.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
python="${PYTHON:-python3}"
out="${1:-$root/target/packages}"
rm -rf "$out"
mkdir -p "$out"
out="$(cd "$out" && pwd)"
mkdir -p "$out/dist" "$out/npm"

[ -f "$root/web/fennec.wasm" ] || { echo "web/fennec.wasm is missing: make wasm" >&2; exit 1; }
[ -d "$root/web/collate" ] || { echo "web/collate is missing: make wasm" >&2; exit 1; }

# Every package says the workspace's version, or a release would publish
# one under another's number.
version="$(sed -n 's/^version = "\(.*\)"/\1/p' "$root/Cargo.toml" | head -1)"
py="$(sed -n 's/^version = "\(.*\)"/\1/p' "$root/integrations/python/pyproject.toml" | head -1)"
web="$(node -p "require('$root/web/package.json').version")"
react="$(node -p "require('$root/integrations/react/package.json').version")"
cloudflare="$(node -p "require('$root/integrations/cloudflare/package.json').version")"
langchain="$(node -p "require('$root/integrations/langchain/package.json').version")"
for v in "$py" "$web" "$react" "$cloudflare" "$langchain"; do
  if [ "$v" != "$version" ]; then
    echo "a package says $v where the workspace says $version (make version V=...)" >&2
    exit 1
  fi
done
if [ -n "${RELEASE_TAG:-}" ] && [ "${RELEASE_TAG#v}" != "$version" ]; then
  echo "the release is $RELEASE_TAG, the packages $version" >&2
  exit 1
fi

# npm: both tarballs, installed into a project of their own, and the web
# client opening the module and its collation data the way its README says.
(cd "$root/web" && npm pack -q --pack-destination "$out/dist" >/dev/null)
(cd "$root/integrations/react" && npm pack -q --pack-destination "$out/dist" >/dev/null)
(cd "$root/integrations/cloudflare" && npm pack -q --pack-destination "$out/dist" >/dev/null)
(cd "$root/integrations/langchain" && npm pack -q --pack-destination "$out/dist" >/dev/null)
cd "$out/npm"
npm init -y -q >/dev/null
npm pkg set type=module >/dev/null
npm install -q --no-audit --no-fund \
  "$out/dist/fennecdb-web-$version.tgz" \
  "$out/dist/fennecdb-react-$version.tgz" \
  "$out/dist/fennecdb-cloudflare-$version.tgz" \
  "$out/dist/fennecdb-langchain-$version.tgz" \
  @langchain/core@1 react@19 >/dev/null
# The modules built without the indexes (`make wasm-lite`) and without
# anything (`make wasm-min`) are tests of the files the builds hand each
# other, not something a user is offered.
for test_build in fennec-lite.wasm fennec-min.wasm; do
  if [ -e "node_modules/@fennecdb/web/$test_build" ]; then
    echo "@fennecdb/web carries $test_build, a test build" >&2
    exit 1
  fi
done
cat > smoke.mjs <<'EOF'
import { readFile } from 'node:fs/promises';
import { Fennec } from '@fennecdb/web';
import { useLiveQuery, FennecProvider } from '@fennecdb/react';

const file = (path) => readFile(new URL(import.meta.resolve(`@fennecdb/web/${path}`)));
{
  const db = await Fennec.open(await file('fennec.wasm'), {
    collation: (name) => file(`collate/${name}.bin`),
  });
  db.run('create collection people (name text)');
  db.run('put people [{name: "Zeynep"}, {name: "Çağla"}, {name: "Ωμέγα"}, {name: "Жанна"}, {name: "Ömer"}, {name: "Ali"}]');
  // Greek and Cyrillic are not in the module: ordering them fetches their chunks.
  const rows = (await db.query('get people order name collate und')).rows.map((r) => r.name);
  const want = ['Ali', 'Çağla', 'Ömer', 'Zeynep', 'Ωμέγα', 'Жанна'];
  if (JSON.stringify(rows) !== JSON.stringify(want)) throw new Error(`fennec.wasm: ${rows}`);
  console.log(`@fennecdb/web fennec.wasm: ${db.version}, ${rows.length} rows in order`);
}
// A schema declared in code, from its own entry point: an open makes it,
// and a second open with a field more adds the field.
const { fennecTable, text, integer, index } = await import('@fennecdb/web/schema');
const notes = fennecTable('notes', { title: text().notNull(), n: integer() }, (t) => [index('notes_n').using('hash', t.n)]);
const declared = await Fennec.open(await file('fennec.wasm'), { schema: { notes } });
declared.run('put notes {title: "a", n: 1}');
const more = fennecTable('notes', { title: text().notNull(), n: integer(), tag: text() }, (t) => [index().using('hash', t.n)]);
const out = declared.checkSchema({ format: 1, fennecql: more.toFennecQL() }, 'apply');
if (!out.applied || out.statements[0] !== 'alter collection notes add field tag text') {
  throw new Error(`@fennecdb/web/schema: ${JSON.stringify(out)}`);
}
console.log('@fennecdb/web/schema declares and checks a schema');
// The client alone, from its own entry point: no engine among its exports,
// and the builder the package's own.
const client = await import('@fennecdb/web/client');
const web = await import('@fennecdb/web');
if (typeof client.connect !== 'function' || 'Fennec' in client || 'sync' in client || client.from !== web.from) {
  throw new Error(`@fennecdb/web/client exports ${Object.keys(client)}`);
}
if (client.from('docs').where('year', 2024).toFennecQL()[0] !== 'get docs where year = $1') {
  throw new Error('@fennecdb/web/client builds another text');
}
console.log('@fennecdb/web/client imports, with no engine');
if (typeof useLiveQuery !== 'function' || typeof FennecProvider !== 'function') {
  throw new Error('@fennecdb/react exports are missing');
}
console.log('@fennecdb/react imports');

// A key-value backed Durable Object's storage kept in a Map: the database
// there and back.
const { persist, restore } = await import('@fennecdb/cloudflare');
const map = new Map();
const storage = {
  get: async (k) => map.get(k),
  put: async (k, v) => void map.set(k, v),
  delete: async (ks) => ks.forEach((k) => map.delete(k)),
  list: async ({ prefix, start = '', limit = Infinity }) =>
    new Map([...map].filter(([k]) => k.startsWith(prefix) && k >= start).sort().slice(0, limit)),
};
const kept = await Fennec.open(await file('fennec.wasm'));
kept.run('create collection t (n int)');
kept.run('put t [{n: 1}, {n: 2}]');
await persist(kept, storage);
const back = await Fennec.open(await file('fennec.wasm'));
if (!(await restore(back, storage)) || back.rows('get t count')[0].count !== 2) {
  throw new Error('@fennecdb/cloudflare did not bring the database back');
}
console.log('@fennecdb/cloudflare keeps a database');

// The LangChain.js store over the database in the page.
const { FennecVectorStore } = await import('@fennecdb/langchain');
const { SyntheticEmbeddings } = await import('@langchain/core/utils/testing');
const store = new FennecVectorStore(new SyntheticEmbeddings({ vectorSize: 8 }), { client: back, collection: 'lc' });
await store.addDocuments([{ pageContent: 'a fox', metadata: {} }, { pageContent: 'a dog', metadata: {} }]);
if ((await store.similaritySearch('a fox', 1))[0].pageContent !== 'a fox') {
  throw new Error('@fennecdb/langchain did not find the document');
}
console.log('@fennecdb/langchain finds a document');
EOF
node smoke.mjs

# Python: the sdist and the wheel, built and installed in venvs of their
# own -- a system Python is an externally managed one on Debian and
# Homebrew alike, and refuses the build tool.
"$python" -m venv "$out/build"
"$out/build/bin/pip" install -q build
"$out/build/bin/python" -m build -q --outdir "$out/dist" "$root/integrations/python"
"$python" -m venv "$out/py"
"$out/py/bin/pip" install -q "$out/dist/fennecdb-$version-py3-none-any.whl"
"$out/py/bin/python" -c "
import fennecdb
c = fennecdb.Client('http://127.0.0.1:9')
assert c.url == 'http://127.0.0.1:9'
print('fennecdb imports')
"

ls -1 "$out/dist"
