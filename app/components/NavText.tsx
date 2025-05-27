import { useEffect, useState } from 'react';

interface NavTextProps {
  text: string;
}

// Component that handles hydration mismatches by suppressing hydration warnings
export default function NavText({ text }: NavTextProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Always render the provided text to ensure consistency
  return <span suppressHydrationWarning>{text}</span>;
}