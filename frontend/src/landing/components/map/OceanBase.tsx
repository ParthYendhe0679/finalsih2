import { ISLETS, LANDMASSES, MERIDIANS, PARALLELS, VIEW, project, type Port, px } from '../../lib/geo';

/** Gradients, hatches and filters shared by every map scene on the page. */
export function OceanDefs({ id }: { id: string }) {
  return (
    <defs>
      {/* Soft atmospheric sea wash that blends seamlessly into the page background */}
      <linearGradient id={`${id}-sea`} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stopColor="#f7fafd" stopOpacity="0.4" />
        <stop offset="50%" stopColor="#ebf4fa" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#dcebf7" stopOpacity="0.9" />
      </linearGradient>

      <radialGradient id={`${id}-glow`} cx="0.5" cy="0.45" r="0.62">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>

      {/* Distinct, rich slate-navy landmasses that stand out crisply */}
      <linearGradient id={`${id}-land`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor="#243c56" />
        <stop offset="60%" stopColor="#1b3047" />
        <stop offset="100%" stopColor="#142639" />
      </linearGradient>

      {/* Weather cell glow */}
      <radialGradient id={`${id}-risk`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="var(--risk)" stopOpacity="0.22" />
        <stop offset="62%" stopColor="var(--risk)" stopOpacity="0.1" />
        <stop offset="100%" stopColor="var(--risk)" stopOpacity="0" />
      </radialGradient>

      <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#0a2540" floodOpacity="0.25" />
      </filter>
    </defs>
  );
}

/** Sea fill, graticule, depth contours and landmasses. */
export function OceanBase({ id, contours = true }: { id: string; contours?: boolean }) {
  return (
    <g aria-hidden="true">
      <rect width={VIEW.w} height={VIEW.h} fill={`url(#${id}-sea)`} />
      <rect width={VIEW.w} height={VIEW.h} fill={`url(#${id}-glow)`} />

      {/* graticule */}
      <g stroke="#9abddb" strokeWidth="0.65" opacity="0.45">
        {MERIDIANS.map((m) => (
          <line key={m.lon} x1={m.x} y1="0" x2={m.x} y2={VIEW.h} />
        ))}
        {PARALLELS.map((p) => (
          <line key={p.lat} x1="0" y1={p.y} x2={VIEW.w} y2={p.y} />
        ))}
      </g>

      {/* equator reads slightly stronger, as on a real chart */}
      <line
        x1="0"
        y1={project([0, 0])[1]}
        x2={VIEW.w}
        y2={project([0, 0])[1]}
        stroke="#4a8ec2"
        strokeWidth="0.9"
        opacity="0.55"
      />

      {contours && <DepthContours />}

      <g fill={`url(#${id}-land)`} stroke="#0f2236" strokeWidth="1.2" strokeLinejoin="round">
        {LANDMASSES.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      <g fill="#1b3047" stroke="#0f2236" strokeWidth="0.8">
        {ISLETS.map((isle, i) => {
          const [x, y] = project(isle.at);
          return <circle key={i} cx={x} cy={y} r={isle.r} />;
        })}
      </g>
    </g>
  );
}

/** Slow-drifting bathymetric lines — the only ambient motion in the sea itself. */
function DepthContours() {
  const bands = [
    { d: 'M60,150 C210,118 330,190 470,168 C620,144 760,206 1000,178', delay: '0s' },
    { d: 'M40,268 C200,240 320,300 480,282 C650,262 800,318 1000,296', delay: '-9s' },
    { d: 'M20,392 C190,366 330,424 500,404 C670,384 820,436 1000,414', delay: '-18s' },
    { d: 'M20,506 C200,482 340,536 520,516 C700,496 850,542 1000,524', delay: '-27s' },
  ];

  return (
    <g fill="none" stroke="#689dc7" strokeWidth="0.9" opacity="0.38" className="contour-set">
      {bands.map((b, i) => (
        <path key={i} d={b.d} className="contour" style={{ animationDelay: b.delay }} />
      ))}
    </g>
  );
}

/** Port marker — concentric ring, hairline leader and a mono label. */
export function PortMark({
  port,
  label = true,
  emphasis = false,
}: {
  port: Port;
  label?: boolean;
  emphasis?: boolean;
}) {
  const [x, y] = px(port);
  const anchor = port.anchor ?? 'start';
  const gap = anchor === 'end' ? -9 : anchor === 'start' ? 9 : 0;

  return (
    <g>
      {emphasis && <circle cx={x} cy={y} r="9" fill="var(--ink)" opacity="0.08" />}
      <circle cx={x} cy={y} r={emphasis ? 4.8 : 3.6} fill="#ffffff" stroke="var(--ink)" strokeWidth={emphasis ? 2.2 : 1.4} />
      {emphasis && <circle cx={x} cy={y} r="1.8" fill="var(--ink)" />}
      {label && (
        <text
          x={x + gap}
          y={y + (port.dy ?? 4)}
          textAnchor={anchor}
          className={emphasis ? 'port-label port-label--strong' : 'port-label'}
        >
          {port.name}
        </text>
      )}
    </g>
  );
}
