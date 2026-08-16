import React, { useState, useEffect } from 'react';
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
const createGlowingIcon = (color, size = 12) => {
  return L.divIcon({
    className: 'custom-glow-icon',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background-color: ${color};
      box-shadow: 0 0 10px ${color}, 0 0 20px ${color};
      border: 2px solid white;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const createShipIcon = (color = '#A855F7') => {
  return L.divIcon({
    className: 'custom-ship-icon',
    html: `<div class="animate-bounce" style="
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: ${color};
      border: 2px solid #FFFFFF;
      border-radius: 6px;
      box-shadow: 0 0 15px ${color};
      color: white;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21h20"/><path d="M19.3 14.8C21.1 13.5 22 11.7 22 9.5c0-3.6-3.6-4.5-5.5-4.5C14.8 5 12 7.7 12 10.5c0-1.8-1.4-3.5-3.5-3.5C6.3 7 5 8.7 5 10.5c0 2.2.9 4 2.7 5.3L2 21h20l-2.7-6.2z"/></svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const portIcon = L.divIcon({
  className: 'custom-port-icon',
  html: `<div style="
    width: 14px;
    height: 14px;
    background-color: #1E293B;
    border: 2.5px solid #38BDF8;
    border-radius: 50%;
    box-shadow: 0 0 10px #38BDF8;
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

// A component to automatically adjust map view to fit paths
function MapBoundsController({ routes }) {
  const map = useMap();
  useEffect(() => {
    if (routes && routes.balanced && routes.balanced.waypoints.length > 0) {
      // Find bounding box for balanced path
      const pts = routes.balanced.waypoints;
      const bounds = L.latLngBounds(pts);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routes, map]);
  return null;
}

export default function MapComponent() {
  const {
    routes,
    selectedRouteKey,
    setSelectedRouteKey,
    weatherShift,
    stormPosition,
    currentVesselIndex,
    weatherLayers
  } = useApp();

  // Layer toggles
  const [showWinds, setShowWinds] = useState(false);
  const [showWaves, setShowWaves] = useState(false);
  const [showPiracy, setShowPiracy] = useState(false);

  // Active path selection
  const routeConfigs = {
    fastest: { color: '#EF4444', label: 'Fastest Route', weight: 4.5 },
    fuel_optimized: { color: '#3B82F6', label: 'Fuel Optimized', weight: 4.5 },
    safest: { color: '#10B981', label: 'Safest Route', weight: 4.5 },
    balanced: { color: '#A855F7', label: 'Balanced Route', weight: 6 }
  };

  // Helper to compile overlay nodes
  const renderEnvironmentalOverlay = () => {
    if (!weatherLayers) return null;
    const { bounds, winds, waves, piracy } = weatherLayers;
    const { west, east, south, north, rows, cols } = bounds;

    const elements = [];
    // Render at a lower density (step of 3) to optimize Leaflet rendering performance
    const step = 3;
    for (let r = 0; r < rows; r += step) {
      for (let c = 0; c < cols; c += step) {
        const lat = north - r * ((north - south) / rows);
        const lon = west + c * ((east - west) / cols);

        if (showWinds) {
          const windSpeed = winds[r][c];
          if (windSpeed > 10) {
            elements.push(
              <Circle
                key={`wind-${r}-${c}`}
                center={[lat, lon]}
                radius={35000 + windSpeed * 2000}
                pathOptions={{
                  color: '#38BDF8',
                  fillColor: '#38BDF8',
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
  const currentVesselPosition = activeWaypoints && activeWaypoints[currentVesselIndex];

  return (
    <div className="relative flex-1 h-[55vh] lg:h-auto border-b lg:border-b-0 lg:border-r border-brand-border bg-brand-bg">
      <MapContainer
        center={[6.5, 75.0]}
        zoom={4}
        className="w-full h-full"
        zoomControl={false}
      >
        {/* Dark theme maps */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Map FitBounds Controller */}
        {routes && <MapBoundsController routes={routes} />}

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
                  opacity: isSelected ? 0.9 : 0.4,
                  dashArray: isSelected ? '' : '6,6'
                }}
                eventHandlers={{
                  click: () => setSelectedRouteKey(key)
                }}
              >
                <Popup>
                  <div className="text-xs font-mono text-gray-200">
                    <p className="font-bold text-sm uppercase mb-1" style={{ color: config.color }}>
                      {config.label}
                    </p>
                    <p>Duration: <span className="text-white font-bold">{route.total_time} Hours</span></p>
                    <p>Fuel: <span className="text-white font-bold">{route.total_fuel} Gal</span></p>
                    <p>Risk Index: <span className="text-white font-bold">{route.total_risk}</span></p>
                    <button
                      onClick={() => setSelectedRouteKey(key)}
                      className="mt-2 w-full text-center bg-brand-border hover:bg-brand-glow/20 border border-brand-border hover:border-brand-glow text-gray-200 text-[10px] py-1 rounded transition"
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
              <Popup><div className="text-xs font-mono font-bold">Departure Port</div></Popup>
            </Marker>
            <Marker position={routes.balanced.waypoints[routes.balanced.waypoints.length - 1]} icon={portIcon}>
              <Popup><div className="text-xs font-mono font-bold">Arrival Port</div></Popup>
            </Marker>
          </>
        )}

        {/* Current Vessel Marker */}
        {currentVesselPosition && (
          <Marker position={currentVesselPosition} icon={createShipIcon(routeConfigs[selectedRouteKey]?.color)}>
            <Popup>
              <div className="text-xs font-mono text-gray-200">
                <p className="font-bold uppercase text-brand-glow">Vessel Position</p>
                <p>Latitude: {currentVesselPosition[0].toFixed(4)}°N</p>
                <p>Longitude: {currentVesselPosition[1].toFixed(4)}°E</p>
                <p>Waypoint: {currentVesselIndex + 1} / {activeWaypoints.length}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Simulated storm overlay */}
        {weatherShift && (
          <Circle
            center={[stormPosition.lat, stormPosition.lon]}
            radius={stormPosition.radius * 1000} // radius in meters
            pathOptions={{
              color: '#EF4444',
              fillColor: '#EF4444',
              fillOpacity: 0.12,
              weight: 1.5,
              className: 'pulse-weather'
            }}
          >
            <Popup>
              <div className="text-xs font-mono text-red-400 font-bold">
                ⚠️ RADAR REPORTED STORM GRID
              </div>
            </Popup>
          </Circle>
        )}
      </MapContainer>

      {/* Layer selector controls HUD */}
      <div className="absolute top-4 right-4 z-[1000] bg-brand-card/90 border border-brand-border p-3 rounded-lg shadow-glow backdrop-blur-md text-xs font-mono space-y-2.5 max-w-[200px]">
        <div className="flex items-center space-x-1.5 border-b border-brand-border/60 pb-1.5 text-gray-300 font-semibold uppercase text-[10px] tracking-wider">
          <Eye className="h-3.5 w-3.5 text-brand-glow" />
          <span>Tactical Map Overlays</span>
        </div>
        
        <label className="flex items-center space-x-2 cursor-pointer text-gray-300 hover:text-white select-none">
          <input
            type="checkbox"
            checked={showWinds}
            onChange={() => setShowWinds(!showWinds)}
            className="rounded bg-brand-bg border-brand-border text-brand-glow focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer"
          />
          <Wind className="h-3.5 w-3.5 text-brand-glow shrink-0" />
          <span>Surface Winds</span>
        </label>

        <label className="flex items-center space-x-2 cursor-pointer text-gray-300 hover:text-white select-none">
          <input
            type="checkbox"
            checked={showWaves}
            onChange={() => setShowWaves(!showWaves)}
            className="rounded bg-brand-bg border-brand-border text-brand-glow focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer"
          />
          <Droplets className="h-3.5 w-3.5 text-orange-400 shrink-0" />
          <span>Wave Heights</span>
        </label>

        <label className="flex items-center space-x-2 cursor-pointer text-gray-300 hover:text-white select-none">
          <input
            type="checkbox"
            checked={showPiracy}
            onChange={() => setShowPiracy(!showPiracy)}
            className="rounded bg-brand-bg border-brand-border text-brand-glow focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer"
          />
          <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <span>Piracy Hotspots</span>
        </label>
      </div>

      {/* Map coordinate scale locator */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-brand-card/75 border border-brand-border/80 px-2.5 py-1 rounded text-[9px] font-mono text-gray-400">
        LAT: [-25°S, 25°N] // LON: [40°E, 110°E]
      </div>
    </div>
  );
}
