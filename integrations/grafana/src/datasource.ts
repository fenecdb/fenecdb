import {
  CoreApp,
  CustomVariableSupport,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  FieldType,
  getDefaultTimeRange,
  LegacyMetricFindQueryOptions,
  MetricFindValue,
  ScopedVars,
  TimeRange,
  createDataFrame,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import { from, lastValueFrom, map, Observable } from 'rxjs';

import { VariableQueryEditor } from './components/VariableQueryEditor';
import { DEFAULT_QUERY, Explained, FennecOptions, FennecQuery } from './types';
import { valuesOf, variableValues } from './values';

/**
 * fennecdb's data source. Queries run in the plugin's backend -- a panel's
 * from the browser, an alert rule's from Grafana's server -- which binds
 * every value as a parameter; the browser only says what the dashboard's
 * variables hold.
 */
export class DataSource extends DataSourceWithBackend<FennecQuery, FennecOptions> {
  constructor(
    settings: DataSourceInstanceSettings<FennecOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(settings);
    // Annotations from a query: its rows' time, title, text and tags.
    this.annotations = {};
    this.variables = new FennecVariables(this);
  }

  getDefaultQuery(_: CoreApp): Partial<FennecQuery> {
    return DEFAULT_QUERY;
  }

  filterQuery(query: FennecQuery): boolean {
    return !query.hide && !!query.queryText?.trim();
  }

  /**
   * The query as written, and beside it the values of the dashboard
   * variables it names. Nothing is written into the text: the backend makes
   * each name a `$n` parameter, so a value is a value whatever it holds.
   */
  applyTemplateVariables(query: FennecQuery, scopedVars: ScopedVars): FennecQuery {
    return { ...query, vars: this.variableValues(query, scopedVars) };
  }

  /** The values of the variables a query names: one, or a list for a multi-value variable. */
  variableValues(query: FennecQuery, scopedVars: ScopedVars): Record<string, string | string[]> {
    return variableValues(this.templateSrv, query, scopedVars);
  }

  /** A variable's query: the values of the answer's first column, or of `__text` and `__value`. */
  async metricFindQuery(query: FennecQuery | string, options?: LegacyMetricFindQueryOptions): Promise<MetricFindValue[]> {
    const target: FennecQuery =
      typeof query === 'string' ? { refId: 'variable', queryText: query } : { ...query, refId: 'variable' };
    if (!target.queryText?.trim()) {
      return [];
    }
    const range = options?.range ?? getDefaultTimeRange();
    const request: DataQueryRequest<FennecQuery> = {
      app: CoreApp.Dashboard,
      requestId: `fennecdb-variable-${target.refId}`,
      interval: '1s',
      intervalMs: 1000,
      maxDataPoints: 1000,
      range,
      scopedVars: options?.scopedVars ?? {},
      startTime: Date.now(),
      targets: [target],
      timezone: 'utc',
    };
    const response = await lastValueFrom(this.query(request));
    if (response.errors?.length) {
      throw new Error(response.errors[0].message);
    }
    return valuesOf(response.data[0] as DataFrame | undefined);
  }

  /** The statement as the backend binds it, and the server's plan for it. */
  explain(query: FennecQuery, range: TimeRange, intervalMs: number, maxDataPoints: number): Promise<Explained> {
    const scopedVars: ScopedVars = {};
    return this.postResource<Explained>('explain', {
      query: { ...query, vars: this.variableValues(query, scopedVars) },
      from: range.from.valueOf(),
      to: range.to.valueOf(),
      intervalMs,
      maxDataPoints,
    });
  }
}

/** A query variable: FennecQL whose first column is the variable's values. */
class FennecVariables extends CustomVariableSupport<DataSource, FennecQuery> {
  editor = VariableQueryEditor;

  constructor(private readonly ds: DataSource) {
    super();
  }

  query(request: DataQueryRequest<FennecQuery>): Observable<DataQueryResponse> {
    return from(this.ds.metricFindQuery(request.targets[0], { range: request.range, scopedVars: request.scopedVars })).pipe(
      map((values) => ({
        data: [
          createDataFrame({
            fields: [
              { name: 'text', type: FieldType.string, values: values.map((v) => v.text) },
              { name: 'value', type: FieldType.string, values: values.map((v) => String(v.value ?? v.text)) },
            ],
          }),
        ],
      }))
    );
  }
}
