'use client';

import { SECTIONS } from '../config';

const INPUTS = [
  { id: 'fuel', label: 'Fuel', note: 'Burn at speed, hull & trim' },
  { id: 'time', label: 'Time', note: 'Arrival window, laycan' },
  { id: 'safety', label: 'Safety', note: 'Sea state, exposure limits' },
  { id: 'ocean', label: 'Ocean conditions', note: 'Winds, waves, currents' },
];

/** Anchor points for widescreen 1440×380 diagram frame. */
const NODE = { x: 760, y: 184 };
const IN_X = 250;
const IN_Y = [40, 136, 232, 328];

export function ProblemSection() {
  return (
    <section className="section section--tint" id={SECTIONS.problem}>
      <div className="shell">
        <div className="section-head" data-reveal>
          <p className="eyebrow">The problem</p>
          <h2 className="h2">
            The shortest route is rarely
            <br />
            the best route.
          </h2>
          <p className="lede">
            A straight line on a chart ignores everything that actually decides a voyage — how this
            hull behaves in a following sea, what fuel costs at that speed, and where the weather
            will be four days from now. Sagar Setu solves for all of it at once.
          </p>
        </div>

        {/* inputs → solver → route */}
        <figure className="converge" data-reveal>
          <svg
            className="chart converge__svg"
            viewBox="0 0 1440 380"
            role="img"
            aria-label="Diagram: fuel, time, safety and ocean conditions feed a multi-objective solver, which produces a recommended route."
          >
            <defs>
              <linearGradient id="cv-flow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--sea-500)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--sea-600)" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            {/* feed lines */}
            <g fill="none" stroke="url(#cv-flow)" strokeWidth="1.8" strokeLinecap="round">
              {IN_Y.map((y, i) => (
                <path
                  key={i}
                  className="route--draw converge__feed"
                  style={{ ['--len' as string]: 520, ['--draw-delay' as string]: `${i * 130}ms` }}
                  d={`M${IN_X},${y} C${IN_X + 220},${y} ${NODE.x - 260},${NODE.y} ${NODE.x - 122},${NODE.y}`}
                />
              ))}
            </g>

            {/* input labels */}
            {INPUTS.map((inp, i) => (
              <g key={inp.id} className="converge__in" style={{ ['--d' as string]: `${i * 110}ms` }}>
                <text x={IN_X - 22} y={IN_Y[i] - 7} textAnchor="end" className="converge__label">
                  {inp.label}
                </text>
                <text x={IN_X - 22} y={IN_Y[i] + 16} textAnchor="end" className="chart-note">
                  {inp.note}
                </text>
                <circle cx={IN_X - 6} cy={IN_Y[i]} r="4.5" fill="var(--sea-600)" />
              </g>
            ))}

            {/* solver */}
            <g className="converge__node">
              <circle cx={NODE.x} cy={NODE.y} r="130" fill="#fff" stroke="var(--rule-strong)" strokeWidth="1" />
              <circle cx={NODE.x} cy={NODE.y} r="108" fill="var(--ink)" />
              <text x={NODE.x} y={NODE.y - 10} textAnchor="middle" className="converge__nodeTop">
                Multi-objective
              </text>
              <text x={NODE.x} y={NODE.y + 12} textAnchor="middle" className="converge__nodeTop">
                solver
              </text>
              <circle
                cx={NODE.x}
                cy={NODE.y}
                r="130"
                fill="none"
                stroke="var(--sea-400)"
                strokeWidth="1.2"
                strokeDasharray="4 8"
                className="converge__ring"
              />
            </g>

            {/* output */}
            <path
              className="route--draw"
              style={{ ['--len' as string]: 360, ['--draw-delay' as string]: '620ms' }}
              d={`M${NODE.x + 132},${NODE.y} L1180,${NODE.y}`}
              fill="none"
              stroke="var(--signal)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <g className="converge__out">
              <circle cx="1200" cy={NODE.y} r="6" fill="var(--signal)" />
              <text x="1222" y={NODE.y - 4} className="converge__label" style={{ fill: 'var(--signal)' }}>
                Better route
              </text>
              <text x="1222" y={NODE.y + 17} className="chart-note">
                Balanced, not merely short
              </text>
            </g>
          </svg>
        </figure>
      </div>
    </section>
  );
}
