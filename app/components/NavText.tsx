import { useEffect, useState } from 'react';

interface NavTextProps {
  text: string;
}

export default function NavText({ text }: NavTextProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Always return the same text to prevent hydration mismatch
  return <span>{text}</span>;
}