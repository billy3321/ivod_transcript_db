import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const result = await prisma.iVODTranscript.findFirst({
      select: {
        last_updated: true,
      },
      orderBy: {
        last_updated: 'desc',
      },
    });

    if (!result) {
      res.status(404).json({ error: 'No data found' });
      return;
    }

    res.status(200).json({ 
      lastUpdated: result.last_updated 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}