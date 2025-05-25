import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { q, page = '1', pageSize = '20', sort = 'date_desc' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const size = parseInt(pageSize as string, 10);
  const skip = (pageNum - 1) * size;

  const orderBy: any = sort === 'date_asc' ? { date: 'asc' } : { date: 'desc' };

  let where: any = {};
  if (q && typeof q === 'string') {
    where = {
      OR: [
        { meeting_name: { contains: q, mode: 'insensitive' } },
        { speaker_name: { contains: q, mode: 'insensitive' } },
        { committee_names: { contains: q, mode: 'insensitive' } },
      ],
    };
  }

  try {
    const [data, total] = await Promise.all([
      prisma.iVODTranscript.findMany({
        where,
        orderBy,
        skip,
        take: size,
        select: {
          ivod_id: true,
          date: true,
          meeting_name: true,
          committee_names: true,
          speaker_name: true,
          video_length: true,
        },
      }),
      prisma.iVODTranscript.count({ where }),
    ]);
    res.status(200).json({ data, total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}