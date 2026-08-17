import { DASHBOARD_URL } from '../config';
import { Button } from './ui/Button';

export function FinalCTA({ onLaunchDashboard }: { onLaunchDashboard?: () => void }) {
  return (
    <section className="cta">
      <div className="cta__sea" aria-hidden="true">
        <svg viewBox="0 0 1440 150" preserveAspectRatio="none" className="cta__waves">
          <path d="M0,88 C180,58 300,112 480,92 C660,72 780,120 960,102 C1140,84 1290,124 1440,104 L1440,150 L0,150 Z" fill="var(--sea-200)" opacity="0.65" />
          <path d="M0,108 C200,84 320,128 500,114 C690,99 820,136 1000,122 C1180,108 1310,140 1440,126 L1440,150 L0,150 Z" fill="var(--sea-300)" opacity="0.5" />
        </svg>
      </div>

      <div className="shell cta__inner" data-reveal>
        <p className="eyebrow eyebrow--center">Begin</p>

        <h2 className="cta__head">The optimal route is not static.</h2>

        <p className="cta__body">
          Sagar Setu continuously adapts the voyage to the vessel, its objectives and changing ocean
          conditions.
        </p>

        <div className="cta__action">
          <Button href={DASHBOARD_URL} onClick={onLaunchDashboard} size="lg">
            Start your voyage
          </Button>
        </div>
      </div>
    </section>
  );
}
