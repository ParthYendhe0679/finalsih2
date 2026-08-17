'use client';

import { useEffect, useRef, useState } from 'react';
import { SECTIONS } from '../config';
import { PORTS, VIEW, project, smoothPath, type LonLat } from '../lib/geo';
import { OceanBase, OceanDefs, PortMark } from './map/OceanBase';
import { ShipGlyph } from './map/ShipGlyph';
import { useInView } from '../hooks/useInView';
import { useReducedMotion } from '../hooks/useMotionPrefs';

const PLANNED: LonLat[] = [
  [72.85, 18.95], [71.5, 15], [73.5, 9.5], [77, 5.5], [82, 4.2], [87, 4.4],
  [92, 4.2], [96, 4.2], [99, 3.0], [101.5, 2.2], [103.85, 1.29],
];

const REVISED: LonLat[] = [
  [72.85, 18.95], [71.5, 15.2], [73.2, 9.8], [76.5, 5.2], [81, 2.8], [86, 1.6],
  [91, 1.6], [95, 2.6], [98.5, 2.6], [101, 2.0], [103, 1.5], [103.85, 1.29],
];

const CELL = project([89.5, 5.2]);

type Stage = {
  label: string;
  body: string;
  /** progress of the vessel along its current track, 0–1 */
  at: number;
  /** vessel follows the revised track from this stage on */
  onRevised?: boolean;
  cell: number; // 0–1 intensity
  showRevised: boolean;
  showCandidates?: boolean;
  readout: { hs: string; risk: string; eta: string; tone: 'calm' | 'watch' | 'alert' | 'clear' };
};

const STAGES: Stage[] = [
  {
    label: 'Normal conditions',
    body: 'The vessel is under way on its committed track. Forecast fields are steady and the plan holds.',
    at: 0.2,
    cell: 0,
    showRevised: false,
    readout: { hs: '1.8 m', risk: 'Low', eta: 'On plan', tone: 'calm' },
  },
  {
    label: 'Weather changes',
    body: 'A cyclonic cell develops in the Bay of Bengal — directly ahead of where this ship will be in four days.',
    at: 0.33,
    cell: 0.5,
    showRevised: false,
    readout: { hs: '3.1 m', risk: 'Elevated', eta: 'On plan', tone: 'watch' },
  },
  {
    label: 'Risk increases',
    body: 'Projected significant wave height at the crossing rises past the vessel’s exposure limit. The committed track is no longer acceptable.',
    at: 0.42,
    cell: 1,
    showRevised: false,
    readout: { hs: '4.6 m', risk: 'Exceeded', eta: 'At risk', tone: 'alert' },
  },
  {
    label: 'Route re-optimized',
    body: 'The passage is re-solved from the ship’s present position against the refreshed fields — not from the original departure point.',
    at: 0.47,
    cell: 1,
    showRevised: true,
    showCandidates: true,
    readout: { hs: '4.6 m', risk: 'Solving', eta: 'Re-computing', tone: 'watch' },
  },
  {
    label: 'Safer new route',
    body: 'A revised track is issued to the bridge: clear of the cell, six hours later, and well inside the vessel’s safe operating envelope.',
    at: 0.68,
    onRevised: true,
    cell: 0.75,
    showRevised: true,
    readout: { hs: '2.4 m', risk: 'Within limits', eta: '+6 h', tone: 'clear' },
  },
];

const DWELL = 4200;

