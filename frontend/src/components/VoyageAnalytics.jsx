import React from 'react';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Play, Pause, RefreshCw, Compass, ShieldAlert, HeartHandshake, MapPin } from 'lucide-react';

export default function VoyageAnalytics() {
  const {
    routes,
    selectedRouteKey,
    weatherShift,
    stormPosition,
    currentVesselIndex,
    setCurrentVesselIndex,
    isPlayingTelemetry,
    setIsPlayingTelemetry
  } = useApp();

  if (!routes) {
    return (
      <div className="h-64 bg-brand-card/40 border border-brand-border rounded-lg flex flex-col items-center justify-center text-xs font-mono text-gray-400 p-6 text-center space-y-2">
        <Compass className="h-8 w-8 text-brand-glow animate-spin" />
        <p>No telemetry active. Please calculate routes and configure voyage profiles on the Main Command Dashboard.</p>
      </div>
    );
  }

  const activeRoute = routes[selectedRouteKey];
  const waypoints = activeRoute.waypoints;
  const currentPos = waypoints[currentVesselIndex] || waypoints[0];

  // Helper: Haversine distance calculator for local assistance checks
  const getLocalDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3440.065; // NM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
  };

  // Compile Recharts comparison dataset
  const chartData = Object.entries(routes).map(([key, data]) => {
    let displayName = 'Balanced';
    if (key === 'fastest') displayName = 'Fastest';
    else if (key === 'fuel_optimized') displayName = 'Fuel Opt';
    else if (key === 'safest') displayName = 'Safest';
    
    return {
      name: displayName,
      Time: data.total_time,
      Fuel: data.total_fuel,
      Risk: data.total_risk,
      rawKey: key
    };
  });

  // Calculate elapsed and remaining voyage metrics
  const totalWaypoints = waypoints.length;
  // Let's assume each waypoint takes a step of around 6 hours on average
  const hourStep = activeRoute.total_time / Math.max(1, totalWaypoints - 1);
  const elapsedHours = Math.round(currentVesselIndex * hourStep);
  const remainingHours = Math.round(Math.max(0, activeRoute.total_time - elapsedHours));
  
  const startPt = waypoints[0];
  const endPt = waypoints[totalWaypoints - 1];
  const totalDistance = getLocalDistance(startPt[0], startPt[1], endPt[0], endPt[1]);
  const currentTraveled = Math.round((currentVesselIndex / (totalWaypoints - 1)) * totalDistance);
  const remainingDistance = Math.max(0, totalDistance - currentTraveled);

  // Check proximity of simulated storm
  let stormDistance = null;
  if (weatherShift) {
    stormDistance = getLocalDistance(currentPos[0], currentPos[1], stormPosition.lat, stormPosition.lon);
  }

  // Calculate distances to friendly/rescue assets based on ship's current coordinate
  const emergencyAssets = [
    { name: "Colombo Port SAR Authority", lat: 6.94, lon: 79.86, type: "Coastal Station" },
    { name: "Aden Fleet Escort Base", lat: 12.8, lon: 45.0, type: "Military Hub" },
    { name: "Aegir Glory (Tanker)", lat: currentPos[0] + 1.2, lon: currentPos[1] - 0.8, type: "Fleet Vessel" },
    { name: "INS Vikrant (Patrol)", lat: currentPos[0] - 2.5, lon: currentPos[1] + 1.5, type: "Security Escort" }
  ].map(asset => ({
    ...asset,
    distance: getLocalDistance(currentPos[0], currentPos[1], asset.lat, asset.lon)
  })).sort((a, b) => a.distance - b.distance);

  return (
    <div className="space-y-6 select-none font-sans">
      
      {/* Recharts Trade-Off Comparative Bar Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Time Comparison chart */}
        <div className="bg-brand-card/50 border border-brand-border rounded-lg p-4">
          <h4 className="text-xs font-mono font-bold text-brand-time uppercase mb-2">Voyage Duration (Hours)</h4>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#23334D" />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={9} />
                <YAxis stroke="#9CA3AF" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: '#161F30', borderColor: '#23334D' }} />
                <Bar dataKey="Time" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fuel Comparison chart */}
        <div className="bg-brand-card/50 border border-brand-border rounded-lg p-4">
          <h4 className="text-xs font-mono font-bold text-brand-fuel uppercase mb-2">Bunker Fuel (Gallons)</h4>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#23334D" />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={9} />
                <YAxis stroke="#9CA3AF" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: '#161F30', borderColor: '#23334D' }} />
                <Bar dataKey="Fuel" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Comparison chart */}
        <div className="bg-brand-card/50 border border-brand-border rounded-lg p-4">
          <h4 className="text-xs font-mono font-bold text-brand-safety uppercase mb-2">Risk Exposure Index</h4>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#23334D" />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={9} />
                <YAxis stroke="#9CA3AF" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: '#161F30', borderColor: '#23334D' }} />
                <Bar dataKey="Risk" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Telemetry and Assistance Split Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Mid-Voyage Telemetry Panel */}
        <div className="bg-brand-card/50 border border-brand-border rounded-lg p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-brand-border pb-2.5 mb-4">
            <div className="flex items-center space-x-2">
              <Compass className="h-4.5 w-4.5 text-brand-glow animate-pulse" />
              <h3 className="text-sm font-semibold text-white">Live Voyage Telemetry Panel</h3>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsPlayingTelemetry(!isPlayingTelemetry)}
                className={`p-1.5 rounded border border-brand-border transition flex items-center justify-center cursor-pointer ${
                  isPlayingTelemetry ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-brand-bg hover:bg-brand-border text-gray-300'
                }`}
              >
                {isPlayingTelemetry ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button
                onClick={() => {
                  setCurrentVesselIndex(0);
                  setIsPlayingTelemetry(false);
                }}
                className="p-1.5 bg-brand-bg hover:bg-brand-border rounded border border-brand-border text-gray-300 transition cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Voyage progress bar */}
            <div>
              <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 mb-1.5">
                <span>Voyage Leg Completion</span>
                <span>{currentVesselIndex + 1} / {totalWaypoints} Coordinates</span>
              </div>
              <div className="w-full bg-brand-bg h-2 rounded-full overflow-hidden border border-brand-border">
                <div
                  className="bg-gradient-to-r from-brand-glow to-brand-accent h-full transition-all duration-300"
                  style={{ width: `${((currentVesselIndex + 1) / totalWaypoints) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Metrics cards grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-brand-bg/50 border border-brand-border/60 p-2.5 rounded">
                <span className="block text-[9px] text-gray-500 uppercase mb-0.5">Elapsed Time</span>
                <span className="font-bold text-gray-200 text-sm">{elapsedHours} Hours</span>
              </div>
              <div className="bg-brand-bg/50 border border-brand-border/60 p-2.5 rounded">
                <span className="block text-[9px] text-gray-500 uppercase mb-0.5">Remaining time</span>
                <span className="font-bold text-brand-glow text-sm">{remainingHours} Hours</span>
              </div>
              <div className="bg-brand-bg/50 border border-brand-border/60 p-2.5 rounded">
                <span className="block text-[9px] text-gray-500 uppercase mb-0.5">Traveled Distance</span>
                <span className="font-bold text-gray-200 text-sm">{currentTraveled} NM</span>
              </div>
              <div className="bg-brand-bg/50 border border-brand-border/60 p-2.5 rounded">
                <span className="block text-[9px] text-gray-500 uppercase mb-0.5">Distance Remaining</span>
                <span className="font-bold text-brand-accent text-sm">{remainingDistance} NM</span>
              </div>
            </div>

            {/* Weather alert details */}
            {weatherShift && stormDistance !== null && (
              <div className={`p-3 rounded border flex items-center space-x-3 text-xs font-mono ${
                stormDistance < 250 
                  ? 'bg-red-950/20 border-red-500/40 text-red-400' 
                  : 'bg-orange-950/10 border-orange-500/30 text-orange-400'
              }`}>
                <ShieldAlert className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold uppercase">Dynamic Hazard Proximity</p>
                  <p className="text-[10px]">
                    Storm Center: {stormDistance} NM. {stormDistance < 250 ? "CRITICAL: Course correction initiated via D* Lite." : "Aegis auto-correct bounds standing by."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nearby Assistance Locator Card */}
        <div className="bg-brand-card/50 border border-brand-border rounded-lg p-4">
          <div className="flex items-center space-x-2 border-b border-brand-border pb-2.5 mb-4">
            <HeartHandshake className="h-4.5 w-4.5 text-brand-safety" />
            <h3 className="text-sm font-semibold text-white">Emergency Assistance Locator</h3>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] text-gray-400 font-mono">
              Live tracking closest rescue stations and fleet units relative to vessel node: 
              <span className="text-gray-200 font-bold ml-1">
                [{currentPos[0].toFixed(2)}N, {currentPos[1].toFixed(2)}E]
              </span>
            </p>
            
            <div className="space-y-2">
              {emergencyAssets.map((asset, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-brand-bg/40 border border-brand-border/60 hover:border-brand-border rounded text-xs font-mono">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-3.5 w-3.5 text-brand-glow shrink-0" />
                    <div>
                      <span className="block text-gray-200 font-bold leading-none mb-0.5">{asset.name}</span>
                      <span className="text-[9px] text-gray-400 uppercase leading-none">{asset.type}</span>
                    </div>
                  </div>
                  <span className="text-brand-safety font-bold bg-brand-safety/5 px-2 py-0.5 rounded border border-brand-safety/20">
                    {asset.distance} NM
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
