import { useState, useEffect } from 'react';
import { IVOD } from '@/types';
import List from '@/components/List';
import SearchForm from '@/components/SearchForm';

export default function Home() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [data, setData] = useState<{ data: IVOD[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams(filters);
    fetch(`/api/ivods?${params}`)
      .then(res => res.json())
      .then(json => setData(json))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <div className="container mx-auto p-4">
      <SearchForm filters={filters} onSearch={setFilters} />
      {loading && <div>Loading...</div>}
      {data && <List items={data.data} />}
    </div>
  );
}