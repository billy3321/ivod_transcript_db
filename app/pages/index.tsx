import { useState, useEffect } from 'react';
import { IVOD } from '@/types';
import List from '@/components/List';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc'>('date_desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ data: IVOD[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, sortOrder]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchTerm) params.append('q', searchTerm);
    if (sortOrder) params.append('sort', sortOrder);
    params.append('page', page.toString());
    params.append('pageSize', '20');
    fetch(`/api/ivods?${params}`)
      .then(res => res.json())
      .then(json => setData(json))
      .finally(() => setLoading(false));
  }, [searchTerm, sortOrder, page]);

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  if (loading && !data) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 space-y-2 md:space-y-0">
        <input
          type="text"
          placeholder="Search IVODs..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="border rounded p-2 flex-grow"
        />
        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value as 'date_desc' | 'date_asc')}
          className="border rounded p-2"
        >
          <option value="date_desc">Newest First</option>
          <option value="date_asc">Oldest First</option>
        </select>
      </div>
      <List items={data?.data || []} />
      <div className="flex justify-center items-center space-x-2 mt-4">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Previous
        </button>
        {[...Array(totalPages)].map((_, i) => (
          <button
            key={i}
            onClick={() => setPage(i + 1)}
            className={`px-3 py-1 border rounded ${page === i + 1 ? 'bg-blue-600 text-white' : ''}`}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}