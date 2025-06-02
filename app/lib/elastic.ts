import { Client } from '@elastic/elasticsearch';
import { getElasticsearchConfig } from './database-env';

const esConfig = getElasticsearchConfig();

const client = new Client({
  node: `${esConfig.scheme}://${esConfig.host}:${esConfig.port}`,
  auth: esConfig.user
    ? { username: esConfig.user, password: esConfig.password || '' }
    : undefined
});

// 在開發環境顯示 Elasticsearch 環境資訊
if (process.env.NODE_ENV !== 'production') {
  console.log(`🔍 Elasticsearch Index: ${esConfig.index}`);
}

export default client;
export { esConfig };