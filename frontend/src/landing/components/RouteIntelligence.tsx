'use client';

import { useMemo, useState } from 'react';
import { SECTIONS } from '../config';
import { PORTS, VIEW, project, smoothPath, type LonLat } from '../lib/geo';
import { OceanBase, OceanDefs, PortMark } from './map/OceanBase';

type RouteDef = {
  id: string;
  name: string;
  kind: 'alt' | 'rec';
  waypoints: LonLat[];
  stats: { distance: string; passage: string; exposure: string };
  verdict: string;
};

const ROUTES: RouteDef[] = [
  {
    id: 'direct',
    name: 'Direct track',
    kind: 'alt',
    waypoints: [
      [72.85, 18.95], [71.5, 15], [73.5, 9.5], [77, 5.5], [82, 4.2], [87, 4.4],
      [92, 4.2], [96, 4.2], [99, 3.0], [101.5, 2.2], [103.85, 1.29],
    ],
    stats: { distance: '2,180 nm', passage: '7 d 14 h', exposure: '19 h · Hs 4.6 m' },
    verdict: 'Shortest, but transits the cell at its peak.',
  },
  {
    id: 'north',
    name: 'Northern alternative',
    kind: 'alt',
    waypoints: [
      [72.85, 18.95], [71.5, 15], [73.5, 10], [78, 7.6], [82, 8.0], [86, 9.0],
      [90, 8.6], [94, 7.0], [97, 5.0], [100, 3.0], [102, 2.0], [103.85, 1.29],
    ],
    stats: { distance: '2,318 nm', passage: '8 d 03 h', exposure: '6 h · Hs 3.4 m' },
    verdict: 'Clears the cell north, into a foul current.',
  },
  {
    id: 'south',
    name: 'Southern alternative',
    kind: 'alt',
    waypoints: [
      [72.85, 18.95], [71, 14.5], [72.5, 8.5], [75, 3.5], [80, 0.5], [86, 0.0],
      [92, 0.5], [96, 1.5], [99.5, 1.8], [102, 1.6], [103.85, 1.29],
    ],
    stats: { distance: '2,404 nm', passage: '8 d 11 h', exposure: 'None above Hs 3 m' },
    verdict: 'Safest, but the detour costs a day.',
  },
  {
    id: 'rec',
    name: 'Recommended',
    kind: 'rec',
    waypoints: [
      [72.85, 18.95], [71.5, 15.2], [73.2, 9.8], [76.5, 5.2], [81, 2.8], [86, 1.8],
      [91, 2.2], [95, 3.2], [98.5, 2.8], [101, 2.0], [103, 1.5], [103.85, 1.29],
    ],
    stats: { distance: '2,246 nm', passage: '7 d 21 h', exposure: 'None above Hs 3 m' },
    verdict: 'Balanced across fuel, schedule and exposure.',
  },
];

const CELL = project([89.5, 5.2]);

export function RouteIntelligence() {
  const [active, setActive] = useState('rec');
  const paths = useMemo(() => ROUTES.map((r) => ({ id: r.id, d: smoothPath(r.waypoints, 0.6) })), []);

  return (
    <section className="section section--paper2" id={SECTIONS.routes}>
      <div className="shell">
        <div className="section-head" data-reveal>
          <p className="eyebrow">Route intelligence</p>
          <h2 className="h2">One passage, weighed four ways</h2>
        </div>

        <div className="routeview" data-reveal>
          <figure className="routeview__map">
            <svg
              className="chart"
              viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
              role="img"
              aria-label="Chart comparing four candidate routes from Mumbai to Singapore around an active weather cell in the Bay of Bengal."
            >
              <OceanDefs id="ri" />
              <OceanBase id="ri" contours={false} />

              {/* weather / risk zone */}
              <g>
                <circle cx={CELL[0]} cy={CELL[1]} r="74" fill="url(#ri-risk)" />
                <circle
                  cx={CELL[0]}
                  cy={CELL[1]}
                  r="46"
                  fill="none"
                  stroke="var(--risk)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                  opacity="0.6"
                  className="weather-spin"
                />
                <circle cx={CELL[0]} cy={CELL[1]} r="2.4" fill="var(--risk)" />
                <text x={CELL[0]} y={CELL[1] - 56} textAnchor="middle" className="chart-note" style={{ fill: 'var(--risk)' }}>
                  Weather · risk zone
                </text>
              </g>

              {/* candidate routes */}
              <g>
                {ROUTES.map((r, i) => {
                  const d = paths[i].d;
                  const isActive = active === r.id;
                  const rec = r.kind === 'rec';
                  return (
                    <g key={r.id} className={`rt${isActive ? ' rt--on' : ''}`}>
                      {rec && isActive && <path d={d} className="route route--halo" />}
                      <path
                        d={d}
                        className={`route route--draw ${rec ? 'route--rec' : 'route--alt'}`}
                        style={{
                          ['--len' as string]: 1500,
                          ['--draw-delay' as string]: `${i * 200}ms`,
                        }}
                      />
                    </g>
                  );
                })}
              </g>

              <PortMark port={PORTS.mumbai} emphasis />
              <PortMark port={PORTS.singapore} emphasis />
              <PortMark port={PORTS.colombo} />

              {/* origin / destination callouts */}
              <text x={project(PORTS.mumbai.at)[0] - 12} y={project(PORTS.mumbai.at)[1] - 10} textAnchor="end" className="chart-note">
                Origin
              </text>
              <text x={project(PORTS.singapore.at)[0] - 10} y={project(PORTS.singapore.at)[1] + 32} textAnchor="end" className="chart-note">
                Destination
              </text>
            </svg>
          </figure>

          <div className="routeview__rail">
            <p className="mono-label routeview__railTitle">Candidates</p>
            <ul className="rlist">
              {ROUTES.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`rrow${active === r.id ? ' rrow--on' : ''}${r.kind === 'rec' ? ' rrow--rec' : ''}`}
                    onMouseEnter={() => setActive(r.id)}
                    onFocus={() => setActive(r.id)}
                    onClick={() => setActive(r.id)}
                    aria-pressed={active === r.id}
                  >
                    <span className="rrow__head">
                      <span className="rrow__swatch" aria-hidden="true" />
                      <span className="rrow__name">{r.name}</span>
                    </span>
                    <span className="rrow__stats">
                      <span>{r.stats.distance}</span>
                      <span>{r.stats.passage}</span>
                    </span>
                    <span className="rrow__exposure">{r.stats.exposure}</span>
                    <span className="rrow__verdict">{r.verdict}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="routeview__foot">
              Hover a candidate to trace it on the chart.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
