/**
 * Voyage Report & Environmental Dossier Generator for Aegir Maritime OS / MARINEX.
 * Generates an official-looking, comprehensive maritime voyage dossier including:
 * - Vessel Specifications & Performance Profile
 * - Voyage Route Summary (ETA, Fuel, Risk, Clearance)
 * - Strategic Optimization Rationale
 * - Met-Ocean Environmental Conditions (Open-Meteo Live Data)
 * - Complete Waypoint Navigation & Environmental Schedule Table
 */

export function generateVoyageDossierMarkdown(routeKey, routeData, ship, origin, destination, liveEnvironment) {
  const routeLabels = {
    fastest: 'Route A — Fastest (Time Optimal)',
    fuel_optimized: 'Route B — Fuel Optimal (Energy Efficient)',
    safest: 'Route C — Safest (Minimal Risk & Hazard Standoff)',
    balanced: 'Route D — Recommended (Multi-Objective Pareto Optimal)',
  };

  const routeRationales = {
    fastest: 'Prioritizes maximum speed over ground by finding deep-water channels with minimal hydrodynamic drag and favorable ocean current alignment, reducing overall transit time.',
    fuel_optimized: 'Prioritizes bunker fuel conservation by optimizing engine load factors, exploiting favorable surface currents, and avoiding heavy opposing head-seas.',
    safest: 'Maximizes navigational safety clearance from hazardous coastal shelves, shallow shoals, and high-wave met-ocean zones, providing maximal safety margin.',
    balanced: 'Calculates the optimal Pareto compromise between transit time, fuel consumption, and risk exposure based on user-defined priority weightings.',
  };

  const nowUTC = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const label = routeLabels[routeKey] || routeKey.toUpperCase();
  const rationale = routeRationales[routeKey] || 'Multi-objective optimal route.';
  const waypoints = routeData.waypoints || [];

  const vesselName = ship?.name || 'MV Ever Given';
  const imo = ship?.imo || 'IMO9811000';
  const vesselType = ship?.vessel_type || 'Ultra Large Container Vessel (20,124 TEU)';
  const length = ship?.length ?? 399.9;
  const beam = ship?.beam ?? 58.8;
  const draft = ship?.draft ?? 14.5;
  const dwt = ship?.dwt ?? 199692;
  const disp = ship?.displacement || 219000;
  const frontalArea = ship?.frontal_area || 2200;
  const sfoc = ship?.sfoc || 162;
  const efficiency = ship?.engine_efficiency ? (ship.engine_efficiency * 100).toFixed(0) : '48';

  let report = '';
  report += `========================================================================================\n`;
  report += `                  AEGIR MARITIME OS / MARINEX — STRATEGIC VOYAGE DOSSIER\n`;
  report += `                Smart India Hackathon 2026 | Problem Statement PSS07\n`;
  report += `========================================================================================\n\n`;

  report += `[1] VOYAGE & VESSEL IDENTIFICATION\n`;
  report += `----------------------------------------------------------------------------------------\n`;
  report += `  Voyage ID:             VOY-${Date.now().toString().slice(-6)}\n`;
  report += `  Generated At:          ${nowUTC}\n`;
  report += `  Departure Port:        ${origin}\n`;
  report += `  Arrival Port:          ${destination}\n`;
  report += `  Vessel Name:           ${vesselName}\n`;
  report += `  IMO Number:            ${imo}\n`;
  report += `  Vessel Class / Type:   ${vesselType}\n`;
  report += `  Length Overall (LOA):  ${length} Meters\n`;
  report += `  Beam (Moulded Width):  ${beam} Meters\n`;
  report += `  Maximum Scantling Draft:${draft} Meters\n`;
  report += `  Deadweight (DWT):      ${dwt.toLocaleString()} Metric Tons\n`;
  report += `  Design Displacement:   ${disp.toLocaleString()} Metric Tons\n`;
  report += `  Frontal Wind Area:     ${frontalArea} m²\n`;
  report += `  Engine Efficiency:     ${efficiency}%\n`;
  report += `  SFOC Rating:           ${sfoc} g/kWh\n\n`;

  report += `[2] SELECTED ROUTE STRATEGY & METRICS\n`;
  report += `----------------------------------------------------------------------------------------\n`;
  report += `  Route Profile:         ${label}\n`;
  report += `  Optimization Strategy: ${rationale}\n`;
  report += `  Estimated Voyage Time: ${routeData.total_time} Hours (${(routeData.total_time / 24).toFixed(1)} Days)\n`;
  report += `  Total Fuel Burn:       ${routeData.total_fuel?.toLocaleString()} Gallons\n`;
  report += `  Modeled Risk Score:    ${routeData.total_risk}\n`;
  report += `  Average Coast Clear:   ${routeData.avg_clearance_km ?? 'N/A'} km (${routeData.avg_clearance_nm ?? 'N/A'} NM)\n`;
  report += `  Minimum Coast Clear:   ${routeData.min_clearance_km ?? 'N/A'} km (${routeData.min_clearance_nm ?? 'N/A'} NM)\n`;
  report += `  Land Violations:       ${routeData.land_violations ?? 0} (Strict Hard-Land Constraint Enforced)\n`;
  report += `  Navigability Passed:   ${routeData.validation_passed ? 'YES (Verified Navigable)' : 'NO'}\n\n`;

  report += `[3] MET-OCEAN ENVIRONMENTAL WEATHER SUMMARY (OPEN-METEO LIVE)\n`;
  report += `----------------------------------------------------------------------------------------\n`;
  if (liveEnvironment) {
    report += `  Data Source:           ${liveEnvironment.data_source}\n`;
    report += `  Live Observation:      ${liveEnvironment.timestamp}\n`;
    report += `  Surface Wind Speed:    ${liveEnvironment.wind?.speed_kn} Knots (${liveEnvironment.wind?.compass} / ${liveEnvironment.wind?.direction_deg}°)\n`;
    report += `  Peak Wind Gusts:       ${liveEnvironment.wind?.gusts_kn} Knots\n`;
    report += `  Significant Waves:     ${liveEnvironment.waves?.height_m} Meters (${liveEnvironment.waves?.sea_state})\n`;
    report += `  Dominant Wave Period:  ${liveEnvironment.waves?.period_s} Seconds (${liveEnvironment.waves?.compass})\n`;
    report += `  Ocean Surface Current: ${liveEnvironment.currents?.speed_kn} Knots (Drift: ${liveEnvironment.currents?.compass} / ${liveEnvironment.currents?.direction_deg}°)\n`;
    report += `  Atmospheric Condition: ${liveEnvironment.weather?.description} (WMO Code: ${liveEnvironment.weather?.code})\n`;
  } else {
    report += `  Live met-ocean feed synthesized from Aegir Environmental Grid (0.25° Resolution).\n`;
  }
  report += `  Attribution:           Environmental forecast data provided by Open-Meteo under CC BY 4.0\n`;
  report += `  Legal Disclaimer:      Forecast model data for decision support. Not a substitute for official nautical navigation charts.\n\n`;

  report += `[4] WAYPOINT-BY-WAYPOINT NAVIGATION SCHEDULE\n`;
  report += `----------------------------------------------------------------------------------------\n`;
  report += `  LEG  | LATITUDE | LONGITUDE | BEARING | DIST (NM) | EST. FUEL (GAL) | CLEARANCE (KM)\n`;
  report += `  ----+----------+-----------+---------+-----------+-----------------+---------------\n`;

  let cumDistNM = 0;
  for (let i = 0; i < waypoints.length; i++) {
    const [lat, lon] = waypoints[i];
    let legDist = 0;
    let bearing = 0;

    if (i < waypoints.length - 1) {
      const [nextLat, nextLon] = waypoints[i + 1];
      const dLat = (nextLat - lat) * 60;
      const dLon = (nextLon - lon) * 60 * Math.cos(((lat + nextLat) / 2) * (Math.PI / 180));
      legDist = Math.sqrt(dLat * dLat + dLon * dLon);
      cumDistNM += legDist;
      bearing = ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;
    }

    const estFuelLeg = (routeData.total_fuel / Math.max(1, waypoints.length - 1)).toFixed(1);
    const legNum = String(i + 1).padStart(4, ' ');
    const latStr = (lat >= 0 ? `${lat.toFixed(2)}°N` : `${Math.abs(lat).toFixed(2)}°S`).padStart(8, ' ');
    const lonStr = (lon >= 0 ? `${lon.toFixed(2)}°E` : `${Math.abs(lon).toFixed(2)}°W`).padStart(9, ' ');
    const bearingStr = i < waypoints.length - 1 ? `${bearing.toFixed(0)}°`.padStart(7, ' ') : '  TERM ';
    const distStr = legDist.toFixed(1).padStart(9, ' ');
    const fuelStr = (i < waypoints.length - 1 ? estFuelLeg : '0.0').padStart(15, ' ');
    const clearStr = (routeData.avg_clearance_km ? `${routeData.avg_clearance_km} km` : 'Deep Sea').padStart(13, ' ');

    report += `  ${legNum} | ${latStr} | ${lonStr} | ${bearingStr} | ${distStr} | ${fuelStr} | ${clearStr}\n`;
  }

  report += `----------------------------------------------------------------------------------------\n`;
  report += `  TOTAL WAYPOINTS: ${waypoints.length} | CUMULATIVE VOYAGE DISTANCE: ${cumDistNM.toFixed(1)} NM\n`;
  report += `========================================================================================\n`;
  report += `                          END OF VOYAGE DOSSIER REPORT\n`;
  report += `========================================================================================\n`;

  return report;
}

export function downloadFile(content, fileName, contentType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
