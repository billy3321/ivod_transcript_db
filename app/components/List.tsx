import Link from 'next/link';
import { IVOD } from '@/types';

interface ListProps {
  items: IVOD[];
}

export default function List({ items }: ListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map(item => (
        <div
          key={item.ivod_id}
          className="border rounded shadow p-4 flex flex-col justify-between hover:shadow-lg transition"
        >
          <div>
            <h2 className="text-lg font-semibold mb-2">
              <Link href={`/ivod/${item.ivod_id}`}>{item.meeting_name}</Link>
            </h2>
            <p className="text-sm text-gray-600 mb-1">{item.date}</p>
            <p className="text-sm mb-1">
              <strong>Committee:</strong> {item.committee_names.join(', ')}
            </p>
            <p className="text-sm mb-2">
              <strong>Speaker:</strong> {item.speaker_name}
            </p>
          </div>
          <div className="text-sm text-gray-500">{item.video_length}</div>
        </div>
      ))}
    </div>
  );
}