'use client';

import { useMemo, useRef } from 'react';
import { PORTS, project, smoothPath, type LonLat } from '../../lib/geo';
import { OceanBase, OceanDefs, PortMark } from './OceanBase';
import { ShipGlyph } from './ShipGlyph';
import { useFleet, type FleetShip } from './useFleet';
import { useInView } from '../../hooks/useInView';
import { useReducedMotion } from '../../hooks/useMotionPrefs';

/* Live corridors across the basin — Arabian Sea, Bay of Bengal, Malacca approach. */
const CORRIDORS: LonLat[][] = [
  // Mumbai → Singapore, south of Sri Lanka and up the Malacca Strait
  [
    [72.85, 18.95], [71.6, 15.5], [73.2, 10.0], [76.5, 5.6], [81, 3.8],
    [87, 3.6], [92, 4.2], [95.8, 4.4], [98.6, 3.0], [100.8, 2.2],
    [102.6, 1.5], [103.85, 1.29],
  ],
  // Jebel Ali → Kochi
  [[55, 25], [57.5, 24.4], [59.8, 22.8], [62, 20.8], [65, 17.5], [69.5, 13.5], [73, 11.2], [76.26, 9.97]],
  // Aden → Mumbai
  [[45, 12.8], [48.5, 12.4], [52.5, 12.4], [57, 13.8], [62, 15.6], [67.5, 17.2], [72.85, 18.95]],
  // Chennai → Singapore
  [[80.29, 13.08], [83, 11.4], [87, 8.8], [91, 6.8], [94.5, 5.4], [97.2, 4.0], [99.9, 2.8], [102, 1.8], [103.85, 1.29]],
  // Haldia → Colombo
  [[88.1, 21.9], [88.6, 19.3], [87, 15.8], [85, 12.3], [83, 9.4], [81, 7.8], [79.85, 6.93]],
  // North Arabian Sea → Southern Ocean
  [[58.5, 20.0], [61.0, 15.0], [63.5, 9.0], [65.5, 3.0], [66.5, -3.0], [67.0, -9.0]],
  // East Africa / Somali Basin → Central Indian Ocean
  [[47.0, 4.0], [51.5, 2.0], [57.0, -0.5], [63.0, -2.5], [69.0, -3.5], [76.0, -4.0]],
  // Southern Trans-Indian Ocean: East Africa → Singapore
  [[41.5, -5.0], [48.0, -8.0], [58.0, -10.5], [70.0, -11.2], [82.0, -10.5], [92.0, -8.0], [97.5, -4.5], [101.5, -1.5], [103.85, 1.29]],
];

const FLEET: FleetShip[] = [
  { track: 'hero-trk-0', speed: 0.021, start: 0.08 },
  { track: 'hero-trk-0', speed: 0.019, start: 0.62, reverse: true },
  { track: 'hero-trk-1', speed: 0.03, start: 0.35 },
  { track: 'hero-trk-2', speed: 0.026, start: 0.7 },
  { track: 'hero-trk-3', speed: 0.024, start: 0.18, reverse: true },
  { track: 'hero-trk-4', speed: 0.033, start: 0.5 },
  { track: 'hero-trk-5', speed: 0.027, start: 0.2 },
  { track: 'hero-trk-6', speed: 0.025, start: 0.45 },
  { track: 'hero-trk-7', speed: 0.021, start: 0.15 },
];

const CYCLONE = project([89.2, 13.4]);
const SWELL = project([64.5, 9.5]);

export function OceanScene() {
  const [wrapRef, inView] = useInView<HTMLDivElement>('200px');
  const svgRef = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();

  const tracks = useMemo(() => CORRIDORS.map((c) => smoothPath(c, 0.62)), []);

  useFleet(svgRef, FLEET, inView && !reduced);

  return (
    <div className="ocean" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="chart"
        viewBox="95 -25 905 655"
        role="img"
        aria-label="Chart of the Indian Ocean basin showing live shipping corridors between Indian, Gulf and South-East Asian ports, with an active weather cell in the Bay of Bengal."
      >
        <OceanDefs id="hero" />
        <OceanBase id="hero" />

        {/* corridors */}
        <g>
          {tracks.map((d, i) => (
            <path
              key={i}
              id={`hero-trk-${i}`}
              d={d}
              className={`route ${reduced ? 'route--alt' : 'route--ambient'}`}
              style={reduced ? undefined : { animationDelay: `${i * -3.4}s` }}
            />
          ))}
        </g>

        {/* weather cell — Bay of Bengal */}
        <g className={reduced ? undefined : 'weather-pulse'}>
          <circle cx={CYCLONE[0]} cy={CYCLONE[1]} r="52" fill="url(#hero-risk)" />
          <g className={reduced ? undefined : 'weather-spin'}>
            <path
              d={`M${CYCLONE[0]},${CYCLONE[1]} m-16,0 a16,16 0 0 1 16,-16 a8,8 0 0 0 -8,8 a8,8 0 0 1 -8,8 Z`}
              fill="var(--risk)"
              opacity="0.34"
            />
            <path
              d={`M${CYCLONE[0]},${CYCLONE[1]} m16,0 a16,16 0 0 1 -16,16 a8,8 0 0 0 8,-8 a8,8 0 0 1 8,-8 Z`}
              fill="var(--risk)"
              opacity="0.34"
            />
          </g>
          <circle cx={CYCLONE[0]} cy={CYCLONE[1]} r="2.2" fill="var(--risk)" />
        </g>
        <text x={CYCLONE[0] + 60} y={CYCLONE[1] - 4} className="chart-note">
          Cyclonic cell
        </text>
        <text x={CYCLONE[0] + 60} y={CYCLONE[1] + 9} className="chart-note" style={{ fill: 'var(--risk)' }}>
          Hs 4.6 m
        </text>
        <line
          x1={CYCLONE[0] + 22}
          y1={CYCLONE[1] - 8}
          x2={CYCLONE[0] + 56}
          y2={CYCLONE[1] - 8}
          stroke="var(--risk)"
          strokeWidth="0.8"
          opacity="0.5"
        />

        {/* swell / monsoon indicator — Arabian Sea */}
        <g opacity="0.75">
          <g stroke="var(--sea-600)" strokeWidth="1" fill="none" opacity="0.7">
            <path d={`M${SWELL[0] - 22},${SWELL[1]} q7,-5 14,0 q7,5 14,0`} />
            <path d={`M${SWELL[0] - 22},${SWELL[1] + 7} q7,-5 14,0 q7,5 14,0`} />
          </g>
          <text x={SWELL[0] - 22} y={SWELL[1] - 10} className="chart-note">
            SW Monsoon · 2.4 m
          </text>
        </g>

        {/* ports */}
        <g>
          <PortMark port={PORTS.mumbai} emphasis />
          <PortMark port={PORTS.singapore} emphasis />
          <PortMark port={PORTS.kochi} />
          <PortMark port={PORTS.chennai} />
          <PortMark port={PORTS.colombo} />
          <PortMark port={PORTS.haldia} />
          <PortMark port={PORTS.jebelali} />
          <PortMark port={PORTS.aden} />
        </g>

        {/* vessels under way */}
        <g filter="url(#hero-shadow)">
          {FLEET.map((_, i) => (
            <g key={i} data-ship={i} className="vessel">
              <ShipGlyph scale={i % 3 === 0 ? 1.75 : 1.4} tone={i === 0 ? 'signal' : 'ink'} />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
