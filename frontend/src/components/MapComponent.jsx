import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Eye, Wind, Droplets, ShieldAlert, Navigation, Waves, Compass, RefreshCw, Info, CloudSun, ShieldCheck } from 'lucide-react';

// Fix Leaflet marker icons in React
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// ---------------------------------------------------------------------------
// Ship SVG — Sleek maritime cargo vessel silhouette with containers & bridge
// Points north (up) by default; rotated by CSS transform to match heading.
// ---------------------------------------------------------------------------
const SHIP_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 42" width="26" height="39">
  <!-- Streamlined Hull -->
  <path d="M14 2 C18 9, 23 18, 23 30 C23 37, 19 40, 14 40 C9 40, 5 37, 5 30 C5 18, 10 9, 14 2 Z"
        fill="currentColor" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>
  <!-- Deck Outline -->
  <path d="M14 5 C17 11, 20.5 19, 20.5 29 C20.5 35, 17.5 37.5, 14 37.5 C10.5 37.5, 7.5 35, 7.5 29 C7.5 19, 11 11, 14 5 Z"
        fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="0.8"/>
  <!-- Cargo Containers -->
  <rect x="10.5" y="14" width="7" height="4.5" rx="1" fill="#FFFFFF" fill-opacity="0.85"/>
  <rect x="10.5" y="20.5" width="7" height="4.5" rx="1" fill="#FFFFFF" fill-opacity="0.85"/>
  <!-- Navigation Bridge -->
  <rect x="10" y="27" width="8" height="5" rx="1.2" fill="#0F172A" stroke="#FFFFFF" stroke-width="0.8"/>
  <!-- Bridge Light -->
  <circle cx="14" cy="29.5" r="1" fill="#38BDF8"/>
  <!-- Bow Direction Arrow -->
  <polygon points="14,2 15.5,6.5 12.5,6.5" fill="#FFFFFF"/>
</svg>`;

/**
 * Calculate geographic bearing from point A to point B.
 * Returns degrees clockwise from north (0°=N, 90°=E, 180°=S, 270°=W).
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Create a rotatable ship icon using the maritime vessel SVG.
 */
const createShipMarkerIcon = (color = '#4F46E5', bearing = 0) => {
  return L.divIcon({
    className: 'ship-marker-icon',
    html: `<div style="
      width: 28px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${color};
      filter: drop-shadow(0 3px 8px rgba(0,0,0,0.4));
      transform: rotate(${bearing}deg);
      transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    ">${SHIP_SVG}</div>`,
    iconSize: [28, 42],
    iconAnchor: [14, 21],
    popupAnchor: [0, -22],
  });
};

