import { useState } from 'react';

interface TranscriptViewerProps {
  transcript: string;
}

export default function TranscriptViewer({ transcript }: TranscriptViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 500;
  const displayText =
    expanded || transcript.length <= maxLength
      ? transcript
      : transcript.slice(0, maxLength) + '...';

  return (
    <div className="">
      <pre className="whitespace-pre-wrap border p-2">{displayText}</pre>
      {transcript.length > maxLength && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 px-2 py-1 bg-gray-200"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      )}
    </div>
  );
}