export function DynamicRerouting() {
  const [wrapRef, inView] = useInView<HTMLDivElement>('0px');
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [manual, setManual] = useState(false);

  const plannedRef = useRef<SVGPathElement>(null);
  const revisedRef = useRef<SVGPathElement>(null);
  const [pose, setPose] = useState({ x: 0, y: 0, a: 0 });

  const s = STAGES[stage];

  /* auto-advance while the section is on screen and untouched */
  useEffect(() => {
    if (!inView || manual || reduced) return;
    const t = setTimeout(() => setStage((v) => (v + 1) % STAGES.length), DWELL);
    return () => clearTimeout(t);
  }, [inView, manual, reduced, stage]);

  /* seat the vessel wherever the current stage puts it */
  useEffect(() => {
    const path = (s.onRevised ? revisedRef.current : plannedRef.current) ?? plannedRef.current;
    if (!path) return;

    const len = path.getTotalLength();
    if (!len) return;

    const at = path.getPointAtLength(s.at * len);
    const ahead = path.getPointAtLength(Math.min(s.at * len + 8, len));
    setPose({
      x: at.x,
      y: at.y,
      a: (Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI + 90,
    });
  }, [stage, s.at, s.onRevised]);

  const pick = (i: number) => {
    setManual(true);
    setStage(i);
  };

  return (
    <section className="section section--tint" id={SECTIONS.adaptive} ref={wrapRef}>
      <div className="shell">
        <div className="section-head" data-reveal>
          <p className="eyebrow">Adaptive rerouting</p>
          <h2 className="h2">When the ocean changes, the plan changes</h2>
          <p className="lede">
            Most routing is decided once, at departure. Sagar Setu keeps solving — re-planning the
            remaining passage from the vessel’s present position every time the forecast moves.
          </p>
        </div>

        {/* stepper */}
        <ol className={`steps${manual || reduced ? ' steps--manual' : ''}`} data-reveal>
          {STAGES.map((st, i) => (
            <li key={st.label} className={`step${i === stage ? ' step--on' : ''}${i < stage ? ' step--done' : ''}`}>
              <button type="button" onClick={() => pick(i)} aria-current={i === stage}>
                <span className="step__rail" aria-hidden="true">
                  <span className="step__fill" />
                </span>
                <span className="step__num">{String(i + 1).padStart(2, '0')}</span>
                <span className="step__label">{st.label}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="reroute">
          <figure className="reroute__map">
            <svg
              className="chart"
              viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
              role="img"
              aria-label={`Rerouting stage ${stage + 1} of ${STAGES.length}: ${s.label}. ${s.body}`}
            >
              <OceanDefs id="dr" />
              <OceanBase id="dr" contours={false} />

              {/* weather cell, intensity tied to the stage */}
              <g
                className="cell"
                style={{ opacity: s.cell, transform: `scale(${0.55 + s.cell * 0.45})`, transformOrigin: `${CELL[0]}px ${CELL[1]}px` }}
              >
                <circle cx={CELL[0]} cy={CELL[1]} r="78" fill="url(#dr-risk)" />
                <circle
                  cx={CELL[0]}
                  cy={CELL[1]}
                  r="48"
                  fill="none"
                  stroke="var(--risk)"
                  strokeWidth="1.1"
                  strokeDasharray="4 6"
                  opacity="0.65"
                  className={reduced ? undefined : 'weather-spin'}
                />
                <circle cx={CELL[0]} cy={CELL[1]} r="2.6" fill="var(--risk)" />
              </g>

              {/* discarded candidates, shown only while solving */}
              <g className="cands" style={{ opacity: s.showCandidates ? 1 : 0 }}>
                {[
                  [[82, 4.2], [86, 7.4], [92, 7.0], [97, 4.4]],
                  [[82, 4.2], [86, -0.4], [92, -0.2], [97, 2.4]],
                ].map((wp, i) => (
                  <path
                    key={i}
                    d={smoothPath(wp as LonLat[], 0.6)}
                    fill="none"
                    stroke="var(--sea-500)"
                    strokeWidth="1.2"
                    strokeDasharray="3 5"
                    opacity="0.55"
                  />
                ))}
              </g>

              {/* committed track */}
              <path
                ref={plannedRef}
                d={smoothPath(PLANNED, 0.6)}
                className="route trk trk--planned"
                style={{ opacity: s.showRevised ? 0.3 : 0.9 }}
              />

              {/* revised track */}
              <path
                ref={revisedRef}
                d={smoothPath(REVISED, 0.6)}
                className="route trk trk--revised"
                style={{ opacity: s.showRevised ? 1 : 0 }}
              />

              <PortMark port={PORTS.mumbai} emphasis />
              <PortMark port={PORTS.singapore} emphasis />

              {/* the vessel */}
              <g
                className="reroute__ship"
                style={{ transform: `translate(${pose.x}px, ${pose.y}px) rotate(${pose.a}deg)` }}
              >
                <circle r="18" fill="var(--ink)" opacity="0.08" />
                <ShipGlyph scale={1.6} tone={s.onRevised ? 'signal' : 'ink'} />
              </g>
            </svg>
          </figure>

          <aside className="reroute__panel">
            <p className="mono-label">Stage {String(stage + 1).padStart(2, '0')} / 05</p>
            <h3 className="reroute__title">{s.label}</h3>
            <p className="reroute__body">{s.body}</p>

            <dl className={`readout readout--${s.readout.tone}`}>
              <div>
                <dt className="mono-label">Hs at crossing</dt>
                <dd>{s.readout.hs}</dd>
              </div>
              <div>
                <dt className="mono-label">Risk</dt>
                <dd>{s.readout.risk}</dd>
              </div>
              <div>
                <dt className="mono-label">ETA</dt>
                <dd>{s.readout.eta}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}
