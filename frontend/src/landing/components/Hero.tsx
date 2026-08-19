'use client';

import { useEffect, useRef } from 'react';
import { DASHBOARD_URL, SECTIONS } from '../config';
import { Button } from './ui/Button';
import { OceanScene } from './map/OceanScene';
import { useReducedMotion } from '../hooks/useMotionPrefs';

export function Hero({ onLaunchDashboard }: { onLaunchDashboard?: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  /* A few pixels of drift between the copy and the chart — enough to feel
     dimensional on scroll, small enough that nobody consciously notices. */
  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = Math.min(window.scrollY, 900);
        node.style.setProperty('--px', `${y * 0.06}px`);
        node.style.setProperty('--pc', `${y * 0.028}px`);
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <header className="hero" ref={ref}>
      <div className="hero__wash" aria-hidden="true" />

      <div className="shell hero__grid">
        <div className="hero__copy">
          <h1 className="hero__title">Sagar Setu</h1>

          <p className="hero__sub">Dynamic Maritime Voyage Optimization</p>

          <p className="hero__line">Smarter routes. Safer voyages. Adaptive navigation.</p>

          <div className="hero__actions">
            <Button href={DASHBOARD_URL} onClick={onLaunchDashboard} size="lg">
              Plan your voyage
            </Button>
            <Button href={`#${SECTIONS.problem}`} variant="ghost" size="lg" arrow={false}>
              Explore how it works
            </Button>
          </div>
        </div>

        <div className="hero__scene">
          <OceanScene />
        </div>
      </div>

      <a className="hero__scroll" href={`#${SECTIONS.problem}`} aria-label="Scroll to how it works">
        <span className="mono-label">Scroll</span>
        <span className="hero__scroll-rail" aria-hidden="true">
          <span className="hero__scroll-dot" />
        </span>
      </a>
    </header>
  );
}
