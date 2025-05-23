import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { IVODDetail } from '@/types';
import TranscriptViewer from '@/components/TranscriptViewer';

export default function IvodDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<IVODDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/ivods/${id}`)
      .then(res => res.json())
      .then(json => setData(json.data));
  }, [id]);

  if (!data) {
    return <div>Loading...</div>;
  }
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">{data.meeting_name}</h1>
      <div className="mb-4">Date: {data.date}</div>
      <div className="mb-4">Speaker: {data.speaker_name}</div>
      <TranscriptViewer transcript={data.ai_transcript || data.ly_transcript} />
    </div>
  );
}