// Animated Wind Vector Marker
const createWindVectorIcon = (speedKn, dirDeg) => {
  const opacity = Math.min(0.9, Math.max(0.4, speedKn / 25.0));
  const length = Math.min(24, Math.max(12, speedKn * 1.1));
  return L.divIcon({
    className: 'wind-vector-marker',
    html: `<div style="
      transform: rotate(${dirDeg}deg);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      opacity: ${opacity};
    ">
      <svg width="${length}" height="14" viewBox="0 0 24 14" fill="none">
        <path d="M2 7 L20 7 M14 2 L20 7 L14 12" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

// Animated Ocean Current Vector Marker
const createCurrentVectorIcon = (speedKn, dirDeg) => {
  const opacity = Math.min(0.95, Math.max(0.45, speedKn / 1.5));
  return L.divIcon({
    className: 'current-vector-marker',
    html: `<div style="
      transform: rotate(${dirDeg}deg);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      opacity: ${opacity};
    ">
      <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
        <path d="M2 7 C6 4, 10 10, 14 7 L18 7 M13 3 L18 7 L13 11" stroke="#0D9488" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

const portIcon = L.divIcon({
  className: 'custom-port-icon',
  html: `<div style="
    width: 14px;
    height: 14px;
    background-color: #0F172A;
    border: 2.5px solid #2563EB;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(37, 99, 235, 0.4);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// A component to automatically adjust map view to fit paths
function MapBoundsController({ routes }) {
  const map = useMap();
  useEffect(() => {
    if (routes && routes.balanced && routes.balanced.waypoints.length > 0) {
      const pts = routes.balanced.waypoints;
      const bounds = L.latLngBounds(pts);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routes, map]);
  return null;
}

// ---- Route configuration with A/B/C/D naming ----
const ROUTE_CONFIGS = {
  fastest:        { id: 'A', color: '#EF4444', label: 'Route A — Fastest',        weight: 4.5 },
  fuel_optimized: { id: 'B', color: '#2563EB', label: 'Route B — Fuel Optimal',   weight: 4.5 },
  safest:         { id: 'C', color: '#10B981', label: 'Route C — Safest',          weight: 4.5 },
  balanced:       { id: 'D', color: '#7C3AED', label: 'Route D — Recommended',     weight: 6   },
};

export default function MapComponent() {
  const {
    routes,
    selectedRouteKey,
    setSelectedRouteKey,
    weatherShift,
    stormPosition,
    currentVesselIndex,
    weatherLayers,
    emergencyRoute,
    selectedShip,
    origin,
    destination,
    liveEnvironment,
    envSyncing,
    syncOpenMeteo,
    fetchEnvironment,
  } = useApp();

  // Layer toggles
  const [showWinds, setShowWinds] = useState(false);
  const [showWaves, setShowWaves] = useState(false);
  const [showCurrents, setShowCurrents] = useState(false);
  const [showPiracy, setShowPiracy] = useState(false);
  const [showCoastalBuffer, setShowCoastalBuffer] = useState(false);

  // ---- Compute ship heading ----
  const activeWaypoints = routes && routes[selectedRouteKey]?.waypoints;
  const currentVesselPosition = activeWaypoints && activeWaypoints[currentVesselIndex];

  // Update live environment when vessel moves along path
  useEffect(() => {
    if (currentVesselPosition) {
      fetchEnvironment(currentVesselPosition[0], currentVesselPosition[1]);
    }
  }, [currentVesselIndex]);

  const shipBearing = useMemo(() => {
    if (!activeWaypoints || activeWaypoints.length < 2) return 0;
    const idx = currentVesselIndex;
    const nextIdx = idx < activeWaypoints.length - 1 ? idx + 1 : idx;
    const prevIdx = idx > 0 ? idx - 1 : idx;
    const from = nextIdx !== idx ? activeWaypoints[idx] : activeWaypoints[prevIdx];
    const to   = nextIdx !== idx ? activeWaypoints[nextIdx] : activeWaypoints[idx];
    if (from[0] === to[0] && from[1] === to[1]) return 0;
    return calculateBearing(from[0], from[1], to[0], to[1]);
  }, [activeWaypoints, currentVesselIndex]);

  // ---- Ship info derived from context ----
  const shipInfo = useMemo(() => {
    const activeRoute = routes && routes[selectedRouteKey];
    const routeLabel = ROUTE_CONFIGS[selectedRouteKey]?.label || selectedRouteKey;
    const eta = activeRoute ? activeRoute.total_time : '—';
    const risk = activeRoute ? activeRoute.total_risk : '—';

    const disp = selectedShip?.displacement || 50000;
    let baseSpeed;
    let shipType;
    if (disp > 100000) { baseSpeed = 13.0; shipType = 'Tanker'; }
    else if (disp > 70000) { baseSpeed = 12.0; shipType = 'Bulk Carrier'; }
    else { baseSpeed = 20.0; shipType = 'Container Ship'; }

    const totalWp = activeWaypoints ? activeWaypoints.length : 1;
    const progress = totalWp > 1 ? currentVesselIndex / (totalWp - 1) : 0;
    const fuelPct = Math.max(5, Math.round((1 - progress * 0.85) * 100));

    const safetyScore = activeRoute
      ? Math.max(0, Math.min(100, Math.round(100 - (activeRoute.total_risk / 5))))
      : 94;

    return {
      name: selectedShip?.name || 'MV Bharat',
      type: shipType,
      speed: baseSpeed.toFixed(1),
      fuelPct,
      routeLabel,
      eta,
      safetyScore,
      risk,
    };
  }, [routes, selectedRouteKey, selectedShip, activeWaypoints, currentVesselIndex]);

  // Helper to compile overlay nodes
  const renderEnvironmentalOverlay = () => {
    if (!weatherLayers) return null;
    const { bounds, winds, waves, currents, currents_u, currents_v, piracy, coastal_buffer } = weatherLayers;
    const { west, north, rows, cols } = bounds;

    const elements = [];
    const cellDeg = bounds.cell_deg || (north - bounds.south) / rows;
    const step = 2; // Granular step for crisp overlay

    for (let r = 0; r < rows; r += step) {
      for (let c = 0; c < cols; c += step) {
        const lat = north - (r + 0.5) * cellDeg;
        const lon = west + (c + 0.5) * cellDeg;

        // 1. Coastal Buffer (Standoff)
        if (showCoastalBuffer && coastal_buffer) {
          const bufferVal = coastal_buffer[r][c];
          if (bufferVal > 0.5) {
            elements.push(
              <Circle
                key={`buffer-${r}-${c}`}
                center={[lat, lon]}
                radius={38000 + bufferVal * 3000}
                pathOptions={{
                  color: '#F97316',
                  fillColor: '#EA580C',
                  fillOpacity: 0.22,
                  weight: 0.6,
                }}
              />
            );
          }
        }

        // 2. Surface Winds (Direction Vectors & Speed Intensity)
        if (showWinds && winds) {
          const windSpeed = winds[r][c];
          if (windSpeed > 6) {
            // Compute approximate wind direction from Arabian Sea monsoon or local gradient
            const windDir = 240 + Math.sin(lat * 0.1) * 30;
            elements.push(
              <Marker
                key={`wind-vec-${r}-${c}`}
                position={[lat, lon]}
                icon={createWindVectorIcon(windSpeed, windDir)}
                interactive={false}
              />
            );
          }
        }

        // 3. Wave Heights (Swell Heatmap & Sea State)
        if (showWaves && waves) {
          const waveHt = waves[r][c];
          if (waveHt > 0.8) {
            const waveColor = waveHt > 3.0 ? '#DC2626' : waveHt > 2.0 ? '#EA580C' : waveHt > 1.2 ? '#F59E0B' : '#3B82F6';
            elements.push(
              <Circle
                key={`wave-${r}-${c}`}
                center={[lat, lon]}
                radius={30000 + waveHt * 4000}
                pathOptions={{
                  color: waveColor,
                  fillColor: waveColor,
                  fillOpacity: 0.18,
                  weight: 0.5
                }}
              />
            );
          }
        }

        // 4. Ocean Currents (Streamlines & Drift Vectors)
        if (showCurrents && currents_u && currents_v) {
          const u = currents_u[r][c];
          const v = currents_v[r][c];
          const currSpeed = Math.sqrt(u * u + v * v);
          if (currSpeed > 0.15) {
            const currDir = (Math.atan2(u, v) * 180 / Math.PI + 360) % 360;
            elements.push(
              <Marker
                key={`curr-vec-${r}-${c}`}
                position={[lat, lon]}
                icon={createCurrentVectorIcon(currSpeed, currDir)}
                interactive={false}
              />
            );
          }
        }

        // 5. Piracy Hotspots
        if (showPiracy && piracy) {
          const risk = piracy[r][c];
          if (risk > 15) {
            elements.push(
              <Circle
                key={`piracy-${r}-${c}`}
                center={[lat, lon]}
                radius={45000 + risk * 1000}
                pathOptions={{
                  color: '#EF4444',
                  fillColor: '#EF4444',
                  fillOpacity: 0.18,
                  weight: 0.5
                }}
              />
            );
          }
        }
      }
    }
    return elements;
  };

  return (
    <div className="relative flex-1 h-[55vh] lg:h-auto border-b lg:border-b-0 lg:border-r border-slate-200/80 bg-slate-100 font-sans">
      <MapContainer
        center={[6.5, 75.0]}
        zoom={4}
        className="w-full h-full"
        zoomControl={false}
      >
        {/* CartoDB Voyager Light Map Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a> | Weather & Marine: <a href="https://open-meteo.com/">Open-Meteo</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Map FitBounds Controller */}
        {routes && <MapBoundsController routes={routes} />}

        {/* Render raster layers overlays */}
        {renderEnvironmentalOverlay()}

        {/* Render route polylines */}
        {routes &&
          Object.entries(routes)
            .sort(([a], [b]) => {
              if (a === selectedRouteKey) return 1;
              if (b === selectedRouteKey) return -1;
              return 0;
            })
            .map(([key, route]) => {
              const config = ROUTE_CONFIGS[key];
              if (!config) return null;
              const isSelected = selectedRouteKey === key;
              const isRecommended = key === 'balanced';
              return (
                <Polyline
                  key={key}
                  positions={route.waypoints}
                  pathOptions={{
                    color: config.color,
                    weight: isSelected ? (isRecommended ? 7 : config.weight + 1) : 2.5,
                    opacity: isSelected ? 0.95 : 0.4,
                    dashArray: isSelected ? '' : '6,6',
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                  eventHandlers={{
                    click: () => setSelectedRouteKey(key)
                  }}
                >
                  <Popup>
                    <div className="text-xs font-sans text-slate-800 p-1 min-w-[160px]">
                      <p className="font-bold text-sm uppercase mb-1" style={{ color: config.color }}>
                        {config.label}
                      </p>
                      {isRecommended && (
                        <p className="text-[10px] text-amber-600 font-semibold mb-1.5">⭐ RECOMMENDED</p>
                      )}
                      <p className="text-slate-600">Duration: <span className="text-slate-900 font-bold">{route.total_time} Hours</span></p>
                      <p className="text-slate-600">Fuel: <span className="text-slate-900 font-bold">{route.total_fuel.toLocaleString()} Gal</span></p>
                      <p className="text-slate-600">Risk Index: <span className="text-slate-900 font-bold">{route.total_risk}</span></p>
                      {route.avg_clearance_km !== undefined && (
                        <p className="text-slate-600">Coast Clearance: <span className="text-emerald-700 font-bold">{route.avg_clearance_km} km avg</span></p>
                      )}
                      <button
                        onClick={() => setSelectedRouteKey(key)}
                        className="mt-2 w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold py-1 rounded-lg transition"
                      >
                        Select Route
                      </button>
                    </div>
                  </Popup>
                </Polyline>
              );
            })}

        {/* Port markers with actual port names */}
        {routes && (
          <>
            <Marker position={routes.balanced.waypoints[0]} icon={portIcon}>
              <Popup>
                <div className="text-xs font-sans p-1">
                  <p className="font-bold text-blue-700 uppercase tracking-wide">Departure Port</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{origin}</p>
                </div>
              </Popup>
            </Marker>
            <Marker position={routes.balanced.waypoints[routes.balanced.waypoints.length - 1]} icon={portIcon}>
              <Popup>
                <div className="text-xs font-sans p-1">
                  <p className="font-bold text-blue-700 uppercase tracking-wide">Arrival Port</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{destination}</p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Current Vessel Marker */}
        {currentVesselPosition && (
          <Marker
            position={currentVesselPosition}
            icon={createShipMarkerIcon(
              ROUTE_CONFIGS[selectedRouteKey]?.color || '#4F46E5',
              shipBearing
            )}
          >
            <Popup>
              <div className="text-xs font-sans text-slate-800 p-1.5 min-w-[200px] space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <p className="font-bold text-sm text-slate-900">{shipInfo.name}</p>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 uppercase">
                    {shipInfo.type}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <div>
                    <span className="text-slate-400 font-medium">Speed</span>
                    <p className="font-bold text-slate-800">{shipInfo.speed} kn</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Fuel</span>
                    <p className="font-bold text-slate-800">{shipInfo.fuelPct}%</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Route</span>
                    <p className="font-bold text-slate-800" style={{ color: ROUTE_CONFIGS[selectedRouteKey]?.color }}>
                      {ROUTE_CONFIGS[selectedRouteKey]?.id} — {selectedRouteKey === 'balanced' ? 'Recommended' : selectedRouteKey.charAt(0).toUpperCase() + selectedRouteKey.slice(1).replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">ETA</span>
                    <p className="font-bold text-slate-800">{shipInfo.eta} h</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Safety</span>
                    <p className="font-bold text-emerald-600">{shipInfo.safetyScore}/100</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Position</span>
                    <p className="font-bold text-slate-800">{currentVesselPosition[0].toFixed(2)}°, {currentVesselPosition[1].toFixed(2)}°</p>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Emergency optimal route */}
        {emergencyRoute && emergencyRoute.waypoints && (
          <Polyline
            positions={emergencyRoute.waypoints}
            pathOptions={{
              color: '#EA580C',
              weight: 5,
              opacity: 0.95,
              dashArray: '2,10',
              lineCap: 'round'
            }}
          >
            <Popup>
              <div className="text-xs font-sans text-slate-800 p-1">
                <p className="font-bold text-sm uppercase mb-1 text-orange-600">Emergency Route &mdash; {emergencyRoute.label}</p>
                <p className="text-slate-600">Duration: <span className="text-slate-900 font-bold">{emergencyRoute.total_time} Hours</span></p>
                <p className="text-slate-600">Fuel: <span className="text-slate-900 font-bold">{emergencyRoute.total_fuel} Gal</span></p>
                <p className="text-slate-600">Risk Index: <span className="text-slate-900 font-bold">{emergencyRoute.total_risk}</span></p>
              </div>
            </Popup>
          </Polyline>
        )}

        {/* Emergency hazard zone */}
        {emergencyRoute && emergencyRoute.hazard_zone && (
          <Circle
            center={[emergencyRoute.hazard_zone.lat, emergencyRoute.hazard_zone.lon]}
            radius={emergencyRoute.hazard_zone.radius_km * 1000}
            pathOptions={{
              color: '#EA580C',
              fillColor: '#EA580C',
              fillOpacity: 0.15,
              weight: 1.5,
              className: 'pulse-weather'
            }}
          >
            <Popup>
              <div className="text-xs font-sans text-orange-600 font-bold">
                ⚠️ EMERGENCY HAZARD ZONE
              </div>
            </Popup>
          </Circle>
        )}

        {/* Simulated storm overlay */}
        {weatherShift && (
          <Circle
            center={[stormPosition.lat, stormPosition.lon]}
            radius={stormPosition.radius * 1000}
            pathOptions={{
              color: '#EF4444',
              fillColor: '#EF4444',
              fillOpacity: 0.15,
              weight: 1.5,
              className: 'pulse-weather'
            }}
          >
            <Popup>
              <div className="text-xs font-sans text-rose-600 font-bold">
                ⚠️ RADAR REPORTED STORM GRID
              </div>
            </Popup>
          </Circle>
        )}
      </MapContainer>

      {/* Tactical Map Overlays Layer Selector HUD */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/95 border border-slate-200 p-3.5 rounded-2xl shadow-md backdrop-blur-md text-xs font-sans space-y-2.5 max-w-[220px]">
        <div className="flex items-center space-x-1.5 border-b border-slate-100 pb-2 text-slate-800 font-bold uppercase text-[11px] tracking-wider">
          <Eye className="h-4 w-4 text-blue-600" />
          <span>Tactical Map Overlays</span>
        </div>
        
        <label className="flex items-center space-x-2.5 cursor-pointer text-slate-600 hover:text-slate-900 select-none">
          <input
            type="checkbox"
            checked={showCoastalBuffer}
            onChange={() => setShowCoastalBuffer(!showCoastalBuffer)}
            className="rounded border-slate-300 text-orange-600 focus:ring-0 focus:ring-offset-0 h-4 w-4 cursor-pointer"
          />
          <ShieldCheck className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="font-medium text-xs">Coastal Buffer (Standoff)</span>
        </label>

        <label className="flex items-center space-x-2.5 cursor-pointer text-slate-600 hover:text-slate-900 select-none">
          <input
            type="checkbox"
            checked={showWinds}
            onChange={() => setShowWinds(!showWinds)}
            className="rounded border-slate-300 text-blue-600 focus:ring-0 focus:ring-offset-0 h-4 w-4 cursor-pointer"
          />
          <Wind className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="font-medium text-xs">Surface Winds (Vectors)</span>
        </label>

        <label className="flex items-center space-x-2.5 cursor-pointer text-slate-600 hover:text-slate-900 select-none">
          <input
            type="checkbox"
            checked={showWaves}
            onChange={() => setShowWaves(!showWaves)}
            className="rounded border-slate-300 text-blue-600 focus:ring-0 focus:ring-offset-0 h-4 w-4 cursor-pointer"
          />
          <Droplets className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="font-medium text-xs">Wave Heights (Sea State)</span>
        </label>

        <label className="flex items-center space-x-2.5 cursor-pointer text-slate-600 hover:text-slate-900 select-none">
          <input
            type="checkbox"
            checked={showCurrents}
            onChange={() => setShowCurrents(!showCurrents)}
            className="rounded border-slate-300 text-teal-600 focus:ring-0 focus:ring-offset-0 h-4 w-4 cursor-pointer"
          />
          <Waves className="h-4 w-4 text-teal-600 shrink-0" />
          <span className="font-medium text-xs">Ocean Currents (Drift)</span>
        </label>

        <label className="flex items-center space-x-2.5 cursor-pointer text-slate-600 hover:text-slate-900 select-none">
          <input
            type="checkbox"
            checked={showPiracy}
            onChange={() => setShowPiracy(!showPiracy)}
            className="rounded border-slate-300 text-blue-600 focus:ring-0 focus:ring-offset-0 h-4 w-4 cursor-pointer"
          />
          <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />
          <span className="font-medium text-xs">Piracy Hotspots</span>
        </label>
      </div>

      {/* Live Open-Meteo Environmental Telemetry Panel HUD (Top-Left overlay) */}
      <div className="absolute top-4 left-4 z-[1000] bg-white/95 border border-slate-200 p-3.5 rounded-2xl shadow-md backdrop-blur-md text-xs font-sans space-y-2.5 max-w-[260px]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-1.5">
            <CloudSun className="h-4 w-4 text-amber-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">Live Environment</span>
          </div>
          <button
            onClick={syncOpenMeteo}
            disabled={envSyncing}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 text-[10px] font-semibold transition cursor-pointer disabled:opacity-50"
            title="Sync Live Basin Data from Open-Meteo"
          >
            <RefreshCw className={`h-3 w-3 ${envSyncing ? 'animate-spin' : ''}`} />
            <span>{envSyncing ? 'Syncing...' : 'Sync Live'}</span>
          </button>
        </div>

        {liveEnvironment ? (
          <div className="space-y-2 text-[11px]">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-medium block">Wind</span>
                <span className="font-bold text-slate-800">{liveEnvironment.wind.speed_kn} kn</span>
                <span className="text-[10px] text-blue-600 font-semibold ml-1">{liveEnvironment.wind.compass}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-medium block">Waves</span>
                <span className="font-bold text-slate-800">{liveEnvironment.waves.height_m} m</span>
                <span className="text-[10px] text-amber-600 font-semibold ml-1">{liveEnvironment.waves.period_s}s</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-medium block">Current</span>
                <span className="font-bold text-teal-700">{liveEnvironment.currents.speed_kn} kn</span>
                <span className="text-[10px] text-teal-600 font-semibold ml-1">{liveEnvironment.currents.compass}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-medium block">Weather</span>
                <span className="font-bold text-slate-800 truncate block text-[10px]">{liveEnvironment.weather.description}</span>
              </div>
            </div>

            <div className="pt-1 border-t border-slate-100 text-[9px] text-slate-400 leading-tight space-y-0.5">
              <div className="flex items-center justify-between">
                <span>Source: <strong className="text-slate-600">{liveEnvironment.data_source}</strong></span>
                <span className="text-emerald-600 font-semibold">● Live</span>
              </div>
              <p className="text-slate-400 italic">Data: Open-Meteo (CC BY 4.0)</p>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 py-1">
            Loading live environmental forecast...
          </div>
        )}
      </div>

      {/* Route legend & Attribution disclaimer — bottom-left HUD */}
      {routes && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 border border-slate-200/80 px-3.5 py-2.5 rounded-2xl shadow-md backdrop-blur-md text-[10px] font-sans space-y-1.5 max-w-[320px]">
          <div className="space-y-1">
            {Object.entries(ROUTE_CONFIGS).map(([key, cfg]) => {
              const isSelected = selectedRouteKey === key;
              return (
                <div
                  key={key}
                  onClick={() => setSelectedRouteKey(key)}
                  className={`flex items-center space-x-2 cursor-pointer px-1.5 py-0.5 rounded-lg transition ${
                    isSelected ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="inline-block w-4 h-1 rounded-full"
                    style={{ backgroundColor: cfg.color, height: isSelected ? 3 : 2 }}
                  />
                  <span className={`${isSelected ? 'text-slate-900' : 'text-slate-500'} font-semibold`}>
                    {cfg.label} {key === 'balanced' && '⭐'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-1.5 border-t border-slate-100 text-[8.5px] text-slate-400 leading-snug">
            Forecast model data for decision support. Not certified navigation info.
          </div>
        </div>
      )}
    </div>
  );
}
