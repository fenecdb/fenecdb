import type { ReactNode } from 'react';

/**
 * What the hooks need of a database: fennecdb's `Fennec`, a database in the
 * page, or `FennecSync`, a replica synced from a server.
 */
export interface LiveSource {
  live(
    query: LiveQuery | string | [string, unknown[]],
    cb: (rows: any[]) => void,
    opts?: { onError?: (error: unknown) => void; collections?: string[] },
  ): () => void;
}

/** What the hooks need of a query: fennecdb's `Query`. */
export interface LiveQuery {
  toFennecQL(): [string, unknown[]];
  readonly context?: unknown;
}

/** Makes `db` the database `useFennec` and `useLiveQuery` use below. */
export function FennecProvider(props: { db: LiveSource; children?: ReactNode }): ReactNode;

/** The database of the nearest `FennecProvider`. */
export function useFennec<DB extends LiveSource = LiveSource>(): DB;

/**
 * The rows of `query`, from the database in the page, given again every
 * time they change; `undefined` until the first answer -- typed by the
 * query, a builder's from its collection's schema (`db.from(todos)`), with
 * no type given. A FennecQL text or `[text, params]` runs on the provider's
 * database, and names what it reads with `collections` (without them, every
 * write runs it again).
 */
export function useLiveQuery<Q extends LiveQuery & { rows(): Promise<unknown[]> }>(
  query: Q,
  opts?: { collections?: string[] },
): Awaited<ReturnType<Q['rows']>> | undefined;
/**
 * The same, its rows typed by the caller: a FennecQL text, or a query whose
 * type does not say. A text that asks for facets (`facet brand`) has them
 * on its rows.
 */
export function useLiveQuery<Row = Record<string, unknown>>(
  query: LiveQuery | string | [string, unknown[]] | null | undefined,
  opts?: { collections?: string[] },
): (Row[] & { facets?: Record<string, { value: unknown; count: number }[]> }) | undefined;
