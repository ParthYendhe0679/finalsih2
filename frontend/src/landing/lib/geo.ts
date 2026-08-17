/* ------------------------------------------------------------------
   Indian Ocean basin — simplified cartography.

   Coastlines are stored as [lon, lat] so every scene shares one source
   of truth and can be re-projected into any viewBox. The frame covers
   38°E–108°E and 32°N–12°S, which holds the whole Arabian Sea, Bay of
   Bengal and the approach to the Malacca Strait.
   ------------------------------------------------------------------ */

export type LonLat = [number, number];

export const FRAME = { lon0: 38, lon1: 108, lat0: 32, lat1: -12 };
export const VIEW = { w: 1000, h: 630 };

export function project([lon, lat]: LonLat): [number, number] {
  const x = ((lon - FRAME.lon0) / (FRAME.lon1 - FRAME.lon0)) * VIEW.w;
  const y = ((FRAME.lat0 - lat) / (FRAME.lat0 - FRAME.lat1)) * VIEW.h;
  return [round(x), round(y)];
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Closed landmass outline. */
export function landPath(points: LonLat[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${project(p).join(',')}`).join(' ') + ' Z';
}

/** Open polyline through points, smoothed with a Catmull-Rom → cubic pass. */
export function smoothPath(points: LonLat[], tension = 0.5): string {
  const pts = points.map(project);
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p.join(',')}`).join(' ');

  let d = `M${pts[0].join(',')}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += ` C${round(c1[0])},${round(c1[1])} ${round(c2[0])},${round(c2[1])} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/* ---------------- landmasses ---------------- */

const INDIA: LonLat[] = [
  [68.0, 23.9], [69.9, 22.4], [72.7, 21.6], [72.9, 19.1], [73.5, 16.0],
  [74.8, 13.1], [75.8, 11.4], [76.6, 9.0], [77.6, 8.1], [79.4, 10.3],
  [80.3, 13.1], [80.2, 15.9], [82.4, 16.8], [84.9, 19.3], [87.1, 21.4],
  [88.4, 21.7], [89.6, 22.0], [90.6, 25.3], [88.1, 27.0], [84.0, 27.6],
  [80.0, 28.9], [77.0, 30.6], [74.6, 33.5], [71.0, 27.4], [68.6, 25.4],
];

const SRI_LANKA: LonLat[] = [
  [79.8, 9.6], [81.3, 8.5], [81.9, 7.0], [81.7, 6.2], [80.4, 5.95], [79.7, 7.6],
];

const ARABIA: LonLat[] = [
  [43.5, 12.7], [45.1, 12.8], [47.6, 14.0], [50.1, 14.9], [52.2, 15.6],
  [54.0, 17.0], [55.3, 17.9], [57.8, 19.0], [58.9, 20.4], [59.8, 22.5],
  [58.0, 23.6], [56.4, 25.0], [54.5, 24.5], [52.0, 24.0], [50.6, 25.4],
  [50.0, 27.0], [48.5, 28.5], [47.5, 30.0], [44.5, 33.5], [41.5, 30.0],
  [39.5, 27.0], [36.5, 24.0], [39.0, 21.4], [40.5, 19.5], [42.0, 17.0], [43.0, 14.5],
];

const AFRICA: LonLat[] = [
  [43.3, 11.5], [44.6, 10.5], [47.0, 11.0], [50.6, 11.5], [51.3, 10.4],
  [50.0, 8.0], [48.5, 5.5], [46.0, 2.5], [42.5, -1.0], [40.5, -4.0],
  [39.5, -6.8], [39.8, -9.5], [40.6, -13.5], [35.0, -13.5], [34.5, -5.0],
  [33.5, 0.0], [34.0, 6.0], [36.5, 10.0], [38.0, 12.0], [41.0, 12.5],
];

const MADAGASCAR: LonLat[] = [
  [49.3, -12.1], [50.5, -14.5], [49.0, -15.5], [47.0, -14.0], [47.5, -12.4],
];

const INDOCHINA: LonLat[] = [
  [92.0, 21.5], [94.0, 19.4], [94.3, 16.0], [96.6, 16.0], [97.6, 16.5],
  [98.6, 14.0], [98.3, 11.0], [99.6, 9.4], [100.4, 6.4], [101.1, 3.0],
  [103.6, 1.35], [104.3, 1.5], [103.9, 3.5], [102.6, 5.5], [101.1, 6.5],
  [100.6, 9.0], [99.6, 11.5], [99.4, 14.0], [98.1, 16.5], [97.1, 19.0],
  [95.1, 22.0], [94.1, 24.5], [92.6, 25.0], [91.0, 23.5],
];

const SUMATRA: LonLat[] = [
  [95.3, 5.6], [97.2, 2.2], [99.5, -1.5], [101.5, -3.2], [104.0, -5.5],
  [105.9, -5.9], [104.5, -3.0], [103.0, -1.0], [101.0, 1.5], [98.5, 3.8],
];

const JAVA: LonLat[] = [
  [105.4, -6.0], [109.0, -6.5], [109.0, -8.2], [105.6, -6.9],
];

export const LANDMASSES = [INDIA, ARABIA, AFRICA, INDOCHINA, SUMATRA, SRI_LANKA, JAVA, MADAGASCAR].map(landPath);

/** Small islands drawn as dots rather than outlines. */
export const ISLETS: { at: LonLat; r: number }[] = [
  { at: [73.2, 4.2], r: 1.6 },
  { at: [73.4, 1.9], r: 1.3 },
  { at: [73.0, 6.4], r: 1.4 },
  { at: [72.9, 10.6], r: 1.4 },
  { at: [92.7, 11.8], r: 2.1 },
  { at: [93.0, 13.2], r: 1.7 },
  { at: [93.5, 7.2], r: 1.5 },
  { at: [54.0, 12.5], r: 2.0 },
  { at: [55.5, -4.6], r: 1.5 },
];

/* ---------------- ports ---------------- */

export type Port = { id: string; name: string; at: LonLat; anchor?: 'start' | 'end' | 'middle'; dy?: number };

export const PORTS: Record<string, Port> = {
  mundra: { id: 'mundra', name: 'Mundra', at: [69.7, 22.8], anchor: 'end', dy: -10 },
  mumbai: { id: 'mumbai', name: 'Mumbai', at: [72.85, 18.95], anchor: 'end', dy: 4 },
  kochi: { id: 'kochi', name: 'Kochi', at: [76.26, 9.97], anchor: 'end', dy: 4 },
  chennai: { id: 'chennai', name: 'Chennai', at: [80.29, 13.08], anchor: 'start', dy: -9 },
  vizag: { id: 'vizag', name: 'Visakhapatnam', at: [83.3, 17.7], anchor: 'start', dy: -9 },
  haldia: { id: 'haldia', name: 'Haldia', at: [88.1, 21.9], anchor: 'start', dy: -9 },
  colombo: { id: 'colombo', name: 'Colombo', at: [79.85, 6.93], anchor: 'end', dy: 4 },
  singapore: { id: 'singapore', name: 'Singapore', at: [103.85, 1.29], anchor: 'end', dy: 18 },
  jebelali: { id: 'jebelali', name: 'Jebel Ali', at: [55.0, 25.0], anchor: 'start', dy: -9 },
  salalah: { id: 'salalah', name: 'Salalah', at: [54.0, 17.0], anchor: 'middle', dy: -10 },
  aden: { id: 'aden', name: 'Aden', at: [45.0, 12.8], anchor: 'start', dy: 15 },
};

export const px = (p: Port) => project(p.at);

/* ---------------- graticule ---------------- */

export const MERIDIANS = [40, 50, 60, 70, 80, 90, 100].map((lon) => ({
  lon,
  x: project([lon, 0])[0],
}));

export const PARALLELS = [30, 20, 10, 0, -10].map((lat) => ({
  lat,
  y: project([0, lat])[1],
}));
