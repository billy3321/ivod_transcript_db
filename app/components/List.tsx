import Link from 'next/link';
import { IVOD } from '@/types';

interface ListProps {
  items: IVOD[];
}

export default function List({ items }: ListProps) {
  return (
    <table className="min-w-full border-collapse">
      <thead>
        <tr>
          <th className="px-2 py-1 text-left">Date</th>
          <th className="px-2 py-1 text-left">Meeting</th>
          <th className="px-2 py-1 text-left">Committee</th>
          <th className="px-2 py-1 text-left">Speaker</th>
          <th className="px-2 py-1 text-left">Duration</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => (
          <tr key={item.ivod_id}>
            <td className="px-2 py-1">{item.date}</td>
            <td className="px-2 py-1">
              <Link href={`/ivod/${item.ivod_id}`}>{item.meeting_name}</Link>
            </td>
            <td className="px-2 py-1">{item.committee_names.join(', ')}</td>
            <td className="px-2 py-1">{item.speaker_name}</td>
            <td className="px-2 py-1">{item.video_length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}