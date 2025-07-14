import { Client } from '@elastic/elasticsearch';
import { getElasticsearchConfig } from './database-env';

const esConfig = getElasticsearchConfig();

const client = new Client({
  node: `${esConfig.scheme}://${esConfig.host}:${esConfig.port}`,
  auth: esConfig.user
    ? { username: esConfig.user, password: esConfig.password || '' }
    : undefined,
  // 減少連接超時和重試，快速 fallback 到資料庫搜尋
  requestTimeout: 2000,
  maxRetries: 1
});

// 在開發環境顯示 Elasticsearch 環境資訊
if (process.env.NODE_ENV !== 'production') {
  console.log(`🔍 Elasticsearch Index: ${esConfig.index}`);
}

export default client;
export { esConfig };