'use client';

import { SECTIONS } from '../config';

export function ApproachSection() {
  return (
    <section className="section" id={SECTIONS.approach}>
      <div className="shell">
        <div className="section-head" data-reveal>
          <p className="eyebrow">Approach</p>
          <h2 className="h2">How Sagar Setu thinks</h2>
          <p className="lede">
            Four principles shape every route: the physics of the hull, the forecast across the
            basin, a multi-objective trade-off solver, and continuous re-optimization as the
            voyage unfolds.
          </p>
        </div>

        <div className="pillars" data-reveal>
          {PILLARS.map((p, i) => (
            <article className="pillar" key={p.title}>
              <span className="pillar__num">0{i + 1}</span>
              <div className="pillar__figure">{p.figure}</div>
              <h3 className="pillar__title h3">{p.title}</h3>
              <p className="pillar__body">{p.body}</p>
              <div className="pillar__meta mono-label">{p.meta}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Polar response diagram — vessel resistance as a function of wave heading. */
function ShipAware() {
  const ticks = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);

  return (
    <svg viewBox="0 0 200 128" className="fig" aria-hidden="true">
      <g stroke="var(--rule-strong)" fill="none">
        <circle cx="100" cy="64" r="48" />
        <circle cx="100" cy="64" r="33" />
        <circle cx="100" cy="64" r="18" />
      </g>
      <g stroke="var(--rule)" strokeWidth="0.8">
        {ticks.map((deg) => {
          const r = (deg * Math.PI) / 180;
          const x1 = Math.round((100 + Math.sin(r) * 18) * 100) / 100;
          const y1 = Math.round((64 - Math.cos(r) * 18) * 100) / 100;
          const x2 = Math.round((100 + Math.sin(r) * 48) * 100) / 100;
          const y2 = Math.round((64 - Math.cos(r) * 48) * 100) / 100;
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>

      <path
        d="M100,18 C124,21 140,37 140,57 C140,71 130,81 118,88 C111,92 104,100 100,110 C96,100 89,92 82,88 C70,81 60,71 60,57 C60,37 76,21 100,18 Z"
        fill="var(--sea-500)"
        fillOpacity="0.14"
        stroke="var(--sea-600)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      <g transform="translate(100 64) scale(0.85)">
        <path
          d="M0,-13 C3.5,-7.2 5.1,-1.8 5.1,3.4 L5.1,9.6 C5.1,11.1 4.2,12 2.8,12 L-2.8,12 C-4.2,12 -5.1,11.1 -5.1,9.6 L-5.1,3.4 C-5.1,-1.8 -3.5,-7.2 0,-13 Z"
          fill="var(--ink)"
        />
      </g>
    </svg>
  );
}

/** Met-ocean field — winds, waves and currents as a vector grid. */
function OceanAware() {
  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 7; c++) {
      const x = 20 + c * 27;
      const y = 26 + r * 26;
      const angle = Math.round((24 * Math.sin((c + r * 1.4) * 0.62) + 18) * 100) / 100;
      const strength = Math.round((0.45 + 0.4 * Math.abs(Math.cos((c - r) * 0.5))) * 100) / 100;
      cells.push({ x, y, angle, strength, key: `${r}-${c}` });
    }
  }

  return (
    <svg viewBox="0 0 200 128" className="fig" aria-hidden="true">
      <g className="vecfield">
        {cells.map((cell, i) => (
          <g
            key={cell.key}
            transform={`translate(${cell.x} ${cell.y}) rotate(${cell.angle})`}
            opacity={cell.strength}
            style={{ ['--i' as string]: i }}
          >
            <line x1="-8" y1="0" x2="6" y2="0" stroke="var(--sea-600)" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M6,0 L2.4,-2.4 L2.4,2.4 Z" fill="var(--sea-600)" />
          </g>
        ))}
      </g>
      <g fill="none" stroke="var(--sea-400)" strokeWidth="1.4" opacity="0.75">
        <path d="M10,112 q14,-9 28,0 t28,0 t28,0 t28,0 t28,0 t28,0" />
        <path d="M10,120 q14,-9 28,0 t28,0 t28,0 t28,0 t28,0 t28,0" opacity="0.5" />
      </g>
    </svg>
  );
}

/** Pareto front — the trade surface the solver searches. */
function MultiObjective() {
  const cloud = [
    [64, 38], [86, 30], [108, 44], [130, 34], [78, 58], [100, 66], [126, 58],
    [148, 48], [92, 82], [118, 76], [142, 70], [160, 62], [70, 74], [136, 92],
  ];
  const front = [
    [46, 96], [62, 70], [86, 52], [116, 40], [152, 32], [176, 28],
  ];

  return (
    <svg viewBox="0 0 200 128" className="fig" aria-hidden="true">
      <g stroke="var(--rule-strong)" strokeWidth="1">
        <line x1="34" y1="14" x2="34" y2="110" />
        <line x1="34" y1="110" x2="186" y2="110" />
      </g>
      <text x="30" y="16" textAnchor="end" className="fig__axis">Fuel</text>
      <text x="186" y="124" textAnchor="end" className="fig__axis">Time</text>

      <g fill="var(--ink-faint)" opacity="0.4">
        {cloud.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" />
        ))}
      </g>

      <path
        d={`M${front.map((p) => p.join(',')).join(' L')}`}
        fill="none"
        stroke="var(--signal)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.5"
        strokeDasharray="3 4"
      />
      <g fill="var(--signal)">
        {front.map(([x, y]) => (
          <circle key={`f${x}`} cx={x} cy={y} r="3.4" />
        ))}
      </g>
      <circle cx="116" cy="40" r="7.5" fill="none" stroke="var(--signal)" strokeWidth="1.4" />
    </svg>
  );
}

/** Adaptive routing — the plan changes when the ocean does. */
function AdaptiveRouting() {
  return (
    <svg viewBox="0 0 200 128" className="fig" aria-hidden="true">
      <ellipse cx="118" cy="82" rx="40" ry="26" fill="var(--risk)" opacity="0.1" />
      <ellipse cx="118" cy="82" rx="24" ry="15" fill="var(--risk)" opacity="0.13" />

      <path
        d="M24,88 C60,86 92,84 178,52"
        fill="none"
        stroke="var(--ink-faint)"
        strokeWidth="1.6"
        strokeDasharray="4 5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M24,88 C58,86 74,42 112,30 C142,21 158,36 178,52"
        fill="none"
        stroke="var(--signal)"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="adapt-line"
      />

      <circle cx="24" cy="88" r="4.6" fill="#fff" stroke="var(--ink)" strokeWidth="1.8" />
      <circle cx="178" cy="52" r="4.6" fill="#fff" stroke="var(--ink)" strokeWidth="1.8" />
      <circle cx="60" cy="70" r="3.2" fill="var(--signal)" className="adapt-node" />
    </svg>
  );
}

const PILLARS = [
  {
    title: 'Ship-Aware',
    body: 'Every hull answers a seaway differently. Sagar Setu models this vessel — its dimensions, loading, propulsion curve and added resistance — so the plan reflects the ship actually sailing, not a generic one.',
    meta: 'Vessel response · Added resistance',
    figure: <ShipAware />,
  },
  {
    title: 'Ocean-Aware',
    body: 'Forecast winds, significant wave height, swell direction and surface currents are assimilated across the basin and carried forward along the passage, so conditions are read where the ship will be, when it gets there.',
    meta: 'Winds · Waves · Currents',
    figure: <OceanAware />,
  },
  {
    title: 'Multi-Objective',
    body: 'Fuel, passage time and safety pull against each other. Rather than collapsing them into one score, the solver searches the trade surface and surfaces the routes that are genuinely non-dominated.',
    meta: 'Pareto search · NSGA-II',
    figure: <MultiObjective />,
  },
  {
    title: 'Adaptive Routing',
    body: 'A voyage plan is a hypothesis about the ocean. As forecasts refresh and risk shifts, the passage is re-solved from the vessel\'s present position and the crew is given a revised track.',
    meta: 'Continuous re-optimization',
    figure: <AdaptiveRouting />,
  },
];
