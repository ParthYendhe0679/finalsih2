'use client';

import { useEffect, useState } from 'react';
import { DASHBOARD_URL, SECTIONS } from '../config';

const LINKS = [
  { href: `#${SECTIONS.problem}`, label: 'The problem' },
  { href: `#${SECTIONS.approach}`, label: 'Approach' },
  { href: `#${SECTIONS.routes}`, label: 'Route intelligence' },
  { href: `#${SECTIONS.adaptive}`, label: 'Adaptive rerouting' },
];

import { ThemeToggle } from './ThemeToggle';

export function Nav({ onLaunchDashboard }: { onLaunchDashboard?: () => void }) {
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setLifted(window.scrollY > 24);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const handleLaunch = (e: React.MouseEvent) => {
    if (onLaunchDashboard) {
      e.preventDefault();
      onLaunchDashboard();
    }
  };

  return (
    <nav className={`nav${lifted ? ' nav--lifted' : ''}`} aria-label="Primary">
      <div className="shell nav__inner">
        <a className="mark" href="#top" aria-label="Sagar Setu — home">
          <img src="/logo.jpg" alt="Sagar Setu emblem" className="mark__img" width="58" height="58" />
          <img src="/sagar-setu-title.png" alt="सागर सेतु" className="mark__title-img" height="54" />
        </a>

        <ul className="nav__links">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <ThemeToggle />
          <a className="nav__cta" href={DASHBOARD_URL} onClick={handleLaunch}>
            Command Room
            <svg viewBox="0 0 18 10" width="15" height="9" fill="none" aria-hidden="true">
              <path d="M0 5h16M12 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </nav>
  );
}
