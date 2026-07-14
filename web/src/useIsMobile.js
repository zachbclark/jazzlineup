import { useEffect, useState } from 'react';

const QUERY = '(max-width: 760px)';

export function isMobileNow() {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

export function useIsMobile() {
  const [mobile, setMobile] = useState(isMobileNow);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}
