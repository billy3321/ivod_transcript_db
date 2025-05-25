import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { 
    q, 
    meeting_name,
    speaker,
    committee,
    date_from,
    date_to,
    page = '1', 
    pageSize = '20', 
    sort = 'date_desc' 
  } = req.query;
  
  const pageNum = parseInt(page as string, 10);
  const size = parseInt(pageSize as string, 10);
  const skip = (pageNum - 1) * size;

  const orderBy: any = sort === 'date_asc' ? { date: 'asc' } : { date: 'desc' };

  let where: any = {};
  const conditions: any[] = [];

  // General search in multiple fields
  if (q && typeof q === 'string') {
    conditions.push({
      OR: [
        { meeting_name: { contains: q, mode: 'insensitive' } },
        { speaker_name: { contains: q, mode: 'insensitive' } },
        { committee_names: { contains: q, mode: 'insensitive' } },
        { ai_transcript: { contains: q, mode: 'insensitive' } },
        { ly_transcript: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  // Specific field searches
  if (meeting_name && typeof meeting_name === 'string') {
    conditions.push({
      meeting_name: { contains: meeting_name, mode: 'insensitive' }
    });
  }

  if (speaker && typeof speaker === 'string') {
    conditions.push({
      speaker_name: { contains: speaker, mode: 'insensitive' }
    });
  }

  if (committee && typeof committee === 'string') {
    conditions.push({
      committee_names: { contains: committee, mode: 'insensitive' }
    });
  }

  // Date range filters
  if (date_from && typeof date_from === 'string') {
    conditions.push({
      date: { gte: date_from }
    });
  }

  if (date_to && typeof date_to === 'string') {
    conditions.push({
      date: { lte: date_to }
    });
  }

  // Combine all conditions with AND
  if (conditions.length > 0) {
    where = { AND: conditions };
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