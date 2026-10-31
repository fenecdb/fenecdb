import { DataSourcePlugin } from '@grafana/data';

import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { DataSource } from './datasource';
import { FennecOptions, FennecQuery, FennecSecureData } from './types';

export const plugin = new DataSourcePlugin<DataSource, FennecQuery, FennecOptions, FennecSecureData>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
