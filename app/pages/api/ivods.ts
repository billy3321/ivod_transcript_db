import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { page = '1', pageSize = '10', meetingName, committee, speaker } = req.query;
  const pageNum = parseInt(page as string, 10);
  const size = parseInt(pageSize as string, 10);
  const skip = (pageNum - 1) * size;

  const where: any = {};
  if (meetingName) {
    where.meeting_name = { contains: meetingName as string, mode: 'insensitive' };
  }
  if (committee) {
    where.committee_names = { has: committee as string };
  }
  if (speaker) {
    where.speaker_name = { contains: speaker as string, mode: 'insensitive' };
  }

  try {
    const [data, total] = await Promise.all([
      prisma.iVODTranscript.findMany({
        where,
        orderBy: { date: 'desc' },
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