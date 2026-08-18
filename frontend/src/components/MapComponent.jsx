import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Eye, Wind, Droplets, ShieldAlert, Navigation } from 'lucide-react';

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

// Custom glowing icons using inline SVGs
const createGlowingIcon = (color, size = 14) => {
  return L.divIcon({
    className: 'custom-glow-icon',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background-color: ${color};
      box-shadow: 0 0 10px ${color}, 0 0 15px ${color};
      border: 2px solid white;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const createShipIcon = (color = '#4F46E5') => {
  return L.divIcon({
    className: 'custom-ship-icon',
    html: `<div class="animate-bounce" style="
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: ${color};
      border: 2.5px solid #FFFFFF;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      color: white;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21h20"/><path d="M19.3 14.8C21.1 13.5 22 11.7 22 9.5c0-3.6-3.6-4.5-5.5-4.5C14.8 5 12 7.7 12 10.5c0-1.8-1.4-3.5-3.5-3.5C6.3 7 5 8.7 5 10.5c0 2.2.9 4 2.7 5.3L2 21h20l-2.7-6.2z"/></svg>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
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
  iconAnchor: [7, 7]
});

// A component to automatically adjust map view to fit paths
function MapBoundsController({ routes, fitToken }) {
  const map = useMap();
  const routesRef = useRef(routes);
  routesRef.current = routes;

  // Keyed on fitToken alone, deliberately. The view is re-framed when a new
  // voyage is plotted, not every time a drag-to-reroute replaces the routes --
  // snap-zooming the moment the operator releases the vessel is disorienting.
  useEffect(() => {
    const pts = routesRef.current?.balanced?.waypoints;
    if (pts && pts.length > 0) {
      map.fitBounds(L.latLngBounds(pts), { padding: [50, 50] });
    }
  }, [fitToken, map]);
  return null;
}

/**
 * Index of the route waypoint nearest a coordinate.
 *
 * Measured in screen space rather than in degrees, so the snap tracks the cursor
 * the same way at every zoom level.
 */
function nearestWaypointIndex(map, projected, latlng) {
  const cursor = map.latLngToLayerPoint(latlng);
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < projected.length; i++) {
    const dist = cursor.distanceTo(projected[i]);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/**
 * The vessel marker, draggable along its own track.
 *
 * Dragging is constrained to the route line: every drag event snaps the marker
 * back onto the nearest waypoint, so the ship slides along the plotted course
 * instead of being dropped onto open water. On release the drop point is handed
 * to `onCommit`, which re-solves the Pareto front from there.
 *
 * The live drag index is kept in a ref and never in state: re-rendering this
 * component mid-drag makes react-leaflet call `marker.setIcon()`, and Leaflet
 * rebuilds the marker's drag handler from scratch on setIcon, which aborts the
 * drag in progress. The marker is therefore moved imperatively while dragging,
 * and React state is only touched once the drag is over.
 */
function DraggableVessel({ waypoints, color, canDrag, index, onCommit }) {
  const map = useMap();
  // Where the vessel is parked after a drop while the front is re-solved.
  // Null means "wherever `index` says".
  const [heldIdx, setHeldIdx] = useState(null);
  const dragIdxRef = useRef(null);
  const projectedRef = useRef(null);

  // For the same reason: a fresh L.divIcon on every render reads to
  // react-leaflet as an icon change, so its identity has to stay stable.
  const icon = useMemo(() => createShipIcon(color), [color]);

  // Release the held index whenever the underlying track changes. After a
  // successful reroute the new route already begins at the drop point, so the
  // vessel belongs at index 0 of the new waypoints -- holding a stale index here
  // would briefly park it at the wrong end of the shorter route.
  useEffect(() => {
    dragIdxRef.current = null;
    setHeldIdx(null);
  }, [waypoints]);

  const shownIdx = Math.min(heldIdx ?? index, waypoints.length - 1);
  const position = waypoints[shownIdx];

  const eventHandlers = useMemo(() => ({
    dragstart: () => {
      dragIdxRef.current = index;
      // The map cannot pan or zoom while a marker is being dragged, so the track
      // only needs projecting once per drag rather than once per mouse move.
      projectedRef.current = waypoints.map(
        ([lat, lon]) => map.latLngToLayerPoint(L.latLng(lat, lon))
      );
    },
    drag: (e) => {
      const marker = e.target;
      if (!projectedRef.current) return;
      const i = nearestWaypointIndex(map, projectedRef.current, marker.getLatLng());
      dragIdxRef.current = i;
      marker.setLatLng(L.latLng(waypoints[i][0], waypoints[i][1]));
    },
    dragend: async () => {
      const dropped = dragIdxRef.current;
      projectedRef.current = null;
      // A drop back where it started, or onto the destination berth itself,
      // has nothing to re-solve; the marker simply springs back.
      if (dropped === null || dropped === index || dropped >= waypoints.length - 1) {
        setHeldIdx(null);
        return;
      }
      // Park the vessel at the drop point while the front is re-solved -- the
      // effect above releases it once the new track arrives. Only a failed
      // reroute springs it back to where the voyage left it.
      setHeldIdx(dropped);
      const ok = await onCommit(dropped);
      if (!ok) setHeldIdx(null);
    }
  }), [map, waypoints, index, onCommit]);

  if (!position) return null;

  return (
    <Marker
      position={position}
      icon={icon}
      draggable={canDrag}
      // Keeps the vessel above the port pin it sits on at the start of a voyage,
      // so a grab at the origin lands on the ship and not on the port marker.
      zIndexOffset={1000}
      eventHandlers={eventHandlers}
    >
      <Popup>
        <div className="text-xs font-sans text-slate-800 p-1">
          <p className="font-bold uppercase text-blue-600">Vessel Position</p>
          <p className="text-slate-600">Latitude: <span className="font-medium text-slate-900">{position[0].toFixed(4)}°N</span></p>
          <p className="text-slate-600">Longitude: <span className="font-medium text-slate-900">{position[1].toFixed(4)}°E</span></p>
          <p className="text-slate-600">Waypoint: <span className="font-medium text-slate-900">{shownIdx + 1} / {waypoints.length}</span></p>
          {canDrag && (
            <p className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
              Drag along the track to replan from that point.
            </p>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

export default function MapComponent() {
  const {
    routes,
    selectedRouteKey,
    setSelectedRouteKey,
    weatherShift,
    stormPosition,
    currentVesselIndex,
    weatherLayers,
    loading,
    isRerouting,
    hasRerouted,
    fitToken,
    rerouteFromIndex
  } = useApp();

  // Layer toggles
  const [showWinds, setShowWinds] = useState(false);
  const [showWaves, setShowWaves] = useState(false);
  const [showPiracy, setShowPiracy] = useState(false);

  // Active path selection
  const routeConfigs = {
    fastest: { color: '#EF4444', label: 'Fastest Route', weight: 4.5 },
    fuel_optimized: { color: '#2563EB', label: 'Fuel Optimized', weight: 4.5 },
    safest: { color: '#10B981', label: 'Safest Route', weight: 4.5 },
    balanced: { color: '#4F46E5', label: 'Balanced Route', weight: 6 }
  };

  // Helper to compile overlay nodes
  const renderEnvironmentalOverlay = () => {
    if (!weatherLayers) return null;
    const { bounds, winds, waves, piracy } = weatherLayers;
    const { west, east, south, north, rows, cols } = bounds;

    const elements = [];
    // The API block-reduces the 0.25 deg routing grid down to `cell_deg` (1 deg
    // by default); step thins it further so Leaflet stays responsive.
    const cellDeg = bounds.cell_deg || (north - south) / rows;
    const step = 3;
    for (let r = 0; r < rows; r += step) {
      for (let c = 0; c < cols; c += step) {
        // Cell centres, so an overlay marker sits on the water it describes
        const lat = north - (r + 0.5) * cellDeg;
        const lon = west + (c + 0.5) * cellDeg;

        if (showWinds) {
          const windSpeed = winds[r][c];
          if (windSpeed > 10) {
            elements.push(
              <Circle
                key={`wind-${r}-${c}`}
                center={[lat, lon]}
                radius={35000 + windSpeed * 2000}
                pathOptions={{
                  color: '#2563EB',
                  fillColor: '#2563EB',
                  fillOpacity: 0.15,
                  weight: 0.5
                }}
              />
            );
          }
        }

        if (showWaves) {
          const waveHt = waves[r][c];
          if (waveHt > 1.5) {
            elements.push(
              <Circle
                key={`wave-${r}-${c}`}
                center={[lat, lon]}
                radius={35000 + waveHt * 5000}
                pathOptions={{
                  color: '#F59E0B',
                  fillColor: '#F59E0B',
                  fillOpacity: 0.2,
                  weight: 0.5
                }}
              />
            );
          }
        }

        if (showPiracy) {
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

  const activeWaypoints = routes && routes[selectedRouteKey]?.waypoints;

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
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Map FitBounds Controller */}
        <MapBoundsController routes={routes} fitToken={fitToken} />

        {/* Render raster layers overlays */}
        {renderEnvironmentalOverlay()}

        {/* Render paths */}
        {routes &&
          Object.entries(routes).map(([key, route]) => {
            const config = routeConfigs[key];
            const isSelected = selectedRouteKey === key;
            return (
              <Polyline
                key={key}
                positions={route.waypoints}
                pathOptions={{
                  color: config.color,
                  weight: isSelected ? config.weight : 2.5,
                  opacity: isSelected ? 0.95 : 0.45,
                  dashArray: isSelected ? '' : '6,6'
                }}
                eventHandlers={{
                  click: () => setSelectedRouteKey(key)
                }}
              >
                <Popup>
                  <div className="text-xs font-sans text-slate-800 p-1">
                    <p className="font-bold text-sm uppercase mb-1" style={{ color: config.color }}>
                      {config.label}
                    </p>
                    <p className="text-slate-600">Duration: <span className="text-slate-900 font-bold">{route.total_time} Hours</span></p>
                    <p className="text-slate-600">Fuel: <span className="text-slate-900 font-bold">{route.total_fuel} Gal</span></p>
                    <p className="text-slate-600">Risk Index: <span className="text-slate-900 font-bold">{route.total_risk}</span></p>
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

        {/* Port markers */}
        {routes && (
          <>
            <Marker position={routes.balanced.waypoints[0]} icon={portIcon}>
              <Popup>
                <div className="text-xs font-sans font-bold text-slate-800">
                  {/* After a reroute this pin sits at the drop point, not at the berth */}
                  {hasRerouted ? 'Voyage Resumed From' : 'Departure Port'}
                </div>
              </Popup>
            </Marker>
            <Marker position={routes.balanced.waypoints[routes.balanced.waypoints.length - 1]} icon={portIcon}>
              <Popup><div className="text-xs font-sans font-bold text-slate-800">Arrival Port</div></Popup>
            </Marker>
          </>
        )}

        {/* Current Vessel Marker, draggable along its own track */}
        {activeWaypoints && activeWaypoints.length > 0 && (
          <DraggableVessel
            waypoints={activeWaypoints}
            color={routeConfigs[selectedRouteKey]?.color}
            canDrag={!loading && !isRerouting}
            index={currentVesselIndex}
            onCommit={rerouteFromIndex}
          />
        )}

        {/* Simulated storm overlay */}
        {weatherShift && (
          <Circle
            center={[stormPosition.lat, stormPosition.lon]}
            radius={stormPosition.radius * 1000} // radius in meters
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

      {/* Reroute-in-progress overlay */}
      {isRerouting && (
        <div className="absolute inset-0 z-[1200] flex items-center justify-center bg-slate-900/10 backdrop-blur-[1px] pointer-events-none">
          <div className="flex items-center space-x-2.5 bg-white/95 border border-slate-200 px-4 py-2.5 rounded-2xl shadow-md text-xs font-semibold text-slate-700">
            <Navigation className="h-4 w-4 text-blue-600 animate-spin" />
            <span>Recomputing Pareto front from vessel position…</span>
          </div>
        </div>
      )}

      {/* Drag-to-replan hint */}
      {routes && !isRerouting && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 border border-slate-200/80 px-3 py-1 rounded-full text-[10px] font-semibold text-slate-600 shadow-xs whitespace-nowrap">
          Drag the vessel along its track to replan from that point
        </div>
      )}

      {/* Layer selector controls HUD */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/95 border border-slate-200 p-3.5 rounded-2xl shadow-md backdrop-blur-md text-xs font-sans space-y-2.5 max-w-[210px]">
        <div className="flex items-center space-x-1.5 border-b border-slate-100 pb-2 text-slate-800 font-bold uppercase text-[11px] tracking-wider">
          <Eye className="h-4 w-4 text-blue-600" />
          <span>Tactical Map Overlays</span>
        </div>
        
        <label className="flex items-center space-x-2.5 cursor-pointer text-slate-600 hover:text-slate-900 select-none">
          <input
            type="checkbox"
            checked={showWinds}
            onChange={() => setShowWinds(!showWinds)}
            className="rounded border-slate-300 text-blue-600 focus:ring-0 focus:ring-offset-0 h-4 w-4 cursor-pointer"
          />
          <Wind className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="font-medium text-xs">Surface Winds</span>
        </label>

        <label className="flex items-center space-x-2.5 cursor-pointer text-slate-600 hover:text-slate-900 select-none">
          <input
            type="checkbox"
            checked={showWaves}
            onChange={() => setShowWaves(!showWaves)}
            className="rounded border-slate-300 text-blue-600 focus:ring-0 focus:ring-offset-0 h-4 w-4 cursor-pointer"
          />
          <Droplets className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="font-medium text-xs">Wave Heights</span>
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

      {/* Map coordinate scale locator */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 border border-slate-200/80 px-3 py-1 rounded-full text-[10px] font-semibold text-slate-600 shadow-xs">
        LAT: [-25°S, 25°N] // LON: [40°E, 110°E]
      </div>
    </div>
  );
}
