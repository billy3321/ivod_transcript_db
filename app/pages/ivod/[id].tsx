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
      <h1 className="text-2xl font-bold mb-4">{data.meeting_name}</h1>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/2">
          <video controls src={data.video_url} className="w-full rounded mb-4" />
          <div className="flex space-x-4">
            <a
              href={data.ivod_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              View Original IVOD
            </a>
            <a
              href={`https://dataly.openfun.app/collection/item/ivod/${data.ivod_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              View on Dataly
            </a>
          </div>
        </div>
        <div className="lg:w-1/2">
          <p className="mb-2">
            <strong>Date:</strong> {data.date}
          </p>
          <p className="mb-2">
            <strong>Speaker:</strong> {data.speaker_name}
          </p>
          <p className="mb-2">
            <strong>Committees:</strong> {data.committee_names.join(', ')}
          </p>
          <p className="mb-4">
            <strong>Duration:</strong> {data.video_length}
          </p>
          <TranscriptViewer transcript={data.ai_transcript || data.ly_transcript} />
        </div>
      </div>
    </div>
  );
}