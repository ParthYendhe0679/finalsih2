import { useEffect } from 'react';

export type FleetShip = {
  /** id of the <path> the vessel steams along */
  track: string;
  /** fraction of track length travelled per second (0–1) */
  speed: number;
  /** starting position along the track, 0–1 */
  start: number;
  /** true to steam from the end of the path back to the start */
  reverse?: boolean;
};

/**
 * Drives every vessel directly through setAttribute inside one rAF loop —
 * no React state per frame, so the scene stays at 60fps and re-renders zero
 * times while it runs. Heading comes from sampling the track just ahead.
 */
export function useFleet(
  rootRef: React.RefObject<SVGSVGElement | null>,
  ships: FleetShip[],
  active: boolean,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !active) return;

    const tracks = ships.map((s) => root.querySelector<SVGPathElement>(`#${s.track}`));
    const nodes = ships.map((_, i) => root.querySelector<SVGGElement>(`[data-ship="${i}"]`));
    const lengths = tracks.map((t) => {
      try {
        return t?.getTotalLength() ?? 0;
      } catch {
        return 0;
      }
    });
    if (!lengths.some((l) => l > 0)) return;

    const progress = ships.map((s) => s.start);

    const place = (i: number, t: number) => {
      const track = tracks[i];
      const node = nodes[i];
      const len = lengths[i];
      if (!track || !node || !len) return;

      const at = track.getPointAtLength(t * len);
      const step = ships[i].reverse ? -6 : 6;
      const ahead = track.getPointAtLength(Math.min(Math.max(t * len + step, 0), len));
      const angle = (Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI + 90;

      node.setAttribute(
        'transform',
        `translate(${at.x.toFixed(2)} ${at.y.toFixed(2)}) rotate(${angle.toFixed(2)})`,
      );
    };

    // Always seat the fleet at least once, so a paused or reduced-motion
    // scene still reads as a chart of vessels rather than an empty ocean.
    ships.forEach((s, i) => place(i, s.reverse ? 1 - s.start : s.start));
    if (!active) return;

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); // clamp after tab-switches
      last = now;

      ships.forEach((ship, i) => {
        progress[i] = (progress[i] + ship.speed * dt) % 1;
        place(i, ship.reverse ? 1 - progress[i] : progress[i]);
      });

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [rootRef, ships, active]);
}
