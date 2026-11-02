import { useEffect, useState } from 'react';

const QUERY = '(max-width: 760px)';

/** 窄屏（手机）布局 */
export function useNarrow(): boolean {
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const f = () => setN(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return n;
}
