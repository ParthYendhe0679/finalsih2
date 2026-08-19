/** Great-circle distance in nautical miles. Mirrors the backend's grid.haversine_distance. */
export function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Earth radius in NM
  const toRad = (d) => (d * Math.PI) / 180;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lon2 - lon1);
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * How close to a berth still counts as "in the port zone".
 *
 * The emergency button is disabled inside this radius of the origin or the
 * destination. A radius rather than a waypoint index because rerouteFromIndex
 * resets currentVesselIndex to 0 mid-ocean, so an index test would wrongly
 * disable the button after every drag-reroute.
 */
export const PORT_ZONE_NM = 50;
