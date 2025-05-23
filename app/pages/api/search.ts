import type { NextApiRequest, NextApiResponse } from 'next';
import client from '@/lib/elastic';
import bodybuilder from 'bodybuilder';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { q = '' } = req.query;
  if (Array.isArray(q)) {
    res.status(400).json({ error: 'Invalid query' });
    return;
  }
  try {
    const body = bodybuilder()
      .query('multi_match', { query: q, fields: ['ai_transcript', 'ly_transcript'] })
      .build();
    const result = await client.search({
      index: process.env.NEXT_PUBLIC_ES_INDEX,
      body,
    });
    const hits = result.hits.hits.map(hit => ({
      id: (hit._source as any).ivod_id,
      transcript: (hit._source as any).ai_transcript || (hit._source as any).ly_transcript
    }));
    res.status(200).json({ data: hits });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}