# @fennecdb/langchain

A LangChain.js vector store over fennecdb: the database in the page (a
`Fennec` from `@fennecdb/web`), or behind fennec-server's HTTP endpoint (a
`FennecHttp`) -- anything with `run(sql, params)`.

```js
import { Fennec } from '@fennecdb/web';
import { FennecVectorStore } from '@fennecdb/langchain';

const db = await Fennec.open('./fennec.wasm');
const store = new FennecVectorStore(embeddings, {
  client: db,
  collection: 'handbook',
  metadataFields: { source: 'text' },
  fullText: true,
});
await store.addDocuments(documents);
await store.similaritySearch('how do I compact', 4, { source: 'handbook' });
await store.search('compact', 4, { mode: 'hybrid' });
```

It is the Python store's collection (`pip install "fennecdb[langchain]"`),
from JavaScript:

- A document is a row: its id, text, metadata as JSON and vector under
  `@hnsw`, over int8 or bit codes with `quant`. The collection is made on
  the first write, once the embedding's size is known.
- A field named in `metadataFields` gets a column of its own under `@hash`.
  `filter` takes equality and `$in` over those, answered by the index
  before the search ranks what passed.
- With `fullText`, the text is indexed for BM25 as well.
  `search(query, k, {mode})` ranks by the words (`'text'`) or by the words
  and the vector fused (`'hybrid'`).
- Writing an id that is already there replaces it. On a `Fennec` both
  statements run as one block; over HTTP they are two requests.

`npm test` holds it to what LangChain.js's own vector store integrations
are tested for, over a database in the page and over a fennec-server. It needs
`web/fennec.wasm` and the fennec-server binary.
