import type { NextApiRequest, NextApiResponse } from 'next';
import client from '@/lib/elastic';
import bodybuilder from 'bodybuilder';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { q = '' } = req.query;
  if (Array.isArray(q)) {
    res.status(400).json({ error: 'Invalid query' });
    return;
  }
  // Try Elasticsearch search, fallback to DB if unavailable
  let hits: Array<{ id: number; transcript: string | null }> = [];
  let usedES = true;
  try {
    const body = bodybuilder()
      .query('multi_match', { query: q, fields: ['ai_transcript', 'ly_transcript'] })
      .build();
    const result = await client.search({
      index: process.env.NEXT_PUBLIC_ES_INDEX,
      body,
    });
    hits = result.hits.hits.map(hit => ({
      id: (hit._source as any).ivod_id,
      transcript: (hit._source as any).ai_transcript || (hit._source as any).ly_transcript,
    }));
  } catch (error: any) {
    // Elasticsearch failed or not reachable; fallback to DB search
    usedES = false;
    const records = await prisma.iVODTranscript.findMany({
      where: {
        OR: [
          { ai_transcript: { contains: q, mode: 'insensitive' } },
          { ly_transcript: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        ivod_id: true,
        ai_transcript: true,
        ly_transcript: true,
      },
    });
    hits = records.map(rec => ({
      id: rec.ivod_id,
      transcript: rec.ai_transcript || rec.ly_transcript,
    }));
  }
  res.status(200).json({ data: hits, fallback: !usedES });
}