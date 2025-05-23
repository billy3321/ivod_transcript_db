import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const data = await prisma.iVODTranscript.findUnique({
      where: { ivod_id: parseInt(id, 10) },
      select: {
        ivod_id: true,
        date: true,
        meeting_name: true,
        committee_names: true,
        speaker_name: true,
        video_length: true,
        ai_transcript: true,
        ly_transcript: true,
      },
    });
    if (!data) {
      res.status(404).json({ error: 'Not found' });
    } else {
      res.status(200).json({ data });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}