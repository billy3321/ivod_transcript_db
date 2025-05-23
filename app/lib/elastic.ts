import { Client } from '@elastic/elasticsearch';

const client = new Client({
  node: `${process.env.ES_SCHEME}://${process.env.ES_HOST}:${process.env.ES_PORT}`,
  auth: process.env.ES_USER
    ? { username: process.env.ES_USER, password: process.env.ES_PASS || '' }
    : undefined
});

export default client;