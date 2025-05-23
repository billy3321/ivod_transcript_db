import { useState } from 'react';

interface SearchFormProps {
  filters: Record<string, string>;
  onSearch: (filters: Record<string, string>) => void;
}

export default function SearchForm({ filters, onSearch }: SearchFormProps) {
  const [local, setLocal] = useState<Record<string, string>>(filters);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocal({ ...local, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(local);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 mb-4">
      <div>
        <label className="block" htmlFor="meetingName">Meeting Name:</label>
        <input
          id="meetingName"
          name="meetingName"
          value={local.meetingName || ''}
          onChange={handleChange}
          className="border p-1 w-full"
        />
      </div>
      <div>
        <label className="block" htmlFor="committee">Committee:</label>
        <input
          id="committee"
          name="committee"
          value={local.committee || ''}
          onChange={handleChange}
          className="border p-1 w-full"
        />
      </div>
      <div>
        <label className="block" htmlFor="speaker">Speaker:</label>
        <input
          id="speaker"
          name="speaker"
          value={local.speaker || ''}
          onChange={handleChange}
          className="border p-1 w-full"
        />
      </div>
      <button type="submit" className="px-3 py-1 bg-blue-600 text-white">Search</button>
    </form>
  );
}