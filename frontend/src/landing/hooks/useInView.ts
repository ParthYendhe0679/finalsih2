import { useEffect, useRef, useState } from 'react';

/** Tracks whether a node is on screen, so off-screen scenes can pause their rAF loop. */
export function useInView<T extends Element>(margin = '120px') {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }

    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: margin,
    });
    io.observe(node);
    return () => io.disconnect();
  }, [margin]);

  return [ref, inView] as const;
}
